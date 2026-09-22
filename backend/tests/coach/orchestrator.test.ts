import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { createCoachOrchestrator, MAX_MODEL_CALLS, OrchestratorDeps } from '../../src/coach/orchestrator';
import { ScriptedProvider, ScriptStep, UnconfiguredProvider, CoachModelProvider } from '../../src/coach/model/provider';
import { coachTools } from '../../src/coach/tools';
import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';
import { STATIC_FALLBACK } from '../../src/coach/fallback';
import { FakeClock, RecordingTelemetry, createUser, daysAgo, hang, putScore, settle, todayUtc } from './helpers';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const GOOD = 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.';

async function seededUser() {
  const user = await createUser();
  await putScore(user.id, daysAgo(1), 75);
  await putScore(user.id, todayUtc(), 72.4);
  return user;
}

function setup(provider: CoachModelProvider, over: Partial<OrchestratorDeps> = {}) {
  const clock = new FakeClock();
  const telemetry = new RecordingTelemetry();
  const orchestrator = createCoachOrchestrator({ provider, telemetry, clock, ...over });
  return { clock, telemetry, orchestrator };
}

const turn = (userId: string, message = 'why is my recovery lower today', extra: object = {}) => ({
  userId,
  message,
  history: [],
  ...extra,
});

describe('turn preamble', () => {
  it('pre-fetches today\'s score before the first model call and makes it valid for {{}} resolution', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator } = setup(provider);

    const result = await orchestrator.handleTurn(turn(user.id));

    expect(result.source).toBe('MODEL');
    expect(result.text).toBe(`Your recovery is 72.4, lower than yesterday.\n\n${COACH_DISCLAIMER}`);
    // The model made no tool call of its own: the value came from the preamble.
    expect(provider.callCount).toBe(1);
    const messages = provider.requests[0]!.messages;
    const toolMsg = messages.find((m) => m.role === 'tool');
    expect(toolMsg && toolMsg.role === 'tool' && JSON.parse(toolMsg.content)).toMatchObject({
      date: todayUtc(),
      recoveryScore: 72.4,
      deltaFromYesterday: -2.6,
      direction: 'lower',
    });
  });

  it('runs fresh on every turn (never carried over)', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      { type: 'text', text: GOOD },
      { type: 'text', text: GOOD },
    ]);
    const { orchestrator } = setup(provider);

    const first = await orchestrator.handleTurn(turn(user.id));
    await prisma.dailyScore.updateMany({
      where: { userId: user.id, type: 'RECOVERY', date: new Date(`${todayUtc()}T00:00:00Z`) },
      data: { score: 80 },
    });
    const second = await orchestrator.handleTurn(turn(user.id));

    expect(first.text).toContain('72.4');
    expect(second.text).toContain('Your recovery is 80, higher than yesterday.');
  });

  it('uses the user\'s local civil date (User.timezone) as today', async () => {
    const user = await createUser({ timezone: 'Pacific/Kiritimati' }); // UTC+14
    const provider = new ScriptedProvider([{ type: 'text', text: 'Hello.' }]);
    const { orchestrator } = setup(provider);
    await orchestrator.handleTurn(turn(user.id));
    const tool = provider.requests[0]!.messages.find((m) => m.role === 'tool');
    const date = tool && tool.role === 'tool' ? JSON.parse(tool.content).date : null;
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(new Date());
    expect(date).toBe(expected);
  });
});

