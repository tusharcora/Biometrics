// Jest stand-in for src/components/room/RoomView: the props a test needs, as text, on a plain View, and its handle.
const React = require('react');
const { View } = require('react-native');

let mockPieceAt = () => null;
const propsOf = (p) => ({
  testID: p.testID ?? 'room-view',
  accessible: p.accessible ?? true,
  accessibilityRole: p.accessible === false ? undefined : 'image',
  accessibilityLabel: p.accessibilityLabel,
  layout: JSON.stringify(p.layout), tier: p.tier, offset: p.offset ? JSON.stringify(p.offset) : undefined, hide: p.hide ?? null,
  dragging: !!p.dragging,
  editing: !!p.editing,
  holdClock: !!p.holdClock,
  walks: p.kipWalks ? 'walks' : '',
  idle: p.idle ? 'idle' : '',
  worn: JSON.stringify(p.worn),
  living: p.living ? JSON.stringify(p.living) : undefined,
  room: `${p.pose}:${p.mood}:${p.bubble ?? 'none'}:${p.screen}:${p.weather}:${p.night ? 'night' : 'day'}:${p.colour}:${p.cellPt}:${p.reduceMotion ? 'still' : 'moving'}:${p.facing ?? ''}:${p.paused ? 'paused' : ''}`,
});

module.exports = {
  LOOP_MS: 400,
  bubbleAnchor: () => ({ x: 0, y: 0 }),
  /** Tests choose what a tap on the room finds. */
  __setPieceAt: (fn) => { mockPieceAt = fn; },
  RoomView: (p) => {
    React.useImperativeHandle(p.ref, () => ({ pieceAtPoint: (x, y) => mockPieceAt(x, y), squash: jest.fn() }), []);
    return React.createElement(View, propsOf(p));
  },
};
