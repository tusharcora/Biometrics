import { apiFetch } from './client';

// App-level notification settings (spec 2026-10-04 §2), independent of the coach.
export interface NotificationSettings {
  recapPushEnabled: boolean;
}

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/me/notifications');
}

export function saveNotificationSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/me/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
