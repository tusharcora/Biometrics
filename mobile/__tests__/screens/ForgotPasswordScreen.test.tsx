import React from 'react';
import { render } from '@testing-library/react-native';
import { kipArtFills, kipFills } from '../../jest-mocks/kipFixture';
import { resetMyKipColour, setMyKipColour } from '../../src/lib/kip/myKipColour';
import { ForgotPasswordScreen } from '../../src/screens/ForgotPasswordScreen';
import { useAuth } from '../../src/auth/AuthContext';

jest.mock('../../src/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const navigation = { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn() } as any;

beforeEach(() => jest.clearAllMocks());
afterEach(() => resetMyKipColour());

it('always shows a coral KIP waving, whatever colour a KIP was last given (signed-out screens)', () => {
  setMyKipColour('lime');
  (useAuth as jest.Mock).mockReturnValue({ requestPasswordReset: jest.fn() });
  const utils = render(<ForgotPasswordScreen navigation={navigation} route={{} as any} />);

  expect(kipFills(utils, 'auth-kip')).toEqual(kipArtFills({ colour: 'coral', pose: 'wave', mood: 'idle' }));
});
