// Activity: "Against your usual · 30d" — four tiles (Resting HR, Sleep, HRV, Recovery), with "Patterns" and
// "All trends" (→ Trends, the old Metrics) as text links in the section header.

import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from 'nativewind';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { MetricRecord } from '../../lib/metricInsights';
import { usualTiles, type TileRecord, type UsualTile } from '../../lib/usualTiles';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { PressableScale } from '../ui/pressable-scale';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { TrendLine } from '../ui/trend-line';

export function UsualTiles({ records, recovery, today }: { records: MetricRecord[]; recovery: TileRecord[]; today: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'light' ? 'light' : 'dark';
  const tiles = usualTiles(records, recovery, today);

  const open = (tile: UsualTile) => {
    if (tile.type === 'RECOVERY') {
      // Without a score there is no day to open.
      if (tile.latestDate) navigation.navigate('ScoreDetail', { date: tile.latestDate, type: 'RECOVERY' });
      return;
    }
    navigation.navigate('MetricDetail', { metricType: tile.type, records: tile.series as MetricRecord[], range: '30d' });
  };

  return (
    <View testID="usual-tiles" className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionLabel>Against your usual · 30d</SectionLabel>
        <View className="flex-row items-center gap-4">
          <Button testID="usual-patterns" variant="link" size="sm" accessibilityRole="link" onPress={() => navigation.navigate('Patterns')}>
            Patterns
          </Button>
          <Button testID="all-trends" variant="link" size="sm" accessibilityRole="link" onPress={() => navigation.navigate('Trends')}>
            All trends
          </Button>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-3">
        {tiles.map((tile) => (
          <PressableScale
            key={tile.type}
            testID={`usual-tile-${tile.type}`}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}, ${tile.latest ?? 'no reading'}${tile.delta ? `, ${tile.delta}` : ''}`}
            className="w-[48%]"
            onPress={() => open(tile)}
          >
            <Card className="gap-1">
              <View className="flex-row items-center gap-1.5">
                <View testID={`usual-tile-${tile.type}-dot`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tile.color[scheme] }} />
                <Text className="text-caption text-muted-foreground" numberOfLines={1}>
                  {tile.label}
                </Text>
              </View>
              <Text className="text-heading tabular-nums" numberOfLines={1} adjustsFontSizeToFit>
                {tile.latest ?? '—'}
              </Text>
              <TrendLine data={tile.points.map((r) => r.value)} color={tile.color[scheme]} height={28} />
              {tile.delta ? (
                <Text className="text-caption text-muted-foreground" numberOfLines={1}>
                  {tile.delta}
                </Text>
              ) : null}
            </Card>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
