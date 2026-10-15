import React, { createRef } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { InventoryDrawer } from '../../src/components/edit/InventoryDrawer';
import type { EditRoomHandle } from '../../src/components/edit/EditRoom';
import { initEditor } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/lib/achievementsStore', () => ({ ...jest.requireActual('../../src/lib/achievementsStore'), useAchievements: () => ({ state: { status: 'idle' } }) }));

const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'corner.beanbag': 1 };
const state = (over = {}) => ({ ...initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts, version: 1, newIds: [] }), ...over });
const room = () => {
  const ref = createRef<EditRoomHandle>() as React.MutableRefObject<EditRoomHandle | null>;
  ref.current = { lift: jest.fn(), move: jest.fn(), drop: jest.fn(), cancel: jest.fn() };
  return ref;
};

it('says how many pieces are not placed, with the tabs as a tablist (spec §5.4)', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-title')).toHaveTextContent(/^Inventory · \d+ not placed$/);
  expect(s.getByTestId('drawer-title').props.accessibilityLabel).not.toContain('·');
  expect(s.getByTestId('drawer-tabs').props.accessibilityRole).toBe('tablist');
  expect(s.getByTestId('drawer-tab-all').props.accessibilityState.selected).toBe(true);
});

it('tapping a tile picks it; its row shows Place; a desk tile shows Replace desk', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ picked: 'plant.fern' })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(s.getByTestId('drawer-tile-plant.fern'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'pick', item: 'plant.fern' });
  fireEvent.press(s.getByTestId('drawer-place'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'place', item: 'plant.fern' });
  const desk = render(<InventoryDrawer state={state({ picked: 'desk.notebook' })} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(desk.getByTestId('drawer-place')).toHaveTextContent('Replace desk');
});

it('a ×0 tile stays, dimmed, and Place is disabled for it', () => {
  const s = render(<InventoryDrawer state={state({ picked: 'rug.slate' })} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-tile-rug.slate')).toHaveTextContent(/All placed/);
  expect(s.getByTestId('drawer-place').props.accessibilityState.disabled).toBe(true);
});

it('holding a tile drags it into the room through the room\'s handle (ruling 16)', () => {
  const r = room();
  render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={r} colour="coral" />);
  const g = getByGestureTestId('drawer-drag-corner.beanbag');
  act(() => fireGestureHandler(g, [{ state: State.BEGAN, absoluteX: 10, absoluteY: 600 }, { state: State.ACTIVE, absoluteX: 10, absoluteY: 600 }, { state: State.ACTIVE, absoluteX: 200, absoluteY: 200 }, { state: State.END, absoluteX: 200, absoluteY: 200 }]));
  expect(r.current!.lift).toHaveBeenCalledWith('corner.beanbag', 10, 600);
  expect(r.current!.move).toHaveBeenCalledWith(200, 200);
  expect(r.current!.drop).toHaveBeenCalled();
});

it('the Room tab applies a style; Sets asks before setting up a set', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ drawer: 'room' })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(s.getByTestId('drawer-tile-wall.dots'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'style', key: 'wallpaper', item: 'wall.dots' });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const owned = { ...counts, ...Object.fromEntries(['set.cottage.wallpaper', 'set.cottage.floor', 'set.cottage.window', 'set.cottage.art', 'set.cottage.shelf', 'set.cottage.desk', 'set.cottage.desk_item', 'set.cottage.lamp', 'set.cottage.corner', 'set.cottage.rug', 'set.cottage.pet'].map((id) => [id, 1])) };
  const sets = render(<InventoryDrawer state={state({ drawer: 'sets', counts: owned })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(sets.getByTestId('decorate-set-cottage-action'));
  expect(alert.mock.calls[0]![0]).toBe('Store everything and set up Cottage?');
  (alert.mock.calls[0]![2] as Array<{ onPress?: () => void }>)[1]!.onPress!();
  expect(dispatch).toHaveBeenCalledWith({ type: 'applySet', setId: 'cottage' });
});

it('the room-full card (spec §5.3): Store a piece, no growing before P2 (Review Focus 5)', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ outcome: { ok: false, refused: { reason: 'full' }, id: null } })} dispatch={dispatch} room={room()} colour="coral" />);
  expect(s.getByTestId('room-full')).toHaveTextContent(/^KIP's room is full\. 40 pieces fit this room\. Store something to make space, or grow the room/);
  expect(s.queryByText('See room sizes')).toBeNull();
  fireEvent.press(s.getByTestId('room-full-store'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'clearOutcome' });
  expect(s.getByTestId('room-full-hint')).toHaveTextContent('Tap a piece in the room, then Store.');
});

it('the drawer opens half height and grows to full', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  const half = s.getByTestId('drawer').props.style.height;
  fireEvent.press(s.getByTestId('drawer-handle'));
  expect(s.getByTestId('drawer').props.style.height).toBeGreaterThan(half);
  expect(s.getByTestId('drawer-handle').props.accessibilityLabel).toBe('Show less');
});

it('"How new things arrive" ends the drawer, each lead bold and its body after it', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-arrive-0')).toHaveTextContent(/^Badge families\. Sleep goal/);
});

it('a dimmed ×0 tile can be picked but never dragged in (ruling T13-CARRY)', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state()} dispatch={dispatch} room={room()} colour="coral" />);
  expect(() => getByGestureTestId('drawer-drag-rug.slate')).toThrow();
  expect(getByGestureTestId('drawer-drag-plant.fern')).toBeTruthy();
  fireEvent.press(s.getByTestId('drawer-tile-rug.slate'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'pick', item: 'rug.slate' });
});

it('tile labels are spoken without "·", with what is left and NEW', () => {
  const s = render(<InventoryDrawer state={{ ...state(), newIds: ['corner.beanbag'] }} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-tile-corner.beanbag').props.accessibilityLabel).toBe('Bean bag, 1 in inventory, new');
  expect(s.getByTestId('drawer-tile-corner.beanbag')).toHaveTextContent(/×1/);
  expect(s.getByTestId('drawer-tile-corner.beanbag')).toHaveTextContent(/NEW/);
});

it('at the cap Place is disabled for a picked piece and the room-full card shows (spec §5.3)', () => {
  const pieces = [...starterLayout().pieces, ...Array.from({ length: 33 }, (_, k) => ({ id: `w${k}`, item: 'art.calendar', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }))];
  const full = initEditor({ layout: { ...starterLayout(), pieces }, worn: EMPTY_WORN, tier: 1, counts: { ...counts, 'art.calendar': 40 }, version: 1, newIds: [] });
  const s = render(<InventoryDrawer state={{ ...full, picked: 'plant.fern' }} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-place').props.accessibilityState.disabled).toBe(true);
  expect(s.getByTestId('room-full')).toBeTruthy();
  // A desk still swaps at the cap: it replaces, it never adds.
  const desk = render(<InventoryDrawer state={{ ...full, picked: 'desk.notebook' }} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(desk.getByTestId('drawer-place').props.accessibilityState.disabled).toBe(false);
  expect(desk.queryByTestId('room-full')).toBeNull();
});
