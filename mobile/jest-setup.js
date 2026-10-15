jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

jest.mock('./src/auth/authClient', () => require('./jest-mocks/authClient'));

require('react-native-gesture-handler/jestSetup');
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Recap export natives (spec 2026-10-04 §3). Tests set return values per case.
jest.mock('@shopify/react-native-skia', () => require('./jest-mocks/skia'));
jest.mock('expo-file-system', () => require('./jest-mocks/expoFileSystem'));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()), isAvailableAsync: jest.fn(() => Promise.resolve(true)) }));
// The legacy entry is the one the app imports: the package root's saveToLibraryAsync always throws.
jest.mock('expo-media-library/legacy', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

// Request ids (P2 plan ruling 30): a fresh, readable id per call.
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}`) }));
