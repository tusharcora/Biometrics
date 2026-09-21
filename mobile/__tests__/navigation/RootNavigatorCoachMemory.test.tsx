import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { apiFetch } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { syncTimezone } from '../../src/lib/timezone';

jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');
jest.mock('../../src/lib/timezone');

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  DefaultTheme: { dark: false, colors: {}, fonts: {} },
  DarkTheme: { dark: true, colors: {}, fonts: {} },
}));
const mockRegisteredScreens: string[] = [];
jest.mock('@react-navigation/native-stack', () => {
  const ReactLib = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ initialRouteName, children }: any) => {
        const screens = ReactLib.Children.toArray(children);
        mockRegisteredScreens.splice(0, mockRegisteredScreens.length, ...screens.map((child: any) => child.props.name));
        const match = screens.find((child: any) => child.props.name === initialRouteName);
        return match ? ReactLib.createElement(match.props.component) : null;
      },
      Screen: () => null,
    }),
  };
});

jest.mock('../../src/screens/DashboardScreen', () => {
  const { Text } = require('react-native');
  const ReactLib = require('react');
  return { DashboardScreen: () => ReactLib.createElement(Text, null, 'DASHBOARD_SCREEN') };
});

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: { accessToken: 'token' }, signOut: jest.fn() });
  (apiFetch as jest.Mock).mockResolvedValue({ status: 'CONNECTED', lastSyncedAt: null });
  (syncTimezone as jest.Mock).mockResolvedValue(undefined);
});

describe('RootNavigator: Coach Memory route', () => {
  it('registers the CoachMemory route', async () => {
    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('DASHBOARD_SCREEN')).toBeTruthy());
    expect(mockRegisteredScreens).toEqual(expect.arrayContaining(['CoachMemory']));
  });
});
