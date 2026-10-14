// Jest stand-in for @shopify/react-native-skia (the real module is native). The recap export configures
// makeImageFromView per case. RoomView records pictures with createPicture: the stand-in runs the drawing callback
// against a fake canvas, so tests can count pictures and the colours each one drew.
const React = require('react');
const { View } = require('react-native');

const createPicture = jest.fn((draw) => {
  const colours = [];
  const canvas = { drawPath: (_path, paint) => colours.push(paint.colour), drawRect: (_rect, paint) => colours.push(paint.colour) };
  draw(canvas);
  return { colours, dispose: jest.fn() };
});

const Skia = {
  Paint: () => {
    const paint = { colour: null, setColor: (c) => { paint.colour = c; }, setAntiAlias: jest.fn() };
    return paint;
  },
  Color: (c) => c,
  Path: { Make: () => ({ addRect: jest.fn() }) },
  XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
};

const Canvas = ({ children, style }) => React.createElement(View, { testID: 'skia-canvas', style }, children);
const Group = ({ children, transform }) => React.createElement(View, { testID: 'skia-group', skiaTransform: transform }, children);
const Picture = ({ picture }) => React.createElement(View, { testID: 'skia-picture', picture });

module.exports = { makeImageFromView: jest.fn(), ImageFormat: { JPEG: 3, PNG: 4, WEBP: 6 }, createPicture, Skia, Canvas, Group, Picture };
