// The coach orchestrator (spec section 2). One turn is:
//
//   pre-request crisis classifier -> turn preamble (server pre-fetch of today's
//   score) -> model loop (tool calls executed server-side, bounded) ->
//   post-response numeric grounding (reject, regenerate ONCE, else fallback) ->
//   reply
//
// The whole reply is buffered and validated as one unit; nothing is streamed.
// A 12-second end-to-end budget (fast tier) bounds the whole chain: on expiry,
// including mid-regenerate, the orchestrator stops waiting and returns the
// preamble-composed fallback. The clock is injectable so tests never sleep.

import { localCivilDate } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { CoachClock, systemClock } from './clock';
import { composeFallback, loadPreamble, Preamble } from './fallback';
import { stripDisclaimer, withDisclaimer } from './guardrails/disclaimer';
import { classifyCrisis, CRISIS_RESOURCES, SAFETY_REPLY } from './guardrails/crisis';
import { GuardrailReason, TurnToolResult, validateReply } from './guardrails/grounding';
import {
  createPendingMemories,
  loadConfirmedMemories,
  MAX_PROPOSALS_PER_TURN,
  MemoryDTO,
  MemoryProposal,
  resolvePendingMemories,
} from './memory';
import type { CoachModelMessage, CoachModelProvider, CoachTier, ToolCallRequest } from './model/provider';
import { resolvePersona } from './personas';
import { buildCorrectiveMessage, buildSystemPrompt } from './prompt';
import { routeTier } from './router';
import type { CoachTelemetry, CoachEventAttributes, CoachEventName } from './telemetry';
import { CoachTools, coachTools, ProposeMemoryResult } from './tools';

export const FAST_TIER_BUDGET_MS = 12_000;
/**
 * The spec gives the synthesis tier no user-facing budget because its main use
 * (the weekly recap) is a background job. Inline, an unbounded wait would hang
 * the request, so it gets a generous safety cap instead.
 */
export const SYNTHESIS_TIER_BUDGET_MS = 60_000;
export const MAX_MODEL_CALLS = 8;
export const HISTORY_WINDOW = 10;
/** Fixed, server-appended (never model-generated) when a memory proposal was stored this turn. No digits. */
export const MEMORY_NOTE = "I'll remember that — let me know if that's not right.";

export interface CoachTurnInput {
  userId: string;
  message: string;
  /** Prior turns of this conversation, oldest first. Assistant text may still carry the disclaimer. */
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  safetyOverride?: boolean;
}

/** Persisted on the assistant message: reasons and counts only. */
export type CoachTurnEvent =
  | { type: 'guardrail_reject'; reason: GuardrailReason; attempt: number; outcome: 'regenerate' | 'fallback' }
  | { type: 'latency_budget_exceeded' };

export interface CoachTurnResult {
  /** Final reply text, disclaimer included. */
  text: string;
  source: 'MODEL' | 'FALLBACK' | 'SAFETY';
  events: CoachTurnEvent[];
  safety?: { resources: string[]; canContinue: true };
  tier: CoachTier;
  personaId: string;
  /** Memory entries written (PENDING) this turn, only when the reply itself was a validated model reply. */
  memoryProposals?: MemoryDTO[];
}

export interface OrchestratorDeps {
  provider: CoachModelProvider;
  telemetry: CoachTelemetry;
  tools?: CoachTools;
  clock?: CoachClock;
  budgets?: { fast?: number; synthesis?: number };
  loadUser?: (userId: string) => Promise<{ timezone: string; coachPersonaId: string | null }>;
}

async function defaultLoadUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, coachPersonaId: true } });
  return { timezone: user?.timezone ?? 'UTC', coachPersonaId: user?.coachPersonaId ?? null };
}

function safeCivilDate(now: number, timezone: string): string {
  try {
    return localCivilDate(new Date(now), timezone);
  } catch {
    return localCivilDate(new Date(now), 'UTC');
  }
}

type RunOutcome =
  | { kind: 'reply'; text: string; proposals: MemoryProposal[] }
  | { kind: 'fallback'; reason: string }
  | { kind: 'expired' };

const PREAMBLE_CALL_ID = 'preamble-getDailyScore';

