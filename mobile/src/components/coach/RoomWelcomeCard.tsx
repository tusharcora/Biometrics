import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { ItemIcon } from '../room/ItemIcon';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const W = ROOM_COPY.welcome;

// C7 "Day 1" (spec 2026-10-15 §11.1, plan ruling 18): shown once, across devices, inside the room card under the
// frame until it is answered, with P2's coins line (spec §11.1). It never blocks the page: the chat below works as always.
export function RoomWelcomeCard({ onPlace, onLater }: { onPlace: () => void; onLater: () => void }) {
  return (
    <Card testID="room-welcome" className="gap-3 p-3">
      <Text className="text-body">{W.text}</Text>
      <Text className="text-body">{W.coins}</Text>
      <View testID="welcome-lantern" accessible accessibilityLabel={W.lanternSpoken} className="flex-row items-center gap-3">
        <View className="items-center justify-center rounded-lg bg-background p-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ItemIcon id="lamp.welcome" colour="coral" />
        </View>
        <View className="shrink gap-0.5">
          <Text className="text-body font-semibold">{W.lanternName}</Text>
          <Text className="text-caption text-muted-foreground">{W.lanternLine}</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button testID="welcome-place" className="flex-1" onPress={onPlace}>{W.place}</Button>
        <Button testID="welcome-later" variant="outline" className="flex-1" onPress={onLater}>{W.later}</Button>
      </View>
    </Card>
  );
}
