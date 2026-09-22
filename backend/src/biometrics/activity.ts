import { prisma } from '../db/client';
import { civilDateToUtcMidnight } from './civilDate';

// The heat map's widest view is a trailing year drawn as whole week columns
// (up to 371 days); 400 leaves room for that without making this an unbounded
// history dump like GET /me/biometrics.
export const MAX_ACTIVITY_RANGE_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar date, not just the right shape: "2026-02-30" parses to
// March 2nd, so the round trip is what rejects it.
function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = civilDateToUtcMidnight(value);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type ActivityRange = { from: string; to: string };

/** The validated inclusive [from, to] range, or the reason it is not one. */
export function parseActivityRange(from: unknown, to: unknown): ActivityRange | { error: string } {
  if (!isCivilDate(from) || !isCivilDate(to)) return { error: 'from and to must be YYYY-MM-DD dates' };
  if (from > to) return { error: 'from must not be after to' };
  const days = (civilDateToUtcMidnight(to).getTime() - civilDateToUtcMidnight(from).getTime()) / DAY_MS + 1;
  if (days > MAX_ACTIVITY_RANGE_DAYS) return { error: `range must not exceed ${MAX_ACTIVITY_RANGE_DAYS} days` };
  return { from, to };
}

export interface ActivityDTO {
  days: { date: string; steps: number }[];
  // The user's oldest STEPS record, so the client can tell "history not
  // synced yet" apart from "no activity on those days".
  earliestDate: string | null;
}

/**
 * Daily steps for an inclusive civil-date range. STEPS records are already
 * keyed at UTC midnight of their civil date (dailyRollUp's civilStartTime), so
 * the date is read straight off recordedAt with no timezone conversion.
 */
export async function getActivityForUser(userId: string, range: ActivityRange): Promise<ActivityDTO> {
  const gte = civilDateToUtcMidnight(range.from);
  const lt = new Date(civilDateToUtcMidnight(range.to).getTime() + DAY_MS);

  const [records, earliest] = await Promise.all([
    prisma.biometricRecord.findMany({
      where: { userId, metricType: 'STEPS', recordedAt: { gte, lt } },
      select: { recordedAt: true, value: true },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.biometricRecord.findFirst({
      where: { userId, metricType: 'STEPS' },
      select: { recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    }),
  ]);

  return {
    days: records.map((r) => ({ date: r.recordedAt.toISOString().slice(0, 10), steps: r.value })),
    earliestDate: earliest ? earliest.recordedAt.toISOString().slice(0, 10) : null,
  };
}
