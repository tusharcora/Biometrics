import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Text } from '../ui/text';

export interface ContributionBarItem {
  key: string;
  label: string;
  points: number;
}

/** Signed horizontal bars, largest |points| first; reorders with a layout transition. */
export function ContributionBars({ items }: { items: ContributionBarItem[] }) {
  const sorted = [...items].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const scale = Math.max(1, ...sorted.map((i) => Math.abs(i.points)));
  return (
    <View className="gap-2">
      {sorted.map((item) => {
        const pct = (Math.abs(item.points) / scale) * 50;
        const positive = item.points >= 0;
        return (
          <Animated.View key={item.key} layout={LinearTransition.duration(220)} testID={`contribution-${item.key}`} className="gap-1">
            <View className="flex-row justify-between">
              <Text className="text-sm text-foreground">{item.label}</Text>
              <Text className={`text-sm ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {positive ? '+' : '−'}
                {Math.abs(item.points).toFixed(1)}
              </Text>
            </View>
            <View className="h-2 flex-row rounded-full bg-muted">
              <View style={{ width: '50%' }} className="flex-row justify-end">
                {!positive ? <View style={{ width: `${pct * 2}%` }} className="h-2 rounded-l-full bg-rose-500" /> : null}
              </View>
              <View style={{ width: '50%' }}>
                {positive ? <View style={{ width: `${pct * 2}%` }} className="h-2 rounded-r-full bg-emerald-500" /> : null}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
