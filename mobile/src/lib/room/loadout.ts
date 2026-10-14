// What fills each slot (spec 2026-10-14 KIP Coach §5). Spec A passes STARTER_LOADOUT and EMPTY_WORN; Spec B reads
// the user's loadout and worn items from the server.
import { ROOM_SLOTS, WORN_SLOTS, type RoomSlot, type WornSlot } from './slots';

export type ItemId = string;
export type RoomLoadout = Record<RoomSlot, ItemId | null>;
export type KipWorn = Record<WornSlot, ItemId | null>;

/** K4's furnishing at v2 quality (§5 "The starter furnishing"). */
export const STARTER_LOADOUT: RoomLoadout = {
  wallpaper: 'wall.plain',
  floor: 'floor.oakDark',
  art: 'art.calendar',
  window: 'win.plain',
  shelf: 'shelf.books',
  desk: 'desk.monitor',
  desk_item: 'item.mug',
  plant: 'plant.fern',
  lamp: 'lamp.amber',
  corner: null,
  rug: 'rug.slate',
  pet: null,
};

/** KIP wears nothing in Spec A. */
export const EMPTY_WORN: KipWorn = { head: null, face: null, neck: null, ears: null };

/** A stable string for memo keys: every slot in a fixed order. */
export function loadoutKey(loadout: RoomLoadout): string {
  return ROOM_SLOTS.map((s) => `${s}=${loadout[s] ?? ''}`).join('|');
}

export function wornKey(worn: KipWorn): string {
  return WORN_SLOTS.map((s) => `${s}=${worn[s] ?? ''}`).join('|');
}
