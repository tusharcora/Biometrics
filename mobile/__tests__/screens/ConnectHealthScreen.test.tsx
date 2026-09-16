import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { ConnectHealthScreen } from '../../src/screens/ConnectHealthScreen';
import { apiFetch } from '../../src/api/client';

jest.mock('expo-web-browser');
jest.mock('../../src/api/client');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('ConnectHealthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the authorize URL and navigates to Dashboard on success', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'biometrics://health/callback?status=connected',
    });

    const { getByTestId } = render(<ConnectHealthScreen />);
    fireEvent.press(getByTestId('connect-health-button'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Dashboard'));
    expect(apiFetch).toHaveBeenCalledWith('/health/authorize');
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?state=abc',
      'biometrics://health/callback',
    );
  });

  it('does not navigate when the user dismisses the auth session', async () => {
    (apiFetch as jest.Mock).mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=abc' });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'dismiss' });

    const { getByTestId } = render(<ConnectHealthScreen />);
    fireEvent.press(getByTestId('connect-health-button'));

    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
