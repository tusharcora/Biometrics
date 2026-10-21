import { ADVICE, HEALTH_VERB, advises, copyStrings } from '../../jest-mocks/adviceGuard';
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { buddyErrorMessage } from '../../src/lib/buddyCopy';
import { ITEM_NAMES, ROOM_COPY, SET_NAMES, itemName, progressLine, roomErrorMessage, spokenName, unlockLine, unlockSpoken } from '../../src/lib/room/roomCopy';

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

it('never gives health advice on a visit (PF4-F17): only the house "Try again" button is exempt', () => {
  const lines = copyStrings(ROOM_COPY.visit);
  expect(lines).toEqual(expect.arrayContaining(["Just looking: you can't move anything", "Cheer fern's room", 'A weekly challenge trophy']));
  expect(lines.length).toBeGreaterThan(15);
  const checked = lines.filter((s) => s !== 'Try again');
  expect(lines.length - checked.length).toBe(1);
  for (const s of checked) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  // Spoken lines never carry "·" or "×", and never say what they earned.
  for (const s of [ROOM_COPY.visit.sizeSpoken({ n: 8, m: 8 }, 44), ROOM_COPY.visit.cheeredPaidSpoken]) expect(s).not.toMatch(/·|×|−/);
  for (const s of lines) expect(s).not.toMatch(/earned/i);
});

it('never gives health advice in the share card copy (PF4-F17), and its spoken lines carry no "·", "×" or "−"', () => {
  const S = ROOM_COPY.share;
  const lines = copyStrings(S);
  expect(lines).toEqual(expect.arrayContaining(['Share your room', 'Makes an image; nothing is posted', "KIP's room", 'Save image', 'Share…']));
  expect(lines.length).toBeGreaterThan(15);
  // No exemption: the share card has no "Try again" button, and its failed line names no retry.
  for (const s of lines) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  for (const s of [S.metaSpoken({ n: 8, m: 8 }, 31, 'Cosy autumn'), S.metaSpoken({ n: 8, m: 8 }, 31, null), S.label]) expect(s).not.toMatch(/·|×|−/);
  // Earn-only and no health number: the card shows the room only.
  expect(lines.join(' ')).not.toMatch(/\$|buy|price|coin|\d+ (steps|minutes|hours)|%/i);
});

it('never gives health advice in the gift and cheer copy (PF4-F17), and its spoken lines carry no "·", "×" or "−"', () => {
  const G = ROOM_COPY.gifts;
  const lines = copyStrings(G);
  expect(lines).toEqual(expect.arrayContaining(['Send fern a gift', 'From your spares', 'Thought of you', 'Send gift', 'Cheers on your room']));
  expect(lines.length).toBeGreaterThan(20);
  // Only the house "Try again" button label is exempt (PF4-F17).
  const checked = lines.filter((s) => s !== 'Try again');
  expect(lines.length - checked.length).toBe(1);
  for (const s of checked) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  expect([G.waiting(1), G.waiting(2)]).toEqual(['1 gift waiting. Open one', '2 gifts waiting. Open one']);
  for (const s of [G.spareSpoken('Fern', 2), G.box('Maya'), G.box(null), G.cheersSpoken(2), G.waiting(2)]) expect(s).not.toMatch(/·|×|−/);
  expect(G.notes).toEqual({ desk: 'For your desk', cosy: 'Cosy!', thought: 'Thought of you' });
  // Earn-only: a gift is a piece you already own, never bought for it.
  expect(lines.join(' ')).not.toMatch(/\$|buy|price|coin/i);
});

it('the P4 screens\' error lines never give advice, for every server code and none (PF4-F17, FINAL-I2)', () => {
  // Every code in backend/src/buddies/errors.ts BUDDY_ERROR_STATUS (a superset of what the P4 routes answer), plus a
  // code this build doesn't know, plus no code at all.
  const codes: (string | null)[] = [
    'invalid_handle', 'invalid_display_name', 'setup_incomplete', 'handle_taken', 'rate_limited', 'try_later', 'handle_required',
    'mood_notice_required', 'consent_required', 'stale_consent_version', 'invalid_settings', 'code_invalid', 'own_handle',
    'not_found', 'blocked_by_you', 'too_many_pending', 'request_gone', 'not_buddies', 'sticker_limit', 'invalid_sticker',
    'invalid_cursor', 'invalid_checkin', 'recap_not_found', 'goodnight_closed', 'undo_expired', 'invalid_note',
    'invalid_message', 'message_gone', 'invalid_reaction', 'card_unavailable', 'invalid_status_note', 'invalid_report',
    'report_target_gone', 'already_cheered', 'not_spare', 'gift_limit', 'gift_gone', 'challenge_closed', 'no_challenge',
    'invalid_body', 'a_newer_code', null,
  ];
  for (const code of codes) {
    const s = roomErrorMessage(code);
    expect({ code, s, advises: advises(s), dot: /·|−/.test(s) }).toEqual({ code, s, advises: false, dot: false });
  }
  // The busy server and the unknown answer read as ROOM_COPY's own neutral lines; the P4 codes keep their lines.
  expect([roomErrorMessage('try_later'), roomErrorMessage('rate_limited')]).toEqual([ROOM_COPY.errors.busy, ROOM_COPY.errors.busy]);
  expect([roomErrorMessage(null), roomErrorMessage('a_newer_code'), roomErrorMessage('not_found')]).toEqual(Array(3).fill(ROOM_COPY.errors.unknown));
  expect(roomErrorMessage('gift_limit')).toBe(buddyErrorMessage('gift_limit'));
  expect(copyStrings(ROOM_COPY.errors).filter(advises)).toEqual([]);
});

