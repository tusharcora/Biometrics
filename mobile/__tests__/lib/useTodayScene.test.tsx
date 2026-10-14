import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTodayScene } from '../../src/lib/home/useTodayScene';
import { fetchScoresWithBands } from '../../src/api/scores';
import { fetchSleep } from '../../src/api/sleep';
import { sceneState, todayScore, todayWeather } from '../../src/lib/home/scene';
import { verdictWord } from '../../src/lib/kipCopy';
import { scoreBand } from '../../src/lib/scoreInsights';

jest.mock('../../src/api/scores', () => ({ ...jest.requireActual('../../src/api/scores'), fetchScoresWithBands: jest.fn() }));
jest.mock('../../src/api/sleep', () => ({ ...jest.requireActual('../../src/api/sleep'), fetchSleep: jest.fn() }));

const scores = fetchScoresWithBands as jest.Mock;
const sleep = fetchSleep as jest.Mock;
const nav = () => {
  const listeners: Record<string, () => void> = {};
  return { listeners, isFocused: () => true, addListener: (e: string, cb: () => void) => { listeners[e] = cb; return () => delete listeners[e]; } };
};
// 10:00 local on Wed 14 Oct 2026: day, so the window follows the recovery band.
const TEN_AM = new Date(2026, 9, 14, 10, 0, 0);
const RESULT = { scores: [{ type: 'RECOVERY', date: '2026-10-14', score: 58 }], bands: undefined };

beforeEach(() => {
  jest.useFakeTimers({ now: TEN_AM });
  scores.mockResolvedValue(RESULT);
  sleep.mockResolvedValue({ nights: [] });
});
afterEach(() => jest.useRealTimers());

it('gives Home and the KIP page the same state for the same reads', async () => {
  const a = renderHook(() => useTodayScene(nav()));
  const b = renderHook(() => useTodayScene(nav()));
  await waitFor(() => expect(a.result.current.scores.status).toBe('ready'));
  await waitFor(() => expect(b.result.current.scores.status).toBe('ready'));
  expect(a.result.current.scene).toEqual(b.result.current.scene);
  const weather = todayWeather(todayScore(RESULT.scores as never, 'RECOVERY', '2026-10-14'), undefined);
  const expected = sceneState({ now: TEN_AM, recovery: weather, night: null });
  expect(a.result.current.scene).toEqual(expected);
  expect(a.result.current.weather).toBe(weather);
  // The default bands decide 58's band: computed, not hard-coded.
  const band = scoreBand(58, undefined);
  expect(a.result.current.recovery).toEqual({ score: 58, band });
  expect(verdictWord(a.result.current.recovery.band)).toBe(verdictWord(band));
});

it('a failed read gives the fallback window and rest / curious, and never throws', async () => {
  scores.mockRejectedValue(new Error('down'));
  sleep.mockRejectedValue(new Error('down'));
  const { result } = renderHook(() => useTodayScene(nav()));
  await waitFor(() => expect(result.current.scores.status).toBe('failed'));
  expect(result.current.scene).toMatchObject({ key: 'fallback', pose: 'rest', mood: 'curious' });
  expect(result.current.window).toEqual({ weather: 'fallback', night: false });
  expect(result.current.recovery).toEqual({ score: null, band: null });
});

it('turns to night at 20:00 by itself while focused, with the moon in the window', async () => {
  jest.setSystemTime(new Date(2026, 9, 14, 19, 59, 0));
  const { result } = renderHook(() => useTodayScene(nav()));
  await waitFor(() => expect(result.current.scores.status).toBe('ready'));
  expect(result.current.window.night).toBe(false);
  await act(async () => { jest.advanceTimersByTime(61_000); });
  expect(result.current.scene.key).toBe('night');
  expect(result.current.window).toEqual({ weather: 'fallback', night: true });
});

it('re-reads the clock on focus and on return to the foreground', async () => {
  const n = nav();
  const spy = jest.spyOn(AppState, 'addEventListener');
  const { result } = renderHook(() => useTodayScene(n));
  await waitFor(() => expect(result.current.scores.status).toBe('ready'));
  jest.setSystemTime(new Date(2026, 9, 14, 21, 0, 0));
  act(() => n.listeners.focus!());
  expect(result.current.scene.key).toBe('night');
  expect(spy).toHaveBeenCalledWith('change', expect.any(Function));
});

it('maps every band to its lower-case verdict word', () => {
  expect(['scoreExcellent', 'scoreGood', 'scoreFair', 'scorePoor'].map((b) => verdictWord(b as never))).toEqual(['excellent', 'good', 'fair', 'low']);
  expect(verdictWord(null)).toBeNull();
});
