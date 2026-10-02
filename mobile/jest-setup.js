jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

// The real CharacterCanvas draws with Skia (native). Every test sees this stub;
// animation is checked on a simulator with the dev character gallery. The stub
// body lives in jest-mocks/CharacterCanvas.js (an inline factory trips
// babel-plugin-jest-hoist under NativeWind's Babel transform).
jest.mock('./src/components/characters/CharacterCanvas', () => require('./jest-mocks/CharacterCanvas'));

jest.mock('./src/auth/authClient', () => require('./jest-mocks/authClient'));

require('react-native-gesture-handler/jestSetup');
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
