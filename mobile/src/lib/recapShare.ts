import type { RecapStats } from '../api/recaps';
import { isCharacterId, type CharacterId } from '../components/characters/types';

// The shareable images (spec 2026-10-04 §3): formats, what each can include, and the export
// geometry. Pure, so the builder and its tests share one source.

export type ShareFormat = 'card' | 'story' | 'year';
export type IncludeKey = 'avgSleep' | 'streak' | 'bestRecovery' | 'steps' | 'bestNight' | 'quote' | 'coach' | 'count';
export type Includes = Record<IncludeKey, boolean>;

/** The only identity on an image: the app's name, no URL (owner decision). */
export const APP_NAME = 'Biometrics';
export const DESIGN_WIDTH = 360;
export const DESIGN_HEIGHT: Record<ShareFormat, number> = { card: 360, story: 640, year: 360 };
export const EXPORT_PIXELS = 1080;

export const FORMAT_INCLUDES: Record<ShareFormat, IncludeKey[]> = {
  card: ['avgSleep', 'streak', 'bestRecovery', 'steps', 'quote', 'coach'],
  story: ['bestNight', 'quote', 'coach'],
  year: ['count', 'coach'],
};

export const INCLUDE_LABELS: Record<IncludeKey, string> = {
  avgSleep: 'Average sleep',
  streak: 'Longest streak',
  bestRecovery: 'Best recovery',
  steps: 'Daily steps',
  bestNight: 'Best night',
  quote: "Coach's quote",
  coach: 'Coach character',
  count: 'Nights on goal',
};

export const FORMAT_LABELS: Record<ShareFormat, string> = { card: 'Monthly card', story: 'Weekly story', year: 'Year in pixels' };

const ALL_KEYS: IncludeKey[] = ['avgSleep', 'streak', 'bestRecovery', 'steps', 'bestNight', 'quote', 'coach', 'count'];

/** The switches a format offers for these stats: a missing stat (or a streak of 0) has none. */
export function availableIncludes(format: ShareFormat, stats: RecapStats | null): IncludeKey[] {
  return FORMAT_INCLUDES[format].filter((key) => {
    switch (key) {
      case 'avgSleep':
        return stats?.avgSleepMinutes !== undefined;
      case 'streak':
        return (stats?.longestOnGoalStreak ?? 0) > 0;
      case 'bestRecovery':
        return stats?.bestRecovery !== undefined;
      case 'steps':
        return stats?.steps !== undefined;
      case 'bestNight':
        return stats?.bestNight !== undefined;
      default:
        return true;
    }
  });
}

/** Every key: on when available and not switched off; an unavailable key is always off. */
export function resolveIncludes(format: ShareFormat, stored: Partial<Includes>, stats: RecapStats | null): Includes {
  const available = new Set(availableIncludes(format, stats));
  return Object.fromEntries(ALL_KEYS.map((k) => [k, available.has(k) && stored[k] !== false])) as Includes;
}

/**
 * makeImageFromView has no scale argument and captures at the device's pixel ratio, so the export
 * view is laid out 1080 / pixelRatio points wide: the capture is 1080 px wide on any device (spec §3).
 */
export function exportLayout(format: ShareFormat, pixelRatio: number): { width: number; height: number; scale: number } {
  const width = EXPORT_PIXELS / pixelRatio;
  const scale = width / DESIGN_WIDTH;
  return { width, height: DESIGN_HEIGHT[format] * scale, scale };
}

/**
 * The coach on the monthly card and weekly story: the recap's own, since its line was written in
 * that voice; the current coach when the recap has none we know (ruling S6). Year in pixels has no
 * line and always shows the current coach.
 */
export function recapCoachId(recap: { personaId: string | null }, current: CharacterId): CharacterId {
  return isCharacterId(recap.personaId) ? recap.personaId : current;
}

/** The on-screen preview's scale: the design fitted into a box. Never captured. */
export function previewScale(format: ShareFormat, maxWidth: number, maxHeight: number): number {
  return Math.min(maxWidth / DESIGN_WIDTH, maxHeight / DESIGN_HEIGHT[format]);
}
