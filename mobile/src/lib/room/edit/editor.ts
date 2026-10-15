// The free-build editor's draft (spec 2026-10-15 §5), pure. The draft holds only owned copies: every action checks
// the inventory (counts − placed) and the cap first (ledger: Spec B Task 13 / 14), so Done can only save what you
// own. A refused action changes nothing and leaves an `outcome` for the screen to say and shake. Every drag, toolbar
// action, style change and set apply is one undo step; 20 are kept. Previews (a locked worn piece, a locked set)
// never enter the draft (Spec B ruling P18).
import { catalogueItem, catalogueSet, GEOMETRY_DEPS, isoOf, type CatalogueSet } from '../catalogue';
import type { KipWorn, ItemId } from '../loadout';
import type { WornSlot } from '../catalogue';
import { capFor, validateLayout, type Placement, type RoomLayout, type StyleKey, type Tier } from '../iso/geometry';
import { isoGrid } from '../iso/grid';
import { childrenOf, deskOf, inventoryOf, layoutKey, newPieceId } from '../layout';
import { COACH_ITEM, coachTile, nearestFree, placedAt, refusal, roomCentre, targetPoint, type Refused, type Target } from './targets';

export interface Draft { layout: RoomLayout; worn: KipWorn }
export type DrawerTab = 'all' | 'floor' | 'wall' | 'onTop' | 'funny' | 'new' | 'room' | 'kip' | 'sets';
/** The editor route's params (spec §5.1): the drawer tab to open on, a piece to show there, the first-week coach. */
export type DecorateParams = { drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean };
export type NudgeDir = 'backLeft' | 'backRight' | 'frontLeft' | 'frontRight' | 'up' | 'down';
export type Preview = { kind: 'worn'; slot: WornSlot; item: ItemId } | { kind: 'set'; setId: string };
/** What Apply set did (ruling T9-FIX): the set's items you don't own yet, and whether your own desk stayed. */
export interface SetApplied { setId: string; missing: ItemId[]; deskKept: boolean }
export type Outcome =
  | { ok: true; id: string }
  | { ok: true; id: null; applied: SetApplied }
  /** `item`: a refused new piece's item (ruling T12-CARRY), so the reason names what was dragged in or placed. */
  | { ok: false; refused: Refused; id: string | null; item?: ItemId };
export interface CoachState { step: 1 | 2 | 3; tile: [number, number] }

export interface EditorState {
  saved: Draft;
  draft: Draft;
  past: Draft[];
  future: Draft[];
  tier: Tier;
  counts: Readonly<Record<ItemId, number>>;
  /** The server version `saved` came from: Done sends it (Spec B final review fix #1). */
  baseVersion: number;
  selected: string | null;
  picked: ItemId | null;
  drawer: DrawerTab;
  nudging: boolean;
  preview: Preview | null;
  outcome: Outcome | null;
  /** The unseen ids when the editor opened (plan ruling 15). */
  newIds: readonly ItemId[];
  notice: 'refreshed' | 'saveFailed' | null;
  coach: CoachState | null;
}

export interface EditorInput {
  layout: RoomLayout;
  worn: KipWorn;
  tier: Tier;
  counts: Readonly<Record<ItemId, number>>;
  version: number;
  newIds: readonly ItemId[];
}

export type EditorAction =
  | { type: 'select'; id: string | null }
  | { type: 'pick'; item: ItemId | null }
  | { type: 'drawer'; tab: DrawerTab }
  | { type: 'place'; item: ItemId }
  | { type: 'drop'; id: string | null; item: ItemId; target: Target }
  /** A drag let go where nothing snapped (ruling T12-FIX): nothing moves, the reason is said. */
  | { type: 'refused'; id: string | null; item: ItemId; refused: Refused }
  | { type: 'flip' }
  | { type: 'turn' }
  | { type: 'another' }
  | { type: 'store' }
  | { type: 'nudging'; on: boolean }
  | { type: 'nudge'; dir: NudgeDir }
  | { type: 'putOn'; parent: string; spot: number }
  | { type: 'replaceDesk'; item: ItemId }
  | { type: 'style'; key: StyleKey; item: ItemId }
  | { type: 'wear'; slot: WornSlot; item: ItemId | null }
  | { type: 'previewWorn'; slot: WornSlot; item: ItemId }
  | { type: 'applySet'; setId: string }
  | { type: 'previewSet'; setId: string | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'coach'; step: CoachState['step'] | null }
  | { type: 'clearOutcome' }
  | { type: 'refreshed'; draft: Draft; version: number; counts: Readonly<Record<ItemId, number>>; tier: Tier }
  | { type: 'saving' }
  | { type: 'saveFailed' }
  | { type: 'saved'; draft: Draft; version: number };

