import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { MoodLayers, type MoodLayerComponents, type MoodLayerProps } from '../../src/components/characters/engine/MoodLayers';
import { MOOD_FADE_MS } from '../../src/components/characters/engine/useMoodLayer';
import type { CharacterMood } from '../../src/components/characters/types';

// Skia's Group must not load under jest; a pass-through is enough to read each layer's props.
jest.mock('@shopify/react-native-skia', () => ({
  Group: ({ children }: { children: unknown }) => children,
}));

const MOODS: CharacterMood[] = ['idle', 'thinking', 'answering', 'resting'];

function layer(name: CharacterMood) {
  return function Layer({ paused }: MoodLayerProps) {
    return <Text testID={'layer-' + name}>{String(paused)}</Text>;
  };
}

const LAYERS: MoodLayerComponents = {
  idle: layer('idle'),
  thinking: layer('thinking'),
  answering: layer('answering'),
  resting: layer('resting'),
};

function ui(mood: CharacterMood, paused = false) {
  return <MoodLayers mood={mood} mini={false} paused={paused} layers={LAYERS} />;
}

function pausedStates(): Record<CharacterMood, string> {
  const out = {} as Record<CharacterMood, string>;
  for (const m of MOODS) out[m] = String(screen.getByTestId('layer-' + m).props.children);
  return out;
}

describe('MoodLayers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('initially animates only the current mood', () => {
    render(ui('idle'));
    expect(pausedStates()).toEqual({ idle: 'false', thinking: 'true', answering: 'true', resting: 'true' });
  });

  it('keeps the outgoing mood animating while it fades out', () => {
    const { rerender } = render(ui('idle'));
    rerender(ui('thinking'));
    expect(pausedStates()).toEqual({ idle: 'false', thinking: 'false', answering: 'true', resting: 'true' });
  });

  it('holds the outgoing mood still once the fade is over', () => {
    const { rerender } = render(ui('idle'));
    rerender(ui('thinking'));
    act(() => {
      jest.advanceTimersByTime(MOOD_FADE_MS);
    });
    expect(pausedStates()).toEqual({ idle: 'true', thinking: 'false', answering: 'true', resting: 'true' });
  });

  it('only keeps the most recent outgoing mood animating on rapid changes', () => {
    const { rerender } = render(ui('idle'));
    rerender(ui('thinking'));
    act(() => {
      jest.advanceTimersByTime(MOOD_FADE_MS / 2);
    });
    rerender(ui('answering'));
    expect(pausedStates()).toEqual({ idle: 'true', thinking: 'false', answering: 'false', resting: 'true' });
    // The earlier timer must not cut the new fade short.
    act(() => {
      jest.advanceTimersByTime(MOOD_FADE_MS / 2);
    });
    expect(pausedStates().thinking).toBe('false');
    act(() => {
      jest.advanceTimersByTime(MOOD_FADE_MS / 2);
    });
    expect(pausedStates()).toEqual({ idle: 'true', thinking: 'true', answering: 'false', resting: 'true' });
  });

  it('holds every layer still when paused, before and after a mood change', () => {
    const { rerender } = render(ui('idle', true));
    const allPaused = { idle: 'true', thinking: 'true', answering: 'true', resting: 'true' };
    expect(pausedStates()).toEqual(allPaused);
    rerender(ui('thinking', true));
    expect(pausedStates()).toEqual(allPaused);
  });

  it('clears the fade timer on unmount', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, unmount } = render(ui('idle'));
    rerender(ui('thinking'));
    const fadeCall = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === MOOD_FADE_MS);
    expect(fadeCall).toBeGreaterThanOrEqual(0);
    const fadeTimer = setTimeoutSpy.mock.results[fadeCall].value;
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(fadeTimer);
    act(() => {
      jest.advanceTimersByTime(MOOD_FADE_MS);
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});
