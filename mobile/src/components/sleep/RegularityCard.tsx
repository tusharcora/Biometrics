import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { SleepRegularity } from '../../api/sleep';
import { nightsToGo, regularityLine } from '../../lib/regularityCopy';
import { COLORS } from '../../theme';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScoreRing } from '../ui/score-ring';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';

// The drift strip's scale: a dot at the edge is 90 minutes off the average.
const DRIFT_RANGE = 90;
// Nights further off than this are highlighted.
const DRIFT_FLAG = 30;
const DRIFT_HEIGHT = 44;
const DRIFT_NIGHTS = 7;

export type RegularityState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; data: SleepRegularity };

// Spec 2026-10-03 §3, 8a. Always "Sleep regularity", never "consistency": the
// Sleep score's own Bedtime consistency factor is a different measure.
export function RegularityCard({ state, coachName, onRetry }: { state: RegularityState; coachName: string; onRetry: () => void }) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;

  if (state.phase === 'loading') return <Skeleton testID="sleep-regularity-loading" className="h-48 w-full rounded-card" />;

  if (state.phase === 'error') {
    return (
      <Card testID="sleep-regularity-error" className="items-center gap-3 py-6">
        <Text className="text-center text-sm text-muted-foreground">Sleep regularity could not be loaded.</Text>
        <Button testID="sleep-regularity-retry" variant="secondary" size="sm" onPress={onRetry}>
          Try again
        </Button>
      </Card>
    );
  }

  const { data } = state;
  const line = regularityLine(data.score, coachName);
  const drift = data.drift.slice(-DRIFT_NIGHTS);
  const flagged = drift.filter((d) => Math.abs(d.bedtimeOffsetMinutes) > DRIFT_FLAG).length;

  return (
    <Card testID="sleep-regularity" className="gap-3">
      <SectionLabel>Sleep regularity</SectionLabel>
      {data.score === null ? (
        <Text testID="sleep-regularity-empty" className="text-base">
          {`Not enough nights yet. ${nightsToGo(data.days, data.nights)} more to go.`}
        </Text>
      ) : (
        <View className="flex-row items-center gap-4">
          <ScoreRing score={data.score} size={64} strokeWidth={7} numeralClassName="text-lg" />
          <View className="flex-1 gap-1">
            {data.bedtimeSpreadMinutes !== null ? (
              <Text testID="sleep-regularity-bedtime-spread" className="text-sm">
                {`Bedtime ±${Math.round(data.bedtimeSpreadMinutes)} min`}
              </Text>
            ) : null}
            {data.wakeSpreadMinutes !== null ? (
              <Text testID="sleep-regularity-wake-spread" className="text-sm">
                {`Wake time ±${Math.round(data.wakeSpreadMinutes)} min`}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {drift.length > 0 ? (
        <View
          testID="sleep-drift-strip"
          accessible
          accessibilityLabel={`Bedtime drift: ${flagged} of ${drift.length} nights more than ${DRIFT_FLAG} minutes from your average`}
          className="flex-row"
          style={{ height: DRIFT_HEIGHT }}
        >
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: DRIFT_HEIGHT / 2, height: 1, backgroundColor: palette.hairline }}
          />
          {drift.map((d) => {
            const off = Math.max(-1, Math.min(1, d.bedtimeOffsetMinutes / DRIFT_RANGE));
            const far = Math.abs(d.bedtimeOffsetMinutes) > DRIFT_FLAG;
            return (
              <View key={d.date} className="flex-1 items-center">
                <View
                  testID={`sleep-drift-dot-${d.date}`}
                  style={{
                    position: 'absolute',
                    top: DRIFT_HEIGHT / 2 - 5 + off * (DRIFT_HEIGHT / 2 - 5),
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: far ? palette.sleepAwake : palette.metricSleep,
                  }}
                />
              </View>
            );
          })}
        </View>
      ) : null}
      <Text className="text-xs text-muted-foreground">
        {`Bedtime and wake time over the last ${data.days} nights. Your Sleep score's Bedtime consistency uses bedtime over 14 nights.`}
      </Text>
      {line ? <Text testID="sleep-regularity-coach" className="text-sm">{line}</Text> : null}
    </Card>
  );
}
