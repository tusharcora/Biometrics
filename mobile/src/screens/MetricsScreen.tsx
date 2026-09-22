import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PressableScale } from '../components/ui/pressable-scale';
import { Reveal } from '../components/ui/reveal';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { TrendLine } from '../components/ui/trend-line';
import { todayCivil } from '../lib/heatmap';
import type { MetricRecord } from '../lib/metricInsights';
import { TREND_RANGES, changeText, rangeDays, seriesFor, trendSummary, type TrendRange } from '../lib/metricTrends';
import { useTabBarClearance } from '../navigation/tabBarLayout';
import { COLORS, METRIC_CONFIG, METRIC_ORDER, type MetricType } from '../theme';

const RANGE_OPTIONS = TREND_RANGES.map(({ value, label }) => ({ value, label }));

export function MetricsScreen() {
  const navigation = useNavigation<any>();
  const clearance = useTabBarClearance();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = COLORS[scheme];
  const [records, setRecords] = useState<MetricRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<TrendRange>('30d');
  const [today, setToday] = useState(() => todayCivil());
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const data = await apiFetch<MetricRecord[]>('/me/biometrics');
      if (id !== requestId.current) return;
      setRecords(data ?? []);
      setFailed(false);
      setToday(todayCivil());
    } catch {
      if (id !== requestId.current) return;
      // Keep showing what was loaded before; only an empty screen shows the error.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      requestId.current++;
    };
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const days = rangeDays(range);
  const summaries = useMemo(
    () => METRIC_ORDER.map((type) => ({ type, summary: trendSummary(seriesFor(records ?? [], type), today, days) })),
    [records, today, days],
  );

  function openDetail(type: MetricType, points: MetricRecord[]) {
    navigation.navigate('MetricDetail', { metricType: type, records: points });
  }

  let body: React.ReactNode;
  if (records === null && !failed) {
    body = (
      <View testID="metrics-loading" className="gap-3">
        {METRIC_ORDER.map((type) => (
          <Skeleton key={type} className="h-36 w-full" />
        ))}
      </View>
    );
  } else if (records === null) {
    body = (
      <View testID="metrics-error" className="items-center gap-3 py-12">
        <Text className="text-center text-muted-foreground">Your metrics could not be loaded.</Text>
        <Button testID="metrics-retry" onPress={() => load()}>
          Try again
        </Button>
      </View>
    );
  } else if (records.length === 0) {
    body = (
      <Card testID="metrics-empty">
        <Text className="text-sm text-muted-foreground">Trends appear here once your Google Health data has synced.</Text>
      </Card>
    );
  } else {
    body = summaries.map(({ type, summary }, index) => {
      const config = METRIC_CONFIG[type];
      const color = config.color[scheme];
      return (
        <Reveal key={type} index={index}>
          <PressableScale
            testID={`trend-card-${type}`}
            accessibilityRole="button"
            accessibilityLabel={`${config.label} trend`}
            disabled={!summary}
            onPress={() => summary && openDetail(type, summary.points)}
          >
            <Card className="gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Ionicons name={config.icon as any} size={16} color={color} />
                  <Text className="font-medium">{config.label}</Text>
                </View>
                {summary ? (
                  <Text testID={`trend-latest-${type}`} className="text-lg font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {config.format(summary.latest)}
                  </Text>
                ) : null}
              </View>

              {summary ? (
                <>
                  {summary.points.length >= 2 ? (
                    <TrendLine data={summary.points.map((p) => p.value)} color={color} />
                  ) : (
                    <Text className="py-6 text-center text-xs text-muted-foreground">One reading in this range so far</Text>
                  )}
                  <View className="flex-row justify-between">
                    <Text testID={`trend-average-${type}`} className="text-xs text-muted-foreground">
                      {`Avg ${config.format(summary.average)}`}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {`${config.format(summary.min)} – ${config.format(summary.max)}`}
                    </Text>
                  </View>
                  <Text testID={`trend-change-${type}`} className="text-xs text-muted-foreground">
                    {changeText(summary.changePercent, days)}
                  </Text>
                </>
              ) : (
                <Text testID={`trend-empty-${type}`} className="text-sm text-muted-foreground">
                  {`No ${config.label.toLowerCase()} readings in the last ${days} days.`}
                </Text>
              )}
            </Card>
          </PressableScale>
        </Reveal>
      );
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: clearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
      >
        <Text className="text-2xl font-bold">Metrics</Text>

        <SegmentedControl testID="metrics-range" options={RANGE_OPTIONS} value={range} onChange={setRange} />

        <PressableScale testID="patterns-button" accessibilityRole="button" onPress={() => navigation.navigate('Patterns')}>
          <Card className="flex-row items-center gap-3">
            <Ionicons name="git-compare-outline" size={18} color={colors.accent} />
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold">Patterns</Text>
              <Text className="text-xs text-muted-foreground">How your habits line up with your recovery</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </PressableScale>

        {body}
      </ScrollView>
    </SafeAreaView>
  );
}
