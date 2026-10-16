import React from 'react';
import { render } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { EditNotices } from '../../src/components/edit/EditNotices';
import { initEditor, type EditorState } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const STATE = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const refused = (s: EditorState): EditorState => ({ ...s, outcome: { ok: false, refused: { reason: 'seat' }, id: 'plant' } });

let announce: jest.SpyInstance;
beforeEach(() => { announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined); });
afterEach(() => announce.mockRestore());

it('shows nothing when there is nothing to say', () => {
  const s = render(<EditNotices state={STATE} />);
  expect([s.queryByTestId('edit-notice'), s.queryByTestId('edit-reason'), s.queryByTestId('edit-applied')]).toEqual([null, null, null]);
  expect(announce).not.toHaveBeenCalled();
});

it.each(['ios', 'android'] as const)('shows a refusal\'s reason and announces each refusal once, on %s too (rulings UI-OUTCOMES, T14-FIX)', (os) => {
  const platform = Platform.OS;
  Platform.OS = os;
  try {
    const s = render(<EditNotices state={refused(STATE)} />);
    expect(s.getByTestId('edit-reason')).toHaveTextContent("Blocks KIP's chair");
    // Announced, so not a live region too: said once, never twice over.
    expect(s.getByTestId('edit-reason').props.accessibilityLiveRegion).toBeUndefined();
    expect(announce.mock.calls).toEqual([["Blocks KIP's chair"]]);
    // The same refusal again is a new outcome, so it is said again: a live region would stay quiet on the same text.
    const again = refused(STATE);
    s.rerender(<EditNotices state={again} />);
    expect(announce).toHaveBeenCalledTimes(2);
    // Another render with the same outcome says nothing new.
    s.rerender(<EditNotices state={{ ...again, notice: 'saveFailed' }} />);
    expect(announce).toHaveBeenCalledTimes(2);
  } finally {
    Platform.OS = platform;
  }
});

it('says what Apply set left out, and the save notices', () => {
  const applied: EditorState = { ...STATE, outcome: { ok: true, id: null, applied: { setId: 'cottage', missing: [], deskKept: false } } };
  const s = render(<EditNotices state={applied} />);
  expect(s.getByTestId('edit-applied')).toHaveTextContent('Cottage set applied.');
  expect(announce).toHaveBeenLastCalledWith('Cottage set applied.');
  s.rerender(<EditNotices state={{ ...STATE, notice: 'refreshed' }} />);
  expect(s.getByTestId('edit-notice')).toHaveTextContent('Something changed on another device. Your room was refreshed.');
  s.rerender(<EditNotices state={{ ...STATE, notice: 'saveFailed' }} />);
  expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
});
