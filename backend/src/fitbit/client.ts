import fetch from 'node-fetch';
import { BiometricMetricType, FitbitMetricPoint } from '../types';

const BASE_URL = 'https://api.fitbit.com';

async function get<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Fitbit API returned ${res.status} for ${path}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

interface HeartRateResponse {
  'activities-heart': { dateTime: string; value: { restingHeartRate?: number } }[];
}
interface StepsResponse {
  'activities-steps': { dateTime: string; value: string }[];
}
interface SleepResponse {
  sleep: { dateOfSleep: string; minutesAsleep: number }[];
}
interface HrvResponse {
  hrv: { dateTime: string; value: { dailyRmssd: number } }[];
}

export async function fetchMetricRange(
  accessToken: string,
  metricType: BiometricMetricType,
  startDate: string,
  endDate: string,
): Promise<FitbitMetricPoint[]> {
  switch (metricType) {
    case 'RESTING_HR': {
      const data = await get<HeartRateResponse>(
        `/1/user/-/activities/heart/date/${startDate}/${endDate}.json`,
        accessToken,
      );
      return data['activities-heart']
        .filter((entry) => entry.value.restingHeartRate !== undefined)
        .map((entry) => ({ recordedAt: new Date(entry.dateTime), value: entry.value.restingHeartRate! }));
    }
    case 'STEPS': {
      const data = await get<StepsResponse>(
        `/1/user/-/activities/steps/date/${startDate}/${endDate}.json`,
        accessToken,
      );
      return data['activities-steps'].map((entry) => ({
        recordedAt: new Date(entry.dateTime),
        value: Number(entry.value),
      }));
    }
    case 'SLEEP': {
      const data = await get<SleepResponse>(
        `/1.2/user/-/sleep/date/${startDate}/${endDate}.json`,
        accessToken,
      );
      return data.sleep.map((entry) => ({
        recordedAt: new Date(entry.dateOfSleep),
        value: entry.minutesAsleep,
      }));
    }
    case 'HRV': {
      const data = await get<HrvResponse>(`/1/user/-/hrv/date/${startDate}/${endDate}.json`, accessToken);
      return data.hrv.map((entry) => ({
        recordedAt: new Date(entry.dateTime),
        value: entry.value.dailyRmssd,
      }));
    }
  }
}
