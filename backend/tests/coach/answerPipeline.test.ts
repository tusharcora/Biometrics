import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import * as memoryModule from '../../src/coach/memory';
import { AnswerDeps, AnswerEvent, AnswerInput, runAnswer } from '../../src/coach/answer/pipeline';
import type { FactData } from '../../src/coach/answer/facts';
import { CoachStreamRequest, ScriptedStreamProvider, StreamStep, UnconfiguredProvider } from '../../src/coach/model/provider';
import { LEGACY_DISCLAIMER, LEGACY_REPLY_NOTES } from '../../src/coach/answer/history';
import { SAFETY_REPLY } from '../../src/coach/guardrails/crisis';
import { migrateTestDb } from '../setupTestDb';
import { FakeClock, RecordingTelemetry, createUser } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

const empty = { value: null, display: null, deltaFromYesterday: null, direction: null, changeDisplay: null };
const history = (average: number | null) => ({
  metric: 'SLEEP' as const,
  days: 30,
  daysWithData: 0,
  points: [],
  average,
  averageDisplay: null,
  highest: null,
  lowest: null,
  earliest: null,
  latest: null,
  trend: null,
  trendPercent: null,
  trendDisplay: null,
  coverageDisplay: '0 of 30',
});

/** Recovery 26 (usual 58) and sleep 6h 48m (usual 7h 13m); everything else unrecorded. */
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
    steps: { ...empty, goal: 10000, percentOfGoal: null, percentOfGoalDisplay: null, goalMet: null },
    restingHeartRate: empty,
    hrv: empty,
    sleep: { ...empty, value: 408, display: '6h 48m', goalMinutes: 480, goalDisplay: '8h 0m', percentOfGoal: null, percentOfGoalDisplay: null },
  }),
  getScoreHistory: async (_u, metric, days) => ({ metric, days, points: [], average: metric === 'RECOVERY' ? 58 : null, highest: null, lowest: null }),
  getMetricHistory: async (_u, metric) => ({ ...history(metric === 'SLEEP' ? 433 : null), metric }),
  getHabitCorrelations: async () => ({ correlations: [] }),
  getUserGoals: async () => ({ sleepGoalMinutes: 480, sleepGoalHours: 8 }),
  loadConfirmedMemories: async () => [],
};

const CARD = '```card\n{"headline":"Recovery is low today","tiles":[{"fact":"recovery.today","label":"Recovery"},{"fact":"sleep.total","label":"Sleep"}],"tip":"Keep today easy.","source":"Today"}\n```';
const GOOD = ['Your recovery is 26 today, ', 'well under your usual 58. ', 'You slept 6h 48m. Want a tip?\n', CARD];

function setup(script: StreamStep[] | ScriptedStreamProvider | UnconfiguredProvider, over: Partial<AnswerDeps> = {}) {
  const provider = Array.isArray(script) ? new ScriptedStreamProvider(script) : script;
  const clock = new FakeClock();
  const telemetry = new RecordingTelemetry();
  const deps: AnswerDeps = { provider, engine: 'local', telemetry, clock, budgetMs: 45_000, factData: FACT_DATA, ...over };
  return { provider, clock, telemetry, deps };
}

async function collect(events: AsyncIterable<AnswerEvent>): Promise<AnswerEvent[]> {
  const out: AnswerEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

async function input(over: Partial<AnswerInput> = {}): Promise<AnswerInput> {
  const user = await createUser();
  return { userId: user.id, message: 'How am I doing today?', history: [], ...over };
}

async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!cond()) throw new Error('condition never became true');
}

const types = (events: AnswerEvent[]) => events.map((e) => e.type);
const texts = (events: AnswerEvent[]) => events.flatMap((e) => (e.type === 'text' ? [e.sentence] : []));
const doneOf = (events: AnswerEvent[]) => events.find((e): e is Extract<AnswerEvent, { type: 'done' }> => e.type === 'done')!;

