import { CARD, chipTextColor, contrast, darkenHex, hexAlpha, kipLabelColour, mixHex } from '../../src/lib/colour';
import { KIP_COLOURS, type KipColour } from '../../src/lib/kip/kipArt';

it('keeps the moved helpers exact', () => {
  expect(hexAlpha('#112233', 0.5)).toBe('#11223380');
  expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  expect(darkenHex('#FF8000', 0.5)).toBe('#804000');
  expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  expect(contrast(chipTextColor('#FB7185', 'dark'), '#14161B')).toBeGreaterThan(4.5);
});

it('colours a KIP label only where the colour reads on the dark card (spec §3.4)', () => {
  const passing = (Object.keys(KIP_COLOURS) as KipColour[]).filter((c) => kipLabelColour(c, 'dark') !== null);
  expect(passing.sort()).toEqual(['cobalt', 'coral', 'lemon', 'lilac', 'lime', 'mint', 'sky', 'snow']);
  for (const c of passing) expect(contrast(kipLabelColour(c, 'dark')!, CARD.dark)).toBeGreaterThanOrEqual(4.5);
});

it('uses foreground (null) for every colour in light mode', () => {
  for (const c of Object.keys(KIP_COLOURS) as KipColour[]) expect(kipLabelColour(c, 'light')).toBeNull();
});
