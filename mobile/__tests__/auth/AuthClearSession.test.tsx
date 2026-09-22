import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { setBaseUrl } from '../../src/api/client';

jest.mock('expo-secure-store');

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

function Probe() {
  const { session, clearSession } = useAuth();
  return (
    <>
      <Text testID="status">{session ? 'signed-in' : 'signed-out'}</Text>
      <Button title="clear" onPress={() => void clearSession()} />
    </>
  );
}

beforeEach(() => {
  setBaseUrl('https://api.example.com');
  fetchMock.mockReset();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok');
  (SecureStore.deleteItemAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
});

describe('AuthContext.clearSession', () => {
  // The time zone keys are device-global, so leaving them behind let the next
  // account signed in on this device inherit the previous user's override and
  // skip its own sync (syncTimezone short-circuits on lastSyncedTimezone).
  it('also forgets the device-global time zone state', async () => {
    const { getByTestId, getByText } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-in'));

    fireEvent.press(getByText('clear'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lastSyncedTimezone');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('timezoneOverridden');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('timezoneOverrideZone');
  });

  it('deletes both stored tokens and signs out locally without any network call', async () => {
    const { getByTestId, getByText } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-in'));

    fireEvent.press(getByText('clear'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('accessToken');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refreshToken');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still ends the session when the secure store refuses to delete', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(new Error('keychain locked'));
    const { getByTestId, getByText } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-in'));

    await act(async () => {
      fireEvent.press(getByText('clear'));
    });

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
  });
});
