import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../api/client';
import { SignInScreen } from '../screens/SignInScreen';
import { ConnectFitbitScreen } from '../screens/ConnectFitbitScreen';
import { DashboardScreen } from '../screens/DashboardScreen';

export type RootStackParamList = {
  ConnectFitbit: undefined;
  Dashboard: undefined;
};

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session } = useAuth();
  // null while we are still asking the backend which screen to land on.
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

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
          setInitialRoute(res.status === 'CONNECTED' ? 'Dashboard' : 'ConnectFitbit');
        }
      })
      .catch(() => {
        // If we cannot tell, the connect screen is the safe landing spot: it is
        // reachable from a connected state, whereas a frozen dashboard is not.
        if (!cancelled) setInitialRoute('ConnectFitbit');
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
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="ConnectFitbit" component={ConnectFitbitScreen} options={{ title: 'Connect Fitbit' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
});
