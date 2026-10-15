import React from 'react';
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { EditRoom, EDIT_CELL_PT, initialPan } from '../../src/components/edit/EditRoom';
import { initEditor } from '../../src/lib/room/edit/editor';
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
