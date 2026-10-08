import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { clearStatusNote, fetchChats, fetchNotes, fileReport, saveStatusNote, sendStickerMessage, type ChatRow, type ChatsPage } from '../../src/api/chats';
import { blockBuddy } from '../../src/api/buddies';
import { refreshBuddies } from '../../src/lib/buddiesStore';
import { ChatsScreen } from '../../src/screens/ChatsScreen';

jest.mock('../../src/api/chats', () => ({
  ...jest.requireActual('../../src/api/chats'),
  fetchChats: jest.fn(),
  fetchNotes: jest.fn(),
  saveStatusNote: jest.fn(() => Promise.resolve({ note: {} })),
  clearStatusNote: jest.fn(() => Promise.resolve()),
  sendStickerMessage: jest.fn(() => Promise.resolve({ message: {} })),
  fileReport: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../src/api/buddies', () => ({ ...jest.requireActual('../../src/api/buddies'), blockBuddy: jest.fn(() => Promise.resolve()) }));
const person = (id: string, name = id.toUpperCase()) => ({ id, handle: id, displayName: name, coachId: 'mochi' });
const mockHome = { me: { person: person('tushar'), checkIn: null }, stories: [{ author: person('ben'), unseen: true }], unread: { requests: 2, stickers: 0, chats: 1 } };
jest.mock('../../src/lib/socialStore', () => ({ refreshSocial: jest.fn(), useSocial: () => ({ status: 'ready', home: mockHome }) }));
const mockBuddies = { status: 'ready', page: { buddies: [{ ...person('ana', 'Ana'), mood: 'good', moodLine: '', unseenSticker: false }], nextCursor: null, incomingRequests: 0, outgoingRequests: 0 } };
jest.mock('../../src/lib/buddiesStore', () => ({ useBuddies: () => mockBuddies, refreshBuddies: jest.fn() }));
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (cb: () => void) => { const React = require('react'); React.useEffect(cb, []); },
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = () => render(<SafeAreaProvider initialMetrics={metrics}><ChatsScreen /></SafeAreaProvider>);
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const row = (id: string, name: string, over: Partial<ChatRow> = {}): ChatRow => ({
  buddy: person(id, name), lastMessage: { mine: false, kind: 'TEXT', text: 'rough night lol', sticker: null, cardType: null, at: ago(2) }, unread: 0, activeAt: null, ...over,
});
const PAGE: ChatsPage = {
  chats: [
    row('ben', 'Ben', { unread: 2, activeAt: ago(1) }),
    row('sam', 'Sam', { lastMessage: { mine: false, kind: 'STICKER', text: null, sticker: 'CHEER', cardType: null, at: ago(14) } }),
  ],
  nextCursor: null,
  requests: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchChats as jest.Mock).mockResolvedValue(PAGE);
  (fetchNotes as jest.Mock).mockResolvedValue({ mine: null, buddies: [{ person: person('ana', 'Ana'), text: 'day 6 streak!', createdAt: ago(60), expiresAt: ago(-60) }] });
});

it('lists conversations with their line, unread weight, story ring and active dot; rows, Requests and Cheer work', async () => {
  renderScreen();
  expect(await screen.findByTestId('chats-handle')).toHaveTextContent('@tushar');
  expect(screen.getByTestId('chat-row-ben-line')).toHaveTextContent('rough night lol · 2m');
  expect(screen.getByTestId('chat-row-ben-unread')).toBeTruthy();
  expect(screen.getByTestId('chat-row-ben-avatar-active')).toBeTruthy();
  expect(screen.getByTestId('chat-row-sam-line')).toHaveTextContent('Sent a Cheer sticker · 14m');
  expect(screen.queryByTestId('chat-row-sam-unread')).toBeNull();
  expect(screen.getByTestId('chats-requests')).toHaveTextContent('Requests (2)');
  fireEvent.press(screen.getByTestId('chats-requests'));
  expect(mockNavigate).toHaveBeenLastCalledWith('ChatRequests');
  fireEvent.press(screen.getByTestId('chat-row-sam'));
  expect(mockNavigate).toHaveBeenLastCalledWith('ChatThread', { buddyId: 'sam' });
  await act(async () => fireEvent.press(screen.getByTestId('chat-row-sam-cheer')));
  expect(sendStickerMessage).toHaveBeenCalledWith('sam', 'CHEER');
  expect(screen.getByTestId('chats-message')).toHaveTextContent('Sent a Cheer');
  expect(fetchChats).toHaveBeenCalledTimes(2); // re-read after the sticker
});

it('a refused Cheer says why', async () => {
  (sendStickerMessage as jest.Mock).mockRejectedValueOnce(new ApiError(429, 'x', 'sticker_limit'));
  renderScreen();
  const target = await screen.findByTestId('chat-row-ben-cheer');
  await act(async () => fireEvent.press(target));
  expect(screen.getByTestId('chats-message')).toHaveTextContent(/5 stickers/);
});

it('search filters conversations by name or handle', async () => {
  renderScreen();
  fireEvent.changeText(await screen.findByTestId('chats-search'), 'SA');
  expect(screen.queryByTestId('chat-row-ben')).toBeNull();
  expect(screen.getByTestId('chat-row-sam')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('chats-search'), 'nobody');
  expect(screen.getByTestId('chats-empty')).toHaveTextContent('No chats match.');
});

it('notes: share mine with a count, open a buddy\'s note as a quote, report one', async () => {
  renderScreen();
  expect(await screen.findByTestId('note-mine')).toHaveTextContent('Share a note');
  expect(screen.getByTestId('note-ana')).toHaveTextContent('day 6 streak!');
  fireEvent.press(screen.getByTestId('note-mine'));
  fireEvent.changeText(screen.getByTestId('note-input'), 'early night tonight');
  expect(screen.getByTestId('note-count')).toHaveTextContent('19/60');
  await act(async () => fireEvent.press(screen.getByTestId('note-share')));
  expect(saveStatusNote).toHaveBeenCalledWith('early night tonight');
  fireEvent.press(screen.getByTestId('note-ana'));
  expect(mockNavigate).toHaveBeenLastCalledWith('ChatThread', { buddyId: 'ana', quote: { request: { type: 'note' }, label: "Ana's note" } });
  fireEvent(screen.getByTestId('note-ana'), 'longPress');
  await act(async () => fireEvent.press(screen.getByTestId('report-harassment')));
  expect(fileReport).not.toHaveBeenCalled(); // picking a reason files nothing
  await act(async () => fireEvent.press(screen.getByTestId('report-submit')));
  expect(fileReport).toHaveBeenCalledWith('status_note', 'ana', 'harassment');
  expect(blockBuddy).not.toHaveBeenCalled();
});

it('reporting a note with "Also block" ticked blocks its author and re-reads', async () => {
  renderScreen();
  fireEvent(await screen.findByTestId('note-ana'), 'longPress');
  fireEvent.press(screen.getByTestId('report-block'));
  await act(async () => fireEvent.press(screen.getByTestId('report-submit')));
  expect(fileReport).toHaveBeenCalledWith('status_note', 'ana', 'spam');
  expect(blockBuddy).toHaveBeenCalledWith('ana');
  expect(refreshBuddies).toHaveBeenCalled();
  expect(fetchChats).toHaveBeenCalledTimes(2);
});

it('a note over 60 can not be shared; my live note can be cleared', async () => {
  (fetchNotes as jest.Mock).mockResolvedValue({ mine: { text: 'gym at 6', createdAt: ago(5), expiresAt: ago(-60) }, buddies: [] });
  renderScreen();
  expect(await screen.findByTestId('note-mine')).toHaveTextContent('gym at 6');
  fireEvent.press(screen.getByTestId('note-mine'));
  expect(screen.getByTestId('note-input').props.value).toBe('gym at 6');
  fireEvent.changeText(screen.getByTestId('note-input'), 'x'.repeat(61));
  expect(screen.getByTestId('note-share')).toBeDisabled();
  await act(async () => fireEvent.press(screen.getByTestId('note-clear')));
  expect(clearStatusNote).toHaveBeenCalled();
  expect(screen.queryByTestId('note-composer')).toBeNull();
  expect(fetchNotes).toHaveBeenCalledTimes(2); // the inbox re-reads after clearing
});

it('a refused note shows why and keeps the sheet open', async () => {
  (saveStatusNote as jest.Mock).mockRejectedValueOnce(new ApiError(400, 'x', 'invalid_note'));
  renderScreen();
  fireEvent.press(await screen.findByTestId('note-mine'));
  fireEvent.changeText(screen.getByTestId('note-input'), 'early night');
  await act(async () => fireEvent.press(screen.getByTestId('note-share')));
  expect(screen.getByTestId('note-error')).toBeTruthy();
  expect(screen.getByTestId('note-composer')).toBeTruthy();
  expect(screen.getByTestId('note-input').props.value).toBe('early night');
});

it('a reload while composing keeps my draft', async () => {
  // Every read returns a fresh `mine` object, as the server does.
  (fetchNotes as jest.Mock).mockImplementation(async () => ({ mine: { text: 'gym at 6', createdAt: ago(5), expiresAt: ago(-60) }, buddies: [] }));
  renderScreen();
  fireEvent.press(await screen.findByTestId('note-mine'));
  fireEvent.changeText(screen.getByTestId('note-input'), 'gym at 7 now');
  await act(async () => fireEvent.press(screen.getByTestId('chat-row-ben-cheer'))); // a Cheer re-reads the inbox
  expect(fetchNotes).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('note-input').props.value).toBe('gym at 7 now');
});

