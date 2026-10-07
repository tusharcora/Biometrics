import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError } from '../../src/api/client';
import { fetchStory, markStorySeen } from '../../src/api/social';
import { sendSticker } from '../../src/api/buddies';
import { refreshSocial } from '../../src/lib/socialStore';
import { SocialStoryScreen } from '../../src/screens/SocialStoryScreen';

jest.mock('../../src/api/social', () => ({ ...jest.requireActual('../../src/api/social'), fetchStory: jest.fn(), markStorySeen: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/api/buddies', () => ({ ...jest.requireActual('../../src/api/buddies'), sendSticker: jest.fn().mockResolvedValue({ id: 's' }) }));
jest.mock('../../src/lib/socialStore', () => ({
  refreshSocial: jest.fn(),
  useSocial: () => ({ status: 'ready', home: { me: { person: { id: 'me' } } } }),
}));
const mockGoBack = jest.fn();
let mockAuthorId = 'sam';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { authorId: mockAuthorId } }),
}));
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = () => render(<SafeAreaProvider initialMetrics={metrics}><SocialStoryScreen /></SafeAreaProvider>);
const sam = { id: 'sam', handle: 'sam', displayName: 'Sam', coachId: 'mochi' };
beforeEach(() => { jest.clearAllMocks(); (fetchStory as jest.Mock).mockReset(); mockAuthorId = 'sam'; });

it('plays a locked check-in and a badge, replies with a sticker, and marks the story seen on reaching the last frame', async () => {
  (fetchStory as jest.Mock).mockResolvedValue({ author: sam, localDate: '2026-10-07', frames: [
    { kind: 'checkin', at: '2026-10-07T14:00:00.000Z', locked: true },
    { kind: 'badge', at: '2026-10-07T15:00:00.000Z', family: 'SLEEP_GOAL', level: 2 },
  ] });
  renderScreen();
  expect(await screen.findByTestId('story-locked')).toHaveTextContent(/Check in to see how Sam woke up/);
  expect(screen.getByTestId('story-viewer-progress')).toBeTruthy();
  expect(markStorySeen).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByTestId('story-reply-CHEER')));
  expect(sendSticker).toHaveBeenCalledWith('sam', 'CHEER');
  expect(screen.getByTestId('story-message')).toHaveTextContent('Sent');
  await act(async () => fireEvent.press(screen.getByTestId('social-story-next')));
  expect(screen.getByTestId('story-frame-1')).toHaveTextContent(/Sleep goal streak II/);
  // Reaching the last frame is enough: seen now, even if they close here.
  expect(markStorySeen).toHaveBeenCalledWith('sam');
  expect(mockGoBack).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByTestId('social-story-prev')));
  await act(async () => fireEvent.press(screen.getByTestId('social-story-next')));
  await act(async () => fireEvent.press(screen.getByTestId('social-story-next')));
  expect(markStorySeen).toHaveBeenCalledTimes(1);
  expect(refreshSocial).toHaveBeenCalled();
  expect(mockGoBack).toHaveBeenCalled();
});

it('a one-frame story is seen as soon as it opens', async () => {
  (fetchStory as jest.Mock).mockResolvedValueOnce({ author: sam, localDate: '2026-10-07', frames: [{ kind: 'checkin', at: '2026-10-07T14:00:00.000Z', locked: false, mood: 'TIRED' }] });
  renderScreen();
  expect(await screen.findByTestId('story-frame-0')).toHaveTextContent(/Sam woke up.*Tired/);
  expect(markStorySeen).toHaveBeenCalledTimes(1);
});

