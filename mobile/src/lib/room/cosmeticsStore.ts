import { useSyncExternalStore } from 'react';
import { fetchCosmetics, postCosmeticsSeen, postRoomWelcomed, putCosmetics, type CosmeticsDTO } from '../../api/cosmetics';
import { setMyKipWorn } from '../kip/myKip';
import { EMPTY_WORN, type ItemId, type KipWorn } from './loadout';
import { WORN_SLOTS } from './catalogue';
import { NEUTRAL_LIVING, livingKey, readLiving, type Living } from './effects';
import { capFor, toTier, type RoomLayout, type Tier } from './iso/geometry';
import { readLayout, starterLayout } from './layout';

// One shared copy of GET /me/cosmetics (spec 2026-10-14 KIP's room §4, §5; spec 2026-10-15 §2.3): what you own and
// how many, what is new, your room's layout, tier and cap, what KIP wears, and whether the first-week welcome was
// seen. The server already trimmed the layout to what you own; a body that is no layout reads as the starter room.
// Loaded per sign-in by MyKipScope and again on foreground and KIP tab focus (RoomToastHost); a save publishes the
// server's answer. Anything that lands after sign-out is dropped (the session moves); a read that lands after a save
// or mark-seen that began while it was in flight is dropped too (each moves the read epoch); and an answer older than
// the shown version never replaces it, so overlapping saves end at the newest.

export interface Cosmetics {
  owned: ReadonlySet<string>;
  fresh: ReadonlyArray<{ itemId: string; source: string }>;
  layout: RoomLayout;
  tier: Tier;
  cap: number;
  counts: Readonly<Record<string, number>>;
  worn: KipWorn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  welcomed: boolean;
  /** Plants, the cat and the trophy shelf (spec §8.3): the neutral room when the body has none (PF3-LIVING). */
  living: Living;
}

let cosmetics: Cosmetics | null = null;
// Bumped by every save, mark-seen, welcome and sign-out: a read that started before one never lands after it.
let epoch = 0;
// Bumped only on sign-out: a save's answer lands unless the account changed.
let session = 0;
const listeners = new Set<() => void>();

const sameWorn = (a: KipWorn, b: KipWorn) => WORN_SLOTS.every((s) => a[s] === b[s]);

function publish(next: Cosmetics): void {
  if (cosmetics && next.version < cosmetics.version) return;
  const wornChanged = !cosmetics || !sameWorn(cosmetics.worn, next.worn);
  cosmetics = next;
  if (wornChanged) setMyKipWorn(next.worn); // a new object only when it changed (Spec B Task 8 minor)
  listeners.forEach((l) => l());
}

const idOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

function fromDTO(dto: CosmeticsDTO): Cosmetics {
  // Not a cosmetics body at all: the read fails and what is shown stays.
  if (typeof dto?.version !== 'number' || !Array.isArray(dto.owned) || !Array.isArray(dto.fresh)) throw new Error('not a cosmetics body');
  const worn = { ...EMPTY_WORN };
  for (const slot of WORN_SLOTS) worn[slot] = idOrNull(dto.worn?.[slot]);
  const tier = toTier(dto.tier);
  return {
    owned: new Set(dto.owned), fresh: dto.fresh, layout: readLayout(dto.layout), tier,
    cap: typeof dto.cap === 'number' ? dto.cap : capFor(tier), counts: dto.counts ?? {}, worn,
    version: dto.version, counters: dto.counters ?? { recapsRead: 0, buddyCheers: 0 },
    // An older server sends no flag: never show the welcome there.
    welcomed: dto.welcomed !== false,
    living: readLiving(dto.living),
  };
}

export function getCosmetics(): Cosmetics | null {
  return cosmetics;
}

// The read in flight and the epoch it started in: loads started in the same epoch share it (sign-in starts two).
let inflight: { at: number; read: Promise<Cosmetics | null> } | null = null;

/**
 * Reads the server (which also catches up on grants). Keeps what is shown when the read fails. `fresh` moves the epoch
 * first, so it never shares a read that started earlier and that read's answer is dropped: for a question asked after
 * something may have changed on the server, such as whether a grow whose answer was lost landed (ruling T14-CARRY).
 */
