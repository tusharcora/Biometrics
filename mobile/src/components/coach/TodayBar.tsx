import React from 'react';
import { Pressable, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { TodayBarDTO } from '../../api/coach';
import { barColorKey, barFill, tickPosition } from '../../lib/coachToday';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';

const pct = (fraction: number): `${number}%` => `${Math.round(fraction * 1000) / 10}%`;

// The usual tick is the main non-colour status cue, so it stands proud of the
// track (R36): visible above and below the fill wherever the fill ends.
const TRACK_HEIGHT = 8;
const TICK_HEIGHT = 14;

// Words follow the number, not the status (resting HR above usual is "below").
function direction(bar: TodayBarDTO): string | null {
  if (bar.status === null || bar.usual === null) return null;
  if (bar.status === 'near' || bar.value === bar.usual) return 'About usual.';
  return bar.value > bar.usual ? 'Higher than usual.' : 'Lower than usual.';
}

// One "today vs usual" row (spec 1.2): label, a track filled to today's value
// on the metric's scale, a tick at the 30-day usual, and "value / usual N".
// The whole row is a button that asks the coach about it.
export function TodayBar({ bar, onPress }: { bar: TodayBarDTO; onPress: (bar: TodayBarDTO) => void }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const colors = dark ? COLORS.dark : COLORS.light;
  const fill = colors[barColorKey(bar)];
  const tick = tickPosition(bar);
  // Status colours are too light for small text on a light background (R35).
  const valueColor = dark && (bar.status === 'below' || bar.status === 'above') ? fill : colors.foreground;
  const words = direction(bar);
  const spoken = `${bar.label} ${bar.display}${bar.usualDisplay ? `, usual ${bar.usualDisplay}.` : '.'}${words ? ` ${words}` : ''}`;

  return (
    <Pressable
      testID={`today-bar-${bar.metric}`}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Asks your coach about it"
      onPress={() => onPress(bar)}
      hitSlop={4}
      className="min-h-[28px] flex-row items-center gap-2.5 active:opacity-70"
    >
      <Text className="w-16 text-xs text-muted-foreground">{bar.label}</Text>
      <View className="flex-1 justify-center" style={{ height: TICK_HEIGHT }}>
        <View
          testID={`today-bar-track-${bar.metric}`}
          className="overflow-hidden rounded-full"
          style={{ height: TRACK_HEIGHT, backgroundColor: colors.todayTrack }}
        >
          <View
            testID={`today-bar-fill-${bar.metric}`}
            className="rounded-full"
            style={{ height: TRACK_HEIGHT, width: pct(barFill(bar)), backgroundColor: fill }}
          />
        </View>
        {tick !== null ? (
          <View
            testID={`today-bar-tick-${bar.metric}`}
            className="absolute rounded-full"
            style={{ top: 0, left: pct(tick), width: 2, height: TICK_HEIGHT, marginLeft: -1, backgroundColor: colors.todayTick }}
          />
        ) : null}
      </View>
      <Text className="min-w-[92px] text-right text-xs" numberOfLines={1}>
        <Text testID={`today-bar-value-${bar.metric}`} className="text-sm font-bold" style={{ color: valueColor }}>
          {bar.display}
        </Text>
        {bar.usualDisplay ? <Text className="text-xs text-muted-foreground">{` / usual ${bar.usualDisplay}`}</Text> : null}
      </Text>
    </Pressable>
  );
}
