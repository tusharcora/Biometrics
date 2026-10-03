import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { fetchSleepNight, type SleepNightDetail } from '../api/sleep';
import { useCharacter } from '../characters/CharacterContext';
import { InBedShare } from '../components/activity-sheets';
import { characterInfo } from '../components/characters/registry';
import { SectionError, useSection } from '../components/sleep/Section';
import { StageBreakdown } from '../components/sleep/StageBreakdown';
import { StageLegend, StageStrip } from '../components/sleep/StageStrip';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { formatLongDay } from '../lib/heatmap';
import { formatClock, formatDuration, formatShortDuration } from '../lib/sleepStats';
import { navigateToCoachEntry } from '../navigation/coachNavigation';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSync } from '../sync/SyncProvider';

/** "+12m vs usual" / "−8m vs usual" (a real minus sign); null without a usual night. */
export function usualLine(minutesAsleep: number, usual: number | null): string | null {
  if (usual === null) return null;
  const diff = Math.round(minutesAsleep - usual);
  return `${diff < 0 ? '−' : '+'}${formatShortDuration(Math.abs(diff))} vs usual`;
}

function NumberRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function NightBody({ night, coachName, onAsk }: { night: SleepNightDetail; coachName: string; onAsk: () => void }) {
  const stages = night.hasStages && night.stages.length > 0 ? night.stages : null;
  const usual = usualLine(night.minutesAsleep, night.usualMinutesAsleep);
  // The backend can emit a zero-length nap in rare cases.
  const naps = night.naps.filter((n) => n.minutesAsleep > 0);
  return (
    <>
      {stages ? (
        <Card className="gap-3">
          <SectionLabel>Stages</SectionLabel>
          <View testID="night-stage-strip" className="gap-1.5">
            <StageStrip stages={stages} start={stages[0]!.start} end={stages[stages.length - 1]!.end} />
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                {formatClock(night.bedtime)}
              </Text>
              <Text className="text-xs text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
                {formatClock(night.wakeTime)}
              </Text>
            </View>
          </View>
          <StageLegend />
          {night.stageTotals ? (
            <StageBreakdown totals={night.stageTotals} minutesAsleep={night.minutesAsleep} minutesInBed={night.minutesInBed} />
          ) : null}
        </Card>
      ) : (
        <Card className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
              {formatClock(night.bedtime)}
            </Text>
            <Text className="text-sm font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
              {formatClock(night.wakeTime)}
            </Text>
          </View>
          <InBedShare minutesAsleep={night.minutesAsleep} minutesInBed={night.minutesInBed} testID="night-no-stages" />
        </Card>
      )}

      <Card testID="night-numbers" className="gap-2.5">
        <SectionLabel>The night</SectionLabel>
        <NumberRow label="Time in bed" value={formatDuration(night.minutesInBed)} />
        {night.minutesAwake !== null ? <NumberRow label="Time awake" value={formatShortDuration(night.minutesAwake)} /> : null}
        {night.minutesToFallAsleep !== null ? (
          <NumberRow label="Time to fall asleep" value={formatShortDuration(night.minutesToFallAsleep)} />
        ) : null}
        {night.minutesAfterWakeUp !== null ? (
          <NumberRow label="Time after waking" value={formatShortDuration(night.minutesAfterWakeUp)} />
        ) : null}
        {night.sleepScore !== null ? <NumberRow label="Sleep score" value={String(night.sleepScore)} /> : null}
        {usual ? <Text className="text-sm text-muted-foreground">{usual}</Text> : null}
      </Card>

      {naps.length > 0 ? (
        <Card testID="night-naps" className="gap-2">
          <SectionLabel>Naps</SectionLabel>
          {naps.map((n) => (
            <Text key={n.start} className="text-sm">
              {`Nap · ${formatShortDuration(n.minutesAsleep)}`}
            </Text>
          ))}
        </Card>
      ) : null}

      <Button testID="night-ask-coach" variant="secondary" onPress={onAsk}>
        {`Ask ${coachName} about this night`}
      </Button>
    </>
  );
}

// One night in full (spec 2026-10-03 §3, 8c): date and time asleep, the stage
// strip and breakdown, the night's numbers, naps, and a question for the coach.
export function SleepNightScreen() {
  const navigation = useNavigation<any>();
  const { date } = useRoute<RouteProp<RootStackParamList, 'SleepNight'>>().params;
  const { characterId } = useCharacter();
  const coachName = characterInfo(characterId).name;
  // Bumped after each successful sync with Google Health, so the night reloads.
  const { dataVersion } = useSync();

  // null: no night was recorded for this date (404), which is not a failure.
  const [night, reload] = useSection<SleepNightDetail | null>(
    date,
    () =>
      fetchSleepNight(date).catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    [dataVersion],
  );

  // Opens the chat with the question in the input box; it is never sent for them.
  const ask = () => navigateToCoachEntry(navigation, 'Coach', `How was my sleep on ${formatLongDay(date)}?`);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <View testID="night-header" className="gap-1">
          <Text className="text-sm text-muted-foreground">{formatLongDay(date)}</Text>
          {night.phase === 'ready' && night.data ? (
            <View className="flex-row items-baseline gap-2">
              <Text className="font-display text-display">{formatDuration(night.data.minutesAsleep)}</Text>
              <Text className="text-base text-muted-foreground">asleep</Text>
            </View>
          ) : null}
        </View>

        {night.phase === 'loading' ? <Skeleton testID="night-loading" className="h-64 w-full rounded-card" /> : null}
        {night.phase === 'error' ? <SectionError testID="night-retry" message="This night could not be loaded." onRetry={reload} /> : null}
        {night.phase === 'ready' && night.data === null ? (
          <Card>
            <Text testID="night-empty" className="text-center text-sm text-muted-foreground">
              No sleep recorded for this night.
            </Text>
          </Card>
        ) : null}
        {night.phase === 'ready' && night.data ? <NightBody night={night.data} coachName={coachName} onAsk={ask} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