export function loadCosmetics({ fresh = false }: { fresh?: boolean } = {}): Promise<Cosmetics | null> {
  if (fresh) epoch++;
  else if (inflight && inflight.at === epoch) return inflight.read;
  const at = epoch;
  const read = (async () => {
    try {
      const dto = await fetchCosmetics();
      if (at === epoch) publish(fromDTO(dto));
    } catch {
      // The next sign-in, foreground or KIP tab focus tries again.
    }
    return cosmetics;
  })();
  inflight = { at, read };
  // Attached first, so it runs before any caller resumes: a load started after this one lands reads afresh.
  void read.then(() => {
    if (inflight?.read === read) inflight = null;
  });
  return read;
}

/** PUT /me/cosmetics. Throws the ApiError (403 not_owned, 409 stale, 400 …) for the editor to handle. */
export async function saveCosmeticsLoadout(input: { layout: RoomLayout; worn: KipWorn; version: number }): Promise<Cosmetics> {
  epoch++;
  const at = session;
  const next = fromDTO(await putCosmetics(input));
  if (at === session) publish(next);
  return next;
}

/** A coin-shop purchase landed (spec §6.6): the server's counts; the piece owned and NEW until seen (ruling 7). */
export function applyPurchase(itemId: ItemId, counts: Readonly<Record<string, number>>): void {
  // First: a read that started before the purchase never brings the old count back, even the first read of the room
  // (it is dropped and the next read lands the piece).
  epoch++;
  if (!cosmetics) return;
  const owned = new Set(cosmetics.owned);
  owned.add(itemId);
  const fresh = cosmetics.fresh.some((f) => f.itemId === itemId) ? cosmetics.fresh : [...cosmetics.fresh, { itemId, source: 'buy' }];
  publish({ ...cosmetics, owned, counts: { ...counts }, fresh });
}

/** A whole GET body from another route (the grow, spec §7): published as a read is, and only if it is not older. */
export function applyCosmeticsBody(dto: CosmeticsDTO): void {
  epoch++;
  try {
    publish(fromDTO(dto));
  } catch {
    // Not a cosmetics body: keep what is shown.
  }
}

/** Clears these from "new" now and tells the server; a failed post is retried by the next open. */
export async function markCosmeticsSeen(itemIds: readonly string[]): Promise<void> {
  if (!itemIds.length) return;
  epoch++;
  const ids = new Set(itemIds);
  if (cosmetics) publish({ ...cosmetics, fresh: cosmetics.fresh.filter((f) => !ids.has(f.itemId)) });
  try {
    await postCosmeticsSeen([...ids]);
  } catch {
    // Still unseen on the server: the next open marks it again.
  }
}

/** The welcome card was answered (spec §11.1): hidden at once here, recorded on the server for every device. */
export async function markWelcomed(): Promise<void> {
  epoch++; // a read that started before this never brings the card back
  if (cosmetics && !cosmetics.welcomed) publish({ ...cosmetics, welcomed: true });
  try {
    await postRoomWelcomed();
  } catch {
    // Still unanswered on the server: the next read shows the card again, which is harmless.
  }
}

export function resetCosmetics(): void {
  epoch++;
  session++;
  cosmetics = null;
  listeners.forEach((l) => l());
}

export function hasUnseen(c: Cosmetics | null): boolean {
  return !!c && c.fresh.length > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCosmetics(): Cosmetics | null {
  return useSyncExternalStore(subscribe, getCosmetics, getCosmetics);
}

export interface MyRoom { layout: RoomLayout; tier: Tier; living: Living }
const STARTER_ROOM_VIEW: MyRoom = { layout: starterLayout(), tier: 1, living: NEUTRAL_LIVING };
let roomView: { from: Cosmetics; value: MyRoom } | null = null;
const roomOf = (): MyRoom => {
  if (!cosmetics) return STARTER_ROOM_VIEW;
  if (roomView?.from !== cosmetics) {
    // Marking seen republishes the same layout: keep the same object so the room's readers don't re-render.
    const same = roomView && roomView.value.layout === cosmetics.layout && roomView.value.tier === cosmetics.tier
      && livingKey(roomView.value.living) === livingKey(cosmetics.living);
    roomView = {
      from: cosmetics,
      value: same ? roomView!.value : { layout: cosmetics.layout, tier: cosmetics.tier, living: cosmetics.living },
    };
  }
  return roomView.value;
};
/** Your stored room (the starter layout until the first read), one stable object per published read. */
export function useMyRoom(): MyRoom {
  return useSyncExternalStore(subscribe, roomOf, roomOf);
}
