import fetch from 'node-fetch';
import { BiometricMetricType, HealthMetricPoint } from '../types';

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

// UTC-midnight of the calendar date an instant falls on. Used to key every
// metric's recordedAt on a whole day so all four metrics share one convention
// (dailyRollUp already returns civil dates; the dataPoints.list metrics carry
// raw instants that need truncating).
function utcMidnightOf(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
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

export async function fetchMetricRange(
  accessToken: string,
  metricType: BiometricMetricType,
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
    case 'SLEEP': {
      // Confirmed live: `sleep.interval.start_time` is explicitly rejected
      // ("Member 'sleep.interval.start_time' is not supported for
      // filtering") -- sleep is one of the types the API documents as
      // excluded from the generic interval-start-time filter pattern, and
      // must use `sleep.interval.end_time` instead. `summary.minutesAsleep`
      // is also confirmed live to be a numeric string ("468"), the same
      // string-encoded-int64 pattern already handled for steps' countSum.
      const rows = await listDataPoints(accessToken, 'sleep', 'interval.end_time', startDate, endDate);
      // Key each session on the UTC calendar date of its start instant, the
      // same convention STEPS/RESTING_HR use (civil date at UTC midnight),
      // rather than the raw start instant. Keeping the raw instant made a
      // 22:00 session land on a timestamp no other metric would ever use.
      return rows
        .filter((r) => r.sleep?.summary?.minutesAsleep !== undefined)
        .map((r) => ({
          recordedAt: utcMidnightOf(new Date(r.sleep.interval.startTime)),
          value: Number(r.sleep.summary.minutesAsleep),
        }));
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
