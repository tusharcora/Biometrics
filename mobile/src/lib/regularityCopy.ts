// Fixed lines per band (spec 2026-10-03 §3): never generated, never a number.
export function regularityLine(score: number | null, coachName: string): string | null {
  if (score === null) return null;
  if (score >= 75) return `${coachName}: Steady nights. Keep the rhythm.`;
  if (score >= 50) return `${coachName}: Your bedtime drifts a little. A steadier night helps.`;
  return `${coachName}: Bedtimes are all over the place lately. Pick one and try it.`;
}

// The fewest nights /me/sleep/regularity scores a window on (backend
// biometrics/regularity.ts MIN_NIGHTS).
const MIN_NIGHTS = { 7: 4, 30: 15 } as const;

/** Nights still needed before the window has a score; never below zero. */
export function nightsToGo(days: 7 | 30, nights: number): number {
  return Math.max(0, MIN_NIGHTS[days] - nights);
}
