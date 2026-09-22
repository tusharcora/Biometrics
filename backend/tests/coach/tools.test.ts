import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { coachTools, COACH_TOOL_SCHEMAS, MAX_HISTORY_DAYS } from '../../src/coach/tools';
import { compareScores } from '../../src/coach/tools/dailyScore';
import { createUser, daysAgo, putScore, todayUtc } from './helpers';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ctx = () => ({ today: todayUtc() });

async function run(userId: string, name: string, args: unknown) {
  const out = await coachTools.run(userId, name, args, ctx());
  if (!out.ok) throw new Error(`tool failed: ${out.error}`);
  return out.result as any;
}

describe('tool registry', () => {
  it('exposes exactly the four read-only tools, each with a JSON schema for the provider', () => {
    expect(COACH_TOOL_SCHEMAS.map((t) => t.name)).toEqual(['getDailyScore', 'getScoreHistory', 'getHabitCorrelations', 'getUserGoals']);
    for (const t of COACH_TOOL_SCHEMAS) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.parameters).toMatchObject({ type: 'object' });
    }
    // No tool accepts free-form query text or writes: no propose/set/update/sql tool exists.
    expect(COACH_TOOL_SCHEMAS.map((t) => t.name).join(' ')).not.toMatch(/write|set|update|delete|sql|propose/i);
  });

  it('rejects an unknown tool and invalid arguments without throwing', async () => {
    const user = await createUser();
    expect(await coachTools.run(user.id, 'runSql', {}, ctx())).toEqual({ ok: false, error: 'unknown_tool' });
    expect(await coachTools.run(user.id, 'getDailyScore', { date: 'yesterday' }, ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
    expect(await coachTools.run(user.id, 'getDailyScore', { date: '2026-02-31' }, ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
    expect(await coachTools.run(user.id, 'getScoreHistory', { metric: 'HRV', days: 7 }, ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
    expect(await coachTools.run(user.id, 'getScoreHistory', { metric: 'RECOVERY', days: 0 }, ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
    expect(await coachTools.run(user.id, 'getScoreHistory', { metric: 'RECOVERY', days: 2.5 }, ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
    expect(await coachTools.run(user.id, 'getUserGoals', [], ctx())).toEqual({ ok: false, error: 'invalid_arguments' });
  });
});

describe('getDailyScore', () => {
  it('returns scores, factors and confidence with deltaFromYesterday and direction PRECOMPUTED server-side', async () => {
    const user = await createUser();
    await putScore(user.id, daysAgo(1), 75);
    await putScore(user.id, todayUtc(), 72.34);
    await putScore(user.id, daysAgo(1), 60, 'SLEEP');
    await putScore(user.id, todayUtc(), 66, 'SLEEP');

    const r = await run(user.id, 'getDailyScore', { date: todayUtc() });

    expect(Object.keys(r).sort()).toEqual(
      [
        'confidence',
        'date',
        'deltaFromYesterday',
        'direction',
        'factors',
        'factorsByKey',
        'recoveryScore',
        'sleepDeltaFromYesterday',
        'sleepDirection',
        'sleepScore',
      ].sort(),
    );
    expect(r).toMatchObject({
      date: todayUtc(),
      recoveryScore: 72.3,
      sleepScore: 66,
      confidence: 'HIGH',
      deltaFromYesterday: -2.7,
      direction: 'lower',
      sleepDeltaFromYesterday: 6,
      sleepDirection: 'higher',
    });
    expect(r.factors).toHaveLength(3);
    expect(r.factors[0]).toMatchObject({ type: 'RECOVERY', factor: 'HRV', label: 'HRV', excluded: false });
  });

  // factors[] is built by skipping a score row that does not exist, so its
  // indices move. A grounding reference must be able to name a factor instead.
  it('keys every factor by its stable FactorKey, so a missing RECOVERY row cannot shift SLEEP factors', async () => {
    // putScore only attaches factors to a RECOVERY row, so the SLEEP rows here
    // are written directly with their own.
    const sleepFactors = [
      { factor: 'SLEEP_DURATION', z: 0.4, weight: 0.5, contribution: 0.2, points: 5, imputed: false, excluded: false },
      { factor: 'SLEEP_EFFICIENCY', z: -0.2, weight: 0.5, contribution: -0.1, points: -2, imputed: false, excluded: false },
    ];
    const putSleep = (userId: string) =>
      prisma.dailyScore.create({
        data: {
          userId,
          date: civilDateToUtcMidnight(todayUtc()),
          type: 'SLEEP',
          algorithmVersion: 'v1',
          score: 66,
          confidenceLevel: 'HIGH',
          factors: sleepFactors as any,
        },
      });

    const both = await createUser();
    await putScore(both.id, todayUtc(), 72);
    await putSleep(both.id);
    const withRecovery = await run(both.id, 'getDailyScore', { date: todayUtc() });

    const sleepOnly = await createUser();
    await putSleep(sleepOnly.id);
    const withoutRecovery = await run(sleepOnly.id, 'getDailyScore', { date: todayUtc() });

    // The positional view genuinely moves: this is the bug the key map exists for.
    expect(withRecovery.factors[0].factor).toBe('HRV');
    expect(withoutRecovery.factors[0].factor).toBe('SLEEP_DURATION');

    // The keyed view does not.
    expect(withRecovery.factorsByKey.SLEEP_DURATION).toMatchObject({ type: 'SLEEP', factor: 'SLEEP_DURATION', points: 5 });
    expect(withoutRecovery.factorsByKey.SLEEP_DURATION).toMatchObject({ type: 'SLEEP', factor: 'SLEEP_DURATION', points: 5 });
    expect(withRecovery.factorsByKey.HRV).toMatchObject({ type: 'RECOVERY', factor: 'HRV' });
    expect(withoutRecovery.factorsByKey.HRV).toBeUndefined();
  });

  it('direction is "higher", "lower" or "unchanged" from the sign of the delta', () => {
    expect(compareScores(80, 70)).toEqual({ delta: 10, direction: 'higher' });
    expect(compareScores(70, 80)).toEqual({ delta: -10, direction: 'lower' });
    expect(compareScores(70, 70)).toEqual({ delta: 0, direction: 'unchanged' });
    expect(compareScores(70.04, 70)).toEqual({ delta: 0, direction: 'unchanged' });
    expect(compareScores(72.3, 75)).toEqual({ delta: -2.7, direction: 'lower' });
  });

  it('has a null delta and direction when there is no comparable yesterday, and nulls when there is no score', async () => {
    const user = await createUser();
    await putScore(user.id, todayUtc(), 70);
    const r = await run(user.id, 'getDailyScore', { date: todayUtc() });
    expect(r).toMatchObject({ recoveryScore: 70, deltaFromYesterday: null, direction: null });

    const empty = await createUser();
    const none = await run(empty.id, 'getDailyScore', {});
    expect(none).toMatchObject({ date: todayUtc(), recoveryScore: null, sleepScore: null, confidence: null, factors: [], direction: null });
  });

  it('defaults to today and only ever reads the caller\'s own rows', async () => {
    const a = await createUser();
    const b = await createUser();
    await putScore(a.id, todayUtc(), 88);
    expect((await run(b.id, 'getDailyScore', {})).recoveryScore).toBeNull();
    expect((await run(a.id, 'getDailyScore', undefined)).recoveryScore).toBe(88);
  });
});

describe('getScoreHistory', () => {
  it('returns oldest-first points over the window with precomputed average, highest and lowest', async () => {
    const user = await createUser();
    for (const [n, s] of [[5, 50], [3, 60], [2, 70], [1, 80], [0, 90]] as const) await putScore(user.id, daysAgo(n), s);
    await putScore(user.id, daysAgo(4), null); // cold-start row: not a data point
    await putScore(user.id, daysAgo(2), 10, 'SLEEP'); // other metric

    const r = await run(user.id, 'getScoreHistory', { metric: 'RECOVERY', days: 4 });

    expect(r.points).toEqual([
      { date: daysAgo(3), score: 60 },
      { date: daysAgo(2), score: 70 },
      { date: daysAgo(1), score: 80 },
      { date: todayUtc(), score: 90 },
    ]);
    expect(r).toMatchObject({ metric: 'RECOVERY', days: 4, average: 75, highest: 90, lowest: 60 });
  });

  it('returns nulls, not zeros, for an empty window, and caps days', async () => {
    const user = await createUser();
    const r = await run(user.id, 'getScoreHistory', { metric: 'SLEEP', days: 9999 });
    expect(r).toMatchObject({ points: [], average: null, highest: null, lowest: null, days: MAX_HISTORY_DAYS });
  });
});

describe('getHabitCorrelations', () => {
  async function seedCorrelation(userId: string, habitType: string, status: 'CANDIDATE' | 'CONFIRMED' | 'RETIRED', factor = 'HRV') {
    return prisma.habitCorrelation.create({
      data: {
        userId,
        habitType,
        factor,
        lagDays: 1,
        status,
        lastEvaluatedAt: new Date(),
        lastRunKey: '2026-W38',
        r: -0.5,
        pValue: 0.01,
        qValue: 0.02,
        effectSizePercent: 12.5,
        comparisonPercent: 40,
        sampleSize: 30,
        direction: 'lower',
        series: { points: [] },
      },
    });
  }

  it('returns only CONFIRMED correlations as structured fields, never a sentence or raw logs or the series', async () => {
    const user = await createUser();
    await seedCorrelation(user.id, 'ALCOHOL', 'CONFIRMED');
    await seedCorrelation(user.id, 'CAFFEINE', 'CANDIDATE');
    await seedCorrelation(user.id, 'WORKOUT', 'RETIRED');
    await prisma.habitLog.create({
      data: { userId: user.id, habitType: 'ALCOHOL', value: 3, unit: 'drinks', loggedAt: new Date(), habitDay: new Date(`${todayUtc()}T00:00:00Z`), note: 'secret note' },
    });

    const r = await run(user.id, 'getHabitCorrelations', {});

    expect(r.correlations).toHaveLength(1);
    expect(Object.keys(r.correlations[0]).sort()).toEqual(
      [
        'comparisonPercent',
        'direction',
        'effectSizePercent',
        'exposureThreshold',
        'exposureUnit',
        'factor',
        'habitLabel',
        'habitType',
        'lagDays',
        'sampleSize',
      ].sort(),
    );
    expect(r.correlations[0]).toMatchObject({
      habitType: 'ALCOHOL',
      habitLabel: 'Alcohol',
      exposureThreshold: 2,
      exposureUnit: 'drinks',
      factor: 'HRV',
      lagDays: 1,
      effectSizePercent: 12.5,
      comparisonPercent: 40,
      sampleSize: 30,
      direction: 'lower',
    });
    const blob = JSON.stringify(r);
    expect(blob).not.toContain('secret note');
    expect(blob).not.toContain('series');
    for (const v of Object.values(r.correlations[0])) {
      expect(typeof v === 'string' ? v.split(' ').length : 1).toBeLessThan(3); // no composed sentence
    }
  });

  it('is empty when nothing is confirmed, and scoped to the caller', async () => {
    const a = await createUser();
    const b = await createUser();
    await seedCorrelation(a.id, 'ALCOHOL', 'CONFIRMED');
    expect((await run(b.id, 'getHabitCorrelations', {})).correlations).toEqual([]);
  });
});

describe('getUserGoals', () => {
  it('reads the sleep goal from the same source scoring uses, with hours precomputed', async () => {
    const user = await createUser({ sleepGoalMinutes: 450 });
    expect(await run(user.id, 'getUserGoals', {})).toEqual({ sleepGoalMinutes: 450, sleepGoalHours: 7.5 });
    const dflt = await createUser();
    expect(await run(dflt.id, 'getUserGoals', {})).toEqual({ sleepGoalMinutes: 480, sleepGoalHours: 8 });
  });
});
