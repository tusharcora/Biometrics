import { cubicBezier, ease, kf, phase } from '../../src/components/characters/engine/keyframes';
import { CHARACTER_IDS, DEFAULT_CHARACTER_ID, isCharacterId } from '../../src/components/characters/types';

describe('kf (CSS keyframes)', () => {
  it('returns the keyframe values exactly at their stops', () => {
    expect(kf(0, [0, 0.5, 1], [1, 3, 2])).toBe(1);
    expect(kf(0.5, [0, 0.5, 1], [1, 3, 2])).toBe(3);
    expect(kf(1, [0, 0.5, 1], [1, 3, 2])).toBe(2);
  });

  it('interpolates within a segment using that segment only', () => {
    expect(kf(0.25, [0, 0.5, 1], [0, 10, 0], 'linear')).toBeCloseTo(5);
    expect(kf(0.75, [0, 0.5, 1], [0, 10, 0], 'linear')).toBeCloseTo(5);
  });

  it('applies the timing function per segment, like CSS', () => {
    // ease-in-out is symmetric: halfway through a segment is halfway between its values.
    expect(kf(0.25, [0, 0.5, 1], [0, 10, 0])).toBeCloseTo(5, 3);
    // but it starts slowly: 10% into the segment is well under 10% of the way.
    expect(kf(0.05, [0, 0.5, 1], [0, 10, 0])).toBeLessThan(0.5);
  });

  it('holds the first/last value outside the stops (e.g. 0%,60%{…} then a pause)', () => {
    expect(kf(0.8, [0, 0.3, 0.6], [0, 1, 0])).toBe(0);
    expect(kf(0.1, [0.2, 1], [4, 8])).toBe(4);
  });

  it('jumps at a zero-length segment instead of dividing by zero', () => {
    expect(kf(0.5, [0, 0.5, 0.5, 1], [0, 0, 1, 1], 'linear')).toBe(0);
    expect(kf(0.51, [0, 0.5, 0.5, 1], [0, 0, 1, 1], 'linear')).toBe(1);
  });

  it('returns 0 for an empty keyframe list', () => {
    expect(kf(0.5, [], [])).toBe(0);
  });
});

describe('easing', () => {
  it('matches the CSS curves', () => {
    expect(ease('linear', 0.3)).toBe(0.3);
    expect(ease('ease-in-out', 0.5)).toBeCloseTo(0.5, 3);
    expect(ease('ease', 0.5)).toBeCloseTo(0.8024, 3);
    expect(ease('ease-in', 0.5)).toBeCloseTo(0.3153, 3);
    expect(ease('ease-out', 0.5)).toBeCloseTo(0.6847, 3);
  });

  it('pins the ends', () => {
    expect(cubicBezier(0.42, 0, 0.58, 1, 0)).toBe(0);
    expect(cubicBezier(0.42, 0, 0.58, 1, 1)).toBe(1);
  });
});

describe('phase', () => {
  it('shifts and wraps loop progress', () => {
    expect(phase(0.9, 0.25)).toBeCloseTo(0.15);
    expect(phase(0.1, -0.25)).toBeCloseTo(0.85);
    expect(phase(0, 0)).toBe(0);
  });
});

describe('character ids', () => {
  it('has the eight characters, Hoot first and default', () => {
    expect(CHARACTER_IDS).toEqual(['hoot', 'pip', 'mochi', 'nimbus', 'ember', 'beep', 'doze', 'beat']);
    expect(DEFAULT_CHARACTER_ID).toBe('hoot');
  });

  it('recognises only known ids', () => {
    expect(isCharacterId('pip')).toBe(true);
    expect(isCharacterId('encouraging')).toBe(false);
    expect(isCharacterId('luna')).toBe(false);
    expect(isCharacterId(null)).toBe(false);
    expect(isCharacterId(3)).toBe(false);
  });
});
