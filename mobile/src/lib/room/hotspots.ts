// Where each slot's "+ ART" tag sits over the decorate room (spec §6.2; ruling 15): a cell per slot near its anchor
// (the engine's layout, not K4b's v1 one), turned into points by the crop and clamped inside the view. Each tag is
// TAG_W × TAG_H; its touch target grows to TOUCH_MIN tall through a vertical hit slop that stays inside the room, and
// the cells are spaced so no two targets overlap at any phone width.
import { roomCrop } from '../../components/room/roomCrop';
import { FOCUS_BOX } from './grid';
import type { RoomSlot } from './slots';

export const HOTSPOT_CELLS: Readonly<Record<RoomSlot, { x: number; y: number }>> = {
  wallpaper: { x: 56, y: 1 }, floor: { x: 132, y: 100 }, window: { x: 18, y: 13 }, art: { x: 128, y: 38 },
  shelf: { x: 94, y: 9 }, desk: { x: 96, y: 78 }, desk_item: { x: 94, y: 50 }, plant: { x: 136, y: 70 },
  lamp: { x: 46, y: 46 }, corner: { x: 1, y: 45 }, rug: { x: 60, y: 92 }, pet: { x: 20, y: 102 },
};
export const TAG_W = 64;
export const TAG_H = 18;
/** The tag's side padding: leaves 60 points for the label. */
export const TAG_PAD_X = 2;
/** The smallest a tag label may shrink to; every HOTSPOT_LABELS entry fits at this scale with at least 2 points to
 * spare (decorateTray.test). */
export const HOTSPOT_MIN_FONT_SCALE = 0.75;
/** The smallest touch target, in points (iOS's 44). */
export const TOUCH_MIN = 44;

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

/** The vertical hit slop that makes a tag at `top` TOUCH_MIN tall: centred on it, shifted to stay inside the room. */
export function hotspotHitSlop(top: number, cropHeight: number): { top: number; bottom: number; left: 0; right: 0 } {
  const extra = TOUCH_MIN - TAG_H;
  const targetTop = Math.max(0, Math.min(cropHeight - TOUCH_MIN, top - Math.round(extra / 2)));
  return { top: top - targetTop, bottom: extra - (top - targetTop), left: 0, right: 0 };
}

/** Each tag's touch target in the room's points. */
export function hotspotTargets(crop: { width: number; height: number }, cellPt: number): Record<RoomSlot, { left: number; top: number; width: number; height: number }> {
  const at = hotspotPositions(crop, cellPt);
  return Object.fromEntries(
    (Object.keys(at) as RoomSlot[]).map((slot) => {
      const p = at[slot];
      return [slot, { left: p.left, top: p.top - hotspotHitSlop(p.top, crop.height).top, width: TAG_W, height: TOUCH_MIN }];
    }),
  ) as Record<RoomSlot, { left: number; top: number; width: number; height: number }>;
}
