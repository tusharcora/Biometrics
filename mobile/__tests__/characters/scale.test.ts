import { crispLayout } from '../../src/components/characters/sprites/scale';

// True when `pt` points is a whole number of device pixels at `dpr`
// (rounded to 1e-6 to absorb float noise such as 1/3 * 3).
const onDevicePixel = (pt: number, dpr: number) =>
  Number.isInteger(Math.round(pt * dpr * 1e6) / 1e6);

describe('crispLayout', () => {
  it.each([18, 20, 36, 40, 52, 56, 64, 72, 120, 180])('%ipt at 2× and 3× uses whole device pixels, centred inside the slot', (pt) => {
    for (const dpr of [2, 3]) {
      const l = crispLayout(pt, dpr);
      expect(Number.isInteger(l.cellPx)).toBe(true);
      expect(l.cellPx).toBeGreaterThanOrEqual(1);
      expect(l.drawnPt).toBeLessThanOrEqual(pt + 1e-9);
      expect(l.offsetPt).toBeCloseTo((pt - l.drawnPt) / 2);
      // offsets land on device pixels too
      expect(onDevicePixel(l.offsetPt, dpr)).toBe(true);
    }
  });

  // Odd device-pixel slack (e.g. 17pt at 3× = 51px, 48px drawn, 3px spare)
  // cannot be split evenly, so the floor keeps the grid on a device pixel and
  // the centre is off by at most one device pixel.
  it.each([17, 19, 25, 53])('%ipt at 3× (odd slack) stays on device pixels, within one pixel of centre, inside the slot', (pt) => {
    const dpr = 3;
    const l = crispLayout(pt, dpr);
    expect(Number.isInteger(l.cellPx)).toBe(true);
    expect(onDevicePixel(l.offsetPt, dpr)).toBe(true);
    expect(Math.abs(l.offsetPt - (pt - l.drawnPt) / 2)).toBeLessThanOrEqual(1 / dpr + 1e-9);
    expect(l.offsetPt).toBeGreaterThanOrEqual(0);
    expect(l.offsetPt + l.drawnPt).toBeLessThanOrEqual(pt + 1e-9);
  });

  it('matches the spec examples', () => {
    expect(crispLayout(52, 3).cellPx).toBe(6); // 48pt drawn
    expect(crispLayout(18, 3).cellPx).toBe(2); // 16pt drawn
    expect(crispLayout(18, 2).cellPx).toBe(1);
  });

  it('never returns zero, even for tiny slots', () => {
    expect(crispLayout(4, 1).cellPx).toBe(1);
  });
});
