import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { SignInScreen } from '../screens/SignInScreen';
import { ConnectFitbitScreen } from '../screens/ConnectFitbitScreen';
import { DashboardScreen } from '../screens/DashboardScreen';

export type RootStackParamList = {
  ConnectFitbit: undefined;
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session } = useAuth();

  if (!session) {
    return <SignInScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="ConnectFitbit">
        <Stack.Screen name="ConnectFitbit" component={ConnectFitbitScreen} options={{ title: 'Connect Fitbit' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
