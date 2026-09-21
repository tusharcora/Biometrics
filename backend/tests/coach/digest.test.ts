import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { civilDateToUtcMidnight } from '../../src/biometrics/civilDate';
import { COACH_CONSENT_VERSION } from '../../src/coach/consent';
import { composeDigestFallback, DIGEST_MAX_MODEL_CALLS, runWeeklyDigest, DigestDeps, weekStartOf } from '../../src/coach/digest';
import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';
import { ScriptedProvider, ScriptStep, UnconfiguredProvider, CoachModelProvider } from '../../src/coach/model/provider';
import {
  GENERIC_PUSH_PAYLOADS,
  GenericPushPayload,
  NoopPushSender,
  PushSender,
  PushTarget,
  genericPushPayload,
  sendGenericPush,
} from '../../src/coach/push';
import { coachTools, CoachTools } from '../../src/coach/tools';
import { FakeClock, RecordingTelemetry, createUser, daysAgo, hang, putScore, settle, todayUtc } from './helpers';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
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

class RecordingPushSender implements PushSender {
  calls: Array<{ targets: PushTarget[]; payload: GenericPushPayload }> = [];
  async send(targets: PushTarget[], payload: GenericPushPayload): Promise<void> {
    this.calls.push({ targets, payload });
  }
}

const GOOD_DIGEST =
  'This past week your recovery averaged {{recoveryHistory.average}}, peaking at {{recoveryHistory.highest}}. Keep it steady.';

/** A consented user (default persona: encouraging, threshold-triggered) with 7 days of recovery + sleep scores. */
async function digestUser(opts: { persona?: string | null; consent?: boolean; scores?: boolean } = {}) {
  const user = await createUser();
  if (opts.persona !== undefined) await prisma.user.update({ where: { id: user.id }, data: { coachPersonaId: opts.persona } });
  if (opts.consent !== false) await prisma.coachConsent.create({ data: { userId: user.id, version: COACH_CONSENT_VERSION } });
  if (opts.scores !== false) {
    const recovery = [60, 65, 70, 75, 80, 70, 70]; // average 70, lowest 60, highest 80
    const sleep = [80, 82, 84, 86, 88, 90, 90];
    for (let i = 0; i < 7; i++) {
      await putScore(user.id, daysAgo(6 - i), recovery[i]!, 'RECOVERY');
      await putScore(user.id, daysAgo(6 - i), sleep[i]!, 'SLEEP');
    }
  }
  return user;
}

function setup(script: ScriptStep[] | CoachModelProvider, over: Partial<DigestDeps> = {}) {
  const provider = Array.isArray(script) ? new ScriptedProvider(script) : script;
  const telemetry = new RecordingTelemetry();
  const pushSender = new RecordingPushSender();
  const clock = new FakeClock();
  const deps: DigestDeps = { provider, telemetry, pushSender, clock, ...over };
  return { provider, telemetry, pushSender, clock, deps };
}

const digestsOf = (userId: string) => prisma.coachDigest.findMany({ where: { userId } });
const sweep = (deps: DigestDeps, ...userIds: string[]) => runWeeklyDigest({ ...deps, userIds });

describe('weekStartOf', () => {
  it.each([
    ['2026-09-21', '2026-09-21'], // Monday
    ['2026-09-22', '2026-09-21'],
    ['2026-09-27', '2026-09-21'], // Sunday belongs to the week that started the Monday before
    ['2026-09-20', '2026-09-14'], // Sunday
    ['2026-01-01', '2025-12-29'], // across a year boundary
  ])('%s -> %s', (date, monday) => {
    expect(weekStartOf(date)).toBe(monday);
  });
});

