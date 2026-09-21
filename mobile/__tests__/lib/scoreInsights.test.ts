import {
  buildScoreHeadline,
  buildBaselineSentence,
  formatPoints,
  scoreBand,
  sortFactorsByImpact,
  pickColdStartProgress,
  SCORE_FRAMING,
} from '../../src/lib/scoreInsights';
import type { DailyScoreDTO, FactorDTO } from '../../src/api/scores';

function factor(overrides: Partial<FactorDTO> & Pick<FactorDTO, 'factor'>): FactorDTO {
  const labels = { HRV: 'HRV', RHR: 'Daily minimum HR', SLEEP_DEBT: 'Sleep debt' } as const;
  return {
    label: labels[overrides.factor],
    z: 0,
    weight: 0.3,
    contribution: 0,
    points: 0,
    imputed: false,
    excluded: false,
    ...overrides,
  };
}

function score(overrides: Partial<DailyScoreDTO> = {}): DailyScoreDTO {
  return {
    date: '2026-09-19',
    type: 'RECOVERY',
    score: 72,
    confidenceLevel: 'HIGH',
    algorithmVersion: 'v1',
    factors: [],
    coldStart: [],
    ...overrides,
  };
}

describe('buildScoreHeadline', () => {
  it('names the largest-|points| factor as the biggest lift on a positive day', () => {
    const headline = buildScoreHeadline(
      score({
        score: 78,
        factors: [
          factor({ factor: 'HRV', points: 8.2 }),
          factor({ factor: 'RHR', points: -3.1 }),
          factor({ factor: 'SLEEP_DEBT', points: -1.4 }),
        ],
      }),
    );

    expect(headline).toContain('Your Recovery Score is 78.');
    expect(headline).toContain('HRV is the biggest lift on your Recovery Score today (+8.2 pts).');
  });

  it('names the largest-|points| factor as the biggest drag on a negative day', () => {
    const headline = buildScoreHeadline(
      score({
        score: 41,
        factors: [
          factor({ factor: 'HRV', points: 1.1 }),
          factor({ factor: 'RHR', points: -6.4 }),
          factor({ factor: 'SLEEP_DEBT', points: -2 }),
        ],
      }),
    );

    expect(headline).toContain('Daily minimum HR is the biggest drag on your Recovery Score today (−6.4 pts).');
  });

  it('handles a single dominant factor without mentioning the others', () => {
    const headline = buildScoreHeadline(
      score({
        score: 66,
        factors: [
          factor({ factor: 'HRV', points: 12 }),
          factor({ factor: 'RHR', points: 0.1 }),
          factor({ factor: 'SLEEP_DEBT', points: -0.2 }),
        ],
      }),
    );

    expect(headline).toContain('HRV is the biggest lift');
    expect(headline).not.toContain('Sleep debt is the biggest');
  });

  it('says nothing stands out when every factor is near zero', () => {
    const headline = buildScoreHeadline(
      score({
        score: 50,
        factors: [factor({ factor: 'HRV', points: 0.1 }), factor({ factor: 'RHR', points: -0.2 })],
      }),
    );

    expect(headline).toContain('right around your own baseline');
    expect(headline).not.toMatch(/biggest (lift|drag)/);
  });

  it('never picks an excluded factor as the driver', () => {
    const headline = buildScoreHeadline(
      score({
        factors: [
          factor({ factor: 'HRV', points: 99, excluded: true }),
          factor({ factor: 'RHR', points: -2 }),
          factor({ factor: 'SLEEP_DEBT', points: 1 }),
        ],
      }),
    );

    expect(headline).toContain('Daily minimum HR is the biggest drag');
    expect(headline).toContain('Still building a baseline for HRV, so today’s score relies on the other factors.');
  });

  it('flags an imputed factor as estimated rather than measured', () => {
    const headline = buildScoreHeadline(
      score({
        factors: [
          factor({ factor: 'HRV', points: 5, imputed: true }),
          factor({ factor: 'RHR', points: -1 }),
        ],
      }),
    );

    expect(headline).toContain('HRV wasn’t recorded that day, so it’s estimated from your baseline.');
  });

  it('explains a cold-start day (score null) with the closest-to-ready metric and no invented number', () => {
    const headline = buildScoreHeadline(
      score({
        score: null,
        factors: [
          factor({ factor: 'HRV', excluded: true }),
          factor({ factor: 'RHR', excluded: true }),
          factor({ factor: 'SLEEP_DEBT', excluded: true }),
        ],
        coldStart: [
          { metric: 'HRV', daysCollected: 9, daysRequired: 14 },
          { metric: 'RESTING_HR', daysCollected: 3, daysRequired: 14 },
        ],
      }),
    );

    expect(headline).toContain('Your Recovery Score isn’t ready yet');
    expect(headline).toContain('9 of 14 days of HRV');
    expect(headline).not.toMatch(/biggest (lift|drag)/);
  });

  it('describes a cold-start RESTING_HR metric as a daily-minimum proxy, never resting heart rate', () => {
    const headline = buildScoreHeadline(
      score({
        score: null,
        factors: [],
        coldStart: [{ metric: 'RESTING_HR', daysCollected: 4, daysRequired: 14 }],
      }),
    );

    expect(headline).toContain('daily minimum heart rate');
    expect(headline.toLowerCase()).not.toContain('resting heart rate');
  });

  it('copes with a null score and no cold-start detail', () => {
    expect(buildScoreHeadline(score({ score: null, factors: [], coldStart: [] }))).toContain('isn’t ready yet');
  });

  it('labels a Sleep Score by its own type', () => {
    const headline = buildScoreHeadline(score({ type: 'SLEEP', factors: [factor({ factor: 'HRV', points: 4 })] }));

    expect(headline).toContain('Your Sleep Score is 72.');
  });

  it.each([
    ['a lift', [factor({ factor: 'HRV', points: 5 })], 72],
    ['a drag', [factor({ factor: 'HRV', points: -5 })], 72],
    ['steady', [factor({ factor: 'HRV', points: 0 })], 72],
    ['cold start', [], null],
  ] as const)('always carries the not-a-medical-assessment framing (%s)', (_name, factors, value) => {
    expect(buildScoreHeadline(score({ score: value, factors: [...factors] }))).toContain(SCORE_FRAMING);
  });

  it('only uses numbers present in the data', () => {
    const headline = buildScoreHeadline(
      score({ score: 64, factors: [factor({ factor: 'HRV', points: 3.4 }), factor({ factor: 'RHR', points: -1 })] }),
    );
    const numbers = headline.match(/\d+(\.\d+)?/g) ?? [];

    expect(numbers.sort()).toEqual(['3.4', '64']);
  });
});

