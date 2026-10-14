import { useSyncExternalStore } from 'react';
import { fetchCosmetics, postCosmeticsSeen, putCosmetics, type CosmeticsDTO } from '../../api/cosmetics';
import { setMyKipWorn } from '../kip/myKip';
import { EMPTY_WORN, STARTER_LOADOUT, type KipWorn, type RoomLoadout } from './loadout';
import { ROOM_SLOTS, WORN_SLOTS } from './slots';

// One shared copy of GET /me/cosmetics (spec 2026-10-14 KIP's room §4, §5): what you own, what is new, your room and
// what KIP wears, as stored (ruling 25: ids this build cannot draw are kept here and drawn through drawableLoadout).
// Loaded per sign-in by MyKipScope and again on foreground and KIP tab focus (RoomToastHost); a save publishes the
// server's answer. Anything that lands after sign-out is dropped (the session moves); a read that lands after a save
// or mark-seen that began while it was in flight is dropped too (each moves the read epoch); and an answer older than
// the shown version never replaces it, so overlapping saves end at the newest.

export interface Cosmetics {
  owned: ReadonlySet<string>;
  fresh: ReadonlyArray<{ itemId: string; source: string }>;
  room: RoomLoadout;
  worn: KipWorn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
}

let cosmetics: Cosmetics | null = null;
// Bumped by every save, mark-seen and sign-out: a read that started before one never lands after it.
let epoch = 0;
// Bumped only on sign-out: a save's answer lands unless the account changed.
let session = 0;
const listeners = new Set<() => void>();

function publish(next: Cosmetics): void {
  if (cosmetics && next.version < cosmetics.version) return;
  cosmetics = next;
  setMyKipWorn(next.worn);
  listeners.forEach((l) => l());
}

const idOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

function fromDTO(dto: CosmeticsDTO): Cosmetics {
  const room = { ...STARTER_LOADOUT };
  for (const slot of ROOM_SLOTS) if (slot in dto.room) room[slot] = idOrNull(dto.room[slot]);
  const worn = { ...EMPTY_WORN };
  for (const slot of WORN_SLOTS) worn[slot] = idOrNull(dto.worn[slot]);
  return { owned: new Set(dto.owned), fresh: dto.fresh, room, worn, version: dto.version, counters: dto.counters };
}

export function getCosmetics(): Cosmetics | null {
  return cosmetics;
}

// The read in flight and the epoch it started in: loads started in the same epoch share it (sign-in starts two).
let inflight: { at: number; read: Promise<Cosmetics | null> } | null = null;

/** Reads the server (which also catches up on grants). Keeps what is shown when the read fails. */
export function loadCosmetics(): Promise<Cosmetics | null> {
  if (inflight && inflight.at === epoch) return inflight.read;
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

/** PUT /me/cosmetics. Throws the ApiError (403 not_owned, 409 stale, …) for decorate mode to handle. */
export async function saveCosmeticsLoadout(input: { room: RoomLoadout; worn: KipWorn; version: number }): Promise<Cosmetics> {
  epoch++;
  const at = session;
  const next = fromDTO(await putCosmetics(input));
  if (at === session) publish(next);
  return next;
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

const roomOf = () => cosmetics?.room ?? STARTER_LOADOUT;
/** Your stored room (the starter room until the first read). Draw it through drawableLoadout. */
export function useMyRoom(): RoomLoadout {
  return useSyncExternalStore(subscribe, roomOf, roomOf);
}
