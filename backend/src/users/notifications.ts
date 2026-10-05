/** App-level notification settings (spec 2026-10-04 §2). */
export interface NotificationSettings {
  recapPushEnabled: boolean;
}

/** A non-empty patch of known keys with boolean values, else null (→ 400 invalid_settings). */
export function parseNotificationSettingsPatch(body: unknown): Partial<NotificationSettings> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) return null;
  const out: Partial<NotificationSettings> = {};
  for (const [key, value] of entries) {
    if (key !== 'recapPushEnabled' || typeof value !== 'boolean') return null;
    out.recapPushEnabled = value;
  }
  return out;
}
