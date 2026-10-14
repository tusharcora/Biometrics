import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { KIP_GRID, kipArt, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { wornForSize } from '../../lib/kip/wornArt';
import type { KipWorn } from '../../lib/room/loadout';

// Draws KIP from its rect list (prep, not wired in). Decorative: the screen around it carries the meaning.
// react-native-svg has no shapeRendering, so the scale is a whole number of points per cell to keep edges crisp.
export function Kip({ colour, pose, mood, worn, scale = 4, testID }: {
  colour?: KipColour; pose?: KipPose; mood?: KipMood; worn?: Partial<KipWorn>; scale?: number; testID?: string;
}) {
  const size = KIP_GRID * Math.max(1, Math.floor(scale));
  const art = kipArt({ colour, pose, mood, worn: wornForSize(worn, size) });
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${KIP_GRID} ${KIP_GRID}`}>
        {art.map((p, i) => (
          <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
        ))}
      </Svg>
    </View>
  );
}
