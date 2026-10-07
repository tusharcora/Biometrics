// The social sweep (S2), on the existing hourly recap-sweep tick (sync/worker.ts): deletes camp notes past their
// expiry (reads already hide them; this removes the free text itself) and week-highlight caches more than
// HIGHLIGHTS_RETENTION_WEEKS old (only the latest final week is ever served). Returns counts only.

import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { shiftDate } from '../scoring/dates';

export const HIGHLIGHTS_RETENTION_WEEKS = 4;

export async function runSocialSweep(now: Date): Promise<{ notes: number; highlights: number }> {
  const notes = await prisma.campNote.deleteMany({ where: { expiresAt: { lte: now } } });
  const cutoff = civilDateToUtcMidnight(shiftDate(now.toISOString().slice(0, 10), -7 * HIGHLIGHTS_RETENTION_WEEKS));
  const highlights = await prisma.weeklyHighlights.deleteMany({ where: { weekStart: { lt: cutoff } } });
  return { notes: notes.count, highlights: highlights.count };
}
