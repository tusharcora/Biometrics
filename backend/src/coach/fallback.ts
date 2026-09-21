// The turn preamble and the server-composed fallback (spec section 2).
//
// Before the first model call of every turn the orchestrator itself fetches
// today's score. That guarantees fallback material no matter what fails later
// (a timeout, two guardrail rejections, a provider error, a failure before the
// model made any tool call) and saves a model round-trip on the most common
// question. It is fetched fresh every turn and is valid for {{ref}}
// resolution like any other tool result.

import { resolveReferences } from './guardrails/grounding';
import type { CoachTools, DailyScoreToolResult } from './tools';

export interface Preamble {
  /** Today's getDailyScore result (may hold nulls before today's score exists); null when the pre-fetch failed. */
  today: DailyScoreToolResult | null;
  /** The score the fallback is composed from: today's, else the most recent one; null means "static message". */
  fallbackScore: DailyScoreToolResult | null;
}

export async function loadPreamble(tools: CoachTools, userId: string, today: string): Promise<Preamble> {
  try {
    const todayResult = await tools.getDailyScore(userId, today);
    if (todayResult.recoveryScore !== null) return { today: todayResult, fallbackScore: todayResult };
    // No score for today yet: the most recent one, with its date stated.
    const latestDate = await tools.findMostRecentScoreDate(userId, today);
    if (!latestDate) return { today: todayResult, fallbackScore: null };
    const latest = await tools.getDailyScore(userId, latestDate);
    return { today: todayResult, fallbackScore: latest.recoveryScore !== null ? latest : null };
  } catch {
    // Reasons only, never content: the caller logs that the pre-fetch failed.
    return { today: null, fallbackScore: null };
  }
}

/** Fixed; no numbers. Used when there is no score to compose from (spec's exact wording). */
export const STATIC_FALLBACK = "I can't reach your data right now — please try again in a moment.";

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

export function dateLabel(civilDate: string): string {
  const [, m, d] = civilDate.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/**
 * Builds the fallback body (without the disclaimer, which the orchestrator
 * adds to every reply) from the preamble alone: no model involved.
 */
export function composeFallback(preamble: Preamble, todayDate: string): string {
  const score = preamble.fallbackScore;
  if (!score) return STATIC_FALLBACK;

  const isToday = score.date === todayDate;
  const ref = (path: string) => `{{getDailyScore.${path}}}`;
  let template: string;
  if (isToday) {
    const comparison =
      score.direction === 'higher' || score.direction === 'lower'
        ? `, ${ref('direction')} than yesterday`
        : score.direction === 'unchanged'
          ? ', unchanged from yesterday'
          : '';
    template = `Your recovery score today is ${ref('recoveryScore')}${comparison}. ${TAIL}`;
  } else {
    template = `I don't have a recovery score for today yet. Your most recent one, from ${ref('dateLabel')}, is ${ref('recoveryScore')}. ${TAIL}`;
  }
  // Resolved through the same resolver as model replies, against the preamble only.
  return resolveReferences(template, [{ name: 'getDailyScore', result: { ...score, dateLabel: dateLabel(score.date) } }]).text;
}
