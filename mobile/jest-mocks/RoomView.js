// Jest stand-in for src/components/room/RoomView: the props a test needs, as text, on a plain View.
const React = require('react');
const { View } = require('react-native');

module.exports = {
  LOOP_MS: 400,
  bubbleAnchor: () => ({ x: 0, y: 0 }),
  RoomView: (p) =>
    React.createElement(View, {
      testID: p.testID ?? 'room-view',
      accessible: p.accessible ?? true,
      accessibilityRole: p.accessible === false ? undefined : 'image',
      accessibilityLabel: p.accessibilityLabel,
      loadout: JSON.stringify(p.loadout),
      worn: JSON.stringify(p.worn),
      room: `${p.pose}:${p.mood}:${p.bubble ?? 'none'}:${p.screen}:${p.weather}:${p.night ? 'night' : 'day'}:${p.colour}:${p.cellPt}:${p.reduceMotion ? 'still' : 'moving'}:${p.facing ?? ''}:${p.paused ? 'paused' : ''}`,
    }),
};
