import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  acceptRequest, blockFromRequest, confirmMoodNotice, declineRequest, fetchActivity, fetchBuddyPage, fetchIdentity, fetchRequests, markActivitySeen,
} from '../../src/api/buddies';
import { resetBuddies } from '../../src/lib/buddiesStore';
import { BuddiesScreen } from '../../src/screens/BuddiesScreen';

jest.mock('../../src/api/buddies', () => ({
  ...jest.requireActual('../../src/api/buddies'),
  fetchIdentity: jest.fn(),
  fetchBuddyPage: jest.fn(),
  fetchRequests: jest.fn(),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  blockFromRequest: jest.fn(),
  cancelRequest: jest.fn(),
  fetchActivity: jest.fn(),
  markActivitySeen: jest.fn(),
  confirmMoodNotice: jest.fn(),
}));
const mockNavigate = jest.fn();
let mockParams: { tab?: string } | undefined;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
  NavigationContext: require('react').createContext(undefined),
}));

const person = (id: string, name: string) => ({ id, handle: id, displayName: name, coachId: 'pengu' });
const row = (id: string, name: string, over: object = {}) => ({ ...person(id, name), mood: 'good', moodLine: 'Well rested', unseenSticker: false, ...over });
const ACTIVITY = { items: [], nextCursor: null, unseen: 0 };
const EMPTY_PAGE = { buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  resetBuddies();
  mockParams = undefined;
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'me', displayName: 'Me', displayNamePrefill: '', moodNoticeSeen: true });
  (fetchActivity as jest.Mock).mockResolvedValue(ACTIVITY);
  (fetchRequests as jest.Mock).mockResolvedValue({ incoming: [], outgoing: [] });
});

it('lists buddies with their mood line and unseen sticker dot, loads the next page at the end, and opens a week', async () => {
  (fetchBuddyPage as jest.Mock).mockImplementation(async (cursor?: string) =>
    cursor === 'c2'
      ? { buddies: [row('b3', 'Cy')], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 }
      : { buddies: [row('b1', 'Ana', { unseenSticker: true }), row('b2', 'Ben', { mood: 'low', moodLine: 'Running low today' })], nextCursor: 'c2', incomingRequests: 0, outgoingRequests: 0 },
  );
  render(<BuddiesScreen />);
  expect(await screen.findByTestId('buddy-row-b1')).toBeTruthy();
  expect(screen.getByTestId('buddy-row-b2-mood')).toHaveTextContent('Running low today');
  expect(screen.getByTestId('buddy-row-b1-unseen')).toBeTruthy();
  await act(async () => fireEvent(screen.getByTestId('buddies-list'), 'onEndReached'));
  expect(await screen.findByTestId('buddy-row-b3')).toBeTruthy();
  fireEvent.press(screen.getByTestId('buddy-row-b2'));
  expect(mockNavigate).toHaveBeenCalledWith('BuddyWeek', { buddyId: 'b2' });
  fireEvent.press(screen.getByTestId('buddies-add'));
  expect(mockNavigate).toHaveBeenCalledWith('PairUp');
});

it('drops a buddy repeated across pages and stops at the last page', async () => {
  (fetchBuddyPage as jest.Mock).mockImplementation(async (cursor?: string) =>
    cursor === 'c2'
      ? { buddies: [row('b2', 'Ben'), row('b3', 'Cy'), row('b3', 'Cy')], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 }
      : { buddies: [row('b1', 'Ana'), row('b2', 'Ben')], nextCursor: 'c2', incomingRequests: 0, outgoingRequests: 0 },
  );
  render(<BuddiesScreen />);
  expect(await screen.findByTestId('buddy-row-b1')).toBeTruthy();
  await act(async () => fireEvent(screen.getByTestId('buddies-list'), 'onEndReached'));
  expect(await screen.findByTestId('buddy-row-b3')).toBeTruthy();
  expect(screen.getAllByTestId('buddy-row-b2')).toHaveLength(1);
  expect(screen.getAllByTestId('buddy-row-b3')).toHaveLength(1);
  await act(async () => fireEvent(screen.getByTestId('buddies-list'), 'onEndReached'));
  // The first page (store refresh on mount) and the one page after it; nothing past the last page.
  expect((fetchBuddyPage as jest.Mock).mock.calls.filter(([c]) => c === 'c2')).toHaveLength(1);
});

it('answers requests: accept opens the week, decline is quiet, block asks first; outgoing ones read Pending', async () => {
  (fetchBuddyPage as jest.Mock).mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: 2, outgoingRequests: 1 });
  (fetchRequests as jest.Mock).mockResolvedValue({
    incoming: [{ id: 'r1', createdAt: '', from: person('u1', 'Ana') }, { id: 'r2', createdAt: '', from: person('u2', 'Ben') }],
    outgoing: [{ id: 'r3', createdAt: '', toHandle: 'cy' }],
  });
  (acceptRequest as jest.Mock).mockResolvedValue({ ok: true, buddyId: 'u1' });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());
  mockParams = { tab: 'requests' };
  render(<BuddiesScreen />);
  expect(await screen.findByTestId('request-in-r1')).toBeTruthy();
  expect(screen.getByTestId('request-out-r3')).toHaveTextContent(/Pending/);
  await act(async () => fireEvent.press(screen.getByTestId('request-accept-r1')));
  expect(acceptRequest).toHaveBeenCalledWith('r1');
  expect(mockNavigate).toHaveBeenCalledWith('BuddyWeek', { buddyId: 'u1' });
  await act(async () => fireEvent.press(screen.getByTestId('request-decline-r2')));
  expect(declineRequest).toHaveBeenCalledWith('r2');
  await act(async () => fireEvent.press(screen.getByTestId('request-block-r2')));
  expect(alert).toHaveBeenCalled();
  await waitFor(() => expect(blockFromRequest).toHaveBeenCalledWith('r2'));
  alert.mockRestore();
});

