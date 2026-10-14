import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { KipColour } from '../../lib/kip/kipArt';
import { boundsOf } from '../../lib/room/grid';
import { iconRectsFor } from '../../lib/room/icons';

// A tray tile's picture (spec §6.3, §8 Icons; ruling 22): the piece's sprite in a square viewBox fitted to it, 48 × 48
// points by default (16 × 16 at 3×). Decorative: the tile carries the label.
export function ItemIcon({ id, colour, size = 48, testID }: { id: string; colour: KipColour; size?: number; testID?: string }) {
  const rects = useMemo(() => iconRectsFor(id, colour), [id, colour]);
  const box = boundsOf(rects);
  const side = box ? Math.max(box.w, box.h, 16) : 16;
  const viewBox = box ? `${box.x - (side - box.w) / 2} ${box.y - (side - box.h) / 2} ${side} ${side}` : '0 0 16 16';
  return (
    <View testID={testID} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {box ? (
        <Svg width={size} height={size} viewBox={viewBox}>
          {rects.map(([x, y, w, h, fill], i) => (
            <Rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
