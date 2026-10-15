// Telling you something unlocked (spec 2026-10-14 KIP's room §4). Badge pieces are named by the celebration; recap,
// cheer and set pieces get one toast each time new ones arrive; the backfill gets one summary toast (ruling 11).
import { catalogueItem, isWornSlot } from './catalogue';
import type { DecorateParams } from './edit/editor';
import { STYLE_KEYS } from './iso/geometry';
import { itemName, ROOM_COPY, spokenName } from './roomCopy';

export interface Toasted {
  /** Unseen piece ids already toasted on this device. */
  ids: string[];
  /** How many unseen backfill rows the summary already covered. */
  backfill: number;
}
export const EMPTY_TOASTED: Toasted = { ids: [], backfill: 0 };

export type RoomToast =
  | { kind: 'items'; itemIds: string[]; text: string }
  | { kind: 'backfill'; count: number; text: string };

type Fresh = ReadonlyArray<{ itemId: string; source: string }>;
const MAX_IDS = 40;
const toastable = (source: string) => source.startsWith('counter:') || source.startsWith('set:');

export function nextToast(fresh: Fresh, toasted: Toasted): { toast: RoomToast | null; toasted: Toasted } {
  const unseen = new Set(fresh.map((f) => f.itemId));
  const ids = toasted.ids.filter((id) => unseen.has(id));
  const backfill = fresh.filter((f) => f.source === 'backfill').length;
  const covered = Math.min(toasted.backfill, backfill);
  if (backfill > covered) {
    return { toast: { kind: 'backfill', count: backfill, text: ROOM_COPY.backfill(backfill) }, toasted: { ids, backfill } };
  }
  const items = fresh.filter((f) => toastable(f.source) && !ids.includes(f.itemId)).map((f) => f.itemId);
  if (!items.length) return { toast: null, toasted: { ids, backfill: covered } };
  return {
    toast: { kind: 'items', itemIds: items, text: ROOM_COPY.newFor(itemName(items[0]!), items.length - 1) },
    toasted: { ids: [...ids, ...items].slice(-MAX_IDS), backfill: covered },
  };
}

/** What a screen reader says for a toast: the item named without the "·" (ruling 19). */
export function toastSpoken(toast: RoomToast): string {
  return toast.kind === 'items' ? ROOM_COPY.newFor(spokenName(toast.itemIds[0]!), toast.itemIds.length - 1) : toast.text;
}

/** The unseen pieces a celebration names: its family at its level or below, and any family at those levels (ruling 10). */
export function piecesForBadge(fresh: Fresh, family: string, level: number): string[] {
  return fresh
    .filter(({ source }) => {
      const fam = /^family:([A-Z_]+):(\d)$/.exec(source);
      if (fam) return fam[1] === family && Number(fam[2]) <= level;
      const any = /^anyFamily:(\d)$/.exec(source);
      return !!any && Number(any[1]) <= level;
    })
    .map((f) => f.itemId);
}

/**
 * The toast's and the celebration line's Decorate (spec 2026-10-15 §1 Toasts): a piece opens the drawer on New with
 * it picked; a worn piece opens the KIP tab and a style the Room tab, as Spec B did (final review I2), since New lists
 * only pieces.
 */
export function decorateTarget(itemId: string): DecorateParams {
  const slot = catalogueItem(itemId)?.slot;
  if (slot && isWornSlot(slot)) return { drawer: 'kip' };
  if (slot && (STYLE_KEYS as readonly string[]).includes(slot)) return { drawer: 'room' };
  return { drawer: 'new', item: itemId };
}
