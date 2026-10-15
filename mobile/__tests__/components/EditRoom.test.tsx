import React, { createRef } from 'react';
import * as Haptics from 'expo-haptics';
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { EditRoom, EDIT_CELL_PT, initialPan, type EditRoomHandle } from '../../src/components/edit/EditRoom';
import { LIFT_PT } from '../../src/lib/room/edit/drag';
import { initEditor } from '../../src/lib/room/edit/editor';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { drawIsoStatic } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));

const STATE = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const W = 390, H = 320;
const props = { state: STATE, width: W, height: H, window: { weather: 'clear' as const, night: false }, colour: 'coral' as const, reduceMotion: true, showGrid: true };

it('a tap selects the topmost piece under the finger; a tap on empty floor deselects (spec §5.3)', () => {
  const dispatch = jest.fn();
  render(<EditRoom {...props} dispatch={dispatch} />);
  const pan = initialPan(STATE, W, H);
  const fern = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'clear', night: false, colour: 'coral' }).hits.find((h) => h.id === 'plant')!;
  const [cx, cy] = fern.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!;
  const at = (x: number, y: number) => ({ x: pan.x + (x + 0.5) * EDIT_CELL_PT, y: pan.y + (y + 0.5) * EDIT_CELL_PT });
  act(() => fireGestureHandler(getByGestureTestId('edit-room-tap'), [{ state: State.BEGAN, ...at(cx, cy) }, { state: State.END, ...at(cx, cy) }]));
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'select', id: 'plant' });
  act(() => fireGestureHandler(getByGestureTestId('edit-room-tap'), [{ state: State.BEGAN, x: 1, y: 1 }, { state: State.END, x: 1, y: 1 }]));
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'select', id: null });
});

it('draws the grid overlay and the selection outline over the room, never taking touches', () => {
  const s = render(<EditRoom {...props} dispatch={jest.fn()} state={{ ...STATE, selected: 'plant' }} />);
  expect(s.getByTestId('edit-overlay').props.pointerEvents).toBe('none');
});

const P = projOf(isoGrid(1));
/** The finger's point (in the view) that puts the ghost over room point (i, j, z): the ghost sits LIFT_PT above it. */
const pt = (i: number, j: number, z = 0) => {
  const pan = initialPan(STATE, W, H);
  const [x, y] = P(i, j, z);
  return { x: pan.x + x * EDIT_CELL_PT, y: pan.y + y * EDIT_CELL_PT + LIFT_PT };
};
const fernTop = () => {
  const hit = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'clear', night: false, colour: 'coral' }).hits.find((h) => h.id === 'plant')!;
  const [x, y] = hit.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!;
  const pan = initialPan(STATE, W, H);
  return { x: pan.x + (x + 0.5) * EDIT_CELL_PT, y: pan.y + (y + 0.5) * EDIT_CELL_PT };
};
type Handlers = { onStart: (e: object) => void; onUpdate: (e: object) => void };
/**
 * The drag's own handlers, called directly: RNGH 2.32's fireGestureHandler always ends the gesture, so a drag still
 * in the air is driven this way (preflight ruling H12). Looked up again each time: every render has new handlers.
 */
const hold = () => (getByGestureTestId('edit-room-drag') as unknown as { handlers: Handlers }).handlers;

