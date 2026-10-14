import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { KipSettingsSection } from '../../src/components/kip-settings-section';

// Many screen tests stub @react-navigation/native without a NavigationContext.
// Profile (and so the KIP group) must still render under such a stub.
jest.mock('@react-navigation/native', () => ({}));
// A status read that never settles: this test is about navigation only.
jest.mock('../../src/api/coach', () => ({ ...jest.requireActual('../../src/api/coach'), fetchCoachStatus: jest.fn(() => new Promise(() => {})) }));
// Synchronous icons: the real font load re-renders after this test finishes.
jest.mock('@expo/vector-icons', () => require('../../jest-mocks/vectorIcons'));

describe('KipSettingsSection under a navigation stub without NavigationContext', () => {
  it('renders your KIP and ignores a press instead of throwing', () => {
    const { getByTestId } = render(<KipSettingsSection />);

    expect(getByTestId('kip-your-kip')).toHaveTextContent(/Coral · coaches you on the KIP tab/);
    expect(() => fireEvent.press(getByTestId('kip-change-colour'))).not.toThrow();
    expect(() => fireEvent.press(getByTestId('kip-thinking-text'))).not.toThrow();
  });
});
