import React from 'react';
import { View } from 'react-native';
import { Card } from '../ui/card';
import { Character } from '../characters/Character';
import { useCharacterMood } from '../../characters/useCharacterMood';
import { useScreenFocused } from '../../characters/useScreenFocused';
import { PressableScale } from '../ui/pressable-scale';
import { Text } from '../ui/text';

// Half-width entry to the coach, next to the Sleep tile. Before consent it
// says where it goes (the consent screen), not what the coach will do.
export function CoachTile({ needsConsent, onPress }: { needsConsent: boolean; onPress: () => void }) {
  // Nothing is ever sending from Home, so this is idle, or resting on a poor
  // recovery day.
  const mood = useCharacterMood({ sending: false, answeredAt: null });
  const focused = useScreenFocused();
  return (
    <PressableScale testID="coach-entry-button" accessibilityRole="button" onPress={onPress} className="flex-1">
      <Card className="flex-1 justify-between gap-3 border-coach/25 bg-coach/10">
        <Character testID="coach-tile-character" mood={mood} size={40} glow paused={!focused} />
        <View className="gap-0.5">
          <Text className="text-base font-semibold">Ask Coach</Text>
          <Text className="text-xs text-muted-foreground">{needsConsent ? 'See what’s shared first' : 'About today'}</Text>
        </View>
      </Card>
    </PressableScale>
  );
}
