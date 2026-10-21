import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { RoomView } from './RoomView';
import type { KipColour, KipPose } from '../../lib/kip/kipArt';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { isoGrid } from '../../lib/room/iso/grid';
import type { KipWorn } from '../../lib/room/loadout';
import { panTo, visitLight } from '../../lib/room/visit';

const CELL_PT = 2;
type Point = { x: number; y: number };

// A room drawn for someone else's eyes (spec 2026-10-15 §10.1, §10.4, §10.5; P4 ruling 24): a visit, a challenge
// entry, the share card. No `living` (P3's NEUTRAL_LIVING: plants grown, the cat wandering, the trophy shelf empty),
// the fallback sky, day or night by this device's clock, KIP at its desk (no walk), no piece actions and no taps: one
// image with one label. `live` lets the room's cat wander (PF4-F7); RoomView holds it under Reduce Motion and out of
// focus, and a step records no picture. `pannable` lets one finger pan a room larger than the view (§10.1 "Pan
// works"), kept inside the room's edges.
export function NeutralRoom({ layout, tier, colour, worn, pose, bubble, width, height, label, pannable = false, testID }: {
  layout: RoomLayout; tier: Tier; colour: KipColour; worn: KipWorn; pose: KipPose; bubble: string | null;
  width: number; height: number; label: string; pannable?: boolean; testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  // Read once: a visit is a short look, and a new light would rebuild the room.
  const light = useMemo(() => visitLight(new Date()), []);
  const g = isoGrid(tier);
  const roomPt = { width: g.W * CELL_PT, height: g.H * CELL_PT };
  const start = useMemo(
    () => isoCrop({ width, height, cellPt: CELL_PT, box: deskBoxes(isoGrid(tier), layout).focus, room: isoGrid(tier) }),
    [width, height, tier, layout],
  );
  // A pan belongs to the crop it started from: a new size or room starts again at the desk.
  const [panned, setPanned] = useState<{ from: Point; at: Point } | null>(null);
  const offset = panned && panned.from === start ? panned.at : start;
  // Where this pan began; the gesture is made each render, so onBegin sees this render's offset.
  const panStart = useRef(offset);
  const pan = Gesture.Pan()
    .enabled(pannable)
    .runOnJS(true)
    .withTestId(`${testID ?? 'neutral-room'}-pan`)
    .onBegin(() => { panStart.current = offset; })
    .onUpdate((e) => {
      if (!pannable) return;
      setPanned({ from: start, at: panTo(panStart.current, e.translationX, e.translationY, { width, height }, roomPt) });
    });
  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0A0B0E', borderRadius: 8 }}>
        <RoomView
          testID={testID}
          layout={layout}
          tier={tier}
          weather={light.weather}
          night={light.night}
          colour={colour}
          worn={worn}
          pose={pose}
          mood="idle"
          screen="lines"
          crop={{ width, height }}
          cellPt={CELL_PT}
          offset={offset}
          live
          bubble={bubble}
          reduceMotion={reduceMotion}
          accessibilityLabel={label}
        />
      </View>
    </GestureDetector>
  );
}
