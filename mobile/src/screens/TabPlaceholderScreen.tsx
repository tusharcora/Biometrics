import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/ui/text';
import { useTabBarClearance } from '../navigation/tabBarLayout';

// Interim content for tabs whose real screens land in later plans (Activity heat
// map, Metrics trends). Honest about that, and still clear of the floating bar.
export function TabPlaceholderScreen({ title, note }: { title: string; note: string }) {
  const clearance = useTabBarClearance();
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View testID="tab-placeholder" className="flex-1 items-center justify-center gap-2 p-6" style={{ paddingBottom: clearance }}>
        <Text className="text-xl font-semibold">{title}</Text>
        <Text className="text-center text-muted-foreground">{note}</Text>
      </View>
    </SafeAreaView>
  );
}
