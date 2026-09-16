import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { ConnectFitbitScreen } from '../../src/screens/ConnectFitbitScreen';
import { apiFetch } from '../../src/api/client';

jest.mock('expo-web-browser');
jest.mock('../../src/api/client');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const AUTHORIZE_URL = 'https://fitbit.example/authorize?state=abc';

beforeEach(() => {
  jest.clearAllMocks();
  (apiFetch as jest.Mock).mockResolvedValue({ url: AUTHORIZE_URL });
});

describe('ConnectFitbitScreen', () => {
  it('opens the Fitbit auth session and navigates to Dashboard on success', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'biometrics://fitbit/callback?status=connected',
    });

    const { getByTestId } = render(<ConnectFitbitScreen />);
    fireEvent.press(getByTestId('connect-fitbit-button'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Dashboard'));
  });

  it('fetches the authorize URL over the authenticated API and opens that URL', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'biometrics://fitbit/callback?status=connected',
    });

    const { getByTestId } = render(<ConnectFitbitScreen />);
    fireEvent.press(getByTestId('connect-fitbit-button'));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/fitbit/authorize'));
    // The browser must be pointed at the URL the backend returned, never at
    // our own authenticated /fitbit/authorize endpoint.
    await waitFor(() =>
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        AUTHORIZE_URL,
        'biometrics://fitbit/callback',
      ),
    );
  });

  it('does not navigate when the user dismisses the auth session', async () => {
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'dismiss' });

    const { getByTestId } = render(<ConnectFitbitScreen />);
    fireEvent.press(getByTestId('connect-fitbit-button'));

    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
