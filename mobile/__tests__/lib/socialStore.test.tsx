import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { fetchSocialHome } from '../../src/api/social';
import { getSocialState, refreshSocial, resetSocial, useSocialUnread, useSocialUnreadCount } from '../../src/lib/socialStore';

jest.mock('../../src/api/social', () => ({ fetchSocialHome: jest.fn() }));
const fetchHome = fetchSocialHome as jest.Mock;
const home = (requests: number, stickers: number) => ({ me: {}, camp: { checkedIn: 0, members: 1, faces: [] }, stories: [], highlights: null, timeline: [], unread: { requests, stickers } });
beforeEach(() => { fetchHome.mockReset(); resetSocial(); });

it('is unavailable on an older server, and keeps the last good home after an error', async () => {
  fetchHome.mockResolvedValueOnce(null);
  await refreshSocial();
  expect(getSocialState()).toEqual({ status: 'unavailable' });
  fetchHome.mockResolvedValueOnce(home(1, 0));
  await refreshSocial();
  expect(getSocialState()).toMatchObject({ status: 'ready' });
  fetchHome.mockRejectedValueOnce(new Error('offline'));
  await refreshSocial();
  expect(getSocialState()).toMatchObject({ status: 'ready' });
  resetSocial();
  fetchHome.mockRejectedValueOnce(new Error('offline'));
  await refreshSocial();
  expect(getSocialState()).toEqual({ status: 'error' });
});

it('the unread flag and count cover requests and unseen stickers', async () => {
  function Probe() { return <Text testID="dot">{`${String(useSocialUnread())}:${useSocialUnreadCount()}`}</Text>; }
  render(<Probe />);
  expect(screen.getByTestId('dot')).toHaveTextContent('false:0');
  fetchHome.mockResolvedValueOnce(home(1, 2));
  await act(() => refreshSocial());
  expect(screen.getByTestId('dot')).toHaveTextContent('true:3');
  fetchHome.mockResolvedValueOnce(home(0, 0));
  await act(() => refreshSocial());
  expect(screen.getByTestId('dot')).toHaveTextContent('false:0');
});
