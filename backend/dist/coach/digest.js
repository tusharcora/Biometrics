"use strict";
// Weekly synthesis digest (spec section 6): the Synthesis tier's one scheduled
// use. Once a week, for each user who has the coach flag on, a CURRENT-version
// consent, and a persona whose proactivity is not 'reactive-only', generate a
// recap of the trailing 7 days from getScoreHistory + getHabitCorrelations and
// store it as a CoachDigest (one per user per local week, so the job is
// idempotent), then send a GENERIC push (push.ts).
//
// The recap goes through the SAME whole-reply grounding guardrail as chat
// (validateReply): a reply with an ungrounded number or a bad {{reference}} is
// discarded and regenerated ONCE; a second failure, a provider error or a
// timeout falls back to a deterministic recap composed on the server from the
// tool results with no model involved. A digest is therefore either grounded or
// server-composed, never an unvalidated model reply. The data is pre-fetched
// fresh by the server on every run (like the chat turn preamble) and named in
// DIGEST_RESULT_NAMES, so the model can reference both metrics.
//
// This is a background job with no user-facing latency budget, but it is still
// bounded (a generous cap on the whole generation and on model calls) so a hung
// provider cannot stall the sweep. The clock is injectable so tests never sleep.
//
// Logging: ids, counts and reasons only. Never the digest text.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIGEST_MAX_MODEL_CALLS = exports.DIGEST_BUDGET_MS = exports.DIGEST_WINDOW_DAYS = void 0;
exports.weekStartOf = weekStartOf;
exports.composeDigestFallback = composeDigestFallback;
exports.generateDigestText = generateDigestText;
exports.generateWeeklyDigestForUser = generateWeeklyDigestForUser;
exports.runWeeklyDigest = runWeeklyDigest;
const civilDate_1 = require("../biometrics/civilDate");
const client_1 = require("../db/client");
const dates_1 = require("../scoring/dates");
const clock_1 = require("./clock");
const consent_1 = require("./consent");
const config_1 = require("./config");
const disclaimer_1 = require("./guardrails/disclaimer");
const grounding_1 = require("./guardrails/grounding");
const personas_1 = require("./personas");
const prompt_1 = require("./prompt");
const push_1 = require("./push");
const tools_1 = require("./tools");
exports.DIGEST_WINDOW_DAYS = 7;
exports.DIGEST_BUDGET_MS = 60_000;
exports.DIGEST_MAX_MODEL_CALLS = 6;
const USER_BATCH = 200;
/** Only these read tools are available to the digest generation; nothing else runs there. */
const DIGEST_TOOLS = new Set(['getScoreHistory', 'getHabitCorrelations']);
const REQUEST_TEXT = 'Write my weekly recap for the past week.';
/** The Monday (civil date) of the ISO week containing `civilDate`: the digest's idempotency key. */
function weekStartOf(civilDate) {
    const dow = new Date(`${civilDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return (0, dates_1.shiftDate)(civilDate, -((dow + 6) % 7));
}
function safeCivilDate(now, timezone) {
    try {
        return (0, civilDate_1.localCivilDate)(now, timezone);
    }
    catch {
        return (0, civilDate_1.localCivilDate)(now, 'UTC');
    }
}
/**
 * The deterministic, server-composed recap (no model): a fixed template whose
 * every number and name comes from a {{reference}} resolved against the fetched
 * results. Returns null when there is nothing to say.
 */
function composeDigestFallback(results) {
    const n = prompt_1.DIGEST_RESULT_NAMES;
    const find = (name) => results.find((r) => r.name === name)?.result;
    const recovery = find(n.recovery);
    const sleep = find(n.sleep);
    const correlations = find(n.correlations);
    const lines = ["Here's your weekly recap."];
    if (recovery && recovery.points.length > 0 && recovery.average !== null) {
        lines.push(`Recovery Score: averaged {{${n.recovery}.average}} over the past week, from a low of {{${n.recovery}.lowest}} to a high of {{${n.recovery}.highest}}.`);
    }
    if (sleep && sleep.points.length > 0 && sleep.average !== null) {
        lines.push(`Sleep Score: averaged {{${n.sleep}.average}}, from a low of {{${n.sleep}.lowest}} to a high of {{${n.sleep}.highest}}.`);
    }
    const patternCount = Math.min(correlations?.correlations.length ?? 0, 2);
    for (let i = 0; i < patternCount; i++) {
        const c = `${n.correlations}.correlations[${i}]`;
        lines.push(`Pattern: {{${c}.habitLabel}} is linked to {{${c}.direction}} {{${c}.factor}} ({{${c}.effectSizePercent}} percent, across {{${c}.sampleSize}} days of data).`);
    }
    if (lines.length === 1)
        return null;
    const template = lines.join('\n');
    // The composed text goes through the same validator as a model reply: a
    // template bug can only ever lose a digest, never publish an ungrounded one.
    const verdict = (0, grounding_1.validateReply)(template, results);
    return verdict.ok ? verdict.text : null;
}
async function fetchDigestResults(tools, userId, today) {
    const n = prompt_1.DIGEST_RESULT_NAMES;
    const ctx = { today };
    const [recovery, sleep, correlations] = await Promise.all([
        tools.run(userId, 'getScoreHistory', { metric: 'RECOVERY', days: exports.DIGEST_WINDOW_DAYS }, ctx),
        tools.run(userId, 'getScoreHistory', { metric: 'SLEEP', days: exports.DIGEST_WINDOW_DAYS }, ctx),
        tools.run(userId, 'getHabitCorrelations', {}, ctx),
    ]);
    const out = [];
    if (recovery.ok)
        out.push({ name: n.recovery, result: recovery.result });
    if (sleep.ok)
        out.push({ name: n.sleep, result: sleep.result });
    if (correlations.ok)
        out.push({ name: n.correlations, result: correlations.result });
    return out;
}
function hasMaterial(results) {
    return results.some((r) => {
        const v = r.result;
        return (Array.isArray(v.points) && v.points.length > 0) || (Array.isArray(v.correlations) && v.correlations.length > 0);
    });
}
async function generateDigestText(deps, userId, persona, today, fetched) {
    const tools = deps.tools ?? tools_1.coachTools;
    const clock = deps.clock ?? clock_1.systemClock;
    const n = prompt_1.DIGEST_RESULT_NAMES;
    const results = [...fetched];
    const system = (0, prompt_1.buildDigestSystemPrompt)(persona, { today });
    const convo = [{ role: 'user', content: REQUEST_TEXT }];
    const preCalls = [
        { id: 'digest-recovery', name: n.recovery, args: { metric: 'RECOVERY', days: exports.DIGEST_WINDOW_DAYS } },
        { id: 'digest-sleep', name: n.sleep, args: { metric: 'SLEEP', days: exports.DIGEST_WINDOW_DAYS } },
        { id: 'digest-correlations', name: n.correlations, args: {} },
    ].filter((c) => fetched.some((r) => r.name === c.name));
    if (preCalls.length > 0) {
        convo.push({ role: 'assistant_tool_calls', calls: preCalls });
        for (const call of preCalls) {
            const r = fetched.find((x) => x.name === call.name);
            convo.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(r.result) });
        }
    }
    const controller = new AbortController();
    const state = { expired: false, modelCalls: 0 };
    let rejects = 0;
    async function generateOnce(corrective) {
        for (let round = 1;; round++) {
            if (state.expired)
                return 'expired';
            if (state.modelCalls >= exports.DIGEST_MAX_MODEL_CALLS)
                throw new Error('model_call_limit');
            state.modelCalls++;
            const messages = corrective ? [...convo, { role: 'system', content: corrective }] : [...convo];
            const response = await deps.provider.generate({
                tier: 'synthesis',
                system,
                messages,
                tools: tools.schemas.filter((t) => DIGEST_TOOLS.has(t.name)),
                signal: controller.signal,
            });
            if (state.expired)
                return 'expired';
            if (response.type === 'text')
                return response.text;
            convo.push({ role: 'assistant_tool_calls', calls: response.calls });
            for (const call of response.calls) {
                let payload;
                if (!DIGEST_TOOLS.has(call.name)) {
                    payload = { error: 'unknown_tool' };
                }
                else {
                    try {
                        const outcome = await tools.run(userId, call.name, call.args, { today });
                        if (outcome.ok) {
                            payload = outcome.result;
                            results.push({ name: call.name, result: outcome.result });
                        }
                        else
                            payload = { error: outcome.error };
                    }
                    catch {
                        payload = { error: 'tool_failed' };
                    }
                }
                convo.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(payload) });
            }
        }
    }
    async function run() {
        let corrective = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            let text;
            try {
                text = await generateOnce(corrective);
            }
            catch {
                return { kind: 'fallback' };
            }
            if (text === 'expired')
                return { kind: 'fallback' };
            const verdict = (0, grounding_1.validateReply)(text, results);
            if (verdict.ok)
                return { kind: 'text', text: verdict.text };
            rejects++;
            corrective = (0, prompt_1.buildCorrectiveMessage)(verdict.reasons);
        }
        return { kind: 'fallback' };
    }
    let cancelTimer = () => { };
    const deadline = new Promise((resolve) => {
        const handle = clock.setTimer(() => resolve('deadline'), deps.budgetMs ?? exports.DIGEST_BUDGET_MS);
        cancelTimer = () => handle.cancel();
    });
    const running = run().catch(() => ({ kind: 'fallback' }));
    let outcome;
    try {
        outcome = await Promise.race([running, deadline]);
    }
    finally {
        cancelTimer();
    }
    if (outcome === 'deadline') {
        state.expired = true;
        controller.abort();
    }
    if (outcome !== 'deadline' && outcome.kind === 'text')
        return { text: outcome.text, source: 'model', rejects };
    const fallback = composeDigestFallback(fetched);
    return fallback === null ? null : { text: fallback, source: 'fallback', rejects };
}
async function generateWeeklyDigestForUser(user, deps) {
    const now = (deps.now ?? (() => new Date()))();
    const persona = (0, personas_1.resolvePersona)(user.coachPersonaId);
    const emit = (name, attributes) => deps.telemetry.emit({ name, userId: user.id, personaId: persona.id, attributes });
    const skip = (outcome) => {
        emit('coach.digest_skipped', { reason: outcome });
        return outcome;
    };
    // Gating, cheapest first. The flag is checked by the caller (runWeeklyDigest).
    if (persona.proactivity === 'reactive-only')
        return skip('skipped_reactive_only');
    if (!(await (0, consent_1.hasCurrentConsent)(user.id)))
        return skip('skipped_no_consent');
    const today = safeCivilDate(now, user.timezone);
    const weekStart = weekStartOf(today);
    const weekStartDate = (0, civilDate_1.civilDateToUtcMidnight)(weekStart);
    const existing = await client_1.prisma.coachDigest.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart: weekStartDate } },
        select: { id: true },
    });
    if (existing)
        return skip('skipped_exists');
    const tools = deps.tools ?? tools_1.coachTools;
    const fetched = await fetchDigestResults(tools, user.id, today);
    if (!hasMaterial(fetched))
        return skip('skipped_no_data');
    const generated = await generateDigestText(deps, user.id, persona, today, fetched);
    if (generated === null)
        return skip('skipped_no_data');
    try {
        await client_1.prisma.coachDigest.create({
            data: { userId: user.id, text: (0, disclaimer_1.withDisclaimer)(generated.text), personaId: persona.id, weekStart: weekStartDate },
        });
    }
    catch (err) {
        // Two runs for the same user+week raced: the unique key keeps exactly one, and only the winner pushes.
        if (err?.code === 'P2002')
            return skip('skipped_exists');
        throw err;
    }
    emit('coach.digest_generated', { source: generated.source, guardrailRejects: generated.rejects, weekStart });
    // The digest is stored; a push failure must not undo or repeat it.
    try {
        const devices = await (0, push_1.sendGenericPush)(deps.pushSender, user.id, 'weekly_digest');
        emit('coach.push_sent', { kind: 'weekly_digest', devices });
    }
    catch (err) {
        emit('coach.push_failed', { kind: 'weekly_digest', error: err instanceof Error ? err.name : 'unknown' });
    }
    return 'generated';
}
/** The scheduled job body. A no-op unless COACH_ENABLED. One user's failure never stops the sweep. */
async function runWeeklyDigest(deps) {
    const summary = { enabled: (0, config_1.isCoachEnabled)(), usersChecked: 0, generated: 0, skipped: 0, failed: 0 };
    if (!summary.enabled)
        return summary;
    let cursor;
    for (;;) {
        const users = await client_1.prisma.user.findMany({
            where: {
                ...(deps.userIds ? { id: { in: deps.userIds } } : {}),
                coachConsents: { some: { revokedAt: null, version: consent_1.COACH_CONSENT_VERSION } },
            },
            select: { id: true, timezone: true, coachPersonaId: true },
            orderBy: { id: 'asc' },
            take: USER_BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (users.length === 0)
            break;
        for (const user of users) {
            summary.usersChecked++;
            try {
                const outcome = await generateWeeklyDigestForUser(user, deps);
                if (outcome === 'generated')
                    summary.generated++;
                else
                    summary.skipped++;
            }
            catch (err) {
                summary.failed++;
                deps.telemetry.emit({
                    name: 'coach.digest_failed',
                    userId: user.id,
                    personaId: (0, personas_1.resolvePersona)(user.coachPersonaId).id,
                    attributes: { error: err instanceof Error ? err.name : 'unknown' },
                });
            }
        }
        cursor = users[users.length - 1].id;
        if (users.length < USER_BATCH)
            break;
    }
    return summary;
}
//# sourceMappingURL=digest.js.map