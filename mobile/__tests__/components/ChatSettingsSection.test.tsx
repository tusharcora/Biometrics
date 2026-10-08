import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchChatSettings, saveChatSettings } from '../../src/api/chats';
import { fetchBuddyPage } from '../../src/api/buddies';
import { refreshBuddies, resetBuddies } from '../../src/lib/buddiesStore';
import { ChatSettingsSection } from '../../src/components/chats/ChatSettingsSection';

jest.mock('../../src/api/chats', () => ({ fetchChatSettings: jest.fn(), saveChatSettings: jest.fn() }));
jest.mock('../../src/api/buddies', () => ({ fetchBuddyPage: jest.fn() }));
const PAGE = { buddies: [], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 };

beforeEach(async () => {
  jest.clearAllMocks();
  resetBuddies();
  (fetchBuddyPage as jest.Mock).mockResolvedValue(PAGE);
  await refreshBuddies();
});

it('shows both switches as the server has them and saves each on its own; a failure keeps the saved value', async () => {
  (fetchChatSettings as jest.Mock).mockResolvedValue({ readReceipts: true, activityStatus: true });
  (saveChatSettings as jest.Mock).mockResolvedValueOnce({ readReceipts: false, activityStatus: true }).mockRejectedValueOnce(new Error('offline'));
  render(<ChatSettingsSection />);
  const receipts = await screen.findByTestId('chat-read-receipts-toggle');
  expect(receipts.props.value).toBe(true);
  await act(async () => fireEvent(receipts, 'valueChange', false));
  expect(saveChatSettings).toHaveBeenCalledWith({ readReceipts: false });
  expect(screen.getByTestId('chat-read-receipts-toggle').props.value).toBe(false);
  await act(async () => fireEvent(screen.getByTestId('chat-activity-toggle'), 'valueChange', false));
  expect(screen.getByTestId('chat-activity-toggle').props.value).toBe(true);
  expect(screen.getByTestId('chat-settings-message')).toHaveTextContent('Your chat setting could not be saved. Please try again.');
});

it('is hidden on a server without chats', async () => {
  (fetchChatSettings as jest.Mock).mockResolvedValue(null);
  render(<ChatSettingsSection />);
  await act(async () => undefined);
  expect(screen.queryByTestId('chat-settings')).toBeNull();
});
