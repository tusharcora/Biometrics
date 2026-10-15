// The KIP page's crop of the iso room (spec 2026-10-15 §9.1): a 140 × 120-cell box centred on KIP's desk (it can
// move), and the collapsed header's 96 × 60 thumbnail, also on the desk. Crop, never shrink: the box is centred in
// the view, then the room is clamped so its edges never show; extra width shows more room. Whole points.
import { isoOf } from '../catalogue';
import type { Box } from '../grid';
import { deskOf } from '../layout';
import { footOf, type RoomLayout } from './geometry';
import { projOf, type IsoGrid } from './grid';

export const FOCUS = { w: 140, h: 120 } as const;
export const THUMB = { w: 96, h: 60 } as const;

export function deskBoxes(g: IsoGrid, layout: RoomLayout): { focus: Box; thumb: Box } {
  const desk = deskOf(layout);
  const iso = desk ? isoOf(desk.item) : undefined;
  let [cx, cy] = [g.W / 2, g.H / 2];
  if (desk && iso) {
    const a = footOf(desk, iso);
    [cx, cy] = projOf(g)((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, 16);
  }
  return {
    focus: { x: Math.round(cx - FOCUS.w / 2), y: Math.round(cy - FOCUS.h / 2), w: FOCUS.w, h: FOCUS.h },
    thumb: { x: Math.round(cx - THUMB.w / 2), y: Math.round(cy - THUMB.h / 2 - 6), w: THUMB.w, h: THUMB.h },
  };
}

export function isoCrop({ width, height, cellPt, box, room }: { width: number; height: number; cellPt: number; box: Box; room: { W: number; H: number } }): { x: number; y: number } {
  const axis = (view: number, start: number, size: number, cells: number) => {
    const roomPt = cells * cellPt;
    if (roomPt <= view) return Math.round((view - roomPt) / 2);
    const centred = view / 2 - (start + size / 2) * cellPt;
    return Math.round(Math.min(0, Math.max(view - roomPt, centred)));
  };
  return { x: axis(width, box.x, box.w, room.W), y: axis(height, box.y, box.h, room.H) };
}
