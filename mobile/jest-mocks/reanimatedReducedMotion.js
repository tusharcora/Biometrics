// Test helper: the real Reanimated module with `useReducedMotion` replaced by a jest.fn,
// so tests can flip reduced motion per test. Lives in a file (not an inline jest.mock factory)
// because NativeWind's Babel transform breaks inline factories (see jest-mocks/ThinkingOrb.js).
const actual = jest.requireActual('react-native-reanimated');
module.exports = { ...actual, __esModule: true, useReducedMotion: jest.fn(() => false) };
