// The CI gate for the coach eval harness (spec section 7): every fixture runs
// through the real orchestrator with a ScriptedProvider, and the deliberately
// contradicting fixtures must be caught. Also unit-tests the directional-claim
// checker on its own, in both directions.

import { prisma } from '../../src/db/client';
import { migrateTestDb } from '../setupTestDb';
import { checkDirectionalClaims, extractDirectionalClaims } from '../../evals/coach/directionCheck';
import { FIXTURES, NEGATIVE_FIXTURES } from '../../evals/coach/fixtures';
import { runEval, runFixture, runNegativeFixtures } from '../../evals/coach/runner';
import type { EvalFixture, NegativeFixture } from '../../evals/coach/types';
import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';

beforeAll(() => {
  migrateTestDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('directional-claim checker', () => {
  it('passes a reply that quotes the grounded field (resolved), for every direction', () => {
    expect(checkDirectionalClaims('Your recovery is 71, lower than yesterday.', 'lower').ok).toBe(true);
    expect(checkDirectionalClaims('Your recovery is 80, higher than yesterday.', 'higher').ok).toBe(true);
    expect(checkDirectionalClaims('Your recovery is 70, unchanged from yesterday.', 'unchanged').ok).toBe(true);
  });

  it('passes prose that agrees, and a reply with no directional language at all', () => {
    expect(checkDirectionalClaims('It dipped a little and is worse than yesterday.', 'lower').ok).toBe(true);
    expect(checkDirectionalClaims('Your recovery is 71. Nice and steady sleep habits help.', 'unchanged').ok).toBe(true);
    expect(checkDirectionalClaims('Try an earlier bedtime.', 'lower').ok).toBe(true);
  });

  it.each([
    ['higher than yesterday', 'lower'],
    ['up from yesterday', 'lower'],
    ['improved since yesterday', 'unchanged'],
    ['lower than yesterday', 'higher'],
    ['worse than yesterday', 'higher'],
    ['unchanged from yesterday', 'higher'],
    ['unchanged from yesterday', 'lower'],
  ] as const)('fails "%s" against a grounded %s', (phrase, grounded) => {
    const check = checkDirectionalClaims(`Your recovery is 71, ${phrase}.`, grounded);
    expect(check.ok).toBe(false);
    expect(check.contradictions.length).toBeGreaterThan(0);
  });

  it('fails a reply that contradicts itself even when one word agrees', () => {
    expect(checkDirectionalClaims('It is lower, but higher than your average.', 'lower').ok).toBe(false);
  });

  it('is whole-word and case-insensitive, and ignores the disclaimer', () => {
    expect(extractDirectionalClaims('Your update is HIGHER, thoughtfully.').map((c) => c.word)).toEqual(['higher']);
    expect(checkDirectionalClaims(`Lower today.\n\n${COACH_DISCLAIMER}`, 'lower').ok).toBe(true);
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
    expect(new Set(FIXTURES.map((f) => f.id)).size).toBe(FIXTURES.length);
    expect(new Set(NEGATIVE_FIXTURES.map((f) => f.id)).size).toBe(NEGATIVE_FIXTURES.length);
  });

  it('every fixture passes', () => {
    const failing = report.results.filter((r) => !r.passed).map((r) => ({ id: r.id, failures: r.failures }));
    expect(failing).toEqual([]);
  });

  it('covers both new spec categories in both directions', () => {
    const count = (c: EvalFixture['category']) => FIXTURES.filter((f) => f.category === c).length;
    expect(count('digit-scan-accept')).toBeGreaterThanOrEqual(6);
    expect(count('digit-scan-reject')).toBeGreaterThanOrEqual(8);
    expect(count('direction')).toBeGreaterThanOrEqual(2);
    expect(count('memory')).toBeGreaterThanOrEqual(3);
    const ids = FIXTURES.map((f) => f.id).join(' ');
    for (const shape of ['list-marker', 'clock-pm', 'month-name-date', 'ordinal-date', 'ratio', 'bare-h-mm-duration', 'bare-count', 'resembles-am']) {
      expect(ids).toContain(shape);
    }
    expect(FIXTURES.some((f) => f.id === 'memory-health-fact-disguised-as-preference')).toBe(true);
  });

  it('the deliberately contradicting fixtures are caught, on the direction check and no other', () => {
    expect(report.negatives).toHaveLength(NEGATIVE_FIXTURES.length);
    expect(report.negatives.length).toBeGreaterThan(0);
    for (const n of report.negatives) {
      expect(n.mustFailCheck).toBe('direction');
      expect(n.failures.map((f) => f.check)).toEqual(['direction']);
      expect(n.caught).toBe(true);
    }
    expect(report.ok).toBe(true);
  });

  it('the directional fixture has a grounded direction opposite to a naive reading of the raw numbers', () => {
    const f = NEGATIVE_FIXTURES.find((x) => x.id === 'direction-contradicts-naive-reading')!;
    const [today, yesterday] = [f.snapshot.recovery!.find(([d]) => d === 0)![1], f.snapshot.recovery!.find(([d]) => d === 1)![1]];
    expect(today).toBeGreaterThan(yesterday); // naive reading: higher
    expect(f.groundedOverrides?.direction).toBe('lower'); // grounded field: lower
  });
});

describe('runner behaviour', () => {
  const base: EvalFixture = {
    id: 'tmp',
    category: 'grounding',
    description: 'tmp',
    snapshot: { recovery: [[0, 72.4], [1, 75]] },
    question: 'how am I',
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}.' }],
    expect: { source: 'MODEL', modelCalls: 1, valuesPresent: ['72.4'], guardrail: [] },
  };

  it('a passing fixture reports no failures and leaves no user rows behind', async () => {
    const before = await prisma.user.count();
    const result = await runFixture(base);
    expect(result).toMatchObject({ passed: true, failures: [] });
    expect(await prisma.user.count()).toBe(before);
  });

  it('reports the specific check that failed (source, value presence, tool calls, guardrail, memory, model calls)', async () => {
    const result = await runFixture({
      ...base,
      expect: {
        source: 'FALLBACK',
        modelCalls: 3,
        toolCalls: ['getUserGoals'],
        valuesPresent: ['99.9'],
        valuesAbsent: ['72.4'],
        guardrail: [{ reason: 'unwrapped_number', attempt: 1, outcome: 'regenerate' }],
        memory: { pending: ['x'] },
      },
    });
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.check).sort()).toEqual(
      ['guardrail', 'memory', 'modelCalls', 'source', 'toolCalls', 'valuesAbsent', 'valuesPresent'].sort(),
    );
  });

  it('an under-scripted provider is a failing fixture, not a crash', async () => {
    const result = await runFixture({ ...base, script: [] });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.check === 'source')).toBe(true);
  });

  it('a negative fixture that is NOT caught (its reply is actually fine) is reported as missed', async () => {
    const fine: NegativeFixture = {
      ...base,
      id: 'fine',
      category: 'direction',
      snapshot: { recovery: [[0, 71], [1, 68]] },
      groundedOverrides: { direction: 'lower' },
      script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.' }],
      expect: { source: 'MODEL', directionConsistent: true },
      mustFailCheck: 'direction',
    };
    const [result] = await runNegativeFixtures([fine]);
    expect(result!.caught).toBe(false);
  });

  it('a negative fixture that fails for the WRONG reason is not counted as caught', async () => {
    const wrong: NegativeFixture = { ...base, id: 'wrong', mustFailCheck: 'direction', expect: { source: 'FALLBACK' } };
    const [result] = await runNegativeFixtures([wrong]);
    expect(result!.caught).toBe(false);
  });

  it('the direction check fails a reply that follows the naive reading, and the runtime guardrail alone does not', async () => {
    const naive = NEGATIVE_FIXTURES.find((f) => f.id === 'direction-contradicts-naive-reading')!;
    const result = await runFixture({ ...naive, expect: { source: 'MODEL', modelCalls: 1, guardrail: [] } }); // no direction check
    expect(result.passed).toBe(true); // the runtime guardrail let it through: nothing but the eval can catch it
    const withCheck = await runFixture(naive);
    expect(withCheck.passed).toBe(false);
    expect(withCheck.failures.map((f) => f.check)).toEqual(['direction']);
  });
});
