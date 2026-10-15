import { growLine, needsLine, sizeRows, type FamilyStanding } from '../../src/lib/coins/sizes';
import { nextRowsRects } from '../../src/lib/room/edit/overlay';
import { isoGrid } from '../../src/lib/room/iso/grid';

const FAMILIES: FamilyStanding[] = [{ family: 'CHECK_IN', level: 1, current: 9 }, { family: 'SLEEP_GOAL', level: 2, current: 4 }];

it('lists the three sizes: yours, then both gates of each bigger one with their progress (spec §7, C2, ruling 14)', () => {
  const [starter, bigger, loft] = sizeRows(1, 360, FAMILIES);
  expect([starter!.name, starter!.size, starter!.pieces, starter!.status]).toEqual(['Starter', '7 × 7', '40 pieces', 'yours']);
  expect([bigger!.status, bigger!.coins, bigger!.badge]).toEqual(['next', { title: '600 coins', progress: '360 of 600', met: false }, { title: 'A 14-day check-in streak', progress: '9 of 14', met: false }]);
  expect([loft!.status, loft!.pieces, loft!.piecesSpoken, loft!.coins, loft!.badge]).toEqual([
    'later', '90 pieces · second window', '90 pieces, second window',
    { title: '1,500 coins', progress: '360 of 1,500', met: false }, { title: 'Sleep goal badge, level 3', progress: 'level 2 now', met: false },
  ]);
  expect(sizeRows(2, 0, FAMILIES)[1]!.status).toBe('yours');
  expect(sizeRows(1, 360, null)[1]!.badge).toEqual({ title: 'A 14-day check-in streak', progress: '0 of 14', met: false });
});

it('says what Grow still needs, both gates always (spec §7)', () => {
  expect(growLine(1, 360, FAMILIES)).toBe('Needs 240 more coins and 5 more days in a row.');
  expect(growLine(1, 600, FAMILIES)).toBe('Needs 5 more days in a row.');
  expect(growLine(1, 100, [{ family: 'CHECK_IN', level: 2, current: 0 }])).toBe('Needs 500 more coins.'); // a broken run after the badge costs nothing
  expect(growLine(1, 600, [{ family: 'CHECK_IN', level: 2, current: 0 }])).toBeNull();
  expect(growLine(2, 600, FAMILIES)).toBe('Needs 900 more coins and the sleep goal badge, level 3.');
  expect(growLine(3, 0, FAMILIES)).toBeNull();
});

it('with the badges not read, Grow waits only on coins: the server judges the badge (a 409 gate refreshes)', () => {
  expect(growLine(1, 360, null)).toBe('Needs 240 more coins.');
  expect(growLine(1, 600, null)).toBeNull();
});

it('a refused grow\'s own counts say what is missing when the wallet could not be read again (ruling T11-ERR)', () => {
  expect(needsLine(1, 40, true, FAMILIES)).toBe('Needs 40 more coins and 5 more days in a row.');
  expect(needsLine(2, 0, true, FAMILIES)).toBe('Needs the sleep goal badge, level 3.');
  expect(needsLine(1, 0, false, FAMILIES)).toBeNull();
});

it('dashes the next size\'s new rows on that size\'s grid (ruling 15)', () => {
  const g = isoGrid(2);
  const r = nextRowsRects(g, 7);
  expect(r.length).toBeGreaterThan(20);
  expect(r.every(([x, y, w, h]) => Number.isInteger(x) && Number.isInteger(y) && w === 1 && h === 1)).toBe(true);
});
