// The coach's tool registry (spec section 2): thin READ-ONLY wrappers over the
// Stat Engine and correlation tables. No tool writes, none takes SQL, and none
// returns raw habit logs or a pre-composed sentence: every value the model may
// state arrives as a structured field it references with {{tool.path}}.

import { civilDateToUtcMidnight } from '../../biometrics/civilDate';
import { prisma } from '../../db/client';
import { getConfirmedCorrelations } from '../../habits/correlations';
import { listHabitTypes } from '../../habits/habitTypes';
import { isCivilDate, shiftDate } from '../../scoring/dates';
import { getSleepGoalMinutes } from '../../users/goals';
import { MAX_MEMORY_VALUE_CHARS, MEMORY_CATEGORIES, MemoryProposal, validateMemoryInput } from '../memory';
import { DailyScoreToolResult, findMostRecentScoreDate, getDailyScore } from './dailyScore';

export type { DailyScoreToolResult } from './dailyScore';

export interface CoachToolSchema {
  name: string;
  description: string;
  /** JSON Schema for the arguments, handed to the model provider. */
  parameters: Record<string, unknown>;
}

export type ToolOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: 'unknown_tool' | 'invalid_arguments' | 'memory_rejected' };

export interface ToolContext {
  /** The user's local civil date. */
  today: string;
}

export interface CoachTools {
  schemas: CoachToolSchema[];
  /** Validates arguments and runs one tool. Never throws for a bad call; DB failures propagate. */
  run(userId: string, name: string, args: unknown, ctx: ToolContext): Promise<ToolOutcome>;
  /** Typed access for the orchestrator's turn preamble. */
  getDailyScore(userId: string, date: string): Promise<DailyScoreToolResult>;
  findMostRecentScoreDate(userId: string, onOrBefore: string): Promise<string | null>;
}

export const MAX_HISTORY_DAYS = 90;
const HISTORY_METRICS = ['RECOVERY', 'SLEEP'] as const;
type HistoryMetric = (typeof HISTORY_METRICS)[number];

export const COACH_TOOL_SCHEMAS: CoachToolSchema[] = [
  {
    name: 'getDailyScore',
    description:
      "The user's Recovery Score and Sleep Score for one local date, their per-factor breakdown, a confidence level, and " +
      'the change from the day before (deltaFromYesterday, direction: higher | lower | unchanged), all precomputed. ' +
      "Today's result is already available this turn.",
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Civil date, YYYY-MM-DD. Defaults to today.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'getScoreHistory',
    description: 'Daily scores over the last N days, oldest first, with the precomputed average, highest and lowest.',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: [...HISTORY_METRICS] },
        days: { type: 'integer', minimum: 1, maximum: MAX_HISTORY_DAYS },
      },
      required: ['metric', 'days'],
      additionalProperties: false,
    },
  },
  {
    name: 'getHabitCorrelations',
    description:
      "The user's statistically confirmed habit patterns only, each as structured fields (habitType, habitLabel, " +
      'exposureThreshold, exposureUnit, factor, lagDays, effectSizePercent, comparisonPercent, sampleSize, direction). ' +
      'Never raw habit logs.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'getUserGoals',
    description: "The user's goals, currently the sleep goal, from the same source the sleep-debt score uses.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

/**
 * The one tool that is not read-only, and it is still not a writer: proposeMemory
 * only VALIDATES the proposal (closed category enum, <= 140 chars, health-fact
 * classifier) and hands it back. The orchestrator persists it as PENDING only
 * after the whole reply has passed the grounding guardrail, so a discarded or
 * timed-out turn never leaves a row behind. Kept out of COACH_TOOL_SCHEMAS
 * (the read-only registry the spec lists) and added to what the model sees below.
 */
export const PROPOSE_MEMORY_SCHEMA: CoachToolSchema = {
  name: 'proposeMemory',
  description:
    'Propose remembering ONE stable training goal, schedule or preference the user stated about themselves. ' +
    'Never health, medical, medication, injury or body facts: those are rejected and never stored. ' +
    'The user is told and can correct it.',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: [...MEMORY_CATEGORIES] },
      value: { type: 'string', maxLength: MAX_MEMORY_VALUE_CHARS },
    },
    required: ['category', 'value'],
    additionalProperties: false,
  },
};

