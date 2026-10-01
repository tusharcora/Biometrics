import { statusOf } from '../../src/coach/answer/card';
import type { Fact } from '../../src/coach/answer/facts';

const f = (value: number, usual?: number, lowerIsBetter?: boolean): Fact => ({
  id: 'x',
  label: 'X',
  value,
  unit: 'score',
  display: String(value),
  ...(usual === undefined ? {} : { usual }),
  ...(lowerIsBetter ? { lowerIsBetter } : {}),
});

describe('statusOf', () => {
  it('is near within 10% of the usual, either side', () => {
    expect(statusOf(f(58, 58))).toBe('near');
    expect(statusOf(f(53, 58))).toBe('near'); // -8.6%
    expect(statusOf(f(63.8, 58))).toBe('near'); // exactly +10%
  });

  it('is below or above outside that band', () => {
    expect(statusOf(f(26, 58))).toBe('below');
    expect(statusOf(f(52, 58))).toBe('below'); // -10.3%
    expect(statusOf(f(70, 58))).toBe('above');
  });

  it('inverts for a lower-is-better metric (resting heart rate)', () => {
    expect(statusOf(f(66, 57, true))).toBe('below');
    expect(statusOf(f(50, 57, true))).toBe('above');
    expect(statusOf(f(58, 57, true))).toBe('near');
  });

  it('is undefined without a usual, or with a usual of zero', () => {
    expect(statusOf(f(26))).toBeUndefined();
    expect(statusOf(f(3, 0))).toBeUndefined();
  });

  it('is undefined for a step count, which builds up through the day', () => {
    // As buildFactSheet builds it: today's steps carry a 30-day usual, but a
    // morning count far under that usual is not "below usual".
    const steps: Fact = { id: 'steps.today', label: 'Steps today so far', value: 2140, unit: 'count', display: '2,140', usual: 8200 };
    expect(statusOf(steps)).toBeUndefined();
  });
});
