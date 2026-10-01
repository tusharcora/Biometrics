// The CI gate for the coach eval harness (spec 2026-09-30, section 7): every
// fixture runs through the real answer pipeline with a ScriptedStreamProvider,
// and the must-fail fixtures must be caught on their named check. Also
// unit-tests the direction, attribution and quality checkers on their own.
// Hermetic: no network and no model (the real-model run is
// `npm run eval:coach:local`, never part of this suite).

import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { checkAttribution } from '../../evals/coach/attributionCheck';
import { checkDirectionalClaims, directionOf, extractDirectionalClaims } from '../../evals/coach/directionCheck';
import { FIXTURES, NEGATIVE_FIXTURES } from '../../evals/coach/fixtures';
import { LOW_DAY } from '../../evals/coach/fixtures/common';
import { checkQuality, isNextStep } from '../../evals/coach/qualityCheck';
import { runEval, runFixture, runNegativeFixtures } from '../../evals/coach/runner';
import type { EvalFixture, NegativeFixture } from '../../evals/coach/types';
import type { FactSheet } from '../../src/coach/answer/facts';
import { routeQuestion } from '../../src/coach/answer/route';
import { validateSentence } from '../../src/coach/answer/validate';
import { listPersonas } from '../../src/coach/personas';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('directional-claim checker', () => {
  it('reads the direction of a fact against its usual', () => {
    expect(directionOf({ value: 26, usual: 58 })).toBe('lower');
    expect(directionOf({ value: 58, usual: 55 })).toBe('higher');
    expect(directionOf({ value: 41, usual: 41 })).toBe('unchanged');
    expect(directionOf({ value: 41 })).toBeNull();
  });

  it('passes prose that agrees, and a reply with no directional language at all', () => {
    expect(checkDirectionalClaims('Recovery is 26, well under your usual 58.', 'lower').ok).toBe(true);
    expect(checkDirectionalClaims('Right where you usually are, nice and steady.', 'unchanged').ok).toBe(true);
    expect(checkDirectionalClaims('Try an earlier bedtime.', 'lower').ok).toBe(true);
  });

  it.each([
    ['higher than usual', 'lower'],
    ['above your usual', 'lower'],
    ['improved on usual', 'unchanged'],
    ['lower than usual', 'higher'],
    ['below your usual', 'higher'],
    ['the same as usual', 'higher'],
  ] as const)('fails "%s" against a fact that is %s', (phrase, grounded) => {
    const check = checkDirectionalClaims(`Your recovery is 26, ${phrase}.`, grounded);
    expect(check.ok).toBe(false);
    expect(check.contradictions.length).toBeGreaterThan(0);
  });

  it('is whole-word and case-insensitive', () => {
    expect(extractDirectionalClaims('Your update is HIGHER, thoughtfully.').map((c) => c.word)).toEqual(['higher']);
  });
});

describe('attribution checker', () => {
  const SHEET: FactSheet = {
    route: 'today',
    facts: [
      { id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 },
      { id: 'hrv.today', label: 'HRV today', value: 41, unit: 'ms', display: '41 ms', usual: 52 },
      { id: 'sleep.total', label: 'Sleep last night', value: 408, unit: 'minutes', display: '6h 48m', usual: 433 },
      { id: 'factor.hrv', label: 'HRV effect on the recovery score', value: -9, unit: 'score', display: '-9 points' },
    ],
    notes: [],
  };

  it('passes numbers that belong to the metric the sentence names, in any unit spelling or hedge', () => {
    expect(checkAttribution(['Your HRV is 41 ms, usually 52 ms.', 'You slept about 7 hours.', 'Recovery is 26, 32 lower than usual.'], SHEET).ok).toBe(true);
  });

  it('fails a real number pinned on the wrong metric', () => {
    const check = checkAttribution(['Your HRV is 58 ms today.'], SHEET);
    expect(check.ok).toBe(false);
    expect(check.problems).toEqual([{ sentence: 'Your HRV is 58 ms today.', metric: 'hrv' }]);
  });

  it("catches what the runtime validator lets through: a score driver's points read as the metric's own value", () => {
    // The runtime check lets a named metric use metric-less values (score drivers, notes),
    // so the 9 points HRV cost the recovery score pass as "HRV is 9".
    expect(validateSentence('Your HRV is 9 this morning.', SHEET).ok).toBe(true);
    expect(checkAttribution(['Your HRV is 9 this morning.'], SHEET).problems).toEqual([{ sentence: 'Your HRV is 9 this morning.', metric: 'hrv' }]);
  });

  it('does not judge a sentence naming no metric or several', () => {
    expect(checkAttribution(['That is 58 in total.', 'Recovery 58 and HRV 26 moved together.'], SHEET).ok).toBe(true);
  });
});