describe('gating', () => {
  it('does nothing when COACH_ENABLED is off: no users read, no model call, no digest, no push', async () => {
    process.env.COACH_ENABLED = 'false';
    const user = await digestUser();
    const { deps, provider, pushSender } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    const summary = await sweep(deps, user.id);

    expect(summary).toEqual({ enabled: false, usersChecked: 0, generated: 0, skipped: 0, failed: 0 });
    expect(provider.callCount).toBe(0);
    expect(await digestsOf(user.id)).toHaveLength(0);
    expect(pushSender.calls).toHaveLength(0);
  });

  it.each([
    ['no consent row', async (id: string) => prisma.coachConsent.deleteMany({ where: { userId: id } })],
    ['revoked consent', async (id: string) => prisma.coachConsent.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } })],
    ['consent for an outdated version', async (id: string) => prisma.coachConsent.updateMany({ where: { userId: id }, data: { version: '0' } })],
  ])('skips a user with %s (no model call, no digest, no push)', async (_label, mutate) => {
    const user = await digestUser();
    await mutate(user.id);
    const { deps, provider, pushSender, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    const summary = await sweep(deps, user.id);

    expect(summary.generated).toBe(0);
    expect(provider.callCount).toBe(0);
    expect(await digestsOf(user.id)).toHaveLength(0);
    expect(pushSender.calls).toHaveLength(0);
    // A user with no valid consent row at all is not even a candidate; an outdated one is skipped by the per-user gate.
    expect(telemetry.named('coach.digest_generated')).toHaveLength(0);
  });

  it.each(['direct', 'clinical'])("skips a 'reactive-only' persona (%s)", async (persona) => {
    const user = await digestUser({ persona });
    const { deps, provider, pushSender, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    const summary = await sweep(deps, user.id);

    expect(summary).toMatchObject({ usersChecked: 1, generated: 0, skipped: 1 });
    expect(provider.callCount).toBe(0);
    expect(await digestsOf(user.id)).toHaveLength(0);
    expect(pushSender.calls).toHaveLength(0);
    expect(telemetry.named('coach.digest_skipped')[0]!.attributes).toEqual({ reason: 'skipped_reactive_only' });
  });

  it('generates for a threshold-triggered persona (the default) and for an unknown stored persona id', async () => {
    const a = await digestUser({ persona: 'encouraging' });
    const b = await digestUser({ persona: 'retired-persona' }); // falls back to the default persona
    const { deps } = setup([
      { type: 'text', text: GOOD_DIGEST },
      { type: 'text', text: GOOD_DIGEST },
    ]);
    const summary = await sweep(deps, a.id, b.id);
    expect(summary.generated).toBe(2);
  });

  it('skips a user with nothing to recap (no scores, no patterns): no model call, no push', async () => {
    const user = await digestUser({ scores: false });
    const { deps, provider, pushSender, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    await sweep(deps, user.id);

    expect(provider.callCount).toBe(0);
    expect(await digestsOf(user.id)).toHaveLength(0);
    expect(pushSender.calls).toHaveLength(0);
    expect(telemetry.named('coach.digest_skipped')[0]!.attributes).toEqual({ reason: 'skipped_no_data' });
  });
});

describe('generation (synthesis tier, grounded)', () => {
  it('stores a validated model recap with the disclaimer and the resolved values, on the synthesis tier', async () => {
    const user = await digestUser();
    const { deps, provider, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    const summary = await sweep(deps, user.id);

    expect(summary).toMatchObject({ enabled: true, usersChecked: 1, generated: 1, failed: 0 });
    const [row] = await digestsOf(user.id);
    expect(row!.text).toBe(
      `This past week your recovery averaged 70, peaking at 80. Keep it steady.\n\n${COACH_DISCLAIMER}`,
    );
    expect(row!.personaId).toBe('encouraging');
    expect(row!.weekStart.toISOString().slice(0, 10)).toBe(weekStartOf(todayUtc()));

    const request = provider.requests[0]!;
    expect(request.tier).toBe('synthesis');
    expect(request.tools.map((t) => t.name)).toEqual(['getScoreHistory', 'getHabitCorrelations']); // no proposeMemory, no writers
    const toolNames = request.messages.flatMap((m) => (m.role === 'tool' ? [m.name] : []));
    expect(toolNames).toEqual(['recoveryHistory', 'sleepHistory', 'getHabitCorrelations']);
    expect(telemetry.named('coach.digest_generated')[0]!.attributes).toMatchObject({ source: 'model', guardrailRejects: 0 });
  });

  it('lets the model reference both metrics and call getScoreHistory itself; results are grounded either way', async () => {
    const user = await digestUser();
    const { deps } = setup([
      { type: 'tool_calls', calls: [{ id: 't1', name: 'getScoreHistory', args: { metric: 'SLEEP', days: 7 } }] },
      { type: 'text', text: 'Recovery averaged {{recoveryHistory.average}}, sleep averaged {{sleepHistory.average}}, ok {{getScoreHistory.highest}}.' },
    ]);
    await sweep(deps, user.id);
    const [row] = await digestsOf(user.id);
    expect(row!.text).toContain('Recovery averaged 70, sleep averaged 85.7, ok 90.');
  });

  it('never runs a writer tool from inside the digest (proposeMemory is refused, nothing stored)', async () => {
    const user = await digestUser();
    const { deps, provider } = setup([
      { type: 'tool_calls', calls: [{ id: 't1', name: 'proposeMemory', args: { category: 'PREFERENCE', value: 'Likes tea' } }] },
      { type: 'text', text: GOOD_DIGEST },
    ]);
    await sweep(deps, user.id);
    expect(await prisma.coachMemory.count({ where: { userId: user.id } })).toBe(0);
    const tool = provider.requests[1]!.messages.filter((m) => m.role === 'tool').pop();
    expect(tool && tool.role === 'tool' && JSON.parse(tool.content)).toEqual({ error: 'unknown_tool' });
  });

  it('an ungrounded first reply is discarded and regenerated once; the regenerated reply is stored', async () => {
    const user = await digestUser();
    const { deps, provider, telemetry } = setup([
      { type: 'text', text: 'Your recovery averaged 72 this week.' }, // unwrapped number
      { type: 'text', text: GOOD_DIGEST },
    ]);
    await sweep(deps, user.id);

    expect(provider.callCount).toBe(2);
    const corrective = provider.requests[1]!.messages.at(-1)!;
    expect(corrective.role === 'system' && corrective.content).toMatch(/discarded/);
    const [row] = await digestsOf(user.id);
    expect(row!.text).toContain('averaged 70');
    expect(row!.text).not.toContain('72');
    expect(telemetry.named('coach.digest_generated')[0]!.attributes).toMatchObject({ source: 'model', guardrailRejects: 1 });
  });

  it.each([
    ['unwrapped numbers', 'You slept 8 hours on average.'],
    ['a ratio', 'Recovery was 7/10 this week.'],
    ['a bad field path', 'Recovery averaged {{recoveryHistory.median}}.'],
  ])('two consecutive rejections (%s) fall back to the server-composed digest, never an ungrounded one', async (_l, bad) => {
    const user = await digestUser();
    const { deps, provider, telemetry } = setup([
      { type: 'text', text: bad },
      { type: 'text', text: bad },
    ]);
    await sweep(deps, user.id);

    expect(provider.callCount).toBe(2); // exactly one regenerate, nothing more
    const [row] = await digestsOf(user.id);
    expect(row!.text).toBe(
      `Here's your weekly recap.\n` +
        `Recovery Score: averaged 70 over the past week, from a low of 60 to a high of 80.\n` +
        `Sleep Score: averaged 85.7, from a low of 80 to a high of 90.\n\n${COACH_DISCLAIMER}`,
    );
    expect(row!.text).not.toContain(bad);
    expect(row!.text).not.toMatch(/\{\{|\}\}/);
    expect(telemetry.named('coach.digest_generated')[0]!.attributes).toMatchObject({ source: 'fallback', guardrailRejects: 2 });
  });

  it('falls back when the provider is unconfigured or throws (the shipped default provider)', async () => {
    const user = await digestUser();
    const { deps } = setup(new UnconfiguredProvider());
    await sweep(deps, user.id);
    const [row] = await digestsOf(user.id);
    expect(row!.text).toContain('averaged 70');
  });

  it('falls back when the model call limit is hit by endless tool calls', async () => {
    const user = await digestUser();
    const loop: ScriptStep = { type: 'tool_calls', calls: [{ id: 'x', name: 'getHabitCorrelations', args: {} }] };
    const { deps, provider } = setup(Array.from({ length: DIGEST_MAX_MODEL_CALLS + 2 }, () => loop));
    await sweep(deps, user.id);
    expect(provider.callCount).toBe(DIGEST_MAX_MODEL_CALLS);
    expect((await digestsOf(user.id))[0]!.text).toContain('weekly recap');
  });

  it('falls back on a timeout and leaves no timer behind', async () => {
    const user = await digestUser();
    const { deps, clock } = setup([hang]); // a never-settling provider call
    const running = sweep(deps, user.id);
    // Wait (on real time, bounded) until the digest generation has armed its budget timer.
    for (let i = 0; i < 500 && clock.pendingTimers === 0; i++) await new Promise((r) => setTimeout(r, 10));
    await settle();
    expect(clock.pendingTimers).toBe(1);
    clock.advance(61_000);
    const summary = await running;

    expect(summary.generated).toBe(1);
    expect((await digestsOf(user.id))[0]!.text).toContain('weekly recap');
    expect(clock.pendingTimers).toBe(0);
  });

  it('cancels its timer after a normal run', async () => {
    const user = await digestUser();
    const { deps, clock } = setup([{ type: 'text', text: GOOD_DIGEST }]);
    await sweep(deps, user.id);
    expect(clock.pendingTimers).toBe(0);
  });

  it('the fallback includes confirmed habit patterns as grounded fields', async () => {
    const user = await digestUser({ scores: false });
    const tools: CoachTools = {
      ...coachTools,
      run: async (u, name, args, ctx) =>
        name === 'getHabitCorrelations'
          ? {
              ok: true,
              result: {
                correlations: [
                  { habitType: 'caffeine', habitLabel: 'Late caffeine', factor: 'HRV', direction: 'lower', effectSizePercent: 12.5, sampleSize: 30 },
                ],
              },
            }
          : coachTools.run(u, name, args, ctx),
    };
    const { deps } = setup(new UnconfiguredProvider(), { tools });
    await sweep(deps, user.id);
    expect((await digestsOf(user.id))[0]!.text).toContain(
      'Pattern: Late caffeine is linked to lower HRV (12.5 percent, across 30 days of data).',
    );
  });

  it('composeDigestFallback has no digits outside resolved values and returns null with no material', () => {
    expect(composeDigestFallback([])).toBeNull();
    expect(composeDigestFallback([{ name: 'recoveryHistory', result: { points: [], average: null } }])).toBeNull();
  });
});

describe('idempotency per user and week', () => {
  it('a second run in the same week creates no second digest, calls no model, sends no second push', async () => {
    const user = await digestUser();
    await prisma.pushToken.create({ data: { userId: user.id, token: `t-${user.id}`, platform: 'ios' } });
    const { deps, provider, pushSender } = setup([{ type: 'text', text: GOOD_DIGEST }, { type: 'text', text: GOOD_DIGEST }]);

    await sweep(deps, user.id);
    const again = await sweep(deps, user.id);

    expect(await digestsOf(user.id)).toHaveLength(1);
    expect(again).toMatchObject({ generated: 0, skipped: 1 });
    expect(provider.callCount).toBe(1);
    expect(pushSender.calls).toHaveLength(1);
  });

  it('a digest from an earlier week does not block this week\'s', async () => {
    const user = await digestUser();
    await prisma.coachDigest.create({
      data: {
        userId: user.id,
        text: 'last week',
        personaId: 'encouraging',
        weekStart: civilDateToUtcMidnight(weekStartOf(daysAgo(7))),
      },
    });
    const { deps } = setup([{ type: 'text', text: GOOD_DIGEST }]);
    await sweep(deps, user.id);
    expect(await digestsOf(user.id)).toHaveLength(2);
  });

  it('two racing runs keep exactly one digest and only the winner pushes (unique key)', async () => {
    const user = await digestUser();
    await prisma.pushToken.create({ data: { userId: user.id, token: `t-${user.id}`, platform: 'ios' } });
    await prisma.coachDigest.create({
      data: { userId: user.id, text: 'already here', personaId: 'encouraging', weekStart: civilDateToUtcMidnight(weekStartOf(todayUtc())) },
    });
    // Simulate the loser of a race: the pre-check saw nothing, the insert hits the unique key.
    jest.spyOn(prisma.coachDigest, 'findUnique').mockResolvedValueOnce(null);
    const { deps, pushSender } = setup([{ type: 'text', text: GOOD_DIGEST }]);

    const summary = await sweep(deps, user.id);

    expect(summary).toMatchObject({ generated: 0, skipped: 1, failed: 0 });
    expect(await digestsOf(user.id)).toHaveLength(1);
    expect((await digestsOf(user.id))[0]!.text).toBe('already here');
    expect(pushSender.calls).toHaveLength(0);
  });
});

describe('push content is generic', () => {
  const ALLOWED = new Set(Object.values(GENERIC_PUSH_PAYLOADS).flatMap((p) => [p.title, p.body]));

  it('the fixed strings from the spec are in the set and none contains a digit', () => {
    expect(GENERIC_PUSH_PAYLOADS.weekly_digest.title).toBe('Your weekly recap is ready');
    expect(GENERIC_PUSH_PAYLOADS.insight.title).toBe('You have a new insight');
    for (const s of ALLOWED) expect(s).not.toMatch(/\d/);
  });

  it('the digest push is always one of the fixed payloads, whatever the digest text or health values are', async () => {
    const user = await digestUser();
    await prisma.pushToken.createMany({
      data: [
        { userId: user.id, token: `ios-${user.id}`, platform: 'ios' },
        { userId: user.id, token: `and-${user.id}`, platform: 'android' },
      ],
    });
    // A digest text and scores full of digits, names and health values.
    const { deps, pushSender } = setup([
      { type: 'text', text: 'Your recovery averaged {{recoveryHistory.average}} and HRV fell to {{recoveryHistory.lowest}}.' },
    ]);

    await sweep(deps, user.id);

    expect(pushSender.calls).toHaveLength(1);
    const { targets, payload } = pushSender.calls[0]!;
    expect(payload).toEqual({ kind: 'weekly_digest', ...GENERIC_PUSH_PAYLOADS.weekly_digest });
    expect(ALLOWED.has(payload.title)).toBe(true);
    expect(ALLOWED.has(payload.body)).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/\d/);
    expect(JSON.stringify(payload)).not.toMatch(/recovery|hrv|score|habit|average/i);
    expect(targets.map((t) => t.platform).sort()).toEqual(['android', 'ios']);
  });

  it('sendGenericPush takes a kind, not text: the payload cannot carry anything else', async () => {
    const user = await createUser();
    await prisma.pushToken.create({ data: { userId: user.id, token: `k-${user.id}`, platform: 'ios' } });
    const sender = new RecordingPushSender();
    // @ts-expect-error a free-text kind is a compile error; at runtime it would be an unknown table key
    await expect(sendGenericPush(sender, user.id, 'Your HRV dropped to 41')).rejects.toThrow('unknown_push_kind');
    expect(sender.calls).toHaveLength(0);

    expect(await sendGenericPush(sender, user.id, 'insight')).toBe(1);
    expect(sender.calls[0]!.payload).toEqual({ kind: 'insight', ...GENERIC_PUSH_PAYLOADS.insight });
    expect(genericPushPayload('weekly_digest')).toEqual({ kind: 'weekly_digest', ...GENERIC_PUSH_PAYLOADS.weekly_digest });
  });

  it('mutating a returned payload cannot change the fixed table', () => {
    const p = genericPushPayload('weekly_digest');
    p.title = 'Your HRV is 41';
    expect(genericPushPayload('weekly_digest').title).toBe('Your weekly recap is ready');
    expect(() => {
      (GENERIC_PUSH_PAYLOADS.weekly_digest as { title: string }).title = 'x';
    }).toThrow();
  });

  it('is never called for a user with no registered device', async () => {
    const user = await digestUser();
    const { deps, pushSender } = setup([{ type: 'text', text: GOOD_DIGEST }]);
    await sweep(deps, user.id);
    expect(pushSender.calls).toHaveLength(0);
  });

  it('a push failure does not undo or repeat the stored digest', async () => {
    const user = await digestUser();
    await prisma.pushToken.create({ data: { userId: user.id, token: `f-${user.id}`, platform: 'ios' } });
    const failing: PushSender = { send: async () => { throw new TypeError('provider down: secret text'); } };
    const { deps, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }], { pushSender: failing });

    const summary = await sweep(deps, user.id);

    expect(summary).toMatchObject({ generated: 1, failed: 0 });
    expect(await digestsOf(user.id)).toHaveLength(1);
    expect(telemetry.named('coach.push_failed')[0]!.attributes).toEqual({ kind: 'weekly_digest', error: 'TypeError' });
    expect(JSON.stringify(telemetry.events)).not.toContain('secret text');
  });

  it('the NoopPushSender delivers nothing', async () => {
    await expect(new NoopPushSender().send()).resolves.toBeUndefined();
  });

  it('no code path in src/coach hands anything but sendGenericPush to a PushSender', () => {
    const dir = path.join(__dirname, '../../src/coach');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(path.join(d, e.name));
        else if (e.name.endsWith('.ts')) files.push(path.join(d, e.name));
      }
    };
    walk(dir);
    const senderCalls = files.filter((f) => /(pushSender|sender)\.send\(/.test(fs.readFileSync(f, 'utf8')));
    expect(senderCalls.map((f) => path.basename(f))).toEqual(['push.ts']);
    const usage = files.filter((f) => /sendGenericPush\(/.test(fs.readFileSync(f, 'utf8')) && !f.endsWith('push.ts'));
    for (const f of usage) {
      // Every call site passes a string-literal kind.
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/sendGenericPush\(([^)]*)\)/g)) {
        expect(m[1]).toMatch(/,\s*'(weekly_digest|insight)'\s*$/);
      }
    }
  });
});

