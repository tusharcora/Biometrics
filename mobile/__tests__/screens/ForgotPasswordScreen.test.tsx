import React from 'react';
import { render } from '@testing-library/react-native';
import { characterLabel, withCharacter } from '../../jest-mocks/characterContext';
import { ForgotPasswordScreen } from '../../src/screens/ForgotPasswordScreen';
import { useAuth } from '../../src/auth/AuthContext';

jest.mock('../../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const navigation = { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn() } as any;

beforeEach(() => jest.clearAllMocks());

it('always shows Hoot, whatever character a provider holds (signed-out screens)', () => {
  (useAuth as jest.Mock).mockReturnValue({ requestPasswordReset: jest.fn() });
  const utils = render(withCharacter(<ForgotPasswordScreen navigation={navigation} route={{} as any} />, { characterId: 'ember' }));

  expect(characterLabel(utils, 'auth-character')).toBe('character:hoot:idle:56:playing:full');
});