/** A step that streams nothing until the request is aborted, then fails like fetch does. */
const hangUntilAborted = (seen: { signal?: AbortSignal }) =>
  async function* (req: CoachStreamRequest): AsyncIterable<string> {
    seen.signal = req.signal!;
    await new Promise((_resolve, reject) => req.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
  };

describe('runAnswer: a validated, streamed answer', () => {
  it('streams status, each sentence, the card and done, and stores the clean reply with its card', async () => {
    const { deps, provider } = setup([GOOD]);
    const inp = await input();
    const events = await collect(runAnswer(inp, deps));

    expect(types(events)).toEqual(['status', 'text', 'text', 'text', 'card', 'done']);
    const done = doneOf(events);
    expect(events[0]).toEqual({ type: 'status', label: 'Looking at your day…', conversationId: done.conversationId });
    expect(texts(events)).toEqual(['Your recovery is 26 today, well under your usual 58.', 'You slept 6h 48m.', 'Want a tip?']);
    const card = events.find((e) => e.type === 'card');
    expect(card).toEqual({
      type: 'card',
      card: {
        headline: 'Recovery is low today',
        tiles: [
          { factId: 'recovery.today', label: 'Recovery', display: '26', value: 26, usual: 58, status: 'below', deltaDisplay: '−32 points' },
          { factId: 'sleep.total', label: 'Sleep', display: '6h 48m', value: 408, usual: 433, status: 'near', deltaDisplay: '−25m' },
        ],
        tip: 'Keep today easy.',
        source: 'Today',
      },
    });

    expect(done).toMatchObject({ engine: 'local', durationMs: 0 });
    const rows = await prisma.coachMessage.findMany({ where: { conversationId: done.conversationId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.role, r.source, r.text])).toEqual([
      ['USER', null, 'How am I doing today?'],
      ['ASSISTANT', 'MODEL', 'Your recovery is 26 today, well under your usual 58. You slept 6h 48m. Want a tip?'],
    ]);
    expect(rows[1]!.id).toBe(done.messageId);
    expect(rows[1]).toMatchObject({ card: (card as { card: unknown }).card, engine: 'LOCAL', durationMs: 0, guardrailEvents: null });
    expect(rows[1]!.text).not.toContain(LEGACY_DISCLAIMER);

    const request = provider.requests[0]!;
    expect(request.maxTokens).toBe(600);
    expect(request.system).toContain('[recovery.today] Recovery today: 26 (usual 58, 32 lower than usual)');
    expect(request.messages).toEqual([{ role: 'user', content: 'How am I doing today?' }]);
  });

  it('sends the last 10 turns of history as clean text and routes a follow-up by the previous question', async () => {
    const { deps, provider } = setup([['Rest well tonight.']]);
    const past = Array.from({ length: 12 }, (_, i) =>
      i % 2 === 0 ? { role: 'user' as const, text: `q${i}` } : { role: 'assistant' as const, text: `a${i}\n\n${LEGACY_DISCLAIMER}` },
    );
    past[10] = { role: 'user', text: 'How did I sleep?' };
    const events = await collect(runAnswer(await input({ message: 'why?', history: past }), deps));
    expect(events[0]).toMatchObject({ type: 'status', label: 'Looking at your sleep…' });
    const sent = provider.requests[0]!.messages;
    expect(sent).toHaveLength(11);
    expect(sent[0]).toEqual({ role: 'user', content: 'q2' });
    expect(sent[1]).toEqual({ role: 'assistant', content: 'a3' });
    expect(sent[10]).toEqual({ role: 'user', content: 'why?' });
  });

  it("names an existing conversation's own id on the status event", async () => {
    const { deps } = setup([['First.'], ['Second.']]);
    const inp = await input();
    const first = doneOf(await collect(runAnswer(inp, deps)));
    const events = await collect(runAnswer({ ...inp, message: 'and now?', conversationId: first.conversationId }, deps));
    expect(events[0]).toMatchObject({ type: 'status', conversationId: first.conversationId });
  });

  it('continues an existing conversation', async () => {
    const { deps } = setup([['First.'], ['Second.']]);
    const inp = await input();
    const first = doneOf(await collect(runAnswer(inp, deps)));
    const second = doneOf(await collect(runAnswer({ ...inp, message: 'and now?', conversationId: first.conversationId }, deps)));
    expect(second.conversationId).toBe(first.conversationId);
    expect(await prisma.coachConversation.count({ where: { userId: inp.userId } })).toBe(1);
    expect(await prisma.coachMessage.count({ where: { conversationId: first.conversationId } })).toBe(4);
  });
});

describe('runAnswer: validation', () => {
  it('drops a sentence with an invented number and keeps streaming the rest', async () => {
    const { deps, telemetry } = setup([['Your recovery is 26. ', 'Your HRV is 60 ms. ', 'Take it easy.']]);
    const events = await collect(runAnswer(await input(), deps));
    expect(texts(events)).toEqual(['Your recovery is 26.', 'Take it easy.']);
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
    expect(row.text).toBe('Your recovery is 26. Take it easy.');
    expect(row.guardrailEvents).toEqual([{ type: 'sentence_dropped', reason: 'unknown_number', attempt: 1 }]);
    expect(telemetry.named('coach.answer_sentence_dropped')[0]!.attributes).toEqual({ reason: 'unknown_number', attempt: 1, route: 'today' });
  });

  it('regenerates once when no sentence could be shown, with a note and without the rejected text', async () => {
    const { deps, provider } = setup([['Your HRV is 60 ms. Take 3 mg of melatonin.'], ['Recovery is 26 today.']]);
    const events = await collect(runAnswer(await input(), deps));
    expect(texts(events)).toEqual(['Recovery is 26 today.']);
    expect(provider.callCount).toBe(2);
    const retry = provider.requests[1]!.messages;
    expect(retry[retry.length - 1]!.content).toMatch(/^\[system notice\] Your previous answer could not be shown/);
    expect(JSON.stringify(retry)).not.toContain('60 ms');
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
    expect(row.guardrailEvents).toEqual([
      { type: 'sentence_dropped', reason: 'unknown_number', attempt: 1 },
      { type: 'sentence_dropped', reason: 'disallowed_topic', attempt: 1 },
      { type: 'regenerated' },
    ]);
  });

  it('regenerates an empty answer too', async () => {
    const { deps, provider } = setup([[''], ['Recovery is 26 today.']]);
    expect(texts(await collect(runAnswer(await input(), deps)))).toEqual(['Recovery is 26 today.']);
    expect(provider.callCount).toBe(2);
  });

  it('ends with a validation_failed error, and stores nothing, when the regeneration fails too', async () => {
    const { deps } = setup([['Your HRV is 60 ms.'], ['Your HRV is 61 ms.']]);
    const inp = await input();
    const events = await collect(runAnswer(inp, deps));
    expect(types(events)).toEqual(['status', 'error']);
    expect(events[1]).toEqual({ type: 'error', code: 'validation_failed', retryable: true });
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
    expect(await prisma.coachConversation.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('uses an injected sentence validator (the eval harness switches validation off to prove its own check)', async () => {
    const seen: string[] = [];
    const { deps } = setup([['Your HRV is 60 ms. Take it easy.']], {
      validate: (sentence) => {
        seen.push(sentence);
        return { ok: true };
      },
    });
    const events = await collect(runAnswer(await input(), deps));
    expect(texts(events)).toEqual(['Your HRV is 60 ms.', 'Take it easy.']);
    expect(seen).toEqual(['Your HRV is 60 ms.', 'Take it easy.']);
  });

  it('drops a card that references no known fact, and still answers', async () => {
    const { deps } = setup([['Recovery is 26.\n```card\n{"headline":"Hi","tiles":[{"fact":"nope"}]}\n```']]);
    const events = await collect(runAnswer(await input(), deps));
    expect(types(events)).toEqual(['status', 'text', 'done']);
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
    expect(row.card).toBeNull();
    expect(row.guardrailEvents).toEqual([{ type: 'card_dropped' }]);
  });
});

describe('runAnswer: memory block', () => {
  it('stores a valid proposal as PENDING in this conversation and emits it; the block never reaches the text', async () => {
    const block = '```memory\n[{"category":"SCHEDULE","value":"Runs at 6am on weekdays"},{"category":"PREFERENCE","value":"Hates my knee injury talk"}]\n```';
    const { deps } = setup([[`Nice routine. ${block}`]]);
    const inp = await input({ message: 'I run at 6am on weekdays' });
    const events = await collect(runAnswer(inp, deps));
    expect(types(events)).toEqual(['status', 'text', 'memory', 'done']);
    const memory = events.find((e): e is Extract<AnswerEvent, { type: 'memory' }> => e.type === 'memory')!;
    expect(memory.proposals.map((p) => [p.category, p.value, p.status])).toEqual([['SCHEDULE', 'Runs at 6am on weekdays', 'PENDING']]);
    const stored = await prisma.coachMemory.findMany({ where: { userId: inp.userId } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.conversationId).toBe(doneOf(events).conversationId);
    // History shows the chip on the reply that proposed it.
    expect(stored[0]!.messageId).toBe(doneOf(events).messageId);
    expect(texts(events).join(' ')).not.toContain('6am');
  });

  it("confirms the conversation's pending memory when the next message does not correct it", async () => {
    const { deps } = setup([[`Ok. \`\`\`memory\n{"category":"SCHEDULE","value":"Runs at 6am"}\n\`\`\``], ['Great.']]);
    const inp = await input({ message: 'I run at 6am' });
    const first = doneOf(await collect(runAnswer(inp, deps)));
    await collect(runAnswer({ ...inp, message: 'what about today?', conversationId: first.conversationId }, deps));
    expect((await prisma.coachMemory.findFirstOrThrow({ where: { userId: inp.userId } })).status).toBe('CONFIRMED');
  });
});

describe('runAnswer: safety', () => {
  it('answers a crisis message with the fixed safety reply and resources, without calling the model', async () => {
    const { deps, provider } = setup([]);
    const inp = await input({ message: 'I want to end my life' });
    const events = await collect(runAnswer(inp, deps));
    expect(types(events)).toEqual(['safety', 'done']);
    expect(events[0]).toMatchObject({ type: 'safety', text: SAFETY_REPLY });
    expect((events[0] as { resources: string[] }).resources.length).toBeGreaterThan(0);
    expect(provider.callCount).toBe(0);
    const rows = await prisma.coachMessage.findMany({ where: { userId: inp.userId }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.source, r.text, r.engine])).toEqual([
      [null, 'I want to end my life', null],
      ['SAFETY', SAFETY_REPLY, null],
    ]);
    // A new conversation's id reaches the client with the safety reply, before anything is stored.
    const safety = events[0] as Extract<AnswerEvent, { type: 'safety' }>;
    expect(safety.conversationId).toBe(doneOf(events).conversationId);
    expect(rows.every((r) => r.conversationId === safety.conversationId)).toBe(true);
  });

  it('safetyOverride answers normally', async () => {
    const { deps, provider } = setup([['Happy to look at your data.']]);
    const events = await collect(runAnswer(await input({ message: 'should I take melatonin', safetyOverride: true }), deps));
    expect(types(events)).toEqual(['status', 'text', 'done']);
    expect(provider.callCount).toBe(1);
  });
});

describe('runAnswer: errors, budget and stop', () => {
  it('reports model_unavailable when the model cannot be reached, and stores nothing', async () => {
    const { deps } = setup(new UnconfiguredProvider());
    const inp = await input();
    const events = await collect(runAnswer(inp, deps));
    expect(events[events.length - 1]).toEqual({ type: 'error', code: 'model_unavailable', retryable: true });
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('keeps sentences already sent when the stream drops mid-answer, then reports the error', async () => {
    const { deps } = setup([{ chunks: ['Recovery is 26. ', 'You slept'], error: new Error('socket hang up') }]);
    const events = await collect(runAnswer(await input(), deps));
    expect(types(events)).toEqual(['status', 'text', 'error']);
    expect(events[2]).toEqual({ type: 'error', code: 'model_unavailable', retryable: true });
  });

  it('reports internal when the fact sheet cannot be built', async () => {
    const { deps } = setup([['Hi.']], {
      factData: { ...FACT_DATA, getDailyScore: async () => Promise.reject(new Error('db down')) },
    });
    const events = await collect(runAnswer(await input(), deps));
    expect(events[events.length - 1]).toEqual({ type: 'error', code: 'internal', retryable: true });
  });

  it('times out at the budget: aborts the model call and reports timeout', async () => {
    const seen: { signal?: AbortSignal } = {};
    const { deps, clock, telemetry } = setup([hangUntilAborted(seen)]);
    const inp = await input();
    const running = collect(runAnswer(inp, deps));
    await until(() => seen.signal !== undefined);
    clock.advance(45_000);
    const events = await running;
    expect(events[events.length - 1]).toEqual({ type: 'error', code: 'timeout', retryable: true });
    expect(seen.signal!.aborted).toBe(true);
    expect(telemetry.named('coach.latency_budget_exceeded')).toHaveLength(1);
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('on stop after a sentence, stores the partial reply marked stopped and ends with done stopped', async () => {
    const stop = new AbortController();
    const seen: { signal?: AbortSignal } = {};
    const step = async function* (req: CoachStreamRequest): AsyncIterable<string> {
      yield 'Recovery is 26. ';
      yield* hangUntilAborted(seen)(req);
    };
    const { deps } = setup([step]);
    const inp = await input({ signal: stop.signal });
    const events: AnswerEvent[] = [];
    let abortedAtDone: boolean | undefined;
    const running = (async () => {
      for await (const e of runAnswer(inp, deps)) {
        if (e.type === 'done') abortedAtDone = seen.signal!.aborted;
        events.push(e);
      }
    })();
    await until(() => events.some((e) => e.type === 'text'));
    stop.abort();
    await running;
    expect(types(events)).toEqual(['status', 'text', 'done']);
    expect(doneOf(events).stopped).toBe(true);
    expect(abortedAtDone).toBe(true);
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
    expect(row.text).toBe('Recovery is 26.');
    expect(row.guardrailEvents).toEqual([{ type: 'stopped' }]);
    // The first turn of a new chat: the status event already named the conversation it was stored in.
    const status = events[0] as Extract<AnswerEvent, { type: 'status' }>;
    expect(status.conversationId).toBe(doneOf(events).conversationId);
    expect(row.conversationId).toBe(status.conversationId);
  });

  it('on stop before any sentence, stores nothing and emits nothing more', async () => {
    const stop = new AbortController();
    const seen: { signal?: AbortSignal } = {};
    const { deps } = setup([hangUntilAborted(seen)]);
    const inp = await input({ signal: stop.signal });
    const running = collect(runAnswer(inp, deps));
    await until(() => seen.signal !== undefined);
    stop.abort();
    const events = await running;
    expect(types(events)).toEqual(['status']);
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
    // The reserved id was never created: no empty conversation is left behind.
    const reserved = (events[0] as Extract<AnswerEvent, { type: 'status' }>).conversationId;
    expect(reserved).toEqual(expect.any(String));
    expect(await prisma.coachConversation.count({ where: { userId: inp.userId } })).toBe(0);
  });
});

describe('runAnswer: failure paths (fix round 1)', () => {
  it('times out after text was already streamed: aborts the model at once, ends with timeout and stores nothing', async () => {
    const seen: { signal?: AbortSignal } = {};
    const step = async function* (req: CoachStreamRequest): AsyncIterable<string> {
      yield 'Recovery is 26. ';
      yield* hangUntilAborted(seen)(req);
    };
    const { deps, clock } = setup([step]);
    const inp = await input();
    const events: AnswerEvent[] = [];
    let abortedAtError: boolean | undefined;
    const running = (async () => {
      for await (const e of runAnswer(inp, deps)) {
        if (e.type === 'error') abortedAtError = seen.signal!.aborted;
        events.push(e);
      }
    })();
    await until(() => events.some((e) => e.type === 'text') && seen.signal !== undefined);
    clock.advance(45_000);
    await running;
    expect(types(events)).toEqual(['status', 'text', 'error']);
    expect(texts(events)).toEqual(['Recovery is 26.']);
    expect(events[2]).toEqual({ type: 'error', code: 'timeout', retryable: true });
    expect(abortedAtError).toBe(true);
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('a crisis message still yields the safety reply and resources before the error when storing fails', async () => {
    const { deps, provider } = setup([], { loadUser: async () => Promise.reject(new Error('db down')) });
    // An unknown conversation makes the persist transaction fail.
    const inp = await input({ message: 'I want to end my life', conversationId: randomUUID() });
    const events = await collect(runAnswer(inp, deps));
    expect(types(events)).toEqual(['safety', 'error']);
    expect(events[0]).toMatchObject({ type: 'safety', text: SAFETY_REPLY });
    expect((events[0] as { resources: string[] }).resources.length).toBeGreaterThan(0);
    expect(events[1]).toEqual({ type: 'error', code: 'internal', retryable: true });
    expect(provider.callCount).toBe(0);
    expect(await prisma.coachMessage.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('leaves no PENDING memory when the reply cannot be stored', async () => {
    const { deps } = setup([['First.'], ['Ok. ```memory\n{"category":"SCHEDULE","value":"Runs at 6am"}\n```']]);
    const inp = await input();
    const first = doneOf(await collect(runAnswer(inp, deps)));
    // The memory write itself would succeed; only storing the reply fails.
    const spy = jest.spyOn(prisma, '$transaction').mockRejectedValue(new Error('db down'));
    let events: AnswerEvent[];
    try {
      events = await collect(runAnswer({ ...inp, message: 'I run at 6am', conversationId: first.conversationId }, deps));
    } finally {
      spy.mockRestore();
    }
    expect(types(events)).toEqual(['status', 'text', 'error']);
    expect(events[2]).toEqual({ type: 'error', code: 'internal', retryable: true });
    expect(await prisma.coachMemory.count({ where: { userId: inp.userId } })).toBe(0);
  });

  it('stores the answer without its proposals when only the memory write fails', async () => {
    const spy = jest.spyOn(memoryModule, 'createPendingMemories').mockRejectedValueOnce(new Error('db down'));
    try {
      const { deps } = setup([['Ok. ```memory\n{"category":"SCHEDULE","value":"Runs at 6am"}\n```']]);
      const inp = await input({ message: 'I run at 6am' });
      const events = await collect(runAnswer(inp, deps));
      expect(types(events)).toEqual(['status', 'text', 'done']);
      const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
      expect(row.text).toBe('Ok.');
      expect(await prisma.coachMemory.count({ where: { userId: inp.userId } })).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("maps engine 'hosted' to HOSTED on the stored row and the done event", async () => {
    const { deps } = setup([['Recovery is 26 today.']], { engine: 'hosted' });
    const events = await collect(runAnswer(await input(), deps));
    expect(doneOf(events).engine).toBe('hosted');
    const row = await prisma.coachMessage.findUniqueOrThrow({ where: { id: doneOf(events).messageId } });
    expect(row.engine).toBe('HOSTED');
  });

  it('emits the card before the memory, both after the text and before done', async () => {
    const memory = '\n```memory\n{"category":"SCHEDULE","value":"Runs at 6am on weekdays"}\n```';
    const { deps } = setup([[...GOOD, memory]]);
    const events = await collect(runAnswer(await input({ message: 'How am I doing? I run at 6am on weekdays' }), deps));
    expect(types(events)).toEqual(['status', 'text', 'text', 'text', 'card', 'memory', 'done']);
  });

  it('drops history turns that are empty once cleaned (the hosted API rejects empty messages)', async () => {
    const { deps, provider } = setup([['Rest well tonight.']]);
    const past = [
      { role: 'user' as const, text: 'How did I sleep?' },
      { role: 'assistant' as const, text: `\n\n${LEGACY_DISCLAIMER}` },
      { role: 'user' as const, text: '   ' },
      { role: 'assistant' as const, text: `${LEGACY_REPLY_NOTES[0]}\n\n${LEGACY_DISCLAIMER}` },
    ];
    await collect(runAnswer(await input({ message: 'why?', history: past }), deps));
    expect(provider.requests[0]!.messages).toEqual([
      { role: 'user', content: 'How did I sleep?' },
      { role: 'user', content: 'why?' },
    ]);
  });
});

describe('runAnswer: telemetry', () => {
  it('reports ids, counts and reasons only, never the message or the reply', async () => {
    const SENTINEL = 'quokka-sentinel';
    const { deps, telemetry } = setup([[`Recovery is 26, ${SENTINEL}. Your HRV is 60 ms.`]]);
    await collect(runAnswer(await input({ message: `${SENTINEL} how am I?` }), deps));
    const done = telemetry.named('coach.answer_done')[0]!;
    expect(done.attributes).toEqual({ route: 'today', engine: 'local', sentences: 1, dropped: 1, card: false, attempts: 1, durationMs: 0 });
    expect(JSON.stringify(telemetry.events)).not.toContain(SENTINEL);
  });
});
