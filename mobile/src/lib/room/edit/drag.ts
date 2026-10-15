// A drag in the editor (spec 2026-10-15 §5.3): what the ghost snaps to under the finger, whether it may land there
// and why not, the ghost's rects (the piece and what stands on it, at the target) and its red copy, and the pan's
// limits (§5.6). Pure.
import { KIP_COLOURS, kipRamp, type KipColour } from '../../kip/kipArt';
import type { ItemContext } from '../items';
import type { ItemId } from '../loadout';
import type { Rects } from '../paint';
import { pieceLayers } from '../iso/art';
import { isoGrid, projOf, type IsoGrid } from '../iso/grid';
import type { Placement } from '../iso/geometry';
import { moveRects } from '../iso/prims';
import { anchorOf } from '../iso/room';
import { childrenOf } from '../layout';
import { inventory, type EditorState } from './editor';
import { placedAt, refusal, snapTarget, targetKey, targetPoint, type Refused, type Target } from './targets';

// One key format for a target (ruling: drag.ts uses targets.ts's).
export { targetKey };

/** The ghost sits this far above the finger, so the finger never hides it. */
export const LIFT_PT = 24;
/** A dragged piece this close to the room view's edge scrolls the room. */
export const EDGE_PT = 32;
const RED = 'rgba(248,113,113,0.6)';

export interface DragBase { item: ItemId; id: string | null; facing: 'L' | 'R'; mirror: boolean }
export interface Drag extends DragBase { cell: [number, number]; target: Target | null; refused: Refused | null }

/** The drag with the ghost at room cell `cell`: its snap target and, when it may not land there, why (spec §5.3). */
export function dragAt(state: EditorState, base: DragBase, cell: [number, number]): Drag {
  const g = isoGrid(state.tier);
  const layout = state.draft.layout;
  const target = snapTarget(g, layout, base.item, cell, base.facing, base.id);
  // Nothing on a layer it can use under the finger: the layer reason ("Only on the wall").
  if (!target) return { ...base, cell, target, refused: { reason: 'layer' } };
  if (base.id === null && !((inventory(state)[base.item] ?? 0) > 0)) return { ...base, cell, target, refused: { reason: 'outside' } };
  const piece = placedAt({ id: base.id ?? '__ghost', item: base.item, facing: base.facing, mirror: base.mirror }, target);
  // refusal checks the layer first (ruling T2), then the cap for a new piece, then the geometry.
  return { ...base, cell, target, refused: refusal(layout, piece, state.tier, base.id === null) };
}

/** Where a placed piece stands now, as a target. */
export function targetOf(p: Placement): Target {
  return p.layer === 'onTop' ? { layer: 'onTop', parent: p.parent ?? '', spot: p.spot ?? 0 } : { layer: p.layer, x: p.x, y: p.y };
}

/**
 * The grab (ruling T12-FIX): from the finger's room cell to the piece's own target point. Added to every later
 * finger point, so a hold without a move snaps to where the piece already is, and the piece keeps its place under
 * the finger as it moves.
 */
export function grabOffset(state: EditorState, p: Placement, finger: readonly [number, number]): [number, number] {
  const [x, y] = targetPoint(isoGrid(state.tier), state.draft.layout, p.item, targetOf(p), p.facing);
  return [x - finger[0], y - finger[1]];
}

/** The ghost: the piece at its target (or under the finger when nothing snaps), what stands on it, and a red copy. */
export function ghostRects(state: EditorState, drag: Drag, c: { night: boolean; colour: KipColour }): { base: Rects; tint: Rects } {
  const g = isoGrid(state.tier);
  const P = projOf(g);
  const ctx: ItemContext = { weather: 'clear', night: c.night, colour: c.colour, ramp: kipRamp(KIP_COLOURS[c.colour]), screen: 'lines' };
  const layout = state.draft.layout;
  const piece: Placement = drag.target
    ? placedAt({ id: drag.id ?? '__ghost', item: drag.item, facing: drag.facing, mirror: drag.mirror }, drag.target)
    : { id: drag.id ?? '__ghost', item: drag.item, layer: 'floor', x: 0, y: 0, facing: drag.facing, mirror: drag.mirror };
  const byId = new Map(layout.pieces.map((p) => [p.id, p]));
  byId.set(piece.id, piece);
  const base: Rects = [];
  const put = (p: Placement, at: [number, number] | null) => {
    const l = at ? pieceLayers(p.item, ctx, { layer: p.layer, facing: p.facing, mirror: p.mirror }) : null;
    if (at && l) base.push(...moveRects(l.base ?? [], at[0], at[1]));
  };
  // Nothing snapped: the piece hangs at the finger as a floor piece would stand there.
  put(piece, drag.target ? anchorOf(P, piece, byId) : [Math.round(drag.cell[0]), Math.round(drag.cell[1]) - 6]);
  // The parent carries its children (spec §3.3).
  if (drag.id && drag.target) for (const child of childrenOf(layout, drag.id)) put(child, anchorOf(P, child, byId));
  const tint = drag.refused ? base.filter((q) => !q[4].startsWith('rgba')).map(([x, y, w, h]) => [x, y, w, h, RED] as Rects[number]) : [];
  return { base, tint };
}

/** The pan, clamped so the room's edges never show; a room narrower than the view stays centred (spec §5.6). */
export function clampPan(pan: { x: number; y: number }, view: { width: number; height: number }, g: IsoGrid, cellPt = 2): { x: number; y: number } {
  const axis = (v: number, size: number, cells: number) => {
    const room = cells * cellPt;
    if (room <= size) return Math.round((size - room) / 2);
    return Math.round(Math.min(0, Math.max(size - room, v)));
  };
  return { x: axis(pan.x, view.width, g.W), y: axis(pan.y, view.height, g.H) };
}
