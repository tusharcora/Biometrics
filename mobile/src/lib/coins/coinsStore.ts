import { useSyncExternalStore } from 'react';
import { fetchCoins, fetchFirstWeek, postCoinsSeen, type CoinEventDTO, type CoinsDTO, type FirstWeekDTO } from '../../api/coins';

// One shared copy of GET /me/coins (spec 2026-10-15 §6.7, §12) and of GET /me/firstweek (§11.2), with cosmeticsStore's
// guards: an answer that lands after sign-out is dropped (the session moves), and a read that started before a
// purchase, a grow or a mark-seen is dropped too (each moves the epoch), so a stale GET never overwrites a newer balance
// (ruling 33: coins have no version; the epoch is the "ignore older" rule). Loaded per sign-in by MyKipScope, on every
// KIP page focus and by the coin screens.

export interface Coins {
  balance: number;
  today: { earned: number; cap: number };
  /** Newest first, as many pages as were loaded. */
  events: readonly CoinEventDTO[];
  next: string | null;
}

let coins: Coins | null = null;
let firstWeek: FirstWeekDTO | null = null;
// Bumped by every purchase, grow, mark-seen and sign-out: a read that started before one never lands after it.
let epoch = 0;
// Bumped only on sign-out: an action's answer lands unless the account changed.
let session = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function fromDTO(dto: CoinsDTO): Coins {
  // Not a coins body at all: the read fails and what is shown stays.
  if (typeof dto?.balance !== 'number' || !Array.isArray(dto.events)) throw new Error('not a coins body');
  return { balance: dto.balance, today: dto.today ?? { earned: 0, cap: 60 }, events: dto.events, next: dto.next ?? null };
}

export function getCoins(): Coins | null {
  return coins;
}
export function getFirstWeek(): FirstWeekDTO | null {
  return firstWeek;
}
/** Moves only on sign-out: an action's answer lands unless the account changed. */
export function coinSession(): number {
  return session;
}

// The read in flight and the epoch it started in: loads started in the same epoch share it.
let inflight: { at: number; read: Promise<Coins | null> } | null = null;

/** Reads the server (which also catches up on earns). Keeps what is shown when the read fails. */
export function loadCoins(): Promise<Coins | null> {
  if (inflight && inflight.at === epoch) return inflight.read;
  const at = epoch;
  const read = (async () => {
    try {
      const next = fromDTO(await fetchCoins());
      if (at === epoch) {
        coins = next;
        emit();
      }
    } catch {
      // The next focus or open tries again.
    }
    return coins;
  })();
  inflight = { at, read };
  // Attached first, so it runs before any caller resumes: a load started after this one lands reads afresh.
  void read.then(() => {
    if (inflight?.read === read) inflight = null;
  });
  return read;
}

/** The next history page, appended unless the list changed meanwhile. */
export async function loadMoreCoins(): Promise<void> {
  const from = coins;
  if (!from?.next) return;
  const at = epoch;
  try {
    const page = fromDTO(await fetchCoins(from.next));
    if (at === epoch && coins === from) {
      coins = { ...from, events: [...from.events, ...page.events], next: page.next };
      emit();
    }
  } catch {
    // Load more stays; tapping it tries again.
  }
}

/** A purchase or a grow answered with the balance: shown at once, and any older read is dropped. */
export function setCoinBalance(balance: number): void {
  epoch++;
  coins = coins ? { ...coins, balance } : { balance, today: { earned: 0, cap: 60 }, events: [], next: null };
  emit();
}

/**
 * Coins that landed (spec §6.7): seen here at once, then on the server. Call it only once KIP's coin bubble has
 * actually been shown (ruling PF-F13: room card not shrunk, page focused); a read alone never marks anything seen.
 */
export async function markCoinsSeen(through: string): Promise<void> {
  epoch++;
  if (coins) {
    coins = { ...coins, events: coins.events.map((e) => (!e.seen && e.at <= through ? { ...e, seen: true } : e)) };
    emit();
  }
  try {
    await postCoinsSeen(through);
  } catch {
    // Still unseen on the server: the next read may land it once more, which is harmless.
  }
}

export async function loadFirstWeek(): Promise<FirstWeekDTO | null> {
  const s = session;
  try {
    const dto = await fetchFirstWeek();
    if (s === session && dto && typeof dto.open === 'boolean') {
      firstWeek = dto;
      emit();
    }
  } catch {
    // Keep what is shown.
  }
  return firstWeek;
}

export function resetCoins(): void {
  epoch++;
  session++;
  coins = null;
  firstWeek = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCoins(): Coins | null {
  return useSyncExternalStore(subscribe, getCoins, getCoins);
}
export function useFirstWeek(): FirstWeekDTO | null {
  return useSyncExternalStore(subscribe, getFirstWeek, getFirstWeek);
}
