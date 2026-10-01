// backend/tests/coach/engine.test.ts
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { COACH_CONSENT_VERSION, COACH_HOSTED_CONSENT_VERSION } from '../../src/coach/consent';
import { HostedWithLocalFallback, selectEngine, withServedEngine } from '../../src/coach/engine';
import { runAnswer } from '../../src/coach/answer/pipeline';
import type { AnswerEvent } from '../../src/coach/answer/pipeline';
import type { FactData } from '../../src/coach/answer/facts';
import type { CoachModelProvider, CoachModelRequest, CoachStreamRequest } from '../../src/coach/model/provider';
import { HostedRefusalError } from '../../src/coach/model/anthropic';
import { FakeClock, RecordingTelemetry, createUser } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

/** A stream provider: yields `chunks`, then throws `failAfter` if given. Records every request. */
function fake(id: string, chunks: string[], failAfter?: Error) {
  const requests: CoachStreamRequest[] = [];
  const provider: CoachModelProvider & { requests: CoachStreamRequest[] } = {
    id,
    requests,
    async *stream(request: CoachStreamRequest) {
      requests.push(request);
      for (const c of chunks) yield c;
      if (failAfter) throw failAfter;
    },
    async generate(_request: CoachModelRequest) {
      if (failAfter) throw failAfter;
      return { type: 'text' as const, text: chunks.join('') };
    },
  };
  return provider;
}

async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const c of it) out.push(c);
  return out;
}

const req = (signal?: AbortSignal): CoachStreamRequest => ({
  system: 'SYS',
  messages: [{ role: 'user', content: 'hi' }],
  maxTokens: 600,
  ...(signal ? { signal } : {}),
});

async function userWith(opts: { engine?: 'LOCAL' | 'HOSTED'; hostedConsent?: boolean }) {
  const user = await createUser();
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  if (opts.hostedConsent) {
    await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_HOSTED_CONSENT_VERSION, scope: 'HOSTED' } });
  }
  if (opts.engine) await prisma.user.update({ where: { id: user.id }, data: { coachEngine: opts.engine } });
  return user;
}

describe('selectEngine', () => {
  const local = fake('local', ['L.']);
  const hosted = fake('hosted', ['H.']);

  it('answers locally by default', async () => {
    const user = await userWith({});
    const s = await selectEngine(user.id, { local, hosted });
    expect(s.requested).toBe('local');
    expect(s.provider).toBe(local);
    expect(s.servedBy()).toBe('local');
  });

  it('uses hosted (with a local fallback) when chosen and consented', async () => {
    const user = await userWith({ engine: 'HOSTED', hostedConsent: true });
    const s = await selectEngine(user.id, { local, hosted });
    expect(s.requested).toBe('hosted');
    expect(s.provider).toBeInstanceOf(HostedWithLocalFallback);
    expect(await collect(s.provider.stream(req()))).toEqual(['H.']);
    expect(s.servedBy()).toBe('hosted');
  });

  it('answers locally when hosted is chosen but no longer offered', async () => {
    const user = await userWith({ engine: 'HOSTED', hostedConsent: true });
    const s = await selectEngine(user.id, { local, hosted: null });
    expect(s.requested).toBe('local');
    expect(s.provider).toBe(local);
  });

  it('answers locally when hosted is chosen but the hosted consent is stale or revoked', async () => {
    const user = await userWith({ engine: 'HOSTED' });
    await prisma.coachConsent.create({ data: { userId: user.id, version: 'hosted-0', scope: 'HOSTED' } });
    expect((await selectEngine(user.id, { local, hosted })).requested).toBe('local');

    const revoked = await userWith({ engine: 'HOSTED', hostedConsent: true });
    await prisma.coachConsent.updateMany({ where: { userId: revoked.id, scope: 'HOSTED' }, data: { revokedAt: new Date() } });
    expect((await selectEngine(revoked.id, { local, hosted })).requested).toBe('local');
  });

  it('answers locally when hosted is chosen and consented but the coach (local) consent is gone', async () => {
    const user = await userWith({ engine: 'HOSTED', hostedConsent: true });
    await prisma.coachConsent.updateMany({ where: { userId: user.id, scope: 'LOCAL' }, data: { revokedAt: new Date() } });
    expect((await selectEngine(user.id, { local, hosted })).requested).toBe('local');
  });

  it('answers locally when the user chose local, even with a hosted consent', async () => {
    const user = await userWith({ engine: 'LOCAL', hostedConsent: true });
    expect((await selectEngine(user.id, { local, hosted })).requested).toBe('local');
  });
});

