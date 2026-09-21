import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Ring } from '../components/ui/ring';
import { TrendLine } from '../components/ui/trend-line';
import { CountUp } from '../components/ui/count-up';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { COLORS, METRIC_CONFIG, METRIC_ORDER, type MetricType } from '../theme';
import { computeStats, buildHeadline, type MetricRecord } from '../lib/metricInsights';

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

function seriesFor(records: MetricRecord[], type: MetricType): MetricRecord[] {
  return records
    .filter((r) => r.metricType === type)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function latestByMetric(records: MetricRecord[]): Partial<Record<MetricType, MetricRecord>> {
  const latest: Partial<Record<MetricType, MetricRecord>> = {};
  for (const record of records) {
    const current = latest[record.metricType];
    if (!current || new Date(record.recordedAt) > new Date(current.recordedAt)) {
      latest[record.metricType] = record;
    }
  }
  return latest;
}

// A real comparison against this person's own recent readings -- never a
// fabricated score. Picks whichever metric deviates most from its own
// trailing average (excluding today's own reading from that average).
function computeHeadlineInsight(records: MetricRecord[]): string | null {
  let best: { deviation: number; message: string } | null = null;

  for (const type of METRIC_ORDER) {
    const stats = computeStats(seriesFor(records, type));
    if (!stats || stats.direction === 'steady') continue;
    if (!best || stats.trendPercent > best.deviation) {
      best = { deviation: stats.trendPercent, message: buildHeadline(type, stats) };
    }
  }

  return best?.message ?? null;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [records, setRecords] = useState<MetricRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    apiFetch<MetricRecord[]>('/me/biometrics')
      .then(setRecords)
      .catch(() => setError('Something went wrong loading your data.'));
  }, []);

  useEffect(() => {
    // A disconnected Google Health is why the data stops updating, so say so
    // rather than leaving the user staring at silently stale numbers.
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => setConnectionStatus(res?.status ?? null))
      .catch(() => setConnectionStatus(null));
  }, []);

  const latest = useMemo(() => latestByMetric(records ?? []), [records]);
  const insight = useMemo(() => computeHeadlineInsight(records ?? []), [records]);

  function openDetail(type: MetricType) {
    navigation.navigate('MetricDetail', { metricType: type, records: seriesFor(records ?? [], type) });
  }

  // Rendered on every branch so signing out is always reachable.
  const headerActions = (
    <View className="flex-row items-center gap-4">
      <ThemeToggle color={colors.muted} />
      <Pressable testID="settings-button" onPress={() => navigation.navigate('Settings')} hitSlop={8} className="active:opacity-70">
        <Ionicons name="settings-outline" size={20} color={colors.muted} />
      </Pressable>
      <Button testID="sign-out-button" variant="ghost" size="sm" onPress={() => signOut()}>
        Sign Out
      </Button>
    </View>
  );

  if (connectionStatus === 'DISCONNECTED') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-semibold">Reconnect your Google Health</Text>
          <Text className="text-center text-muted-foreground">
            Your Google Health is disconnected, so your data has stopped updating.
          </Text>
          <Button testID="reconnect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
            Reconnect Google Health
          </Button>
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  if (error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">{error}</Text>
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  if (records === null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row flex-wrap gap-3 p-4">
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
          <Skeleton className="h-32 w-[47%]" />
        </View>
      </SafeAreaView>
    );
  }

  if (records.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">
            No data yet — check back after your Google Health syncs.
          </Text>
          {headerActions}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold">Today</Text>
          {headerActions}
        </View>

        <View className="flex-row flex-wrap gap-3">
          {METRIC_ORDER.map((type, index) => {
            const record = latest[type];
            if (!record) return null;
            const config = METRIC_CONFIG[type];
            const color = scheme === 'dark' ? config.color.dark : config.color.light;
            const percent = config.goal ? record.value / config.goal : undefined;
            return (
              <Animated.View key={type} entering={FadeInDown.delay(index * 70).duration(400)} className="w-[47%] grow">
                <Pressable testID={`metric-card-${type}`} onPress={() => openDetail(type)} className="active:opacity-80">
                  <Card className="items-center gap-2 py-5">
                    <Ring size={84} strokeWidth={8} color={color} percent={percent}>
                      <View className="items-center gap-0.5">
                        <Ionicons name={config.icon as any} size={14} color={color} />
                        <CountUp
                          value={record.value}
                          format={config.format}
                          className="text-base font-bold"
                          style={{ fontVariant: ['tabular-nums'] }}
                        />
                      </View>
                    </Ring>
                    <Text className="text-xs font-medium text-muted-foreground">{config.label}</Text>
                    {config.goalLabel ? (
                      <Text className="text-[10px] text-muted-foreground">{config.goalLabel}</Text>
                    ) : null}
                  </Card>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {insight ? (
          <Card className="flex-row items-center gap-3">
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            <Text className="flex-1 text-sm text-muted-foreground">{insight}</Text>
          </Card>
        ) : null}

        <Text className="text-sm font-semibold text-muted-foreground">Trends</Text>
        {METRIC_ORDER.map((type) => {
          const series = seriesFor(records, type);
          if (series.length === 0) return null;
          const config = METRIC_CONFIG[type];
          const color = scheme === 'dark' ? config.color.dark : config.color.light;
          const latestRecord = series[series.length - 1];
          return (
            <Pressable key={type} testID={`trend-card-${type}`} onPress={() => openDetail(type)} className="active:opacity-80">
              <Card className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name={config.icon as any} size={16} color={color} />
                    <Text className="font-medium">{config.label}</Text>
                  </View>
                  <Text className="font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
                    {config.format(latestRecord.value)}
                  </Text>
                </View>
                <TrendLine data={series.map((r) => r.value)} color={color} />
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
