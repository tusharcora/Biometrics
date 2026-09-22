import React, { useEffect, useState } from 'react';
import { View, Switch } from 'react-native';
import { useColorScheme } from 'nativewind';
import { disablePush, enablePush, getPushState, type PushState } from '../lib/pushRegistration';
import { COLORS } from '../theme';
import { Text } from './ui/text';

const MESSAGES: Partial<Record<PushState['status'], string>> = {
  denied: 'Notifications are blocked — enable them in system settings',
  unavailable: "Notifications aren't available in this build",
  error: 'Notifications could not be turned on. Please try again.',
};

// The weekly recap notification toggle. Rendered only inside the consented
// coach card, so push follows the same gating as the rest of the coach UI. The
// system permission prompt is only ever raised from this toggle.
export function PushNotificationsRow() {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [state, setState] = useState<PushState>({ status: 'off' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPushState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      setState(next ? await enablePush() : await disablePush());
    } catch {
      setState({ status: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const message = MESSAGES[state.status];

  return (
    <View testID="push-notifications" className="gap-1">
      <View className="flex-row items-center gap-3 py-2">
        <View className="flex-1">
          <Text className="font-medium">Weekly recap notifications</Text>
          <Text className="text-xs text-muted-foreground">A nudge when your weekly coach recap is ready</Text>
        </View>
        <Switch
          testID="push-toggle"
          accessibilityLabel="Weekly recap notifications"
          value={state.status === 'on'}
          disabled={busy}
          onValueChange={(next) => void toggle(next)}
          trackColor={{ true: colors.accent }}
        />
      </View>
      {message ? (
        <Text testID="push-message" className={state.status === 'error' ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