describe('buildBaselineSentence', () => {
  it('states the baseline, spread and window used', () => {
    expect(buildBaselineSentence({ metric: 'HRV', ewma: 42, spread: 6, daysOfHistory: 30, windowDays: 30, unit: 'ms' })).toBe(
      'Your HRV baseline: 42 ms ± 6 ms, based on your last 30 days.',
    );
  });

  it('rounds to one decimal place', () => {
    expect(buildBaselineSentence({ metric: 'HRV', ewma: 42.349, spread: 5.96, daysOfHistory: 30, windowDays: 30, unit: 'ms' })).toContain(
      '42.3 ms ± 6 ms',
    );
  });

  it('says how many days it actually has when history is shorter than the window', () => {
    expect(buildBaselineSentence({ metric: 'HRV', ewma: 42, spread: 6, daysOfHistory: 18, windowDays: 30, unit: 'ms' })).toContain(
      'based on the 18 days of data so far',
    );
  });

  it('names the RESTING_HR baseline as a daily minimum heart rate', () => {
    const sentence = buildBaselineSentence({ metric: 'RESTING_HR', ewma: 52, spread: 3, daysOfHistory: 30, windowDays: 30, unit: 'bpm' });

    expect(sentence).toContain('daily minimum heart rate baseline');
    expect(sentence.toLowerCase()).not.toContain('resting heart rate');
  });
});

describe('formatPoints', () => {
  it('signs positive and negative values to one decimal place', () => {
    expect(formatPoints(8.24)).toBe('+8.2 pts');
    expect(formatPoints(-3.06)).toBe('−3.1 pts');
  });

  it('shows zero without a sign, including values that round to zero', () => {
    expect(formatPoints(0)).toBe('0.0 pts');
    expect(formatPoints(-0.04)).toBe('0.0 pts');
  });
});

describe('scoreBand', () => {
  it.each([
    [100, 'scoreExcellent'],
    [75, 'scoreExcellent'],
    [74.9, 'scoreGood'],
    [55, 'scoreGood'],
    [54, 'scoreFair'],
    [40, 'scoreFair'],
    [39, 'scorePoor'],
    [0, 'scorePoor'],
  ])('maps %s to %s', (value, band) => {
    expect(scoreBand(value)).toBe(band);
  });
});

describe('sortFactorsByImpact', () => {
  it('sorts by |points| descending with excluded factors last, without mutating the input', () => {
    const input = [
      factor({ factor: 'HRV', points: 1 }),
      factor({ factor: 'RHR', points: -5 }),
      factor({ factor: 'SLEEP_DEBT', points: 99, excluded: true }),
    ];
    const copy = [...input];

    expect(sortFactorsByImpact(input).map((f) => f.factor)).toEqual(['RHR', 'HRV', 'SLEEP_DEBT']);
    expect(input).toEqual(copy);
  });
});

describe('pickColdStartProgress', () => {
  it('picks the metric closest to having enough history', () => {
    expect(
      pickColdStartProgress([
        { metric: 'RESTING_HR', daysCollected: 3, daysRequired: 14 },
        { metric: 'HRV', daysCollected: 9, daysRequired: 14 },
      ]),
    ).toEqual({ metric: 'HRV', daysCollected: 9, daysRequired: 14 });
  });

  it('returns null when nothing is cold-starting', () => {
    expect(pickColdStartProgress([])).toBeNull();
  });
});
