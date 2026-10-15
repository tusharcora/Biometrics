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
  expect([unlockLine({ kind: 'shop' }), unlockSpoken({ kind: 'shop' })]).toEqual(['From the coin shop', 'From the coin shop']);
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

it('says what Apply set left out and that your desk stayed (ruling T9-FIX)', () => {
  expect(ROOM_COPY.set.applied('Cottage', [], false)).toBe('Cottage set applied.');
  expect(ROOM_COPY.set.applied('Cottage', ['Farmhouse table'], true)).toBe('Cottage set applied. Not yours yet: Farmhouse table. Your desk stayed.');
  expect(ROOM_COPY.set.applied('Cottage', ['a', 'b', 'c', 'd', 'e'], false)).toBe('Cottage set applied. Not yours yet: a, b, c and 2 more.');
  expect(ROOM_COPY.set.applied('Cottage', ['a', 'b'], true)).not.toMatch(/·|−/);
});

it('never prices anything in money: no currency, no real-money or ad copy (spec §6.1, ruling 11)', () => {
  // JSON.stringify drops the functions, so every composed string is checked with sample arguments too.
  const C = ROOM_COPY.coins;
  const F = ROOM_COPY.firstWeek;
  const composed = [
    ROOM_COPY.newFor('x', 2), ROOM_COPY.backfill(3), ROOM_COPY.set.pieces(13, 'y'),
    C.walletLabel('1,500'), C.earnedToday(40, 60), C.earnedTodaySpoken(40, 60), C.landSpoken(20, 'Sleep goal hit'),
    C.amount(20, false), C.amount(0, true), C.amount(-150, false), C.amountSpoken(20, false), C.amountSpoken(0, true), C.amountSpoken(-150, false),
    C.dated('Mon', 9, 'Nov'), C.today(7, 12), C.rowSpoken('Coin shop', 'Yesterday', 'minus 150 coins'), C.bubble(20),
    C.landLine('Sleep goal hit', 2), C.landLine('Sleep goal hit', 0),
    F.head(4, 4), F.headSpoken(4, 4), F.reward(10, true), F.reward(-40, false), F.rowSpoken('x', true, -40, false),
    F.rowSpoken('x', false, 25, true), F.next('600', 14), F.nextSpoken('600', 14),
  ];
  expect(composed.slice(0, 3)).toEqual(["New for KIP's room: x and 2 more", "Your badges unlocked 3 things for KIP's room", '13 pieces · y']);
  for (const s of [JSON.stringify(ROOM_COPY), ...composed]) {
    expect(s).not.toMatch(/[$£€¥]|\b(USD|EUR|GBP)\b|get more coins|buy coins|coin pack|in-app purchase|watch an ad|\bads?\b/i);
  }
});

it('tells how coins arrive, and that nothing is sold for money (spec §5.4, §6.1)', () => {
  const items = ROOM_COPY.arrive.items;
  expect(items.find((i) => i.lead === 'KIP coins.')!.body).toBe('Healthy days earn coins, up to 60 a day. The coin shop turns them into new pieces and extra copies.');
  expect(items.at(-1)!.body).toBe('Nothing is sold for money: coins come only from healthy days. The starter room is yours from day one, and items are never taken away.');
});

it('the first-week list reads its rows and lines aloud without "·" or "−" (spec §11.2)', () => {
  const F = ROOM_COPY.firstWeek;
  expect([F.reward(10, true), F.reward(5, false), F.reward(-40, false)]).toEqual(['+10 bonus', '+5', '−40']);
  for (const s of [F.headSpoken(4, 4), F.rowSpoken('x', true, -40, false), F.rowSpoken('x', false, 25, true), F.nextSpoken('600', 14)]) {
    expect(s).not.toMatch(/·|−/);
  }
});