describe('quality checker (the owner\'s bar: informative, personable, not automated)', () => {
  const SHEET: FactSheet = {
    route: 'today',
    facts: [
      { id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 },
      { id: 'factor.hrv', label: 'HRV effect on the recovery score', value: -9, unit: 'score', display: '-9 points' },
      { id: 'factor.rhr', label: 'Resting heart rate effect on the recovery score', value: -2.3, unit: 'score', display: '-2.3 points' },
    ],
    notes: [],
  };
  const GOOD = [
    'Your recovery is 26 today, well under your usual 58.',
    'A lower HRV and a higher resting heart rate pulled it down most.',
    'Keep today to an easy walk and protect your bedtime tonight.',
  ];

  it('passes a reply that answers first, names every driver and ends on a concrete step in words', () => {
    expect(checkQuality(GOOD, SHEET, { answersFirst: ['recovery'], namesDrivers: true, nextStep: true, noStockCheckIn: true })).toEqual([]);
  });

  it('fails a reply that buries the answer behind filler', () => {
    expect(checkQuality(['Great question!', ...GOOD], SHEET, { answersFirst: ['recovery'] })).toEqual([
      expect.stringContaining('first sentence does not answer the question'),
    ]);
  });

  it('fails a reply that names only one of the drivers', () => {
    const problems = checkQuality(['Your recovery is 26, pulled down by your HRV.'], SHEET, { namesDrivers: true });
    expect(problems).toEqual([expect.stringContaining('Resting heart rate')]);
  });

  it('wants the next step in words: a step carrying a new number does not count', () => {
    expect(isNextStep('Try an easy walk today.')).toBe(true);
    expect(isNextStep('You could go to bed by 10pm tonight.')).toBe(true);
    expect(isNextStep('Aim for 9 hours tonight.')).toBe(false);
    expect(isNextStep('Let us take a look at the data.')).toBe(false);
    expect(checkQuality(['Your recovery is 26.'], SHEET, { nextStep: true })).toEqual([expect.stringContaining('no concrete next step')]);
  });

  it('flags a stock check-in question', () => {
    expect(checkQuality([...GOOD, 'How have you been feeling lately?'], SHEET, { noStockCheckIn: true })).toEqual([
      expect.stringContaining('stock check-in'),
    ]);
    expect(checkQuality([...GOOD, 'Is your long run still on for Saturday?'], SHEET, { noStockCheckIn: true })).toEqual([]);
  });
});

describe('impersonal general questions route to general', () => {
  it.each([
    'How much sleep do adults need?',
    'Is 6 hours of sleep enough for most people?',
    'What does HRV measure?',
    'How many steps a day is healthy?',
    'Does caffeine affect sleep?',
    "What's a normal resting heart rate?",
  ])('%s', (q) => {
    expect(routeQuestion(q)).toBe('general');
  });

  it('the same topics asked about the user do not', () => {
    expect(routeQuestion('How much sleep did I get?')).toBe('sleep');
    expect(routeQuestion('What is my HRV today?')).toBe('today');
    expect(routeQuestion('Does caffeine affect my sleep?')).toBe('trends');
  });
});

