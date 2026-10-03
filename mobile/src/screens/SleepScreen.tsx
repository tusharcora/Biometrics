import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchSleep,
  fetchSleepGoal,
  fetchSleepNight,
  fetchSleepRegularity,
  type SleepGoal,
  type SleepNight,
  type SleepNightDetail,
  type SleepRegularity,
} from '../api/sleep';
import { fetchScoresWithBands, type DailyScoreDTO, type ScoreBandsDTO } from '../api/scores';
import { useCharacter } from '../characters/CharacterContext';
import { characterInfo } from '../components/characters/registry';
import { RegularityCard } from '../components/sleep/RegularityCard';
import { SectionError, useSection, type Section } from '../components/sleep/Section';
import { StageLegend, StageStrip } from '../components/sleep/StageStrip';
import { WindowChart } from '../components/sleep/WindowChart';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ScoreRing } from '../components/ui/score-ring';
import { SectionLabel } from '../components/ui/section-label';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { addDays, todayCivil } from '../lib/heatmap';
import { formatClock, formatDuration } from '../lib/sleepStats';
import { readWindDown, type WindDownSettings } from '../lib/windDown';
import { useSync } from '../sync/SyncProvider';
import { COLORS } from '../theme';

type Range = 'week' | 'two-weeks';
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'two-weeks', label: 'Two weeks' },
];
const RANGE_DAYS: Record<Range, number> = { week: 7, 'two-weeks': 14 };
// This screen's regularity window (the endpoint also offers 30).
const REGULARITY_DAYS = 7;

type NightsData = { dates: string[]; nights: SleepNight[]; backfillPending: boolean };
type ScoreData = { score: DailyScoreDTO | null; bands?: ScoreBandsDTO };

// Every civil date from `from` to `to`, oldest first.
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "10:30 pm to 6:45 am", one side alone when only one is set, or the prompt to set one. */
export function goalLine(goal: SleepGoal): string {
  const { bedtimeGoal: bed, wakeGoal: wake } = goal;
  if (bed && wake) return `${formatClock(bed)} to ${formatClock(wake)}`;
  if (bed) return `Bed ${formatClock(bed)} · wake not set`;
  if (wake) return `Bedtime not set · wake ${formatClock(wake)}`;
  return 'Set a bedtime goal';
}

