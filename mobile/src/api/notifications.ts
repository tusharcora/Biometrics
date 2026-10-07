import { apiFetch } from './client';

// App-level notification settings (spec 2026-10-04 §2; buddy keys: spec 2026-10-06 buddies §6),
// independent of the coach.
export interface NotificationSettings {
  recapPushEnabled: boolean;
  notifyBuddyStickers: boolean;
  notifyBuddyRequests: boolean;
  notifyBuddyBadges: boolean;
}

export type NotificationKey = keyof NotificationSettings;
const KEYS: readonly NotificationKey[] = ['recapPushEnabled', 'notifyBuddyStickers', 'notifyBuddyRequests', 'notifyBuddyBadges'];

type RawSettings = Partial<Record<NotificationKey, unknown>> | undefined;

// The server's default (on) for any key without a boolean: an older server knows only
// recapPushEnabled (or has no settings yet).
function withDefaults(res: RawSettings): NotificationSettings {
  return Object.fromEntries(KEYS.map((key) => [key, typeof res?.[key] === 'boolean' ? res[key] : true])) as unknown as NotificationSettings;
}

// A 404 from a server older than this endpoint reads as every default. Any other failure throws.
export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  let res: RawSettings;
  try {
    res = await apiFetch<RawSettings>('/me/notifications');
  } catch (error) {
    if ((error as { status?: number } | null)?.status !== 404) throw error;
  }
  return withDefaults(res);
}

export async function saveNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const res = await apiFetch<RawSettings>('/me/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return withDefaults(res);
}