it('a failed notes read keeps the notes already shown', async () => {
  renderScreen();
  expect(await screen.findByTestId('note-ana')).toBeTruthy();
  (fetchNotes as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => fireEvent.press(screen.getByTestId('chat-row-ben-cheer'))); // a Cheer re-reads the inbox
  expect(fetchNotes).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('note-ana')).toHaveTextContent('day 6 streak!');
});

it('New message picks a buddy and opens the thread', async () => {
  renderScreen();
  fireEvent.press(await screen.findByTestId('chats-new'));
  fireEvent.press(screen.getByTestId('new-chat-ana'));
  expect(mockNavigate).toHaveBeenLastCalledWith('ChatThread', { buddyId: 'ana' });
});

it('loads the next page at the end of the list', async () => {
  (fetchChats as jest.Mock).mockImplementation(async (cursor?: string) => (cursor === 'c2' ? { chats: [row('cy', 'Cy')], nextCursor: null, requests: 2 } : { ...PAGE, nextCursor: 'c2' }));
  renderScreen();
  await screen.findByTestId('chat-row-ben');
  await act(async () => fireEvent(screen.getByTestId('chats-list'), 'onEndReached'));
  expect(await screen.findByTestId('chat-row-cy')).toBeTruthy();
});

it('an older server says Chats is not here yet and offers Buddies; a failure offers a retry', async () => {
  (fetchChats as jest.Mock).mockResolvedValueOnce(null);
  const { unmount } = renderScreen();
  fireEvent.press(await screen.findByTestId('chats-open-buddies'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Buddies');
  unmount();
  (fetchChats as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  renderScreen();
  const target = await screen.findByTestId('chats-retry');
  await act(async () => fireEvent.press(target));
  expect(await screen.findByTestId('chat-row-ben')).toBeTruthy();
});
