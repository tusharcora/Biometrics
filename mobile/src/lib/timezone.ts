import * as SecureStore from 'expo-secure-store';
import { updateTimezone } from '../api/client';

// Persisted with SecureStore, like the rest of the app's small local state
// (see theme/preference.ts).
const LAST_SYNCED_KEY = 'lastSyncedTimezone';
const OVERRIDDEN_KEY = 'timezoneOverridden';
const OVERRIDE_ZONE_KEY = 'timezoneOverrideZone';

export interface TimezoneState {
  timezone: string;
  overridden: boolean;
}

const FALLBACK_ZONES = [
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Chicago',
  'America/Denver', 'America/Halifax', 'America/Los_Angeles', 'America/Mexico_City',
  'America/New_York', 'America/Phoenix', 'America/Sao_Paulo', 'America/St_Johns',
  'America/Toronto', 'America/Vancouver',
  'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Manila', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Dublin', 'Europe/Istanbul', 'Europe/London',
  'Europe/Madrid', 'Europe/Moscow', 'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Zurich',
  'Pacific/Auckland', 'Pacific/Honolulu',
  'UTC',
];

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Intl.supportedValuesOf is not available in every JS engine (older Hermes
// builds lack it), so fall back to a short list of common zones.
export function listTimeZones(): string[] {
  let zones: string[] = FALLBACK_ZONES;
  try {
    const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
    if (supported && supported.length > 0) {
      zones = supported.includes('UTC') ? supported : [...supported, 'UTC'];
    }
  } catch {
    // keep the fallback
  }
  return [...new Set(zones)].sort();
}

export async function getTimezoneState(): Promise<TimezoneState> {
  const overridden = (await SecureStore.getItemAsync(OVERRIDDEN_KEY)) === 'true';
  const overrideZone = overridden ? await SecureStore.getItemAsync(OVERRIDE_ZONE_KEY) : null;
  if (overridden && overrideZone) return { timezone: overrideZone, overridden: true };
  return { timezone: getDeviceTimeZone(), overridden: false };
}

// Sends the effective zone (an explicit override wins over the device zone)
// only when it differs from the last value the server confirmed. Never throws:
// a failed send leaves the stored value untouched, so the next launch retries.
export async function syncTimezone(): Promise<void> {
  try {
    const { timezone } = await getTimezoneState();
    const lastSynced = await SecureStore.getItemAsync(LAST_SYNCED_KEY);
    if (lastSynced === timezone) return;
    await updateTimezone(timezone);
    await SecureStore.setItemAsync(LAST_SYNCED_KEY, timezone);
  } catch (error) {
    console.warn('Time zone sync failed; will retry on next launch', error);
  }
}

export async function setTimezoneOverride(timezone: string): Promise<void> {
  if (!isValidTimeZone(timezone)) throw new Error(`Invalid time zone: ${timezone}`);
  await SecureStore.setItemAsync(OVERRIDE_ZONE_KEY, timezone);
  await SecureStore.setItemAsync(OVERRIDDEN_KEY, 'true');
  await syncTimezone();
}

export async function clearTimezoneOverride(): Promise<void> {
  await SecureStore.deleteItemAsync(OVERRIDDEN_KEY);
  await SecureStore.deleteItemAsync(OVERRIDE_ZONE_KEY);
  await syncTimezone();
}