describe('HostedWithLocalFallback', () => {
  it.each([
    ['a refusal of the whole fallback chain', new HostedRefusalError()],
    ['a network or 5xx error', Object.assign(new Error('socket hang up'), { name: 'APIConnectionError' })],
  ])('answers locally after %s before any text', async (_label, failure) => {
    const local = fake('local', ['Local ', 'answer.']);
    const onFallback = jest.fn();
    const p = new HostedWithLocalFallback(fake('hosted', [], failure), local, onFallback);

    expect(await collect(p.stream(req()))).toEqual(['Local ', 'answer.']);
    expect(p.servedBy).toBe('local');
    expect(onFallback).toHaveBeenCalledWith(failure.name);
    expect(local.requests).toEqual([req()]);
  });

  it('does not fall back once hosted text went out: the error reaches the pipeline', async () => {
    const failure = new Error('stream dropped');
    const local = fake('local', ['never']);
    const p = new HostedWithLocalFallback(fake('hosted', ['Half a '], failure), local);
    const got: string[] = [];
    await expect(
      (async () => {
        for await (const c of p.stream(req())) got.push(c);
      })(),
    ).rejects.toBe(failure);
    expect(got).toEqual(['Half a ']);
    expect(local.requests).toHaveLength(0);
    expect(p.servedBy).toBe('hosted');
  });

  it('does not fall back on a refusal that arrives after hosted text went out', async () => {
    const failure = new HostedRefusalError();
    const local = fake('local', ['never']);
    const p = new HostedWithLocalFallback(fake('hosted', ['Your recovery is 26.'], failure), local);
    await expect(collect(p.stream(req()))).rejects.toBe(failure);
    expect(local.requests).toHaveLength(0);
    expect(p.servedBy).toBe('hosted');
  });

  it('does not fall back when the caller aborted (budget spent or the user tapped stop)', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = Object.assign(new Error('aborted'), { name: 'APIUserAbortError' });
    const local = fake('local', ['never']);
    const p = new HostedWithLocalFallback(fake('hosted', [], abortError), local);
    await expect(collect(p.stream(req(controller.signal)))).rejects.toBe(abortError);
    expect(local.requests).toHaveLength(0);
  });

  it('stays on the local model for the rest of the message once it fell back (a regeneration)', async () => {
    const hosted = fake('hosted', [], new HostedRefusalError());
    const local = fake('local', ['L.']);
    const onFallback = jest.fn();
    const p = new HostedWithLocalFallback(hosted, local, onFallback);
    await collect(p.stream(req()));
    await collect(p.stream(req()));
    expect(hosted.requests).toHaveLength(1);
    expect(local.requests).toHaveLength(2);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(p.servedBy).toBe('local');
  });

  it('falls back the same way on the legacy generate path', async () => {
    const p = new HostedWithLocalFallback(fake('hosted', [], new HostedRefusalError()), fake('local', ['From local.']));
    const res = await p.generate({ tier: 'fast', system: 's', messages: [], tools: [], signal: new AbortController().signal });
    expect(res).toEqual({ type: 'text', text: 'From local.' });
    expect(p.servedBy).toBe('local');
  });
});

describe('withServedEngine', () => {
  async function* events(list: AnswerEvent[]): AsyncIterable<AnswerEvent> {
    for (const e of list) yield e;
  }
  async function drain(it: AsyncIterable<AnswerEvent>) {
    const out: AnswerEvent[] = [];
    for await (const e of it) out.push(e);
    return out;
  }

  it('rewrites done.engine and the stored message when the hosted call fell back', async () => {
    const user = await createUser();
    const conversation = await prisma.coachConversation.create({ data: { userId: user.id } });
    const message = await prisma.coachMessage.create({
      data: { conversationId: conversation.id, userId: user.id, role: 'ASSISTANT', text: 'Local answer.', engine: 'HOSTED' },
    });
    const selection = { requested: 'hosted' as const, provider: fake('x', []), servedBy: () => 'local' as const };

    const out = await drain(
      withServedEngine(
        events([
          { type: 'text', sentence: 'Local answer.' },
          { type: 'done', messageId: message.id, conversationId: conversation.id, engine: 'hosted', durationMs: 5 },
        ]),
        selection,
      ),
    );

    expect(out).toEqual([
      { type: 'text', sentence: 'Local answer.' },
      { type: 'done', messageId: message.id, conversationId: conversation.id, engine: 'local', durationMs: 5 },
    ]);
    expect((await prisma.coachMessage.findUniqueOrThrow({ where: { id: message.id } })).engine).toBe('LOCAL');
  });

  it('passes events through untouched when the engine did not change', async () => {
    const list: AnswerEvent[] = [
      { type: 'status', label: 'Thinking' },
      { type: 'done', messageId: 'm', conversationId: 'c', engine: 'hosted', durationMs: 1 },
    ];
    const selection = { requested: 'hosted' as const, provider: fake('x', []), servedBy: () => 'hosted' as const };
    expect(await drain(withServedEngine(events(list), selection))).toEqual(list);
  });
});

