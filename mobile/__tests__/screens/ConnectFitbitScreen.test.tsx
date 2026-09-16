import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { ConnectFitbitScreen } from '../../src/screens/ConnectFitbitScreen';

jest.mock('expo-web-browser');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
});
