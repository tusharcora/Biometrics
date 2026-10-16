// The Room sizes screen's rows (spec 2026-10-15 §7, C2, F5), pure: each size and its pieces, and for each bigger size
// both gates with progress ("360 of 600", "9 of 14", "level 2 now"). Coins alone never buy space; a streak alone
// doesn't either. The badge never re-locks: a broken run after it costs nothing. The gates come from the catalogue
// (ruling 37). Each row counts its pieces with their effect slots (P3 ruling 20).
import type { AchievementsSnapshot } from '../achievementsStore';
import { CATALOGUE, type AchievementFamilyName } from '../room/catalogue';
import { TIERS, type Tier } from '../room/iso/geometry';
import { ROOM_COPY, coinCount } from '../room/roomCopy';

const Z = ROOM_COPY.sizes;

export interface FamilyStanding { family: AchievementFamilyName; level: number; current: number }
export interface Gate { price: number; family: AchievementFamilyName; level: number; threshold: number }
export interface GateLine { title: string; progress: string; met: boolean }
export interface SizeRow {
  tier: Tier;
  name: string;
  size: string;
  sizeSpoken: string;
  pieces: string;
  piecesSpoken: string;
  status: 'yours' | 'next' | 'later';
  coins: GateLine | null;
  badge: GateLine | null;
}

export function gateOf(tier: 2 | 3): Gate {
  return CATALOGUE.tierGates[tier === 2 ? '2' : '3'];
}

/** The badge store's families, or null until it has loaded. */
export function familiesOf(snapshot: AchievementsSnapshot): FamilyStanding[] | null {
  return snapshot.state.status === 'ready'
    ? snapshot.state.data.families.map((f) => ({ family: f.family as AchievementFamilyName, level: f.level, current: f.current }))
    : null;
}

function badgeLine(g: Gate, families: readonly FamilyStanding[] | null): GateLine {
  const title = g.family === 'CHECK_IN' ? Z.streakTitle(g.threshold) : Z.badgeTitle(g.level);
  // Not read: unknown, never "0 of 14" (ruling T13-FIX M2).
  if (!families) return { title, progress: Z.unknown, met: false };
  const f = families.find((x) => x.family === g.family);
  const met = (f?.level ?? 0) >= g.level;
  if (g.family === 'CHECK_IN') {
    return { title, progress: met ? Z.done : Z.of(String(Math.min(f?.current ?? 0, g.threshold)), String(g.threshold)), met };
  }
  return { title, progress: met ? Z.done : f?.level ? Z.levelNow(f.level) : Z.noLevel, met };
}

export function sizeRows(tier: Tier, balance: number, families: readonly FamilyStanding[] | null): SizeRow[] {
  return ([1, 2, 3] as const).map((t): SizeRow => {
    const { n, cap, effects } = TIERS[t];
    const row = {
      tier: t, name: Z.names[t], size: Z.size(n), sizeSpoken: Z.sizeSpoken(n),
      pieces: Z.pieces(cap, effects, t === 3), piecesSpoken: Z.piecesSpoken(cap, effects, t === 3),
    };
    if (t <= tier) return { ...row, status: 'yours', coins: null, badge: null };
    const g = gateOf(t as 2 | 3);
    return {
      ...row,
      status: t === tier + 1 ? 'next' : 'later',
      coins: { title: Z.coinsTitle(coinCount(g.price)), progress: Z.of(coinCount(Math.min(balance, g.price)), coinCount(g.price)), met: balance >= g.price },
      badge: badgeLine(g, families),
    };
  });
}

/**
 * What the next size still needs, from how many coins are short and whether the badge is still missing; null when
 * nothing is. Also says a refused grow's own counts (409 gate) when the wallet couldn't be read again.
 */
export function needsLine(tier: Tier, coinsShort: number, badgeNeeded: boolean, families: readonly FamilyStanding[] | null): string | null {
  if (tier >= 3 || (coinsShort <= 0 && !badgeNeeded)) return null;
  const g = gateOf((tier + 1) as 2 | 3);
  const f = families?.find((x) => x.family === g.family);
  const parts: string[] = [];
  if (coinsShort > 0) parts.push(Z.moreCoins(coinCount(coinsShort)));
  if (badgeNeeded) parts.push(g.family === 'CHECK_IN' ? Z.moreDays(Math.max(1, g.threshold - (f?.current ?? 0))) : Z.badgeNeed(g.level));
  return Z.needs(parts);
}
