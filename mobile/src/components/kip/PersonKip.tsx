import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { kipArt, kipBounds, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { kipColourOf } from '../../lib/kip/kipColour';
import { wornForSize } from '../../lib/kip/wornArt';
import type { KipWorn } from '../../lib/room/loadout';

// A person as their KIP (spec 2026-10-13 KIP colour §3): the one way to draw a buddy or you. Cropped to the cells
// this variant paints, so small slots get whole points per cell and the body sits centred, not low.

export type PersonState = 'good' | 'ok' | 'low' | 'none' | 'asleep';

export const PERSON_POSE: Record<PersonState, { pose: KipPose; mood: KipMood }> = {
  good: { pose: 'cheer', mood: 'proud' },
  ok: { pose: 'wave', mood: 'idle' },
  low: { pose: 'rest', mood: 'determined' },
  none: { pose: 'rest', mood: 'idle' },
  asleep: { pose: 'rest', mood: 'sleepy' },
};

export function personStateOf(mood: 'good' | 'ok' | 'low' | 'none' | undefined, asleep = false): PersonState {
  if (asleep) return 'asleep';
  return mood ?? 'none';
}

export function PersonKip({ colour, state = 'none', worn, size, testID }: {
  colour?: string | KipColour; state?: PersonState; worn?: Partial<KipWorn>; size: number; testID?: string;
}) {
  // Keyed on the worn record's contents: a fresh but equal object from a parent render keeps the memo.
  const wornKey = JSON.stringify(worn ?? null);
  const variant = useMemo(
    () => ({ colour: kipColourOf(colour), ...PERSON_POSE[state], worn: wornForSize(worn, size) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colour, state, size, wornKey],
  );
  const art = useMemo(() => kipArt(variant), [variant]);
  const box = useMemo(() => kipBounds(variant), [variant]);
  const scale = Math.max(1, Math.floor(size / Math.max(box.w, box.h)));
  const w = box.w * scale;
  const h = box.h * scale;
  // Whole-point offsets: flex centring splits an odd gap into half points and blurs the cells.
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg
        width={w}
        height={h}
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        style={{ position: 'absolute', left: Math.floor((size - w) / 2), top: Math.floor((size - h) / 2) }}
      >
        {art.map((p, i) => (
          <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
        ))}
      </Svg>
    </View>
  );
}