export const UNDO_STEPS = 20;

export function initEditor(c: EditorInput, open: DecorateParams = {}): EditorState {
  const draft = { layout: c.layout, worn: c.worn };
  const drawer: DrawerTab = open.drawer === 'new' ? (c.newIds.length ? 'new' : 'all') : open.drawer ?? 'all';
  return {
    saved: draft, draft, past: [], future: [], tier: c.tier, counts: c.counts, baseVersion: c.version,
    selected: null, picked: open.item ?? null, drawer, nudging: false, preview: null, outcome: null, newIds: c.newIds,
    notice: null, coach: open.coach ? { step: 1, tile: coachTile(isoGrid(c.tier), c.layout, c.tier) } : null,
  };
}

const wornEquals = (a: KipWorn, b: KipWorn) => (Object.keys(a) as WornSlot[]).every((k) => a[k] === b[k]);
const sameDraft = (a: Draft, b: Draft) => layoutKey(a.layout) === layoutKey(b.layout) && wornEquals(a.worn, b.worn);

export function isChanged(s: EditorState): boolean {
  return !sameDraft(s.draft, s.saved);
}

export function inventory(s: Pick<EditorState, 'counts' | 'draft'>): Record<ItemId, number> {
  return inventoryOf(s.counts, s.draft.layout);
}

export function canPlace(s: EditorState, item: ItemId): boolean {
  if (!((inventory(s)[item] ?? 0) > 0) || !isoOf(item)) return false;
  return !!isoOf(item)!.kipDesk || s.draft.layout.pieces.length < capFor(s.tier);
}

function commit(s: EditorState, draft: Draft, extra: Partial<EditorState> = {}): EditorState {
  if (sameDraft(draft, s.draft)) return { ...s, ...extra };
  return { ...s, ...extra, past: [...s.past, s.draft].slice(-UNDO_STEPS), future: [], draft, preview: null, notice: null };
}

const withPieces = (s: EditorState, pieces: Placement[]): Draft => ({ ...s.draft, layout: { ...s.draft.layout, pieces } });
const refuse = (s: EditorState, refused: Refused, id: string | null, item?: ItemId): EditorState =>
  ({ ...s, outcome: item ? { ok: false, refused, id, item } : { ok: false, refused, id } });
/** Coach step 1 ends when the lantern lands (spec §11.1). */
const coachAfterPlace = (s: EditorState, item: ItemId): CoachState | null =>
  s.coach && s.coach.step === 1 && item === COACH_ITEM ? { ...s.coach, step: 2 } : s.coach;

function add(s: EditorState, item: ItemId, target: Target | null, facing: 'L' | 'R' = 'L'): EditorState {
  // One desk per room (ruling T9-FIX): a desk from the drawer, placed or dropped, swaps the desk.
  if (isoOf(item)?.kipDesk) return editorReducer(s, { type: 'replaceDesk', item });
  if (!((inventory(s)[item] ?? 0) > 0)) return refuse(s, { reason: 'outside' }, null, item);
  if (!target) return refuse(s, { reason: 'outside' }, null, item);
  const piece = placedAt({ id: newPieceId(s.draft.layout), item, facing, mirror: false }, target);
  const why = refusal(s.draft.layout, piece, s.tier, true);
  if (why) return refuse(s, why, null, item);
  return commit(s, withPieces(s, [...s.draft.layout.pieces, piece]), { selected: piece.id, outcome: { ok: true, id: piece.id }, coach: coachAfterPlace(s, item), picked: null });
}

