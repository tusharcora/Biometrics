import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../App';
import { authClient } from '../src/auth/authClient';
import { fetchCoachStatus } from '../src/api/coach';
import {
  clearCachedCharacter,
  readCachedCharacter,
  readCachedThinking,
  writeCachedCharacter,
  writeCachedThinking,
} from '../src/characters/characterCache';

// App imports the NativeWind stylesheet, which jest cannot parse.
jest.mock('../global.css', () => ({}));
// The dev gallery draws real Skia art; it is not under test here.
jest.mock('../src/screens/dev/CharacterGalleryScreen', () => ({ CharacterGalleryScreen: () => null }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-secure-store');
// AuthContext imports push registration, whose expo-notifications import warns under jest.
jest.mock('../src/lib/pushRegistration', () => ({ disablePush: jest.fn(async () => undefined) }));
jest.mock('../src/characters/characterCache');
jest.mock('../src/api/coach', () => ({ ...jest.requireActual('../src/api/coach'), fetchCoachStatus: jest.fn() }));
jest.mock('../src/api/scores', () => ({ fetchScoresWithBands: jest.fn(async () => ({ scores: [], bands: undefined })) }));
// The navigator is replaced by a probe that reads the character from context,
// which is only possible if App mounts CharacterProvider above it.
jest.mock('../src/navigation/RootNavigator', () => {
  const ReactLib = require('react');
  const { Text } = require('react-native');
  const { useCharacter } = require('../src/characters/CharacterProvider');
  return {
    RootNavigator: () => ReactLib.createElement(Text, { testID: 'probe' }, useCharacter().characterId),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  (readCachedCharacter as jest.Mock).mockResolvedValue(null);
  (writeCachedCharacter as jest.Mock).mockResolvedValue(undefined);
  (clearCachedCharacter as jest.Mock).mockResolvedValue(undefined);
  (readCachedThinking as jest.Mock).mockResolvedValue(null);
  (writeCachedThinking as jest.Mock).mockResolvedValue(undefined);
});

describe('App', () => {
  it('mounts CharacterProvider inside AuthProvider, around the navigator', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'u1', email: 'u1@example.com' } }, isPending: false, error: null });
    (fetchCoachStatus as jest.Mock).mockResolvedValue({
      enabled: true,
      consented: true,
      consent: { version: 'v1', summary: 's', dataItems: [] },
      personaId: 'kit',
      personaChosen: true,
      personas: [],
    });

    const { getByTestId } = render(<App />);

    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('kit'));
  });

  it('shows Mochi and clears the cached character while signed out', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });

    const { getByTestId } = render(<App />);

    await waitFor(() => expect(clearCachedCharacter).toHaveBeenCalled());
    expect(getByTestId('probe')).toHaveTextContent('mochi');
    expect(fetchCoachStatus).not.toHaveBeenCalled();
  });

  // The real AuthProvider feeds the provider here (the provider's own tests
  // mock the auth hook), so this covers the session going away as the app sees it.
  it('goes back to Mochi and clears the cached character when the user signs out', async () => {
    (authClient.useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'u1', email: 'u1@example.com' } }, isPending: false, error: null });
    (fetchCoachStatus as jest.Mock).mockResolvedValue({
      enabled: true,
      consented: true,
      consent: { version: 'v1', summary: 's', dataItems: [] },
      personaId: 'kit',
      personaChosen: true,
      personas: [],
    });

    const { getByTestId, rerender } = render(<App />);
    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('kit'));
    expect(writeCachedCharacter).toHaveBeenCalledWith('kit');
    expect(clearCachedCharacter).not.toHaveBeenCalled();

    (authClient.useSession as jest.Mock).mockReturnValue({ data: null, isPending: false, error: null });
    rerender(<App />);

    await waitFor(() => expect(getByTestId('probe')).toHaveTextContent('mochi'));
    expect(clearCachedCharacter).toHaveBeenCalledTimes(1);
    expect(fetchCoachStatus).toHaveBeenCalledTimes(1);
  });
});
