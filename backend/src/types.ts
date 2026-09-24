export type BiometricMetricType = 'HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS';

export interface HealthMetricPoint {
  recordedAt: Date;
  value: number;
}

// One Google `Sleep` object, kept whole (not collapsed to a per-day value) so
// re-fetching the same session is idempotent. Only fields confirmed against
// the live API: sleep.interval.{startTime,endTime} and
// sleep.summary.minutesAsleep, plus sleep.interval.{startUtcOffset,endUtcOffset}
// ("-14400s" strings, verified live) parsed to seconds east of UTC. The offsets
// are the record's own local-time basis; null when Google omitted or garbled one.
export interface SleepSessionPoint {
  startTime: Date;
  endTime: Date;
  minutesAsleep: number;
  startUtcOffsetSeconds?: number | null;
  endUtcOffsetSeconds?: number | null;
}