export function SleepScreen() {
  const navigation = useNavigation<any>();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const { characterId } = useCharacter();
  const coachName = characterInfo(characterId).name;
  // Bumped after each successful sync with Google Health, so the data reloads.
  const { dataVersion } = useSync();
  const [range, setRange] = useState<Range>('week');

  const [score, reloadScore] = useSection<ScoreData>('score', async () => {
    // The same source as the Home sleep tile: the newest Sleep Score.
    const { scores, bands } = await fetchScoresWithBands(7, 'SLEEP');
    return { score: scores[0] ?? null, bands };
  }, [dataVersion]);

  const [nights, reloadNights] = useSection<NightsData>(range, async () => {
    const to = todayCivil();
    const from = addDays(to, -(RANGE_DAYS[range] - 1));
    const res = await fetchSleep(from, to);
    return { dates: datesBetween(from, to), nights: res.nights, backfillPending: res.stagesBackfillPending };
  }, [dataVersion]);

  const [regularity, reloadRegularity] = useSection<SleepRegularity>('regularity', () => fetchSleepRegularity(REGULARITY_DAYS), [dataVersion]);
  const [goal, reloadGoal] = useSection<SleepGoal>('goal', () => fetchSleepGoal(), [dataVersion]);
  // The wind-down reminder lives on the device; read alongside the goal.
  const [reminder, setReminder] = useState<WindDownSettings | null>(null);
  const loadReminder = useCallback(() => {
    readWindDown().then(setReminder, () => undefined);
  }, []);
  useEffect(loadReminder, [loadReminder]);
  // Coming back from the goal screen re-reads the goal and the reminder; the
  // first focus (opening the screen) is already covered by the loads above.
  const blurred = useRef(false);
  useEffect(() => {
    const offBlur = navigation.addListener?.('blur', () => {
      blurred.current = true;
    });
    const offFocus = navigation.addListener?.('focus', () => {
      if (!blurred.current) return;
      blurred.current = false;
      reloadGoal();
      loadReminder();
    });
    return () => {
      offBlur?.();
      offFocus?.();
    };
  }, [navigation, reloadGoal, loadReminder]);

  // Last night is the newest night on record; its stages come from the one-night endpoint.
  const lastNight = useMemo(() => {
    if (nights.phase !== 'ready' || nights.data.nights.length === 0) return null;
    return [...nights.data.nights].sort((a, b) => b.date.localeCompare(a.date))[0]!;
  }, [nights]);
  const lastNightDate = lastNight?.hasStages ? lastNight.date : null;
  const [detail, setDetail] = useState<Section<SleepNightDetail> | null>(null);
  // Only the latest request lands, so a retry or an older date can't overwrite a newer one.
  const detailRequest = useRef(0);
  const loadDetail = useCallback(() => {
    const id = ++detailRequest.current;
    if (!lastNightDate) {
      setDetail(null);
      return;
    }
    setDetail({ phase: 'loading' });
    fetchSleepNight(lastNightDate).then(
      (data) => id === detailRequest.current && setDetail({ phase: 'ready', data }),
      () => id === detailRequest.current && setDetail({ phase: 'error' }),
    );
  }, [lastNightDate]);
  useEffect(() => {
    loadDetail();
    return () => {
      detailRequest.current++;
    };
  }, [loadDetail, dataVersion]);

  const openNight = (date: string) => navigation.navigate('SleepNight', { date });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        {/* 1. Score header */}
        {score.phase === 'loading' ? <Skeleton testID="sleep-score-loading" className="h-24 w-full rounded-card" /> : null}
        {score.phase === 'error' ? (
          <SectionError testID="sleep-score-retry" message="Your Sleep Score could not be loaded." onRetry={reloadScore} />
        ) : null}
        {score.phase === 'ready' ? (
          <Card testID="sleep-score-header" className="flex-row items-center gap-4">
            <ScoreRing score={score.data.score?.score ?? null} bands={score.data.bands} size={64} strokeWidth={7} numeralClassName="text-lg" />
            <View className="flex-1 gap-1">
              <SectionLabel>Sleep Score</SectionLabel>
              {score.data.score ? (
                <Pressable
                  testID="sleep-why-score"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => navigation.navigate('ScoreDetail', { date: score.data.score!.date, type: 'SLEEP' })}
                  className="flex-row items-center gap-1 self-start py-1 active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-accent">Why this score</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.accent} />
                </Pressable>
              ) : (
                <Text className="text-sm text-muted-foreground">Your Sleep Score will appear once a night of sleep has been recorded.</Text>
              )}
            </View>
          </Card>
        ) : null}

        {/* 2. Range toggle */}
        <SegmentedControl testID="sleep-range" options={RANGE_OPTIONS} value={range} onChange={setRange} />

        {/* 3. Window chart */}
        {nights.phase === 'loading' ? <Skeleton testID="sleep-window-loading" className="h-64 w-full rounded-card" /> : null}
        {nights.phase === 'error' ? (
          <SectionError testID="sleep-window-retry" message="Your nights could not be loaded." onRetry={reloadNights} />
        ) : null}
        {nights.phase === 'ready' ? (
          <Card className="gap-3">
            <SectionLabel>Bedtime to wake</SectionLabel>
            <WindowChart
              dates={nights.data.dates}
              nights={nights.data.nights}
              goal={goal.phase === 'ready' ? goal.data : null}
              onPressNight={openNight}
            />
            {nights.data.backfillPending ? (
              <Text testID="sleep-older-nights" className="text-xs text-muted-foreground">
                Reading older nights…
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* 4. Sleep regularity */}
        <RegularityCard state={regularity} coachName={coachName} onRetry={reloadRegularity} />

        {/* 5. Last night */}
        {lastNight ? (
          <Card testID="sleep-last-night" className="gap-3">
            <SectionLabel>Last night</SectionLabel>
            <Text className="font-display text-display">{formatDuration(lastNight.minutesAsleep)}</Text>
            {detail?.phase === 'loading' ? <Skeleton className="h-4 w-full rounded-full" /> : null}
            {detail?.phase === 'error' ? (
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-muted-foreground">Stages could not be loaded.</Text>
                <Button testID="sleep-last-night-retry" variant="secondary" size="sm" onPress={loadDetail}>
                  Try again
                </Button>
              </View>
            ) : null}
            {detail?.phase === 'ready' && detail.data.hasStages && detail.data.stages.length > 0 ? (
              <View className="gap-2">
                <StageStrip
                  stages={detail.data.stages}
                  start={detail.data.stages[0]!.start}
                  end={detail.data.stages[detail.data.stages.length - 1]!.end}
                  height={14}
                />
                <StageLegend />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => openNight(lastNight.date)}
              className="flex-row items-center gap-1 self-start py-1 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-accent">See the whole night</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.accent} />
            </Pressable>
          </Card>
        ) : null}

        {/* 6. Bedtime goal */}
        {goal.phase === 'error' ? (
          <SectionError testID="sleep-goal-retry" message="Your bedtime goal could not be loaded." onRetry={reloadGoal} />
        ) : (
          <Pressable
            testID="sleep-goal-row"
            accessibilityRole="button"
            onPress={() => navigation.navigate('BedtimeGoal')}
            className="active:opacity-70"
          >
            <Card className="flex-row items-center gap-3">
              <View className="flex-1 gap-1">
                <SectionLabel>Bedtime goal</SectionLabel>
                {goal.phase === 'loading' ? (
                  <Skeleton className="h-5 w-40 rounded-full" />
                ) : (
                  <Text className="text-base font-semibold">{goalLine(goal.data)}</Text>
                )}
                {/* The reminder needs a bedtime, so it is only mentioned once one is set. */}
                {goal.phase === 'ready' && goal.data.bedtimeGoal && reminder ? (
                  <Text testID="sleep-goal-reminder" className="text-sm text-muted-foreground">
                    {reminder.enabled ? `Reminder ${reminder.leadMinutes} min before bed` : 'Reminder off'}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
