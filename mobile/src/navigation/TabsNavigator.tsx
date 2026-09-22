import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'nativewind';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { MetricsScreen } from '../screens/MetricsScreen';
import { COLORS } from '../theme';
import { FloatingTabBar } from './FloatingTabBar';

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  // `prefill` seeds the chat input (never sent automatically).
  Coach: { prefill?: string } | undefined;
  Metrics: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabsNavigator() {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground, fontWeight: '600' },
        headerTintColor: colors.foreground,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ title: 'AI Coach' }} />
      <Tab.Screen name="Metrics" component={MetricsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={SettingsScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
