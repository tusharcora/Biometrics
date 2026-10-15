import { useSyncExternalStore } from 'react';
import { fetchCoins, fetchFirstWeek, postCoinsSeen, type CoinEventDTO, type CoinsDTO, type FirstWeekDTO } from '../../api/coins';
import { CATALOGUE } from '../room/catalogue';

// One shared copy of GET /me/coins (spec 2026-10-15 §6.7, §12) and of GET /me/firstweek (§11.2), with cosmeticsStore's
// guards: an answer that lands after sign-out is dropped (the session moves), and a read that started before a
// purchase, a grow or a mark-seen is dropped too (each moves the epoch), so a stale GET never overwrites a newer balance
// (ruling 33: coins have no version; the epoch is the "ignore older" rule). The first-week list has the same guards
// with its own epoch (ruling T9-FIX). Loaded per sign-in by MyKipScope, on every
// KIP page focus and by the coin screens.

export interface Coins {
  balance: number;
  today: { earned: number; cap: number };
  /** Newest first, as many pages as were loaded. */
  events: readonly CoinEventDTO[];
  next: string | null;
  /** False while only a purchase or grow's balance is known (no read has landed): today and the events are blanks. */
  fromServer: boolean;
}

let coins: Coins | null = null;
let firstWeek: FirstWeekDTO | null = null;
// Bumped by every purchase, grow, mark-seen, fresh read and sign-out: a read that started before one never lands after it.
let epoch = 0;
// Bumped only on sign-out: an action's answer lands unless the account changed.
let session = 0;
// The newest event this session marked seen: a read the server answered before it applied the mark still shows those
// events seen, so coins land once (spec §16). Forgotten on sign-out.
let seenThrough: string | null = null;
function withSeen(events: readonly CoinEventDTO[]): readonly CoinEventDTO[] {
  const through = seenThrough;
  return through === null ? events : events.map((e) => (!e.seen && e.at <= through ? { ...e, seen: true } : e));
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function fromDTO(dto: CoinsDTO): Coins {
  // Not a coins body at all: the read fails and what is shown stays.
  if (typeof dto?.balance !== 'number' || !Array.isArray(dto.events)) throw new Error('not a coins body');
  return { balance: dto.balance, today: dto.today ?? { earned: 0, cap: CATALOGUE.dailyCap }, events: withSeen(dto.events), next: dto.next ?? null, fromServer: true };
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

/**
 * Reads the server (which also catches up on earns). Keeps what is shown when the read fails. `fresh` moves the epoch
 * first, so it never shares a read that started earlier and that read's answer is dropped: for a question asked after
 * something may have changed on the server, such as a first-week bonus the first-week read just made payable (final
 * review I1), as loadCosmetics({ fresh }) does.
 */
export function loadCoins({ fresh = false }: { fresh?: boolean } = {}): Promise<Coins | null> {
  if (fresh) epoch++;
  else if (inflight && inflight.at === epoch) return inflight.read;
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

/** The next history page, appended unless the list changed meanwhile. False only when the read failed. */
export async function loadMoreCoins(): Promise<boolean> {
  const from = coins;
  if (!from?.next) return true;
  const at = epoch;
  try {
    const page = fromDTO(await fetchCoins(from.next));
    if (at === epoch && coins === from) {
      coins = { ...from, events: [...from.events, ...page.events], next: page.next };
      emit();
    }
    return true;
  } catch {
    // Load more stays; tapping it tries again.
    return false;
  }
}

/** A purchase or a grow answered with the balance: shown at once, and any older read is dropped. */
export function setCoinBalance(balance: number): void {
  epoch++;
  weekEpoch++;
  coins = coins ? { ...coins, balance } : { balance, today: { earned: 0, cap: CATALOGUE.dailyCap }, events: [], next: null, fromServer: false };
  emit();
}

/**
 * Coins that landed (spec §6.7): seen here at once, then on the server. Call it only once KIP's coin bubble has
 * actually been shown (ruling PF-F13: room card not shrunk, page focused); a read alone never marks anything seen.
 */
export async function markCoinsSeen(through: string): Promise<void> {
  // A read in flight is dropped by the epoch, but it may carry newer coins (a focus's catch-up): read again once it is
  // done. seenThrough keeps what this mark covers seen in that answer, so nothing lands twice (final review M1).
  const dropped = inflight?.read;
  const at = session;
  epoch++;
  if (dropped) {
    void dropped.then(() => {
      if (at === session) void loadCoins();
    });
  }
  if (seenThrough === null || through > seenThrough) seenThrough = through;
  if (coins) {
    coins = { ...coins, events: coins.events.map((e) => (!e.seen && e.at <= through ? { ...e, seen: true } : e)) };
    emit();
  }
  try {
    await postCoinsSeen(through);
  } catch {
    // Still unseen on the server, but seen for the rest of this session (seenThrough); a later landing's mark covers it.
  }
}

// The first-week list's own epoch: moved by a purchase or a grow (a bought fern ticks a task, the balance pays toward
// the next size) and by sign-out, but not by marking coins seen, which the list does not show.
let weekEpoch = 0;
let weekInflight: { at: number; read: Promise<FirstWeekDTO | null> } | null = null;

/**
 * Reads GET /me/firstweek, guarded as loadCoins is. Keeps what is shown when the read fails. A list that opens or ticks
 * a row reads the coins again, fresh: under PF-F3 only this read sets day 1, so a coins read sent alongside it (a P1
 * user's first P2 open) caught up before the first-week bonuses could pay, and the +10 would not land (final review I1).
 */
export function loadFirstWeek(): Promise<FirstWeekDTO | null> {
  if (weekInflight && weekInflight.at === weekEpoch) return weekInflight.read;
  const at = weekEpoch;
  const read = (async () => {
    try {
      const dto = await fetchFirstWeek();
      if (at === weekEpoch && dto && typeof dto.open === 'boolean') {
        const before = firstWeek;
        firstWeek = dto;
        emit();
        if (dto.open && (!before?.open || dto.done > before.done)) void loadCoins({ fresh: true });
      }
    } catch {
      // Keep what is shown.
    }
    return firstWeek;
  })();
  weekInflight = { at, read };
  void read.then(() => {
    if (weekInflight?.read === read) weekInflight = null;
  });
  return read;
}

export function resetCoins(): void {
  epoch++;
  weekEpoch++;
  session++;
  seenThrough = null;
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
