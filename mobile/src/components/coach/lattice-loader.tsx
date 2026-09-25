import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { Text } from '../ui/text';
import { COLORS } from '../../theme';

// The coach's "working on it" indicator: a 3x3 grid of dots whose outer ring
// lights up one dot after another (an orbit), then a label and an elapsed
// timer. Once the reply is in it settles into a check mark drawn in dots and
// "Done in 2.4s". Inspired by React Bits' Lattice Loader; written for React
// Native from scratch (React Bits' licence does not allow redistributing a
// port, and this repository is public).

export type LatticeStatus = 'working' | 'done';

const DOT = 6;
const GAP = 2;
const IDLE = 0.15;
// Grid position -> the order its dot lights in the orbit; null is the empty centre.
const ORBIT: (number | null)[] = [0, 1, 2, 7, null, 3, 6, 5, 4];
const ORBIT_STEPS = 8;
// One dot's turn is 108 ms (a 90 ms step, slowed 1.2x), so a lap takes 864 ms.
const CYCLE_MS = 864;
// The dots that draw the check mark: top right, middle left, middle right, bottom middle.
const CHECK = new Set([2, 3, 5, 7]);
const SETTLE_MS = 200;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** "2.4s" under a minute, "1m 3.0s" from there on. Rounds down to tenths. */
export function formatElapsed(seconds: number): string {
  const tenths = Math.floor(seconds * 10 + 1e-6);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`;
  return `${Math.floor(tenths / 600)}m ${((tenths % 600) / 10).toFixed(1)}s`;
}

function spokenElapsed(seconds: number): string {
  const tenths = Math.floor(seconds * 10 + 1e-6);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} seconds`;
  return `${Math.floor(tenths / 600)} minutes ${((tenths % 600) / 10).toFixed(1)} seconds`;
}

export interface LatticeLoaderProps {
  status: LatticeStatus;
  /**
   * Seconds to show once done, from the caller's own clock. Omitted, the
   * loader shows how long it counted itself while working.
   */
  elapsedSeconds?: number;
  label?: string;
  doneLabel?: string;
  testID?: string;
}

export function LatticeLoader({ status, elapsedSeconds, label = 'Thinking', doneLabel = 'Done in', testID }: LatticeLoaderProps) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const reduceMotion = useReducedMotion();
  const working = status === 'working';
  const tenths = useElapsedTenths(working);
  const doneSeconds = elapsedSeconds ?? tenths / 10;

  // 0 -> 1 once per lap; every dot reads its brightness from this one clock.
  const clock = useSharedValue(0);
  // Reduce Motion: the whole grid breathes instead of orbiting.
  const breath = useSharedValue(1);
  const settle = useSharedValue(working ? 0 : 1);

  useEffect(() => {
    if (working) {
      settle.value = 0;
      if (reduceMotion) {
        breath.value = withRepeat(
          withSequence(withTiming(0.45, { duration: 1200 }), withTiming(1, { duration: 1200 })),
          -1,
        );
      } else {
        clock.value = 0;
        clock.value = withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false);
      }
    } else {
      cancelAnimation(clock);
      cancelAnimation(breath);
      breath.value = 1;
      settle.value = withTiming(1, { duration: SETTLE_MS, easing: EASE_OUT });
    }
    return () => {
      cancelAnimation(clock);
      cancelAnimation(breath);
    };
    // Shared values are stable; the animation restarts only when the status or
    // the Reduce Motion setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, reduceMotion]);

  const gridStyle = useAnimatedStyle(() => ({ opacity: breath.value }));
  // The check mark fades in and grows from 90% as the loader settles.
  const markStyle = useAnimatedStyle(() => ({ opacity: settle.value, transform: [{ scale: 0.9 + 0.1 * settle.value }] }));

  const accessibilityLabel = working ? `${label}, in progress` : `${doneLabel} ${spokenElapsed(doneSeconds)}`;
  const side = DOT * 3 + GAP * 2;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2 px-1"
    >
      <View style={{ width: side, height: side }}>
        {working ? (
          <Animated.View style={[gridStyle, { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, width: side }]}>
            {ORBIT.map((order, i) =>
              order === null ? (
                <View
                  key={i}
                  testID={testID ? `${testID}-hole` : undefined}
                  style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent, opacity: IDLE * 0.47 }}
                />
              ) : (
                <OrbitDot
                  key={i}
                  testID={testID ? `${testID}-dot-${i}` : undefined}
                  offset={order / ORBIT_STEPS}
                  clock={clock}
                  still={reduceMotion}
                  color={colors.accent}
                />
              ),
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[markStyle, { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, width: side }]}>
            {ORBIT.map((_, i) => {
              const on = CHECK.has(i);
              return (
                <View
                  key={i}
                  testID={testID && on ? `${testID}-mark-on-${i}` : undefined}
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    backgroundColor: on ? colors.scoreExcellent : colors.muted,
                    opacity: on ? 1 : IDLE,
                  }}
                />
              );
            })}
          </Animated.View>
        )}
      </View>
      {working ? (
        <>
          <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
          <Text testID={testID ? `${testID}-timer` : undefined} className="text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {formatElapsed(tenths / 10)}
          </Text>
        </>
      ) : (
        <Text className="text-sm font-medium text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
          {`${doneLabel} ${formatElapsed(doneSeconds)}`}
        </Text>
      )}
    </View>
  );
}

// One ring dot. It rests dim, brightens as its turn comes round (full from 18%
// to 42% of its window), and is back to rest by 62%.
function OrbitDot({
  offset,
  clock,
  still,
  color,
  testID,
}: {
  offset: number;
  clock: SharedValue<number>;
  still: boolean;
  color: string;
  testID?: string;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 1 };
    const phase = (clock.value - offset + 1) % 1;
    return { opacity: interpolate(phase, [0, 0.18, 0.42, 0.62, 1], [IDLE, 1, 1, IDLE, IDLE]) };
  });
  return <Animated.View testID={testID} style={[{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color }, style]} />;
}

// Tenths of a second since `working` last became true, ticking every 100 ms;
// frozen (not reset) once working ends so the done state can show it.
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
