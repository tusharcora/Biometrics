import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { fetchSleepNight, type SleepNightDetail } from '../api/sleep';
import { useCharacter } from '../characters/CharacterContext';
import { characterInfo } from '../components/characters/registry';
import { InBedShare } from '../components/sleep/InBedShare';
import { MomentsCard } from '../components/sleep/MomentsCard';
import { SectionError, useSection } from '../components/sleep/Section';
import { SleepCyclesCard } from '../components/sleep/SleepCyclesCard';
import { StageLanes } from '../components/sleep/StageLanes';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { formatLongDay } from '../lib/heatmap';
import { coachEntryRoute, useCoachStatus } from '../lib/useCoachStatus';
import { formatClock, formatDuration, formatShortDuration, nightClock } from '../lib/sleepStats';
import { navigateToCoachEntry } from '../navigation/coachNavigation';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSync } from '../sync/SyncProvider';

/** "+12m vs usual" / "−8m vs usual" (a real minus sign) / "Same as usual"; null without a usual night. */
export function usualLine(minutesAsleep: number, usual: number | null): string | null {
  if (usual === null) return null;
  const diff = Math.round(minutesAsleep - usual);
  if (diff === 0) return 'Same as usual';
  return `${diff < 0 ? '−' : '+'}${formatShortDuration(Math.abs(diff))} vs usual`;
}

function NumberRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-caption text-muted-foreground">{label}</Text>
      <Text className="text-body font-semibold tabular-nums">
        {value}
      </Text>
    </View>
  );
}

// The main session's time asleep. On a nap day the Sleep screen's "Last
// night" card and chart show the day's total, naps included, so the figure is
// labelled as main sleep and that total sits beside it.
function NightHeadline({ night }: { night: SleepNightDetail }) {
  const napMinutes = night.naps.reduce((sum, n) => sum + Math.max(0, n.minutesAsleep), 0);
  return (
    <View className="gap-0.5">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-display tabular-nums">{formatDuration(night.minutesAsleep)}</Text>
        <Text className="text-body text-muted-foreground">main sleep</Text>
      </View>
      {napMinutes > 0 ? (
        <Text testID="night-with-naps" className="text-caption text-muted-foreground tabular-nums">
          {`${formatDuration(night.minutesAsleep + napMinutes)} with naps`}
        </Text>
      ) : null}
    </View>
  );
}

// `onAsk` is null when the coach must not be offered (disabled or status unknown).
function NightBody({ night, coachName, onAsk }: { night: SleepNightDetail; coachName: string; onAsk: (() => void) | null }) {
  const stages = night.hasStages && night.stages.length > 0 ? night.stages : null;
  // Stages are UTC instants; the lanes, cycles and moments tell time on the session's own clock.
  const clock = nightClock(night, stages ?? []);
  const usual = usualLine(night.minutesAsleep, night.usualMinutesAsleep);
  // The backend can emit a zero-length nap in rare cases.
  const naps = night.naps.filter((n) => n.minutesAsleep > 0);
  return (
    <>
      {stages ? (
        <>
          <Card className="gap-2.5">
            <SectionLabel>Sleep stages</SectionLabel>
            <StageLanes stages={stages} clock={clock} />
          </Card>
          <SleepCyclesCard stages={stages} clock={clock} />
          <MomentsCard stages={stages} clock={clock} minutesToFallAsleep={night.minutesToFallAsleep} minutesAsleep={night.minutesAsleep} />
        </>
      ) : night.minutesInBed > 0 ? (
        <Card className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-body font-semibold tabular-nums">
              {formatClock(night.bedtime)}
            </Text>
            <Text className="text-body font-semibold tabular-nums">
              {formatClock(night.wakeTime)}
            </Text>
          </View>
          <InBedShare minutesAsleep={night.minutesAsleep} minutesInBed={night.minutesInBed} testID="night-no-stages" />
        </Card>
      ) : null}

      <Card testID="night-numbers" className="gap-2.5">
        <SectionLabel>The night</SectionLabel>
        <NumberRow label="Time in bed" value={formatShortDuration(night.minutesInBed)} />
        {night.minutesAwake !== null ? <NumberRow label="Time awake" value={formatShortDuration(night.minutesAwake)} /> : null}
        {night.minutesToFallAsleep !== null ? (
          <NumberRow label="Time to fall asleep" value={formatShortDuration(night.minutesToFallAsleep)} />
        ) : null}
        {night.minutesAfterWakeUp !== null ? (
          <NumberRow label="Time after waking" value={formatShortDuration(night.minutesAfterWakeUp)} />
        ) : null}
        {night.sleepScore !== null ? <NumberRow label="Sleep score" value={String(night.sleepScore)} /> : null}
        {usual ? <Text className="text-caption text-muted-foreground">{usual}</Text> : null}
      </Card>

      {naps.length > 0 ? (
        <Card testID="night-naps" className="gap-2">
          <SectionLabel>Naps</SectionLabel>
          {naps.map((n) => (
            <Text key={n.start} className="text-body">
              {`Nap · ${formatShortDuration(n.minutesAsleep)}`}
            </Text>
          ))}
        </Card>
      ) : null}

      {onAsk ? (
        <Button testID="night-ask-coach" variant="outline" size="lg" onPress={onAsk}>
          {`Ask ${coachName} about this night`}
        </Button>
      ) : null}
    </>
  );
}

// One night in full (spec 2026-10-03 §3, 8c; stage lanes, cycles and moments
// from Night.dc.html): date and time asleep, the stages, the night's numbers,
// naps, and a question for the coach.
export function SleepNightScreen() {
  const navigation = useNavigation<any>();
  const { date } = useRoute<RouteProp<RootStackParamList, 'SleepNight'>>().params;
  const { characterId } = useCharacter();
  const coachName = characterInfo(characterId).name;
  // Bumped after each successful sync with Google Health, so the night reloads.
  const { dataVersion } = useSync();
  // Like every coach entry, nothing shows until the status says the coach is on.
  const { status: coachStatus } = useCoachStatus(navigation);
  const coachRoute = coachEntryRoute(coachStatus);

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

  // Opens the chat (or consent first) with the question in the input box; it is never sent for them.
  const ask = coachRoute ? () => navigateToCoachEntry(navigation, coachRoute, `How was my sleep on ${formatLongDay(date)}?`) : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <View testID="night-header" className="gap-1">
          <Text className="text-caption text-muted-foreground">{formatLongDay(date)}</Text>
          {night.phase === 'ready' && night.data ? <NightHeadline night={night.data} /> : null}
        </View>

        {night.phase === 'loading' ? <Skeleton testID="night-loading" className="h-64 w-full rounded-card" /> : null}
        {night.phase === 'error' ? <SectionError testID="night-retry" message="This night could not be loaded." onRetry={reload} /> : null}
        {night.phase === 'ready' && night.data === null ? (
          <Card>
            <Text testID="night-empty" className="text-center text-caption text-muted-foreground">
              No sleep recorded for this night.
            </Text>
          </Card>
        ) : null}
        {night.phase === 'ready' && night.data ? <NightBody night={night.data} coachName={coachName} onAsk={ask} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
