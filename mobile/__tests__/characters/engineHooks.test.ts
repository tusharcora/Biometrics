import { renderHook } from '@testing-library/react-native';
import { useLoop } from '../../src/components/characters/engine/useLoop';
import { MOOD_FADE_MS, useMoodLayer } from '../../src/components/characters/engine/useMoodLayer';
import type { CharacterMood } from '../../src/components/characters/types';

describe('useLoop', () => {
  it('holds progress at 0 (the still pose) while paused', () => {
    const { result } = renderHook(() => useLoop(1000, true));
    expect(result.current.value).toBe(0);
  });

  it('snaps back to the still pose when paused after running', () => {
    const { result, rerender } = renderHook(({ paused }: { paused: boolean }) => useLoop(1000, paused), { initialProps: { paused: false } });
    rerender({ paused: true });
    expect(result.current.value).toBe(0);
  });
});

describe('useMoodLayer', () => {
  it('starts fully shown for the current mood and hidden otherwise', () => {
    const shown = renderHook(() => useMoodLayer('idle', 'idle', false));
    const hidden = renderHook(() => useMoodLayer('idle', 'thinking', false));
    expect(shown.result.current.value).toBe(1);
    expect(hidden.result.current.value).toBe(0);
  });

  it('switches instantly when paused (Reduce Motion)', () => {
    const { result, rerender } = renderHook(({ mood }: { mood: CharacterMood }) => useMoodLayer(mood, 'idle', true), {
      initialProps: { mood: 'idle' as CharacterMood },
    });
    rerender({ mood: 'thinking' });
    expect(result.current.value).toBe(0);
    rerender({ mood: 'idle' });
    expect(result.current.value).toBe(1);
  });

  it('cross-fades over a quarter second', () => {
    expect(MOOD_FADE_MS).toBe(250);
  });
});
