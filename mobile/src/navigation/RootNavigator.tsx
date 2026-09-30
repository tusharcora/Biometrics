import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useColorScheme } from 'nativewind';
import { NavigationContainer, DefaultTheme, DarkTheme, type NavigatorScreenParams, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../auth/AuthContext';
import type { ScoreType } from '../api/scores';
import { AuthNavigator } from './AuthNavigator';
import { ConnectHealthScreen } from '../screens/ConnectHealthScreen';
import { MetricDetailScreen } from '../screens/MetricDetailScreen';
import { ScoreDetailScreen } from '../screens/ScoreDetailScreen';
import { ForecastScreen } from '../screens/ForecastScreen';
import { FORECAST_COPY } from '../lib/forecastCopy';
import { PatternsScreen } from '../screens/PatternsScreen';
import { CoachConsentScreen } from '../screens/CoachConsentScreen';
import { CoachMemoryScreen } from '../screens/CoachMemoryScreen';
import { SignInMethodsScreen } from '../screens/SignInMethodsScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { TabsNavigator, type TabParamList } from './TabsNavigator';
import { syncTimezone } from '../lib/timezone';
import { syncPushRegistration } from '../lib/pushRegistration';
import { COLORS, FONTS } from '../theme';
import { ToastProvider } from '../components/ui/toast';
import { SyncProvider } from '../sync/SyncProvider';
import type { MetricRecord } from '../lib/metricInsights';
import type { TrendRange } from '../lib/metricTrends';

const LIGHT_NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.light.background, card: COLORS.light.background, text: COLORS.light.foreground, border: COLORS.light.border, primary: COLORS.light.accent },
};

const DARK_NAV_THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: COLORS.dark.background, card: COLORS.dark.background, text: COLORS.dark.foreground, border: COLORS.dark.border, primary: COLORS.dark.accent },
};

export type RootStackParamList = {
  // The five-tab shell (Home, Activity, Coach, Metrics, Profile).
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ConnectHealth: undefined;
  // `records` is the metric's whole series; `range` is the window to open on
  // (the Metrics tab passes its current one; default 30 days).
  MetricDetail: { metricType: MetricRecord['metricType']; records: MetricRecord[]; range?: TrendRange };
  ScoreDetail: { date: string; type?: ScoreType }; // type defaults to RECOVERY
  Forecast: undefined;
  Patterns: undefined;
  // Pushed over the tabs. `prefill` is carried through the consent screen.
  CoachConsent: { prefill?: string } | undefined;
  // Reached from Settings -> Coach Memory, which only draws when consented.
  CoachMemory: undefined;
  // Reached from Settings: link or unlink Apple, Google, email + password.
  SignInMethods: undefined;
  // Reached from Settings: signed-in devices, with sign-out per device.
  Devices: undefined;
  // The character picker. 'first' opens by itself on the first Coach-tab
  // visit (starts on Hoot, has Skip); 'switch' comes from Profile.
  MeetYourCoach: { mode: 'first' | 'switch' };
};

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, isPending } = useAuth();
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
    // Same contract: swallows its own failures, only touches users who opted
    // in, and never prompts for permission.
    void syncPushRegistration();
  }, [session]);

  useEffect(() => {
    // Signing in lands on the tabs -- the dashboard -- whatever the connection
    // status is. Connecting Google Health used to be a gate in front of the
    // app: a user who had not connected yet, or whose status could not be
    // read, saw the connect screen and nothing else, with no way to look
    // around first. It is a task you can do from the dashboard's own prompt or
    // from the Profile tab, not a wall.
    setInitialRoute(session ? 'Tabs' : null);
  }, [session]);

  // While the stored session is still resolving, show the loading view rather
  // than flash the sign-in stack (whose NavigationContainer would also consume
  // a cold-start deep link meant for the signed-in app).
  if (!session && !isPending) {
    return <AuthNavigator theme={navTheme} />;
  }

  if (!session || initialRoute === null) {
    return (
      <View style={styles.loading} testID="root-navigator-loading">
        <ActivityIndicator />
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        {/* Signed in only: nothing syncs before sign-in. */}
        <ToastProvider>
          <SyncProvider>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background },
                headerTitleStyle: { color: colors.foreground, fontFamily: FONTS.sansSemibold },
                headerTintColor: colors.foreground,
                // A bare chevron: the parent route's name ("Tabs") is not a place.
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
              <Stack.Screen name="ConnectHealth" component={ConnectHealthScreen} options={{ title: '' }} />
              <Stack.Screen name="MetricDetail" component={MetricDetailScreen} options={{ title: '' }} />
              <Stack.Screen name="ScoreDetail" component={ScoreDetailScreen} options={{ title: 'Score' }} />
              <Stack.Screen name="Forecast" component={ForecastScreen} options={{ title: FORECAST_COPY.title }} />
              <Stack.Screen name="Patterns" component={PatternsScreen} options={{ title: 'Patterns' }} />
              <Stack.Screen name="CoachConsent" component={CoachConsentScreen} options={{ title: 'AI Coach' }} />
              <Stack.Screen name="CoachMemory" component={CoachMemoryScreen} options={{ title: 'Coach Memory' }} />
              <Stack.Screen name="SignInMethods" component={SignInMethodsScreen} options={{ title: 'Sign-in methods' }} />
              <Stack.Screen name="Devices" component={DevicesScreen} options={{ title: 'Devices' }} />
            </Stack.Navigator>
          </SyncProvider>
        </ToastProvider>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
});
