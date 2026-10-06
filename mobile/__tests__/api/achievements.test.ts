import { apiFetch } from '../../src/api/client';
import { fetchAchievements, markCelebrated } from '../../src/api/achievements';

jest.mock('../../src/api/client');
const api = apiFetch as jest.Mock;

beforeEach(() => api.mockReset());

it('reads the badges, tolerating a missing uncelebrated list', async () => {
  api.mockResolvedValue({ since: '2026-10-01', families: [] });
  expect(await fetchAchievements()).toEqual({ since: '2026-10-01', families: [], uncelebrated: [] });
  expect(api).toHaveBeenLastCalledWith('/me/achievements');
});

it('reads a 404 (a backend older than badges) as null, and rethrows any other failure', async () => {
  api.mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }));
  expect(await fetchAchievements()).toBeNull();
  api.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
  await expect(fetchAchievements()).rejects.toThrow('boom');
});

it('throws on a body that is not badges', async () => {
  api.mockResolvedValue({ status: 'CONNECTED' });
  await expect(fetchAchievements()).rejects.toThrow('bad_achievements');
});

it('marks levels celebrated with their ids', async () => {
  api.mockResolvedValue({ celebrated: 2 });
  await markCelebrated(['a1', 'a2']);
  expect(api).toHaveBeenLastCalledWith('/me/achievements/celebrated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ['a1', 'a2'] }),
  });
});
