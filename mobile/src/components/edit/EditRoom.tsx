import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { RoomView } from '../room/RoomView';
import { record, useDisposed } from '../room/pictures';
import type { KipColour } from '../../lib/kip/kipArt';
import { displayDraft, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { gridRects, outlineRects } from '../../lib/room/edit/overlay';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import { isoGrid } from '../../lib/room/iso/grid';
import { drawIsoStatic, isoRoomKey, pieceAt } from '../../lib/room/iso/room';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { RoomWeather } from '../../lib/room/weather';

export const EDIT_CELL_PT = 2;
/** A tap is quick; anything longer belongs to the drag (Task 12). */
const TAP_MS = 250;

/** Where the editor's room starts: centred on KIP's desk, clamped to the room (spec §5.6). */
export function initialPan(state: EditorState, width: number, height: number): { x: number; y: number } {
  const g = isoGrid(state.tier);
  return isoCrop({ width, height, cellPt: EDIT_CELL_PT, box: deskBoxes(g, state.draft.layout).focus, room: g });
}

export interface EditRoomProps {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  width: number;
  height: number;
  window: { weather: RoomWeather; night: boolean };
  colour: KipColour;
  reduceMotion: boolean;
  /** The floor's tile lines and the walls' dots (spec §5.2), toggled from the toolbar. */
  showGrid: boolean;
}

// The editor's room (spec 2026-10-15 §5.2, §5.3): the whole room at 2 points with KIP at the desk, the grid and the
// selected piece's light outline drawn over it (never taking touches), and a tap that selects the topmost piece
// under the finger or, on empty floor, deselects. Not one image here: the pieces list is how a screen reader reaches
// each piece. Task 12 adds the drag and the pan.
export function EditRoom({ state, dispatch, width, height, window, colour, reduceMotion, showGrid }: EditRoomProps) {
  const [pan] = useState(() => initialPan(state, width, height));
  const draft = displayDraft(state);
  const g = isoGrid(state.tier);
  const input = { layout: draft.layout, tier: state.tier, weather: window.weather, night: window.night, colour };
  // The picture RoomView draws, here for its hit boxes: rebuilt only when the room itself changes.
  const drawn = useMemo(() => drawIsoStatic(input), [isoRoomKey(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = drawn.hits.find((h) => h.id === state.selected)?.box ?? null;
  const overlay = useDisposed(useMemo(
    () => record([showGrid ? gridRects(g) : [], box ? outlineRects(box) : []], EDIT_CELL_PT),
    [showGrid, g.n, g.m, box?.x, box?.y, box?.w, box?.h], // eslint-disable-line react-hooks/exhaustive-deps
  ));
  const tap = Gesture.Tap()
    .maxDuration(TAP_MS)
    .runOnJS(true)
    .withTestId('edit-room-tap')
    .onEnd((e, ok) => {
      if (!ok) return;
      const cx = Math.floor((e.x - pan.x) / EDIT_CELL_PT);
      const cy = Math.floor((e.y - pan.y) / EDIT_CELL_PT);
      dispatch({ type: 'select', id: pieceAt(drawn.hits, cx, cy) });
    });
  return (
    <GestureDetector gesture={tap}>
      <View testID="edit-room" style={{ width, height, overflow: 'hidden' }} accessibilityLabel={ROOM_COPY.edit.roomLabel}>
        <RoomView
          testID="edit-room-view"
          layout={draft.layout}
          tier={state.tier}
          worn={draft.worn}
          weather={window.weather}
          night={window.night}
          colour={colour}
          pose="rest"
          mood="glance"
          screen="lines"
          bubble={null}
          crop={{ width, height }}
          cellPt={EDIT_CELL_PT}
          offset={pan}
          reduceMotion={reduceMotion}
          accessible={false}
        />
        <Canvas testID="edit-overlay" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
          <Group transform={[{ translateX: pan.x }, { translateY: pan.y }]}>
            <Picture picture={overlay} />
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
