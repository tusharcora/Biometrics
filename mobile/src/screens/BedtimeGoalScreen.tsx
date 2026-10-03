import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/ui/text';

// Placeholder so the BedtimeGoal route exists; the goal editor replaces it.
export function BedtimeGoalScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="font-display text-display">Bedtime goal</Text>
      </View>
    </SafeAreaView>
  );
}
