import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { KIP_GRID, kipArt, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { useMyKip } from '../../lib/kip/myKip';
import { wornForSize } from '../../lib/kip/wornArt';
import type { KipWorn } from '../../lib/room/loadout';
import type { PixelRect } from '../../lib/weatherArt';

const HEAD_ROWS = 10;

/** Rows 0–9 of KIP's grid: the top of the block with its eyes (spec §7.2). */
export function kipHeadRects(v: { colour?: KipColour; mood?: KipMood; pose?: KipPose; worn?: Partial<KipWorn> }): PixelRect[] {
  return kipArt(v).filter((r) => r.y < HEAD_ROWS);
}

// KIP's head: the Ask KIP bars (scale 4, 64 × 40) and the small icons on Home, the Conversations sheet, the memory
// screen, the thinking row and beside replies (scale 2, 32 × 20). Decorative. Defaults to your colour, and wears your
// head and ears pieces (a head is small: face and neck pieces are skipped, spec 2026-10-14 KIP's room §7).
export function KipHead({ colour, mood = 'idle', scale = 2, testID }: {
  colour?: KipColour; mood?: KipMood; scale?: number; testID?: string;
}) {
  const me = useMyKip();
  const s = Math.max(1, Math.floor(scale));
  const rects = useMemo(
    () => kipHeadRects({ colour: colour ?? me.colour, mood, worn: wornForSize(me.worn, 0) }),
    [colour, me.colour, me.worn, mood],
  );
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
