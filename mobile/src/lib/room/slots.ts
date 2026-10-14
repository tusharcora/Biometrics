// The room's slots (spec 2026-10-14 KIP Coach §5). Spec B (KIP's room) uses the same ids for its catalogue and its
// decorate-mode hotspots, so these names are fixed. Each room slot has an anchor rect on the 170 × 110 grid: where
// its item sits and where Spec B puts the slot's hotspot.
import type { Box } from './grid';

export const ROOM_SLOTS = ['wallpaper', 'floor', 'art', 'window', 'shelf', 'desk', 'desk_item', 'plant', 'lamp', 'corner', 'rug', 'pet'] as const;
export type RoomSlot = (typeof ROOM_SLOTS)[number];

export const WORN_SLOTS = ['head', 'face', 'neck', 'ears'] as const;
export type WornSlot = (typeof WORN_SLOTS)[number];

export const SLOT_ANCHORS: Record<RoomSlot, Box> = {
  wallpaper: { x: 0, y: 0, w: 170, h: 86 },
  floor: { x: 0, y: 74, w: 170, h: 36 },
  window: { x: 16, y: 12, w: 40, h: 43 },
  art: { x: 130, y: 12, w: 22, h: 24 },
  shelf: { x: 94, y: 16, w: 38, h: 18 },
  desk: { x: 58, y: 46, w: 84, h: 56 },
  desk_item: { x: 102, y: 56, w: 8, h: 18 },
  plant: { x: 148, y: 74, w: 22, h: 36 },
  lamp: { x: 58, y: 50, w: 16, h: 22 },
  corner: { x: 0, y: 30, w: 14, h: 66 },
  rug: { x: 28, y: 90, w: 118, h: 18 },
  pet: { x: 30, y: 92, w: 26, h: 14 },
};

/** Back to front: walls, floor, wall pieces, floor pieces, the desk, what stands on it, then the foreground. */
export const DRAW_ORDER: readonly RoomSlot[] = ['wallpaper', 'floor', 'window', 'art', 'shelf', 'rug', 'corner', 'desk', 'desk_item', 'lamp', 'pet', 'plant'];
