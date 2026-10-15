import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { RoomView } from '../room/RoomView';
import { record, useDisposed } from '../room/pictures';
import { Text } from '../ui/text';
import type { KipColour } from '../../lib/kip/kipArt';
import { clampPan, dragAt, EDGE_PT, ghostRects, grabOffset, LIFT_PT, targetKey, targetOf, type Drag, type DragBase } from '../../lib/room/edit/drag';
import { displayDraft, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { reasonText } from '../../lib/room/edit/labels';
import { coachRects, gridRects, outlineRects } from '../../lib/room/edit/overlay';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import { isoGrid } from '../../lib/room/iso/grid';
import { drawIsoStatic, isoRoomKey, pieceAt } from '../../lib/room/iso/room';
import type { ItemId } from '../../lib/room/loadout';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { RoomWeather } from '../../lib/room/weather';

export const EDIT_CELL_PT = 2;
/** A tap is quick; anything longer belongs to the drag. */
const TAP_MS = 250;
/** Press and hold this long to pick a piece up (spec §5.3). */
const HOLD_MS = 200;
/** A finger that moves this far before the hold is a pan (spec §5.6). */
const PAN_START_PT = 8;
/** How far the room scrolls per finger move while a dragged piece is near an edge (spec §5.6). */
const EDGE_STEP_PT = 6;

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

/** The drag the drawer's tiles drive (plan ruling 16): points are the finger's, in window coordinates. */
export interface EditRoomHandle {
  lift(item: ItemId, absX: number, absY: number): void;
  move(absX: number, absY: number): void;
  drop(): void;
  cancel(): void;
}

// The editor's room (spec 2026-10-15 §5.2, §5.3, §5.6): the whole room at 2 points with KIP at the desk, the grid and
// the selected piece's light outline drawn over it (never taking touches). A tap selects the topmost piece under the
// finger or, on empty floor, deselects. Press and hold lifts a piece: it leaves the static picture once, its 70%
// ghost (with what stands on it) moves with the finger from where it was grabbed as its own picture (a drawer piece
// hangs LIFT_PT above the finger), snaps with a light tick per new snap, turns red with a short reason, and on
// letting go the reducer checks the place again (an invalid spot changes nothing and says why). One finger on empty
// floor pans; a dragged piece near an edge scrolls the room. Not one image here: the pieces list is how a screen
// reader reaches each piece.
export const EditRoom = forwardRef<EditRoomHandle, EditRoomProps>(function EditRoom(props, ref) {
  const { state, dispatch, width, height, window, colour, reduceMotion, showGrid } = props;
  const g = isoGrid(state.tier);
  const [pan, setPanState] = useState(() => initialPan(state, width, height));
  // Gesture callbacks run several events inside one render: the live pan and drag are read from refs.
  const panRef = useRef(pan);
  const panStart = useRef(pan);
  const setPan = (next: { x: number; y: number }) => { panRef.current = next; setPanState(next); };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const lastKey = useRef<string | null>(null);
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const draft = displayDraft(state);
  const input = { layout: draft.layout, tier: state.tier, weather: window.weather, night: window.night, colour };
  // The picture RoomView draws, here for its hit boxes: rebuilt only when the room itself changes.
  const drawn = useMemo(() => drawIsoStatic(input), [isoRoomKey(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = drawn.hits.find((h) => h.id === state.selected)?.box ?? null;
  // The lime tile shows while the guided placement waits for the lantern (spec §11.1).
  const coachTile = state.coach?.step === 1 ? state.coach.tile : null;
  const overlay = useDisposed(useMemo(
    () => record([showGrid ? gridRects(g) : [], box ? outlineRects(box) : [], coachTile ? coachRects(g, coachTile) : []], EDIT_CELL_PT),
    [showGrid, g.n, g.m, box?.x, box?.y, box?.w, box?.h, coachTile?.[0], coachTile?.[1]], // eslint-disable-line react-hooks/exhaustive-deps
  ));

  const toCell = (x: number, y: number): [number, number] => [(x - panRef.current.x) / EDIT_CELL_PT, (y - panRef.current.y) / EDIT_CELL_PT];
  // The grab (ruling T12-FIX), in room cells: from the finger to the point the ghost snaps by. A room piece keeps
  // its place under the finger (held still, it snaps to where it is); a drawer piece hangs LIFT_PT above the finger.
  const grab = useRef<[number, number]>([0, 0]);
  /** Where the lifted piece stands, so letting go there is no change at all. */
  const homeKey = useRef<string | null>(null);
  /** The drawer's last finger point in window coordinates, for a late window measure to follow from. */
  const lastAbs = useRef<[number, number]>([0, 0]);
  const show = (d: Drag | null) => {
    dragRef.current = d;
    if (!d) lastKey.current = null;
    setDrag(d);
  };
  /** Follows the finger (in the view's points) by the grab, and a new snap ticks (spec §5.3). */
  const follow = (base: DragBase, x: number, y: number) => {
    // Near an edge the room scrolls under the piece (spec §5.6).
    const dx = x < EDGE_PT ? EDGE_STEP_PT : x > width - EDGE_PT ? -EDGE_STEP_PT : 0;
    const dy = y < EDGE_PT ? EDGE_STEP_PT : y > height - EDGE_PT ? -EDGE_STEP_PT : 0;
    if (dx || dy) setPan(clampPan({ x: panRef.current.x + dx, y: panRef.current.y + dy }, { width, height }, g, EDIT_CELL_PT));
    const [cx, cy] = toCell(x, y);
    const d = dragAt(state, base, [cx + grab.current[0], cy + grab.current[1]]);
    const key = d.target ? targetKey(d.target) : '';
    if (key !== lastKey.current) {
      lastKey.current = key;
      void Haptics.selectionAsync();
    }
    show(d);
  };
  const land = () => {
    const d = dragRef.current;
    show(null);
    if (!d) return;
    // Let go where it already stands: nothing happened.
    if (d.target && targetKey(d.target) === homeKey.current) return;
    // The reducer checks the place again: an invalid spot changes nothing, and the piece stays where it was (or in
    // the drawer). Never snapped: the reason is still said (ruling T12-FIX).
    if (d.target) dispatch({ type: 'drop', id: d.id, item: d.item, target: d.target });
    else if (d.refused) dispatch({ type: 'refused', id: d.id, item: d.item, refused: d.refused });
  };
  const fromWindow = ([absX, absY]: readonly [number, number]) => [absX - origin.current.x, absY - origin.current.y] as const;

  useImperativeHandle(ref, () => ({
    lift: (item, absX, absY) => {
      const base: DragBase = { item, id: null, facing: 'L', mirror: false };
      grab.current = [0, -LIFT_PT / EDIT_CELL_PT];
      homeKey.current = null;
      lastAbs.current = [absX, absY];
      follow(base, ...fromWindow(lastAbs.current));
      // The room may have scrolled with the page since the last measure: measure again, then follow the finger's
      // latest point from there.
      viewRef.current?.measureInWindow?.((x, y) => {
        if (x === origin.current.x && y === origin.current.y) return;
        origin.current = { x, y };
        if (dragRef.current) follow(dragRef.current, ...fromWindow(lastAbs.current));
      });
    },
    move: (absX, absY) => {
      lastAbs.current = [absX, absY];
      if (dragRef.current) follow(dragRef.current, ...fromWindow(lastAbs.current));
    },
    drop: land,
    cancel: () => show(null),
  }));

  const hold = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .runOnJS(true)
    .withTestId('edit-room-drag')
    .onStart((e) => {
      const [cx, cy] = toCell(e.x, e.y);
      const id = pieceAt(drawn.hits, Math.floor(cx), Math.floor(cy));
      const p = id ? state.draft.layout.pieces.find((q) => q.id === id) : undefined;
      if (!p) return;
      dispatch({ type: 'select', id: p.id });
      // The ghost starts exactly where the piece stands, and keeps the piece's place under the finger.
      grab.current = grabOffset(state, p, toCell(e.x, e.y));
      homeKey.current = targetKey(targetOf(p));
      follow({ item: p.item, id: p.id, facing: p.facing, mirror: p.mirror }, e.x, e.y);
    })
    .onUpdate((e) => { if (dragRef.current) follow(dragRef.current, e.x, e.y); })
    .onEnd((_e, ok) => { if (dragRef.current) (ok ? land() : show(null)); })
    .onFinalize(() => { if (dragRef.current) show(null); });
  const look = Gesture.Pan()
    .minDistance(PAN_START_PT)
    .runOnJS(true)
    .withTestId('edit-room-pan')
    .onBegin(() => { panStart.current = panRef.current; })
    .onUpdate((e) => setPan(clampPan({ x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY }, { width, height }, g, EDIT_CELL_PT)));
  const tap = Gesture.Tap()
    .maxDuration(TAP_MS)
    .runOnJS(true)
    .withTestId('edit-room-tap')
    .onEnd((e, ok) => {
      if (!ok) return;
      const [cx, cy] = toCell(e.x, e.y);
      dispatch({ type: 'select', id: pieceAt(drawn.hits, Math.floor(cx), Math.floor(cy)) });
    });

  // The ghost is its own picture, re-recorded only when what it shows changes (a new snap, or red on and off), never
  // the static room (ruling 8, spec §3.7). Unsnapped, it follows the finger cell by cell.
  const ghostKey = drag ? `${drag.item}|${drag.id}|${drag.facing}|${drag.mirror}|${drag.target ? targetKey(drag.target) : drag.cell.map(Math.round).join(',')}|${drag.refused?.reason ?? ''}` : '';
  const ghost = useMemo(
    () => (drag ? ghostRects(state, drag, { night: window.night, colour }) : null),
    [ghostKey, state.draft.layout, window.night, colour], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ghostPicture = useDisposed(useMemo(() => record([ghost?.base ?? []], EDIT_CELL_PT), [ghost]));
  const redPicture = useDisposed(useMemo(() => record([ghost?.tint ?? []], EDIT_CELL_PT), [ghost]));

  return (
    <GestureDetector gesture={Gesture.Race(hold, look, tap)}>
      <View
        ref={viewRef}
        testID="edit-room"
        style={{ width, height, overflow: 'hidden' }}
        accessibilityLabel={ROOM_COPY.edit.roomLabel}
        onLayout={() => viewRef.current?.measureInWindow?.((x, y) => { origin.current = { x, y }; })}
      >
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
          hide={drag?.id ?? null}
          reduceMotion={reduceMotion}
          accessible={false}
        />
        <Canvas testID="edit-overlay" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
          <Group transform={[{ translateX: pan.x }, { translateY: pan.y }]}>
            <Picture picture={overlay} />
            {drag ? (
              <Group opacity={0.7}>
                <Picture picture={ghostPicture} />
              </Group>
            ) : null}
            {drag?.refused ? <Picture picture={redPicture} /> : null}
          </Group>
        </Canvas>
        {drag ? <View testID="edit-ghost" pointerEvents="none" /> : null}
        {drag?.refused ? <View testID="edit-ghost-red" pointerEvents="none" /> : null}
        {drag?.refused ? (
          <View pointerEvents="none" className="absolute bottom-2 left-0 right-0 items-center">
            <Text testID="edit-drag-reason" accessibilityLiveRegion="polite" className="rounded-lg bg-background/90 px-2 py-1 text-caption text-destructive">
              {reasonText(drag.refused, drag.item, state.draft.layout)}
            </Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
});
