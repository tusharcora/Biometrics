import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture, Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import { Text } from '../ui/text';
import { drawKipLayer, drawRoomFrames, drawRoomStatic, kipLayerKey, roomPictureKey, type KipSeat } from '../../lib/room/draw';
import { FOCUS_BOX, THUMB_BOX, type RoomRect } from '../../lib/room/grid';
import type { MonitorScreen } from '../../lib/room/items';
import type { KipWorn, RoomLoadout } from '../../lib/room/loadout';
import type { RoomWeather } from '../../lib/room/weather';
import type { KipColour, KipMood, KipPose } from '../../lib/kip/kipArt';
import { useFrameClock } from '../../lib/useFrameClock';
import { useScreenFocused } from '../../lib/useScreenFocused';
import { roomCrop } from './roomCrop';

export const LOOP_MS = 400;
// The bubble is decoration over a fixed crop, so its text grows only a little with Dynamic Type.
const BUBBLE_MAX_FONT_SCALE = 1.3;
const BUBBLE_INSET = 4;

export interface RoomViewProps {
  loadout: RoomLoadout;
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
  bubble: string | null;
  reduceMotion: boolean;
  accessibilityLabel?: string;
  /** False when a parent carries the label (the collapsed header's thumbnail button). Default true. */
  accessible?: boolean;
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

// KIP's room (spec §3.2, §5). The static room is recorded once per (loadout, weather, night, colour) into two
// pictures, back and front. KIP and the loop frame are drawn between and over them, so a pose change or a frame
// never rebuilds the room. Loops run at 400 ms and stop when the tab is not focused or under Reduce Motion.
export function RoomView(props: RoomViewProps) {
  const { loadout, weather, night, colour, worn, pose, mood, facing, screen, crop, cellPt, bubble, reduceMotion } = props;
  const focused = useScreenFocused();
  const still = reduceMotion || !focused;
  const t = useFrameClock(still);
  const frame = still ? 0 : Math.floor(t / LOOP_MS) % 3;
  const box = props.box === 'thumb' ? THUMB_BOX : FOCUS_BOX;

  const staticKey = roomPictureKey({ loadout, weather, night, colour });
  const room = useMemo(() => drawRoomStatic({ loadout, weather, night, colour }), [staticKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useDisposed(useMemo(() => record([room.base], cellPt), [room, cellPt]));
  const front = useDisposed(useMemo(() => record([room.light, room.emissive], cellPt), [room, cellPt]));

  const frameKey = `${staticKey}#${screen}#${cellPt}`;
  const framePictures = useMemo(
    () => drawRoomFrames({ loadout, weather, night, colour, screen }).map((f) => record([f], cellPt)),
    [frameKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => framePictures.forEach((p) => p.dispose?.()), [framePictures]);

  const kip = { colour, pose, mood, worn, frame, ...(facing ? { facing } : {}) };
  // kipLayerKey leaves the seat out, so the seat (style and position) joins the key: a desk swap re-places KIP.
  const seat = room.kipSeat;
  const kipKey = `${kipLayerKey(kip)}#${seat.style}@${seat.x},${seat.y},${seat.deskSide}#${cellPt}`;
  const kipPicture = useDisposed(useMemo(() => record([drawKipLayer(kip, seat)], cellPt), [kipKey])); // eslint-disable-line react-hooks/exhaustive-deps

  const offset = roomCrop({ width: crop.width, height: crop.height, cellPt, box });
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
          <Picture picture={framePictures[frame]!} />
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
