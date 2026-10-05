import { apiFetch } from './client';

// App-level notification settings (spec 2026-10-04 §2), independent of the coach.
export interface NotificationSettings {
  recapPushEnabled: boolean;
}

// The server's default (on) when it has no settings yet: a 404 from a server older than this
// endpoint, or a body without a boolean. Any other failure throws.
export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  let res: { recapPushEnabled?: unknown } | undefined;
  try {
    res = await apiFetch<{ recapPushEnabled?: unknown } | undefined>('/me/notifications');
  } catch (error) {
    if ((error as { status?: number } | null)?.status === 404) return { recapPushEnabled: true };
    throw error;
  }
  return { recapPushEnabled: typeof res?.recapPushEnabled === 'boolean' ? res.recapPushEnabled : true };
}

export function saveNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/me/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
