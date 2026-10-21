// Gifts waiting on your floor and this week's cheers on your room (spec 2026-10-15 §10.2, §10.3), for the KIP page's
// room card. Read on focus; an older server (404) has neither. The epoch guard of the other room stores: an open or
// a sign-out moves it, so a read that started before one never brings an opened gift back or lands in another
// account. Nothing here is logged.
import { useSyncExternalStore } from 'react';
import { ApiError } from '../../api/client';
import { fetchGifts, fetchRoomCheers, openGift, type GiftDTO } from '../../api/rooms';
import { applyGrant, loadCosmetics } from './cosmeticsStore';
import type { ItemId } from './loadout';

export interface RoomSocial { gifts: GiftDTO[]; cheers: number }
const EMPTY: RoomSocial = { gifts: [], cheers: 0 };
let state: RoomSocial = EMPTY;
let epoch = 0;
// Bumped only on sign-out: an open's answer lands unless the account changed.
let session = 0;
const listeners = new Set<() => void>();
const publish = (next: RoomSocial) => {
  state = next;
  listeners.forEach((l) => l());
};
const orNone = <T,>(read: Promise<T>, none: T): Promise<T> =>
  read.catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return none;
    throw e;
  });
const without = (id: string) => publish({ ...state, gifts: state.gifts.filter((g) => g.id !== id) });

export async function loadRoomSocial(): Promise<void> {
  const at = ++epoch;
  try {
    const [g, c] = await Promise.all([orNone(fetchGifts(), { gifts: [] }), orNone(fetchRoomCheers(), { count: 0, cheers: [] })]);
    if (at === epoch) publish({ gifts: Array.isArray(g?.gifts) ? g.gifts : [], cheers: typeof c?.count === 'number' ? c.count : 0 });
  } catch {
    // Keep what is shown; the next focus reads again.
  }
}

/**
 * Opens a gift into your inventory with NEW (spec §10.3): answers its piece, or null when it was already gone (a
 * returned gift: its box goes and the list is read again). Either way your cosmetics are read again at once
 * (T11T12-RELOAD). Any other failure (try_later, offline) throws and the box stays, so a tap tries again.
 */
export async function openGiftNow(id: string): Promise<ItemId | null> {
  const gift = state.gifts.find((g) => g.id === id);
  const at = session;
  epoch++;
  try {
    const { counts } = await openGift(id);
    if (at !== session) return null;
    without(id);
    if (gift) applyGrant(gift.itemId, counts, 'gift_in');
    void loadCosmetics();
    return gift?.itemId ?? null;
  } catch (e) {
    if (at !== session) return null;
    if (e instanceof ApiError && e.code === 'gift_gone') {
      without(id);
      void loadRoomSocial();
      void loadCosmetics();
      return null;
    }
    throw e;
  }
}

export function resetRoomSocial(): void {
  epoch++;
  session++;
  publish(EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getState = () => state;

export function useRoomSocial(): RoomSocial {
  return useSyncExternalStore(subscribe, getState, getState);
}
