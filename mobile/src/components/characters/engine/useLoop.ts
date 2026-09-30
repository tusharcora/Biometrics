import { useEffect } from 'react';
import { cancelAnimation, Easing, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

// A 0→1 progress that repeats every durationMs on the UI thread. Paused holds
// it at 0, which every art component treats as its still pose (keyframe 0%).
export function useLoop(durationMs: number, paused: boolean): SharedValue<number> {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.value = 0;
    if (paused) return;
    t.value = withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [durationMs, paused, t]);
  return t;
}
