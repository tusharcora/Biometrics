// Sleep cycles read off one night's stage timeline. A cycle starts at sleep
// onset (or where the last one ended) and ends with a REM period; whatever
// follows the last REM period is the night winding down, not another cycle.

import type { SleepNightDetail, StageType } from '../api/sleep';

export type StageSegment = SleepNightDetail['stages'][number];

export interface SleepCycle {
  n: number;
  start: string;
  end: string;
  minutes: number;
  // Minutes in each stage within the cycle (segments clipped to it).
  stageMinutes: Record<StageType, number>;
}

export interface CycleTail {
  awakeMinutes: number;
  sleepMinutes: number;
}

export interface SleepCycles {
  cycles: SleepCycle[];
  // Everything after the last REM period (the whole night after onset without REM).
  tail: CycleTail;
  averageMinutes: number | null;
}

// REM this close to the previous REM period continues it rather than starting another.
const REM_JOIN_MS = 15 * 60000;

/** Indexes of AWAKE segments strictly between the night's first and last sleep: waking in the night. */
export function midNightWakeIndexes(segments: StageSegment[]): Set<number> {
  const first = segments.findIndex((s) => s.type !== 'AWAKE');
  let last = -1;
  segments.forEach((s, i) => {
    if (s.type !== 'AWAKE') last = i;
  });
  const out = new Set<number>();
  for (let i = first + 1; first >= 0 && i < last; i++) {
    if (segments[i]!.type === 'AWAKE') out.add(i);
  }
  return out;
}

/** Whole minutes per stage of the segments that fall within [from, to), clipped to it. */
function minutesWithin(segments: StageSegment[], from: number, to: number): Record<StageType, number> {
  const out: Record<StageType, number> = { AWAKE: 0, LIGHT: 0, DEEP: 0, REM: 0 };
  for (const s of segments) {
    const ms = Math.min(Date.parse(s.end), to) - Math.max(Date.parse(s.start), from);
    if (ms > 0) out[s.type] += ms / 60000;
  }
  for (const k of Object.keys(out) as StageType[]) out[k] = Math.round(out[k]);
  return out;
}

export function findSleepCycles(segments: StageSegment[]): SleepCycles {
  const onsetSegment = segments.find((s) => s.type !== 'AWAKE');
  if (!onsetSegment) return { cycles: [], tail: { awakeMinutes: 0, sleepMinutes: 0 }, averageMinutes: null };
  const onset = Date.parse(onsetSegment.start);
  const nightEnd = Math.max(...segments.map((s) => Date.parse(s.end)));

  // [start, end] of each REM period, in order.
  const remPeriods: [number, number][] = [];
  for (const s of segments) {
    if (s.type !== 'REM') continue;
    const start = Date.parse(s.start);
    const end = Date.parse(s.end);
    const last = remPeriods[remPeriods.length - 1];
    if (last && start - last[1] < REM_JOIN_MS) last[1] = Math.max(last[1], end);
    else remPeriods.push([start, end]);
  }

  let from = onset;
  const cycles = remPeriods.map(([, to], i) => {
    const cycle: SleepCycle = {
      n: i + 1,
      start: new Date(from).toISOString(),
      end: new Date(to).toISOString(),
      minutes: Math.round((to - from) / 60000),
      stageMinutes: minutesWithin(segments, from, to),
    };
    from = to;
    return cycle;
  });

  const rest = minutesWithin(segments, from, nightEnd);
  return {
    cycles,
    tail: { awakeMinutes: rest.AWAKE, sleepMinutes: rest.LIGHT + rest.DEEP + rest.REM },
    averageMinutes: cycles.length > 0 ? Math.round(cycles.reduce((sum, c) => sum + c.minutes, 0) / cycles.length) : null,
  };
}
