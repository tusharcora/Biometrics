import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { fetchActivity } from '../api/activity';
import { ActivityHeatmap } from '../components/activity-heatmap';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { fetchRange, todayCivil } from '../lib/heatmap';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import { COLORS, METRIC_CONFIG } from '../theme';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; steps: Map<string, number>; earliestDate: string | null; today: string };

export function ActivityScreen() {
  const clearance = useTabBarClearance();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  // Only the latest request may land: a slow first load must not overwrite a
  // pull-to-refresh that finished after it.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    // One request covers every view and every month the month view can reach.
    const today = todayCivil();
    const { from, to } = fetchRange(today);
    try {
      const res = await fetchActivity(from, to);
      if (id !== requestId.current) return;
      setState({ phase: 'ready', steps: new Map(res.days.map((d) => [d.date, d.steps])), earliestDate: res.earliestDate, today });
    } catch {
      if (id !== requestId.current) return;
      setState((prev) => (prev.phase === 'ready' ? prev : { phase: 'error' }));
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      // Drop anything still in flight once the tab is gone.
      requestId.current++;
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: clearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        <View className="gap-1">
          <Text className="text-2xl font-bold">Activity</Text>
          <Text className="text-sm text-muted-foreground">{`Daily steps against your ${METRIC_CONFIG.STEPS.goalLabel} goal`}</Text>
        </View>

        {state.phase === 'loading' ? (
          <View testID="activity-loading" className="gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-28 w-full" />
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <View testID="activity-error" className="items-center gap-3 py-12">
            <Text className="text-center text-muted-foreground">Your activity could not be loaded.</Text>
            <Button
              testID="activity-retry"
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
          <ActivityHeatmap steps={state.steps} earliestDate={state.earliestDate} today={state.today} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
