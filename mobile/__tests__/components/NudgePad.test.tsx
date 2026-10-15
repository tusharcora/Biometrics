import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NudgePad } from '../../src/components/edit/NudgePad';
import { editorReducer, initEditor, type EditorAction } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const base = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const nudging = (id: string) => [{ type: 'select', id }, { type: 'nudging', on: true }].reduce((s, a) => editorReducer(s, a as EditorAction), base);

it('a floor piece gets the four tile-axis arrows and Put on…; every target is 44 points; labels have no "·"', () => {
  const dispatch = jest.fn();
  const s = render(<NudgePad state={nudging('plant')} dispatch={dispatch} />);
  for (const dir of ['backLeft', 'backRight', 'frontLeft', 'frontRight']) expect(s.getByTestId(`edit-nudge-${dir}`)).toBeTruthy();
  expect(s.queryByTestId('edit-nudge-up')).toBeNull();
  fireEvent.press(s.getByTestId('edit-nudge-frontRight'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'nudge', dir: 'frontRight' });
  expect(s.getByTestId('edit-nudge-frontRight').props.accessibilityLabel).toBe('Move front right');
  for (const b of s.getAllByRole('button')) expect(String(b.props.accessibilityLabel ?? '')).not.toMatch(/·/);
  fireEvent.press(s.getByTestId('edit-put-desk'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'putOn', parent: 'desk', spot: 1 });
});

it('a wall piece moves along its wall and up or down; an on-top piece only gets Put on…', () => {
  const wall = render(<NudgePad state={nudging('plank')} dispatch={jest.fn()} />);
  expect(['backLeft', 'frontRight', 'up', 'down'].every((d) => wall.queryByTestId(`edit-nudge-${d}`))).toBe(true);
  expect(wall.queryByTestId('edit-nudge-frontLeft')).toBeNull();
  const top = render(<NudgePad state={nudging('deskitem')} dispatch={jest.fn()} />);
  expect(top.queryByTestId('edit-nudge-frontRight')).toBeNull();
  expect(top.getByTestId('edit-put-plank')).toBeTruthy();
});

it('every button is drawn 44 points tall (not the 36-point default topped up by slop), and Done moving ends Move', () => {
  const dispatch = jest.fn();
  const onDesk = editorReducer(editorReducer(nudging('plant'), { type: 'putOn', parent: 'desk', spot: 1 }), { type: 'nudging', on: true });
  for (const state of [nudging('plank'), nudging('plant'), onDesk]) {
    const s = render(<NudgePad state={state} dispatch={dispatch} />);
    for (const b of s.getAllByRole('button')) {
      const classes = String(b.props.className).split(' ');
      expect(classes).toContain('h-[44px]');
      expect(classes).not.toContain('h-[36px]');
    }
    s.unmount();
  }
  const s = render(<NudgePad state={nudging('plank')} dispatch={dispatch} />);
  fireEvent.press(s.getByTestId('edit-nudge-done'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'nudging', on: false });
});

it('Put on the floor sends the piece back down; the pad itself has no status line (it is pinned, ruling T14-FIX)', () => {
  const dispatch = jest.fn();
  const onDesk = [{ type: 'putOn', parent: 'desk', spot: 1 }, { type: 'nudging', on: true }].reduce((s, a) => editorReducer(s, a as EditorAction), nudging('plant'));
  const s = render(<NudgePad state={onDesk} dispatch={dispatch} />);
  expect(s.getByTestId('edit-put-floor')).toHaveTextContent('On the floor');
  fireEvent.press(s.getByTestId('edit-put-floor'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'toFloor' });
  const refused = editorReducer(nudging('plant'), { type: 'nudge', dir: 'backLeft' });
  const r = render(<NudgePad state={refused} dispatch={jest.fn()} />);
  expect(r.queryByTestId('edit-nudge-status')).toBeNull();
});

it('shows nothing when Move is off or nothing is selected', () => {
  expect(render(<NudgePad state={editorReducer(base, { type: 'select', id: 'plant' })} dispatch={jest.fn()} />).toJSON()).toBeNull();
  expect(render(<NudgePad state={{ ...base, nudging: true }} dispatch={jest.fn()} />).toJSON()).toBeNull();
});