describe('eval suite', () => {
  // One run for the whole suite: every fixture seeds and removes its own throwaway user.
  let report: Awaited<ReturnType<typeof runEval>>;
  beforeAll(async () => {
    report = await runEval(FIXTURES, NEGATIVE_FIXTURES);
  });

  it('runs every fixture, with unique ids', () => {
    expect(report.results).toHaveLength(FIXTURES.length);
    const ids = [...FIXTURES, ...NEGATIVE_FIXTURES].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fixture passes', () => {
    const failing = report.results.filter((r) => !r.passed).map((r) => ({ id: r.id, failures: r.failures }));
    expect(failing).toEqual([]);
  });

  it('covers every category of the new contract', () => {
    const count = (c: EvalFixture['category']) => FIXTURES.filter((f) => f.category === c).length;
    expect(count('numbers')).toBeGreaterThanOrEqual(8);
    expect(count('hedged')).toBeGreaterThanOrEqual(4);
    expect(count('general')).toBeGreaterThanOrEqual(6);
    expect(count('card')).toBeGreaterThanOrEqual(5);
    expect(count('memory')).toBeGreaterThanOrEqual(5);
    expect(count('quality')).toBeGreaterThanOrEqual(3);
    expect(count('safety')).toBeGreaterThanOrEqual(1);
    const ids = FIXTURES.map((f) => f.id);
    for (const id of [
      'hedged-about-7-hours-passes',
      'hedged-about-9-hours-dropped',
      'general-knowledge-range-allowed',
      'general-figure-phrased-personally-dropped',
      'card-unknown-fact-id-dropped',
      'card-ranked-variant',
      'quality-why-names-every-driver',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('has a voice fixture for every character', () => {
    const voiced = FIXTURES.filter((f) => f.category === 'voice').map((f) => f.snapshot.personaId);
    expect(voiced.sort()).toEqual(listPersonas().map((p) => p.id).sort());
  });

  it('every general-category fixture is asked impersonally and lands on the general route', () => {
    for (const f of FIXTURES.filter((x) => x.category === 'general')) {
      expect({ id: f.id, route: routeQuestion(f.question) }).toEqual({ id: f.id, route: 'general' });
    }
  });

  it('catches every must-fail fixture on its named check and no other, including an invented number', () => {
    expect(report.negatives).toHaveLength(NEGATIVE_FIXTURES.length);
    expect(NEGATIVE_FIXTURES.map((f) => f.mustFailCheck).sort()).toEqual(['attribution', 'direction', 'grounded', 'quality']);
    for (const n of report.negatives) {
      expect(n.failures.map((f) => f.check).every((c) => c === n.mustFailCheck)).toBe(true);
      expect(n.caught).toBe(true);
    }
    expect(report.ok).toBe(true);
  });
});

describe('runner behaviour', () => {
  const base: EvalFixture = {
    id: 'tmp',
    category: 'numbers',
    description: 'tmp',
    snapshot: LOW_DAY,
    question: 'How am I doing today?',
    script: ['Recovery is 26 today.'],
    expect: { outcome: 'answer', route: 'today', modelCalls: 1, sentences: ['Recovery is 26 today.'], dropped: [] },
  };

  it('a passing fixture reports no failures and leaves no user rows behind', async () => {
    const before = await prisma.user.count();
    const result = await runFixture(base);
    expect(result).toMatchObject({ passed: true, failures: [] });
    expect(await prisma.user.count()).toBe(before);
  });

  it('reports each check that failed', async () => {
    const result = await runFixture({
      ...base,
      expect: {
        outcome: 'error:timeout',
        route: 'sleep',
        modelCalls: 3,
        sentences: ['Something else.'],
        textPresent: ['99'],
        textAbsent: ['26'],
        dropped: ['unknown_number'],
        card: { tiles: ['recovery.today'] },
        promptIncludes: ['not in the prompt'],
        memory: { pending: ['x'] },
        quality: { nextStep: true },
      },
    });
    expect(result.passed).toBe(false);
    expect([...new Set(result.failures.map((f) => f.check))].sort()).toEqual(
      ['card', 'dropped', 'memory', 'modelCalls', 'outcome', 'prompt', 'quality', 'route', 'sentences', 'textAbsent', 'textPresent'].sort(),
    );
  });

  it('checks the card source the app sets, whatever the model wrote', async () => {
    const result = await runFixture({
      ...base,
      script: ['Recovery is 26 today.\n```card\n{"headline":"Low day","tiles":[{"fact":"recovery.today"}],"source":"Wellness App Data"}\n```'],
      expect: { outcome: 'answer', card: { source: 'Wellness App Data' } },
    });
    expect(result.failures).toEqual([{ check: 'card', message: 'expected source "Wellness App Data", got "Today"' }]);
  });

  it('an under-scripted provider is a failing fixture, not a crash', async () => {
    const result = await runFixture({ ...base, script: [] });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.check === 'outcome')).toBe(true);
  });

  it('a must-fail fixture whose reply is actually fine is reported as missed', async () => {
    const fine: NegativeFixture = { ...base, id: 'fine', script: ['Your recovery is 26, lower than usual.'], expect: { outcome: 'answer', directionOf: 'recovery.today' }, mustFailCheck: 'direction' };
    const [result] = await runNegativeFixtures([fine]);
    expect(result!.caught).toBe(false);
  });

  it('a must-fail fixture that fails for the WRONG reason is not counted as caught', async () => {
    const wrong: NegativeFixture = { ...base, id: 'wrong', mustFailCheck: 'direction', expect: { outcome: 'safety' } };
    const [result] = await runNegativeFixtures([wrong]);
    expect(result!.caught).toBe(false);
  });

  it('with the runtime validation on, an invented number never reaches the grounded check', async () => {
    const invented = NEGATIVE_FIXTURES.find((f) => f.id === 'numbers-invented-unguarded')!;
    const guarded = await runFixture({ ...invented, expect: { outcome: 'error:validation_failed' }, script: [...invented.script, ...invented.script] });
    expect(guarded.failures).toEqual([]);
    const unguarded = await runFixture(invented, { unguarded: true });
    expect(unguarded.failures.map((f) => f.check)).toEqual(['grounded']);
  });

  it('the direction, attribution and quality classes pass the runtime validator: only the eval catches them', async () => {
    for (const id of ['direction-contradicts-usual', 'attribution-borrowed-number', 'quality-answer-buried']) {
      const f = NEGATIVE_FIXTURES.find((x) => x.id === id)!;
      const runtimeOnly = await runFixture({ ...f, expect: { outcome: 'answer', dropped: [] } });
      expect(runtimeOnly.passed).toBe(true);
    }
  });
});
