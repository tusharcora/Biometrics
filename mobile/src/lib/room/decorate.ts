// Decorate mode's draft (spec 2026-10-14 KIP's room §6.4), pure. The draft holds only owned pieces; a locked item or
// a locked set is a display-only preview (ruling 18), so Done can only ever save what you own. Undo steps back one
// change of the draft; Apply set is one change.
import { catalogueSet, isWornSlot } from './catalogue';
import type { ItemId, KipWorn, RoomLoadout } from './loadout';
import { ROOM_SLOTS, WORN_SLOTS, type RoomSlot, type WornSlot } from './slots';

export interface Look {
  room: RoomLoadout;
  worn: KipWorn;
}
export type DecorateTab = 'room' | 'kip' | 'sets';
export type DecorateSlot = RoomSlot | WornSlot;
export type Preview = { kind: 'item'; slot: DecorateSlot; itemId: ItemId } | { kind: 'set'; setId: string };

export interface DecorateState {
  saved: Look;
  draft: Look;
  history: Look[];
  preview: Preview | null;
  tab: DecorateTab;
  roomSlot: RoomSlot;
  wornSlot: WornSlot;
  /** The tile tapped last (null itemId: the None tile). */
  picked: { slot: DecorateSlot; itemId: ItemId | null } | null;
  notice: 'refreshed' | 'saveFailed' | null;
}

export type DecorateAction =
  | { type: 'tab'; tab: DecorateTab }
  | { type: 'slot'; slot: DecorateSlot }
  | { type: 'place'; slot: DecorateSlot; itemId: ItemId | null }
  | { type: 'preview'; slot: DecorateSlot; itemId: ItemId }
  | { type: 'applySet'; setId: string }
  | { type: 'previewSet'; setId: string }
  | { type: 'undo' }
  | { type: 'refreshed'; look: Look }
  | { type: 'saveFailed' }
  | { type: 'saved'; look: Look };

export function slotValue(look: Look, slot: DecorateSlot): ItemId | null {
  return isWornSlot(slot) ? look.worn[slot] : look.room[slot];
}

function withSlot(look: Look, slot: DecorateSlot, id: ItemId | null): Look {
  return isWornSlot(slot) ? { ...look, worn: { ...look.worn, [slot]: id } } : { ...look, room: { ...look.room, [slot]: id } };
}

export function lookEquals(a: Look, b: Look): boolean {
  return ROOM_SLOTS.every((s) => a.room[s] === b.room[s]) && WORN_SLOTS.every((s) => a.worn[s] === b.worn[s]);
}

export function initDecorate(saved: Look, open: { tab?: DecorateTab; slot?: DecorateSlot } = {}): DecorateState {
  const { slot } = open;
  const worn = slot !== undefined && isWornSlot(slot);
  return {
    saved, draft: saved, history: [], preview: null,
    tab: open.tab ?? (worn ? 'kip' : 'room'),
    roomSlot: slot !== undefined && !worn ? (slot as RoomSlot) : 'wallpaper',
    wornSlot: worn ? (slot as WornSlot) : 'head',
    picked: null, notice: null,
  };
}

/** A tile tapped in a slot also makes it the slot the info line talks about. */
const focusOn = (slot: DecorateSlot): Partial<DecorateState> => (isWornSlot(slot) ? { wornSlot: slot } : { roomSlot: slot });

function commit(s: DecorateState, next: Look): DecorateState {
  if (lookEquals(next, s.draft)) return { ...s, preview: null };
  return { ...s, history: [...s.history, s.draft], draft: next, preview: null, notice: null };
}

export function decorateReducer(s: DecorateState, a: DecorateAction): DecorateState {
  switch (a.type) {
    case 'tab':
      return { ...s, tab: a.tab, preview: null };
    case 'slot':
      return isWornSlot(a.slot) ? { ...s, tab: 'kip', wornSlot: a.slot, preview: null } : { ...s, tab: 'room', roomSlot: a.slot, preview: null };
    case 'place':
      return { ...commit(s, withSlot(s.draft, a.slot, a.itemId)), ...focusOn(a.slot), picked: { slot: a.slot, itemId: a.itemId } };
    case 'preview':
      return { ...s, ...focusOn(a.slot), preview: { kind: 'item', slot: a.slot, itemId: a.itemId }, picked: { slot: a.slot, itemId: a.itemId }, notice: null };
    case 'applySet': {
      const set = catalogueSet(a.setId);
      return set ? commit(s, { room: { ...set.room }, worn: { ...s.draft.worn, ...set.worn } }) : s;
    }
    case 'previewSet':
      return { ...s, preview: { kind: 'set', setId: a.setId }, notice: null };
    case 'undo': {
      const last = s.history[s.history.length - 1];
      return last ? { ...s, draft: last, history: s.history.slice(0, -1), preview: null, picked: null } : { ...s, preview: null };
    }
    case 'refreshed':
      return { ...s, saved: a.look, draft: a.look, history: [], preview: null, picked: null, notice: 'refreshed' };
    case 'saveFailed':
      return { ...s, notice: 'saveFailed' };
    case 'saved':
      return { ...s, saved: a.look, draft: a.look, history: [], preview: null, notice: null };
  }
}

export function isChanged(s: DecorateState): boolean {
  return !lookEquals(s.draft, s.saved);
}

/** What the room and KIP show: the draft with any locked preview on top. */
export function displayLook(s: DecorateState): Look {
  const p = s.preview;
  if (!p) return s.draft;
  if (p.kind === 'item') return withSlot(s.draft, p.slot, p.itemId);
  const set = catalogueSet(p.setId);
  return set ? { room: { ...set.room }, worn: { ...s.draft.worn, ...set.worn } } : s.draft;
}
