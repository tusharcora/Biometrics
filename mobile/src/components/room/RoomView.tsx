import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture, Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import { Text } from '../ui/text';
import type { RoomRect } from '../../lib/room/grid';
import type { MonitorScreen } from '../../lib/room/items';
import type { KipWorn } from '../../lib/room/loadout';
import type { RoomWeather } from '../../lib/room/weather';
import type { KipSeat } from '../../lib/room/iso/room';
import { drawIsoFrames, drawIsoStatic, drawKipLayer, isoRoomKey, kipLayerKey } from '../../lib/room/iso/room';
import { isoCrop } from '../../lib/room/iso/crop';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import type { KipColour, KipMood, KipPose } from '../../lib/kip/kipArt';
import { useFrameClock } from '../../lib/useFrameClock';
import { useScreenFocused } from '../../lib/useScreenFocused';

export const LOOP_MS = 400;
// The bubble is decoration over a fixed crop, so its text grows only a little with Dynamic Type.
const BUBBLE_MAX_FONT_SCALE = 1.3;
const BUBBLE_INSET = 4;

export interface RoomViewProps {
  layout: RoomLayout;
  tier: Tier;
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  worn: KipWorn;
  pose: KipPose;
  mood: KipMood;
  facing?: 'desk' | 'you';
  screen: MonitorScreen;
  crop: { width: number; height: number };
  cellPt: 1 | 2;
  box?: 'focus' | 'thumb';
  /** The editor's pan: the room's top-left in points, instead of the crop on the desk. */
  offset?: { x: number; y: number };
  /** The editor: a piece lifted into the drag ghost is left out of the picture (spec §3.7). */
  hide?: string | null;
  bubble: string | null;
  reduceMotion: boolean;
  accessibilityLabel?: string;
  /** False when a parent carries the label (the collapsed header's thumbnail button). Default true. */
  accessible?: boolean;
  /** Holds the loops (frame 0) while something covers the room, such as the editor (spec §8 Loops). */
  paused?: boolean;
  testID?: string;
}

/** One Path per colour per layer, on whole points, antialiasing off (spec §5). */
function record(layers: readonly (readonly RoomRect[])[], cellPt: number): SkPicture {
  return createPicture((canvas) => {
    for (const rects of layers) {
      const byColour = new Map<string, ReturnType<typeof Skia.Path.Make>>();
      for (const [x, y, w, h, colour] of rects) {
        let path = byColour.get(colour);
        if (!path) { path = Skia.Path.Make(); byColour.set(colour, path); }
        path.addRect(Skia.XYWHRect(x * cellPt, y * cellPt, w * cellPt, h * cellPt));
      }
      for (const [colour, path] of byColour) {
        const paint = Skia.Paint();
        paint.setAntiAlias(false);
        paint.setColor(Skia.Color(colour));
        canvas.drawPath(path, paint);
      }
    }
  });
}

/** Releases a picture when it is replaced or the view unmounts (one picture set per screen). */
function useDisposed<T extends { dispose?: () => void }>(value: T): T {
  useEffect(() => () => value.dispose?.(), [value]);
  return value;
}

/** Where the speech bubble's bottom centre sits, in cells: just above KIP's head. */
export function bubbleAnchor(seat: KipSeat): { x: number; y: number } {
  return { x: seat.x + 16, y: seat.y + 10 };
}

// KIP's isometric room (spec 2026-10-15 §3.7). The static room is recorded once per isoRoomKey (the layout, tier,
// light, KIP's colour and a lifted piece) into two pictures, back and front, so only a pick-up, a drop, the light or
// the colour rebuilds it. KIP is drawn between them and the loop frame over them; a pose change or a 400 ms tick
// records only KIP and the frame shown (its loops behind KIP are clipped by KIP's silhouette). The loops stop when
// the tab is not focused, under Reduce Motion, or while paused.
export function RoomView(props: RoomViewProps) {
  const { layout, tier, weather, night, colour, worn, pose, mood, facing, screen, crop, cellPt, bubble, reduceMotion } = props;
  const focused = useScreenFocused();
  const still = reduceMotion || !focused || !!props.paused;
  const t = useFrameClock(still);
  const frame = still ? 0 : Math.floor(t / LOOP_MS) % 3;

  const input = { layout, tier, weather, night, colour, hide: props.hide ?? null };
  const staticKey = isoRoomKey(input);
  const room = useMemo(() => drawIsoStatic(input), [staticKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useDisposed(useMemo(() => record([room.back], cellPt), [room, cellPt]));
  const front = useDisposed(useMemo(() => record([room.front, room.light, room.emissive], cellPt), [room, cellPt]));

  const kip = { colour, pose, mood, worn, frame, ...(facing ? { facing } : {}) };
  // kipLayerKey leaves the seat out, so the seat (style and position) joins the key: a moved desk re-places KIP.
  const seat = room.kipSeat;
  const kipKey = `${kipLayerKey(kip)}#${seat.style}@${seat.x},${seat.y},${seat.deskSide}`;
  const kipRects = useMemo(() => drawKipLayer(kip, seat), [kipKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const kipPicture = useDisposed(useMemo(() => record([kipRects], cellPt), [kipRects, cellPt]));

  // Only the frame shown is recorded, keyed on KIP's silhouette of that frame (ruling T10): kipRects already changes
  // with the frame, so a tick records one frame picture, never all three.
  const framePicture = useDisposed(
    useMemo(() => record([drawIsoFrames(room, { night, colour, screen }, kipRects)[frame as 0 | 1 | 2]], cellPt), [room, screen, kipRects, frame, cellPt]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const box = props.box === 'thumb' ? room.thumb : room.focus;
  const offset = props.offset ?? isoCrop({ width: crop.width, height: crop.height, cellPt, box, room: room.grid });
  const anchor = bubbleAnchor(seat);
  // Measured, so a long bubble is pulled in from the right edge instead of clipped by the crop.
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const bubbleLeft = Math.max(BUBBLE_INSET, Math.min(offset.x + anchor.x * cellPt - 36, crop.width - bubbleWidth - BUBBLE_INSET));
  return (
    <View
      testID={props.testID}
      accessible={props.accessible ?? true}
      accessibilityRole={props.accessible === false ? undefined : 'image'}
      accessibilityLabel={props.accessibilityLabel}
      style={{ width: crop.width, height: crop.height, overflow: 'hidden' }}
    >
      <Canvas style={{ width: crop.width, height: crop.height }}>
        <Group transform={[{ translateX: offset.x }, { translateY: offset.y }]}>
          <Picture picture={back} />
          <Picture picture={kipPicture} />
          <Picture picture={front} />
          <Picture picture={framePicture} />
        </Group>
      </Canvas>
      {bubble ? (
        <View
          testID="room-bubble"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute rounded-lg bg-[#F5F5F4] px-2 py-1"
          onLayout={(e) => setBubbleWidth(e.nativeEvent.layout.width)}
          style={{ left: bubbleLeft, bottom: crop.height - (offset.y + anchor.y * cellPt) }}
        >
          <Text className="font-pixel text-label text-[#0A0B0E]" numberOfLines={1} maxFontSizeMultiplier={BUBBLE_MAX_FONT_SCALE}>
            {bubble}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
