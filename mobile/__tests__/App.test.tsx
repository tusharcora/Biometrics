import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { authClient } from '../src/auth/authClient';
import { fetchCoachStatus } from '../src/api/coach';
import {
  clearCachedThinking,
  purgeCachedCharacter,
  readCachedThinkingText,
  writeCachedThinkingText,
} from '../src/lib/coachStatus/thinkingCache';

// App imports the NativeWind stylesheet, which jest cannot parse.
jest.mock('../global.css', () => ({}));
// The dev gallery draws real Skia art; it is not under test here.
jest.mock('../src/screens/dev/CharacterGalleryScreen', () => ({ CharacterGalleryScreen: () => null }));
// App's one useFonts call: the test reads the families it asks for and decides whether they are in.
const mockUseFonts = jest.fn((_families: Record<string, unknown>) => [true, null] as [boolean, Error | null]);
jest.mock('expo-font', () => ({ useFonts: (families: Record<string, unknown>) => mockUseFonts(families) }));
jest.mock('expo-secure-store');
// AuthContext imports push registration, whose expo-notifications import warns under jest.
jest.mock('../src/lib/pushRegistration', () => ({ disablePush: jest.fn(async () => undefined) }));
jest.mock('../src/lib/coachStatus/thinkingCache');
jest.mock('../src/api/coach', () => ({ ...jest.requireActual('../src/api/coach'), fetchCoachStatus: jest.fn() }));
// The navigator is replaced by a probe that reads the coach status from context,
// which is only possible if App mounts CoachStatusProvider above it.
jest.mock('../src/navigation/RootNavigator', () => {
  const ReactLib = require('react');
  const { Text } = require('react-native');
  const { useCoachStatusContext } = require('../src/lib/coachStatus/CoachStatusProvider');
  return {
    RootNavigator: () => {
      const coach = useCoachStatusContext();
      const label = coach === null ? 'no-provider' : `${coach.status?.consented ? 'consented' : 'none'}:${coach.thinkingText}`;
      return ReactLib.createElement(Text, { testID: 'probe' }, label);
    },
  };
});

const STATUS = {
  enabled: true,
  consented: true,
  consent: { version: 'v1', summary: 's', dataItems: [] },
  personaId: 'kip',
  personaChosen: true,
  personas: [],
  thinkingText: 'typewriter',
};

beforeEach(() => {
  mockUseFonts.mockImplementation(() => [true, null]);
  jest.clearAllMocks();
  (readCachedThinkingText as jest.Mock).mockResolvedValue(null);
  (writeCachedThinkingText as jest.Mock).mockResolvedValue(undefined);
  (clearCachedThinking as jest.Mock).mockResolvedValue(undefined);
  (purgeCachedCharacter as jest.Mock).mockResolvedValue(undefined);
});

describe('App', () => {
  it('still renders the app if a font fails to load, so the splash never hangs', () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });
    mockUseFonts.mockImplementation(() => [false, new Error('x')]);

    const { toJSON } = render(<App />);

    expect(toJSON()).not.toBeNull();
  });

  it('waits for Silkscreen with Geist before anything draws', () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });
    mockUseFonts.mockImplementation(() => [false, null]);

    const { toJSON } = render(<App />);

    // The splash stays up: no frame of the app (and so no pixel title) draws in a stand-in face.
    expect(toJSON()).toBeNull();
    expect(mockUseFonts).toHaveBeenCalled();
    // Every call is the awaited one: Silkscreen is not loaded on the side any more.
    for (const [families] of mockUseFonts.mock.calls) {
      expect(Object.keys(families)).toEqual(expect.arrayContaining(['Geist_400Regular', 'Geist_600SemiBold', 'Silkscreen']));
    }
  });

  it('mounts CoachStatusProvider inside AuthProvider, around the navigator', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'u1', email: 'u1@example.com' } }, isPending: false, error: null });
    (fetchCoachStatus as jest.Mock).mockResolvedValue(STATUS);

    const { getByTestId } = render(<App />);

    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('consented:typewriter'));
    expect(purgeCachedCharacter).toHaveBeenCalledTimes(1);
  });

  it('shows the default thinking text and clears the cache while signed out', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });

    const { getByTestId } = render(<App />);

    await waitFor(() => expect(clearCachedThinking).toHaveBeenCalled());
    expect(getByTestId('probe')).toHaveTextContent('none:steps');
    expect(fetchCoachStatus).not.toHaveBeenCalled();
  });

  // The real AuthProvider feeds the provider here (the provider's own tests
  // mock the auth hook), so this covers the session going away as the app sees it.
  it('drops the status and clears the cache when the user signs out', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'u1', email: 'u1@example.com' } }, isPending: false, error: null });
    (fetchCoachStatus as jest.Mock).mockResolvedValue(STATUS);

    const { getByTestId, rerender } = render(<App />);
    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('consented:typewriter'));
    expect(writeCachedThinkingText).toHaveBeenCalledWith('typewriter');
    expect(clearCachedThinking).not.toHaveBeenCalled();

    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });
    rerender(<App />);

    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('none:steps'));
    expect(clearCachedThinking).toHaveBeenCalledTimes(1);
    expect(fetchCoachStatus).toHaveBeenCalledTimes(1);
  });
});
