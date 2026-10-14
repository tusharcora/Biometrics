// The tray's content (spec 2026-10-14 KIP's room §6.2, §6.3), pure: which pieces a slot offers, each tile's tag and
// spoken label, the info line, the set cards. A piece is offered only when this build can draw it (§1).
import { wornArt } from '../kip/wornArt';
import { CATALOGUE, catalogueItem, catalogueItemsFor, catalogueSet, isWornSlot, type CatalogueItem } from './catalogue';
import { slotValue, type DecorateSlot, type DecorateState } from './decorate';
import { itemArt } from './items';
import type { ItemId } from './loadout';
import { ROOM_COPY, SET_NAMES, itemName, progressLine, spokenName, unlockLine, unlockSpoken, type ProgressFacts } from './roomCopy';
import { spokenLine } from '../kipStage';
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

const OPTIONAL = new Set<DecorateSlot>(['art', 'corner', 'pet', 'head', 'face', 'neck', 'ears']);

export function offeredItems(slot: DecorateSlot, owned: ReadonlySet<string>): CatalogueItem[] {
  const drawable = (i: CatalogueItem) => (isWornSlot(slot) ? !!wornArt(i.id) : !!itemArt(i.id));
  const rank = (i: CatalogueItem) => (i.unlock.kind === 'starter' ? 0 : owned.has(i.id) ? 1 : 2);
  return catalogueItemsFor(slot)
    .filter((i) => drawable(i) && (!i.retired || owned.has(i.id)))
    .map((i, n) => ({ i, n }))
    .sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n)
    .map(({ i }) => i);
}

export function tilesFor(state: DecorateState, slot: DecorateSlot, ctx: TrayContext): TileModel[] {
  const current = slotValue(state.draft, slot);
  const picked = (id: ItemId | null) => state.picked?.slot === slot && state.picked.itemId === id;
  const tiles: TileModel[] = [];
  if (OPTIONAL.has(slot)) {
    const name = slot === 'art' ? ROOM_COPY.noArt : ROOM_COPY.none;
    const placed = current === null;
    tiles.push({
      key: `${slot}-none`, itemId: null, name, state: placed ? 'placed' : 'owned', tag: placed ? ROOM_COPY.tags.placed : ROOM_COPY.tags.owned,
      label: placed ? ROOM_COPY.tile.placed(name) : ROOM_COPY.tile.owned(name), flags: [], selected: picked(null),
    });
  }
  for (const item of offeredItems(slot, ctx.owned)) {
    const placed = current === item.id;
    const owned = ctx.owned.has(item.id) || item.unlock.kind === 'starter';
    const spoken = spokenName(item.id);
    tiles.push({
      key: item.id,
      itemId: item.id,
      name: itemName(item.id),
      state: placed ? 'placed' : owned ? 'owned' : 'locked',
      tag: placed ? ROOM_COPY.tags.placed : owned ? ROOM_COPY.tags.owned : unlockLine(item.unlock),
      label: placed ? ROOM_COPY.tile.placed(spoken) : owned ? ROOM_COPY.tile.owned(spoken) : ROOM_COPY.tile.locked(spoken, unlockSpoken(item.unlock), progressLine(item.unlock, ctx.facts)),
      flags: [item.tint && ROOM_COPY.flags.tint, item.emissive && ROOM_COPY.flags.glow, item.frames && ROOM_COPY.flags.anim].filter((f) => !!f) as string[],
      selected: picked(item.id),
    });
  }
  return tiles;
}

export interface InfoLine {
  label: string;
  text: string;
  muted: boolean;
  spoken: string;
}

const line = (label: string, text: string, muted = false): InfoLine => ({ label, text, muted, spoken: spokenLine(`${label} · ${text}`) });

export function infoLine(state: DecorateState, ctx: TrayContext): InfoLine {
  const I = ROOM_COPY.info;
  const p = state.preview;
  if (p?.kind === 'set') return line(I.locked, I.lockedText(SET_NAMES[p.setId] ?? p.setId, unlockLine(catalogueSet(p.setId)!.unlock)), true);
  if (p?.kind === 'item') return line(I.locked, I.lockedText(itemName(p.itemId), unlockLine(catalogueItem(p.itemId)!.unlock)), true);
  if (state.tab === 'sets') return line(I.sets, I.setsText);
  const slot: DecorateSlot = state.tab === 'kip' ? state.wornSlot : state.roomSlot;
  const current = slotValue(state.draft, slot);
  if (state.tab === 'kip') return current ? line(I.wearing, itemName(current)) : line(I.dress, I.dressText, true);
  if (state.picked?.slot === slot && state.picked.itemId !== null && current === state.picked.itemId && slotValue(state.saved, slot) !== current) {
    return line(I.previewing, I.previewText(itemName(current), slot));
  }
  return current ? line(I.inRoom, I.placedText(itemName(current))) : line(I.inRoom, I.emptyText(slot));
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
