import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { Text, textStyleFor } from '../../ui/text';
import { KIP_COPY } from '../../../lib/kipCopy';
import { COLORS } from '../../../theme';
import { useElapsed, useKipVoice } from './shared';
import type { ThinkingStyleProps } from './types';

const PULSE_MS = 900;

// G: "KIP is typing it up" washing between muted and KIP's label colour (the
// foreground when KIP's colour does not read on the ground), plus a
// seconds counter. (The mockup's gradient sweep needs expo-linear-gradient,
// which the app does not ship, so this is the opacity-pulse fallback the plan
// allows: a colour pulse on one Text.) Frozen, it stays muted.
export function Shimmer({ paused }: ThinkingStyleProps) {
  const { text } = useKipVoice();
  const { colorScheme } = useColorScheme();
  const muted = (colorScheme === 'dark' ? COLORS.dark : COLORS.light).muted;
  const elapsed = useElapsed(paused);
  const wash = useSharedValue(0);

  useEffect(() => {
    if (paused) {
      cancelAnimation(wash);
      wash.value = 0;
      return undefined;
    }
    wash.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(wash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const colorStyle = useAnimatedStyle(() => ({ color: interpolateColor(wash.value, [0, 1], [muted, text]) }));

  return (
    <View className="flex-row items-baseline pb-3">
      <Animated.Text className="text-caption font-semibold" style={[textStyleFor('text-caption font-semibold'), { color: muted }, colorStyle]}>
        {KIP_COPY.thinkingLabel}
      </Animated.Text>
      <Text testID="thinking-shimmer-seconds" className="ml-1.5 text-caption text-muted-foreground tabular-nums">
        {`${Math.floor(elapsed / 1000)}s`}
      </Text>
    </View>
  );
}
