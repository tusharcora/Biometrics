// Stat Engine backtest (spec §3): replays stored BiometricRecord history through
// a candidate score-config version and diffs the result against the live one.
//
// THIS IS A REGRESSION CHECK, NOT A CORRECTNESS VALIDATION. It shows what a
// change does; there is no ground-truth "recovery" label, so it cannot show a
// version is more accurate. The output says so.
//
// Read-only: it never writes scores, snapshots or flags.
//
//   npx ts-node scripts/backtest.ts --candidate v2
//   npx ts-node scripts/backtest.ts --candidate v2 --live v1 --days 90 --user <userId>
//
// Rollout is then: read the diff, flip LIVE_VERSION in src/scoring/configs/index.ts, deploy.
//
// Never runs on import: the CLI entry point is guarded by require.main.
import { prisma } from '../src/db/client';
import { civilDateToUtcMidnight } from '../src/biometrics/civilDate';
import { getScoreConfig, LIVE_VERSION } from '../src/scoring/configs';
import type { ScoreConfig } from '../src/scoring/configs';
import { shiftDate } from '../src/scoring/dates';
import { backtest, BacktestReport, BacktestUserData, formatReport } from '../src/scoring/backtest';
import { resolveSleepGoalMinutes } from '../src/users/goals';
import type { DailyPoint } from '../src/scoring/types';

export interface BacktestOptions {
  candidate: ScoreConfig;
  live?: ScoreConfig;
  /** Days of history to replay, ending at `now`. */
  days?: number;
  now?: Date;
  /** Injected so tests (and other callers) can supply data without a DB. */
  loadUsers: (range: { from: string; to: string; lookbackFrom: string }) => Promise<BacktestUserData[]>;
}

export async function runBacktest(opts: BacktestOptions): Promise<BacktestReport> {
  const live = opts.live ?? getScoreConfig(LIVE_VERSION);
  const to = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const from = shiftDate(to, -((opts.days ?? 90) - 1));
  // Enough history behind the first replayed day for the widest config's baseline + outlier window.
  const widest = Math.max(live.historyDays + live.outlier.windowDays, opts.candidate.historyDays + opts.candidate.outlier.windowDays);
  const users = await opts.loadUsers({ from, to, lookbackFrom: shiftDate(from, -widest) });
  return backtest(users, live, opts.candidate, { from, to });
}

export function dbLoader(userId?: string): BacktestOptions['loadUsers'] {
  return async ({ to, lookbackFrom }) => {
    const users = await prisma.user.findMany({
      where: userId ? { id: userId } : {},
      select: { id: true, sleepGoalMinutes: true },
    });
    const out: BacktestUserData[] = [];
    for (const u of users) {
      const records = await prisma.biometricRecord.findMany({
        where: {
          userId: u.id,
          recordedAt: { gte: civilDateToUtcMidnight(lookbackFrom), lte: civilDateToUtcMidnight(to) },
        },
        select: { metricType: true, value: true, recordedAt: true },
      });
      const by = (type: string): DailyPoint[] =>
        records.filter((r) => r.metricType === type).map((r) => ({ date: r.recordedAt.toISOString().slice(0, 10), value: r.value }));
      out.push({
        userId: u.id,
        hrv: by('HRV'),
        rhr: by('RESTING_HR'),
        sleep: by('SLEEP'),
        steps: by('STEPS'),
        sleepGoalMinutes: resolveSleepGoalMinutes(u.sleepGoalMinutes),
      });
    }
    return out;
  };
}

export function parseArgs(argv: string[]): { candidate: string; live: string | undefined; days: number; userId: string | undefined } {
  let candidate: string | undefined;
  let live: string | undefined;
  let days = 90;
  let userId: string | undefined;
  const value = (i: number, flag: string) => {
    const v = argv[i];
    if (!v || v.startsWith('--')) throw new Error(`${flag} requires a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--candidate') candidate = value(++i, arg);
    else if (arg === '--live') live = value(++i, arg);
    else if (arg === '--user') userId = value(++i, arg);
    else if (arg === '--days') {
      days = Number(value(++i, arg));
      if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive integer');
    } else {
      throw new Error(`Unknown argument "${arg}". Usage: backtest --candidate <version> [--live <version>] [--days N] [--user <id>]`);
    }
  }
  if (!candidate) throw new Error('--candidate <version> is required');
  return { candidate, live, days, userId };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const report = await runBacktest({
      candidate: getScoreConfig(args.candidate),
      live: getScoreConfig(args.live ?? LIVE_VERSION),
      days: args.days,
      loadUsers: dbLoader(args.userId),
    });
    console.log(formatReport(report));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
