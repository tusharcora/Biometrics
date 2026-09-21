import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../api/client';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { syncTimezone } from '../lib/timezone';

const REDIRECT_URI = 'biometrics://health/callback';

export function ConnectHealthScreen() {
  const navigation = useNavigation<any>();

  async function handleConnect() {
    // /health/authorize is authenticated and returns the Google Health URL as JSON
    // (apiFetch attaches the token). We cannot point the system browser at it
    // directly, because a browser navigation carries no Authorization header.
    const { url } = await apiFetch<{ url: string }>('/health/authorize');
    const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
    if (result.type === 'success' && result.url.includes('status=connected')) {
      // Capture the zone the backend will use for day-bucketing. Not awaited:
      // it swallows its own failures and must not delay landing on the dashboard.
      void syncTimezone();
      navigation.navigate('Dashboard');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-3 p-8">
        <Text className="text-center text-2xl font-bold">Connect your Google Health</Text>
        <Text className="text-center text-muted-foreground">
          We'll sync your steps, sleep, resting heart rate, and HRV automatically.
        </Text>
        <Button testID="connect-health-button" className="mt-4" onPress={handleConnect}>
          Connect Google Health
        </Button>
      </View>
    </SafeAreaView>
  );
}
