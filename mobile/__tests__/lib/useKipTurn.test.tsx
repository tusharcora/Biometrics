import { act, renderHook } from '@testing-library/react-native';
import { TURN_FRAME_MS, useKipTurn } from '../../src/lib/useKipTurn';
import type { KipStage } from '../../src/lib/kipStage';

const THINKING: KipStage = { id: 'thinking', pose: 'type', mood: 'glance', bubble: 'ON IT…', screen: 'dots' };
const ANSWERING: KipStage = { id: 'answering', pose: 'point', mood: 'glance', bubble: "HERE'S MY TAKE", screen: 'chart' };
const IDLE: KipStage = { id: 'idle', pose: 'rest', mood: 'idle', bubble: null, screen: 'lines' };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('types facing the desk', () => {
  const { result } = renderHook(() => useKipTurn(THINKING, false));
  expect(result.current).toEqual({ pose: 'type', mood: 'glance', facing: 'desk' });
});

it('turns from the desk to you over two 80 ms frames, then points (§4)', () => {
  const { result, rerender } = renderHook(({ s }: { s: KipStage }) => useKipTurn(s, false), { initialProps: { s: THINKING } });
  rerender({ s: ANSWERING });
  expect(result.current).toEqual({ pose: 'rest', mood: 'glance', facing: 'desk' });
  act(() => { jest.advanceTimersByTime(TURN_FRAME_MS); });
  expect(result.current).toEqual({ pose: 'rest', mood: 'glance', facing: 'you' });
  act(() => { jest.advanceTimersByTime(TURN_FRAME_MS); });
  expect(result.current).toEqual({ pose: 'point', mood: 'glance', facing: 'you' });
});

it('cuts straight to point under Reduce Motion', () => {
  const { result, rerender } = renderHook(({ s }: { s: KipStage }) => useKipTurn(s, true), { initialProps: { s: THINKING } });
  rerender({ s: ANSWERING });
  expect(result.current).toEqual({ pose: 'point', mood: 'glance', facing: 'you' });
  expect(jest.getTimerCount()).toBe(0);
});

it('Reduce Motion switched on mid-turn cuts to point (Review Focus 4)', () => {
  const { result, rerender } = renderHook(({ s, rm }: { s: KipStage; rm: boolean }) => useKipTurn(s, rm), { initialProps: { s: THINKING, rm: false } });
  rerender({ s: ANSWERING, rm: false });
  expect(result.current).toEqual({ pose: 'rest', mood: 'glance', facing: 'desk' });
  rerender({ s: ANSWERING, rm: true });
  expect(result.current).toEqual({ pose: 'point', mood: 'glance', facing: 'you' });
  act(() => { jest.advanceTimersByTime(TURN_FRAME_MS * 2); });
  expect(result.current).toEqual({ pose: 'point', mood: 'glance', facing: 'you' });
});

it('a stage change mid-turn drops the turn', () => {
  const { result, rerender } = renderHook(({ s }: { s: KipStage }) => useKipTurn(s, false), { initialProps: { s: THINKING } });
  rerender({ s: ANSWERING });
  rerender({ s: IDLE });
  expect(result.current).toEqual({ pose: 'rest', mood: 'idle', facing: 'you' });
  act(() => { jest.advanceTimersByTime(TURN_FRAME_MS * 2); });
  expect(result.current).toEqual({ pose: 'rest', mood: 'idle', facing: 'you' });
});

it('any other change is immediate', () => {
  const { result, rerender } = renderHook(({ s }: { s: KipStage }) => useKipTurn(s, false), { initialProps: { s: ANSWERING } });
  rerender({ s: IDLE });
  expect(result.current).toEqual({ pose: 'rest', mood: 'idle', facing: 'you' });
});