describe('model loop and tool calls', () => {
  it('executes tool calls server-side, feeds results back, and resolves refs against them', async () => {
    const user = await seededUser();
    await putScore(user.id, daysAgo(2), 60);
    const provider = new ScriptedProvider([
      { type: 'tool_calls', calls: [{ id: 'c1', name: 'getScoreHistory', args: { metric: 'RECOVERY', days: 7 } }] },
      { type: 'text', text: 'Over the week your average was {{getScoreHistory.average}}.' },
    ]);
    const { orchestrator, telemetry } = setup(provider);

    const result = await orchestrator.handleTurn(turn(user.id));

    expect(result.text).toContain('Over the week your average was 69.1.'); // (60 + 75 + 72.4) / 3
    expect(provider.callCount).toBe(2);
    const toolMsgs = provider.requests[1]!.messages.filter((m) => m.role === 'tool');
    expect(toolMsgs.map((m) => (m.role === 'tool' ? m.name : ''))).toEqual(['getDailyScore', 'getScoreHistory']);
    const calls = telemetry.named('coach.tool_call');
    expect(calls.map((c) => c.attributes.tool)).toEqual(['getDailyScore', 'getScoreHistory']);
    expect(calls.every((c) => c.userId === user.id && c.personaId === 'encouraging')).toBe(true);
    expect(calls[1]!.attributes.ok).toBe(true);
  });

  it('an unknown tool or bad arguments yields an error tool message, not a crash or a resolvable value', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      {
        type: 'tool_calls',
        calls: [
          { id: 'a', name: 'dropTables', args: {} },
          { id: 'b', name: 'getScoreHistory', args: { metric: 'HRV', days: 'many' } },
        ],
      },
      { type: 'text', text: 'Sorry, I could not look that up.' },
    ]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('MODEL');
    const errs = provider.requests[1]!.messages.filter((m) => m.role === 'tool' && m.toolCallId !== 'preamble-getDailyScore');
    expect(errs.map((m) => (m.role === 'tool' ? JSON.parse(m.content) : null))).toEqual([
      { error: 'unknown_tool' },
      { error: 'invalid_arguments' },
    ]);
    expect(telemetry.named('coach.tool_call').filter((e) => e.attributes.ok === false).length).toBeGreaterThanOrEqual(2);
  });

  it('bounds model calls per turn and falls back instead of looping forever', async () => {
    const user = await seededUser();
    const loop: ScriptStep = { type: 'tool_calls', calls: [{ id: 'x', name: 'getUserGoals', args: {} }] };
    const provider = new ScriptedProvider(Array.from({ length: MAX_MODEL_CALLS + 5 }, () => loop));
    const { orchestrator } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('FALLBACK');
    expect(provider.callCount).toBe(MAX_MODEL_CALLS);
  });

  it('routes recap-style requests to the synthesis tier and single-turn Q&A to the fast tier', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      { type: 'text', text: 'Fine.' },
      { type: 'text', text: 'Fine.' },
    ]);
    const { orchestrator } = setup(provider);
    const fast = await orchestrator.handleTurn(turn(user.id, 'what was my HRV yesterday'));
    const synth = await orchestrator.handleTurn(turn(user.id, 'give me a weekly recap'));
    expect(fast.tier).toBe('fast');
    expect(synth.tier).toBe('synthesis');
    expect(provider.requests.map((r) => r.tier)).toEqual(['fast', 'synthesis']);
  });

  it('builds the system prompt from the user\'s chosen persona', async () => {
    const user = await seededUser();
    await prisma.user.update({ where: { id: user.id }, data: { coachPersonaId: 'direct' } });
    const provider = new ScriptedProvider([{ type: 'text', text: 'Fine.' }]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.personaId).toBe('direct');
    expect(provider.requests[0]!.system).toContain('"Direct"');
    expect(telemetry.events.every((e) => e.personaId === 'direct')).toBe(true);
  });

  it('replays windowed history to the model without the server-added disclaimer', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: 'Fine.' }]);
    const { orchestrator } = setup(provider);
    await orchestrator.handleTurn({
      userId: user.id,
      message: 'and today?',
      history: [
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: `Hello there.\n\n${COACH_DISCLAIMER}` },
      ],
    });
    const msgs = provider.requests[0]!.messages;
    expect(msgs.slice(0, 3)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello there.' },
      { role: 'user', content: 'and today?' },
    ]);
  });
});

