import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Audio from 'expo-audio';
import { RoomCard, runsSound } from '../../src/components/coach/RoomCard';
import type { RoomEffects } from '../../src/lib/room/effects';
import type { RoomLayout } from '../../src/lib/room/iso/geometry';
import { loadRoomSound, resetRoomSound } from '../../src/lib/room/sound';
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
jest.mock('expo-secure-store');
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
  // Several earns are read with their count, as the line shows them (ruling T12-FIX).
  expect(say).toHaveBeenCalledWith('Plus 25 coins. Sleep goal hit and 1 more');
  expect(s.getByTestId('coins-landed').props.accessibilityLabel).toBe('Plus 25 coins. Sleep goal hit and 1 more');
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

it('the live-region node is mounted, empty and hidden, before coins land; landing changes that same node (TalkBack, ruling T12-FIX)', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue({ ...LANDING, events: [LANDING.events[0]] });
  await act(async () => { await loadCoins(); });
  const props = { stage: STAGE, window: WINDOW, recovery: FAIR, reduceMotion: false, onOpenRecovery: jest.fn() };
  const s = render(<RoomCard {...props} holdCoins />);
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 240, x: 0, y: 0 } } });
  await act(async () => undefined);
  const node = s.getByTestId('coins-landed', { includeHiddenElements: true });
  expect(node).toHaveTextContent('');
  expect([node.props.accessibilityElementsHidden, node.props.importantForAccessibility, node.props.accessibilityLiveRegion]).toEqual([true, 'no-hide-descendants', 'polite']);
  // Idle, it is out of the card's flow: no gap, no height.
  expect(String(node.props.className).split(' ')).toEqual(expect.arrayContaining(['absolute', 'h-0']));
  s.rerender(<RoomCard {...props} />);
  await act(async () => undefined);
  const landed = s.getByTestId('coins-landed');
  expect(landed).toBe(node);
  expect(landed).toHaveTextContent('Sleep goal hit');
  expect([landed.props.accessibilityElementsHidden, landed.props.importantForAccessibility]).toEqual([false, 'auto']);
});

it('hands its clock hold to the room (scrolled under the collapsed header, ruling T5-FIX)', () => {
  expect(renderCard().getByTestId('kip-room').props.holdClock).toBe(false);
  expect(renderCard({ holdClock: true }).getByTestId('kip-room').props.holdClock).toBe(true);
});

