import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { RoomCard } from '../../src/components/coach/RoomCard';
import { fetchCosmetics, postRoomWelcomed } from '../../src/api/cosmetics';
import { resetMyKip } from '../../src/lib/kip/myKip';
import { kipStage, type KipStageInput } from '../../src/lib/kipStage';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';
import { fetchCoins, postCoinsSeen } from '../../src/api/coins';
import { getCoins, loadCoins, resetCoins } from '../../src/lib/coins/coinsStore';
import { ScreenNavigationContext } from '../../src/lib/useScreenFocused';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn(async () => undefined) }));
jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(async () => undefined), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));

afterEach(() => { resetCosmetics(); resetMyKip(); resetCoins(); jest.clearAllMocks(); });

const INPUT: KipStageInput = { phase: 'ready', statusUnverified: false, offline: false, waiting: true, streaming: true, error: false, empty: false, idle: { pose: 'rest', mood: 'idle' } };
const STAGE = kipStage(INPUT);
const WINDOW = { weather: 'cloudy' as const, night: false };
const FAIR = { score: 58 as number | null, band: 'scoreFair' as 'scoreFair' | null };

function card(recovery = FAIR, onOpenRecovery = jest.fn(), window = WINDOW, stage = STAGE) {
  const s = render(<RoomCard stage={stage} window={window} recovery={recovery} reduceMotion={false} onOpenRecovery={onOpenRecovery} />);
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  return s;
}

/** The card with its frame measured, so the room is drawn; `props` overrides the defaults. */
function renderCard(props: Partial<React.ComponentProps<typeof RoomCard>> = {}) {
  const s = render(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} {...props} />);
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  return s;
}

it('draws the diorama only once the frame has a width, with the stage\'s pose, mood, bubble and screen', () => {
  const s = render(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} />);
  expect(s.queryByTestId('kip-room')).toBeNull();
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  expect(s.getByTestId('kip-room').props.room).toBe('type:glance:ON IT…:dots:cloudy:day:coral:2:moving::');
  expect(s.getByTestId('kip-room').props.accessibilityLabel).toBe('KIP in its room, typing. Window: cloudy');
});

it('captions the card and opens Recovery from the hot tag, with its spoken label', () => {
  const open = jest.fn();
  const s = card(FAIR, open);
  expect(s.getByText("KIP'S DESK")).toBeTruthy();
  expect(s.getByText("Window shows today's Recovery")).toBeTruthy();
  const tag = s.getByTestId('kip-tag-recovery');
  expect(tag.props.accessibilityLabel).toBe('Recovery 58, cloudy day. Open Recovery');
  expect(tag).toHaveTextContent('RECOVERY58');
  fireEvent.press(tag);
  expect(open).toHaveBeenCalledTimes(1);
});

it('says there is no reading yet on the hot tag without a score', () => {
  const s = card({ score: null, band: null });
  expect(s.getByTestId('kip-tag-recovery').props.accessibilityLabel).toBe('Recovery, no reading yet. Open Recovery');
  expect(s.getByTestId('kip-tag-recovery')).toHaveTextContent('RECOVERY—');
});

it('speaks the Recovery weather on the hot tag at night, never "night day"', () => {
  const s = card(FAIR, jest.fn(), { weather: 'cloudy', night: true });
  expect(s.getByTestId('kip-room').props.accessibilityLabel).toBe('KIP in its room, typing. Window: night');
  expect(s.getByTestId('kip-tag-recovery').props.accessibilityLabel).toBe('Recovery 58, cloudy day. Open Recovery');
});

it('shows a skeleton in the frame while loading, and no room', () => {
  const s = card(FAIR, jest.fn(), WINDOW, kipStage({ ...INPUT, phase: 'loading' }));
  expect(s.getByTestId('kip-room-skeleton')).toBeTruthy();
  expect(s.queryByTestId('kip-room')).toBeNull();
});

