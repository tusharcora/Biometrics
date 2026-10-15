// Coins landing on the KIP page (spec 2026-10-15 §6.7, C1): every unseen positive earn lands once, as their total,
// named by the newest (ruling 12). A 0-coin row at the cap and a spend never land (they are written seen, ruling 6).
import type { CoinEventDTO, CoinKind } from '../../api/coins';

export const LANDING_MS = 4000;
const EARNS: ReadonlySet<CoinKind> = new Set<CoinKind>(['sleep_goal', 'steps', 'checkin', 'recap', 'cheer_given', 'cheer_got', 'challenge', 'firstweek']);

export interface Landing {
  total: number;
  /** The newest earn's kind: the line names it. */
  kind: CoinKind;
  /** How many more earns landed with it. */
  more: number;
  /** Everything up to the newest is marked seen. */
  through: string;
}

/** `events` newest first, as the server sends them. */
export function landingOf(events: readonly CoinEventDTO[]): Landing | null {
  const unseen = events.filter((e) => !e.seen && e.amount > 0 && EARNS.has(e.kind));
  const newest = unseen[0];
  if (!newest) return null;
  return { total: unseen.reduce((n, e) => n + e.amount, 0), kind: newest.kind, more: unseen.length - 1, through: newest.at };
}
