import fetch from 'node-fetch';
import { BiometricMetricType, HealthMetricPoint, SleepSessionPoint } from '../types';

const BASE_URL = 'https://health.googleapis.com/v4';

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  // A well-formed YYYY-MM-DD always yields three finite numbers; anything
  // else is a caller bug and must fail loudly rather than send Google a
  // request body with `null`/`NaN` date parts.
  if (
    year === undefined || month === undefined || day === undefined ||
    !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)
  ) {
    throw new Error(`Invalid date string "${dateStr}": expected YYYY-MM-DD`);
  }
  return { year, month, day };
}

// Confirmed live on heart-rate: "The duration covered by window_size_days *
// page_size must not exceed 14 days for heart-rate" (INVALID_ROLLUP_QUERY_DURATION).
// Applied uniformly to every dailyRollUp-backed metric rather than only
// heart-rate, since steps' own undiscovered cap (if any) is unconfirmed and
// chunking is harmless when a metric's real limit is higher.
const MAX_DAILY_ROLLUP_WINDOW_DAYS = 14;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

async function dailyRollUpChunk(
  accessToken: string,
  parentDataType: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/users/me/dataTypes/${parentDataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      range: { start: { date: parseDate(startDate) }, end: { date: parseDate(endDate) } },
      windowSizeDays: 1,
    }),
  });
  if (!res.ok) {
    const err = new Error(`Google Health dailyRollUp returned ${res.status} for ${parentDataType}`);
    (err as any).status = res.status;
    throw err;
  }
  const json = (await res.json()) as { rollupDataPoints?: any[] };
  return json.rollupDataPoints ?? [];
}

async function dailyRollUp(
  accessToken: string,
  parentDataType: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  // Validate eagerly, before the chunking loop's date arithmetic (which
  // tolerates malformed strings as NaN and would otherwise silently return
  // an empty result instead of throwing).
  parseDate(startDate);
  parseDate(endDate);
  const results: any[] = [];
  let chunkStart = startDate;
  while (daysBetween(chunkStart, endDate) > 0) {
    const remaining = daysBetween(chunkStart, endDate);
    const chunkEnd = remaining > MAX_DAILY_ROLLUP_WINDOW_DAYS ? addDays(chunkStart, MAX_DAILY_ROLLUP_WINDOW_DAYS) : endDate;
    const rows = await dailyRollUpChunk(accessToken, parentDataType, chunkStart, chunkEnd);
    results.push(...rows);
    chunkStart = chunkEnd;
  }
  return results;
}

async function listDataPoints(
  accessToken: string,
  dataType: string,
  filterField: 'interval.end_time',
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const filter = `${dataType}.${filterField} >= "${startDate}T00:00:00Z" AND ${dataType}.${filterField} < "${endDate}T00:00:00Z"`;
  const url = `${BASE_URL}/users/me/dataTypes/${dataType}/dataPoints?${new URLSearchParams({ filter }).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`Google Health dataPoints.list returned ${res.status} for ${dataType}`);
    (err as any).status = res.status;
    throw err;
  }
  const json = (await res.json()) as { dataPoints?: any[] };
  return json.dataPoints ?? [];
}

function civilDateToDate(civil: { date: { year: number; month: number; day: number } }): Date {
  const { year, month, day } = civil.date;
  return new Date(Date.UTC(year, month - 1, day));
}

// HRV is a daily pre-aggregated data type in the live API, not sample-based:
// confirmed live that `dailyRollUp` explicitly rejects it ("DailyRollup is
// not supported for data type heart-rate-variability, only list/reconcile
// supported"), and that its data lives under a *separate* collection,
// `daily-heart-rate-variability` (hyphenated in the URL), filtered by a
// `daily_heart_rate_variability.date` (underscored) civil-date literal --
// not `heart-rate-variability` with a sample-time filter. Both the URL
// segment and the filter's data-type token were confirmed against real
// responses from a live Fitbit-linked account, including the response
// field name `dailyHeartRateVariability.averageHeartRateVariabilityMilliseconds`.
async function listDailyHeartRateVariability(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<any[]> {
  const filter = `daily_heart_rate_variability.date >= "${startDate}" AND daily_heart_rate_variability.date < "${endDate}"`;
  const url = `${BASE_URL}/users/me/dataTypes/daily-heart-rate-variability/dataPoints?${new URLSearchParams({ filter }).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const err = new Error(`Google Health dataPoints.list returned ${res.status} for daily-heart-rate-variability`);
    (err as any).status = res.status;
    throw err;
  }
  const json = (await res.json()) as { dataPoints?: any[] };
  return json.dataPoints ?? [];
}

// Metrics Google delivers as one pre-aggregated value per civil day. SLEEP is
// deliberately excluded: it is fetched as whole sessions by fetchSleepSessions
// and its daily value is derived by us (see biometrics/repository.ts).
export type DailyMetricType = Exclude<BiometricMetricType, 'SLEEP'>;

export async function fetchMetricRange(
  accessToken: string,
  metricType: DailyMetricType,
  startDate: string,
  endDate: string,
): Promise<HealthMetricPoint[]> {
  switch (metricType) {
    case 'STEPS': {
      const rows = await dailyRollUp(accessToken, 'steps', startDate, endDate);
      return rows
        .filter((r) => r.steps?.countSum !== undefined)
        .map((r) => ({ recordedAt: civilDateToDate(r.civilStartTime), value: Number(r.steps.countSum) }));
    }
    case 'RESTING_HR': {
      const rows = await dailyRollUp(accessToken, 'heart-rate', startDate, endDate);
      return rows
        .filter((r) => r.heartRate?.beatsPerMinuteMin !== undefined)
        .map((r) => ({ recordedAt: civilDateToDate(r.civilStartTime), value: r.heartRate.beatsPerMinuteMin }));
    }
    case 'HRV': {
      const rows = await listDailyHeartRateVariability(accessToken, startDate, endDate);
      // Already one data point per day (a daily pre-aggregated type, not
      // sample-based -- see listDailyHeartRateVariability's comment), so no
      // day-grouping is needed: each row maps directly to one HealthMetricPoint.
      return rows
        .filter((r) => r.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds !== undefined)
        .map((r) => ({
          recordedAt: civilDateToDate(r.dailyHeartRateVariability),
          value: r.dailyHeartRateVariability.averageHeartRateVariabilityMilliseconds as number,
        }));
    }
  }
}

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
 * Sessions are returned as-is rather than keyed to a day here: which civil day
 * a session belongs to depends on the user's timezone, which this layer does
 * not know. Rows missing either interval bound or minutesAsleep are skipped
 * (they cannot be keyed or summed) rather than defaulted.
 */
export async function fetchSleepSessions(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<SleepSessionPoint[]> {
  const rows = await listDataPoints(accessToken, 'sleep', 'interval.end_time', startDate, endDate);
  const sessions: SleepSessionPoint[] = [];
  for (const r of rows) {
    const interval = r.sleep?.interval;
    const minutes = r.sleep?.summary?.minutesAsleep;
    if (!interval?.startTime || !interval?.endTime || minutes === undefined) continue;
    const startTime = new Date(interval.startTime);
    const endTime = new Date(interval.endTime);
    const minutesAsleep = Number(minutes);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || !Number.isFinite(minutesAsleep)) continue;
    sessions.push({ startTime, endTime, minutesAsleep });
  }
  return sessions;
}