it('draws a passed look (the turn) in place of the stage\'s pose, keeping the stage\'s bubble and screen', () => {
  const s = render(
    <RoomCard stage={STAGE} look={{ pose: 'rest', mood: 'glance', facing: 'you' }} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} />,
  );
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  expect(s.getByTestId('kip-room').props.room).toBe('rest:glance:ON IT…:dots:cloudy:day:coral:2:moving:you:');
});

it('draws your saved layout and what KIP wears (the server already trimmed what you don\'t own)', async () => {
  const layout = { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.dots' } };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout, worn: { ...EMPTY_WORN, head: 'out.cap' } }));
  await act(async () => { await loadCosmetics(); });
  const room = renderCard().getByTestId('kip-room');
  expect([JSON.parse(room.props.layout), room.props.tier, JSON.parse(room.props.worn).head]).toEqual([layout, 1, 'out.cap']);
});

it('draws the starter layout and a bare KIP before the first read', () => {
  const room = renderCard().getByTestId('kip-room');
  expect([JSON.parse(room.props.layout), JSON.parse(room.props.worn)]).toEqual([starterLayout(), EMPTY_WORN]);
});

it('is 240 points tall, and a long press on the room opens the editor (spec §5.1, §9.1)', () => {
  const onDecorate = jest.fn();
  const s = renderCard({ onDecorate });
  expect(s.getByTestId('kip-room-frame-inner').props.style.height).toBe(240);
  fireEvent(s.getByTestId('kip-room-press'), 'longPress');
  expect(onDecorate).toHaveBeenCalledTimes(1);
  expect(s.getByTestId('kip-room-press').props.accessible).toBe(false); // the room stays one image for screen readers
});

it('pauses the room while decorate mode is open', () => {
  expect(renderCard().getByTestId('kip-room').props.room).not.toContain(':paused');
  const s = renderCard({ paused: true });
  expect(s.getByTestId('kip-room').props.room).toContain(':paused');
});

it('shows the welcome once until it is answered, with KIP saying WELCOME HOME!; Later hides it for good', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const onPlaceLantern = jest.fn();
  const s = renderCard({ onPlaceLantern });
  expect(s.getByTestId('room-welcome')).toBeTruthy();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('WELCOME HOME!');
  await act(async () => { fireEvent.press(s.getByTestId('welcome-later')); });
  expect(postRoomWelcomed).toHaveBeenCalledTimes(1);
  expect(s.queryByTestId('room-welcome')).toBeNull();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe(STAGE.bubble);
  expect(onPlaceLantern).not.toHaveBeenCalled();
});

it('Place the lantern answers the welcome and opens the guided placement', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const onPlaceLantern = jest.fn();
  const s = renderCard({ onPlaceLantern });
  await act(async () => { fireEvent.press(s.getByTestId('welcome-place')); });
  expect([onPlaceLantern.mock.calls.length, (postRoomWelcomed as jest.Mock).mock.calls.length]).toEqual([1, 1]);
  expect(s.queryByTestId('room-welcome')).toBeNull();
});

it('shows no welcome once welcomed, before the first read, or while the stage loads', async () => {
  expect(renderCard().queryByTestId('room-welcome')).toBeNull();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  expect(renderCard({ stage: kipStage({ ...INPUT, phase: 'loading' }) }).queryByTestId('room-welcome')).toBeNull();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { await loadCosmetics(); });
  expect(renderCard().queryByTestId('room-welcome')).toBeNull();
});

const LANDING = {
  balance: 385, today: { earned: 25, cap: 60 }, next: null,
  events: [
    { kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false },
    { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false },
  ],
};

