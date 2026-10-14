import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from '../../ui/text';
import { useKipVoice } from './shared';
import type { ThinkingStyleProps } from './types';
import { useThinkingLine } from './useThinkingLine';

const BARS = ['92%', '74%', '48%'] as const;
const PULSE_MS = 700;
const PULSE_LOW = 0.35;
const PULSE_HIGH = 0.8;
// The thinking bubble's width, and its lift off the row's bottom edge.
export const PLACEHOLDER_WIDTH = 210;
export const PLACEHOLDER_BOTTOM = 10;

/** The reply bubble B draws while thinking. */
export function PlaceholderBubble({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} className="self-start rounded-2xl rounded-bl-sm border border-border bg-muted px-3 py-2.5" style={style}>
      {children}
    </View>
  );
}

// B: a reply bubble with "KIP is typing it up..." and three accent lines
// pulsing where the answer will appear.
export function Placeholder({ paused }: ThinkingStyleProps) {
  const { name, text, accent } = useKipVoice();
  const { line } = useThinkingLine(paused);
  const pulse = useSharedValue(PULSE_LOW);

  useEffect(() => {
    if (paused) {
      cancelAnimation(pulse);
      pulse.value = PULSE_LOW;
      return undefined;
    }
    pulse.value = withRepeat(withTiming(PULSE_HIGH, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(pulse);
    // The shared value is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const barStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <PlaceholderBubble style={{ width: PLACEHOLDER_WIDTH, marginBottom: PLACEHOLDER_BOTTOM }}>
      <Text className="text-caption text-muted-foreground">
        <Text className="text-caption font-semibold" style={{ color: text }}>
          {name}
        </Text>
        {` is ${line}…`}
      </Text>
      {BARS.map((width, index) => (
        <Animated.View
          key={width}
          testID={`thinking-placeholder-bar-${index}`}
          style={[{ width, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: accent }, barStyle]}
        />
      ))}
    </PlaceholderBubble>
  );
}
