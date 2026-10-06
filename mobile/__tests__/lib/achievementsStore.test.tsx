import { act, renderHook } from '@testing-library/react-native';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { fetchAchievements, markCelebrated } from '../../src/api/achievements';
import {
  celebrate, getAchievementsSnapshot, pendingLevels, refreshAchievements, resetAchievements, useAchievements,
} from '../../src/lib/achievementsStore';

jest.mock('../../src/api/achievements');
const load = fetchAchievements as jest.Mock;
const post = markCelebrated as jest.Mock;
const UNCELEBRATED = [{ id: 'a1', family: 'SLEEP_GOAL' as const, level: 1, value: 3, earnedOn: '2026-10-03' }];

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievements();
  post.mockResolvedValue(undefined);
});

it('loads the badges into one shared snapshot that screens subscribe to', async () => {
  load.mockResolvedValue(achievementsFixture());
  const { result } = renderHook(() => useAchievements());
  expect(result.current.state).toEqual({ status: 'idle' });
  await act(() => refreshAchievements());
  expect(result.current.state).toEqual({ status: 'ready', data: achievementsFixture() });
});

it('reads a 404 as unavailable and a first failure as an error', async () => {
  load.mockResolvedValue(null);
  await refreshAchievements();
  expect(getAchievementsSnapshot().state).toEqual({ status: 'unavailable' });
  resetAchievements();
  load.mockRejectedValue(new Error('offline'));
  await refreshAchievements();
  expect(getAchievementsSnapshot().state).toEqual({ status: 'error' });
});

it('keeps what it had when a later refresh fails', async () => {
  load.mockResolvedValue(achievementsFixture());
  await refreshAchievements();
  load.mockRejectedValue(new Error('offline'));
  await refreshAchievements();
  expect(getAchievementsSnapshot().state.status).toBe('ready');
});

it('shares one request between overlapping refreshes', async () => {
  let resolve!: (v: unknown) => void;
  load.mockReturnValue(new Promise((r) => { resolve = r; }));
  const a = refreshAchievements();
  const b = refreshAchievements();
  expect(load).toHaveBeenCalledTimes(1);
  resolve(achievementsFixture());
  await Promise.all([a, b]);
  expect(getAchievementsSnapshot().state.status).toBe('ready');
});

it('celebrating hides those levels at once and tells the server; a failed post still hides them this session', async () => {
  load.mockResolvedValue(achievementsFixture({}, { uncelebrated: UNCELEBRATED }));
  await refreshAchievements();
  expect(pendingLevels(getAchievementsSnapshot())).toEqual(UNCELEBRATED);
  post.mockRejectedValueOnce(new Error('offline'));
  await celebrate(['a1']);
  expect(post).toHaveBeenCalledWith(['a1']);
  expect(pendingLevels(getAchievementsSnapshot())).toEqual([]);
});

it('drops a refresh that was in flight when the store is reset (sign out)', async () => {
  let resolve!: (v: unknown) => void;
  load.mockReturnValue(new Promise((r) => { resolve = r; }));
  const run = refreshAchievements();
  resetAchievements();
  resolve(achievementsFixture());
  await run;
  expect(getAchievementsSnapshot().state).toEqual({ status: 'idle' });
});
