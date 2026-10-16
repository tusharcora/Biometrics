// The coin shop's tiles and piece sheet (spec 2026-10-15 §6.6, C1, F6), pure. Tabs All, Effects, Floor, Wall and On top
// (P3 ruling 19); the week's featured set first. A piece with an effect says so on its tile and its sheet. A rule piece
// not earned yet shows locked with its rule, never as for sale (§6.5).
// The server sends only ids and prices (ruling 34): locked, owned and where a piece goes come from the catalogue.
import type { ShopDTO } from '../../api/coins';
import { catalogueItem, type UnlockRule } from '../room/catalogue';
import type { EffectKind } from '../room/iso/geometry';
import { ROOM_COPY, coinCount, itemName, spokenName, unlockLine, unlockSpoken } from '../room/roomCopy';

export type ShopTab = 'all' | 'effects' | 'floor' | 'wall' | 'onTop';
/** Spec §6.6's order (P3 ruling 19). */
export const SHOP_TABS: readonly ShopTab[] = ['all', 'effects', 'floor', 'wall', 'onTop'];

export interface ShopTile {
  itemId: string;
  name: string;
  price: number;
  owned: number;
  locked: boolean;
  lockLine: string | null;
  label: string;
  featured: boolean;
  effect: EffectKind | null;
}

const S = ROOM_COPY.shop;
const lockedFor = (rule: UnlockRule, owned: number) => rule.kind !== 'shop' && rule.kind !== 'starter' && owned === 0;

export function shopTiles(shop: ShopDTO, counts: Readonly<Record<string, number>>, tab: ShopTab, featuredOnly = false): ShopTile[] {
  const featured = new Set(shop.set.itemIds);
  return shop.items
    .filter(({ itemId }) => {
      const iso = catalogueItem(itemId)?.iso;
      if (!iso || (featuredOnly && !featured.has(itemId))) return false;
      return tab === 'all' || (tab === 'effects' ? !!iso.effect : iso.layers.includes(tab));
    })
    .map(({ itemId, price }): ShopTile => {
      const item = catalogueItem(itemId)!;
      const owned = counts[itemId] ?? 0;
      const locked = lockedFor(item.unlock, owned);
      const effect = item.iso!.effect ?? null;
      const label = locked ? S.tileLocked(spokenName(itemId), unlockSpoken(item.unlock)) : S.tile(spokenName(itemId), coinCount(price), owned);
      return {
        itemId, name: itemName(itemId), price, owned, locked, lockLine: locked ? unlockLine(item.unlock) : null,
        label: effect ? S.tileEffect(label) : label,
        featured: featured.has(itemId), effect,
      };
    })
    // Stable: the featured set keeps the server's order, and so does the rest.
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

/** "Shelf, desk or floor · 1 tile" (C1), and its spoken form. */
export function whereLine(itemId: string): { text: string; spoken: string } {
  const iso = catalogueItem(itemId)?.iso;
  if (!iso) return { text: '', spoken: '' };
  const floor = iso.layers.includes('floor');
  const place = iso.layers.includes('wall') ? S.where.wall : floor && iso.layers.includes('onTop') ? S.where.anywhere : floor ? S.where.floor : S.where.onTop;
  if (!floor || !iso.foot) return { text: place, spoken: place };
  const [w, d] = iso.foot;
  return { text: S.where.line(place, S.where.tiles(w, d)), spoken: S.where.spoken(place, S.where.tilesSpoken(w, d)) };
}

export interface PieceSheet {
  name: string;
  where: { text: string; spoken: string };
  /** The rule's line when the piece must be earned first ("Sleep goal · I"); null when it is for sale. */
  locked: string | null;
  /** The same rule read aloud ("Sleep goal, level 1"), never "·" or a Roman numeral (ruling PF-F6). */
  lockedSpoken: string | null;
  have: string;
  haveSpoken: string;
  canBuy: boolean;
  button: string;
  /** What the piece does in the room (spec §6.6's effect line); null for a piece with no effect. */
  effect: string | null;
}

export function pieceSheet(itemId: string, price: number, balance: number, counts: Readonly<Record<string, number>>): PieceSheet {
  const item = catalogueItem(itemId)!;
  const isLocked = lockedFor(item.unlock, counts[itemId] ?? 0);
  const after = balance - price;
  const [b, a] = [coinCount(balance), coinCount(Math.max(0, after))];
  return {
    name: itemName(itemId),
    where: whereLine(itemId),
    locked: isLocked ? unlockLine(item.unlock) : null,
    lockedSpoken: isLocked ? unlockSpoken(item.unlock) : null,
    have: after >= 0 ? S.have(b, a) : S.haveOnly(b),
    haveSpoken: after >= 0 ? S.haveSpoken(b, a) : S.haveOnly(b),
    canBuy: !isLocked && after >= 0,
    button: after >= 0 ? S.get(coinCount(price)) : S.needs(coinCount(-after)),
    effect: item.iso?.effect ? ROOM_COPY.effects.lines[item.iso.effect] : null,
  };
}
