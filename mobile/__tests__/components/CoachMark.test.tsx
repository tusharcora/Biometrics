import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { CoachMark } from '../../src/components/edit/CoachMark';
import { initEditor } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const coach = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] }, { coach: true });

it('Skip and Place are drawn 44 points tall (not the default topped up by slop), as the editor\'s tools (ruling T15-FIX)', async () => {
  const dispatch = jest.fn();
  const s = render(<CoachMark state={coach} dispatch={dispatch} placeAtOnce />);
  await act(async () => undefined);
  const buttons = s.getAllByRole('button');
  expect(buttons.map((b) => b.props.testID)).toEqual(['coach-skip', 'coach-place']);
  for (const b of buttons) {
    const classes = String(b.props.className).split(' ');
    expect(classes).toContain('h-[44px]');
    expect(classes).not.toContain('h-[32px]');
    expect(classes).not.toContain('h-[36px]');
  }
  fireEvent.press(s.getByTestId('coach-skip'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'coach', step: null });
});

it('without placeAtOnce, Place waits (the 10-second offer)', async () => {
  const s = render(<CoachMark state={coach} dispatch={jest.fn()} />);
  await act(async () => undefined);
  expect(s.queryByTestId('coach-place')).toBeNull();
});