describe('dragging (spec §5.3)', () => {
  it('while held, the piece leaves the picture and its ghost follows the finger', () => {
    const dispatch = jest.fn();
    const s = render(<EditRoom {...props} dispatch={dispatch} />);
    expect(s.queryByTestId('edit-ghost')).toBeNull();
    act(() => hold().onStart(fernTop()));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'select', id: 'plant' });
    act(() => hold().onUpdate(pt(5.5, 5.5)));
    expect(s.getByTestId('edit-room-view').props.hide).toBe('plant');
    expect(s.getByTestId('edit-ghost')).toBeTruthy();
    expect(s.queryByTestId('edit-ghost-red')).toBeNull();
    expect(s.queryByTestId('edit-drag-reason')).toBeNull();
  });

  it('lifts the held piece, ticks on each new snap, and drops it on the tile under the ghost', () => {
    const dispatch = jest.fn();
    const s = render(<EditRoom {...props} dispatch={dispatch} />);
    (Haptics.selectionAsync as jest.Mock).mockClear();
    act(() => fireGestureHandler(getByGestureTestId('edit-room-drag'), [
      { state: State.BEGAN, ...fernTop() }, { state: State.ACTIVE, ...fernTop() }, { state: State.ACTIVE, ...pt(5.5, 5.5) },
      { state: State.ACTIVE, ...pt(6.5, 5.5) }, { state: State.END, ...pt(6.5, 5.5) },
    ]));
    expect((Haptics.selectionAsync as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 6, y: 5 } });
    expect(s.getByTestId('edit-room-view').props.hide).toBeNull();
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });

  it('the same snap twice ticks once', () => {
    render(<EditRoom {...props} dispatch={jest.fn()} />);
    act(() => hold().onStart(fernTop()));
    (Haptics.selectionAsync as jest.Mock).mockClear();
    act(() => hold().onUpdate(pt(5.5, 5.5)));
    act(() => hold().onUpdate(pt(5.6, 5.4)));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('shows red with the reason while over an invalid spot, and clears it over a valid one (Review Focus 3)', () => {
    const s = render(<EditRoom {...props} dispatch={jest.fn()} />);
    act(() => hold().onStart(fernTop()));
    act(() => hold().onUpdate(pt(3.5, 2.5)));
    expect(s.getByTestId('edit-ghost-red')).toBeTruthy();
    expect(s.getByTestId('edit-drag-reason')).toHaveTextContent("Blocks KIP's chair");
    act(() => hold().onUpdate(pt(5.5, 5.5)));
    expect(s.queryByTestId('edit-ghost-red')).toBeNull();
    expect(s.queryByTestId('edit-drag-reason')).toBeNull();
  });

  it('a drag that starts on empty floor lifts nothing', () => {
    const dispatch = jest.fn();
    const s = render(<EditRoom {...props} dispatch={dispatch} />);
    act(() => fireGestureHandler(getByGestureTestId('edit-room-drag'), [{ state: State.BEGAN, x: 1, y: 1 }, { state: State.ACTIVE, x: 1, y: 1 }, { state: State.END, x: 5, y: 5 }]));
    expect(dispatch).not.toHaveBeenCalled();
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });

  it('the drawer drives the same drag through the handle, in window coordinates (ruling 16)', () => {
    const dispatch = jest.fn();
    const ref = createRef<EditRoomHandle>();
    const counts = { ...STARTER_COUNTS, 'corner.beanbag': 1 };
    const s = render(<EditRoom {...props} ref={ref} state={{ ...STATE, counts }} dispatch={dispatch} />);
    act(() => { ref.current!.lift('corner.beanbag', pt(3.5, 2.5).x, pt(3.5, 2.5).y); });
    expect(s.getByTestId('edit-ghost-red')).toBeTruthy();
    expect(s.getByTestId('edit-drag-reason')).toHaveTextContent("Blocks KIP's chair");
    const at = pt(6.5, 6.5);
    act(() => { ref.current!.move(at.x, at.y); });
    expect(s.queryByTestId('edit-ghost-red')).toBeNull();
    act(() => { ref.current!.drop(); });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 6, y: 6 } });
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });

  it('cancel puts the ghost away and drops nothing', () => {
    const dispatch = jest.fn();
    const ref = createRef<EditRoomHandle>();
    const s = render(<EditRoom {...props} ref={ref} state={{ ...STATE, counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 } }} dispatch={dispatch} />);
    act(() => { ref.current!.lift('corner.beanbag', pt(6.5, 6.5).x, pt(6.5, 6.5).y); });
    expect(s.getByTestId('edit-ghost')).toBeTruthy();
    act(() => { ref.current!.cancel(); });
    act(() => { ref.current!.drop(); });
    expect(dispatch).not.toHaveBeenCalled();
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });
});

describe('panning (spec §5.6)', () => {
  it('one finger pans a room bigger than the view, never past its edges', () => {
    const loft = { ...STATE, tier: 3 as const };
    const s = render(<EditRoom {...props} state={loft} dispatch={jest.fn()} />);
    const before = JSON.parse(s.getByTestId('edit-room-view').props.offset);
    const look = () => getByGestureTestId('edit-room-pan');
    act(() => fireGestureHandler(look(), [
      { state: State.BEGAN }, { state: State.ACTIVE, translationX: -1, translationY: 0 },
      { state: State.ACTIVE, translationX: 20, translationY: 0 }, { state: State.END, translationX: 20, translationY: 0 },
    ]));
    const after = JSON.parse(s.getByTestId('edit-room-view').props.offset);
    expect(after.x).toBe(Math.min(0, before.x + 20));
    expect(after.x).not.toBe(before.x);
    act(() => fireGestureHandler(look(), [
      { state: State.BEGAN }, { state: State.ACTIVE, translationX: 1, translationY: 0 },
      { state: State.ACTIVE, translationX: 900, translationY: 900 }, { state: State.END, translationX: 900, translationY: 900 },
    ]));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.offset)).toEqual({ x: 0, y: 0 });
  });
});
