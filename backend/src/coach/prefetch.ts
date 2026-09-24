// Question-driven pre-fetch. Whether the model decides to call a tool varies
// from run to run: the same "how has my HRV trended this week?" was answered
// from getMetricHistory once and, the next time, with an invented "steady"
// and no tool call at all. For the common question shapes the server makes the
// call up front, like the getDailyScore/getTodayMetrics preamble, so the model
// only has to reference data that is already in front of it.
//
// Pure and conservative: it only plans calls, and at most one per tool.
// Grounding refuses a reference to a tool called with two different argument
// sets in one turn, so two pre-fetched getMetricHistory calls (say steps AND
// sleep) would make both unreadable; a question naming several metrics gets no
// history pre-fetch and the model calls the tool itself.

import { MAX_HISTORY_DAYS } from './tools';
import { MAX_HABIT_LOG_DAYS, MetricKey } from './tools/metrics';

export interface PlannedCall {
  name: 'getMetricHistory' | 'getHabitLogs';
  args: Record<string, unknown>;
}

// Matched against the question with "heart rate variability" already rewritten
// to "hrv", so the plain "heart rate" pattern never also claims an HRV question.
const METRIC_PATTERNS: [MetricKey, RegExp][] = [
  ['HRV', /\bhrv\b/i],
  ['RESTING_HR', /resting heart|\brhr\b|resting hr|\bpulse\b|\bheart rate\b/i],
  ['SLEEP', /\bsle(?:ep|pt|eping)\b/i],
  ['STEPS', /\bsteps?\b|\bwalk(?:ed|ing)?\b/i],
];

// A question about a span of time, a trend, or counting days, rather than one day.
const RANGE_RE =
  /\b(?:trend(?:ed|ing|s)?|week|weekly|month|monthly|fortnight|lately|recently|over time|average|avg|how many days|best|worst|highest|lowest|last \d+ days|past \d+ days|this year)\b/i;

const HABIT_RE =
  /\b(?:drink|drank|drinks|drinking|alcohol|beers?|wines?|booze|caffeine|coffees?|espressos?|teas?|cups?|work(?:ed)? out|workouts?|exercis(?:e|ed|ing)|gym|habits?|logged|log)\b/i;

/** How many days the question covers; `fallback` when it names no span. */
export function daysFromQuestion(message: string, fallback: number, max: number): number {
  const m = message.toLowerCase();
  const explicit = /\b(?:last|past)\s+(\d{1,3})\s+days?\b/.exec(m);
  if (explicit) return Math.min(Math.max(Number(explicit[1]), 1), max);
  if (/\b(?:two weeks|2 weeks|fortnight)\b/.test(m)) return Math.min(14, max);
  if (/\bthis year|past year|last year\b/.test(m)) return max;
  if (/\bmonth|monthly\b/.test(m)) return Math.min(30, max);
  if (/\bweek|weekly\b/.test(m)) return Math.min(7, max);
  return Math.min(fallback, max);
}

export function planPrefetch(message: string): PlannedCall[] {
  const plan: PlannedCall[] = [];

  const text = message.replace(/heart rate variability/gi, 'hrv');
  const metrics = METRIC_PATTERNS.filter(([, re]) => re.test(text)).map(([key]) => key);
  if (metrics.length === 1 && RANGE_RE.test(message)) {
    plan.push({ name: 'getMetricHistory', args: { metric: metrics[0], days: daysFromQuestion(message, 7, MAX_HISTORY_DAYS) } });
  }

  if (HABIT_RE.test(message)) {
    plan.push({ name: 'getHabitLogs', args: { days: daysFromQuestion(message, 7, MAX_HABIT_LOG_DAYS) } });
  }

  return plan;
}
