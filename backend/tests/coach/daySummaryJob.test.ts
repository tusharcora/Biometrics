// backend/tests/coach/daySummaryJob.test.ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { migrateTestDb } from '../setupTestDb';
import { COACH_CONSENT_VERSION, COACH_HOSTED_CONSENT_VERSION } from '../../src/coach/consent';
import { summaryEngineDeps } from '../../src/coach/answer/today';
import { NoopCoachTelemetry } from '../../src/coach/telemetry';
import {
  COACH_DAY_SUMMARY_JOB,
  daySummaryJobId,
  refreshDaySummaryAfterScore,
  runDaySummaryJob,
} from '../../src/coach/daySummaryJob';
import type { FactSheet } from '../../src/coach/answer/facts';
import type { CoachModelProvider } from '../../src/coach/model/provider';
import { FakeClock, createUser } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

let savedFlag: string | undefined;
beforeEach(() => {
  savedFlag = process.env.COACH_ENABLED;
  process.env.COACH_ENABLED = 'true';
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.COACH_ENABLED;
  else process.env.COACH_ENABLED = savedFlag;
  jest.restoreAllMocks();
});

const NOW = new Date('2026-09-30T12:00:00Z');

function fakeQueue(fail = false) {
  const add = jest.fn(async (..._args: unknown[]) => {
    if (fail) throw new Error('redis down');
    return {};
  });
  return { queue: { add } as never, add };
}

async function consentedUser(timezone = 'UTC') {
  const user = await createUser({ timezone });
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  return user;
}

describe('refreshDaySummaryAfterScore', () => {
  it("queues one summary job, keyed by user and day, when today's scores land", async () => {
    const user = await consentedUser();
    const { queue, add } = fakeQueue();

    expect(await refreshDaySummaryAfterScore(user.id, '2026-09-30', { queue, now: () => NOW })).toBe(true);

    expect(add).toHaveBeenCalledWith(
      COACH_DAY_SUMMARY_JOB,
      { userId: user.id, date: '2026-09-30' },
      { jobId: daySummaryJobId(user.id, '2026-09-30'), removeOnComplete: true, removeOnFail: true, attempts: 1 },
    );
    expect(daySummaryJobId(user.id, '2026-09-30')).toBe(`coach-summary-${user.id}-2026-09-30`);
  });

  it("uses the user's local day", async () => {
    const user = await consentedUser('Pacific/Auckland'); // already 1 October there
    const { queue, add } = fakeQueue();
    expect(await refreshDaySummaryAfterScore(user.id, '2026-09-30', { queue, now: () => NOW })).toBe(false);
    expect(await refreshDaySummaryAfterScore(user.id, '2026-10-01', { queue, now: () => NOW })).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a past day (backfill, sweep)', async () => consentedUser(), '2026-09-28'],
    ['a user without the coach consent', async () => createUser(), '2026-09-30'],
  ])('queues nothing for %s', async (_label, makeUser, date) => {
    const user = await makeUser();
    const { queue, add } = fakeQueue();
    expect(await refreshDaySummaryAfterScore(user.id, date, { queue, now: () => NOW })).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('queues nothing while the coach is off', async () => {
    process.env.COACH_ENABLED = 'false';
    const user = await consentedUser();
    const { queue, add } = fakeQueue();
    expect(await refreshDaySummaryAfterScore(user.id, '2026-09-30', { queue, now: () => NOW })).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });

  it('never fails the score job: a queue error is logged by name and swallowed', async () => {
    const user = await consentedUser();
    const { queue } = fakeQueue(true);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await refreshDaySummaryAfterScore(user.id, '2026-09-30', { queue, now: () => NOW })).toBe(false);
    expect(errors).toHaveBeenCalledWith(JSON.stringify({ event: 'coach.day_summary_enqueue_failed', error: 'Error' }));
  });
});

describe('runDaySummaryJob', () => {
  it('rewrites the stored sentence from fresh data (forced)', async () => {
    const user = await consentedUser();
    const day = civilDateToUtcMidnight('2026-09-30');
    await prisma.coachDaySummary.create({ data: { userId: user.id, date: day, text: 'stale', spans: [], source: 'AI' } });
    const sheet: FactSheet = {
      route: 'today',
      facts: [{ id: 'recovery.today', label: 'Recovery today', value: 71, unit: 'score', display: '71', usual: 58 }],
      notes: [],
    };
    const provider: CoachModelProvider = {
      id: 'fake',
      async *stream() {
        yield 'Recovery is up at 71. Go enjoy a longer walk today.';
      },
      generate: async () => ({ type: 'text', text: '' }),
    };

    const outcome = await runDaySummaryJob(
      { userId: user.id, date: '2026-09-30' },
      {
        loadSheet: async () => sheet,
        now: () => NOW,
        clock: new FakeClock(),
        selectProvider: async () => ({ requested: 'local', provider, servedBy: () => 'local' }),
      },
    );

    expect(outcome).toBe('ai');
    const row = await prisma.coachDaySummary.findUniqueOrThrow({ where: { userId_date: { userId: user.id, date: day } } });
    expect(row.text).toBe('Recovery is up at 71. Go enjoy a longer walk today.');
  });
});

describe('summaryEngineDeps', () => {
  const provider = (id: string): CoachModelProvider => ({
    id,
    async *stream() {},
    generate: async () => ({ type: 'text', text: '' }),
  });
  const slots = {
    getProvider: () => provider('local'),
    getHostedProvider: () => provider('hosted'),
    clock: new FakeClock(),
    telemetry: new NoopCoachTelemetry(),
  };

  it("writes with the user's engine: local by default, hosted only when chosen and consented", async () => {
    const local = await consentedUser();
    expect((await summaryEngineDeps(slots).selectProvider!(local.id)).requested).toBe('local');

    const hosted = await consentedUser();
    await prisma.coachConsent.create({ data: { userId: hosted.id, version: COACH_HOSTED_CONSENT_VERSION, scope: 'HOSTED' } });
    await prisma.user.update({ where: { id: hosted.id }, data: { coachEngine: 'HOSTED' } });
    expect((await summaryEngineDeps(slots).selectProvider!(hosted.id)).requested).toBe('hosted');
    expect((await summaryEngineDeps({ ...slots, getHostedProvider: () => null }).selectProvider!(hosted.id)).requested).toBe('local');
  });
});
