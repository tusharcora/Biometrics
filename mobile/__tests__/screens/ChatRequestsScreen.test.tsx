import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { acceptRequest, blockFromRequest, cancelRequest, declineRequest, fetchIdentity, fetchRequests } from '../../src/api/buddies';
import { offerPushAfterPairing } from '../../src/lib/buddyPushOffer';
import { refreshSocial } from '../../src/lib/socialStore';
import { ChatRequestsScreen } from '../../src/screens/ChatRequestsScreen';

let mockChats: boolean | null = true;
jest.mock('../../src/lib/socialStore', () => ({ refreshSocial: jest.fn(), useChatsAvailable: () => mockChats }));
jest.mock('../../src/lib/buddiesStore', () => ({ refreshBuddies: jest.fn() }));
jest.mock('../../src/lib/buddyPushOffer', () => ({ offerPushAfterPairing: jest.fn(() => new Promise(() => undefined)) }));
jest.mock('../../src/api/buddies', () => ({
  ...jest.requireActual('../../src/api/buddies'),
  fetchIdentity: jest.fn(),
  fetchRequests: jest.fn(),
  acceptRequest: jest.fn(),
  declineRequest: jest.fn(),
  blockFromRequest: jest.fn(),
  cancelRequest: jest.fn(),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ navigate: mockNavigate }) }));
const person = (id: string, name: string) => ({ id, handle: id, displayName: name, coachId: 'pengu' });

beforeEach(() => {
  jest.clearAllMocks();
  mockChats = true;
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'me', displayName: 'Me', displayNamePrefill: '', moodNoticeSeen: true });
  (fetchRequests as jest.Mock).mockResolvedValue({
    incoming: [{ id: 'r1', createdAt: '', from: person('u1', 'Ana') }, { id: 'r2', createdAt: '', from: person('u2', 'Ben') }],
    outgoing: [{ id: 'r3', createdAt: '', toHandle: 'cy' }],
  });
  (acceptRequest as jest.Mock).mockResolvedValue({ ok: true, buddyId: 'u1' });
});

it("answers requests in Chats: accept opens the new buddy's thread, decline is quiet, block asks first; mine read Pending", async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());
  render(<ChatRequestsScreen />);
  expect(await screen.findByTestId('request-in-r1')).toBeTruthy();
  expect(screen.getByTestId('request-out-r3')).toHaveTextContent(/Pending/);
  await act(async () => fireEvent.press(screen.getByTestId('request-accept-r1')));
  expect(mockNavigate).toHaveBeenCalledWith('ChatThread', { buddyId: 'u1' });
  expect(offerPushAfterPairing).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent.press(screen.getByTestId('request-decline-r2')));
  expect(declineRequest).toHaveBeenCalledWith('r2');
  await act(async () => fireEvent.press(screen.getByTestId('request-block-r2')));
  await waitFor(() => expect(blockFromRequest).toHaveBeenCalledWith('r2'));
  await act(async () => fireEvent.press(screen.getByTestId('request-cancel-r3')));
  expect(cancelRequest).toHaveBeenCalledWith('r3');
  expect(refreshSocial).toHaveBeenCalled();
  alert.mockRestore();
});

it('on a server without chats, accepting opens the buddy\'s week', async () => {
  mockChats = false;
  render(<ChatRequestsScreen />);
  const target = await screen.findByTestId('request-accept-r1');
  await act(async () => fireEvent.press(target));
  expect(mockNavigate).toHaveBeenCalledWith('BuddyWeek', { buddyId: 'u1' });
});
