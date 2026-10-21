// The challenge, the pure parts and the copy guard (spec 2026-10-15 §10.4, §8.3's words; P4 rulings 4, 7; PF4-F17).
import { advises, copyStrings } from '../../jest-mocks/adviceGuard';
import { briefCount, checklist, daysLeft, entryRoom } from '../../src/lib/room/challenge';
import { starterLayout } from '../../src/lib/room/layout';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';

const pumpkin = (id: string, x: number) => ({ id, item: 'corner.pumpkin', layer: 'floor' as const, x, y: 6, facing: 'L' as const, mirror: false });

it('counts the theme\'s pieces in the room (the starter room has 2 warm ones: the amber lamp and the mug)', () => {
  const room = { ...starterLayout(), pieces: [...starterLayout().pieces, pumpkin('p1', 6)] };
  expect(briefCount(starterLayout(), 'warm')).toBe(2);
  expect(checklist(room, { tag: 'warm', atLeast: 3 })).toEqual({ count: 3, atLeast: 3, met: true });
  expect(checklist(starterLayout(), { tag: 'warm', atLeast: 3 })).toEqual({ count: 2, atLeast: 3, met: false });
  // Once per placement: two pumpkins are two.
  expect(briefCount({ ...room, pieces: [...room.pieces, pumpkin('p2', 5)] }, 'warm')).toBe(4);
  expect(ROOM_COPY.challenge.checklist('Warm pieces', 2, 3)).toBe('Warm pieces · 2 of 3');
  expect(ROOM_COPY.challenge.checklistSpoken('Warm pieces', 2, 3)).toBe('Warm pieces, 2 of 3');
});

it('days left to the entrant\'s close, never below 0', () => {
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-10-29T12:00:00.000Z'))).toBe(3);
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-11-01T19:00:00.000Z'))).toBe(0);
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-11-02T19:00:00.000Z'))).toBe(0);
  // A close the app can't read is the last day, never NaN.
  expect(daysLeft('not a date', new Date('2026-11-01T19:00:00.000Z'))).toBe(0);
  expect(ROOM_COPY.challenge.daysLeft(3)).toBe('3 days left');
  expect(ROOM_COPY.challenge.daysLeft(1)).toBe('1 day left');
  expect(ROOM_COPY.challenge.daysLeft(0)).toBe('Last day');
});

it('reads an entry snapshot as a room; a broken one is the starter room', () => {
  expect(entryRoom({ layout: starterLayout(), size: { n: 9, m: 9 } }).tier).toBe(3);
  expect(entryRoom({ layout: null, size: { n: 7, m: 7 } }).layout).toEqual(starterLayout());
  expect(entryRoom({ layout: starterLayout(), size: null as unknown as { n: number; m: number } })).toMatchObject({ tier: 1, size: { n: 7, m: 7 } });
});

it('challenge copy gives no health advice (PF4-F17): only the four briefs ("Use n or more …") and the house "Try again" are exempt', () => {
  const C = ROOM_COPY.challenge;
  const lines = copyStrings(C);
  expect(lines).toEqual(expect.arrayContaining(['Room challenge', 'Start my entry', 'Your entry is a snapshot of your room on Sunday. Build as usual until then.']));
  expect(lines.length).toBeGreaterThan(40);
  const briefs = Object.values(C.themes).map((t) => t.brief);
  expect(Object.keys(C.themes)).toEqual(['cosyAutumn', 'greenThumb', 'nightOwl', 'tidyDesk']);
  // The exemption is exactly this shape, and it is needed: "more" trips the guard.
  for (const b of briefs) expect({ b, shape: /^Use \d+ or more [a-z ]+\.$/.test(b), advises: advises(b) }).toEqual({ b, shape: true, advises: true });
  const checked = lines.filter((s) => s !== 'Try again' && !briefs.includes(s));
  expect(lines.length - checked.length).toBe(5);
  expect(advises('Try again')).toBe(true);
  for (const s of checked) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  // Spoken lines never carry "·", "×" or "−" (PF4-F15).
  for (const s of [C.checklistSpoken('Warm pieces', 2, 3), C.enteredPaidSpoken, C.headSpoken, C.resultSpoken('Maya', 4)]) expect(s).not.toMatch(/·|×|−/);
});

it('visit, gift and challenge copy names no health number (Global Constraints)', () => {
  const HEALTH_WORD = /\b(steps?|hours? of sleep|sleep score|recovery|bpm|hrv)\b/i;
  const lines = copyStrings([ROOM_COPY.visit, ROOM_COPY.gifts, ROOM_COPY.challenge]);
  for (const s of lines) expect({ s, health: HEALTH_WORD.test(s) }).toEqual({ s, health: false });
});
