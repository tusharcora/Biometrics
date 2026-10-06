// Dev only: gives an existing account (the demo account) sample badge levels, so the simulator pass
// can see the Profile card, the Badges screens, a celebration (two levels are left uncelebrated)
// and the recap cards (levels dated in the last two weeks).
//
//   DATABASE_URL=<local dev database> node node_modules/.bin/ts-node scripts/seedAchievements.ts --email demo@example.com
//
// Refuses NODE_ENV=production and any DATABASE_URL whose host is not localhost. Idempotent: levels
// already there are skipped. Never runs on import: the CLI entry point is guarded by require.main.
import type { AchievementFamily } from '@prisma/client';
import { familyDef } from '../src/achievements/catalogue';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../src/biometrics/civilDate';
import { prisma } from '../src/db/client';
import { mondayOf, monthStartOf } from '../src/recap/periods';
import { shiftDate } from '../src/scoring/dates';

type SeedEnv = { NODE_ENV?: string | undefined; DATABASE_URL?: string | undefined };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const START_DAYS_BACK = 30;

export function assertDevDatabase(env: SeedEnv): void {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed achievements in production');
  let host = '';
  try {
    host = new URL(env.DATABASE_URL ?? '').hostname;
  } catch {
    host = '';
  }
  if (!LOCAL_HOSTS.has(host)) throw new Error('Refusing to seed achievements: DATABASE_URL is not a local database');
}

/** [family, level, days before today, already celebrated]. */
export const SAMPLE_LEVELS: ReadonlyArray<readonly [AchievementFamily, number, number, boolean]> = [
  ['SLEEP_GOAL', 1, 12, true],
  ['SLEEP_GOAL', 2, 8, true],
  ['EVERY_DAY_LOGGED', 1, 6, true],
  ['STEADY_BEDTIME', 1, 3, false],
  ['CHECK_IN', 1, 2, false],
];

export async function seedAchievements({ email, now = new Date(), env = process.env }: { email: string; now?: Date; env?: SeedEnv }): Promise<{ userId: string; created: number }> {
  assertDevDatabase(env);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, timezone: true, achievementsSince: true } });
  if (!user) throw new Error('No user with that email');
  const today = localCivilDateOrUtc(now, user.timezone);
  if (!user.achievementsSince) {
    await prisma.user.update({ where: { id: user.id }, data: { achievementsSince: civilDateToUtcMidnight(shiftDate(today, -START_DAYS_BACK)) } });
  }
  const result = await prisma.achievement.createMany({
    data: SAMPLE_LEVELS.map(([family, level, daysBack, celebrated]) => {
      const earnedOn = shiftDate(today, -daysBack);
      return {
        userId: user.id,
        family,
        level,
        value: familyDef(family).thresholds[level - 1]!,
        earnedOn: civilDateToUtcMidnight(earnedOn),
        weekStart: civilDateToUtcMidnight(mondayOf(earnedOn)),
        monthStart: civilDateToUtcMidnight(monthStartOf(earnedOn)),
        celebratedAt: celebrated ? now : null,
      };
    }),
    skipDuplicates: true,
  });
  return { userId: user.id, created: result.count };
}

async function main() {
  const i = process.argv.indexOf('--email');
  const email = i >= 0 ? process.argv[i + 1] : undefined;
  if (!email) throw new Error('Usage: seedAchievements --email <email>');
  try {
    const { userId, created } = await seedAchievements({ email });
    console.info(JSON.stringify({ event: 'achievements.seeded', userId, created }));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    // Only the error's name: messages can carry the email or connection details.
    console.error(JSON.stringify({ event: 'achievements.seed_failed', error: err instanceof Error ? err.name : 'Error' }));
    process.exit(1);
  });
}
