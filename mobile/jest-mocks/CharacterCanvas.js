// Jest stand-in for src/components/characters/CharacterCanvas (see jest-setup.js).
// Lives in its own file for the same reason as ThinkingOrb.js: NativeWind's Babel
// transform trips babel-plugin-jest-hoist inside an inline jest.mock() factory.
const React = require('react');
const { View } = require('react-native');

module.exports = {
  CharacterCanvas: ({ characterId, mood, size, paused, mini }) =>
    React.createElement(View, {
      testID: 'character-canvas',
      accessibilityLabel: `character:${characterId}:${mood}:${size}:${paused ? 'paused' : 'playing'}:${mini ? 'mini' : 'full'}`,
    }),
};
