import { readFileSync } from 'fs';
import { join } from 'path';
import { apiFetch } from '../../src/api/client';
import { HEALTH_SHARE_KEYS, SHARE_KEYS } from '../../src/api/buddies';
import {
  GIFT_NOTES, cheerBuddyRoom, cheerEntry, enterChallenge, fetchBuddyRoom, fetchChallenge, fetchGifts, fetchRoomCheers, openGift, sendGift,
} from '../../src/api/rooms';

jest.mock('../../src/api/client');
const api = apiFetch as jest.Mock;
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const post = (body: unknown) => ({ method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue({});
});

// The backend's lists, read as text (never imported): the app's copies must match them one for one.
const backend = (path: string) => readFileSync(join(__dirname, '../../../backend/src', path), 'utf8');
const listIn = (source: string, name: string) =>
  [...(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(source)?.[1] ?? '').matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);

it('reads a buddy\'s room and cheers it, the id encoded (spec 2026-10-15 §12 P4, ruling 8)', async () => {
  await fetchBuddyRoom('a/b');
  expect(api).toHaveBeenLastCalledWith('/me/buddies/a%2Fb/room');
  await cheerBuddyRoom('b1');
  expect(api).toHaveBeenLastCalledWith('/me/buddies/b1/room/cheer', post({}));
  await fetchRoomCheers();
  expect(api).toHaveBeenLastCalledWith('/me/room/cheers');
});

it('sends a gift with the app\'s request id as its id, lists gifts and opens one (ruling 11)', async () => {
  await sendGift('b1', '7f0c1b9e-0000-4000-8000-000000000001', 'plant.fern', 'cosy');
  expect(api).toHaveBeenLastCalledWith(
    '/me/buddies/b1/gifts',
    post({ requestId: '7f0c1b9e-0000-4000-8000-000000000001', itemId: 'plant.fern', note: 'cosy' }),
  );
  await fetchGifts();
  expect(api).toHaveBeenLastCalledWith('/me/gifts');
  await openGift('g 1');
  expect(api).toHaveBeenLastCalledWith('/me/gifts/g%201/open', post({}));
});

it('reads the week\'s challenge, enters it and cheers an entry (rulings 5-7, 10)', async () => {
  await fetchChallenge();
  expect(api).toHaveBeenLastCalledWith('/me/challenge');
  await enterChallenge();
  expect(api).toHaveBeenLastCalledWith('/me/challenge/entry', post({}));
  await cheerEntry('u/1');
  expect(api).toHaveBeenLastCalledWith('/me/challenge/entries/u%2F1/cheer', post({}));
});

it('keeps the gift notes and the share keys in step with the server', () => {
  expect(GIFT_NOTES).toEqual(listIn(backend('room/gifts.ts'), 'GIFT_NOTES'));
  expect(HEALTH_SHARE_KEYS).toEqual(listIn(backend('buddies/sharing.ts'), 'HEALTH_SHARE_KEYS'));
  expect(SHARE_KEYS).toEqual([...HEALTH_SHARE_KEYS, 'room']);
});
