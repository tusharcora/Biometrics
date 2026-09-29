import React from 'react';
import { View } from 'react-native';
import { Card } from '../ui/card';
import { StillOrb } from '../ui/still-orb';
import { PressableScale } from '../ui/pressable-scale';
import { Text } from '../ui/text';

// Half-width entry to the coach, next to the Sleep tile. Before consent it
// says where it goes (the consent screen), not what the coach will do.
export function CoachTile({ needsConsent, onPress }: { needsConsent: boolean; onPress: () => void }) {
  return (
    <PressableScale testID="coach-entry-button" accessibilityRole="button" onPress={onPress} className="flex-1">
      <Card className="flex-1 justify-between gap-3 border-coach/25 bg-coach/10">
        <StillOrb size={40} />
        <View className="gap-0.5">
          <Text className="text-base font-semibold">Ask Coach</Text>
          <Text className="text-xs text-muted-foreground">{needsConsent ? 'See what’s shared first' : 'About today'}</Text>
        </View>
      </Card>
    </PressableScale>
  );
}