function move(s: EditorState, id: string, next: Placement): EditorState {
  const why = refusal(s.draft.layout, next, s.tier, false);
  if (why) return refuse(s, why, id);
  return commit(s, withPieces(s, s.draft.layout.pieces.map((p) => (p.id === id ? next : p))), { selected: id, outcome: { ok: true, id } });
}

const NUDGE: Record<NudgeDir, { floor?: [number, number]; wallR?: [number, number]; wallL?: [number, number] }> = {
  backLeft: { floor: [-1, 0], wallR: [-1, 0] },
  backRight: { floor: [0, -1], wallL: [-1, 0] },
  frontLeft: { floor: [0, 1], wallL: [1, 0] },
  frontRight: { floor: [1, 0], wallR: [1, 0] },
  up: { wallL: [0, 1], wallR: [0, 1] },
  down: { wallL: [0, -1], wallR: [0, -1] },
};

export interface Tools {
  piece: Placement;
  children: number;
  inventory: number;
  canTurn: boolean;
  canAnother: boolean;
  canStore: boolean;
  isDesk: boolean;
}

export function selectedTools(s: EditorState): Tools | null {
  const piece = s.draft.layout.pieces.find((p) => p.id === s.selected);
  const iso = piece ? isoOf(piece.item) : undefined;
  if (!piece || !iso) return null;
  const isDesk = !!iso.kipDesk;
  const turned: Placement = { ...piece, facing: piece.facing === 'L' ? 'R' : 'L' };
  const left = inventory(s)[piece.item] ?? 0;
  return {
    piece,
    children: childrenOf(s.draft.layout, piece.id).length,
    inventory: left,
    canTurn: iso.facings === 2 && !refusal(s.draft.layout, turned, s.tier, false),
    canAnother: !isDesk && left > 0 && s.draft.layout.pieces.length < capFor(s.tier),
    canStore: !isDesk,
    isDesk,
  };
}

/**
 * The set's pieces you own copies of (spec §5.4), with anything left on a piece that isn't placed dropped. When the
 * set's desk isn't owned your own desk stays (ruling T9-FIX): it takes the set desk's corner and facing, or the
 * nearest free place to it; the set's on-desk pieces stand on its spots while they fit. Null when no desk fits.
 */
