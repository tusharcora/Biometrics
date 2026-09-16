import fetch from 'node-fetch';
import { BiometricMetricType } from '../types';

const BASE_URL = 'https://health.googleapis.com/v4';

export interface HealthMetricPoint {
  recordedAt: Date;
  value: number;
}

function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

async function dailyRollUp(
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

async function listDataPoints(
  accessToken: string,
  dataType: string,
  filterField: 'interval.start_time' | 'sample_time.physical_time',
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
      const rows = await listDataPoints(accessToken, 'sleep', 'interval.start_time', startDate, endDate);
      return rows
        .filter((r) => r.sleep?.summary?.minutesAsleep !== undefined)
        .map((r) => ({
          recordedAt: new Date(r.sleep.interval.startTime),
          value: r.sleep.summary.minutesAsleep,
        }));
    }
    case 'HRV': {
      const rows = await listDataPoints(accessToken, 'heartRateVariability', 'sample_time.physical_time', startDate, endDate);
      const points = rows
        .filter((r) => r.heartRateVariability?.rootMeanSquareOfSuccessiveDifferencesMilliseconds !== undefined)
        .map((r) => ({
          recordedAt: new Date(r.heartRateVariability.sampleTime.physicalTime),
          value: r.heartRateVariability.rootMeanSquareOfSuccessiveDifferencesMilliseconds,
        }))
        .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
      // HRV is sample-based, possibly multiple readings per day.
      // Take the last sample as the day's representative value.
      return points.length > 0 ? [points[points.length - 1]] : [];
    }
  }
}
