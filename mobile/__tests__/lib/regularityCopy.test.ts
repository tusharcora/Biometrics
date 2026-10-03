import { regularityLine } from '../../src/lib/regularityCopy';

describe('regularityLine', () => {
  it('reads steady at 75 and above', () => {
    expect(regularityLine(80, 'Luna')).toBe('Luna: Steady nights. Keep the rhythm.');
    expect(regularityLine(75, 'Luna')).toBe('Luna: Steady nights. Keep the rhythm.');
  });

  it('reads drifting from 50 to below 75', () => {
    expect(regularityLine(60, 'Kit')).toBe('Kit: Your bedtime drifts a little. A steadier night helps.');
    expect(regularityLine(50, 'Kit')).toBe('Kit: Your bedtime drifts a little. A steadier night helps.');
  });

  it('reads irregular below 50', () => {
    expect(regularityLine(30, 'Mochi')).toBe('Mochi: Bedtimes are all over the place lately. Pick one and try it.');
    expect(regularityLine(49, 'Mochi')).toBe('Mochi: Bedtimes are all over the place lately. Pick one and try it.');
  });

  it('says nothing without a score', () => {
    expect(regularityLine(null, 'Luna')).toBeNull();
  });

  it('never states a number', () => {
    for (const score of [0, 49, 50, 74, 75, 100]) {
      expect(regularityLine(score, 'Coach')).not.toMatch(/\d/);
    }
  });
});
