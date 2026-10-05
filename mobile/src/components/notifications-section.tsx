import React, { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { useColorScheme } from 'nativewind';
import { fetchNotificationSettings, saveNotificationSettings } from '../api/notifications';
import { enablePush, getPushState, type PushState } from '../lib/pushRegistration';
import { COLORS } from '../theme';
import { Text } from './ui/text';
import { SettingsGroup, SettingsRow } from './ui/settings-list';

const DENIED = 'Notifications are blocked — enable them in system settings';
const FAILED = 'Your recap setting could not be saved. Please try again.';

// The app-level "Recap ready" switch (spec 2026-10-04 §2), shown whenever this device can show
// notifications, with the coach on or off. On: register this device (enablePush, the only place
// that may prompt; a denied permission is never re-prompted), then save recapPushEnabled. Off:
// save the setting only; the device stays registered.
export function NotificationsSection() {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [push, setPush] = useState<PushState | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [state, settings] = await Promise.all([
        getPushState().catch((): PushState => ({ status: 'unavailable', reason: 'unknown_error' })),
        fetchNotificationSettings().catch(() => null),
      ]);
      if (cancelled) return;
      setPush(state);
      setEnabled(settings?.recapPushEnabled ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!push || push.status === 'unavailable') return null;

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (next) {
        const registered = await enablePush();
        setPush(registered);
        if (registered.status !== 'on') return;
      }
      const saved = await saveNotificationSettings({ recapPushEnabled: next });
      setEnabled(saved.recapPushEnabled);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const on = enabled === true && push.status === 'on';
  const message = failed || push.status === 'error' ? FAILED : push.status === 'denied' ? DENIED : null;

  return (
    <SettingsGroup testID="notifications-settings" label="Notifications">
      <SettingsRow
        testID="recap-ready-row"
        icon="notifications-outline"
        tint={colors.metricSleep}
        title="Recap ready"
        subtitle="A nudge when your weekly or monthly recap is ready"
        trailing={
          <Switch
            testID="recap-ready-toggle"
            accessibilityLabel="Recap ready notifications"
            value={on}
            disabled={busy}
            onValueChange={(next) => void toggle(next)}
            trackColor={{ true: colors.accent }}
          />
        }
      />
      {message ? (
        <Text
          testID="recap-ready-message"
          className={message === FAILED ? 'px-4 pb-3 text-sm text-destructive' : 'px-4 pb-3 text-xs text-muted-foreground'}
        >
          {message}
        </Text>
      ) : null}
    </SettingsGroup>
  );
}
