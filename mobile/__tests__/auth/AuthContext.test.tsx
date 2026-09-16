import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../../src/auth/AuthContext';

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
});
