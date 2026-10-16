// The weekly theme calendar (spec 2026-10-15 §10.4; P4 rulings 3-4).
import { CHALLENGES_START_WEEK, THEMES, briefCount, meetsBrief, themeFor } from '../../src/challenges/themes';
import { cosmeticItem, shippedItem, tagsOf } from '../../src/cosmetics/catalogue';
import { forSale, offeredIn } from '../../src/coins/shop';
import { weekNumber } from '../../src/coins/shopWeeks';
import { piece, withPieces } from '../room/helpers';

it('starts at 2026-W44 and rotates the four themes week by week, across a year end', () => {
  expect(themeFor('2026-W43')).toBeNull();
  expect(['2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W48'].map((w) => themeFor(w)?.id))
    .toEqual(['cosyAutumn', 'greenThumb', 'nightOwl', 'tidyDesk', 'cosyAutumn']);
  // 2026 has 53 ISO weeks: W53 and 2027-W01 are consecutive themes.
  const order = THEMES.map((t) => t.id);
  const at = (w: string) => order.indexOf(themeFor(w)!.id);
  expect((at('2027-W01') - at('2026-W53') + 4) % 4).toBe(1);
  expect(themeFor('garbage')).toBeNull();
  expect(weekNumber(CHALLENGES_START_WEEK)! + 1).toBe(weekNumber('2026-W45'));
});

it('every theme piece and trophy is a shipped release-6 placeable piece; trophies are prizes, theme pieces cost 80', () => {
  for (const t of THEMES) {
    expect([t.id, shippedItem(t.themePiece)?.release, shippedItem(t.themePiece)?.price, shippedItem(t.themePiece)?.shop]).toEqual([t.id, 6, 80, 'theme']);
    expect([t.id, shippedItem(t.trophy)?.release, shippedItem(t.trophy)?.unlock, shippedItem(t.trophy)?.price]).toEqual([t.id, 6, { kind: 'prize' }, undefined]);
    expect(shippedItem(t.trophy)?.emissive).toBe(true); // glows at night (§10.4)
    expect(tagsOf(cosmeticItem(t.themePiece)!)).toContain(t.rule.tag);
  }
});

it('a theme piece is in the shop only in its own theme\'s weeks (spec §6.4)', () => {
  expect(offeredIn('2026-W44').map((o) => o.itemId)).toContain('lamp.harvest');
  expect(offeredIn('2026-W45').map((o) => o.itemId)).not.toContain('lamp.harvest');
  expect(offeredIn('2026-W48').map((o) => o.itemId)).toContain('lamp.harvest');
  expect(forSale('lamp.harvest', '2026-W44', new Set())).toEqual({ itemId: 'lamp.harvest', price: 80 });
  expect(forSale('corner.acorn', '2026-W44', new Set(['corner.acorn']))).toBeNull(); // a trophy is never sold
});

it('counts brief pieces once per placement and judges the rule', () => {
  const cosy = themeFor('2026-W44')!;
  const room = withPieces(piece('p1', 'corner.pumpkin', { x: 6, y: 6 }), piece('p2', 'corner.pumpkin', { x: 5, y: 6 }), piece('p3', 'corner.gnome', { x: 4, y: 6 }));
  // The starter room's amber desk lamp and mug are warm too.
  expect(briefCount(room, 'warm')).toBe(4);
  expect(meetsBrief(room, cosy)).toBe(true);
  expect(briefCount(withPieces(), 'glow')).toBeGreaterThanOrEqual(1); // the amber lamp glows
});
