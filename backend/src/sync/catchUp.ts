import { localCivilDate } from '../biometrics/civilDate';

// Catch-up sync: whatever Google Health has that we don't, since the last
// successful sync. Requested by the app on returning to the foreground and by
// a 3-hourly backstop sweep, so data stays fresh even when webhooks don't arrive.

export const CATCH_UP_MAX_DAYS = 14;

function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Half-open [startDate, endDate) in YYYY-MM-DD. Starts the day before the
 * last sync's civil date (late-arriving data from that day is picked up),
 * never earlier than 14 days back, and ends after today.
 */
export function catchUpWindow(lastSyncedAt: Date | null, today: string, timeZone: string): { startDate: string; endDate: string } {
  const endDate = shiftDay(today, 1);
  const floor = shiftDay(today, -(CATCH_UP_MAX_DAYS - 1));
  if (!lastSyncedAt) return { startDate: floor, endDate };
  const from = shiftDay(localCivilDate(lastSyncedAt, timeZone), -1);
  return { startDate: from < floor ? floor : from, endDate };
}
