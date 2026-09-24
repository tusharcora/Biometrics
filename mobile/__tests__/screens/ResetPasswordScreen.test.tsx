import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ResetPasswordScreen } from '../../src/screens/ResetPasswordScreen';
import { useAuth } from '../../src/auth/AuthContext';
import { AuthError } from '../../src/auth/authErrors';

jest.mock('../../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const navigation = { navigate: jest.fn() } as any;

it('resets with the token from the deep link and returns to sign-in', async () => {
  const resetPassword = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ resetPassword });
  const { getByTestId } = render(<ResetPasswordScreen navigation={navigation} route={{ params: { token: 'tok' } } as any} />);
  fireEvent.changeText(getByTestId('password-input'), 'new password 1');
  fireEvent.press(getByTestId('reset-password-button'));
  await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('tok', 'new password 1'));
  expect(navigation.navigate).toHaveBeenCalledWith('SignIn', undefined);
});

it('explains an expired link', async () => {
  (useAuth as jest.Mock).mockReturnValue({ resetPassword: jest.fn().mockRejectedValue(new AuthError('INVALID_TOKEN', 'x', 400)) });
  const { getByTestId, findByText } = render(<ResetPasswordScreen navigation={navigation} route={{ params: { token: 'old' } } as any} />);
  fireEvent.changeText(getByTestId('password-input'), 'new password 1');
  fireEvent.press(getByTestId('reset-password-button'));
  await findByText('This link has expired. Ask for a new one.');
});

it('without a token, sends the user to ask for a new link', () => {
  (useAuth as jest.Mock).mockReturnValue({ resetPassword: jest.fn() });
  const { getByText } = render(<ResetPasswordScreen navigation={navigation} route={{ params: undefined } as any} />);
  expect(getByText('This link has expired. Ask for a new one.')).toBeTruthy();
});
