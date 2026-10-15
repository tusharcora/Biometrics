import React, { useState } from 'react';
import { View } from 'react-native';
import { RoomView } from '../room/RoomView';
import type { KipColour } from '../../lib/kip/kipArt';
import { displayDraft, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import { isoGrid } from '../../lib/room/iso/grid';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { RoomWeather } from '../../lib/room/weather';

export const EDIT_CELL_PT = 2;

/** Where the editor's room starts: centred on KIP's desk, clamped to the room (spec §5.6). */
export function initialPan(state: EditorState, width: number, height: number): { x: number; y: number } {
  const g = isoGrid(state.tier);
  return isoCrop({ width, height, cellPt: EDIT_CELL_PT, box: deskBoxes(g, state.draft.layout).focus, room: g });
}

// The editor's room (spec 2026-10-15 §5.2): the whole room at 2 points with KIP at the desk. Not one image here: the
// pieces list (Task 11) is how a screen reader reaches each piece. Task 11 adds the overlay and taps, Task 12 the
// drag and the pan.
export function EditRoom({ state, width, height, window, colour, reduceMotion }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  width: number;
  height: number;
  window: { weather: RoomWeather; night: boolean };
  colour: KipColour;
  reduceMotion: boolean;
}) {
  const [pan] = useState(() => initialPan(state, width, height));
  const draft = displayDraft(state);
  return (
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
    </View>
  );
}
