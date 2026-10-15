import { ask, mockNav, openChat, status, stream, today } from '../../jest-mocks/coachScreenHarness';
import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { CoachScreen } from '../../src/screens/CoachScreen';
import { fetchCoachStatus } from '../../src/api/coach';
import { fetchScoresWithBands } from '../../src/api/scores';
import { CoachStreamInterruptedError } from '../../src/api/coachStream';
import { ApiError, markNetworkError } from '../../src/api/client';
import { answer, doneEvent, openTurn, scriptTurn } from '../../jest-mocks/coachStreamFake';
import { withCoachStatus } from '../../jest-mocks/coachStatus';
import { suggestedQuestions } from '../../src/lib/coachToday';
import { resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';
import { fetchCoins } from '../../src/api/coins';
import { TURN_FRAME_MS } from '../../src/lib/useKipTurn';

// The mocks (api, navigation, RoomView, the room's score and sleep reads) live in jest-mocks/coachScreenHarness.
const mockNavigate = mockNav.navigate;
const OFFLINE_COPY = "KIP can't reach the internet. Ask again when you're back online.";

const room = (s: ReturnType<typeof render>) => {
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  return s.getByTestId('kip-room').props.room as string;
};

// A daytime clock: with no scores and no night, the day's scene is the fallback (rest / curious).
beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 14, 10), advanceTimers: true });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('the KIP page (W7)', () => {
  it('shows the wallet in the header once the coins have loaded; it opens the coin history (spec §6.7, C6)', async () => {
    resetCoins();
    (fetchCoins as jest.Mock).mockResolvedValueOnce({ balance: 360, today: { earned: 0, cap: 60 }, events: [], next: null });
    setCoinBalance(360);
    const utils = await openChat();
    const chip = utils.getByTestId('kip-wallet');
    expect(chip.props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
    fireEvent.press(chip);
    expect(mockNav.navigate).toHaveBeenCalledWith('CoinHistory', undefined);
    resetCoins();
  });

  it('titles the page KIP with the pocket-room status line and two header buttons', async () => {
    const s = await openChat();
    expect(s.getByRole('header', { name: 'KIP' })).toBeTruthy();
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('In the pocket room');
    // Large text truncates the line rather than wrapping it (Review Focus 3).
    expect(s.getByTestId('kip-status-line').props.numberOfLines).toBe(1);
    expect(s.getByTestId('coach-conversations-button').props.accessibilityLabel).toBe('Conversations and what KIP remembers');
    expect(s.getByTestId('coach-new-chat-button')).toBeTruthy();
  });

  it('with a score, names the day in the status line and speaks it without the middle dot', async () => {
    (fetchScoresWithBands as jest.Mock).mockResolvedValue({
      scores: [{ date: '2026-10-14', type: 'RECOVERY', score: 48, confidenceLevel: 'HIGH', algorithmVersion: 'v1', factors: [], coldStart: [] }],
      bands: undefined,
    });
    const s = await openChat();
    await waitFor(() => expect(s.getByTestId('kip-status-line')).toHaveTextContent('In the pocket room · fair day'));
    expect(s.getByTestId('kip-status-line').props.accessibilityLabel).toBe('In the pocket room, fair day');
    expect(s.getByTestId('kip-tag-recovery').props.accessibilityLabel).toBe('Recovery 48, cloudy day. Open Recovery');
  });

  it('first open: KIP waves "HI!" and the thread says hello with three suggestions', async () => {
    const s = await openChat();
    expect(room(s)).toMatch(/^wave:idle:HI!:lines:/);
    expect(s.getByText("Hi, I'm KIP. What would you like to know?")).toBeTruthy();
    expect(s.getByText('Ask about your sleep, recovery or training, or anything health and fitness.')).toBeTruthy();
    expect(s.getAllByTestId(/^coach-suggestion-/)).toHaveLength(3);
    suggestedQuestions(today).slice(0, 3).forEach((question, i) => expect(s.getByTestId(`coach-suggestion-${i}`)).toHaveTextContent(question, { exact: false }));
  });

  it('thinking → answering → done moves the pose type → point → the day\'s pose', async () => {
    const turn = openTurn(stream);
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    expect(room(s)).toMatch(/^type:glance:ON IT…:dots:.*:desk:$/);
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('Typing it up…');
    await turn.emit({ type: 'text', sentence: 'Mostly clear skies.' });
    // KIP turns to face you over two 80 ms frames (useKipTurn), then points.
    for (let frame = 0; frame < 2; frame += 1) {
      await act(async () => {
        jest.advanceTimersByTime(TURN_FRAME_MS);
      });
    }
    expect(room(s)).toMatch(/^point:glance:HERE'S MY TAKE:chart:.*:you:$/);
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('Answering');
    await turn.finish(doneEvent());
    expect(room(s)).toMatch(/^rest:curious:none:lines:/);
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('In the pocket room');
  });

  it('an error: KIP shrugs "OOPS" and the card is headed "KIP lost the thread"', async () => {
    stream.mockRejectedValueOnce(new Error('boom'));
    const s = await openChat();
    await ask(s, 'Hi');
    expect(room(s)).toMatch(/^shrug:startled:OOPS:/);
    expect(s.getByText('KIP lost the thread')).toBeTruthy();
    expect(s.getByTestId('coach-retry-button')).toBeTruthy();
  });

  it('offline: a network error shows the offline copy with no button and puts the question back', async () => {
    stream.mockRejectedValueOnce(markNetworkError(new TypeError('Network request failed')));
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    expect(room(s)).toMatch(/^rest:sleepy:Z Z:/);
    expect(s.getByTestId('kip-offline')).toHaveTextContent(OFFLINE_COPY);
    expect(s.queryByTestId('coach-error')).toBeNull();
    expect(s.queryByTestId('coach-retry-button')).toBeNull();
    expect(s.getByTestId('coach-input').props.value).toBe('How did I sleep?');
    expect(s.queryByText('How did I sleep?', { exact: true })).toBeNull();
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('Offline');
  });

  it('offline: screen readers hear the offline copy once per offline send (iOS skips role="alert")', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    stream.mockRejectedValueOnce(markNetworkError(new TypeError('Network request failed')));
    stream.mockRejectedValueOnce(markNetworkError(new TypeError('Network request failed')));
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(OFFLINE_COPY);
    await act(async () => {
      fireEvent.press(s.getByTestId('coach-send-button'));
    });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(OFFLINE_COPY);
    announce.mockRestore();
  });

  it('offline: a prefill that arrived meanwhile stays in the bar', async () => {
    let fail: (e: unknown) => void = () => {};
    stream.mockImplementationOnce(() => new Promise((_res, rej) => { fail = rej; }));
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    mockNav.params = { prefill: 'Why did my score change today?' };
    s.rerender(<CoachScreen />);
    await act(async () => fail(markNetworkError(new TypeError('Network request failed'))));
    expect(s.getByTestId('kip-offline')).toBeTruthy();
    expect(s.getByTestId('coach-input').props.value).toBe('Why did my score change today?');
  });

  it('the next request that gets through clears offline', async () => {
    stream.mockRejectedValueOnce(markNetworkError(new TypeError('Network request failed')));
    scriptTurn(stream, answer('Steady.'));
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    expect(s.getByTestId('kip-offline')).toBeTruthy();
    await act(async () => {
      fireEvent.press(s.getByTestId('coach-send-button'));
    });
    expect(await s.findByText('Steady.')).toBeTruthy();
    expect(s.queryByTestId('kip-offline')).toBeNull();
    expect(room(s)).not.toMatch(/Z Z/);
    expect(s.getByTestId('kip-status-line')).not.toHaveTextContent('Offline');
  });

  it('Stop is not offline', async () => {
    const turn = openTurn(stream);
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    await act(async () => {
      fireEvent.press(s.getByTestId('coach-send-button'));
    });
    expect(turn.signal?.aborted).toBe(true);
    expect(room(s)).not.toMatch(/Z Z/);
    expect(s.queryByTestId('kip-offline')).toBeNull();
    expect(s.getByTestId('kip-status-line')).not.toHaveTextContent('Offline');
    expect(s.getByText('How did I sleep?')).toBeTruthy();
  });

  it.each([
    ['an HTTP 503', () => new ApiError(503, 'x')],
    ['a dropped stream', () => new CoachStreamInterruptedError()],
  ])('%s is not offline: KIP shrugs', async (_name, thrown) => {
    stream.mockRejectedValueOnce(thrown());
    const s = await openChat();
    await ask(s, 'Hi');
    expect(room(s)).toMatch(/^shrug:startled:OOPS:/);
    expect(s.queryByTestId('kip-offline')).toBeNull();
    expect(s.getByTestId('kip-status-line')).not.toHaveTextContent('Offline');
  });

  it('a status read that never reached the network shows offline; an HTTP failure still shows unavailable', async () => {
    (fetchCoachStatus as jest.Mock).mockRejectedValueOnce(markNetworkError(new TypeError('x')));
    const s = render(<CoachScreen />);
    await waitFor(() => expect(s.getByTestId('kip-status-line')).toHaveTextContent('Offline'));
    expect(room(s)).toMatch(/^rest:sleepy:Z Z:/);
    expect(s.getByTestId('kip-offline')).toHaveTextContent(OFFLINE_COPY);
    s.unmount();
    (fetchCoachStatus as jest.Mock).mockRejectedValueOnce(new ApiError(500, 'x'));
    const u = render(<CoachScreen />);
    await waitFor(() => expect(room(u)).toMatch(/^rest:sleepy:none:/));
    expect(u.getByTestId('coach-status-unverified')).toHaveTextContent("We couldn't check KIP just now. You can still send a message.");
    expect(u.queryByTestId('kip-offline')).toBeNull();
  });

  it('offline: coming back to the foreground reads the status again, and a good read clears it', async () => {
    // react-native's jest setup makes addEventListener a mock: the page's listener is among its calls.
    const listen = AppState.addEventListener as jest.Mock;
    (fetchCoachStatus as jest.Mock).mockRejectedValueOnce(markNetworkError(new TypeError('x')));
    const s = render(<CoachScreen />);
    await waitFor(() => expect(s.getByTestId('kip-status-line')).toHaveTextContent('Offline'));
    expect(fetchCoachStatus).toHaveBeenCalledTimes(1);
    await act(async () => listen.mock.calls.forEach(([, cb]) => cb('active')));
    expect(fetchCoachStatus).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(s.queryByTestId('kip-offline')).toBeNull());
    expect(s.getByTestId('kip-status-line')).toHaveTextContent('In the pocket room');
  });

  it('shows offline from the shared coach status, and tells it about an offline send', async () => {
    const shared = render(withCoachStatus(<CoachScreen />, { offline: true }));
    await shared.findByTestId('coach-input');
    expect(shared.getByTestId('kip-status-line')).toHaveTextContent('Offline');
    shared.unmount();

    const setOffline = jest.fn();
    stream.mockRejectedValueOnce(markNetworkError(new TypeError('Network request failed')));
    const s = render(withCoachStatus(<CoachScreen />, { setOffline }));
    await s.findByTestId('coach-input');
    await ask(s, 'How did I sleep?');
    expect(setOffline).toHaveBeenLastCalledWith(true);
  });

  it('consent: KIP asks "MAY I?" with Review and Not now; Not now goes back to Home', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, consented: false });
    const s = render(<CoachScreen />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CoachConsent', { prefill: undefined }));
    await act(async () => mockNav.focus());
    await s.findByTestId('kip-consent');
    expect(room(s)).toMatch(/^wave:curious:MAY I\?:/);
    expect(s.getByText('KIP needs your OK first')).toBeTruthy();
    expect(s.getByText('Before KIP can look at your scores, see exactly what is sent when you ask something.')).toBeTruthy();
    expect(s.getByTestId('coach-review-consent-button')).toHaveTextContent('Review what is shared');
    fireEvent.press(s.getByTestId('kip-consent-not-now'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Home');
  });

  it('unavailable: KIP rests, no bubble, "KIP isn\'t available right now."', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, enabled: false });
    const s = render(<CoachScreen />);
    await s.findByText("KIP isn't available right now.");
    expect(room(s)).toMatch(/^rest:sleepy:none:/);
  });

  it('loading: the frame shows a skeleton', async () => {
    (fetchCoachStatus as jest.Mock).mockReturnValue(new Promise(() => {}));
    const s = render(<CoachScreen />);
    fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
    expect(s.getByTestId('kip-room-skeleton')).toBeTruthy();
    expect(s.queryByTestId('kip-room')).toBeNull();
    expect(s.getByTestId('coach-loading')).toBeTruthy();
    expect(s.getByRole('header', { name: 'KIP' })).toBeTruthy();
  });

  it('never opens a picker, even when an old server says no persona was chosen', async () => {
    (fetchCoachStatus as jest.Mock).mockResolvedValue({ ...status, personaChosen: false });
    await openChat();
    expect(mockNavigate).not.toHaveBeenCalledWith('MeetYourCoach', expect.anything());
  });

  it('opens Recovery on today from the hot tag', async () => {
    const s = await openChat();
    fireEvent.press(s.getByTestId('kip-tag-recovery'));
    expect(mockNavigate).toHaveBeenCalledWith('Recovery', { date: '2026-10-14' });
  });

  it('the prompt bar asks KIP', async () => {
    const s = await openChat();
    expect(s.getByTestId('coach-input').props.placeholder).toBe('Ask KIP…');
    expect(s.getByTestId('coach-input').props.accessibilityLabel).toBe('Message KIP');
  });
});
