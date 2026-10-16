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
    F.rowSpoken('x', false, 25, true), F.next(8, '600', 14), F.nextSpoken(8, '600', 14),
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
  // The next size comes from the list's next tier, never a fixed 8 × 8 (ruling T14-FIX).
  expect(F.next(9, '1,500', 0)).toBe('Next: 9 × 9 · 1,500 coins and a 0-day check-in streak. See the next size in Room sizes.');
  expect(F.nextSpoken(9, '1,500', 0)).toBe('Next: 9 by 9, 1,500 coins and a 0-day check-in streak. See the next size in Room sizes.');
  expect(F.headSpoken(4, 4)).toBe('Day 4 of 7, 4 of 7 done');
  for (const s of [F.headSpoken(4, 4), F.rowSpoken('x', true, -40, false), F.rowSpoken('x', false, 25, true), F.nextSpoken(8, '600', 14)]) {
    expect(s).not.toMatch(/·|−|×/);
  }
});

/**
 * Every string under a copy object, with each function called on sample arguments: a name first or a number first,
 * at 0, 1 and 7, so every branch (awardCount's none, one and many) is read.
 */
const SAMPLE_ARGS: readonly (readonly unknown[])[] = [0, 1, 7].flatMap((n) => [['fern', n, n], [n, n, n]]);
function copyStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return SAMPLE_ARGS.flatMap((a) => copyStrings((v as (...a: unknown[]) => unknown)(...a)));
  if (v && typeof v === 'object') return Object.values(v).flatMap(copyStrings);
  return [];
}
const ADVICE = /\b(should|try|more|need|needs|must)\b/i;
// Health verbs that open a sentence. "Move" and "Store" are the room's own buttons (moving furniture is no advice).
const HEALTH_VERB = /(^|[.!?:]\s+)(sleep|walk|drink|rest|exercise|go|get|hit|reach|eat)\b/i;
const advises = (s: string) => ADVICE.test(s) || HEALTH_VERB.test(s);

it('never gives health advice in an effect or living line (spec §8.3, P3 ruling 18)', () => {
  for (const bad of ['Sleep more to grow your fern.', 'Walk 2,000 more steps to wake the cat.', 'You should rest.', 'Try for 8 hours.']) expect(advises(bad)).toBe(true);
  // Only the health-verb rule catches this one: no advice word in it.
  expect([ADVICE.test('Drink water.'), HEALTH_VERB.test('Drink water.'), advises('Drink water.')]).toEqual([false, true, true]);
  // Ruling 18 scans the piece card's strings too (Task 13).
  const lines = [...copyStrings(ROOM_COPY.effects), ...copyStrings(ROOM_COPY.card)];
  expect(lines).toEqual(expect.arrayContaining(['That piece has left your room.', 'Store the fern', 'fern card']));
  expect(lines).toEqual(expect.arrayContaining(['No awards on it yet.', '1 award so far.', '7 awards so far.']));
  expect(lines.length).toBeGreaterThan(15);
  for (const s of lines) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  expect([ROOM_COPY.effects.grew('fern', 7), ROOM_COPY.effects.pet.nap]).toEqual(['The fern grew: 7 nights at your goal.', 'The cat’s napping.']);
  expect(lines).toContain('The fern is fully grown.');
  expect(lines.join(' ')).not.toMatch(/\d+ (steps|minutes|hours)|%/); // never a health value
});
