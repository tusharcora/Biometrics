import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// F4 "Can't place · room full" (spec 2026-10-15 §5.3): store a piece, or see the room sizes (P2).
export function RoomFullCard({ cap, onStore, onSizes }: { cap: number; onStore: () => void; onSizes?: () => void }) {
  return (
    <Card testID="room-full" className="gap-2 p-3" accessibilityLiveRegion="polite">
      <Text className="text-body">{ROOM_COPY.drawer.full.text(cap)}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button testID="room-full-store" variant="outline" className="h-[44px]" onPress={onStore}>{ROOM_COPY.drawer.full.store}</Button>
        {onSizes ? <Button testID="room-full-sizes" variant="outline" className="h-[44px]" onPress={onSizes}>{ROOM_COPY.drawer.full.sizes}</Button> : null}
      </View>
    </Card>
  );
}