describe('KIP walking (spec §9.2, rulings 9 and 13)', () => {
  const IDLE = kipStage({ ...INPUT, waiting: false, streaming: false, empty: false });

  it('lets KIP walk only in the idle stage, with no bubble, and passes the idle loop', () => {
    const walking = renderCard({ stage: IDLE, kipWalks: true });
    expect(walking.getByTestId('kip-room').props.walks).toBe('walks');
    expect(walking.getByTestId('kip-room').props.idle).toBe('idle');
    expect(walking.getByTestId('kip-room').props.live).toBe('live');
    walking.unmount();
    const thinking = renderCard({ stage: STAGE, kipWalks: true });
    expect(thinking.getByTestId('kip-room').props.walks).toBe('');
    expect(thinking.getByTestId('kip-room').props.idle).toBe('');
    thinking.unmount();
    expect(renderCard({ stage: IDLE }).getByTestId('kip-room').props.walks).toBe('');
  });

  it('holds KIP at its desk while the editor covers the room, the card is under the header or coins wait (holds)', () => {
    for (const hold of [{ paused: true }, { holdClock: true }, { holdCoins: true }]) {
      const s = renderCard({ stage: IDLE, kipWalks: true, ...hold });
      expect(s.getByTestId('kip-room').props.walks).toBe('');
      s.unmount();
    }
  });

  it('holds KIP at its desk while the welcome or landing coins show in its bubble', async () => {
    (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
    await act(async () => { await loadCoins(); });
    const landing = renderCard({ stage: IDLE, kipWalks: true });
    await act(async () => undefined);
    expect(landing.getByTestId('kip-room').props.room.split(':')[2]).toBe('+25!');
    expect(landing.getByTestId('kip-room').props.walks).toBe('');
    landing.unmount();
    resetCoins();
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
    await act(async () => { await loadCosmetics(); });
    const welcome = renderCard({ stage: IDLE, kipWalks: true });
    expect(welcome.getByTestId('kip-room').props.room.split(':')[2]).toBe('WELCOME HOME!');
    expect(welcome.getByTestId('kip-room').props.walks).toBe('');
  });
});

describe('the radio\'s sound (ruling 15, PF3-AUDIO)', () => {
  const RADIO = { id: 'p1', item: 'item.radio', layer: 'onTop' as const, x: 0, y: 0, facing: 'L' as const, mirror: false, parent: 'desk', spot: 1 };
  const RADIO_LAYOUT: RoomLayout = { ...starterLayout(), pieces: [...starterLayout().pieces, RADIO] };
  const withRadio = () => cosmeticsDTO({ version: 2, layout: RADIO_LAYOUT, counts: { ...cosmeticsDTO().counts, 'item.radio': 1 } });
  const player = (Audio as unknown as { __player: { play: jest.Mock; pause: jest.Mock } }).__player;
  beforeEach(() => { resetRoomSound(); (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null); });

  it('mounts the radio\'s sound only while a running radio is in the room (ruling 15)', async () => {
    (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO());
    await act(async () => { await loadCosmetics(); });
    renderCard();
    expect(Audio.useAudioPlayer).not.toHaveBeenCalled();
    (fetchCosmetics as jest.Mock).mockResolvedValueOnce(withRadio());
    await act(async () => { await loadCosmetics({ fresh: true }); });
    renderCard();
    expect(Audio.useAudioPlayer).toHaveBeenCalled();
  });

  it('an inert radio (past the effect slots) has no sound', () => {
    const layout = RADIO_LAYOUT;
    const effects = { running: new Set<string>(), inert: new Set(['p1']) } as unknown as RoomEffects;
    expect(runsSound(layout, effects)).toBe(false);
    expect(runsSound(layout, { ...effects, running: new Set(['p1']) })).toBe(true);
  });

  it('with the switch on it plays only while the card is really in view; paused, unfocused or held, it is silent', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1');
    (fetchCosmetics as jest.Mock).mockResolvedValue(withRadio());
    await act(async () => { await loadCosmetics(); });
    const playing = renderCard();
    await act(async () => undefined);
    expect(player.play).toHaveBeenCalledTimes(1);
    player.pause.mockClear(); // the first render, before the stored switch was read
    // Reduce Motion stops loops, not sound (the switch is the user's own choice).
    playing.rerender(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion onOpenRecovery={jest.fn()} />);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
    // The editor over it, scrolled under the collapsed header, coins held: silent.
    for (const hold of [{ paused: true }, { holdClock: true }, { holdCoins: true }]) {
      playing.rerender(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} {...hold} />);
      expect(player.pause).toHaveBeenCalledTimes(1);
      playing.rerender(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} />);
      player.pause.mockClear();
    }
    playing.unmount();
    jest.clearAllMocks();
    // Out of focus (another tab, or the piece card's sheet over the page): silent until focus returns.
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
    expect(Audio.useAudioPlayer).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    await act(async () => { focus.forEach((cb) => cb()); });
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('is silent with the switch off (the default), and while the stage loads', async () => {
    (fetchCosmetics as jest.Mock).mockResolvedValue(withRadio());
    await act(async () => { await loadCosmetics(); });
    const off = renderCard();
    await act(async () => undefined);
    expect(player.play).not.toHaveBeenCalled();
    off.unmount();
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1');
    await act(async () => { await loadRoomSound(); });
    card(FAIR, jest.fn(), WINDOW, kipStage({ ...INPUT, phase: 'loading' }));
    await act(async () => undefined);
    expect(player.play).not.toHaveBeenCalled();
  });
});
