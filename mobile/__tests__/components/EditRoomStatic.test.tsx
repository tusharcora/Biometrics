import React from 'react';
import { render } from '@testing-library/react-native';
import { EditRoom } from '../../src/components/edit/EditRoom';
import { editorReducer, initEditor } from '../../src/lib/room/edit/editor';
import * as isoRoom from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

// The real RoomView (EditRoom.test.tsx stands it in): the static room is built once per change (final review M2).
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => true }));

const STATE = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const props = { width: 390, height: 320, window: { weather: 'clear' as const, night: false }, colour: 'coral' as const, reduceMotion: true, showGrid: false, dispatch: jest.fn() };

it('builds the static room once for its hit boxes and the picture, and once again per change', () => {
  const build = jest.spyOn(isoRoom, 'drawIsoStatic');
  const s = render(<EditRoom {...props} state={STATE} />);
  expect(build).toHaveBeenCalledTimes(1);
  const flipped = editorReducer(editorReducer(STATE, { type: 'select', id: 'plant' }), { type: 'flip' });
  s.rerender(<EditRoom {...props} state={flipped} />);
  expect(build).toHaveBeenCalledTimes(2);
  s.rerender(<EditRoom {...props} state={{ ...flipped, selected: null }} />);
  expect(build).toHaveBeenCalledTimes(2);
  build.mockRestore();
});
