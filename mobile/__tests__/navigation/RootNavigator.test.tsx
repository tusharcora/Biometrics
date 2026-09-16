import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../../src/navigation/RootNavigator';
import { apiFetch } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';

jest.mock('../../src/api/client');
jest.mock('../../src/auth/AuthContext');

// The real native stack pulls in react-native-safe-area-context, which this
// project does not install. Stub the navigator down to "render whichever screen
// initialRouteName points at" — which is precisely what these tests assert.
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
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

jest.mock('../../src/screens/SignInScreen', () => {
  const { Text } = require('react-native');
  const ReactLib = require('react');
  return { SignInScreen: () => ReactLib.createElement(Text, null, 'SIGN_IN_SCREEN') };
});
jest.mock('../../src/screens/ConnectFitbitScreen', () => {
  const { Text } = require('react-native');
  const ReactLib = require('react');
  return { ConnectFitbitScreen: () => ReactLib.createElement(Text, null, 'CONNECT_SCREEN') };
});
jest.mock('../../src/screens/DashboardScreen', () => {
  const { Text } = require('react-native');
  const ReactLib = require('react');
  return { DashboardScreen: () => ReactLib.createElement(Text, null, 'DASHBOARD_SCREEN') };
});

function signedIn(signed: boolean) {
  (useAuth as jest.Mock).mockReturnValue({
    session: signed ? { accessToken: 'token' } : null,
    signInWithApple: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RootNavigator', () => {
  it('shows the sign-in screen when there is no session', () => {
    signedIn(false);

    const { getByText } = render(<RootNavigator />);

    expect(getByText('SIGN_IN_SCREEN')).toBeTruthy();
  });

  // The old navigator hardcoded ConnectFitbit, so an already-connected user had
  // no route back to their dashboard.
  it('lands a connected user on the Dashboard', async () => {
    signedIn(true);
    (apiFetch as jest.Mock).mockResolvedValue({ status: 'CONNECTED', lastSyncedAt: null });

    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('DASHBOARD_SCREEN')).toBeTruthy());
    expect(apiFetch).toHaveBeenCalledWith('/me/connection');
  });

  it('lands a never-connected user on the connect screen', async () => {
    signedIn(true);
    (apiFetch as jest.Mock).mockResolvedValue({ status: 'NOT_CONNECTED', lastSyncedAt: null });

    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('CONNECT_SCREEN')).toBeTruthy());
  });

  it('lands a disconnected user on the connect screen', async () => {
    signedIn(true);
    (apiFetch as jest.Mock).mockResolvedValue({ status: 'DISCONNECTED', lastSyncedAt: null });

    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('CONNECT_SCREEN')).toBeTruthy());
  });

  it('falls back to the connect screen when the status lookup fails', async () => {
    signedIn(true);
    (apiFetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('CONNECT_SCREEN')).toBeTruthy());
  });
});