// Through the real answer pipeline: the fallback happens inside the provider, so
// runAnswer runs once: one status, one memory resolution, one stored reply.
describe('hosted fallback through runAnswer', () => {
  const none = { value: null, display: null, deltaFromYesterday: null, direction: null, changeDisplay: null };
  const FACT_DATA: FactData = {
    getDailyScore: async (_u, date) => ({
      date,
      recoveryScore: 26,
      sleepScore: null,
      factors: [],
      factorsByKey: {},
      confidence: 'HIGH',
      deltaFromYesterday: null,
      direction: null,
      sleepDeltaFromYesterday: null,
      sleepDirection: null,
      changeDisplay: null,
      sleepChangeDisplay: null,
    }),
    getDailyMetrics: async (_u, date) => ({
      date,
      steps: { ...none, goal: 10000, percentOfGoal: null, percentOfGoalDisplay: null, goalMet: null },
      restingHeartRate: none,
      hrv: none,
      sleep: { ...none, goalMinutes: 480, goalDisplay: '8h 0m', percentOfGoal: null, percentOfGoalDisplay: null },
    }),
    getScoreHistory: async (_u, metric, days) => ({ metric, days, points: [], average: null, highest: null, lowest: null }),
    getMetricHistory: async (_u, metric) => ({
      metric,
      days: 30,
      daysWithData: 0,
      points: [],
      average: null,
      averageDisplay: null,
      highest: null,
      lowest: null,
      earliest: null,
      latest: null,
      trend: null,
      trendPercent: null,
      trendDisplay: null,
      coverageDisplay: '0 of 30',
    }),
    getHabitCorrelations: async () => ({ correlations: [] }),
    getUserGoals: async () => ({ sleepGoalMinutes: 480, sleepGoalHours: 8 }),
    loadConfirmedMemories: async () => [],
  };

  async function answer(hosted: CoachModelProvider, local: CoachModelProvider) {
    const user = await userWith({ engine: 'HOSTED', hostedConsent: true });
    const onFallback = jest.fn();
    const selection = await selectEngine(user.id, { local, hosted, onFallback });
    expect(selection.requested).toBe('hosted');
    const deps = {
      provider: selection.provider,
      engine: selection.requested,
      telemetry: new RecordingTelemetry(),
      clock: new FakeClock(),
      budgetMs: 30_000,
      factData: FACT_DATA,
    };
    const out: AnswerEvent[] = [];
    const input = { userId: user.id, message: 'How am I doing today?', history: [] };
    for await (const e of withServedEngine(runAnswer(input, deps), selection)) out.push(e);
    return { out, onFallback, userId: user.id };
  }

  it('answers locally after a hosted failure before any text: one status, done.engine local, stored LOCAL', async () => {
    const local = fake('local', ['Your recovery is 26 today.']);
    const { out, onFallback, userId } = await answer(fake('hosted', [], new HostedRefusalError()), local);

    expect(out.map((e) => e.type)).toEqual(['status', 'text', 'done']);
    expect((out[2] as Extract<AnswerEvent, { type: 'done' }>).engine).toBe('local');
    expect(onFallback).toHaveBeenCalledWith('HostedRefusalError');
    const stored = await prisma.coachMessage.findMany({ where: { userId } });
    expect(stored).toHaveLength(2);
    expect(stored.find((m) => m.role === 'ASSISTANT')!.engine).toBe('LOCAL');
  });

  it('does not re-answer locally after hosted text was shown: no second status, no local sentences', async () => {
    const local = fake('local', ['Local text.']);
    const { out, onFallback } = await answer(fake('hosted', ['Your recovery is 26 today. '], new HostedRefusalError()), local);

    expect(out).toEqual([
      expect.objectContaining({ type: 'status' }),
      { type: 'text', sentence: 'Your recovery is 26 today.' },
      { type: 'error', code: 'model_unavailable', retryable: true },
    ]);
    expect(local.requests).toHaveLength(0);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('keeps hosted as the engine when hosted answers', async () => {
    const { out, userId } = await answer(fake('hosted', ['Your recovery is 26 today.']), fake('local', ['never']));
    expect((out[out.length - 1] as Extract<AnswerEvent, { type: 'done' }>).engine).toBe('hosted');
    const stored = await prisma.coachMessage.findFirstOrThrow({ where: { userId, role: 'ASSISTANT' } });
    expect(stored.engine).toBe('HOSTED');
  });
});
