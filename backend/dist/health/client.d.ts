import { BiometricMetricType, HealthMetricPoint, SleepSessionPoint } from '../types';
export type DailyMetricType = Exclude<BiometricMetricType, 'SLEEP'>;
export declare function fetchMetricRange(accessToken: string, metricType: DailyMetricType, startDate: string, endDate: string): Promise<HealthMetricPoint[]>;
/**
 * Fetches raw sleep sessions in [startDate, endDate) (same half-open
 * convention as fetchMetricRange), one entry per Google `Sleep` object.
 *
 * Confirmed live: `sleep.interval.start_time` is explicitly rejected ("Member
 * 'sleep.interval.start_time' is not supported for filtering") -- sleep is one
 * of the types the API documents as excluded from the generic
 * interval-start-time filter pattern, so the window filters on
 * `sleep.interval.end_time` instead. `summary.minutesAsleep` is a numeric
 * string ("468"), the same string-encoded-int64 pattern as steps' countSum.
 *
 * Sessions are returned as-is rather than keyed to a day here. Every record
 * carries `interval.startUtcOffset` / `endUtcOffset` ("-14400s", verified
 * live), parsed to seconds and returned so the day key can follow the record's
 * own local time; a null offset means the caller falls back to the user's
 * timezone. Rows missing either interval bound or minutesAsleep are skipped
 * (they cannot be keyed or summed) rather than defaulted.
 */
export declare function fetchSleepSessions(accessToken: string, startDate: string, endDate: string): Promise<SleepSessionPoint[]>;
//# sourceMappingURL=client.d.ts.map