// Which items a user's own data unlocks (spec 2026-10-14 KIP's room §3.1). Pure: the facts are read elsewhere.
// Each rule has the moment it was met; a grant is 'backfill' when that moment is before its release launched, so
// it does not matter which hook (badge, recap, cheer, GET) happens to run first.
import type { CosmeticItem, CosmeticSet, UnlockRule } from './catalogue';

export interface UnlockFacts {
  /** Every stored badge level and when it was stored. */
  levels: ReadonlyArray<{ family: string; level: number; at: Date }>;
  /** When each opened weekly recap was opened, oldest first. */
  recapsReadAt: readonly Date[];
  /** When each counted cheer happened (one per buddy per local day), oldest first. */
  cheersAt: readonly Date[];
}

export const BACKFILL = 'backfill';

export interface PlannedGrant {
  itemId: string;
  source: string;
}

function earliest(dates: readonly Date[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (!best || d < best) best = d;
  return best;
}

export function metAt(rule: UnlockRule, facts: UnlockFacts, setsById: ReadonlyMap<string, CosmeticSet>): Date | null {
  switch (rule.kind) {
    case 'starter':
    case 'shop':
      return null;
    case 'family':
      return earliest(facts.levels.filter((l) => l.family === rule.family && l.level >= rule.level).map((l) => l.at));
    case 'anyFamily':
      return earliest(facts.levels.filter((l) => l.level >= rule.level).map((l) => l.at));
    case 'counter':
      return (rule.counter === 'recaps_read' ? facts.recapsReadAt : facts.cheersAt)[rule.atLeast - 1] ?? null;
    case 'set': {
      const set = setsById.get(rule.set);
      return set ? metAt(set.unlock, facts, setsById) : null;
    }
  }
}

export function sourceOf(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'family': return `family:${rule.family}:${rule.level}`;
    case 'anyFamily': return `anyFamily:${rule.level}`;
    case 'counter': return `counter:${rule.counter}:${rule.atLeast}`;
    case 'set': return `set:${rule.set}`;
    case 'starter': return 'starter';
    // Never a grant source: a purchase records its ItemGrant under 'buy:{requestId}'.
    case 'shop': return 'shop';
  }
}

export function planGrants(input: {
  items: readonly CosmeticItem[];
  sets: readonly CosmeticSet[];
  facts: UnlockFacts;
  owned: ReadonlySet<string>;
  shipped: ReadonlySet<number>;
  launchedAt: Readonly<Partial<Record<number, Date>>>;
}): PlannedGrant[] {
  const { items, sets, facts, owned, shipped, launchedAt } = input;
  const setsById = new Map(sets.map((s) => [s.id as string, s]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const best = new Map<string, { at: Date; source: string }>();
  const offer = (item: CosmeticItem | undefined, at: Date, source: string) => {
    if (!item || !shipped.has(item.release) || item.retired || item.unlock.kind === 'starter' || owned.has(item.id)) return;
    const current = best.get(item.id);
    if (!current || at < current.at) best.set(item.id, { at, source });
  };
  for (const item of items) {
    if (item.unlock.kind === 'set') continue; // set-only pieces come with their set
    const at = metAt(item.unlock, facts, setsById);
    if (at) offer(item, at, sourceOf(item.unlock));
  }
  // Unlocking a set unlocks all its pieces (§1), including base pieces it reuses.
  for (const set of sets) {
    if (!shipped.has(set.release)) continue;
    const at = metAt(set.unlock, facts, setsById);
    if (!at) continue;
    for (const id of [...Object.values(set.room), ...Object.values(set.worn)]) offer(byId.get(id!), at, `set:${set.id}`);
  }
  return [...best]
    .map(([itemId, { at, source }]) => {
      const launched = launchedAt[byId.get(itemId)!.release];
      return { itemId, source: launched && at < launched ? BACKFILL : source };
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}