it('a shared recap frame shows its headline line, never its stats', async () => {
  (fetchStory as jest.Mock).mockResolvedValueOnce({ author: { ...sam, displayName: '' }, localDate: '2026-10-07', frames: [
    { kind: 'recap', at: '2026-10-07T14:00:00.000Z', recapId: 'r1', recapKind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A steady week of sleep', coachId: 'mochi', stats: { hoursSlept: 7.4 } },
  ] });
  renderScreen();
  const frame = await screen.findByTestId('story-frame-0');
  expect(frame).toHaveTextContent(/Weekly recap/);
  expect(frame).toHaveTextContent(/A steady week of sleep/);
  expect(frame).not.toHaveTextContent(/7\.4/);
  // No display name: the handle (personName), never a blank.
  expect(screen.getByTestId('social-story-name')).toHaveTextContent('@sam');
});

it('the locked frame opens the check-in sheet and the story waits under it', async () => {
  (fetchStory as jest.Mock).mockResolvedValueOnce({ author: sam, localDate: '2026-10-07', frames: [
    { kind: 'checkin', at: '2026-10-07T14:00:00.000Z', locked: true },
    { kind: 'badge', at: '2026-10-07T15:00:00.000Z', family: 'SLEEP_GOAL', level: 1 },
  ] });
  jest.useFakeTimers();
  try {
    renderScreen();
    await screen.findByTestId('story-locked');
    await act(async () => fireEvent.press(screen.getByTestId('story-unlock')));
    expect(screen.getByTestId('checkin-sheet')).toBeTruthy();
    // Well past a frame's time: still on the locked frame while the sheet is up.
    act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByTestId('story-frame-0')).toBeTruthy();
    fireEvent.press(screen.getByTestId('checkin-sheet-backdrop'));
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
    // Closed: it runs again and moves on by itself.
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('story-frame-1')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('my own story has no reply row; a buddy who is gone closes politely', async () => {
  mockAuthorId = 'me';
  (fetchStory as jest.Mock).mockResolvedValueOnce({ author: { ...sam, id: 'me' }, localDate: '2026-10-07', frames: [{ kind: 'checkin', at: '2026-10-07T14:00:00.000Z', locked: false, mood: 'RESTED' }] });
  const { unmount } = renderScreen();
  expect(await screen.findByTestId('story-frame-0')).toHaveTextContent(/You woke up.*Rested/);
  expect(screen.queryByTestId('story-reply-CHEER')).toBeNull();
  unmount();
  mockAuthorId = 'sam';
  (fetchStory as jest.Mock).mockRejectedValueOnce(new ApiError(403, 'x', 'not_buddies'));
  renderScreen();
  expect(await screen.findByTestId('social-story-gone')).toBeTruthy();
  fireEvent.press(screen.getByTestId('social-story-close'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('a story with no frames is not available, never an endless loader', async () => {
  (fetchStory as jest.Mock).mockResolvedValueOnce({ author: sam, localDate: '2026-10-07', frames: [] });
  renderScreen();
  expect(await screen.findByTestId('social-story-gone')).toHaveTextContent(/isn't available/);
  expect(screen.queryByTestId('social-story-loading')).toBeNull();
  expect(markStorySeen).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('social-story-close'));
  expect(mockGoBack).toHaveBeenCalled();
});

it('a network error offers Retry and Close, not the gone view', async () => {
  (fetchStory as jest.Mock)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ author: sam, localDate: '2026-10-07', frames: [{ kind: 'checkin', at: '2026-10-07T14:00:00.000Z', locked: false, mood: 'OKAY' }] });
  renderScreen();
  expect(await screen.findByTestId('social-story-error')).toHaveTextContent(/Couldn't load this story/);
  expect(screen.queryByTestId('social-story-gone')).toBeNull();
  expect(screen.getByTestId('social-story-close')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByTestId('social-story-retry')));
  expect(await screen.findByTestId('story-frame-0')).toHaveTextContent(/Okay/);
  expect(fetchStory).toHaveBeenCalledTimes(2);
});

it('a bare 404 is gone too', async () => {
  (fetchStory as jest.Mock).mockRejectedValueOnce(new ApiError(404, 'Not found'));
  renderScreen();
  expect(await screen.findByTestId('social-story-gone')).toBeTruthy();
});
