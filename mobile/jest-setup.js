jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

// The real ThinkingOrb draws with Skia (native). Every test sees this stub;
// animation is verified manually on a simulator (see the redesign spec, Testing).
// The stub body lives in jest-mocks/ThinkingOrb.js (an inline factory trips
// babel-plugin-jest-hoist under NativeWind's Babel transform).
jest.mock('./src/components/orb/ThinkingOrb', () => require('./jest-mocks/ThinkingOrb'));

jest.mock('./src/auth/authClient', () => require('./jest-mocks/authClient'));