describe('guardrail: reject, regenerate once', () => {
  const MUST_REJECT: Array<[string, string]> = [
    ['a bare count', 'Here are 3 tips for tonight.'],
    ['a unit-suffixed value (hours)', 'You slept about 8 hours.'],
    ['a unit-suffixed value (ms)', 'Your HRV is 42ms.'],
    ['a percentage', 'That is a 12% drop.'],
    ['a ratio', 'You are at 7/10 today.'],
    ['a bare h:mm duration', 'You slept 7:32 last night.'],
    ['"5 amazing tips"', 'Here are 5 amazing tips.'],
    ['a digit adjacent to an exempt span', 'Try 10pm for 8 hours.'],
  ];

  it.each(MUST_REJECT)('rejects %s, regenerates once with a corrective message, then accepts', async (_l, bad) => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      { type: 'text', text: bad },
      { type: 'text', text: GOOD },
    ]);
    const { orchestrator, telemetry } = setup(provider);

    const result = await orchestrator.handleTurn(turn(user.id));

    expect(provider.callCount).toBe(2);
    expect(result.source).toBe('MODEL');
    expect(result.text).toContain('Your recovery is 72.4, lower than yesterday.');
    expect(result.text).not.toContain(bad);
    const rejects = telemetry.named('coach.guardrail_reject');
    expect(rejects).toHaveLength(1);
    expect(rejects[0]!.attributes).toMatchObject({ reason: 'unwrapped_number', attempt: 1, outcome: 'regenerate' });
    expect(rejects[0]!.userId).toBe(user.id);
    expect(rejects[0]!.personaId).toBe('encouraging');
    // The corrective system message is sent; the discarded text is not.
    const second = provider.requests[1]!.messages;
    expect(second[second.length - 1]).toMatchObject({ role: 'system' });
    expect(JSON.stringify(second)).not.toContain(bad);
    expect(result.events).toEqual([{ type: 'guardrail_reject', reason: 'unwrapped_number', attempt: 1, outcome: 'regenerate' }]);
  });

  it('a {{ref}} to a nonexistent path is rejected and logged as invalid_field_path, distinct from unwrapped_number', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      { type: 'text', text: 'Your HRV is {{getDailyScore.hrv.deltaFromLastWeek}}.' },
      { type: 'text', text: GOOD },
    ]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('MODEL');
    const rejects = telemetry.named('coach.guardrail_reject');
    expect(rejects.map((r) => r.attributes.reason)).toEqual(['invalid_field_path']);
  });

  it.each([
    ['a line-start list marker', 'Try this:\n1. Sleep earlier tonight.'],
    ['"10pm"', 'Try winding down by 10pm.'],
    ['"10:30 pm"', 'Lights out around 10:30 pm.'],
    ['"March 14"', 'Since March 14 you have improved.'],
    ['"the 14th"', 'On the 14th you slept well.'],
    ['a fully resolved sentence', GOOD],
  ])('accepts %s on the first attempt with no regenerate', async (_l, text) => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text }]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('MODEL');
    expect(provider.callCount).toBe(1);
    expect(telemetry.named('coach.guardrail_reject')).toHaveLength(0);
  });

  it('two consecutive rejections return the preamble fallback and log a guardrail event, not a latency event', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([
      { type: 'text', text: 'Take 3 naps.' },
      { type: 'text', text: 'Take {{getDailyScore.nope}} naps.' },
    ]);
    const { orchestrator, telemetry } = setup(provider);

    const result = await orchestrator.handleTurn(turn(user.id));

    expect(provider.callCount).toBe(2);
    expect(result.source).toBe('FALLBACK');
    expect(result.text).toBe(
      `Your recovery score today is 72.4, lower than yesterday. I couldn't put together a fuller answer just now.\n\n${COACH_DISCLAIMER}`,
    );
    expect(telemetry.named('coach.guardrail_reject').map((e) => [e.attributes.reason, e.attributes.attempt, e.attributes.outcome])).toEqual([
      ['unwrapped_number', 1, 'regenerate'],
      ['invalid_field_path', 2, 'fallback'],
    ]);
    expect(telemetry.named('coach.latency_budget_exceeded')).toHaveLength(0);
    expect(telemetry.named('coach.turn_fallback')[0]!.attributes.reason).toBe('guardrail');
  });

  it('does not stream: the returned text is the resolved reply, never raw {{}} syntax', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.text).not.toMatch(/\{\{|\}\}/);
  });
});

