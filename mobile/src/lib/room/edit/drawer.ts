// The inventory drawer's content (spec 2026-10-15 §5.4), pure: which owned pieces each tab lists and their counts,
// the Room tab's style rows, the KIP tab's worn tiles (Spec B §6.2, locked ones included as previews), the set cards.
// Locked placeable pieces are not here: they live in the shop and the unlock list (P2).
import { wornArt } from '../../kip/wornArt';
import { CATALOGUE, catalogueItem, catalogueItemsFor, isoOf, type WornSlot } from '../catalogue';
import { isoArtOf } from '../iso/art';
import { STYLE_KEYS, type StyleKey } from '../iso/geometry';
import type { ItemId } from '../loadout';
import { ROOM_COPY, SET_NAMES, itemName, progressLine, spokenName, unlockLine, unlockSpoken, type ProgressFacts } from '../roomCopy';
import { SET_SWATCHES } from '../art';
import { inventory, type DrawerTab, type EditorState } from './editor';

export interface DrawerTile {
  key: string;
  item: ItemId | null;
  name: string;
  count: number;
  isNew: boolean;
  allPlaced: boolean;
  locked: boolean;
  tag: string | null;
  label: string;
  selected: boolean;
}

const D = ROOM_COPY.drawer;
const owned = (s: EditorState, id: ItemId) => (s.counts[id] ?? 0) > 0;

export function drawerTabs(s: EditorState): DrawerTab[] {
  return ['all', 'floor', 'wall', 'onTop', 'funny', 'effects', ...(s.newIds.length ? (['new'] as const) : []), 'room', 'kip', 'sets'];
}

const inTab = (id: ItemId, tab: DrawerTab, newIds: readonly ItemId[]) => {
  const iso = isoOf(id)!;
  switch (tab) {
    case 'floor': return iso.layers.includes('floor');
    case 'wall': return iso.layers.includes('wall');
    case 'onTop': return iso.layers.includes('onTop');
    case 'funny': return !!catalogueItem(id)?.tags?.includes('funny');
    case 'effects': return !!iso.effect;
    case 'new': return newIds.includes(id);
    default: return true;
  }
};

/** Owned pieces this build can draw, in catalogue order, with what is left to place. */
export function pieceTiles(s: EditorState, tab: DrawerTab): DrawerTile[] {
  const left = inventory(s);
  return CATALOGUE.items
    .filter((i) => i.iso && isoArtOf(i.id) && owned(s, i.id) && inTab(i.id, tab, s.newIds))
    .map((i) => {
      const count = left[i.id] ?? 0;
      const isNew = s.newIds.includes(i.id);
      // An effect piece is tagged and read as doing something (ruling 21), in every tab it shows in.
      const fx = !!i.iso!.effect;
      return {
        key: i.id, item: i.id, name: itemName(i.id), count, isNew, allPlaced: count === 0, locked: false,
        tag: fx ? ROOM_COPY.effects.fxTag : null,
        label: fx ? D.tile.effect(D.tile.piece(spokenName(i.id), count, isNew)) : D.tile.piece(spokenName(i.id), count, isNew),
        selected: s.picked === i.id,
      };
    });
}

export function notPlaced(s: EditorState): number {
  const left = inventory(s);
  return CATALOGUE.items.filter((i) => i.iso && isoArtOf(i.id)).reduce((n, i) => n + (left[i.id] ?? 0), 0);
}

export function styleRows(s: EditorState): Array<{ key: StyleKey; tiles: DrawerTile[] }> {
  return STYLE_KEYS.map((key) => ({
    key,
    tiles: catalogueItemsFor(key).filter((i) => owned(s, i.id)).map((i) => {
      const current = s.draft.layout.styles[key] === i.id;
      return {
        key: i.id, item: i.id, name: itemName(i.id), count: 0, isNew: s.newIds.includes(i.id), allPlaced: false, locked: false,
        tag: null, label: D.tile.style(spokenName(i.id), current), selected: current,
      };
    }),
  }));
}

/** Spec B's KIP tab: None, then the slot's pieces this build can draw; locked ones preview (Spec B ruling 18). */
export function wornTiles(s: EditorState, slot: WornSlot, facts: ProgressFacts): DrawerTile[] {
  const current = s.draft.worn[slot];
  const none: DrawerTile = { key: `${slot}-none`, item: null, name: D.none, count: 0, isNew: false, allPlaced: false, locked: false, tag: null, label: D.tile.worn(D.none, current === null), selected: current === null };
  const items = catalogueItemsFor(slot).filter((i) => wornArt(i.id) && (!i.retired || owned(s, i.id)));
  return [none, ...items.map((i) => {
    const mine = owned(s, i.id);
    return {
      key: i.id, item: i.id, name: itemName(i.id), count: 0, isNew: s.newIds.includes(i.id), allPlaced: false, locked: !mine,
      tag: mine ? null : unlockLine(i.unlock),
      label: mine ? D.tile.worn(spokenName(i.id), current === i.id) : D.tile.locked(spokenName(i.id), unlockSpoken(i.unlock), progressLine(i.unlock, facts)),
      selected: current === i.id,
    };
  })];
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

export function setCards(s: EditorState, _facts: ProgressFacts): SetCardModel[] {
  return CATALOGUE.sets.map((set) => {
    const ids = [...Object.values(set.room), ...Object.values(set.worn)] as ItemId[];
    const all = ids.every((id) => owned(s, id) || catalogueItem(id)?.unlock.kind === 'starter');
    return {
      id: set.id, name: SET_NAMES[set.id] ?? set.id, swatches: SET_SWATCHES[set.id] ?? [], pieces: ids.length,
      line: ROOM_COPY.set.pieces(ids.length, unlockLine(set.unlock)), spoken: ROOM_COPY.set.piecesSpoken(ids.length, unlockSpoken(set.unlock)), owned: all,
    };
  });
}
