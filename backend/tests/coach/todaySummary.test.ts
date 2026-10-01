import { prisma } from '../../src/db/client';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { migrateTestDb } from '../setupTestDb';
import { COACH_CONSENT_VERSION } from '../../src/coach/consent';
import type { Fact, FactSheet } from '../../src/coach/answer/facts';
import {
  SUMMARY_MAX_WORDS,
  TODAY_REQUEST,
  checkSummary,
  generateTodaySummary,
  getTodaySummary,
  templateSentence,
  type TodayDeps,
} from '../../src/coach/answer/today';
import type { EngineSelection } from '../../src/coach/engine';
import type { CoachModelProvider, CoachStreamRequest } from '../../src/coach/model/provider';
import { FakeClock, createUser, hang, settle } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(() => prisma.$disconnect());

let savedFlag: string | undefined;
beforeEach(() => {
  savedFlag = process.env.COACH_ENABLED;
  process.env.COACH_ENABLED = 'true';
});
afterEach(() => {
  if (savedFlag === undefined) delete process.env.COACH_ENABLED;
  else process.env.COACH_ENABLED = savedFlag;
});

const NOW = new Date('2026-09-30T12:00:00Z');
const DAY = civilDateToUtcMidnight('2026-09-30');

const facts: Fact[] = [
  { id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 },
  { id: 'sleep.total', label: 'Sleep last night', value: 408, unit: 'minutes', display: '6h 48m', usual: 433 },
  { id: 'hrv.today', label: 'HRV today', value: 41, unit: 'ms', display: '41 ms', usual: 52 },
  { id: 'rhr.today', label: 'Resting heart rate today', value: 61, unit: 'bpm', display: '61 bpm', usual: 55, lowerIsBetter: true },
];
const LOW_DAY: FactSheet = { route: 'today', facts, notes: [] };
const EMPTY: FactSheet = { route: 'today', facts: [], notes: ['No sleep recorded last night'] };

const GOOD = 'Recovery sits at 26 after HRV dipped to 41 ms. Take it easy today and aim for an early night.';
const INVENTED = 'Recovery sits at 73 today. Take it easy.';

type Step = string | Error | 'hang' | ((req: CoachStreamRequest) => Promise<string>);

/** A stream provider that answers each call with the next step. */
function scripted(steps: Step[]) {
  const requests: CoachStreamRequest[] = [];
  let i = 0;
  const provider: CoachModelProvider = {
    id: 'scripted-stream',
    async *stream(req: CoachStreamRequest) {
      requests.push(req);
      const step = steps[i++];
      if (step === undefined) throw new Error('script exhausted');
      if (step === 'hang') await hang();
      if (step instanceof Error) throw step;
      const text = typeof step === 'function' ? await step(req) : step;
      // Stream it in two chunks, as a real provider would.
      yield text.slice(0, 10);
      yield text.slice(10);
    },
    generate: async () => {
      throw new Error('not used');
    },
  };
  const selection: EngineSelection = { requested: 'local', provider, servedBy: () => 'local' };
  return { requests, selection };
}

async function consentedUser(over: { timezone?: string; coachPersonaId?: string } = {}) {
  const user = await createUser();
  if (Object.keys(over).length > 0) await prisma.user.update({ where: { id: user.id }, data: over });
  await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  return user;
}

function deps(selection: EngineSelection | null, over: Partial<TodayDeps> = {}): TodayDeps & { clock: FakeClock } {
  const clock = new FakeClock();
  return {
    loadSheet: async () => LOW_DAY,
    now: () => NOW,
    clock,
    budgetMs: 45_000,
    ...(selection ? { selectProvider: async () => selection } : {}),
    ...over,
  } as TodayDeps & { clock: FakeClock };
}

const rowOf = (userId: string) => prisma.coachDaySummary.findUnique({ where: { userId_date: { userId, date: DAY } } });