it('accepts once on a double tap and refreshes the shared list after it', async () => {
  (fetchBuddyPage as jest.Mock).mockResolvedValue(EMPTY_PAGE);
  (fetchRequests as jest.Mock).mockResolvedValue({ incoming: [{ id: 'r1', createdAt: '', from: person('u1', 'Ana') }], outgoing: [] });
  let release: (v: unknown) => void = () => undefined;
  (acceptRequest as jest.Mock).mockReturnValue(new Promise((r) => (release = r)));
  mockParams = { tab: 'requests' };
  render(<BuddiesScreen />);
  const accept = await screen.findByTestId('request-accept-r1');
  await waitFor(() => expect(fetchBuddyPage).toHaveBeenCalled());
  const before = (fetchBuddyPage as jest.Mock).mock.calls.length;
  act(() => {
    fireEvent.press(accept);
    fireEvent.press(accept);
  });
  expect(acceptRequest).toHaveBeenCalledTimes(1);
  await act(async () => release({ ok: true, buddyId: 'u1' }));
  await waitFor(() => expect((fetchBuddyPage as jest.Mock).mock.calls.length).toBeGreaterThan(before));
  expect(mockNavigate).toHaveBeenCalledWith('BuddyWeek', { buddyId: 'u1' });
});

it('holds accept behind the mood notice, and Not now leaves it free to try again', async () => {
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'me', displayName: 'Me', displayNamePrefill: '', moodNoticeSeen: false });
  (fetchBuddyPage as jest.Mock).mockResolvedValue(EMPTY_PAGE);
  (fetchRequests as jest.Mock).mockResolvedValue({ incoming: [{ id: 'r1', createdAt: '', from: person('u1', 'Ana') }], outgoing: [] });
  (acceptRequest as jest.Mock).mockResolvedValue({ ok: true, buddyId: 'u1' });
  (confirmMoodNotice as jest.Mock).mockResolvedValue(undefined);
  mockParams = { tab: 'requests' };
  render(<BuddiesScreen />);
  fireEvent.press(await screen.findByTestId('request-accept-r1'));
  expect(await screen.findByTestId('mood-notice')).toBeTruthy();
  expect(acceptRequest).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByTestId('mood-notice-cancel')));
  fireEvent.press(screen.getByTestId('request-accept-r1'));
  await act(async () => fireEvent.press(await screen.findByTestId('mood-notice-confirm')));
  await waitFor(() => expect(acceptRequest).toHaveBeenCalledTimes(1));
  expect(mockNavigate).toHaveBeenCalledWith('BuddyWeek', { buddyId: 'u1' });
});

it('shows a neutral label for an outgoing request sent before handles were kept', async () => {
  (fetchBuddyPage as jest.Mock).mockResolvedValue(EMPTY_PAGE);
  (fetchRequests as jest.Mock).mockResolvedValue({ incoming: [], outgoing: [{ id: 'r9', createdAt: '', toHandle: '' }] });
  mockParams = { tab: 'requests' };
  render(<BuddiesScreen />);
  expect(await screen.findByTestId('request-out-r9')).toHaveTextContent(/^Pending request/);
  expect(screen.queryByText(/@/)).toBeNull();
});

it('marks the Activity tab with a dot until it is opened, then marks everything seen', async () => {
  (fetchBuddyPage as jest.Mock).mockResolvedValue({ buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 });
  (fetchActivity as jest.Mock).mockResolvedValue({
    items: [{ id: 'a1', kind: 'sticker', sticker: 'STAR', createdAt: '2026-10-07T12:00:00Z', seen: false, actor: person('u1', 'Ana') }],
    nextCursor: null,
    unseen: 1,
  });
  (markActivitySeen as jest.Mock).mockResolvedValue(undefined);
  render(<BuddiesScreen />);
  expect(await screen.findByText('Activity •')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByTestId('buddies-tabs-activity')));
  expect(await screen.findByTestId('activity-a1')).toHaveTextContent('Ana sent you a Star');
  expect(screen.getByTestId('activity-a1-unseen')).toBeTruthy();
  await waitFor(() => expect(markActivitySeen).toHaveBeenCalled());
  expect(screen.getByText('Activity')).toBeTruthy();
  expect(markActivitySeen).toHaveBeenCalledTimes(1);
});

it('shows a request in Activity without a status or an Accept button, and opens Requests from it', async () => {
  (fetchBuddyPage as jest.Mock).mockResolvedValue(EMPTY_PAGE);
  (fetchActivity as jest.Mock).mockResolvedValue({
    items: [{ id: 'a2', kind: 'request', requestId: 'r1', createdAt: '2026-10-07T12:00:00Z', seen: true, actor: person('u1', 'Ana') }],
    nextCursor: null,
    unseen: 0,
  });
  mockParams = { tab: 'activity' };
  render(<BuddiesScreen />);
  expect(await screen.findByTestId('activity-a2')).toHaveTextContent('Ana wants to be your buddy');
  expect(screen.queryByText('Accept')).toBeNull();
  expect(markActivitySeen).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('activity-a2'));
  expect(mockNavigate).toHaveBeenCalledWith('Buddies', { tab: 'requests' });
});