describe('sweep robustness and telemetry', () => {
  it('one user failing does not stop the sweep; the failure is reported by error name only', async () => {
    const a = await digestUser();
    const b = await digestUser();
    const tools: CoachTools = {
      ...coachTools,
      run: async (u, name, args, ctx) => {
        if (u === a.id) throw new RangeError('boom with private text');
        return coachTools.run(u, name, args, ctx);
      },
    };
    const { deps, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }], { tools });

    const summary = await sweep(deps, a.id, b.id);

    expect(summary).toMatchObject({ usersChecked: 2, generated: 1, failed: 1 });
    expect(await digestsOf(a.id)).toHaveLength(0);
    expect(await digestsOf(b.id)).toHaveLength(1);
    expect(telemetry.named('coach.digest_failed')[0]!.attributes).toEqual({ error: 'RangeError' });
    expect(JSON.stringify(telemetry.events)).not.toContain('private text');
  });

  it('digest telemetry carries ids and counts only, never the digest text', async () => {
    const user = await digestUser();
    const { deps, telemetry } = setup([{ type: 'text', text: GOOD_DIGEST }]);
    await sweep(deps, user.id);
    const serialized = JSON.stringify(telemetry.events);
    expect(serialized).not.toContain('averaged');
    expect(serialized).not.toContain('Keep it steady');
    expect(telemetry.events.every((e) => e.userId === user.id && e.personaId === 'encouraging')).toBe(true);
  });
});
