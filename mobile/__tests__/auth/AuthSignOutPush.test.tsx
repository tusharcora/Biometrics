import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';
import { apiFetch } from '../../src/api/client';
import { disablePush } from '../../src/lib/pushRegistration';

jest.mock('expo-secure-store');
jest.mock('../../src/api/client', () => ({
  apiFetch: jest.fn(),
  onSessionExpired: jest.fn(() => () => undefined),
}));
jest.mock('../../src/lib/pushRegistration');

function Consumer() {
  const { session, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{session ? 'signed-in' : 'signed-out'}</Text>
      <Button title="sign out" onPress={() => void signOut()} />
    </>
  );
}

async function renderSignedIn() {
  const utils = render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
  await waitFor(() => expect(utils.getByTestId('status').props.children).toBe('signed-in'));
  return utils;
}

let order: string[];

beforeEach(() => {
  jest.clearAllMocks();
  order = [];
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok');
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(() => {
    order.push('clear');
    return Promise.resolve();
  });
  (apiFetch as jest.Mock).mockResolvedValue(undefined);
  (disablePush as jest.Mock).mockImplementation(() => {
    order.push('unregister');
    return Promise.resolve({ status: 'off' });
  });
});

describe('signOut and the push token', () => {
  it('unregisters the push token before the session is cleared', async () => {
    const { getByText, getByTestId } = await renderSignedIn();

    fireEvent.press(getByText('sign out'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
    expect(disablePush).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe('unregister');
    expect(order).toContain('clear');
  });

  it('still signs out when unregistering rejects', async () => {
    (disablePush as jest.Mock).mockRejectedValue(new Error('offline'));
    const { getByText, getByTestId } = await renderSignedIn();

    fireEvent.press(getByText('sign out'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('signed-out'));
    expect(apiFetch).toHaveBeenCalledWith('/auth/signout', expect.anything());
  });

  it('does not wait on a slow unregister for long', async () => {
    jest.useFakeTimers();
    try {
      (disablePush as jest.Mock).mockReturnValue(new Promise(() => undefined));
      const { getByText, getByTestId } = await renderSignedIn();

      fireEvent.press(getByText('sign out'));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });

      expect(getByTestId('status').props.children).toBe('signed-out');
    } finally {
      jest.useRealTimers();
    }
  });
});