export function createCoachOrchestrator(deps: OrchestratorDeps) {
  const tools = deps.tools ?? coachTools;
  const clock = deps.clock ?? systemClock;
  const loadUser = deps.loadUser ?? defaultLoadUser;
  const budgets = {
    fast: deps.budgets?.fast ?? FAST_TIER_BUDGET_MS,
    synthesis: deps.budgets?.synthesis ?? SYNTHESIS_TIER_BUDGET_MS,
  };

  async function handleTurn(input: CoachTurnInput): Promise<CoachTurnResult> {
    const startedAt = clock.now();
    const { userId } = input;
    const user = await loadUser(userId);
    const persona = resolvePersona(user.coachPersonaId);
    const emit = (name: CoachEventName, attributes: CoachEventAttributes) =>
      deps.telemetry.emit({ name, userId, personaId: persona.id, attributes });

    // 1. Pre-request classifier. safetyOverride skips the safety REPLY for this
    //    message ("that's not why I'm asking") but is still telemetry-logged.
    const crisis = classifyCrisis(input.message);
    if (crisis.triggered || input.safetyOverride) {
      emit('coach.safety_classifier', {
        triggered: crisis.triggered,
        overridden: Boolean(input.safetyOverride),
        categories: crisis.categories.join(','),
      });
    }
    const tier = routeTier(input.message);
    if (crisis.triggered && !input.safetyOverride) {
      return {
        text: withDisclaimer(SAFETY_REPLY),
        source: 'SAFETY',
        events: [],
        safety: { resources: [...CRISIS_RESOURCES], canContinue: true },
        tier,
        personaId: persona.id,
      };
    }

    // 1b. Feedback on memory proposed earlier: this message either leaves the PENDING entries
    //     uncorrected (they become CONFIRMED) or corrects/dismisses them (they are deleted).
    //     Skipped on a crisis turn, which leaves them PENDING (the conservative choice).
    //     A failure here must not fail the turn.
    try {
      const resolution = await resolvePendingMemories(userId, input.message);
      if (resolution.confirmed + resolution.dismissed > 0) {
        emit('coach.memory_resolved', { confirmed: resolution.confirmed, dismissed: resolution.dismissed });
      }
    } catch {
      /* memory is best-effort context */
    }
    let memories: MemoryProposal[] = [];
    try {
      memories = await loadConfirmedMemories(userId);
    } catch {
      /* a turn without the memory block is still a correct turn */
    }

    // 2. Turn preamble: fresh every turn, before the first model call.
    const today = safeCivilDate(clock.now(), user.timezone);
    const preamble: Preamble = await loadPreamble(tools, userId, today);
    emit('coach.tool_call', { tool: 'getDailyScore', ok: preamble.today !== null, round: 0, preamble: true });

    const events: CoachTurnEvent[] = [];
    const fallbackResult = (reason: string): CoachTurnResult => {
      emit('coach.turn_fallback', { reason, tier });
      return {
        text: withDisclaimer(composeFallback(preamble, today)),
        source: 'FALLBACK',
        events,
        tier,
        personaId: persona.id,
      };
    };

    // 3. Model loop, raced against the remaining latency budget.
    const budget = tier === 'fast' ? budgets.fast : budgets.synthesis;
    const remaining = budget - (clock.now() - startedAt);
    const controller = new AbortController();
    const turn = { expired: false, modelCalls: 0 };
    const results: TurnToolResult[] = preamble.today ? [{ name: 'getDailyScore', result: preamble.today }] : [];

    const expire = (): CoachTurnResult => {
      turn.expired = true;
      controller.abort();
      events.push({ type: 'latency_budget_exceeded' });
      emit('coach.latency_budget_exceeded', { tier, budgetMs: budget });
      return fallbackResult('latency_budget_exceeded');
    };
    if (remaining <= 0) return expire();

    const system = buildSystemPrompt(persona, { today, memories });
    const convo: CoachModelMessage[] = [
      ...input.history
        .slice(-HISTORY_WINDOW)
        .map((m) => ({ role: m.role, content: m.role === 'assistant' ? stripDisclaimer(m.text) : m.text }) as CoachModelMessage),
      { role: 'user', content: input.message },
    ];
    if (preamble.today) {
      convo.push(
        { role: 'assistant_tool_calls', calls: [{ id: PREAMBLE_CALL_ID, name: 'getDailyScore', args: { date: today } }] },
        { role: 'tool', toolCallId: PREAMBLE_CALL_ID, name: 'getDailyScore', content: JSON.stringify(preamble.today) },
      );
    }

    // Validated proposeMemory calls of the CURRENT attempt. Persisted only after the reply is validated.
    let proposals: MemoryProposal[] = [];
    let proposalCalls = 0;

    async function executeToolCalls(calls: ToolCallRequest[], round: number): Promise<void> {
      convo.push({ role: 'assistant_tool_calls', calls });
      for (const call of calls) {
        if (turn.expired) return;
        const started = clock.now();
        let payload: unknown;
        let ok = false;
        try {
          if (call.name === 'proposeMemory' && proposalCalls >= MAX_PROPOSALS_PER_TURN) {
            payload = { error: 'too_many_proposals' };
            emit('coach.memory_rejected', { reason: 'too_many_proposals' });
          } else {
            if (call.name === 'proposeMemory') proposalCalls++;
            const outcome = await tools.run(userId, call.name, call.args, { today });
            if (call.name === 'proposeMemory') {
              // Never a grounding source and never echoed back: the model only learns stored or not.
              if (outcome.ok) {
                ok = true;
                proposals.push((outcome.result as ProposeMemoryResult).proposal);
                payload = { stored: true, status: 'pending_user_confirmation' };
              } else {
                payload = { error: outcome.error };
                emit('coach.memory_rejected', { reason: outcome.error });
              }
            } else if (outcome.ok) {
              ok = true;
              payload = outcome.result;
              results.push({ name: call.name, result: outcome.result });
            } else {
              payload = { error: outcome.error };
            }
          }
        } catch {
          payload = { error: 'tool_failed' };
        }
        emit('coach.tool_call', { tool: call.name, ok, round, durationMs: clock.now() - started });
        convo.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(payload) });
      }
    }

    /** Runs the provider (and any tool rounds it asks for) until it returns text. */
    async function generateText(corrective: string | null): Promise<string | 'expired'> {
      for (let round = 1; ; round++) {
        if (turn.expired) return 'expired';
        if (turn.modelCalls >= MAX_MODEL_CALLS) throw new Error('model_call_limit');
        turn.modelCalls++;
        const messages = corrective ? [...convo, { role: 'system' as const, content: corrective }] : [...convo];
        const response = await deps.provider.generate({
          tier,
          system,
          messages,
          tools: tools.schemas,
          signal: controller.signal,
        });
        if (turn.expired) return 'expired';
        if (response.type === 'text') return response.text;
        await executeToolCalls(response.calls, round);
      }
    }

    async function run(): Promise<RunOutcome> {
      let corrective: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        proposals = []; // only the accepted attempt's proposals count
        proposalCalls = 0;
        let text: string | 'expired';
        try {
          text = await generateText(corrective);
        } catch (err) {
          // Error NAMES only: a provider error message could echo request content.
          const name = err instanceof Error ? err.name : 'unknown';
          const reason = name === 'ProviderNotConfiguredError' ? 'provider_not_configured' : name === 'Error' ? 'model_failed' : 'provider_error';
          return { kind: 'fallback', reason };
        }
        if (text === 'expired') return { kind: 'expired' };

        const verdict = validateReply(text, results);
        if (verdict.ok) return { kind: 'reply', text: verdict.text, proposals };

        const outcome = attempt === 1 ? 'regenerate' : 'fallback';
        for (const reason of verdict.reasons) {
          events.push({ type: 'guardrail_reject', reason, attempt, outcome });
          emit('coach.guardrail_reject', { reason, attempt, outcome });
        }
        // Discard and regenerate ONCE with a corrective system message; the rejected text is never resent.
        corrective = buildCorrectiveMessage(verdict.reasons);
      }
      return { kind: 'fallback', reason: 'guardrail' };
    }

    let cancelTimer = () => {};
    const deadline = new Promise<'deadline'>((resolve) => {
      const handle = clock.setTimer(() => resolve('deadline'), remaining);
      cancelTimer = () => handle.cancel();
    });
    // A run that loses the race must not become an unhandled rejection later.
    const running = run().catch((): RunOutcome => ({ kind: 'fallback', reason: 'internal_error' }));
    let outcome: RunOutcome | 'deadline';
    try {
      outcome = await Promise.race([running, deadline]);
    } finally {
      cancelTimer();
    }

    if (outcome === 'deadline' || outcome.kind === 'expired') return expire();
    if (outcome.kind === 'fallback') return fallbackResult(outcome.reason);

    let memoryProposals: MemoryDTO[] = [];
    if (outcome.proposals.length > 0) {
      try {
        memoryProposals = await createPendingMemories(userId, outcome.proposals);
      } catch {
        /* the reply is still valid; the memory simply is not stored */
      }
      if (memoryProposals.length > 0) emit('coach.memory_proposed', { count: memoryProposals.length });
    }
    const body = memoryProposals.length > 0 ? `${outcome.text.trimEnd()}\n\n${MEMORY_NOTE}` : outcome.text;
    return {
      text: withDisclaimer(body),
      source: 'MODEL',
      events,
      tier,
      personaId: persona.id,
      ...(memoryProposals.length > 0 ? { memoryProposals } : {}),
    };
  }

  return { handleTurn };
}
