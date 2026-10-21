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
  // RootNavigator hands the container a shared ref (navigation/navigationRef.ts).
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: () => undefined, addListener: () => () => undefined }),
  DefaultTheme: { dark: false, colors: {}, fonts: {} },
  DarkTheme: { dark: true, colors: {}, fonts: {} },
}));
const mockOptions: Record<string, { title?: string; presentation?: string; headerShown?: boolean }> = {};
const mockComponents: Record<string, unknown> = {};
jest.mock('@react-navigation/native-stack', () => {
  const ReactLib = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ initialRouteName, children }: any) => {
        const screens = ReactLib.Children.toArray(children);
        for (const child of screens as any[]) {
          mockOptions[child.props.name] = child.props.options ?? {};
          mockComponents[child.props.name] = child.props.component;
        }
        const match = screens.find((child: any) => child.props.name === initialRouteName);
        return match ? ReactLib.createElement(match.props.component) : null;
      },
      Screen: () => null,
    }),
  };
});

jest.mock('../../src/navigation/TabsNavigator', () => {
  const { Text } = require('react-native');
  const ReactLib = require('react');
  return { TabsNavigator: () => ReactLib.createElement(Text, null, 'TABS_SCREEN') };
});

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ session: { userId: 'u1', email: 'u1@example.com' }, signOut: jest.fn() });
  (apiFetch as jest.Mock).mockResolvedValue({ status: 'CONNECTED', lastSyncedAt: null });
  (syncTimezone as jest.Mock).mockResolvedValue(undefined);
});

// The KIP screens' header titles (spec 2026-10-14 KIP Coach §7.6).
describe('RootNavigator: KIP screen titles', () => {
  it.each([
    ['CoachConsent', 'KIP coaching'],
    ['CoachMemory', 'What KIP remembers'],
    ['ThinkingText', 'While KIP thinks'],
    ['HostedConsent', "KIP's AI engine"],
  ])('%s is titled "%s"', async (name, title) => {
    const { getByText } = render(<RootNavigator />);

    await waitFor(() => expect(getByText('TABS_SCREEN')).toBeTruthy());
    expect(mockOptions[name]?.title).toBe(title);
  });
});

// Visit → Send a gift (T9-FIX carry) and the room card's cheers (spec 2026-10-15 §10.2, §10.3): both registered, as
// sheets with their own Close button.
describe('RootNavigator: the gift and cheers routes', () => {
  it('registers GiftSend and RoomCheers with their screens, as modal sheets', async () => {
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('TABS_SCREEN')).toBeTruthy());
    expect(mockComponents.GiftSend).toBe(require('../../src/screens/GiftSendScreen').GiftSendScreen);
    expect(mockComponents.RoomCheers).toBe(require('../../src/screens/RoomCheersScreen').RoomCheersScreen);
    expect([mockOptions.GiftSend?.presentation, mockOptions.RoomCheers?.presentation]).toEqual(['modal', 'modal']);
  });
});

// The weekly room challenge (spec 2026-10-15 §10.4; ruling 22): full screen, with its own Close (PF4-F16).
describe('RootNavigator: the room challenge route', () => {
  it('registers RoomChallenge with its screen, as a full-screen modal without a header', async () => {
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('TABS_SCREEN')).toBeTruthy());
    expect(mockComponents.RoomChallenge).toBe(require('../../src/screens/RoomChallengeScreen').RoomChallengeScreen);
    expect([mockOptions.RoomChallenge?.presentation, mockOptions.RoomChallenge?.headerShown]).toEqual(['fullScreenModal', false]);
  });
});

// The share card (spec 2026-10-15 §10.5; ruling 23): full screen, with its own Close (PF4-F16).
describe('RootNavigator: the share card route', () => {
  it('registers ShareRoom with its screen, as a full-screen modal without a header', async () => {
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('TABS_SCREEN')).toBeTruthy());
    expect(mockComponents.ShareRoom).toBe(require('../../src/screens/ShareRoomScreen').ShareRoomScreen);
    expect([mockOptions.ShareRoom?.presentation, mockOptions.ShareRoom?.headerShown]).toEqual(['fullScreenModal', false]);
  });
});
