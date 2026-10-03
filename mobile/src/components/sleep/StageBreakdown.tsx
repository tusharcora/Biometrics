import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { SleepNightDetail, StageType } from '../../api/sleep';
import { formatShortDuration } from '../../lib/sleepStats';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';
import { STAGE_ORDER, STAGE_TOKEN } from './StageStrip';

type StageKey = 'deep' | 'light' | 'rem' | 'awake';

const KEY: Record<StageType, StageKey> = { DEEP: 'deep', LIGHT: 'light', REM: 'rem', AWAKE: 'awake' };

/** Whole percent of `part` in `whole`; 0 when there is no whole. */
function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// One row per stage: minutes, share and how many times it came up. Deep, light
// and REM are shares of time asleep; awake is a share of time in bed (spec
// 2026-10-03 §3). Each row names its stage, so colour is never the only cue.
export function StageBreakdown({
  totals,
  minutesAsleep,
  minutesInBed,
}: {
  totals: NonNullable<SleepNightDetail['stageTotals']>;
  minutesAsleep: number;
  minutesInBed: number;
}) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  return (
    <View className="gap-2.5">
      {STAGE_ORDER.map((s) => {
        const key = KEY[s.type];
        const { minutes, count } = totals[key];
        const share = percent(minutes, key === 'awake' ? minutesInBed : minutesAsleep);
        return (
          <View key={key} testID={`night-breakdown-${key}`} className="flex-row items-center gap-2.5">
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: palette[STAGE_TOKEN[s.type]] }} />
            <Text className="flex-1 text-sm font-semibold">{s.label}</Text>
            <Text className="w-16 text-right text-sm" style={{ fontVariant: ['tabular-nums'] }}>
              {formatShortDuration(minutes)}
            </Text>
            <Text className="w-10 text-right text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
              {`${share}%`}
            </Text>
            <Text className="w-16 text-right text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
              {`${count} ${count === 1 ? 'time' : 'times'}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
