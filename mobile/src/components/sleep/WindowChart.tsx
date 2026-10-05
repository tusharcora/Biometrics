import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import type { SleepGoal, SleepNight } from '../../api/sleep';
import { dayOfWeek } from '../../lib/heatmap';
import { layoutSleepWindow } from '../../lib/sleepWindow';
import { formatClock } from '../../lib/sleepStats';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';

const CHART_HEIGHT = 220;
const TICK_COLUMN = 44;
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// One bar per night from bedtime (top) to wake (bottom), a column per date in
// `dates` (ascending), so a night with no data is a gap in its column.
// Dashed lines mark the average bedtime and wake; a faint band the goal window.
export function WindowChart({
  dates,
  nights,
  goal,
  onPressNight,
}: {
  dates: string[];
  nights: SleepNight[];
  goal: SleepGoal | null;
  onPressNight: (date: string) => void;
}) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const byDate = useMemo(() => new Map(nights.map((n) => [n.date, n])), [nights]);
  // layoutSleepWindow keeps input order; the columns follow `dates` anyway.
  const layout = useMemo(
    () => layoutSleepWindow([...nights].sort((a, b) => a.date.localeCompare(b.date)), goal),
    [nights, goal],
  );

  if (layout.bars.length === 0) {
    return (
      <View testID="sleep-window-chart" className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
        <Text testID="sleep-window-empty" className="text-center text-sm text-muted-foreground">
          {nights.length === 0 ? 'No sleep synced yet.' : 'No bedtimes recorded in this range.'}
        </Text>
      </View>
    );
  }

  const columns = Math.max(1, dates.length);
  const y = (frac: number) => frac * CHART_HEIGHT;

  return (
    <View testID="sleep-window-chart" className="gap-1.5">
      <View className="flex-row" style={{ height: CHART_HEIGHT }}>
        <View style={{ width: TICK_COLUMN }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {layout.ticks.map((t) => (
            <Text
              key={t.label}
              className="text-xs text-muted-foreground"
              style={{ position: 'absolute', left: 0, top: Math.min(CHART_HEIGHT - 14, Math.max(0, y(t.at) - 7)), fontVariant: ['tabular-nums'] }}
            >
              {t.label}
            </Text>
          ))}
        </View>
        <View className="flex-1">
          {layout.goalBand ? (
            <View
              testID="sleep-window-goal-band"
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: y(layout.goalBand.top),
                height: y(layout.goalBand.height),
                backgroundColor: palette.sleepHeat1,
                opacity: 0.6,
                borderRadius: 4,
              }}
            />
          ) : null}
          {layout.ticks.map((t) => (
            <View
              key={t.label}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: y(t.at), height: 1, backgroundColor: palette.hairline }}
            />
          ))}
          <Svg pointerEvents="none" width="100%" height={CHART_HEIGHT} style={{ position: 'absolute' }}>
            {[layout.avgBedtime, layout.avgWake].map((at, i) =>
              at === null ? null : (
                <Line
                  key={i}
                  testID={i === 0 ? 'sleep-window-avg-bedtime' : 'sleep-window-avg-wake'}
                  x1="0"
                  x2="100%"
                  y1={y(at)}
                  y2={y(at)}
                  stroke={palette.sleepHeat3}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              ),
            )}
          </Svg>
          {layout.bars.map((bar) => {
            const column = dates.indexOf(bar.date);
            const night = byDate.get(bar.date);
            if (column < 0 || !night?.bedtime || !night.wakeTime) return null;
            return (
              <Pressable
                key={bar.date}
                testID={`sleep-window-bar-${bar.date}`}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_LONG[dayOfWeek(bar.date)]}: ${formatClock(night.bedtime)} to ${formatClock(night.wakeTime)}`}
                onPress={() => onPressNight(bar.date)}
                style={{
                  position: 'absolute',
                  left: `${(column / columns) * 100}%`,
                  width: `${100 / columns}%`,
                  top: y(bar.top),
                  height: Math.max(4, y(bar.height)),
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, width: '56%', maxWidth: 18, borderRadius: 6, backgroundColor: palette.metricSleep }} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="flex-row" style={{ paddingLeft: TICK_COLUMN }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {dates.map((d) => (
          <Text key={d} className="flex-1 text-center text-xs text-muted-foreground">
            {WEEKDAY_INITIAL[dayOfWeek(d)]}
          </Text>
        ))}
      </View>
    </View>
  );
}
