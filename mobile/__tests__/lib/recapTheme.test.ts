import { contrast } from '../../src/components/characters/palette';
import { CHARACTERS } from '../../src/components/characters/registry';
import { CHARACTER_IDS } from '../../src/components/characters/types';
import { CHANGE_COLORS, changeColor, recapTint, yearCell, YEAR_SCALE } from '../../src/lib/recapTheme';
import { COLORS } from '../../src/theme';

it("tints each image with its coach's ground and accent from the registry (Luna navy + yellow, Mochi plum + pink)", () => {
  expect(recapTint('luna')).toMatchObject({ ground: '#12132A', accent: '#FEF08A' });
  expect(recapTint('mochi')).toMatchObject({ ground: '#2A1420', accent: '#F9A8D4' });
});

it.each(CHARACTER_IDS)('keeps every text colour readable on the %s ground', (id) => {
  const t = recapTint(id);
  expect(t.ground).toBe(CHARACTERS[id].ground);
  expect(contrast(t.text, t.ground)).toBeGreaterThanOrEqual(12);
  expect(contrast(t.soft, t.ground)).toBeGreaterThanOrEqual(7);
  expect(contrast(t.muted, t.ground)).toBeGreaterThanOrEqual(4.5);
  // The accent is lightened only when it would not read (Cap's red, Pengu's steel).
  expect(contrast(t.accentText, t.ground)).toBeGreaterThanOrEqual(4.5);
  expect(t.dot).toMatch(/^#[0-9A-F]{8}$/i);
});

it('changes the accent only when it must', () => {
  expect(recapTint('luna').accentText).toBe('#FEF08A');
});

it('has a three-step purple sleep scale for the year and green / orange change colours', () => {
  expect(YEAR_SCALE).toEqual({ short: '#6B4FA8', near: '#9333EA', goal: '#D8B4FE' });
  expect(CHANGE_COLORS).toMatchObject({ better: '#86EFAC', worse: '#FDBA74' });
});

it("colours an in-app change: the design's green and orange on dark, text-safe darker ones on light, grey when equal", () => {
  expect(changeColor('better', 'dark')).toBe(CHANGE_COLORS.better);
  expect(changeColor('worse', 'dark')).toBe('#FDBA74');
  expect(changeColor('same', 'dark')).toBe(COLORS.dark.muted);
  expect(changeColor('same', 'light')).toBe(COLORS.light.muted);
  for (const tone of ['better', 'worse'] as const) {
    expect(contrast(changeColor(tone, 'light'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(changeColor(tone, 'dark'), '#14161B')).toBeGreaterThanOrEqual(4.5);
  }
});

it.each(CHARACTER_IDS)('keeps every year cell readable on the %s ground: no data an outlined empty cell, future a faint fill', (id) => {
  const t = recapTint(id);
  const none = yearCell('none', t);
  const future = yearCell('future', t);
  // No data: no fill (the ground shows), a visible outline, unlike any sleep step or the future.
  expect(none.fill).toBe('transparent');
  expect(none.outline).not.toBeNull();
  expect(contrast(none.outline!, t.ground)).toBeGreaterThanOrEqual(1.8);
  // Future: a faint fill without an outline, still lifted off the ground.
  expect(future.outline).toBeNull();
  expect(future.fill).not.toBe(t.ground);
  expect(contrast(future.fill, t.ground)).toBeGreaterThan(1.05);
  expect(contrast(future.fill, t.ground)).toBeLessThan(contrast(none.outline!, t.ground));
  // The sleep steps are the purple scale, filled, and short stands clear of the ground.
  expect(['short', 'near', 'goal'].map((l) => yearCell(l as 'short', t))).toEqual([
    { fill: '#6B4FA8', outline: null }, { fill: '#9333EA', outline: null }, { fill: '#D8B4FE', outline: null },
  ]);
  expect(contrast(YEAR_SCALE.short, t.ground)).toBeGreaterThanOrEqual(1.8);
});
