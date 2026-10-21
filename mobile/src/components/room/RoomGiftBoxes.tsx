import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { GiftDTO } from '../../api/rooms';
import { BOX_PT, GIFT_CELL_PT, MAX_BOXES, boxAt, giftCrop, giftPoint, giftTiles } from '../../lib/room/gifts';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import { Button } from '../ui/button';

// A small pixel present: red box, pink lid, yellow ribbon and bow (OWNER NOTE: the box art is the owner's to confirm).
const BOX: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [1, 4, 10, 7, '#DC2626'], [1, 3, 10, 2, '#F87171'], [5, 3, 2, 8, '#FDE047'], [3, 1, 2, 2, '#FDE047'], [7, 1, 2, 2, '#FDE047'],
];

/** The tiles the boxes stand on for these gifts in a `width` × `height` card: the ones RoomGiftBoxes draws. */
export function giftBoxTiles(count: number, layout: RoomLayout, tier: Tier, width: number, height: number): Array<[number, number]> {
  if (count <= 0 || width <= 0) return [];
  return giftTiles(layout, tier, Math.min(count, MAX_BOXES), giftCrop(layout, tier, width, height).view);
}

// Gift boxes on your floor (spec 2026-10-15 §10.3; P4 ruling 14, PF4-F8): over the KIP page's room, on free tiles the
// card shows whole, never placements and never in the room picture (a tick records nothing for them). Each is a
// 44-pt ghost Button that says whose gift it is, on top of the room, so a tap on a box opens it and never falls to a
// piece, the cat or KIP behind it (and those keep off the boxes' tiles). At most 3; opening one shows the next.
export function RoomGiftBoxes({ gifts, layout, tier, width, height, onOpen, busy = false }: {
  gifts: readonly GiftDTO[]; layout: RoomLayout; tier: Tier; width: number; height: number; onOpen: (id: string) => void; busy?: boolean;
}) {
  const count = gifts.length;
  const spots = useMemo(() => {
    const tiles = giftBoxTiles(count, layout, tier, width, height);
    if (!tiles.length) return [];
    const { offset } = giftCrop(layout, tier, width, height);
    return tiles.map((t) => boxAt(giftPoint(tier, t, offset, GIFT_CELL_PT)));
  }, [count, layout, tier, width, height]);
  return (
    <>
      {spots.map((at, k) => {
        const gift = gifts[k]!;
        return (
          <View key={gift.id} testID={`gift-spot-${gift.id}`} style={{ position: 'absolute', left: at.left, top: at.top, width: BOX_PT, height: BOX_PT }}>
            <Button
              testID={`gift-box-${gift.id}`}
              variant="ghost"
              size="icon-lg"
              className="size-[44px]"
              // Busy, it stays enabled and ignores the press: a disabled box would let the touch fall through to the
              // room under it, which would read the box's own coordinates as a tap on a piece (T10-FIX I2).
              accessibilityState={{ busy }}
              accessibilityLabel={ROOM_COPY.gifts.box(gift.from?.name ?? null)}
              onPress={() => { if (!busy) onOpen(gift.id); }}
            >
              <Svg width={24} height={24} viewBox="0 0 12 12" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {BOX.map(([bx, by, w, h, fill], i) => <Rect key={i} x={bx} y={by} width={w} height={h} fill={fill} />)}
              </Svg>
            </Button>
          </View>
        );
      })}
    </>
  );
}
