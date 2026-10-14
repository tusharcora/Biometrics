import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../ui/text';
import { hotspotHitSlop, hotspotPositions, TAG_H, TAG_W } from '../../lib/room/hotspots';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import { ROOM_SLOTS, type RoomSlot } from '../../lib/room/slots';

// The 12 hotspot tags over the decorate room (spec §6.2, K4b), and the dashed LOCKED tag on a locked preview's slot.
// Each tag is a raw Pressable: a label placed on the picture (one buttons-guard entry for the kind). A tag is a fixed
// TAG_W wide (its label shrinks to fit) so the spacing in hotspots.ts holds; its hit slop makes it 44 points tall.
export function HotspotLayer({ crop, selectedSlot, lockedSlot, onSelect }: {
  crop: { width: number; height: number };
  selectedSlot: RoomSlot;
  lockedSlot: RoomSlot | null;
  onSelect: (slot: RoomSlot) => void;
}) {
  const at = hotspotPositions(crop, 2);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, width: crop.width, height: crop.height }}>
      {ROOM_SLOTS.map((slot) =>
        slot === lockedSlot ? (
          <View key={slot} testID={`decorate-locked-${slot}`} accessible={false} style={{ position: 'absolute', ...at[slot], width: TAG_W, height: TAG_H, borderWidth: 1, borderStyle: 'dashed', borderColor: '#F5F5F4', borderRadius: 4, backgroundColor: 'rgba(10,11,14,0.75)', alignItems: 'center', justifyContent: 'center' }}>
            <Text className="font-pixel text-label text-[#F5F5F4]">{ROOM_COPY.locked}</Text>
          </View>
        ) : (
          <Pressable
            key={slot}
            testID={`decorate-hotspot-${slot}`}
            accessibilityRole="button"
            accessibilityLabel={ROOM_COPY.hotspotLabel(slot)}
            accessibilityState={{ selected: slot === selectedSlot }}
            onPress={() => onSelect(slot)}
            hitSlop={hotspotHitSlop(at[slot].top, crop.height)}
            style={{ position: 'absolute', ...at[slot], width: TAG_W, height: TAG_H, borderRadius: 4, backgroundColor: 'rgba(10,11,14,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Text className="font-pixel text-label text-[#F5F5F4]" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{ROOM_COPY.hotspot(slot)}</Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
