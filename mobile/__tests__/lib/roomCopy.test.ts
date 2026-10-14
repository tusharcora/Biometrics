import { CATALOGUE } from '../../src/lib/room/catalogue';
import { ITEM_NAMES, ROOM_COPY, SET_NAMES, itemName, progressLine, spokenName, unlockLine, unlockSpoken } from '../../src/lib/room/roomCopy';

it('names every item and set the app ships', () => {
  expect(CATALOGUE.items.filter((i) => !ITEM_NAMES[i.id]).map((i) => i.id)).toEqual([]);
  expect(CATALOGUE.sets.filter((s) => !SET_NAMES[s.id]).map((s) => s.id)).toEqual([]);
  expect(itemName('wall.shoji')).toBe('wall.shoji'); // an unknown id falls back to itself, never throws
});

it('writes unlock lines as the Cat boards do, and spoken ones without "·" or Roman numerals', () => {
  const cases = [
    [{ kind: 'family', family: 'STEADY_BEDTIME', level: 3 }, 'Steady bedtime · III', 'Steady bedtime, level 3'],
    [{ kind: 'anyFamily', level: 4 }, 'Any family · level IV', 'Any family, level 4'],
    [{ kind: 'counter', counter: 'recaps_read', atLeast: 8 }, 'Read 8 weekly recaps', 'Read 8 weekly recaps'],
    [{ kind: 'counter', counter: 'buddy_cheers', atLeast: 10 }, 'Cheer a buddy 10 times', 'Cheer a buddy 10 times'],
    [{ kind: 'starter' }, 'In every room from day one', 'In every room from day one'],
    [{ kind: 'set', set: 'cottage' }, 'Read 4 weekly recaps', 'Read 4 weekly recaps'],
  ] as const;
  for (const [rule, line, spoken] of cases) expect([unlockLine(rule), unlockSpoken(rule)]).toEqual([line, spoken]);
  expect(spokenName('art.band')).toBe('Band poster, “The Naps”');
});

it('shows progress where it is cheap', () => {
  const facts = { levels: { STEADY_BEDTIME: 2 }, recapsRead: 5, buddyCheers: 3 };
  expect(progressLine({ kind: 'family', family: 'STEADY_BEDTIME', level: 3 }, facts)).toBe('level II now');
  expect(progressLine({ kind: 'family', family: 'STEP_GOAL', level: 1 }, facts)).toBe('No level yet');
  expect(progressLine({ kind: 'anyFamily', level: 4 }, facts)).toBe('highest level II now');
  expect(progressLine({ kind: 'counter', counter: 'recaps_read', atLeast: 8 }, facts)).toBe('5 of 8 read');
  expect(progressLine({ kind: 'counter', counter: 'buddy_cheers', atLeast: 10 }, facts)).toBe('3 of 10');
  expect(progressLine({ kind: 'set', set: 'cottage' }, { ...facts, recapsRead: 2 })).toBe('2 of 4 read');
  expect(progressLine({ kind: 'starter' }, facts)).toBe('');
});

it('says nothing is sold, and no string carries a price', () => {
  expect(ROOM_COPY.arrive.lines.at(-1)).toBe('Nothing is sold. The starter room is yours from day one, and items are never taken away.');
  // JSON.stringify drops the functions, so the composed strings are checked too (ruling 32).
  const composed = [ROOM_COPY.newFor('x', 2), ROOM_COPY.backfill(3), ROOM_COPY.set.pieces(13, 'y')];
  expect(composed).toEqual(["New for KIP's room: x and 2 more", "Your badges unlocked 3 things for KIP's room", '13 pieces · y']);
  for (const s of [JSON.stringify(ROOM_COPY), ...composed]) expect(s).not.toMatch(/\$|£|€|price|buy|coins?\b/i);
});
