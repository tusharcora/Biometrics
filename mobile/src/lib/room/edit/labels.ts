// How the editor talks about a piece (spec 2026-10-15 §5.2, §5.3, §5.7): where it is, its spoken label in the pieces
// list, the toolbar line, the reason a place is refused (plan ruling 12) and what the last action did (ruling
// UI-OUTCOMES). Spoken forms never carry "·".
import { isoOf } from '../catalogue';
import type { Placement, RoomLayout } from '../iso/geometry';
import { ROOM_COPY, SET_NAMES, itemName, spokenName } from '../roomCopy';
import type { EditorState, Tools } from './editor';
import type { Refused } from './targets';

const E = ROOM_COPY.edit;

/** A name inside a sentence: lower-case first letter, unless it starts with KIP or a quote. */
export function lowerName(name: string): string {
  return /^(KIP|“|")/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** What a piece is called in a sentence: KIP's desk is "desk", whatever stands on it. */
export function pieceNoun(item: string): string {
  return isoOf(item)?.kipDesk ? E.deskNoun : lowerName(spokenName(item));
}

export function whereText(layout: RoomLayout, p: Placement): string {
  if (p.layer === 'floor') return E.where.floor;
  if (p.layer === 'wallL' || p.layer === 'wallR') return E.where.wall;
  const parent = layout.pieces.find((q) => q.id === p.parent);
  return parent ? E.where.on(pieceNoun(parent.item)) : E.where.floor;
}

/** The pieces list's label: "Fern, on the floor, tile 1, 1" (spec §5.7). */
export function pieceLabel(layout: RoomLayout, p: Placement): string {
  const base = `${spokenName(p.item)}, ${whereText(layout, p)}`;
  return p.layer === 'floor' ? `${base}, ${E.tile(p.x, p.y)}` : base;
}

/** The short reason a place is refused (plan ruling 12). An overlap names the other piece when `layout` has it. */
export function reasonText(r: Refused, item: string, layout?: RoomLayout): string {
  switch (r.reason) {
    case 'outside': return E.reason.outside;
    case 'overlap':
    case 'wall': {
      const other = layout?.pieces.find((q) => q.id === r.with);
      return other ? E.reason.overlap(pieceNoun(other.item)) : E.reason.outside;
    }
    case 'window': return E.reason.window;
    case 'spot': return E.reason.spot;
    case 'parent':
    case 'nested': return E.reason.parent;
    case 'seat': return E.reason.seat;
    case 'full': return E.reason.full;
    case 'layer': {
      const layers = isoOf(item)?.layers ?? [];
      if (layers.includes('floor') && layers.includes('onTop')) return E.reason.layer.floorOnTop;
      if (layers.includes('wall')) return E.reason.layer.wall;
      if (layers.includes('onTop')) return E.reason.layer.onTop;
      return E.reason.layer.floor;
    }
  }
}

/** The toolbar's line for the selected piece: "Desk lamp · on the desk", "×2 in inventory" (spec §5.2). */
export function toolLine(layout: RoomLayout, t: Tools): { text: string; inventory: string; spoken: string } {
  const name = itemName(t.piece.item);
  const where = whereText(layout, t.piece);
  const on = t.children ? ` · ${E.onIt(t.children)}` : '';
  return {
    text: `${name} · ${where}${on}`,
    inventory: E.inventory(t.inventory),
    spoken: `${spokenName(t.piece.item)}, ${where}${t.children ? `, ${E.onIt(t.children)}` : ''}. ${E.inventorySpoken(t.inventory)}`,
  };
}

/**
 * What the last action has to say (ruling UI-OUTCOMES): a refusal's reason, or what Apply set left out. A plain
 * success says nothing here (the room shows it). A refused new piece is named by the item it carries (ruling
 * T12-CARRY), else by the item picked in the drawer.
 */
export function outcomeText(s: EditorState): { kind: 'reason' | 'info'; text: string } | null {
  const o = s.outcome;
  if (!o) return null;
  if (!o.ok) {
    const item = (o.id ? s.draft.layout.pieces.find((p) => p.id === o.id)?.item : o.item ?? s.picked) ?? '';
    return { kind: 'reason', text: reasonText(o.refused, item, s.draft.layout) };
  }
  if (o.id === null) {
    const a = o.applied;
    return { kind: 'info', text: ROOM_COPY.set.applied(SET_NAMES[a.setId] ?? a.setId, a.missing.map(spokenName), a.deskKept) };
  }
  return null;
}
