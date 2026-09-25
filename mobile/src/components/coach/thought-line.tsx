import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Text } from '../ui/text';
import { COLORS } from '../../theme';

// The coach's "working on it" line: a breathing sparkle, a label with a light
// sweeping across it, and an elapsed timer, which settles into "Thought for
// 2.4s" once the reply is in. Inspired by React Bits' Thought Line; written
// for React Native from scratch (React Bits' licence does not allow
// redistributing a port, and this repository is public).

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const BREATH_PERIOD_MS = 1600;
const BREATH_DEPTH = 0.45;
const SWEEP_MS = 1800;
const SETTLE_MS = 350;
const SETTLED_GLYPH_OPACITY = 0.55;
// Opacity of a letter the sweep is not currently passing over.
const SWEEP_FLOOR = 0.45;
// How far either side of the sweep's centre (in label-widths) a letter lights up.
const SWEEP_HALF_WIDTH = 0.22;

/** "2.4s" under a minute, "1m 3.0s" from there on. Rounds down to tenths. */
export function formatThoughtTime(seconds: number): string {
  const tenths = Math.floor(seconds * 10 + 1e-6);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`;
  return `${Math.floor(tenths / 600)}m ${((tenths % 600) / 10).toFixed(1)}s`;
}

function spokenThoughtTime(seconds: number): string {
  const tenths = Math.floor(seconds * 10 + 1e-6);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} seconds`;
  return `${Math.floor(tenths / 600)} minutes ${((tenths % 600) / 10).toFixed(1)} seconds`;
}

export interface ThoughtLineProps {
  /** True while the coach is working; false once the reply is in. */
  working: boolean;
  /**
   * Seconds to show once settled, from the caller's own clock. Omitted, the
   * line shows how long it counted itself while working.
   */
  elapsedSeconds?: number;
  label?: string;
  testID?: string;
}

export function ThoughtLine({ working, elapsedSeconds, label = 'Thinking…', testID }: ThoughtLineProps) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const reduceMotion = useReducedMotion();
  const tenths = useElapsedTenths(working);
  const settledSeconds = elapsedSeconds ?? tenths / 10;

  const glyphOpacity = useSharedValue(working ? 1 : SETTLED_GLYPH_OPACITY);
  const sweep = useSharedValue(0);
  const settle = useSharedValue(working ? 0 : 1);

  useEffect(() => {
    if (working) {
      // Reduce Motion keeps a gentler, slower breath and drops the sweep.
      const depth = reduceMotion ? Math.min(BREATH_DEPTH, 0.2) : BREATH_DEPTH;
      const half = (reduceMotion ? BREATH_PERIOD_MS * 1.5 : BREATH_PERIOD_MS) / 2;
      glyphOpacity.value = withRepeat(
        withSequence(
          withTiming(1 - depth, { duration: half, easing: EASE_IN_OUT }),
          withTiming(1, { duration: half, easing: EASE_IN_OUT }),
        ),
        -1,
      );
      sweep.value = 0;
      if (!reduceMotion) {
        sweep.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false);
      }
      settle.value = 0;
    } else {
      cancelAnimation(sweep);
      glyphOpacity.value = withTiming(SETTLED_GLYPH_OPACITY, { duration: SETTLE_MS, easing: EASE_OUT });
      settle.value = withTiming(1, { duration: SETTLE_MS, easing: EASE_OUT });
    }
    return () => {
      cancelAnimation(glyphOpacity);
      cancelAnimation(sweep);
    };
    // Shared values are stable; the animation restarts only when the state or
    // the Reduce Motion setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, reduceMotion]);

  const glyphStyle = useAnimatedStyle(() => ({ opacity: glyphOpacity.value }));
  const settledStyle = useAnimatedStyle(() => ({ opacity: settle.value }));

  const accessibilityLabel = working ? 'Thinking' : `Thought for ${spokenThoughtTime(settledSeconds)}`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-1.5 px-1"
    >
      <Animated.View style={glyphStyle}>
        <Ionicons name="sparkles" size={15} color={colors.accent} />
      </Animated.View>
      {working ? (
        <>
          <View className="flex-row">
            {reduceMotion ? (
              <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
            ) : (
              Array.from(label).map((char, index, all) => (
                <SweepChar key={`${index}-${char}`} char={char} position={all.length > 1 ? index / (all.length - 1) : 0} sweep={sweep} />
              ))
            )}
          </View>
          <Text testID={testID ? `${testID}-timer` : undefined} className="text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {formatThoughtTime(tenths / 10)}
          </Text>
        </>
      ) : (
        <Animated.View style={settledStyle}>
          <Text className="text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {`Thought for ${formatThoughtTime(settledSeconds)}`}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// One letter of the label. The sweep's centre travels from before the first
// letter to past the last; each letter brightens as the centre passes over it.
function SweepChar({ char, position, sweep }: { char: string; position: number; sweep: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const centre = -SWEEP_HALF_WIDTH + sweep.value * (1 + SWEEP_HALF_WIDTH * 2);
    const distance = Math.abs(centre - position);
    const lit = Math.max(0, 1 - distance / SWEEP_HALF_WIDTH);
    return { opacity: SWEEP_FLOOR + (1 - SWEEP_FLOOR) * lit };
  });
  return (
    <Animated.Text className="text-sm font-medium text-muted-foreground" style={style}>
      {char}
    </Animated.Text>
  );
}

// Tenths of a second since `working` last became true, ticking every 100 ms;
// frozen (not reset) once working ends so the settled line can show it.
function useElapsedTenths(working: boolean): number {
  const [tenths, setTenths] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!working) return undefined;
    startedAt.current = Date.now();
    setTenths(0);
    const id = setInterval(() => {
      if (startedAt.current !== null) setTenths(Math.floor((Date.now() - startedAt.current) / 100));
    }, 100);
    return () => clearInterval(id);
  }, [working]);

  return tenths;
}