function setPieces(s: EditorState, set: CatalogueSet): { pieces: Placement[]; missing: ItemId[]; deskKept: boolean } | null {
  const left: Record<ItemId, number> = { ...s.counts };
  const missing: ItemId[] = [];
  const owned = set.layout.pieces.filter((p) => {
    if ((left[p.item] ?? 0) > 0) { left[p.item]!--; return true; }
    missing.push(p.item);
    return false;
  });
  const onSpots = (base: Placement[]): Placement[] => {
    const byId = new Map(base.map((p) => [p.id, p]));
    const fits = (p: Placement) => (p.spot ?? 0) < (isoOf(byId.get(p.parent ?? '')?.item)?.surface?.spots.length ?? 0);
    const order = new Map(set.layout.pieces.map((p, k) => [p.id, k]));
    const rank = (p: Placement) => order.get(p.id) ?? order.size;
    return [...base, ...owned.filter((p) => p.layer === 'onTop' && fits(p))].sort((x, y) => rank(x) - rank(y)); // the set's order
  };
  const base = owned.filter((p) => p.layer !== 'onTop');
  const valid = (pieces: Placement[]) => (validateLayout({ ...s.draft.layout, pieces }, s.tier, GEOMETRY_DEPS) ? null : pieces);
  if (base.some((p) => isoOf(p.item)?.kipDesk)) {
    const pieces = valid(onSpots(base));
    return pieces && { pieces, missing, deskKept: false };
  }
  const desk = deskOf(s.draft.layout);
  const setDesk = set.layout.pieces.find((p) => isoOf(p.item)?.kipDesk);
  if (!desk) return null;
  const mine: Placement = { ...(setDesk ?? desk), item: desk.item, layer: 'floor' };
  const room = { ...s.draft.layout, pieces: base };
  let at: Placement | null = refusal(room, mine, s.tier, false) ? null : mine;
  if (!at) {
    const g = isoGrid(s.tier);
    const near = targetPoint(g, room, mine.item, { layer: 'floor', x: mine.x, y: mine.y }, mine.facing);
    const t = nearestFree(g, room, mine.item, s.tier, near, mine);
    at = t && placedAt(mine, t);
  }
  const pieces = at && valid(onSpots([...base, at]));
  return pieces && { pieces, missing, deskKept: true };
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  const g = isoGrid(s.tier);
  const layout = s.draft.layout;
  const selected = layout.pieces.find((p) => p.id === s.selected);
  switch (a.type) {
    case 'select':
      return { ...s, selected: a.id, nudging: false, outcome: null };
    case 'pick':
      return { ...s, picked: a.item };
    case 'drawer':
      return { ...s, drawer: a.tab, preview: null };
    case 'place': {
      const base = { id: newPieceId(layout), item: a.item, facing: 'L' as const, mirror: false };
      return add(s, a.item, nearestFree(g, layout, a.item, s.tier, roomCentre(g), base));
    }
    case 'drop': {
      if (a.id === null) return add(s, a.item, a.target);
      const piece = layout.pieces.find((p) => p.id === a.id);
      return piece ? move(s, piece.id, placedAt(piece, a.target)) : s;
    }
    case 'refused':
      return refuse(s, a.refused, a.id, a.item);
    case 'flip':
      return selected ? move(s, selected.id, { ...selected, mirror: !selected.mirror }) : s;
    case 'turn': {
      if (!selected) return s;
      if (isoOf(selected.item)?.facings !== 2) return refuse(s, { reason: 'layer' }, selected.id);
      const next = move(s, selected.id, { ...selected, facing: selected.facing === 'L' ? 'R' : 'L' });
      const coach = next.outcome?.ok && s.coach?.step === 2 && selected.item === COACH_ITEM ? { ...s.coach, step: 3 as const } : next.coach;
      return { ...next, coach };
    }
    case 'another': {
      const tools = selectedTools(s);
      if (!selected || !tools?.canAnother) return selected ? refuse(s, { reason: tools && tools.inventory > 0 ? 'full' : 'outside' }, selected.id) : s;
      const near = targetPoint(g, layout, selected.item, selected.layer === 'onTop' ? { layer: 'onTop', parent: selected.parent!, spot: selected.spot! } : { layer: selected.layer, x: selected.x, y: selected.y }, selected.facing);
      const base = { id: newPieceId(layout), item: selected.item, facing: selected.facing, mirror: selected.mirror };
      return add(s, selected.item, nearestFree(g, layout, selected.item, s.tier, near, base), selected.facing);
    }
    case 'store': {
      if (!selected || isoOf(selected.item)?.kipDesk) return s;
      const gone = new Set([selected.id, ...childrenOf(layout, selected.id).map((c) => c.id)]);
      return commit(s, withPieces(s, layout.pieces.filter((p) => !gone.has(p.id))), { selected: null, nudging: false, outcome: null });
    }
    case 'nudging':
      return { ...s, nudging: a.on };
    case 'nudge': {
      if (!selected || selected.layer === 'onTop') return selected ? refuse(s, { reason: 'layer' }, selected.id) : s;
      const step = NUDGE[a.dir][selected.layer];
      if (!step) return refuse(s, { reason: 'layer' }, selected.id);
      return move(s, selected.id, { ...selected, x: selected.x + step[0], y: selected.y + step[1] });
    }
    case 'putOn':
      return selected ? move(s, selected.id, placedAt(selected, { layer: 'onTop', parent: a.parent, spot: a.spot })) : s;
    case 'replaceDesk': {
      const desk = deskOf(layout);
      const iso = isoOf(a.item);
      if (!desk || !iso?.kipDesk) return s;
      // Nothing changes either way, but the screen says why (ruling UI-OUTCOMES).
      if (desk.item === a.item) return refuse(s, { reason: 'sameDesk' }, null, a.item);
      if (!((inventory(s)[a.item] ?? 0) > 0)) return refuse(s, { reason: 'none' }, null, a.item);
      const next: Placement = { ...desk, item: a.item };
      const spots = iso.surface?.spots.length ?? 0;
      const kept = layout.pieces.filter((p) => !(p.parent === desk.id && (p.spot ?? 0) >= spots)).map((p) => (p.id === desk.id ? next : p));
      const why = refusal({ ...layout, pieces: kept }, next, s.tier, false);
      if (why) return refuse(s, why, desk.id);
      return commit(s, withPieces(s, kept), { selected: desk.id, outcome: { ok: true, id: desk.id } });
    }
    case 'style': {
      if (catalogueItem(a.item)?.slot !== a.key || !((s.counts[a.item] ?? 0) > 0)) return s;
      return commit(s, { ...s.draft, layout: { ...layout, styles: { ...layout.styles, [a.key]: a.item } } });
    }
    case 'wear': {
      if (a.item !== null && (catalogueItem(a.item)?.slot !== a.slot || !((s.counts[a.item] ?? 0) > 0))) return s;
      return commit(s, { ...s.draft, worn: { ...s.draft.worn, [a.slot]: a.item } });
    }
    case 'previewWorn':
      return { ...s, preview: { kind: 'worn', slot: a.slot, item: a.item } };
    case 'applySet': {
      const set = catalogueSet(a.setId);
      if (!set) return s;
      const placed = setPieces(s, set);
      if (!placed) return refuse(s, { reason: 'outside' }, null);
      const owned = (id: ItemId) => (s.counts[id] ?? 0) > 0;
      const styles = Object.fromEntries(Object.entries(set.layout.styles).map(([k, id]) => [k, owned(id) ? id : layout.styles[k as StyleKey]])) as RoomLayout['styles'];
      const worn = { ...s.draft.worn };
      for (const [slot, id] of Object.entries(set.worn)) if (id && owned(id)) worn[slot as WornSlot] = id;
      const missing = [...new Set([...placed.missing, ...Object.values(set.layout.styles).filter((id) => !owned(id)), ...Object.values(set.worn).filter((id): id is ItemId => !!id && !owned(id))])];
      const applied: SetApplied = { setId: set.id, missing, deskKept: placed.deskKept };
      return commit(s, { layout: { v: 1, styles, pieces: placed.pieces }, worn }, { selected: null, outcome: { ok: true, id: null, applied } });
    }
    case 'previewSet':
      return { ...s, preview: a.setId ? { kind: 'set', setId: a.setId } : null };
    case 'undo': {
      const last = s.past[s.past.length - 1];
      return last ? { ...s, draft: last, past: s.past.slice(0, -1), future: [s.draft, ...s.future], selected: null, outcome: null, preview: null } : s;
    }
    case 'redo': {
      const next = s.future[0];
      return next ? { ...s, draft: next, past: [...s.past, s.draft].slice(-UNDO_STEPS), future: s.future.slice(1), selected: null, outcome: null } : s;
    }
    case 'coach':
      return { ...s, coach: a.step === null || !s.coach ? null : { ...s.coach, step: a.step } };
    case 'clearOutcome':
      return { ...s, outcome: null };
    case 'refreshed':
      return { ...s, saved: a.draft, draft: a.draft, past: [], future: [], counts: a.counts, tier: a.tier, baseVersion: a.version, notice: 'refreshed', selected: null, preview: null, outcome: null };
    case 'saving':
      // A save clears the last notice (ruling T12-CARRY): the same failure again is a new line, which Android's live
      // region announces again.
      return { ...s, notice: null };
    case 'saveFailed':
      return { ...s, notice: 'saveFailed' };
    case 'saved':
      return { ...s, saved: a.draft, draft: a.draft, past: [], future: [], baseVersion: a.version, notice: null };
  }
}

/** What the room and KIP show: the draft with any locked preview on top. */
export function displayDraft(s: EditorState): Draft {
  const p = s.preview;
  if (!p) return s.draft;
  if (p.kind === 'worn') return { ...s.draft, worn: { ...s.draft.worn, [p.slot]: p.item } };
  const set = catalogueSet(p.setId);
  return set ? { layout: set.layout, worn: { ...s.draft.worn, ...set.worn } } : s.draft;
}

