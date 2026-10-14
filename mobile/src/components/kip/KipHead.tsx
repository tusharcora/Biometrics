import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { KIP_GRID, kipArt, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { useMyKipColour } from '../../lib/kip/myKip';
import type { PixelRect } from '../../lib/weatherArt';

const HEAD_ROWS = 10;

/** Rows 0–9 of KIP's grid: the top of the block with its eyes (spec §7.2). */
export function kipHeadRects(v: { colour?: KipColour; mood?: KipMood; pose?: KipPose }): PixelRect[] {
  return kipArt(v).filter((r) => r.y < HEAD_ROWS);
}

// KIP's head: the Ask KIP bars (scale 4, 64 × 40) and the small icons on Home, the Conversations sheet, the memory
// screen, the thinking row and beside replies (scale 2, 32 × 20). Decorative. Defaults to your colour.
export function KipHead({ colour, mood = 'idle', scale = 2, testID }: {
  colour?: KipColour; mood?: KipMood; scale?: number; testID?: string;
}) {
  const mine = useMyKipColour();
  const s = Math.max(1, Math.floor(scale));
  const rects = useMemo(() => kipHeadRects({ colour: colour ?? mine, mood }), [colour, mine, mood]);
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: KIP_GRID * s, height: HEAD_ROWS * s }}
    >
      <Svg width={KIP_GRID * s} height={HEAD_ROWS * s} viewBox={`0 0 ${KIP_GRID} ${HEAD_ROWS}`}>
        {rects.map((p, i) => (
          <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
        ))}
      </Svg>
    </View>
  );
}
