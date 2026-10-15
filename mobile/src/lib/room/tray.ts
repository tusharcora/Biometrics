// The decorate tray's models (spec 2026-10-14 KIP's room §6.3), pure: a tile and the set cards. Task 13's drawer
// replaces this file; the slot tray's offers and info line went with the slot engine (spec 2026-10-15 §3).
import { CATALOGUE, catalogueItem } from './catalogue';
import type { ItemId } from './loadout';
import { ROOM_COPY, SET_NAMES, unlockLine, unlockSpoken, type ProgressFacts } from './roomCopy';
import { SET_SWATCHES } from './art';

export interface TrayContext {
  owned: ReadonlySet<string>;
  facts: ProgressFacts;
}

export interface TileModel {
  key: string;
  itemId: ItemId | null;
  name: string;
  state: 'placed' | 'owned' | 'locked';
  tag: string;
  label: string;
  flags: string[];
  selected: boolean;
}

export interface SetCardModel {
  id: string;
  name: string;
  swatches: readonly string[];
  pieces: number;
  line: string;
  spoken: string;
  owned: boolean;
}

export function setCards(ctx: TrayContext): SetCardModel[] {
  return CATALOGUE.sets.map((set) => {
    const ids = [...Object.values(set.room), ...Object.values(set.worn)] as ItemId[];
    const owned = ids.every((id) => ctx.owned.has(id) || catalogueItem(id)?.unlock.kind === 'starter');
    return {
      id: set.id, name: SET_NAMES[set.id] ?? set.id, swatches: SET_SWATCHES[set.id] ?? [], pieces: ids.length,
      line: ROOM_COPY.set.pieces(ids.length, unlockLine(set.unlock)), spoken: ROOM_COPY.set.piecesSpoken(ids.length, unlockSpoken(set.unlock)), owned,
    };
  });
}