/** What a successful proposeMemory outcome carries back to the orchestrator. */
export interface ProposeMemoryResult {
  proposal: MemoryProposal;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function asRecord(args: unknown): Record<string, unknown> | null {
  if (args === undefined || args === null) return {};
  return typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : null;
}

export async function getScoreHistory(userId: string, metric: HistoryMetric, days: number, today: string) {
  const rows = await prisma.dailyScore.findMany({
    where: {
      userId,
      type: metric,
      score: { not: null },
      date: { gte: civilDateToUtcMidnight(shiftDate(today, -(days - 1))), lte: civilDateToUtcMidnight(today) },
    },
    orderBy: { date: 'asc' },
  });
  const points = rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), score: round1(r.score as number) }));
  const scores = points.map((p) => p.score);
  return {
    metric,
    days,
    points,
    average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    highest: scores.length ? Math.max(...scores) : null,
    lowest: scores.length ? Math.min(...scores) : null,
  };
}

export async function getHabitCorrelations(userId: string) {
  const [confirmed, types] = await Promise.all([getConfirmedCorrelations(userId), listHabitTypes(userId)]);
  const labelOf = new Map(types.map((t) => [t.type, t.label]));
  return {
    correlations: confirmed.map((c) => ({
      habitType: c.habitType,
      habitLabel: labelOf.get(c.habitType) ?? c.habitType,
      exposureThreshold: c.exposureThreshold,
      exposureUnit: c.exposureUnit,
      factor: c.factor,
      lagDays: c.lagDays,
      effectSizePercent: c.effectSizePercent,
      comparisonPercent: c.comparisonPercent,
      sampleSize: c.sampleSize,
      direction: c.direction,
    })),
  };
}

export async function getUserGoals(userId: string) {
  const sleepGoalMinutes = await getSleepGoalMinutes(userId);
  return { sleepGoalMinutes, sleepGoalHours: round1(sleepGoalMinutes / 60) };
}

export const coachTools: CoachTools = {
  schemas: [...COACH_TOOL_SCHEMAS, PROPOSE_MEMORY_SCHEMA],

  async run(userId, name, args, ctx) {
    const a = asRecord(args);
    if (a === null) return { ok: false, error: 'invalid_arguments' };
    switch (name) {
      case 'proposeMemory': {
        const checked = validateMemoryInput(a);
        if (checked.ok) {
          const result: ProposeMemoryResult = { proposal: { category: checked.category, value: checked.value } };
          return { ok: true, result };
        }
        // A health-shaped value is reported as rejected; a malformed call as invalid arguments.
        return { ok: false, error: checked.reason === 'health_content' ? 'memory_rejected' : 'invalid_arguments' };
      }
      case 'getDailyScore': {
        const date = a.date === undefined ? ctx.today : a.date;
        if (!isCivilDate(date)) return { ok: false, error: 'invalid_arguments' };
        return { ok: true, result: await getDailyScore(userId, date) };
      }
      case 'getScoreHistory': {
        const metric = a.metric;
        const days = a.days;
        if (!HISTORY_METRICS.includes(metric as HistoryMetric)) return { ok: false, error: 'invalid_arguments' };
        if (typeof days !== 'number' || !Number.isInteger(days) || days < 1) return { ok: false, error: 'invalid_arguments' };
        return {
          ok: true,
          result: await getScoreHistory(userId, metric as HistoryMetric, Math.min(days, MAX_HISTORY_DAYS), ctx.today),
        };
      }
      case 'getHabitCorrelations':
        return { ok: true, result: await getHabitCorrelations(userId) };
      case 'getUserGoals':
        return { ok: true, result: await getUserGoals(userId) };
      default:
        return { ok: false, error: 'unknown_tool' };
    }
  },

  getDailyScore,
  findMostRecentScoreDate,
};
