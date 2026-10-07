import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchBuddyPage } from '../../src/api/buddies';
import { BuddiesRow } from '../../src/components/home/BuddiesRow';
import { Character } from '../../src/components/characters/Character';
import { DEFAULT_CHARACTER_ID } from '../../src/components/characters/types';
import { refreshBuddies, resetBuddies } from '../../src/lib/buddiesStore';

jest.mock('../../src/api/buddies', () => ({ fetchBuddyPage: jest.fn() }));
const load = fetchBuddyPage as jest.Mock;
const row = (i: number) => ({ id: `b${i}`, handle: `h${i}`, displayName: `B${i}`, coachId: 'luna', mood: i % 2 ? 'low' : 'good', moodLine: '', unseenSticker: false });

beforeEach(() => {
  jest.clearAllMocks();
  resetBuddies();
});

it('stays hidden with no buddies and no pending requests, and against an old backend', async () => {
  load.mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 });
  render(<BuddiesRow onOpen={jest.fn()} />);
  await act(async () => { await refreshBuddies(); });
  expect(screen.queryByTestId('home-buddies-row')).toBeNull();
  load.mockResolvedValue(null);
  await act(async () => { await refreshBuddies(); });
  expect(screen.queryByTestId('home-buddies-row')).toBeNull();
});

it('shows up to 5 buddies with mood dots, a pending-request line, and opens Buddies', async () => {
  load.mockResolvedValue({ buddies: [1, 2, 3, 4, 5, 6].map(row), nextCursor: null, incomingRequests: 1, outgoingRequests: 0 });
  const onOpen = jest.fn();
  render(<BuddiesRow onOpen={onOpen} />);
  expect(await screen.findByTestId('home-buddies-row')).toBeTruthy();
  expect(screen.getByTestId('home-buddy-b5')).toBeTruthy();
  expect(screen.queryByTestId('home-buddy-b6')).toBeNull();
  expect(screen.getByTestId('home-buddy-b1-dot')).toHaveStyle({ backgroundColor: '#FDBA74' });
  expect(screen.getByTestId('home-buddies-requests')).toHaveTextContent('1 buddy request');
  fireEvent.press(screen.getByTestId('home-buddies-row'));
  expect(onOpen).toHaveBeenCalled();
});

it('shows for a pending request alone', async () => {
  load.mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 2 });
  render(<BuddiesRow onOpen={jest.fn()} />);
  expect(await screen.findByTestId('home-buddies-row')).toBeTruthy();
});

it('a sprite tap opens Buddies, and the label holds no buddy data', async () => {
  load.mockResolvedValue({ buddies: [row(1), row(2)], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 });
  const onOpen = jest.fn();
  render(<BuddiesRow onOpen={onOpen} />);
  expect(await screen.findByTestId('home-buddy-b2-dot')).toHaveStyle({ backgroundColor: '#86EFAC' });
  expect(screen.getByTestId('home-buddies-row').props.accessibilityLabel).toBe('Buddies, see all');
  fireEvent.press(screen.getByTestId('home-buddy-b2'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('falls back to the default coach for an unknown coachId', async () => {
  load.mockResolvedValue({ buddies: [{ ...row(1), coachId: 'not-a-coach' }, row(2)], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 });
  render(<BuddiesRow onOpen={jest.fn()} />);
  await screen.findByTestId('home-buddies-row');
  expect(screen.UNSAFE_getAllByType(Character).map((c) => c.props.characterId)).toEqual([DEFAULT_CHARACTER_ID, 'luna']);
});

it('stays hidden after a failed first load, and keeps the last good page after a later failure', async () => {
  load.mockRejectedValue(new Error('bad_buddies'));
  render(<BuddiesRow onOpen={jest.fn()} />);
  await act(async () => { await refreshBuddies(); });
  expect(screen.queryByTestId('home-buddies-row')).toBeNull();
  load.mockResolvedValue({ buddies: [row(1)], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 });
  await act(async () => { await refreshBuddies(); });
  expect(screen.getByTestId('home-buddy-b1')).toBeTruthy();
  load.mockRejectedValue(new Error('bad_buddies'));
  await act(async () => { await refreshBuddies(); });
  expect(screen.getByTestId('home-buddy-b1')).toBeTruthy();
});
