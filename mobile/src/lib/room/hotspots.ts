// Where each slot's "+ ART" tag sits over the decorate room (spec §6.2; ruling 15): a cell per slot near its anchor
// (the engine's layout, not K4b's v1 one), turned into points by the crop and clamped inside the view.
import { roomCrop } from '../../components/room/roomCrop';
import { FOCUS_BOX } from './grid';
import type { RoomSlot } from './slots';

export const HOTSPOT_CELLS: Readonly<Record<RoomSlot, { x: number; y: number }>> = {
  wallpaper: { x: 66, y: 1 }, floor: { x: 132, y: 100 }, window: { x: 18, y: 13 }, art: { x: 128, y: 38 },
  shelf: { x: 94, y: 9 }, desk: { x: 76, y: 78 }, desk_item: { x: 96, y: 50 }, plant: { x: 136, y: 70 },
  lamp: { x: 46, y: 46 }, corner: { x: 1, y: 30 }, rug: { x: 60, y: 92 }, pet: { x: 20, y: 102 },
};
export const TAG_W = 64;
export const TAG_H = 18;

export function hotspotPositions(crop: { width: number; height: number }, cellPt: number): Record<RoomSlot, { left: number; top: number }> {
  const off = roomCrop({ width: crop.width, height: crop.height, cellPt, box: FOCUS_BOX });
  const clamp = (v: number, max: number) => Math.max(2, Math.min(max - 2, Math.round(v)));
  return Object.fromEntries(
    (Object.keys(HOTSPOT_CELLS) as RoomSlot[]).map((slot) => {
      const c = HOTSPOT_CELLS[slot];
      return [slot, { left: clamp(off.x + c.x * cellPt, crop.width - TAG_W), top: clamp(off.y + c.y * cellPt, crop.height - TAG_H) }];
    }),
  ) as Record<RoomSlot, { left: number; top: number }>;
}
