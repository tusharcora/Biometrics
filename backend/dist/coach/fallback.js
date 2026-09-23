"use strict";
// The turn preamble and the server-composed fallback (spec section 2).
//
// Before the first model call of every turn the orchestrator itself fetches
// today's score. That guarantees fallback material no matter what fails later
// (a timeout, two guardrail rejections, a provider error, a failure before the
// model made any tool call) and saves a model round-trip on the most common
// question. It is fetched fresh every turn and is valid for {{ref}}
// resolution like any other tool result.
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATIC_FALLBACK = void 0;
exports.loadPreamble = loadPreamble;
exports.dateLabel = dateLabel;
exports.composeFallback = composeFallback;
const grounding_1 = require("./guardrails/grounding");
async function loadPreamble(tools, userId, today) {
    try {
        const todayResult = await tools.getDailyScore(userId, today);
        if (todayResult.recoveryScore !== null)
            return { today: todayResult, fallbackScore: todayResult };
        // No score for today yet: the most recent one, with its date stated.
        const latestDate = await tools.findMostRecentScoreDate(userId, today);
        if (!latestDate)
            return { today: todayResult, fallbackScore: null };
        const latest = await tools.getDailyScore(userId, latestDate);
        return { today: todayResult, fallbackScore: latest.recoveryScore !== null ? latest : null };
    }
    catch {
        // Reasons only, never content: the caller logs that the pre-fetch failed.
        return { today: null, fallbackScore: null };
    }
}
/** Fixed; no numbers. Used when there is no score to compose from (spec's exact wording). */
exports.STATIC_FALLBACK = "I can't reach your data right now — please try again in a moment.";
const TAIL = "I couldn't put together a fuller answer just now.";
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
function dateLabel(civilDate) {
    const [, m, d] = civilDate.split('-').map(Number);
    return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}
/**
 * Builds the fallback body (without the disclaimer, which the orchestrator
 * adds to every reply) from the preamble alone: no model involved.
 */
function composeFallback(preamble, todayDate) {
    const score = preamble.fallbackScore;
    if (!score)
        return exports.STATIC_FALLBACK;
    const isToday = score.date === todayDate;
    const ref = (path) => `{{getDailyScore.${path}}}`;
    let template;
    if (isToday) {
        const comparison = score.direction === 'higher' || score.direction === 'lower'
            ? `, ${ref('direction')} than yesterday`
            : score.direction === 'unchanged'
                ? ', unchanged from yesterday'
                : '';
        template = `Your recovery score today is ${ref('recoveryScore')}${comparison}. ${TAIL}`;
    }
    else {
        template = `I don't have a recovery score for today yet. Your most recent one, from ${ref('dateLabel')}, is ${ref('recoveryScore')}. ${TAIL}`;
    }
    // Resolved through the same resolver as model replies, against the preamble only.
    return (0, grounding_1.resolveReferences)(template, [{ name: 'getDailyScore', result: { ...score, dateLabel: dateLabel(score.date) } }]).text;
}
//# sourceMappingURL=fallback.js.map