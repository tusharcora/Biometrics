import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { SignInScreen } from '../../src/screens/SignInScreen';
import { useAuth } from '../../src/auth/AuthContext';

jest.mock('../../src/auth/AuthContext');
jest.mock('expo-apple-authentication');
jest.mock('expo-auth-session/providers/google');

describe('SignInScreen', () => {
  it('signs in with Apple when the Apple button is pressed', async () => {
    const signInWithApple = jest.fn().mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ signInWithApple, signInWithGoogle: jest.fn() });
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token' });
    (Google.useAuthRequest as jest.Mock).mockReturnValue([{}, null, jest.fn()]);

    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('apple-sign-in-button'));

    await waitFor(() => expect(signInWithApple).toHaveBeenCalledWith('apple-token'));
  });

  it('calls promptAsync when the Google button is pressed', () => {
    const promptAsync = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ signInWithApple: jest.fn(), signInWithGoogle: jest.fn() });
    (Google.useAuthRequest as jest.Mock).mockReturnValue([{}, null, promptAsync]);

    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('google-sign-in-button'));

    expect(promptAsync).toHaveBeenCalled();
  });

  it('signs in with Google once the auth session response succeeds', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ signInWithApple: jest.fn(), signInWithGoogle });
    (Google.useAuthRequest as jest.Mock).mockReturnValue([
      {},
      { type: 'success', authentication: { idToken: 'google-token' } },
      jest.fn(),
    ]);

    render(<SignInScreen />);

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith('google-token'));
  });
});
