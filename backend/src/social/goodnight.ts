// "Say goodnight" (spec 2026-10-07 social §6.1): one Goodnight per author per evening (one said between 00:00 and
// 05:59 local belongs to the previous date), open from min(20:00, bedtime goal − 60 min) to 05:59 in the author's
// zone (owner ruling Q1; the night scene keeps 19:00), on time when it is at or before the bedtime goal + 15 min
// (23:00 with no goal), undoable for 10 minutes — only tonight's, never last night's. Always shared with buddies,
// like the check-in: self-reported, no number. No push (spec §10).

import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { BuddyError } from '../buddies/errors';
import { GOODNIGHT_SELECT, type GoodnightRow } from './circle';
import { eveningDate, isGoodnightOpen, isOnTime, zoneOrUtc } from './night';

export const GOODNIGHT_UNDO_MS = 10 * 60 * 1000;

export interface GoodnightDTO { localDate: string; at: string; onTime: boolean; undoUntil: string }

export function toGoodnightDTO(row: Pick<GoodnightRow, 'localDate' | 'at' | 'onTime'>): GoodnightDTO {
  return {
    localDate: row.localDate.toISOString().slice(0, 10),
    at: row.at.toISOString(),
    onTime: row.onTime,
    undoUntil: new Date(row.at.getTime() + GOODNIGHT_UNDO_MS).toISOString(),
  };
}

export async function sayGoodnight(userId: string, now: Date): Promise<GoodnightDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, bedtimeGoal: true } });
  if (!user) throw new BuddyError('not_buddies');
  const zone = zoneOrUtc(user.timezone);
  if (!isGoodnightOpen(now, zone, user.bedtimeGoal)) throw new BuddyError('goodnight_closed');
  const localDate = civilDateToUtcMidnight(eveningDate(now, zone));
  // A second tap the same evening keeps the first goodnight: its time and its on-time verdict.
  await prisma.goodnight.createMany({
    data: [{ authorId: userId, localDate, at: now, onTime: isOnTime(now, zone, user.bedtimeGoal) }],
    skipDuplicates: true,
  });
  const row = await prisma.goodnight.findUniqueOrThrow({ where: { authorId_localDate: { authorId: userId, localDate } }, select: GOODNIGHT_SELECT });
  return toGoodnightDTO(row);
}

/**
 * Undoes my goodnight for the current evening (localDate = eveningDate(now)) within 10 minutes of it; later →
 * undo_expired. Never yesterday's: after 06:00 the evening has moved on, so last night's goodnight is not undone
 * even inside its 10 minutes. None for this evening → nothing to do.
 */
export async function undoGoodnight(userId: string, now: Date): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  if (!user) return;
  const localDate = civilDateToUtcMidnight(eveningDate(now, zoneOrUtc(user.timezone)));
  const tonight = await prisma.goodnight.findUnique({
    where: { authorId_localDate: { authorId: userId, localDate } },
    select: { id: true, at: true },
  });
  if (!tonight) return;
  if (now.getTime() - tonight.at.getTime() > GOODNIGHT_UNDO_MS) throw new BuddyError('undo_expired');
  await prisma.goodnight.deleteMany({ where: { id: tonight.id } });
}
