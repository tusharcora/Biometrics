"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORY_REMOVED_NOTE = exports.MEMORY_NOTE = exports.HISTORY_WINDOW = exports.MAX_MODEL_CALLS = exports.SYNTHESIS_TIER_BUDGET_MS = exports.FAST_TIER_BUDGET_MS = void 0;
exports.createCoachOrchestrator = createCoachOrchestrator;
const civilDate_1 = require("../biometrics/civilDate");
const client_1 = require("../db/client");
const clock_1 = require("./clock");
const fallback_1 = require("./fallback");
const prefetch_1 = require("./prefetch");
const hints_1 = require("./guardrails/hints");
const disclaimer_1 = require("./guardrails/disclaimer");
const crisis_1 = require("./guardrails/crisis");
const grounding_1 = require("./guardrails/grounding");
const memory_1 = require("./memory");
const personas_1 = require("./personas");
const prompt_1 = require("./prompt");
const router_1 = require("./router");
const tools_1 = require("./tools");
exports.FAST_TIER_BUDGET_MS = 12_000;
/**
 * The spec gives the synthesis tier no user-facing budget because its main use
 * (the weekly recap) is a background job. Inline, an unbounded wait would hang
 * the request, so it gets a generous safety cap instead.
 */
exports.SYNTHESIS_TIER_BUDGET_MS = 60_000;
exports.MAX_MODEL_CALLS = 8;
exports.HISTORY_WINDOW = 10;
/** Fixed, server-appended (never model-generated) when a memory proposal was stored this turn. No digits. */
exports.MEMORY_NOTE = "I'll remember that — let me know if that's not right.";
/** Fixed, server-appended (never model-generated) when the user's message deleted a pending memory. No digits. */
exports.MEMORY_REMOVED_NOTE = "Okay — I've removed that from what I remember.";
/** Appends fixed server-composed notes after validation, so they are never model text and never digit-scanned. */
function withNotes(text, notes) {
    return notes.length === 0 ? text : `${text.trimEnd()}\n\n${notes.join('\n\n')}`;
}
async function defaultLoadUser(userId) {
    const user = await client_1.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, coachPersonaId: true } });
    return { timezone: user?.timezone ?? 'UTC', coachPersonaId: user?.coachPersonaId ?? null };
}
function safeCivilDate(now, timezone) {
    try {
        return (0, civilDate_1.localCivilDate)(new Date(now), timezone);
    }
    catch {
        return (0, civilDate_1.localCivilDate)(new Date(now), 'UTC');
    }
}
const PREAMBLE_CALL_ID = 'preamble-getDailyScore';
const PREAMBLE_METRICS_CALL_ID = 'preamble-getTodayMetrics';
function createCoachOrchestrator(deps) {
    const tools = deps.tools ?? tools_1.coachTools;
    const clock = deps.clock ?? clock_1.systemClock;
    const loadUser = deps.loadUser ?? defaultLoadUser;
    const budgets = {
        fast: deps.budgets?.fast ?? exports.FAST_TIER_BUDGET_MS,
        synthesis: deps.budgets?.synthesis ?? exports.SYNTHESIS_TIER_BUDGET_MS,
    };
    async function handleTurn(input) {
        const startedAt = clock.now();
        const { userId } = input;
        const user = await loadUser(userId);
        const persona = (0, personas_1.resolvePersona)(user.coachPersonaId);
        const emit = (name, attributes) => deps.telemetry.emit({ name, userId, personaId: persona.id, attributes });
        // 1. Pre-request classifier. safetyOverride skips the safety REPLY for this
        //    message ("that's not why I'm asking") but is still telemetry-logged.
        const crisis = (0, crisis_1.classifyCrisis)(input.message);
        if (crisis.triggered || input.safetyOverride) {
            // Deliberately no category: this event carries a userId, so naming the
            // match would persist a mental-health signal about a named user into
            // application logs, which outlive the coach transcript retention window.
            // triggered/overridden are enough to monitor the classifier's rate.
            emit('coach.safety_classifier', {
                triggered: crisis.triggered,
                overridden: Boolean(input.safetyOverride),
            });
        }
        const tier = (0, router_1.routeTier)(input.message);
        if (crisis.triggered && !input.safetyOverride) {
            return {
                text: (0, disclaimer_1.withDisclaimer)(crisis_1.SAFETY_REPLY),
                source: 'SAFETY',
                events: [],
                safety: { resources: [...crisis_1.CRISIS_RESOURCES], canContinue: true },
                tier,
                personaId: persona.id,
            };
        }
        // 1b. Feedback on memory proposed earlier: this message either leaves the PENDING entries
        //     uncorrected (they become CONFIRMED) or corrects/dismisses them (they are deleted, and
        //     the reply says so: a silent deletion would be invisible to the user).
        //     Skipped on a crisis turn, which leaves them PENDING (the conservative choice).
        //     A failure here must not fail the turn.
        let memoryRemoved = false;
        try {
            const resolution = await (0, memory_1.resolvePendingMemories)(userId, input.message, input.conversationId ?? null);
            memoryRemoved = resolution.dismissed > 0;
            if (resolution.confirmed + resolution.dismissed > 0) {
                emit('coach.memory_resolved', { confirmed: resolution.confirmed, dismissed: resolution.dismissed });
            }
        }
        catch {
            /* memory is best-effort context */
        }
        let memories = [];
        try {
            memories = await (0, memory_1.loadConfirmedMemories)(userId);
        }
        catch {
            /* a turn without the memory block is still a correct turn */
        }
        // 2. Turn preamble: fresh every turn, before the first model call.
        const today = safeCivilDate(clock.now(), user.timezone);
        const preamble = await (0, fallback_1.loadPreamble)(tools, userId, today);
        emit('coach.tool_call', { tool: 'getDailyScore', ok: preamble.today !== null, round: 0, preamble: true });
        const events = [];
        const fallbackResult = (reason) => {
            emit('coach.turn_fallback', { reason, tier });
            return {
                text: (0, disclaimer_1.withDisclaimer)(withNotes((0, fallback_1.composeFallback)(preamble, today), memoryRemoved ? [exports.MEMORY_REMOVED_NOTE] : [])),
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
        // The preamble is presented to the model as a getDailyScore call for today
        // (see PREAMBLE_CALL_ID below), so it is recorded with the same arguments:
        // grounding compares them to catch a reference that could mean either this
        // result or a later call for a different day.
        const results = preamble.today
            ? [{ name: 'getDailyScore', result: preamble.today, args: { date: today } }]
            : [];
        // Today's raw readings (steps, resting HR, HRV, sleep) are pre-fetched the
        // same way. Without them the model answered "how did I sleep" or "my heart
        // rate" from the score breakdown, reading factor points as bpm or minutes.
        // They go under their own tool name, getTodayMetrics, not getDailyMetrics:
        // grounding refuses a reference to a tool called with two different
        // arguments, so a pre-fetched getDailyMetrics(today) would make every
        // question about another day ambiguous (and "today vs the 20th" impossible).
        // Best effort: a turn without them is still a correct turn.
        let todayMetrics = null;
        if (tools.getDailyMetrics) {
            try {
                todayMetrics = await tools.getDailyMetrics(userId, today);
                results.push({ name: 'getTodayMetrics', result: todayMetrics, args: {} });
            }
            catch {
                todayMetrics = null;
            }
        }
        // Question-driven pre-fetch (prefetch.ts): the history or habit-log call the
        // question plainly needs, made up front so the model cannot skip it and
        // improvise. Recorded WITHOUT args: grounding only compares recorded args, so
        // if the model calls the same tool itself (say with a different window) its
        // own, later call is simply the one references read, rather than an
        // ambiguity that discards the reply. Best effort, like the preamble.
        const prefetched = [];
        for (const call of (0, prefetch_1.planPrefetch)(input.message)) {
            try {
                const outcome = await tools.run(userId, call.name, call.args, { today });
                if (!outcome.ok)
                    continue;
                prefetched.push({ name: call.name, result: outcome.result });
                results.push({ name: call.name, result: outcome.result });
                emit('coach.tool_call', { tool: call.name, ok: true, round: 0, preamble: true });
            }
            catch {
                /* a turn without it is still a correct turn: the model can call the tool */
            }
        }
        const expire = () => {
            turn.expired = true;
            controller.abort();
            events.push({ type: 'latency_budget_exceeded' });
            emit('coach.latency_budget_exceeded', { tier, budgetMs: budget });
            return fallbackResult('latency_budget_exceeded');
        };
        if (remaining <= 0)
            return expire();
        const system = (0, prompt_1.buildSystemPrompt)(persona, { today, memories });
        const convo = [
            ...input.history
                .slice(-exports.HISTORY_WINDOW)
                .map((m) => ({ role: m.role, content: m.role === 'assistant' ? (0, disclaimer_1.stripDisclaimer)(m.text) : m.text })),
            { role: 'user', content: input.message },
        ];
        if (preamble.today) {
            convo.push({ role: 'assistant_tool_calls', calls: [{ id: PREAMBLE_CALL_ID, name: 'getDailyScore', args: { date: today } }] }, { role: 'tool', toolCallId: PREAMBLE_CALL_ID, name: 'getDailyScore', content: JSON.stringify(preamble.today) });
        }
        if (todayMetrics !== null) {
            convo.push({ role: 'assistant_tool_calls', calls: [{ id: PREAMBLE_METRICS_CALL_ID, name: 'getTodayMetrics', args: {} }] }, { role: 'tool', toolCallId: PREAMBLE_METRICS_CALL_ID, name: 'getTodayMetrics', content: JSON.stringify(todayMetrics) });
        }
        for (const p of prefetched) {
            const id = `preamble-${p.name}`;
            convo.push({ role: 'assistant_tool_calls', calls: [{ id, name: p.name, args: {} }] }, { role: 'tool', toolCallId: id, name: p.name, content: JSON.stringify(p.result) });
        }
        // Validated proposeMemory calls of the CURRENT attempt. Persisted only after the reply is validated.
        let proposals = [];
        let proposalCalls = 0;
        async function executeToolCalls(calls, round) {
            convo.push({ role: 'assistant_tool_calls', calls });
            for (const call of calls) {
                if (turn.expired)
                    return;
                const started = clock.now();
                let payload;
                let ok = false;
                try {
                    if (call.name === 'proposeMemory' && proposalCalls >= memory_1.MAX_PROPOSALS_PER_TURN) {
                        payload = { error: 'too_many_proposals' };
                        emit('coach.memory_rejected', { reason: 'too_many_proposals' });
                    }
                    else {
                        if (call.name === 'proposeMemory')
                            proposalCalls++;
                        const outcome = await tools.run(userId, call.name, call.args, { today });
                        if (call.name === 'proposeMemory') {
                            // Never a grounding source and never echoed back: the model only learns stored or not.
                            if (outcome.ok) {
                                ok = true;
                                proposals.push(outcome.result.proposal);
                                payload = { stored: true, status: 'pending_user_confirmation' };
                            }
                            else {
                                payload = { error: outcome.error };
                                emit('coach.memory_rejected', { reason: outcome.error });
                            }
                        }
                        else if (outcome.ok) {
                            ok = true;
                            payload = outcome.result;
                            results.push({ name: call.name, result: outcome.result, args: call.args });
                        }
                        else {
                            payload = { error: outcome.error };
                        }
                    }
                }
                catch {
                    payload = { error: 'tool_failed' };
                }
                emit('coach.tool_call', { tool: call.name, ok, round, durationMs: clock.now() - started });
                convo.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(payload) });
            }
        }
        /** Runs the provider (and any tool rounds it asks for) until it returns text. */
        async function generateText(corrective) {
            for (let round = 1;; round++) {
                if (turn.expired)
                    return 'expired';
                if (turn.modelCalls >= exports.MAX_MODEL_CALLS)
                    throw new Error('model_call_limit');
                turn.modelCalls++;
                const messages = corrective ? [...convo, { role: 'system', content: corrective }] : [...convo];
                const response = await deps.provider.generate({
                    tier,
                    system,
                    messages,
                    tools: tools.schemas,
                    signal: controller.signal,
                });
                if (turn.expired)
                    return 'expired';
                if (response.type === 'text')
                    return response.text;
                await executeToolCalls(response.calls, round);
            }
        }
        async function run() {
            let corrective = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                proposals = []; // only the accepted attempt's proposals count
                proposalCalls = 0;
                let text;
                try {
                    text = await generateText(corrective);
                }
                catch (err) {
                    // Error NAMES only: a provider error message could echo request content.
                    const name = err instanceof Error ? err.name : 'unknown';
                    const reason = name === 'ProviderNotConfiguredError' ? 'provider_not_configured' : name === 'Error' ? 'model_failed' : 'provider_error';
                    return { kind: 'fallback', reason };
                }
                if (text === 'expired')
                    return { kind: 'expired' };
                // Exact copies of unit-bearing tool values become references first (hints.ts): they are
                // grounded by construction. Everything else is validated exactly as before.
                const verdict = (0, grounding_1.validateReply)((0, hints_1.referenceCopiedValues)(text, results), results);
                if (verdict.ok)
                    return { kind: 'reply', text: verdict.text, proposals };
                const outcome = attempt === 1 ? 'regenerate' : 'fallback';
                for (const reason of verdict.reasons) {
                    events.push({ type: 'guardrail_reject', reason, attempt, outcome });
                    emit('coach.guardrail_reject', { reason, attempt, outcome });
                }
                // Discard and regenerate ONCE with a corrective system message; the rejected text is never resent.
                corrective = (0, prompt_1.buildCorrectiveMessage)(verdict.reasons, verdict.reasons.includes('unwrapped_number') ? (0, hints_1.suggestReferences)(text, results) : []);
            }
            return { kind: 'fallback', reason: 'guardrail' };
        }
        let cancelTimer = () => { };
        const deadline = new Promise((resolve) => {
            const handle = clock.setTimer(() => resolve('deadline'), remaining);
            cancelTimer = () => handle.cancel();
        });
        // A run that loses the race must not become an unhandled rejection later.
        const running = run().catch(() => ({ kind: 'fallback', reason: 'internal_error' }));
        let outcome;
        try {
            outcome = await Promise.race([running, deadline]);
        }
        finally {
            cancelTimer();
        }
        if (outcome === 'deadline' || outcome.kind === 'expired')
            return expire();
        if (outcome.kind === 'fallback')
            return fallbackResult(outcome.reason);
        let memoryProposals = [];
        if (outcome.proposals.length > 0) {
            try {
                memoryProposals = await (0, memory_1.createPendingMemories)(userId, outcome.proposals, input.conversationId ?? null);
            }
            catch {
                /* the reply is still valid; the memory simply is not stored */
            }
            if (memoryProposals.length > 0)
                emit('coach.memory_proposed', { count: memoryProposals.length });
        }
        const body = withNotes(outcome.text, [
            ...(memoryRemoved ? [exports.MEMORY_REMOVED_NOTE] : []),
            ...(memoryProposals.length > 0 ? [exports.MEMORY_NOTE] : []),
        ]);
        return {
            text: (0, disclaimer_1.withDisclaimer)(body),
            source: 'MODEL',
            events,
            tier,
            personaId: persona.id,
            ...(memoryProposals.length > 0 ? { memoryProposals } : {}),
        };
    }
    return { handleTurn };
}
//# sourceMappingURL=orchestrator.js.map