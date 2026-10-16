// The living room (spec 2026-10-15 §8.3, C5): the room mirrors your data in bands and small counts, never a raw value,
// computed here and sent only to you on the cosmetics body. Plants grow a stage every 7 sleep-goal nights (the
// `sleep_goal` coin rows, 0-coin ones included, so nights before coins launched don't count); the cat's energy is
// today's steps as a band of the step goal; the trophy shelf holds one award per badge level, highest first. Never
// logged, never in a buddy DTO, never in a coach context (tests/room/noCoachImport.test.ts). The 22:00 nap is the
// app's, from the device clock (P3 plan ruling 6).
//
// Ruling PF3-PLANTS-2 lives here, not in the app: an account made before P3 launched (RELEASE_LAUNCHED_AT[5]) already
// had a room whose plants drew fully grown, so they stay fully grown for good (max of the counted stage and 5); no
// plant ever shrinks. Accounts made after P3 grow from the counted stage. The account's createdAt stands for the
// room's age: every account has a room (the starter one until a first save) and CosmeticLoadout keeps no creation time.
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../biometrics/civilDate';
import { STEPS_GOAL } from '../coach/tools/metrics';
import { RELEASE_LAUNCHED_AT } from '../cosmetics/catalogue';
import { prisma } from '../db/client';

export type PetEnergy = 'nap' | 'wander' | 'play';
export interface Living {
  plantStage: 1 | 2 | 3 | 4 | 5;
  petEnergy: PetEnergy;
  /** Badge levels (1-5), highest first, at most MAX_AWARDS. */
  awards: number[];
}

export const PLANT_NIGHTS_PER_STAGE = 7;
export const MAX_AWARDS = 8;
/** P3's launch: a room older than this keeps full-grown plants (ruling PF3-PLANTS-2). */
const P3_LAUNCHED_AT = RELEASE_LAUNCHED_AT[5];
const DAY_MS = 24 * 60 * 60 * 1000;

export function plantStageOf(nights: number): Living['plantStage'] {
  return Math.min(5, 1 + Math.floor(Math.max(0, nights) / PLANT_NIGHTS_PER_STAGE)) as Living['plantStage'];
}

/** plantStageOf, except a room from before P3 is never smaller than full growth (ruling PF3-PLANTS-2). */
export function plantStageFor(nights: number, roomBeforeP3: boolean): Living['plantStage'] {
  return roomBeforeP3 ? (Math.max(plantStageOf(nights), 5) as Living['plantStage']) : plantStageOf(nights);
}

export function petEnergyOf(steps: number): PetEnergy {
  const share = steps / STEPS_GOAL;
  return share >= 1 ? 'play' : share >= 0.3 ? 'wander' : 'nap';
}

export async function readLiving(userId: string, now: Date): Promise<Living> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, createdAt: true } });
  const tz = user?.timezone ?? 'UTC';
  const today = localCivilDateOrUtc(now, tz);
  const from = civilDateToUtcMidnight(today);
  const [nights, stepsRow, rows] = await Promise.all([
    // Every sleep-goal night, 0-coin rows included; the key prefix makes this a range on the (userId, sourceKey) index.
    prisma.coinEvent.count({ where: { userId, sourceKey: { startsWith: 'sleep_goal:' } } }),
    // Today's STEPS rollup only, read the way loadRecapData reads it (the local date's UTC-midnight day, a positive
    // value), without its score and session reads.
    prisma.biometricRecord.findFirst({
      where: { userId, metricType: 'STEPS', recordedAt: { gte: from, lt: new Date(from.getTime() + DAY_MS) }, value: { gt: 0 } },
      select: { value: true },
    }),
    prisma.achievement.findMany({
      where: { userId },
      select: { level: true },
      orderBy: [{ level: 'desc' }, { earnedOn: 'asc' }, { id: 'asc' }],
      take: MAX_AWARDS,
    }),
  ]);
  const beforeP3 = !!user && user.createdAt < P3_LAUNCHED_AT;
  return {
    plantStage: plantStageFor(nights, beforeP3),
    petEnergy: petEnergyOf(stepsRow?.value ?? 0),
    awards: rows.map((r) => r.level),
  };
}
