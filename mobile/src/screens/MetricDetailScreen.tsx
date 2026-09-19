import React, { useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { TrendLine } from '../components/ui/trend-line';
import { CountUp } from '../components/ui/count-up';
import { COLORS, METRIC_CONFIG } from '../theme';
import { computeStats, buildDetailSentences, type MetricRecord } from '../lib/metricInsights';
import type { RootStackParamList } from '../navigation/RootNavigator';

type MetricDetailRoute = RouteProp<RootStackParamList, 'MetricDetail'>;

export function MetricDetailScreen() {
  const route = useRoute<MetricDetailRoute>();
  const navigation = useNavigation<any>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const { metricType, records } = route.params;
  const config = METRIC_CONFIG[metricType];
  const color = scheme === 'dark' ? config.color.dark : config.color.light;

  const series = useMemo(
    () => [...records].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [records],
  );
  const stats = useMemo(() => computeStats(series), [series]);
  const sentences = useMemo(() => (stats ? buildDetailSentences(metricType, series, stats) : []), [metricType, series, stats]);
  const recent = useMemo(() => [...series].reverse(), [series]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: config.label });
  }, [navigation, config.label]);

  if (!stats) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">No {config.label.toLowerCase()} data yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name={config.icon as any} size={20} color={color} />
              <CountUp value={stats.latest} format={config.format} className="text-4xl font-bold" />
            </View>

            <Card>
              <TrendLine data={series.map((r) => r.value)} color={color} height={120} />
            </Card>

            <Card className="flex-row justify-between">
              <View className="items-center gap-1">
                <Text className="text-xs text-muted-foreground">Min</Text>
                <Text className="font-semibold">{config.format(stats.min)}</Text>
              </View>
              <View className="items-center gap-1">
                <Text className="text-xs text-muted-foreground">Average</Text>
                <Text className="font-semibold">{config.format(stats.average)}</Text>
              </View>
              <View className="items-center gap-1">
                <Text className="text-xs text-muted-foreground">Max</Text>
                <Text className="font-semibold">{config.format(stats.max)}</Text>
              </View>
            </Card>

            <Card className="gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
                <Text className="text-sm font-semibold">Insights</Text>
              </View>
              {sentences.map((sentence, i) => (
                <Text key={i} className="text-sm text-muted-foreground">
                  {sentence}
                </Text>
              ))}
            </Card>

            <Text className="text-sm font-semibold text-muted-foreground">Recent readings</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between border-b border-border py-3">
            <Text style={{ fontVariant: ['tabular-nums'] }}>{config.format(item.value)}</Text>
            <Text className="text-muted-foreground">{new Date(item.recordedAt).toDateString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
});
