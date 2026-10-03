import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { SleepNight } from '../api/sleep';
import { compareToAverage, formatDayTitle } from '../lib/heatmap';
import { compareSleepToAverage, formatClock, formatDuration } from '../lib/sleepStats';
import { COLORS, METRIC_CONFIG } from '../theme';
import { Ring } from './ui/ring';
import { Text } from './ui/text';

const formatSteps = METRIC_CONFIG.STEPS.format;

interface LinkTileProps {
  testID: string;
  icon: 'footsteps-outline' | 'moon-outline';
  color: string;
  label: string;
  value: string;
  onPress: () => void;
}

// Jumps from one metric's sheet to the same day on the other metric.
function LinkTile({ testID, icon, color, label, value, onPress }: LinkTileProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="min-h-[56px] flex-1 flex-row items-center gap-2.5 rounded-tile bg-muted px-3 py-3 active:opacity-70"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.18)') }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-lg font-bold" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={color} />
    </Pressable>
  );
}

export interface DayDetailProps {
  date: string;
  steps: number | null;
  goal: number;
  average: number | null;
  // The night that ended that morning, when sleep has loaded: undefined hides the link.
  sleepLink?: { night: SleepNight | null; onPress: () => void };
}

export function DayDetail({ date, steps, goal, average, sleepLink }: DayDetailProps) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const comparison = steps === null ? null : compareToAverage(steps, average);
  return (
    <View testID="day-detail" className="gap-2 pb-2">
      <Text className="text-sm text-muted-foreground">{formatDayTitle(date)}</Text>
      {steps === null ? (
        <Text testID="day-detail-empty" className="text-base">
          No steps were recorded for this day.
        </Text>
      ) : (
        <>
          <Text testID="day-detail-steps" className="text-numeral-lg font-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {`${formatSteps(steps)} steps`}
          </Text>
          <Text testID="day-detail-goal" className="text-base">
            {`${Math.round((steps / goal) * 100)}% of your ${formatSteps(goal)}-step goal`}
          </Text>
          {comparison ? (
            <Text testID="day-detail-comparison" className="text-sm text-muted-foreground">
              {comparison}
            </Text>
          ) : null}
        </>
      )}
      {sleepLink ? (
        <View className="mt-2 flex-row">
          <LinkTile
            testID="day-detail-sleep-link"
            icon="moon-outline"
            color={palette.metricSleep}
            label="Sleep the night before"
            value={sleepLink.night ? formatDuration(sleepLink.night.minutesAsleep) : 'No data'}
            onPress={sleepLink.onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

// How much of the time in bed was asleep: a bar and a caption.
export function InBedShare({ minutesAsleep, minutesInBed, testID }: { minutesAsleep: number; minutesInBed: number; testID: string }) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const share = minutesInBed > 0 ? Math.min(1, minutesAsleep / minutesInBed) : 0;
  return (
    <>
      <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: palette.sleepHeat1 }}>
        <View className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: palette.metricSleep }} />
      </View>
      <Text testID={testID} className="text-xs text-muted-foreground">
        {`${formatDuration(minutesInBed)} in bed · ${Math.round(share * 100)}% of it asleep`}
      </Text>
    </>
  );
}

export interface NightDetailProps {
  date: string;
  night: SleepNight | null;
  goal: number;
  average: number | null;
  stepsLink: { steps: number | null; onPress: () => void };
  // The one-night screen; the link shows only for a recorded night.
  onOpenFull?: () => void;
}

export function NightDetail({ date, night, goal, average, stepsLink, onOpenFull }: NightDetailProps) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const comparison = night ? compareSleepToAverage(night.minutesAsleep, average) : null;
  return (
    <View testID="night-detail" className="gap-2 pb-2">
      <Text testID="night-detail-title" className="text-sm text-muted-foreground">{`Night ending ${formatDayTitle(date)}`}</Text>
      {night === null ? (
        <Text testID="night-detail-empty" className="text-base">
          No sleep was recorded for this night.
        </Text>
      ) : (
        <>
          <View className="flex-row items-baseline gap-2">
            <Text testID="night-detail-asleep" className="text-numeral-lg font-bold" style={{ fontVariant: ['tabular-nums'] }}>
              {formatDuration(night.minutesAsleep)}
            </Text>
            <Text className="text-base text-muted-foreground">asleep</Text>
          </View>
          <Text testID="night-detail-goal" className="text-base">
            {`${Math.round((night.minutesAsleep / goal) * 100)}% of your ${METRIC_CONFIG.SLEEP.goalLabel}`}
          </Text>

          {night.bedtime && night.wakeTime ? (
            <View testID="night-detail-window" className="mt-2 gap-2 rounded-tile bg-muted p-3.5">
              <View className="flex-row justify-between">
                <View className="gap-0.5">
                  <Text className="text-[11px] text-muted-foreground">Bedtime</Text>
                  <Text testID="night-detail-bedtime" className="text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatClock(night.bedtime)}
                  </Text>
                </View>
                <View className="items-end gap-0.5">
                  <Text className="text-[11px] text-muted-foreground">Woke</Text>
                  <Text testID="night-detail-wake" className="text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatClock(night.wakeTime)}
                  </Text>
                </View>
              </View>
              {night.minutesInBed ? (
                <InBedShare minutesAsleep={night.minutesAsleep} minutesInBed={night.minutesInBed} testID="night-detail-in-bed" />
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View className="mt-2 flex-row gap-2.5">
        {night?.sleepScore != null ? (
          <View testID="night-detail-score" className="flex-1 flex-row items-center gap-2.5 rounded-tile bg-muted px-3 py-3">
            <Ring size={36} strokeWidth={5} color={palette.metricSleep} trackColor={palette.sleepHeat1} percent={night.sleepScore / 100} />
            <View>
              <Text className="text-xs text-muted-foreground">Sleep score</Text>
              <Text className="text-lg font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                {String(night.sleepScore)}
              </Text>
            </View>
          </View>
        ) : null}
        <LinkTile
          testID="night-detail-steps-link"
          icon="footsteps-outline"
          color={palette.metricSteps}
          label="Steps that day"
          value={stepsLink.steps === null ? 'No data' : formatSteps(stepsLink.steps)}
          onPress={stepsLink.onPress}
        />
      </View>

      {comparison ? (
        <Text testID="night-detail-comparison" className="text-sm text-muted-foreground">
          {comparison}
        </Text>
      ) : null}

      {night && onOpenFull ? (
        <Pressable
          testID="night-open-full"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpenFull}
          className="flex-row items-center gap-1 self-start py-1 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-accent">Open full night</Text>
          <Ionicons name="chevron-forward" size={14} color={palette.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}
