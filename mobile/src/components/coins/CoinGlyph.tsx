import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// The KIP coin (spec 2026-10-15 §6.7): an 8 × 8 pixel coin. Decorative: whatever holds it carries the label.
const COIN: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [2, 0, 4, 1, '#B45309'], [1, 1, 6, 1, '#F59E0B'], [0, 2, 8, 4, '#F59E0B'], [1, 6, 6, 1, '#F59E0B'], [2, 7, 4, 1, '#B45309'],
  [0, 2, 1, 4, '#B45309'], [7, 2, 1, 4, '#B45309'], [3, 2, 2, 4, '#FDE68A'],
];

export function CoinGlyph({ size = 14 }: { size?: number }) {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 8 8">
        {COIN.map(([x, y, w, h, fill], i) => <Rect key={i} x={x} y={y} width={w} height={h} fill={fill} />)}
      </Svg>
    </View>
  );
}