describe('checkSummary', () => {
  it(`accepts ${SUMMARY_MAX_WORDS} words and rejects one more`, () => {
    const words = (n: number) => `${Array.from({ length: n }, () => 'calm').join(' ')}.`;
    expect(checkSummary(words(SUMMARY_MAX_WORDS), LOW_DAY)).toEqual({ ok: true, text: words(SUMMARY_MAX_WORDS) });
    expect(checkSummary(words(SUMMARY_MAX_WORDS + 1), LOW_DAY)).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects an empty reply and an invented number', () => {
    expect(checkSummary('   ', LOW_DAY)).toEqual({ ok: false, reason: 'empty' });
    expect(checkSummary(INVENTED, LOW_DAY)).toEqual({ ok: false, reason: 'unknown_number' });
  });

  it('drops any fenced block and collapses whitespace', () => {
    const raw = `${GOOD.replace('. ', '.\n\n')}\n\`\`\`card\n{"headline":"x"}\n\`\`\``;
    expect(checkSummary(raw, LOW_DAY)).toEqual({ ok: true, text: GOOD });
  });

  it('drops a partial fence left by a max-token cutoff', () => {
    expect(checkSummary(`${GOOD}\n\n\`\``, LOW_DAY)).toEqual({ ok: true, text: GOOD });
    expect(checkSummary(`${GOOD} \``, LOW_DAY)).toEqual({ ok: true, text: GOOD });
  });
});

