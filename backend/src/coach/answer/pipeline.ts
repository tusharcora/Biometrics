// The answer pipeline (spec 2026-09-30, section 2): "facts first, one pass".
//
//   crisis classifier -> memory feedback -> route -> status event -> fact sheet
//   -> ONE streamed model call -> each sentence validated as it completes
//   (dropped when it fails, the rest keeps streaming) -> one regeneration only
//   when no sentence at all could be shown -> card resolved from the fact sheet
//   -> memory block through the existing memory validation -> the clean reply,
//   card, engine and duration persisted -> done.
//
// Nothing shown is ever retracted: a sentence is only emitted once validated.
// Errors are events (spec section 6), never a template reply: model
// unreachable/failed -> model_unavailable, budget -> timeout, two failed
// attempts -> validation_failed, anything else -> internal. Only a finished
// (or stopped-with-text) answer is persisted, so Retry resends cleanly.
// Replaces the orchestrator's tool loop, which stays in the tree until phase 5.

import { localCivilDate } from '../../biometrics/civilDate';
import { prisma } from '../../db/client';
import { CoachClock, systemClock } from '../clock';
import { classifyCrisis, CRISIS_RESOURCES, SAFETY_REPLY } from '../guardrails/crisis';
import { stripDisclaimer } from '../guardrails/disclaimer';
import {
  createPendingMemories,
  MAX_PROPOSALS_PER_TURN,
  MemoryDTO,
  MemoryProposal,
  resolvePendingMemories,
  validateMemoryInput,
} from '../memory';
import type { CoachModelProvider } from '../model/provider';
import { MEMORY_NOTE, MEMORY_REMOVED_NOTE } from '../orchestrator';
import { resolvePersona } from '../personas';
import type { CoachEventAttributes, CoachEventName, CoachTelemetry } from '../telemetry';
import type { AnswerCard } from './card';
import { buildFactSheet, defaultFactData, FactData, FactSheet } from './facts';
import { parseModelOutput } from './parse';
import { buildAnswerSystemPrompt, buildRegenerationNote } from './prompt';
import { AnswerRoute, routeQuestion } from './route';
import { sentenceSplitter } from './sentences';
import { resolveCard, validateSentence } from './validate';

export type AnswerEngine = 'local' | 'hosted';

export type AnswerEvent =
  | { type: 'status'; label: string }
  | { type: 'text'; sentence: string }
  | { type: 'card'; card: AnswerCard }
  | { type: 'memory'; proposals: MemoryDTO[] }
  | { type: 'safety'; text: string; resources: unknown[] }
  | { type: 'done'; messageId: string; conversationId: string; engine: AnswerEngine; durationMs: number; stopped?: boolean }
  | { type: 'error'; code: 'model_unavailable' | 'timeout' | 'validation_failed' | 'consent_required' | 'internal'; retryable: boolean };

export interface AnswerInput {
  userId: string;
  /** Already trimmed and length-checked by the route. */
  message: string;
  /** Prior turns of this conversation, oldest first (the route loads the last HISTORY_WINDOW). */
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** An existing conversation the caller has checked belongs to the user; omitted starts a new one. */
  conversationId?: string;
  safetyOverride?: boolean;
  /** Aborted when the user taps stop (the client went away). */
  signal?: AbortSignal;
  /** When the message arrived; the user row is stamped with it. */
  receivedAt?: Date;
}

export interface AnswerDeps {
  provider: CoachModelProvider;
  engine: AnswerEngine;
  telemetry: CoachTelemetry;
  clock?: CoachClock;
  /** End-to-end budget for this answer (COACH_LOCAL_BUDGET_MS / COACH_HOSTED_BUDGET_MS). */
  budgetMs?: number;
  factData?: FactData;
  loadUser?: (userId: string) => Promise<{ timezone: string; coachPersonaId: string | null }>;
}

export const DEFAULT_ANSWER_BUDGET_MS = 45_000;
export const ANSWER_MAX_TOKENS = 600;
export const ANSWER_HISTORY_WINDOW = 10;
const MAX_ATTEMPTS = 2;

export const STATUS_LABELS: Record<AnswerRoute, string> = {
  today: 'Looking at your day…',
  sleep: 'Looking at your sleep…',
  trends: 'Looking at your trends…',
  general: 'Thinking…',
};

