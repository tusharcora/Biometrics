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
import { fetchCoins, fetchFirstWeek } from '../../src/api/coins';
import { TURN_FRAME_MS } from '../../src/lib/useKipTurn';
import { fetchGifts, fetchRoomCheers, openGift } from '../../src/api/rooms';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { resetRoomSocial } from '../../src/lib/room/giftsStore';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

// Your cosmetics, read only where a test loads them (the gift tests): none otherwise, as before.
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined), postRoomWelcomed: jest.fn(async () => undefined) }));

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
  // The coins store is a module singleton: a wallet left loaded would leak into the next test.
  resetCoins();
  // Back to the harness's closed first-week list, so an open one never leaks into the next test.
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
});

describe('the KIP page (W7)', () => {
  it('reads the coins and the first-week list when the page opens and on a focus 30 s or more after the last read (spec §6.7, §11.2, ruling T12-FIX)', async () => {
    await openChat();
    const reads = () => [(fetchCoins as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length];
    const [coins, week] = reads();
    expect(coins).toBeGreaterThanOrEqual(1);
    expect(week).toBeGreaterThanOrEqual(1);
    // A quick tab hop reads nothing more.
    jest.setSystemTime(Date.now() + 29_000);
    await act(async () => { mockNav.focus(); });
    expect(reads()).toEqual([coins, week]);
    jest.setSystemTime(Date.now() + 1_000);
    await act(async () => { mockNav.focus(); });
    expect(reads()).toEqual([coins + 1, week + 1]);
    // The 30 s run from that read.
    await act(async () => { mockNav.focus(); });
    expect(reads()).toEqual([coins + 1, week + 1]);
  });

  it('shows the first-week card in the room card while the list is open (spec §11.2)', async () => {
    (fetchFirstWeek as jest.Mock).mockResolvedValue({
      open: true, day: 1, done: 0, next: { tier: 2, coins: 600, streak: 14 },
      tasks: ['checkin', 'place', 'sleep', 'fern', 'cheer', 'recap', 'streak7'].map((key) => ({ key, done: false, reward: 5 })),
    });
    const utils = await openChat();
    expect(utils.getByTestId('kip-room-card')).toContainElement(utils.getByTestId('first-week'));
  });

  it('shows the wallet in the header once the coins have loaded; it opens the coin history (spec §6.7, C6)', async () => {
    resetCoins();
    (fetchCoins as jest.Mock).mockResolvedValueOnce({ balance: 360, today: { earned: 0, cap: 60 }, events: [], next: null });
    setCoinBalance(360);
    const utils = await openChat();
    const chip = utils.getByTestId('kip-wallet');
    expect(chip.props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
    fireEvent.press(chip);
    expect(mockNav.navigate).toHaveBeenCalledWith('CoinHistory', undefined);
    // The header's buttons may shrink and wrap, so the title keeps room on a 320-pt phone (ruling T10-FIX).
    expect(String(utils.getByTestId('kip-header-actions').props.className).split(' ')).toEqual(expect.arrayContaining(['shrink', 'flex-wrap', 'justify-end']));
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

  it('KIP walks between answers only while idle with the prompt bar blurred (spec §9.2, Review Focus 2)', async () => {
    const turn = openTurn(stream);
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    room(s);
    expect(s.getByTestId('kip-room').props.walks).toBe(''); // a turn is running
    await turn.emit({ type: 'text', sentence: 'Mostly clear skies.' });
    expect(s.getByTestId('kip-room').props.walks).toBe('');
    await turn.finish(doneEvent());
    expect(s.getByTestId('kip-room').props.walks).toBe('walks');
    expect(s.getByTestId('kip-room').props.idle).toBe('idle');
    fireEvent(s.getByTestId('coach-input'), 'focus');
    expect(s.getByTestId('kip-room').props.walks).toBe('');
    fireEvent(s.getByTestId('coach-input'), 'blur');
    expect(s.getByTestId('kip-room').props.walks).toBe('walks');
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

describe('gifts and cheers on the room card (spec §10.2, §10.3; rulings 13, 14, PF4-F8)', () => {
  const ivy = { id: 'g1', itemId: 'plant.ivy', note: 'cosy' as const, from: { name: 'Maya' }, quiet: false, at: '2026-10-26T10:00:00.000Z' };
  const fern = { id: 'g2', itemId: 'plant.fern', note: 'desk' as const, from: { name: 'Jo' }, quiet: true, at: '2026-10-26T11:00:00.000Z' };
  beforeEach(async () => {
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
    await act(async () => { await loadCosmetics(); });
  });
  afterEach(() => { resetRoomSocial(); resetCosmetics(); });
  const openKip = async (width = 323) => {
    const s = await openChat();
    fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width, height: 240, x: 0, y: 0 } } });
    await act(async () => undefined);
    return s;
  };

  it('shows each gift as a box, a line for a gift from someone you did not mute, and opens it into the inventory', async () => {
    (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 2, cheers: [] });
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy, fern] });
    (openGift as jest.Mock).mockResolvedValue({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } });
    const s = await openKip();
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(2);
    expect(s.getByTestId('room-gift-line')).toHaveTextContent('A gift from Maya is on your floor');
    expect(s.getByTestId('room-cheers')).toHaveTextContent('2 cheers this week');
    // The reload after the open (T11T12-RELOAD) brings the server's own NEW copy.
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 }, owned: [...Object.keys(STARTER_COUNTS), 'plant.ivy'].sort(), fresh: [{ itemId: 'plant.ivy', source: 'gift_in' }], version: 2 }));
    const reads = (fetchCosmetics as jest.Mock).mock.calls.length;
    await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
    expect(openGift).toHaveBeenCalledWith('g1');
    expect(getCosmetics()?.fresh).toContainEqual({ itemId: 'plant.ivy', source: 'gift_in' });
    expect(getCosmetics()?.counts['plant.ivy']).toBe(1);
    expect((fetchCosmetics as jest.Mock).mock.calls.length).toBe(reads + 1);
    expect(s.getByTestId('room-gift-line')).toHaveTextContent('Trailing ivy is in your inventory.');
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(1);
  });

  // Jest only: fireEvent.press reaches the box's own handler. On a device the box is a nested Pressable over the room
  // and should win the responder; that stays an owner device check (T10-FIX M4).
  it('in Jest, a tap on a box opens the gift, never the piece behind it; a tap on the room still opens that piece (the P3 tap path, Jest only)', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy] });
    (openGift as jest.Mock).mockResolvedValue({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } });
    // Whatever the room finds under a finger (a piece, the cat or KIP passing by), it is the fern.
    jest.requireMock('../../src/components/room/RoomView').__setPieceAt(() => 'plant');
    try {
      const s = await openKip();
      await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
      expect(openGift).toHaveBeenCalledWith('g1');
      expect(mockNavigate).not.toHaveBeenCalledWith('PieceCard', expect.anything());
      fireEvent.press(s.getByTestId('kip-room-press'), { nativeEvent: { locationX: 10, locationY: 10 } });
      expect(mockNavigate).toHaveBeenCalledWith('PieceCard', { pieceId: 'plant' });
    } finally {
      jest.requireMock('../../src/components/room/RoomView').__setPieceAt(() => null);
    }
  });

  it('a muted sender\'s gift shows its box but no line (ruling 13); a deleted sender\'s reads "A gift"', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [fern] });
    const s = await openKip();
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(1);
    expect(s.queryByTestId('room-gift-line')).toBeNull();
    expect(s.queryByTestId('room-cheers')).toBeNull();
    s.unmount();
    resetRoomSocial();
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [{ ...ivy, from: null }] });
    const t = await openKip();
    expect(t.getByTestId('room-gift-line')).toHaveTextContent('A gift is on your floor');
    expect(t.getByTestId('gift-box-g1').props.accessibilityLabel).toBe('Open a gift');
  });

  it('more than one unmuted gift reads as a count of those; the cheers open who cheered', async () => {
    (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 1, cheers: [] });
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy, { ...ivy, id: 'g3' }, fern, { ...ivy, id: 'g4' }] });
    const s = await openKip();
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(3);
    expect(s.getByTestId('room-gift-line')).toHaveTextContent('3 gifts are on your floor');
    expect(s.getByTestId('room-cheers').props.accessibilityLabel).toBe('1 cheer this week. See who cheered your room');
    fireEvent.press(s.getByTestId('room-cheers'));
    expect(mockNavigate).toHaveBeenCalledWith('RoomCheers');
  });

  it('a gift already gone takes its box away; a try-later answer keeps it to tap again', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy, { ...ivy, id: 'g3' }] });
    (openGift as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'try_later', 'try_later')).mockRejectedValueOnce(new ApiError(404, 'gift_gone', 'gift_gone'));
    const s = await openKip();
    await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
    expect(s.getByTestId('room-gift-line')).toHaveTextContent(/^Couldn't do that right now\./);
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(2);
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [{ ...ivy, id: 'g3' }] });
    await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
    expect(s.getByTestId('room-gift-line')).toHaveTextContent('That gift is no longer there.');
    expect(s.queryByTestId('gift-box-g1')).toBeNull();
    expect(s.getAllByTestId(/^gift-box-/)).toHaveLength(1);
  });

  it('the boxes\' tiles are kept free of the cat and KIP (PF4-F8)', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy, fern] });
    const s = await openKip();
    expect(JSON.parse(s.getByTestId('kip-room').props.avoid as string)).toHaveLength(2);
  });

  it('a press on a box while a gift opens never reaches the room under it (T10-FIX I2)', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [ivy, { ...ivy, id: 'g3' }] });
    let finish!: (v: { counts: Record<string, number> }) => void;
    (openGift as jest.Mock).mockReturnValueOnce(new Promise((r) => { finish = r; }));
    const pieceAt = jest.fn(() => 'plant');
    jest.requireMock('../../src/components/room/RoomView').__setPieceAt(pieceAt);
    try {
      const s = await openKip();
      await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
      await act(async () => { fireEvent.press(s.getByTestId('gift-box-g3')); });
      await act(async () => { fireEvent.press(s.getByTestId('gift-box-g1')); });
      expect(openGift).toHaveBeenCalledTimes(1);
      expect(pieceAt).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalledWith('PieceCard', expect.anything());
      await act(async () => { finish({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } }); });
    } finally {
      jest.requireMock('../../src/components/room/RoomView').__setPieceAt(() => null);
    }
  });

  it('with no free tile in view every gift can still be opened, a quiet one too, by the waiting button (T10-FIX I1)', async () => {
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [fern, ivy] });
    (openGift as jest.Mock).mockResolvedValue({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 } });
    // A card narrower than a box: no tile's 44-pt box fits in view.
    const s = await openKip(40);
    expect(s.queryAllByTestId(/^gift-box-/)).toHaveLength(0);
    const waiting = s.getByTestId('room-gift-waiting');
    expect(waiting).toHaveTextContent('2 gifts waiting. Open one');
    expect(waiting.props.accessibilityLabel ?? '').not.toMatch(/Jo|Maya/);
    // The next one is the quiet gift from a muted sender: it is still reachable.
    await act(async () => { fireEvent.press(waiting); });
    expect(openGift).toHaveBeenLastCalledWith('g2');
    expect(s.getByTestId('room-gift-waiting')).toHaveTextContent('1 gift waiting. Open one');
    await act(async () => { fireEvent.press(s.getByTestId('room-gift-waiting')); });
    expect(openGift).toHaveBeenLastCalledWith('g1');
    expect(s.queryByTestId('room-gift-waiting')).toBeNull();
  });
});
