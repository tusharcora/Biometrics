import { useEffect } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { CharacterMood } from '../types';

export const MOOD_FADE_MS = 250;

// Opacity of one mood's layer: 1 while it is the current mood, 0 otherwise,
// cross-fading over MOOD_FADE_MS. Paused (incl. Reduce Motion) switches instantly.
export function useMoodLayer(mood: CharacterMood, layer: CharacterMood, paused: boolean): SharedValue<number> {
  const opacity = useSharedValue(mood === layer ? 1 : 0);
  useEffect(() => {
    const target = mood === layer ? 1 : 0;
    opacity.value = paused ? target : withTiming(target, { duration: MOOD_FADE_MS });
  }, [mood, layer, paused, opacity]);
  return opacity;
}
