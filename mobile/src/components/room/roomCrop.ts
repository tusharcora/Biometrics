import { ROOM_H, ROOM_W, type Box } from '../../lib/room/grid';

// Crop, never shrink (spec §3.2): the box is centred in the view, then the room is clamped so its edges never show.
// Extra width shows more room. Whole points, so the 2-point cells stay on the pixel grid.
export function roomCrop({ width, height, cellPt, box }: { width: number; height: number; cellPt: number; box: Box }): { x: number; y: number } {
  const axis = (view: number, start: number, size: number, room: number) => {
    const roomPt = room * cellPt;
    if (roomPt <= view) return Math.round((view - roomPt) / 2);
    const centred = view / 2 - (start + size / 2) * cellPt;
    return Math.round(Math.min(0, Math.max(view - roomPt, centred)));
  };
  return { x: axis(width, box.x, box.w, ROOM_W), y: axis(height, box.y, box.h, ROOM_H) };
}
