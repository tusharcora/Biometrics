// The one rule for a night's main session (spec 2026-10-03 §2): most minutes asleep, earliest
// start on a tie, skipping a non-positive interval. Scoring and every sleep endpoint use it,
// so a night's bedtime is the same everywhere. Google's mainSleep flag is deliberately unused.
export function pickMainSession<T extends { startTime: Date; endTime: Date; minutesAsleep: number }>(sessions: readonly T[]): T | null {
  let main: T | null = null;
  for (const s of sessions) {
    if (!(s.endTime.getTime() - s.startTime.getTime() > 0)) continue;
    if (!main || s.minutesAsleep > main.minutesAsleep || (s.minutesAsleep === main.minutesAsleep && s.startTime < main.startTime)) main = s;
  }
  return main;
}
