import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { colorScheme } from 'nativewind';
import { ThemeToggle } from '../../src/components/ui/theme-toggle';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

jest.mock('expo-secure-store');
jest.mock('nativewind', () => ({
  colorScheme: { set: jest.fn() },
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ThemeToggle', () => {
  it('cycles system -> light -> dark and persists each choice', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeToggle color="#000" />
      </ThemeProvider>,
    );

    await waitFor(() => expect(colorScheme.set).toHaveBeenCalledWith('system'));

    fireEvent.press(getByTestId('theme-toggle-button'));
    await waitFor(() => expect(colorScheme.set).toHaveBeenCalledWith('light'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('themePreference', 'light');

    fireEvent.press(getByTestId('theme-toggle-button'));
    await waitFor(() => expect(colorScheme.set).toHaveBeenCalledWith('dark'));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('themePreference', 'dark');
  });

  it('restores a previously persisted preference on mount', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('dark');

    render(
      <ThemeProvider>
        <ThemeToggle color="#000" />
      </ThemeProvider>,
    );

    await waitFor(() => expect(colorScheme.set).toHaveBeenCalledWith('dark'));
  });
});