describe('latency budget (12s, injectable clock)', () => {
  it('a timeout before any tool call returns the preamble fallback with no further model call', async () => {
    const user = await seededUser();
    const clock = new FakeClock();
    const telemetry = new RecordingTelemetry();
    const provider = new ScriptedProvider([
      () => {
        clock.advance(12_000);
        return hang();
      },
      { type: 'text', text: GOOD },
    ]);
    const orchestrator = createCoachOrchestrator({ provider, telemetry, clock });

    const result = await orchestrator.handleTurn(turn(user.id));
    await settle();

    expect(result.source).toBe('FALLBACK');
    expect(result.text).toContain('Your recovery score today is 72.4, lower than yesterday.');
    expect(provider.callCount).toBe(1); // the hung call only: nothing after the budget expired
    expect(telemetry.named('coach.latency_budget_exceeded')).toHaveLength(1);
    expect(telemetry.named('coach.guardrail_reject')).toHaveLength(0);
    expect(result.events).toEqual([{ type: 'latency_budget_exceeded' }]);
    expect(clock.pendingTimers).toBe(0);
  });

  it('the same holds when the budget expires mid-regenerate', async () => {
    const user = await seededUser();
    const clock = new FakeClock();
    const telemetry = new RecordingTelemetry();
    const provider = new ScriptedProvider([
      { type: 'text', text: 'Here are 3 tips.' },
      () => {
        clock.advance(12_000);
        return hang();
      },
      { type: 'text', text: GOOD },
    ]);
    const orchestrator = createCoachOrchestrator({ provider, telemetry, clock });

    const result = await orchestrator.handleTurn(turn(user.id));
    await settle();

    expect(result.source).toBe('FALLBACK');
    expect(result.text).toContain('Your recovery score today is 72.4');
    expect(provider.callCount).toBe(2);
    expect(telemetry.named('coach.latency_budget_exceeded')).toHaveLength(1);
    // The first attempt's rejection was real and is logged; there is no second-rejection fallback.
    expect(telemetry.named('coach.guardrail_reject')).toHaveLength(1);
    expect(telemetry.named('coach.guardrail_reject')[0]!.attributes.outcome).toBe('regenerate');
  });

  it('does not run a tool call that would start after expiry, and makes no further model call', async () => {
    const user = await seededUser();
    const clock = new FakeClock();
    const telemetry = new RecordingTelemetry();
    let resolveSlow: (v: any) => void = () => {};
    const provider = new ScriptedProvider([
      () => {
        clock.advance(12_000);
        return new Promise((resolve) => {
          resolveSlow = resolve;
        });
      },
      { type: 'text', text: GOOD },
    ]);
    const orchestrator = createCoachOrchestrator({ provider, telemetry, clock });
    const result = await orchestrator.handleTurn(turn(user.id));
    // The hung provider now answers late with a tool call: the expired turn must ignore it.
    resolveSlow({ type: 'tool_calls', calls: [{ id: 'late', name: 'getUserGoals', args: {} }] });
    await settle();
    expect(result.source).toBe('FALLBACK');
    expect(provider.callCount).toBe(1);
    expect(telemetry.named('coach.tool_call').filter((e) => e.attributes.tool === 'getUserGoals')).toHaveLength(0);
  });

  it('a zero budget expires immediately without calling the model at all', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator, telemetry } = setup(provider, { budgets: { fast: 0 } });
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('FALLBACK');
    expect(provider.callCount).toBe(0);
    expect(telemetry.named('coach.latency_budget_exceeded')).toHaveLength(1);
  });

  it('cancels its timer when the turn finishes in time', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator, clock } = setup(provider);
    await orchestrator.handleTurn(turn(user.id));
    expect(clock.pendingTimers).toBe(0);
  });
});

