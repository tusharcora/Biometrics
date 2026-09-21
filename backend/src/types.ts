export type AuthProvider = 'APPLE' | 'GOOGLE';
export type BiometricMetricType = 'HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface HealthMetricPoint {
  recordedAt: Date;
  value: number;
}

// One Google `Sleep` object, kept whole (not collapsed to a per-day value) so
// re-fetching the same session is idempotent. Only fields confirmed against
// the live API: sleep.interval.{startTime,endTime} and
// sleep.summary.minutesAsleep.
export interface SleepSessionPoint {
  startTime: Date;
  endTime: Date;
  minutesAsleep: number;
}
