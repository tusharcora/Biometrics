// Gifts waiting on your floor, this week's cheers on your room and the week's challenge (spec 2026-10-15 §10.2-10.4),
// for the KIP page's room card. Read on focus; an older server (404) has none of them. The challenge is read on its
// own: its failure keeps the last one shown and never costs the gifts. The epoch guard of the other room stores: an
// open or a sign-out moves it, so a read that started before one never brings an opened gift back or lands in another
// account. Nothing here is logged.
import { useSyncExternalStore } from 'react';
import { ApiError } from '../../api/client';
import { fetchChallenge, fetchGifts, fetchRoomCheers, openGift, type ChallengeDTO, type GiftDTO, type ThemeId } from '../../api/rooms';
import { applyGrant, loadCosmetics } from './cosmeticsStore';
import type { ItemId } from './loadout';

/** The week's challenge as the room card needs it: `live` (a theme, still open) offers Room challenge (ruling 22). */
export interface RoomChallengeState { live: boolean; themeId: ThemeId | null; entry: boolean }
export interface RoomSocial { gifts: GiftDTO[]; cheers: number; challenge: RoomChallengeState | null }
const EMPTY: RoomSocial = { gifts: [], cheers: 0, challenge: null };
const challengeOf = (c: ChallengeDTO | null): RoomChallengeState | null =>
  c ? { live: !!c.theme && c.open === true, themeId: c.theme?.id ?? null, entry: !!c.entry } : null;
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
  // undefined: the read failed, so the last challenge stays.
  const week = orNone(fetchChallenge(), null).then(challengeOf, () => undefined);
  try {
    const [g, c, ch] = await Promise.all([orNone(fetchGifts(), { gifts: [] }), orNone(fetchRoomCheers(), { count: 0, cheers: [] }), week]);
    if (at === epoch) {
      publish({ gifts: Array.isArray(g?.gifts) ? g.gifts : [], cheers: typeof c?.count === 'number' ? c.count : 0, challenge: ch === undefined ? state.challenge : ch });
    }
  } catch {
    // Keep what is shown; the next focus reads again. A challenge read that did land is still shown.
    const ch = await week;
    if (at === epoch && ch !== undefined) publish({ ...state, challenge: ch });
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