describe('fallback material', () => {
  it('with no score today, uses the most recent score and states its date', async () => {
    const user = await createUser();
    await putScore(user.id, daysAgo(3), 61);
    const { orchestrator } = setup(new UnconfiguredProvider());
    const result = await orchestrator.handleTurn(turn(user.id));
    const d = new Date(`${daysAgo(3)}T00:00:00Z`);
    const label = `${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCDate()}`;
    expect(result.source).toBe('FALLBACK');
    expect(result.text).toBe(
      `I don't have a recovery score for today yet. Your most recent one, from ${label}, is 61. I couldn't put together a fuller answer just now.\n\n${COACH_DISCLAIMER}`,
    );
  });

  it('a cold-start row (null score) for today counts as no score today', async () => {
    const user = await createUser();
    await putScore(user.id, todayUtc(), null);
    await putScore(user.id, daysAgo(2), 55);
    const { orchestrator } = setup(new UnconfiguredProvider());
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.text).toContain('Your most recent one, from');
    expect(result.text).toContain('is 55.');
  });

  it('a user with no score at all gets the static no-numbers message', async () => {
    const user = await createUser();
    const { orchestrator } = setup(new UnconfiguredProvider());
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('FALLBACK');
    expect(result.text).toBe(`${STATIC_FALLBACK}\n\n${COACH_DISCLAIMER}`);
    expect(result.text).not.toMatch(/\d/);
  });

  it('a failed pre-fetch gets the static no-numbers message (and the model is still tried)', async () => {
    const user = await seededUser();
    const failing = { ...coachTools, getDailyScore: async () => { throw new Error('db down'); } };
    const provider = new ScriptedProvider([{ type: 'text', text: 'Take 3 naps.' }, { type: 'text', text: 'Still 3 naps.' }]);
    const { orchestrator, telemetry } = setup(provider, { tools: failing });
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('FALLBACK');
    expect(result.text).toBe(`${STATIC_FALLBACK}\n\n${COACH_DISCLAIMER}`);
    expect(result.text).not.toMatch(/\d/);
    expect(telemetry.named('coach.tool_call')[0]!.attributes).toMatchObject({ tool: 'getDailyScore', ok: false, preamble: true });
    // No preamble tool result was offered to the model.
    expect(provider.requests[0]!.messages.some((m) => m.role === 'tool')).toBe(false);
  });

  it('an unchanged score reads "unchanged from yesterday"; no yesterday omits the comparison', async () => {
    const same = await createUser();
    await putScore(same.id, daysAgo(1), 70);
    await putScore(same.id, todayUtc(), 70);
    const lone = await createUser();
    await putScore(lone.id, todayUtc(), 66.5);
    const { orchestrator } = setup(new UnconfiguredProvider());
    expect((await orchestrator.handleTurn(turn(same.id))).text).toContain('Your recovery score today is 70, unchanged from yesterday.');
    expect((await orchestrator.handleTurn(turn(lone.id))).text).toContain('Your recovery score today is 66.5. I couldn\'t');
  });

  it('a provider that is not configured degrades to the fallback, never an error', async () => {
    const user = await seededUser();
    const { orchestrator, telemetry } = setup(new UnconfiguredProvider());
    const result = await orchestrator.handleTurn(turn(user.id));
    expect(result.source).toBe('FALLBACK');
    expect(telemetry.named('coach.turn_fallback')[0]!.attributes.reason).toBe('provider_not_configured');
  });

  it('a provider that throws (with message text in the error) falls back and never logs the error message', async () => {
    const user = await seededUser();
    const SECRET = 'my-private-question-sentinel';
    const provider = new ScriptedProvider([
      () => {
        throw new TypeError(`upstream echoed: ${SECRET}`);
      },
    ]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id, SECRET));
    expect(result.source).toBe('FALLBACK');
    expect(JSON.stringify(telemetry.events)).not.toContain(SECRET);
  });
});

