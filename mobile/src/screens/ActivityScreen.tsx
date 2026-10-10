import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { fetchActivity } from '../api/activity';
import { apiFetch } from '../api/client';
import { fetchScores } from '../api/scores';
import { fetchSleep, fetchSleepGoal } from '../api/sleep';
import { ActivityHeatmap, type SleepState } from '../components/activity-heatmap';
import { UsualTiles } from '../components/activity/UsualTiles';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { SectionLabel } from '../components/ui/section-label';
import { Text } from '../components/ui/text';
import { fetchRange, todayCivil } from '../lib/heatmap';
import type { MetricRecord } from '../lib/metricInsights';
import { DEFAULT_SLEEP_GOAL_MINUTES } from '../lib/sleepStats';
import { recoveryRecords, type TileRecord } from '../lib/usualTiles';
import { useSync } from '../sync/SyncProvider';
import { openNight, openSleep } from '../navigation/sleepNavigation';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import type { TabParamList } from '../navigation/TabsNavigator';
import { COLORS } from '../theme';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; steps: Map<string, number>; earliestDate: string | null; today: string; sleep: SleepState; sleepGoal: number };

export function ActivityScreen() {
  const navigation = useNavigation<any>();
  // A date handed in by the Sleep page's "Steps that day": opened once, then cleared.
  const openDate = useRoute<RouteProp<TabParamList, 'Activity'>>().params?.date ?? null;
  const clearance = useTabBarClearance();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  // The "against your usual" tiles. Null until the metrics read lands; a failed
  // read keeps what is on screen (or no tiles) and never makes the screen an error.
  const [records, setRecords] = useState<MetricRecord[] | null>(null);
  const [recovery, setRecovery] = useState<TileRecord[]>([]);
  // Only the latest request may land: a slow first load must not overwrite a
  // pull-to-refresh that finished after it.
  const requestId = useRef(0);
  // Bumped after each successful sync with Google Health, so the data reloads.
  const { dataVersion, syncNow } = useSync();

  const load = useCallback(async () => {
    const id = ++requestId.current;
    // One request covers every view and every month the month view can reach.
    const today = todayCivil();
    const { from, to } = fetchRange(today);
    // Sleep is fetched alongside but fails on its own: a sleep outage leaves
    // the Steps page working and puts a retry on the Sleep page instead.
    // The sleep goal is waited for too, so the sleep colours never draw against
    // 8h and then jump; without it they use 8h.
    // The metrics and Recovery scores (for the usual tiles) fail on their own too. 60 days of
    // scores, so the tiles' 30-day change has the 30 days before it to compare against.
    const [stepsRes, sleepRes, goalRes, metricsRes, recoveryRes] = await Promise.allSettled([
      fetchActivity(from, to),
      fetchSleep(from, to),
      fetchSleepGoal(),
      apiFetch<MetricRecord[]>('/me/biometrics'),
      fetchScores(60, 'RECOVERY'),
    ]);
    if (id !== requestId.current) return;
    if (metricsRes.status === 'fulfilled') setRecords(metricsRes.value ?? []);
    if (recoveryRes.status === 'fulfilled') setRecovery(recoveryRecords(recoveryRes.value ?? []));
    if (stepsRes.status === 'rejected') {
      setState((prev) => (prev.phase === 'ready' ? prev : { phase: 'error' }));
      return;
    }
    const res = stepsRes.value;
    setState((prev) => ({
      phase: 'ready',
      steps: new Map(res.days.map((d) => [d.date, d.steps])),
      earliestDate: res.earliestDate,
      today,
      sleepGoal:
        goalRes.status === 'fulfilled' && goalRes.value?.sleepGoalMinutes > 0
          ? goalRes.value.sleepGoalMinutes
          : // A failed refresh keeps the goal already in use.
            prev.phase === 'ready'
            ? prev.sleepGoal
            : DEFAULT_SLEEP_GOAL_MINUTES,
      sleep:
        sleepRes.status === 'fulfilled'
          ? { phase: 'ready', nights: new Map(sleepRes.value.nights.map((n) => [n.date, n])), earliestDate: sleepRes.value.earliestDate }
          : // A failed refresh keeps the sleep already on screen.
            prev.phase === 'ready' && prev.sleep.phase === 'ready'
            ? prev.sleep
            : { phase: 'error' },
    }));
  }, []);

  useEffect(() => {
    load();
    return () => {
      // Drop anything still in flight once the tab is gone.
      requestId.current++;
    };
  }, [load, dataVersion]);

  // Coming back (e.g. from the Bedtime goal screen) re-reads, so a new sleep
  // goal recolours the heat map. load keeps what is on screen until the new
  // data lands, so there is no flash; the first focus (opening) is skipped.
  const blurred = useRef(false);
  useEffect(() => {
    const offBlur = navigation.addListener?.('blur', () => {
      blurred.current = true;
    });
    const offFocus = navigation.addListener?.('focus', () => {
      if (!blurred.current) return;
      blurred.current = false;
      load();
    });
    return () => {
      offBlur?.();
      offFocus?.();
    };
  }, [navigation, load]);

  async function onRefresh() {
    setRefreshing(true);
    // Pull from Google Health first, then read what it brought in.
    await syncNow('pull');
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: clearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        {state.phase !== 'ready' ? (
          <View className="gap-1">
            <SectionLabel>Steps & sleep</SectionLabel>
            <PageTitle>Activity</PageTitle>
          </View>
        ) : null}

        {state.phase === 'loading' ? (
          <View testID="activity-loading" className="gap-4">
            <Skeleton className="h-10 w-full rounded-card" />
            <Skeleton className="h-80 w-full rounded-card" />
            <Skeleton className="h-28 w-full rounded-card" />
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <View testID="activity-error" className="items-center gap-3 py-12">
            <Text className="text-center text-muted-foreground">Your activity could not be loaded.</Text>
            <Button
              testID="activity-retry"
              variant="secondary"
              onPress={() => {
                setState({ phase: 'loading' });
                load();
              }}
            >
              Try again
            </Button>
          </View>
        ) : null}

        {state.phase === 'ready' ? (
          <ActivityHeatmap
            steps={state.steps}
            earliestDate={state.earliestDate}
            today={state.today}
            sleep={state.sleep}
            sleepGoal={state.sleepGoal}
            openDate={openDate}
            onOpenedDate={() => navigation.setParams({ date: undefined })}
            onOpenSleepDetails={() => openSleep(navigation)}
            onOpenNight={(date) => openNight(navigation, date)}
            onRetrySleep={() => {
              setState((prev) => (prev.phase === 'ready' ? { ...prev, sleep: { phase: 'loading' } } : prev));
              load();
            }}
          />
        ) : null}

        {state.phase === 'ready' && records ? <UsualTiles records={records} recovery={recovery} today={state.today} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
