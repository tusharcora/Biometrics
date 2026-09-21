import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../api/client';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { syncTimezone } from '../lib/timezone';

const REDIRECT_URI = 'biometrics://health/callback';

function connectErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  // The API client has already ended the session and the app is heading back to
  // sign-in; say why instead of showing a generic failure.
  if (/session expired/i.test(message)) return 'Your session expired. Please sign in again.';
  return "We couldn't connect Google Health. Please try again.";
}

export function ConnectHealthScreen() {
  const navigation = useNavigation<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // /health/authorize is authenticated and returns the Google Health URL as JSON
      // (apiFetch attaches the token). We cannot point the system browser at it
      // directly, because a browser navigation carries no Authorization header.
      const { url } = await apiFetch<{ url: string }>('/health/authorize');
      const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
      if (result.type === 'success') {
        if (result.url.includes('status=connected')) {
          // Capture the zone the backend will use for day-bucketing. Not awaited:
          // it swallows its own failures and must not delay landing on the dashboard.
          void syncTimezone();
          navigation.navigate('Tabs');
        } else {
          // The browser came back to the app, but not with a success status.
          setError("Google Health didn't finish connecting. Please try again.");
        }
      }
      // A dismissed or cancelled browser is the user's choice, not an error.
    } catch (err) {
      setError(connectErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-3 p-8">
        <Text className="text-center text-2xl font-bold">Connect your Google Health</Text>
        <Text className="text-center text-muted-foreground">
          We'll sync your steps, sleep, resting heart rate, and HRV automatically.
        </Text>
        {error ? (
          <Text testID="connect-health-error" className="text-center text-muted-foreground">
            {error}
          </Text>
        ) : null}
        <Button testID="connect-health-button" className="mt-4" onPress={handleConnect} disabled={busy}>
          Connect Google Health
        </Button>
      </View>
    </SafeAreaView>
  );
}