describe('pre-request crisis classifier', () => {
  it('routes a flagged message to the fixed safety reply without touching the model', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id, 'I want to kill myself'));
    expect(result.source).toBe('SAFETY');
    expect(result.safety?.canContinue).toBe(true);
    expect(result.safety?.resources.join(' ')).toMatch(/988/);
    expect(result.text.endsWith(COACH_DISCLAIMER)).toBe(true);
    expect(provider.callCount).toBe(0);
    expect(telemetry.named('coach.safety_classifier')[0]!.attributes).toMatchObject({ triggered: true, overridden: false });
  });

  // Privacy: the event is keyed to a userId, so naming the matched category
  // persisted "this user said something self-harm-shaped" into application
  // logs -- which outlive the 90-day coach transcript retention and are often
  // shipped off to a third-party aggregator.
  it('does not record which crisis category fired against the user', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([]);
    const { orchestrator, telemetry } = setup(provider);

    await orchestrator.handleTurn(turn(user.id, 'I want to kill myself'));

    const event = telemetry.named('coach.safety_classifier')[0]!;
    expect(event.attributes).toMatchObject({ triggered: true });
    expect(Object.keys(event.attributes)).not.toContain('categories');
    expect(JSON.stringify(event.attributes)).not.toMatch(/self_harm/);
  });

  it('flags borderline phrasing (biased toward false positives)', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([]);
    const { orchestrator } = setup(provider);
    for (const message of ['my heart is racing and my score is low', 'should I take melatonin tonight']) {
      expect((await orchestrator.handleTurn(turn(user.id, message))).source).toBe('SAFETY');
    }
    expect(provider.callCount).toBe(0);
  });

  it('safetyOverride skips the classifier for that message but is still telemetry-logged', async () => {
    const user = await seededUser();
    const provider = new ScriptedProvider([{ type: 'text', text: GOOD }]);
    const { orchestrator, telemetry } = setup(provider);
    const result = await orchestrator.handleTurn(turn(user.id, 'my heart rate variability dropped, why', { safetyOverride: true }));
    const flagged = await orchestrator.handleTurn(turn(user.id, 'should I take melatonin', { safetyOverride: true }));
    expect(result.source).toBe('MODEL');
    expect(flagged.source === 'MODEL' || flagged.source === 'FALLBACK').toBe(true); // provider script exhausted -> fallback
    expect(provider.callCount).toBeGreaterThanOrEqual(1);
    const events = telemetry.named('coach.safety_classifier');
    expect(events).toHaveLength(2);
    expect(events[1]!.attributes).toMatchObject({ triggered: true, overridden: true });
  });
});

describe('logging discipline', () => {
  it('telemetry never carries message text or tool results', async () => {
    const user = await seededUser();
    const SENTINEL = 'zebra-sentinel-question';
    const provider = new ScriptedProvider([
      { type: 'tool_calls', calls: [{ id: 'c', name: 'getUserGoals', args: {} }] },
      { type: 'text', text: 'Take 3 naps.' },
      { type: 'text', text: GOOD },
    ]);
    const { orchestrator, telemetry } = setup(provider);
    await orchestrator.handleTurn(turn(user.id, `${SENTINEL} why is my score low`));
    const blob = JSON.stringify(telemetry.events);
    expect(blob).not.toContain(SENTINEL);
    expect(blob).not.toContain('72.4');
    expect(blob).not.toContain('naps');
  });
});