describe('getTodaySummary', () => {
  it('has no sentence and no bars before any data, and asks for nothing', async () => {
    const user = await consentedUser();
    const onMissing = jest.fn();
    const res = await getTodaySummary(user.id, deps(null, { loadSheet: async () => EMPTY, onMissing }));
    expect(res).toEqual({ date: '2026-09-30', hasData: false, sentence: null, bars: [] });
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('returns the template instantly and asks for a sentence when none is stored', async () => {
    const user = await consentedUser();
    const onMissing = jest.fn();
    const res = await getTodaySummary(user.id, deps(null, { onMissing }));
    expect(res.hasData).toBe(true);
    expect(res.sentence).toEqual({ ...templateSentence(LOW_DAY), source: 'template' });
    expect(res.bars.map((b) => b.metric)).toEqual(['recovery', 'sleep', 'hrv', 'rhr']);
    expect(onMissing).toHaveBeenCalledTimes(1);
  });

  it('returns a stored AI sentence as is', async () => {
    const user = await consentedUser();
    await prisma.coachDaySummary.create({
      data: { userId: user.id, date: DAY, text: GOOD, spans: [{ text: GOOD }], source: 'AI' },
    });
    const onMissing = jest.fn();
    const res = await getTodaySummary(user.id, deps(null, { onMissing }));
    expect(res.sentence).toEqual({ text: GOOD, spans: [{ text: GOOD }], source: 'ai' });
    expect(onMissing).not.toHaveBeenCalled();
  });

  it('a stored TEMPLATE marker serves a fresh template (never stale numbers) and does not retry', async () => {
    const user = await consentedUser();
    await prisma.coachDaySummary.create({
      data: { userId: user.id, date: DAY, text: 'Recovery 70, above your usual 58.', spans: [], source: 'TEMPLATE' },
    });
    const onMissing = jest.fn();
    const res = await getTodaySummary(user.id, deps(null, { onMissing }));
    expect(res.sentence).toEqual({ ...templateSentence(LOW_DAY), source: 'template' });
    expect(onMissing).not.toHaveBeenCalled();
  });

  it("dates the summary in the user's own timezone", async () => {
    const user = await consentedUser({ timezone: 'Pacific/Auckland' });
    const res = await getTodaySummary(user.id, deps(null));
    expect(res.date).toBe('2026-10-01');
  });
});

describe('generateTodaySummary', () => {
  it("stores a validated AI sentence with tappable spans, written from the today fact sheet in the character's voice", async () => {
    const user = await consentedUser({ coachPersonaId: 'doze' });
    const { requests, selection } = scripted([GOOD]);

    expect(await generateTodaySummary(user.id, deps(selection))).toBe('ai');

    const row = await rowOf(user.id);
    expect(row).toMatchObject({ text: GOOD, source: 'AI' });
    expect((row!.spans as Array<{ metric?: string }>).filter((s) => s.metric).map((s) => s.metric)).toEqual(['recovery', 'hrv', 'sleep']); // "an early night" is a sleep mention
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req!.messages).toEqual([{ role: 'user', content: TODAY_REQUEST }]);
    expect(req!.maxTokens).toBe(300);
    expect(req!.signal).toBeInstanceOf(AbortSignal);
    expect(req!.system).toContain('"Doze"');
    expect(req!.system).toContain('[recovery.today] Recovery today: 26');
    expect(req!.system).toContain(`At most ${SUMMARY_MAX_WORDS} words`);
  });

  it('regenerates once with a corrective note (never resending the rejected draft), then stores the good one', async () => {
    const user = await consentedUser();
    const long = `${Array.from({ length: 50 }, () => 'calm').join(' ')}.`;
    const { requests, selection } = scripted([long, GOOD]);

    expect(await generateTodaySummary(user.id, deps(selection))).toBe('ai');

    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages).toHaveLength(1);
    expect(requests[1]!.messages[0]!.content).toContain(TODAY_REQUEST);
    expect(requests[1]!.messages[0]!.content).toMatch(/45 words or fewer/);
    expect(requests[1]!.messages[0]!.content).not.toContain('calm calm');
    expect((await rowOf(user.id))!.text).toBe(GOOD);
  });

  it('stores the template when both drafts invent a number', async () => {
    const user = await consentedUser();
    const { requests, selection } = scripted([INVENTED, INVENTED]);

    expect(await generateTodaySummary(user.id, deps(selection))).toBe('template');

    expect(requests).toHaveLength(2);
    expect(await rowOf(user.id)).toMatchObject({ text: templateSentence(LOW_DAY).text, source: 'TEMPLATE' });
  });

  it('stores the template when the model is unreachable', async () => {
    const user = await consentedUser();
    const { selection } = scripted([new Error('ECONNREFUSED')]);
    expect(await generateTodaySummary(user.id, deps(selection))).toBe('template');
    expect((await rowOf(user.id))!.source).toBe('TEMPLATE');
  });

  it('gives up at the budget on a hung model and aborts the call', async () => {
    const user = await consentedUser();
    const { requests, selection } = scripted(['hang']);
    const d = deps(selection);

    const running = generateTodaySummary(user.id, d);
    // Wait (real time: the DB reads before the call are I/O) until the model call is in flight.
    for (let i = 0; i < 400 && requests.length === 0; i++) await new Promise((r) => setTimeout(r, 5));
    await settle();
    expect(requests).toHaveLength(1);
    d.clock.advance(45_000);

    expect(await running).toBe('template');
    expect(requests[0]!.signal!.aborted).toBe(true);
    expect(d.clock.pendingTimers).toBe(0);
  });

  it.each([
    ['the coach is off', 'skipped_disabled'],
    ['there is no coach consent', 'skipped_no_consent'],
  ] as const)('does nothing when %s', async (label, outcome) => {
    const user = label === 'the coach is off' ? await consentedUser() : await createUser();
    if (label === 'the coach is off') process.env.COACH_ENABLED = 'false';
    const { requests, selection } = scripted([GOOD]);
    expect(await generateTodaySummary(user.id, deps(selection))).toBe(outcome);
    expect(requests).toHaveLength(0);
    expect(await rowOf(user.id)).toBeNull();
  });

  it('does nothing without data', async () => {
    const user = await consentedUser();
    const { requests, selection } = scripted([GOOD]);
    expect(await generateTodaySummary(user.id, deps(selection, { loadSheet: async () => EMPTY }))).toBe('skipped_no_data');
    expect(requests).toHaveLength(0);
  });

  it('leaves an existing sentence alone unless forced (the after-sync job forces)', async () => {
    const user = await consentedUser();
    await prisma.coachDaySummary.create({ data: { userId: user.id, date: DAY, text: 'old', spans: [], source: 'AI' } });
    const first = scripted([GOOD]);
    expect(await generateTodaySummary(user.id, deps(first.selection))).toBe('skipped_exists');
    expect(first.requests).toHaveLength(0);

    const forced = scripted([GOOD]);
    expect(await generateTodaySummary(user.id, { ...deps(forced.selection), force: true })).toBe('ai');
    expect((await rowOf(user.id))!.text).toBe(GOOD);
  });

  it('discards a sentence written in the old voice when the character changed mid-generation', async () => {
    const user = await consentedUser({ coachPersonaId: 'hoot' });
    const { selection } = scripted([
      async () => {
        await prisma.user.update({ where: { id: user.id }, data: { coachPersonaId: 'ember' } });
        return GOOD;
      },
    ]);
    expect(await generateTodaySummary(user.id, deps(selection))).toBe('skipped_persona_changed');
    expect(await rowOf(user.id)).toBeNull();
  });

  it('runs once per user when asked twice at the same time', async () => {
    const user = await consentedUser();
    const { requests, selection } = scripted([GOOD, GOOD]);
    const [a, b] = await Promise.all([
      generateTodaySummary(user.id, deps(selection)),
      generateTodaySummary(user.id, deps(selection)),
    ]);
    expect([a, b]).toEqual(['ai', 'ai']);
    expect(requests).toHaveLength(1);
  });
});
