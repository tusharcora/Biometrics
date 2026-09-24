import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SignInScreen } from '../../src/screens/SignInScreen';
import { useAuth } from '../../src/auth/AuthContext';
import { AuthError } from '../../src/auth/authErrors';

jest.mock('../../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../src/auth/useGoogleIdToken', () => ({ useGoogleIdToken: () => ({ prompt: jest.fn(), ready: true }) }));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { EMAIL: 0, FULL_NAME: 1 },
}));

const navigation = { navigate: jest.fn() } as any;
const auth = () => ({
  signInWithApple: jest.fn().mockResolvedValue(undefined),
  signInWithGoogle: jest.fn(),
  signInWithEmail: jest.fn().mockResolvedValue(undefined),
  resendVerification: jest.fn().mockResolvedValue(undefined),
});

it('passes the Apple identity token and full name', async () => {
  const a = auth();
  (useAuth as jest.Mock).mockReturnValue(a);
  (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({ identityToken: 'apple-token', fullName: { givenName: 'Ada', familyName: 'L' } });
  const { getByTestId } = render(<SignInScreen navigation={navigation} route={{ params: undefined } as any} />);
  fireEvent.press(getByTestId('apple-sign-in-button'));
  await waitFor(() => expect(a.signInWithApple).toHaveBeenCalledWith('apple-token', { givenName: 'Ada', familyName: 'L' }));
});

it('signs in with email and password', async () => {
  const a = auth();
  (useAuth as jest.Mock).mockReturnValue(a);
  const { getByTestId } = render(<SignInScreen navigation={navigation} route={{ params: undefined } as any} />);
  fireEvent.changeText(getByTestId('email-input'), 'pat@example.com');
  fireEvent.changeText(getByTestId('password-input'), 'pw123456');
  fireEvent.press(getByTestId('email-sign-in-button'));
  await waitFor(() => expect(a.signInWithEmail).toHaveBeenCalledWith('pat@example.com', 'pw123456'));
});

it('offers to resend the verification email when the address is unverified', async () => {
  const a = auth();
  a.signInWithEmail.mockRejectedValue(new AuthError('EMAIL_NOT_VERIFIED', 'x', 403));
  (useAuth as jest.Mock).mockReturnValue(a);
  const { getByTestId, findByText } = render(<SignInScreen navigation={navigation} route={{ params: undefined } as any} />);
  fireEvent.changeText(getByTestId('email-input'), 'pat@example.com');
  fireEvent.changeText(getByTestId('password-input'), 'pw123456');
  fireEvent.press(getByTestId('email-sign-in-button'));
  await findByText('Confirm your email first. We sent you a link.');
  fireEvent.press(getByTestId('resend-verification-button'));
  await waitFor(() => expect(a.resendVerification).toHaveBeenCalledWith('pat@example.com'));
});

it('shows the verified banner after the email link', () => {
  (useAuth as jest.Mock).mockReturnValue(auth());
  const { getByText } = render(<SignInScreen navigation={navigation} route={{ params: { verified: true } } as any} />);
  expect(getByText('Email confirmed. Sign in to continue.')).toBeTruthy();
});

it('ignores a cancelled Apple sheet', async () => {
  const a = auth();
  (useAuth as jest.Mock).mockReturnValue(a);
  (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(Object.assign(new Error('cancel'), { code: 'ERR_REQUEST_CANCELED' }));
  const { getByTestId, queryByTestId } = render(<SignInScreen navigation={navigation} route={{ params: undefined } as any} />);
  fireEvent.press(getByTestId('apple-sign-in-button'));
  await waitFor(() => expect(queryByTestId('sign-in-error')).toBeNull());
});
