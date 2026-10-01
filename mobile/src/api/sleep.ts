import { apiFetch } from './client';

export interface SleepNight {
  // The local date the night ENDED on (the morning you woke up).
  date: string;
  minutesAsleep: number;
  // Start to end across that date's sessions; null if the sessions are missing.
  minutesInBed: number | null;
  // Local "HH:MM" (24-hour) of the night's main sleep.
  bedtime: string | null;
  wakeTime: string | null;
  sleepScore: number | null;
}

export interface SleepActivityDTO {
  nights: SleepNight[];
  // The oldest night the server has, or null when none has synced yet.
  earliestDate: string | null;
}

// Nightly sleep for an inclusive civil-date range (the server caps it at 400 days).
export function fetchSleep(from: string, to: string): Promise<SleepActivityDTO> {
  return apiFetch<SleepActivityDTO>(`/me/sleep?from=${from}&to=${to}`);
}
