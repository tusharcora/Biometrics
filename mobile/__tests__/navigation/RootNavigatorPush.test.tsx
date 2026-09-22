import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { apiFetch } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { syncTimezone } from '../../src/lib/timezone';
import { syncPushRegistration } from '../../src/lib/pushRegistration';

jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');
jest.mock('../../src/lib/timezone');
jest.mock('../../src/lib/pushRegistration');

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
  DefaultTheme: { dark: false, colors: {}, fonts: {} },
  DarkTheme: { dark: true, colors: {}, fonts: {} },
}));
jest.mock('@react-navigation/native-stack', () => {
  const ReactLib = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ initialRouteName, children }: any) => {
        const screens = ReactLib.Children.toArray(children);
        const match = screens.find((child: any) => child.props.name === initialRouteName);
        return match ? ReactLib.createElement(match.props.component) : null;
      },
      Screen: () => null,
    }),
  };
});
jest.mock('../../src/screens/SignInScreen', () => ({ SignInScreen: () => null }));
jest.mock('../../src/screens/ConnectHealthScreen', () => ({ ConnectHealthScreen: () => null }));
jest.mock('../../src/screens/DashboardScreen', () => ({ DashboardScreen: () => null }));

function signedIn(signed: boolean) {
  (useAuth as jest.Mock).mockReturnValue({
    session: signed ? { accessToken: 'token' } : null,
    signOut: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (apiFetch as jest.Mock).mockResolvedValue({ status: 'CONNECTED' });
});

describe('RootNavigator: push registration sync', () => {
  it('syncs the push registration once on launch when authenticated', async () => {
    signedIn(true);
    render(<RootNavigator />);

    await waitFor(() => expect(syncPushRegistration).toHaveBeenCalledTimes(1));
    expect(syncTimezone).toHaveBeenCalledTimes(1);
  });

  it('does not sync push when signed out', () => {
    signedIn(false);
    render(<RootNavigator />);
    expect(syncPushRegistration).not.toHaveBeenCalled();
  });
});
