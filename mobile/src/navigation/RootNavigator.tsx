import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useColorScheme } from 'nativewind';
import { NavigationContainer, DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';
import type { ScoreType } from '../api/scores';
import { SignInScreen } from '../screens/SignInScreen';
import { ConnectHealthScreen } from '../screens/ConnectHealthScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MetricDetailScreen } from '../screens/MetricDetailScreen';
import { ScoreDetailScreen } from '../screens/ScoreDetailScreen';
import { PatternsScreen } from '../screens/PatternsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { CoachConsentScreen } from '../screens/CoachConsentScreen';
import { syncTimezone } from '../lib/timezone';
import { COLORS } from '../theme';
import type { MetricRecord } from '../lib/metricInsights';

const LIGHT_NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.light.background, card: COLORS.light.background, text: COLORS.light.foreground, border: COLORS.light.border, primary: COLORS.light.accent },
};

const DARK_NAV_THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: COLORS.dark.background, card: COLORS.dark.background, text: COLORS.dark.foreground, border: COLORS.dark.border, primary: COLORS.dark.accent },
};

export type RootStackParamList = {
  ConnectHealth: undefined;
  Dashboard: undefined;
  MetricDetail: { metricType: MetricRecord['metricType']; records: MetricRecord[] };
  ScoreDetail: { date: string; type?: ScoreType }; // type defaults to RECOVERY
  Patterns: undefined;
  Settings: undefined;
  // Only ever navigated to from an entry point that is drawn when the server
  // reports the coach enabled. `prefill` seeds the chat input (never sent
  // automatically) and is carried through the consent screen.
  Coach: { prefill?: string } | undefined;
  CoachConsent: { prefill?: string } | undefined;
};

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session } = useAuth();
  const { colorScheme: scheme } = useColorScheme();
  const navTheme = scheme === 'dark' ? DARK_NAV_THEME : LIGHT_NAV_THEME;
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  // null while we are still asking the backend which screen to land on.
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    if (!session) return;
    // Fire-and-forget: syncTimezone swallows its own failures and must never
    // hold up the first screen. Runs once per authenticated launch/sign-in.
    void syncTimezone();
  }, [session]);

  useEffect(() => {
    if (!session) {
      setInitialRoute(null);
      return;
    }

    let cancelled = false;
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => {
        if (!cancelled) {
          // An already-connected user should not be stranded on the connect
          // screen every time they open the app.
          setInitialRoute(res.status === 'CONNECTED' ? 'Dashboard' : 'ConnectHealth');
        }
      })
      .catch(() => {
        // If we cannot tell, the connect screen is the safe landing spot: it is
        // reachable from a connected state, whereas a frozen dashboard is not.
        if (!cancelled) setInitialRoute('ConnectHealth');
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return <SignInScreen />;
  }

  if (initialRoute === null) {
    return (
      <View style={styles.loading} testID="root-navigator-loading">
        <ActivityIndicator />
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.foreground, fontWeight: '600' },
          headerTintColor: colors.foreground,
        }}
      >
        <Stack.Screen name="ConnectHealth" component={ConnectHealthScreen} options={{ title: 'Connect Health' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="MetricDetail" component={MetricDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="ScoreDetail" component={ScoreDetailScreen} options={{ title: 'Score' }} />
        <Stack.Screen name="Patterns" component={PatternsScreen} options={{ title: 'Patterns' }} />
        <Stack.Screen name="Settings"component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="Coach" component={CoachScreen} options={{ title: 'AI Coach' }} />
        <Stack.Screen name="CoachConsent" component={CoachConsentScreen} options={{ title: 'AI Coach' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
});
