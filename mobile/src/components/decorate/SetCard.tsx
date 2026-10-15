import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { SetCardModel } from '../../lib/room/edit/drawer';

// A theme set's card (spec §6.2 Sets; K4b): four swatches, the name, "{n} pieces · {unlock line}", and Apply set
// (owned) or Preview (locked). Earn-only: a locked set shows how it unlocks, never a price.
export function SetCard({ card, onApply, onPreview }: { card: SetCardModel; onApply: () => void; onPreview: () => void }) {
  return (
    <Card testID={`decorate-set-${card.id}`} className="gap-2 p-3">
      <View className="flex-row gap-1" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {card.swatches.map((c, i) => <View key={i} className="h-6 flex-1 rounded" style={{ backgroundColor: c }} />)}
      </View>
      <Text className="text-headline">{card.name}</Text>
      <Text className="text-caption text-muted-foreground" accessibilityLabel={card.spoken}>{card.line}</Text>
      <Button
        testID={`decorate-set-${card.id}-action`}
        variant={card.owned ? 'default' : 'outline'}
        className="h-[44px]"
        accessibilityLabel={card.owned ? ROOM_COPY.set.applyLabel(card.name) : ROOM_COPY.set.previewLabel(card.name)}
        onPress={card.owned ? onApply : onPreview}
      >
        {card.owned ? ROOM_COPY.set.apply : ROOM_COPY.set.preview}
      </Button>
    </Card>
  );
}