/** Persisted on the assistant row: reasons and counts only, never text. */
export type AnswerGuardrailEvent =
  | { type: 'sentence_dropped'; reason: 'unknown_number' | 'disallowed_topic'; attempt: number }
  | { type: 'regenerated' }
  | { type: 'card_dropped' }
  | { type: 'stopped' };

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

/** Stored replies from before the redesign carry the disclaimer and memory notes; the model never sees them. */
function cleanHistoryText(text: string): string {
  let t = stripDisclaimer(text);
  for (const note of [MEMORY_NOTE, MEMORY_REMOVED_NOTE]) t = t.split(note).join('');
  return t.trim();
}

const DEADLINE = Symbol('deadline');
const STOPPED = Symbol('stopped');
type Interrupt = typeof DEADLINE | typeof STOPPED;

class ModelError extends Error {
  constructor() {
    super('model call failed');
    this.name = 'ModelError';
  }
}

interface AttemptResult {
  outcome: 'ok' | 'deadline' | 'stopped' | 'model_error';
  accepted: string[];
  rejected: Array<'unknown_number' | 'disallowed_topic'>;
  raw: string;
}

export async function* runAnswer(input: AnswerInput, deps: AnswerDeps): AsyncGenerator<AnswerEvent, void, undefined> {
  const clock = deps.clock ?? systemClock;
  const startedAt = clock.now();
  const receivedAt = input.receivedAt ?? new Date();
  const budget = deps.budgetMs ?? DEFAULT_ANSWER_BUDGET_MS;
  const factData = deps.factData ?? defaultFactData;
  const controller = new AbortController();
  const guardrailEvents: AnswerGuardrailEvent[] = [];

  // Budget and stop, as promises every await is raced against.
  let cancelTimer = () => {};
  const deadline = new Promise<Interrupt>((resolve) => {
    const handle = clock.setTimer(() => resolve(DEADLINE), budget);
    cancelTimer = () => handle.cancel();
  });
  const stopped = new Promise<Interrupt>((resolve) => {
    if (input.signal?.aborted) resolve(STOPPED);
    input.signal?.addEventListener('abort', () => resolve(STOPPED), { once: true });
  });
  const race = <T>(p: Promise<T>): Promise<T | Interrupt> => {
    p.catch(() => {}); // a loser that rejects later must not become an unhandled rejection
    return Promise.race([p, deadline, stopped]);
  };

  let personaId = 'unknown';
  const emit = (name: CoachEventName, attributes: CoachEventAttributes) =>
    deps.telemetry.emit({ name, userId: input.userId, personaId, attributes });
  const fail = (code: Extract<AnswerEvent, { type: 'error' }>['code']): AnswerEvent => {
    emit('coach.answer_error', { code, engine: deps.engine });
    return { type: 'error', code, retryable: true };
  };

  async function persist(reply: {
    text: string;
    source: 'MODEL' | 'SAFETY';
    card: AnswerCard | null;
    model: boolean;
    memoryIds: string[];
  }): Promise<{ messageId: string; conversationId: string; durationMs: number }> {
    const durationMs = clock.now() - startedAt;
    // The assistant row is stamped strictly after the user row so transcript order is unambiguous.
    const repliedAt = new Date(Math.max(Date.now(), receivedAt.getTime() + 1));
    const saved = await prisma.$transaction(async (tx) => {
      let id = input.conversationId;
      if (id === undefined) {
        id = (await tx.coachConversation.create({ data: { userId: input.userId, createdAt: receivedAt, lastMessageAt: repliedAt } })).id;
      } else {
        await tx.coachConversation.update({ where: { id }, data: { lastMessageAt: repliedAt } });
      }
      await tx.coachMessage.create({
        data: { conversationId: id, userId: input.userId, role: 'USER', text: input.message, createdAt: receivedAt },
      });
      const assistant = await tx.coachMessage.create({
        data: {
          conversationId: id,
          userId: input.userId,
          role: 'ASSISTANT',
          text: reply.text,
          source: reply.source,
          ...(guardrailEvents.length > 0 ? { guardrailEvents: [...guardrailEvents] } : {}),
          ...(reply.card ? { card: reply.card as object } : {}),
          ...(reply.model ? { engine: deps.engine === 'hosted' ? ('HOSTED' as const) : ('LOCAL' as const), durationMs } : {}),
          createdAt: repliedAt,
        },
      });
      // Proposals are written before a brand-new conversation has an id; stamp them so the
      // user's next message in THIS conversation (and only this one) settles them.
      if (reply.memoryIds.length > 0) {
        await tx.coachMemory.updateMany({ where: { id: { in: reply.memoryIds }, userId: input.userId }, data: { conversationId: id } });
      }
      return { id, assistantId: assistant.id };
    });
    return { messageId: saved.assistantId, conversationId: saved.id, durationMs };
  }

  try {
    let user: { timezone: string; coachPersonaId: string | null };
    try {
      user = await (deps.loadUser ?? defaultLoadUser)(input.userId);
    } catch {
      yield fail('internal');
      return;
    }
    const persona = resolvePersona(user.coachPersonaId);
    personaId = persona.id;

    // 1. Crisis first, unchanged: the fixed, non-model safety reply.
    const crisis = classifyCrisis(input.message);
    if (crisis.triggered || input.safetyOverride) {
      emit('coach.safety_classifier', { triggered: crisis.triggered, overridden: Boolean(input.safetyOverride) });
    }
    if (crisis.triggered && !input.safetyOverride) {
      const saved = await persist({ text: SAFETY_REPLY, source: 'SAFETY', card: null, model: false, memoryIds: [] });
      yield { type: 'safety', text: SAFETY_REPLY, resources: [...CRISIS_RESOURCES] };
      yield { type: 'done', messageId: saved.messageId, conversationId: saved.conversationId, engine: deps.engine, durationMs: saved.durationMs };
      return;
    }

    // 2. Feedback on memory proposed earlier in this conversation. Best effort.
    try {
      const resolution = await resolvePendingMemories(input.userId, input.message, input.conversationId ?? null);
      if (resolution.confirmed + resolution.dismissed > 0) {
        emit('coach.memory_resolved', { confirmed: resolution.confirmed, dismissed: resolution.dismissed });
      }
    } catch {
      /* memory is best-effort context */
    }

    // 3. Route, and tell the user what is happening.
    const previousUserMessage = [...input.history].reverse().find((m) => m.role === 'user')?.text;
    const route = routeQuestion(input.message, previousUserMessage);
    yield { type: 'status', label: STATUS_LABELS[route] };

    // 4. The fact sheet.
    const today = safeCivilDate(clock.now(), user.timezone);
    let sheet: FactSheet;
    try {
      const built = await race(buildFactSheet(input.userId, route, { ...factData, today }));
      if (built === STOPPED) return;
      if (built === DEADLINE) {
        emit('coach.latency_budget_exceeded', { budgetMs: budget, engine: deps.engine });
        yield fail('timeout');
        return;
      }
      sheet = built;
    } catch {
      yield fail('internal');
      return;
    }

    const system = buildAnswerSystemPrompt(persona, { today, sheet });
    const messages = [
      ...input.history
        .slice(-ANSWER_HISTORY_WINDOW)
        .map((m) => ({ role: m.role, content: m.role === 'assistant' ? cleanHistoryText(m.text) : m.text })),
      { role: 'user' as const, content: input.message },
    ];

    // 5. One streamed call per attempt, validated sentence by sentence.
    async function* attempt(n: number, extra: string | null): AsyncGenerator<AnswerEvent, AttemptResult, undefined> {
      const result: AttemptResult = { outcome: 'ok', accepted: [], rejected: [], raw: '' };
      const splitter = sentenceSplitter();
      const handle = function* (sentences: string[]): Generator<AnswerEvent> {
        for (const sentence of sentences) {
          const verdict = validateSentence(sentence, sheet);
          if (verdict.ok) {
            result.accepted.push(sentence);
            yield { type: 'text', sentence };
          } else {
            result.rejected.push(verdict.reason);
            guardrailEvents.push({ type: 'sentence_dropped', reason: verdict.reason, attempt: n });
            emit('coach.answer_sentence_dropped', { reason: verdict.reason, attempt: n, route });
          }
        }
      };
      let iterator: AsyncIterator<string>;
      try {
        iterator = deps.provider
          .stream({
            system,
            messages: extra ? [...messages, { role: 'user', content: extra }] : messages,
            maxTokens: ANSWER_MAX_TOKENS,
            signal: controller.signal,
          })
          [Symbol.asyncIterator]();
      } catch {
        return { ...result, outcome: 'model_error' };
      }
      for (;;) {
        let next: IteratorResult<string> | Interrupt;
        try {
          next = await race(iterator.next());
        } catch {
          return { ...result, outcome: 'model_error' };
        }
        if (next === DEADLINE) return { ...result, outcome: 'deadline' };
        if (next === STOPPED) return { ...result, outcome: 'stopped' };
        if (next.done) break;
        result.raw += next.value;
        yield* handle(splitter.push(next.value));
      }
      yield* handle(splitter.end());
      return result;
    }

    let result: AttemptResult | null = null;
    let attempts = 0;
    let note: string | null = null;
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      attempts = n;
      result = yield* attempt(n, note);
      if (result.outcome !== 'ok' || result.accepted.length > 0) break;
      if (n < MAX_ATTEMPTS) {
        const reasons = result.rejected.length > 0 ? [...new Set(result.rejected)] : (['empty'] as const);
        guardrailEvents.push({ type: 'regenerated' });
        emit('coach.answer_regenerated', { route, reasons: reasons.join(',') });
        note = buildRegenerationNote(reasons);
      }
    }
    if (!result) throw new Error('unreachable');

    if (result.outcome === 'model_error') {
      yield fail('model_unavailable');
      return;
    }
    if (result.outcome === 'deadline') {
      emit('coach.latency_budget_exceeded', { budgetMs: budget, engine: deps.engine });
      yield fail('timeout');
      return;
    }
    if (result.outcome === 'stopped') {
      // Stop: keep what the user already saw, marked; not a full answer (no card, no memory).
      if (result.accepted.length === 0) return;
      guardrailEvents.push({ type: 'stopped' });
      const saved = await persist({ text: result.accepted.join(' '), source: 'MODEL', card: null, model: true, memoryIds: [] });
      yield { type: 'done', messageId: saved.messageId, conversationId: saved.conversationId, engine: deps.engine, durationMs: saved.durationMs, stopped: true };
      return;
    }
    if (result.accepted.length === 0) {
      yield fail('validation_failed');
      return;
    }

    // 6. Card and memory blocks from the text after the fence.
    const parsed = parseModelOutput(result.raw);
    const card = resolveCard(parsed.card, sheet);
    if (parsed.card && !card) guardrailEvents.push({ type: 'card_dropped' });
    if (card) yield { type: 'card', card };

    const proposals: MemoryProposal[] = [];
    for (const item of parsed.memory ?? []) {
      if (proposals.length >= MAX_PROPOSALS_PER_TURN) break;
      const checked = validateMemoryInput(item);
      if (checked.ok) proposals.push({ category: checked.category, value: checked.value });
      else emit('coach.memory_rejected', { reason: checked.reason });
    }
    let memories: MemoryDTO[] = [];
    if (proposals.length > 0) {
      try {
        memories = await createPendingMemories(input.userId, proposals, input.conversationId ?? null);
      } catch {
        /* the answer is still valid; the memory simply is not stored */
      }
      if (memories.length > 0) emit('coach.memory_proposed', { count: memories.length });
    }

    // 7. Persist the clean reply, then finish.
    const saved = await persist({ text: result.accepted.join(' '), source: 'MODEL', card, model: true, memoryIds: memories.map((m) => m.id) });
    if (memories.length > 0) yield { type: 'memory', proposals: memories };
    emit('coach.answer_done', {
      route,
      engine: deps.engine,
      sentences: result.accepted.length,
      dropped: result.rejected.length,
      card: card !== null,
      attempts,
      durationMs: saved.durationMs,
    });
    yield { type: 'done', messageId: saved.messageId, conversationId: saved.conversationId, engine: deps.engine, durationMs: saved.durationMs };
  } catch {
    // Error names only are ever logged by the caller; the event carries the code.
    yield fail('internal');
  } finally {
    cancelTimer();
    controller.abort();
  }
}