it('coins land once: "+25!" in KIP\'s bubble and a line under the room, announced, then marked seen (spec §6.7, ruling 12)', async () => {
  jest.useFakeTimers();
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
  await act(async () => { await loadCoins(); });
  const s = renderCard();
  await act(async () => undefined);
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('+25!');
  expect(s.getByTestId('coins-landed')).toHaveTextContent('Sleep goal hit and 1 more');
  expect(say).toHaveBeenCalledWith('Plus 25 coins. Sleep goal hit');
  expect(postCoinsSeen).toHaveBeenCalledWith('2026-11-11T07:12:00.000Z');
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(s.queryByTestId('coins-landed')).toBeNull();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('ON IT…');
  expect(postCoinsSeen).toHaveBeenCalledTimes(1);
  say.mockRestore();
  jest.useRealTimers();
});

it('nothing lands while the welcome card shows, or while the room is paused', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
  await act(async () => { await loadCoins(); });
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const s = renderCard();
  await act(async () => undefined);
  expect(s.queryByTestId('coins-landed')).toBeNull();
  const paused = renderCard({ paused: true });
  await act(async () => undefined);
  expect(paused.queryByTestId('coins-landed')).toBeNull();
  expect(postCoinsSeen).not.toHaveBeenCalled();
});

it('nothing lands, and nothing is marked seen, while the page is out of focus or holds the coins (ruling PF-F13)', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
  await act(async () => { await loadCoins(); });
  const focus = new Set<() => void>();
  const nav = {
    isFocused: () => false,
    addListener: (event: 'focus' | 'blur', cb: () => void) => {
      if (event === 'focus') focus.add(cb);
      return () => { focus.delete(cb); };
    },
  };
  const s = render(
    <ScreenNavigationContext.Provider value={nav as never}>
      <RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} />
    </ScreenNavigationContext.Provider>,
  );
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  await act(async () => undefined);
  const held = renderCard({ holdCoins: true });
  await act(async () => undefined);
  expect([s.queryByTestId('coins-landed'), held.queryByTestId('coins-landed')]).toEqual([null, null]);
  expect(postCoinsSeen).not.toHaveBeenCalled();
  expect(getCoins()!.events.every((e) => !e.seen)).toBe(true);
  held.unmount();
  // Back in focus, they land.
  await act(async () => { focus.forEach((cb) => cb()); });
  expect(s.getByTestId('coins-landed')).toBeTruthy();
  expect(postCoinsSeen).toHaveBeenCalledTimes(1);
});

it('the line is a polite live region read as words (no middle dot); iOS, which has none, is told once (house pattern)', async () => {
  const os = Platform.OS;
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  try {
    for (const platform of ['android', 'ios'] as const) {
      Platform.OS = platform;
      resetCoins();
      (postCoinsSeen as jest.Mock).mockClear();
      say.mockClear();
      (fetchCoins as jest.Mock).mockResolvedValue({ ...LANDING, events: [LANDING.events[0]] });
      await act(async () => { await loadCoins(); });
      const s = renderCard();
      await act(async () => undefined);
      const line = s.getByTestId('coins-landed');
      expect(line).toHaveTextContent('Sleep goal hit');
      expect(line.props.accessibilityLabel).toBe('Plus 20 coins. Sleep goal hit');
      expect(line.props.accessibilityLabel).not.toMatch(/·|−/);
      expect(line.props.accessibilityLiveRegion).toBe('polite');
      expect(say.mock.calls).toEqual(platform === 'ios' ? [['Plus 20 coins. Sleep goal hit']] : []);
      expect(String(line.props.className).split(' ')).toContain('text-caption');
      s.unmount();
    }
  } finally {
    Platform.OS = os;
    say.mockRestore();
  }
});

it('lands nothing when nothing is unseen', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue({ ...LANDING, events: LANDING.events.map((e) => ({ ...e, seen: true })) });
  await act(async () => { await loadCoins(); });
  const s = renderCard();
  await act(async () => undefined);
  expect(s.queryByTestId('coins-landed')).toBeNull();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('ON IT…');
  expect(postCoinsSeen).not.toHaveBeenCalled();
});
