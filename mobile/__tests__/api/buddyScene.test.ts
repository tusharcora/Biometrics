import { apiFetch } from '../../src/api/client';
import { fetchBuddyScene } from '../../src/api/buddies';

jest.mock('../../src/api/client');

const row = { id: 'b1', handle: 'ava', displayName: 'Ava', coachId: 'mochi', kipColour: 'mint', mood: 'good', moodLine: 'Feeling great', unseenSticker: false };

beforeEach(() => jest.clearAllMocks());

it('reads the scene\'s buddies, total and incoming requests', async () => {
  (apiFetch as jest.Mock).mockResolvedValue({ buddies: [row], total: 4, incomingRequests: 1 });
  await expect(fetchBuddyScene()).resolves.toEqual({ buddies: [row], total: 4, incomingRequests: 1 });
  expect(apiFetch).toHaveBeenCalledWith('/me/buddies/scene');
});

it('is null for a bare 404 (an older server), and throws for a coded 404', async () => {
  (apiFetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 404 }));
  await expect(fetchBuddyScene()).resolves.toBeNull();
  (apiFetch as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 404, code: 'not_buddies' }));
  await expect(fetchBuddyScene()).rejects.toThrow();
});

it('never makes up a count', async () => {
  for (const body of [undefined, [], { buddies: [row], total: -1, incomingRequests: 0 }, { buddies: [row], total: 1 }, { buddies: 'x', total: 1, incomingRequests: 0 }]) {
    (apiFetch as jest.Mock).mockResolvedValueOnce(body);
    await expect(fetchBuddyScene()).rejects.toThrow('bad_buddy_scene');
  }
});
