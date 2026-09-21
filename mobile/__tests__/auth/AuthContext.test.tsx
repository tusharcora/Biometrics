import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { apiFetch, setBaseUrl } from '../../src/api/client';

jest.mock('expo-secure-store');

function TestConsumer() {
  const { session, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{session ? 'signed-in' : 'signed-out'}</Text>
      <Button title="sign out" onPress={signOut} />
    </>
  );
}

beforeEach(() => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('AuthContext', () => {
  it('starts signed out when no stored session exists', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
  });

  // Regression: after pointing the app at a different backend the stored
  // tokens are rejected, the refresh fails, and the user used to be stranded on
  // a screen with a raw "Session expired" error. The app must go back to
  // sign-in on its own.
  it('signs the user out when the API layer reports an expired session', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('stale-token');
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    setBaseUrl('https://api.example.com');

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-in'));

    await act(async () => {
      await apiFetch('/me/scores').catch(() => undefined);
    });

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
  });
});
