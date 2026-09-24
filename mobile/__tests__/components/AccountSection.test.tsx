import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { AccountSection } from '../../src/components/account-section';

it('opens the sign-in methods and devices screens', () => {
  const navigate = jest.fn();
  const { getByTestId } = render(
    <NavigationContext.Provider value={{ navigate } as any}>
      <AccountSection />
    </NavigationContext.Provider>,
  );
  fireEvent.press(getByTestId('sign-in-methods-row'));
  fireEvent.press(getByTestId('devices-row'));
  expect(navigate.mock.calls.map((c) => c[0])).toEqual(['SignInMethods', 'Devices']);
});

it('renders without a navigator (Settings is rendered in isolation in tests)', () => {
  expect(() => render(<AccountSection />)).not.toThrow();
});
