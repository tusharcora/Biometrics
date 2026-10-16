// Slot rooms to iso rooms (spec 2026-10-15 §2.4). The input is always Spec B's sanitised room (loadout.ts readRoom),
// never the raw JSON, so every id is owned, shipped and in its slot. Each slot has a fixed place taken from isox.py's
// `standard` room, and a fixed instance id (plan ruling 10).
import { OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_ROOM, cosmeticItem, type RoomSlot } from '../cosmetics/catalogue';
import type { Placement, PlacementLayer, RoomLayout } from './geometry';

export type SlotRoom = Record<RoomSlot, string | null>;
/** The converted art hangs from step 9, so the tallest piece (6 steps) ends under the wall top. */
export const ART_STEP = 9;

const at = (id: string, item: string, layer: PlacementLayer, x: number, y: number, extra: Partial<Placement> = {}): Placement =>
  ({ id, item, layer, x, y, facing: 'L', mirror: false, ...extra });

export function layoutFromSlots(room: SlotRoom): RoomLayout {
  const pieces: Placement[] = [at('desk', room.desk ?? STARTER_ROOM.desk!, 'floor', 2, 0)];
  const onDesk = (id: string, item: string, spot: number) => pieces.push(at(id, item, 'onTop', 0, 0, { parent: 'desk', spot }));
  if (room.lamp) {
    if (cosmeticItem(room.lamp)?.iso?.layers.includes('onTop')) onDesk('lamp', room.lamp, 0);
    else pieces.push(at('lamp', room.lamp, 'wallL', 0, 14)); // the Cottage garland, above the window (ruling 7)
  }
  if (room.desk_item) onDesk('deskitem', room.desk_item, 2);
  // A shelf that hangs on the wall itself (P3's trophy shelf) takes the plank's place.
  if (room.shelf && !cosmeticItem(room.shelf)?.iso?.layers.includes('onTop') && room.shelf !== 'shelf.plank') {
    pieces.push(at('shelf', room.shelf, 'wallR', 6, 10));
  } else if (room.shelf) {
    pieces.push(at('plank', 'shelf.plank', 'wallR', 6, 10));
    // A stored shelf of the plank itself (a starter in the shelf slot) is the bare plank, with nothing on it.
    if (room.shelf !== 'shelf.plank') pieces.push(at('shelf', room.shelf, 'onTop', 0, 0, { parent: 'plank', spot: 0 }));
  }
  if (room.art) pieces.push(at('art', room.art, 'wallR', 2, ART_STEP));
  if (room.plant) pieces.push(at('plant', room.plant, 'floor', 0, 0));
  if (room.corner) pieces.push(at('corner', room.corner, 'floor', 5, 0));
  if (room.rug) pieces.push(at('rug', room.rug, 'floor', 1, 2));
  if (room.pet) pieces.push(at('pet', room.pet, 'floor', 4, 5));
  return {
    v: 1,
    styles: { wallpaper: room.wallpaper ?? STARTER_ROOM.wallpaper!, floor: room.floor ?? STARTER_ROOM.floor!, window: room.window ?? STARTER_ROOM.window! },
    pieces,
  };
}

/** A new user's room (spec §11.1): Spec B's starter room without the wall calendar, which waits in the inventory. */
export function starterLayout(): RoomLayout {
  return layoutFromSlots({ ...STARTER_ROOM, art: null });
}

/** The slot room GET still returns until P2 drops `room` (spec §2.4), for dev builds on Spec B. */
export function slotsFromLayout(layout: RoomLayout): SlotRoom {
  const room = {} as SlotRoom;
  for (const slot of ROOM_SLOTS) {
    if (slot === 'wallpaper' || slot === 'floor' || slot === 'window') { room[slot] = layout.styles[slot]; continue; }
    // The plank holds the shelf slot's item, so it reads as the slot only when nothing stands in for it.
    const plankLast = (p: Placement) => (p.item === 'shelf.plank' ? 1 : 0);
    const first = layout.pieces
      .filter((p) => cosmeticItem(p.item)?.slot === slot)
      .sort((a, b) => plankLast(a) - plankLast(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    room[slot] = first?.item ?? (OPTIONAL_ROOM_SLOTS.has(slot) ? null : STARTER_ROOM[slot]);
  }
  return room;
}
