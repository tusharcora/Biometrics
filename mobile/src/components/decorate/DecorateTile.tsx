import React from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '../ui/text';
import { ItemIcon } from '../room/ItemIcon';
import type { KipColour } from '../../lib/kip/kipArt';
import type { DrawerTile } from '../../lib/room/edit/drawer';
import { ROOM_COPY } from '../../lib/room/roomCopy';

export interface TileDrag { lift(absX: number, absY: number): void; move(absX: number, absY: number): void; drop(): void; cancel(): void }

// A drawer tile (spec 2026-10-15 §5.4): the icon, the name, "×3" or "All placed" (dimmed), a NEW tag; a locked worn
// piece at 45% with its unlock line. At least 64 points. A raw Pressable (one buttons-guard entry): a picture you tap
// to pick. Held 200 ms, it drags the piece into the room (ruling 16); a tile with none left never starts a drag
// (ruling T13-CARRY). A drag the system cancels puts nothing down.
export function DecorateTile({ tile, colour, onPress, drag, testID }: { tile: DrawerTile; colour: KipColour; onPress: () => void; drag?: TileDrag; testID: string }) {
  const body = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      accessibilityState={{ selected: tile.selected }}
      onPress={onPress}
      className="min-h-[64px] w-[31%] gap-1 rounded-lg border border-border bg-card p-2"
      style={{ opacity: tile.locked ? 0.45 : tile.allPlaced ? 0.5 : 1, borderWidth: tile.selected ? 2 : 1, borderColor: tile.selected ? '#F5F5F4' : undefined }}
    >
      <View className="items-center justify-center rounded-md bg-background py-1">
        {tile.item ? <ItemIcon id={tile.item} colour={colour} /> : <View style={{ width: 48, height: 48 }} />}
      </View>
      <Text className="text-fine" numberOfLines={2}>{tile.name}</Text>
      <View className="flex-row flex-wrap items-center gap-1">
        {tile.tag ? <Text className="text-fine text-muted-foreground" numberOfLines={2}>{tile.tag}</Text> : null}
        {tile.item && !tile.locked && tile.count > 0 ? <Text className="text-fine text-muted-foreground">{ROOM_COPY.drawer.count(tile.count)}</Text> : null}
        {tile.allPlaced ? <Text className="text-fine text-muted-foreground">{ROOM_COPY.drawer.allPlaced}</Text> : null}
        {tile.isNew ? <Text className="rounded-lg border border-primary px-1 font-pixel text-label text-primary">{ROOM_COPY.drawer.newTag}</Text> : null}
      </View>
    </Pressable>
  );
  if (!drag || !tile.item || tile.allPlaced || tile.locked) return body;
  const hold = Gesture.Pan()
    .activateAfterLongPress(200)
    .runOnJS(true)
    .withTestId(`drawer-drag-${tile.item}`)
    .onStart((e) => drag.lift(e.absoluteX, e.absoluteY))
    .onUpdate((e) => drag.move(e.absoluteX, e.absoluteY))
    .onEnd((_e, ok) => (ok ? drag.drop() : drag.cancel()));
  return <GestureDetector gesture={hold}>{body}</GestureDetector>;
}
