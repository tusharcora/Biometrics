import { useSyncExternalStore } from 'react';
import { fetchAchievements, markCelebrated, type Achievements, type UncelebratedLevel } from '../api/achievements';

// One shared copy of GET /me/achievements (spec 2026-10-06 §6) for the Profile card, the Badges
// screens, the celebration and the recap cards, like the story ring's store. A 404 (a backend
// older than badges) is 'unavailable' and hides every badge UI. Levels closed in a celebration are
// remembered for the session, so a refresh before the server has them never shows them again.

export type AchievementsState =
  | { status: 'idle' }
  | { status: 'ready'; data: Achievements }
  | { status: 'unavailable' }
  | { status: 'error' };

export interface AchievementsSnapshot {
  state: AchievementsState;
  /** Level ids closed in a celebration this session. */
  celebrated: ReadonlySet<string>;
}

let snapshot: AchievementsSnapshot = { state: { status: 'idle' }, celebrated: new Set() };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
// Bumped on reset: a load that started before it never lands after it.
let epoch = 0;

function publish(next: Partial<AchievementsSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

export function getAchievementsSnapshot(): AchievementsSnapshot {
  return snapshot;
}

/** Re-reads the badges. Calls made while one is running share it. A failure keeps what was there. */
export function refreshAchievements(): Promise<void> {
  if (inflight) return inflight;
  const at = epoch;
  const run = (async () => {
    let next: AchievementsState;
    try {
      const data = await fetchAchievements();
      next = data ? { status: 'ready', data } : { status: 'unavailable' };
    } catch {
      next = snapshot.state.status === 'ready' ? snapshot.state : { status: 'error' };
    }
    if (at === epoch) publish({ state: next });
  })();
  inflight = run;
  void run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** New levels still to celebrate: the server's list minus those closed this session. */
export function pendingLevels(s: AchievementsSnapshot): UncelebratedLevel[] {
  return s.state.status === 'ready' ? s.state.data.uncelebrated.filter((u) => !s.celebrated.has(u.id)) : [];
}

/** Closes a celebration: hidden at once, then marked on the server (a failure is retried on a later start). */
export async function celebrate(ids: readonly string[]): Promise<void> {
  publish({ celebrated: new Set([...snapshot.celebrated, ...ids]) });
  try {
    await markCelebrated([...ids]);
  } catch {
    // Hidden for this session; the server still has it uncelebrated, so a later start offers it again.
  }
}

/** Forgets everything (sign out; tests). */
export function resetAchievements(): void {
  epoch++;
  inflight = null;
  publish({ state: { status: 'idle' }, celebrated: new Set() });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAchievements(): AchievementsSnapshot {
  return useSyncExternalStore(subscribe, getAchievementsSnapshot, getAchievementsSnapshot);
}
