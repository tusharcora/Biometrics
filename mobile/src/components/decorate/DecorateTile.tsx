import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../ui/text';
import { ItemIcon } from '../room/ItemIcon';
import type { KipColour } from '../../lib/kip/kipArt';
import type { TileModel } from '../../lib/room/tray';

const PLACED = '#4ADE80';
const FLAG: Record<string, string> = { TINT: '#C4B5FD', GLOW: '#FDE047', ANIM: '#67E8F9' };

// A tray tile (spec §6.3): the piece's icon at 3×, its name, a tag (Placed / Owned / the unlock line) and its flags.
// Locked tiles are at 45%. A raw Pressable (one buttons-guard entry): a picture you tap to place or preview.
export function DecorateTile({ tile, colour, onPress, testID }: { tile: TileModel; colour: KipColour; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      accessibilityState={{ selected: tile.selected }}
      onPress={onPress}
      className="w-[31%] gap-1 rounded-lg border border-border bg-card p-2"
      style={{ opacity: tile.state === 'locked' ? 0.45 : 1, borderWidth: tile.selected ? 2 : 1, borderColor: tile.selected ? '#F5F5F4' : undefined }}
    >
      <View className="items-center justify-center rounded-md bg-background py-1">
        {tile.itemId ? <ItemIcon id={tile.itemId} colour={colour} /> : <View style={{ width: 48, height: 48 }} />}
      </View>
      <Text className="text-fine" numberOfLines={2}>{tile.name}</Text>
      <Text className="text-fine text-muted-foreground" style={tile.state === 'placed' ? { color: PLACED } : undefined} numberOfLines={2}>{tile.tag}</Text>
      {tile.flags.length ? (
        <View className="flex-row flex-wrap gap-1">
          {tile.flags.map((f) => (
            <Text key={f} className="rounded border px-1 font-pixel text-label" style={{ color: FLAG[f], borderColor: FLAG[f] }}>{f}</Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
