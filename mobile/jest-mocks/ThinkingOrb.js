// Jest stand-in for src/components/orb/ThinkingOrb (see jest-setup.js).
// Lives in its own file because NativeWind's Babel transform injects a helper
// into any React.createElement call, and babel-plugin-jest-hoist rejects that
// helper inside an inline jest.mock() factory.
const React = require('react');
const { View } = require('react-native');

module.exports = {
  ThinkingOrb: ({ state = 'working', size = 64, paused = false, theme = 'auto' }) =>
    React.createElement(View, {
      testID: 'thinking-orb',
      accessibilityLabel: `${state}:${size}:${paused ? 'paused' : 'playing'}:${theme}`,
    }),
};
