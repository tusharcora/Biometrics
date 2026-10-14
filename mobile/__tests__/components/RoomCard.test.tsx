import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { RoomCard } from '../../src/components/coach/RoomCard';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetMyKip } from '../../src/lib/kip/myKip';
import { kipStage, type KipStageInput } from '../../src/lib/kipStage';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn() }));

afterEach(() => { resetCosmetics(); resetMyKip(); });

const INPUT: KipStageInput = { phase: 'ready', statusUnverified: false, offline: false, waiting: true, streaming: true, error: false, empty: false, idle: { pose: 'rest', mood: 'idle' } };
const STAGE = kipStage(INPUT);
const WINDOW = { weather: 'cloudy' as const, night: false };
const FAIR = { score: 58 as number | null, band: 'scoreFair' as 'scoreFair' | null };

function card(recovery = FAIR, onOpenRecovery = jest.fn(), window = WINDOW, stage = STAGE) {
  const s = render(<RoomCard stage={stage} window={window} recovery={recovery} reduceMotion={false} onOpenRecovery={onOpenRecovery} />);
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  return s;
}

/** The card with its frame measured, so the room is drawn; `props` overrides the defaults. */
function renderCard(props: Partial<React.ComponentProps<typeof RoomCard>> = {}) {
  const s = render(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} {...props} />);
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  return s;
}

it('draws the diorama only once the frame has a width, with the stage\'s pose, mood, bubble and screen', () => {
  const s = render(<RoomCard stage={STAGE} window={WINDOW} recovery={FAIR} reduceMotion={false} onOpenRecovery={jest.fn()} />);
  expect(s.queryByTestId('kip-room')).toBeNull();
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  expect(s.getByTestId('kip-room').props.room).toBe('type:glance:ON IT…:dots:cloudy:day:coral:2:moving::');
  expect(s.getByTestId('kip-room').props.accessibilityLabel).toBe('KIP at the desk, typing. Window: cloudy');
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
  expect(s.getByTestId('kip-room').props.accessibilityLabel).toBe('KIP at the desk, typing. Window: night');
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
  fireEvent(s.getByTestId('kip-room-frame-inner'), 'layout', { nativeEvent: { layout: { width: 323, height: 200, x: 0, y: 0 } } });
  expect(s.getByTestId('kip-room').props.room).toBe('rest:glance:ON IT…:dots:cloudy:day:coral:2:moving:you:');
});

it('draws your saved room and what KIP wears; a piece this build cannot draw shows as the starter piece', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue({
    catalogueVersion: 1, owned: [], fresh: [], version: 1, counters: { recapsRead: 0, buddyCheers: 0 },
    room: { ...STARTER_LOADOUT, rug: 'rug.red', wallpaper: 'wall.fromTheFuture' }, worn: { ...EMPTY_WORN, head: 'out.cap' },
  });
  await act(async () => { await loadCosmetics(); });
  const s = renderCard();
  const room = s.getByTestId('kip-room');
  expect(JSON.parse(room.props.loadout)).toEqual({ ...STARTER_LOADOUT, rug: 'rug.red' });
  expect(JSON.parse(room.props.worn).head).toBe('out.cap');
});

it('draws the starter room and a bare KIP before the first read', () => {
  const room = renderCard().getByTestId('kip-room');
  expect(JSON.parse(room.props.loadout)).toEqual(STARTER_LOADOUT);
  expect(JSON.parse(room.props.worn)).toEqual(EMPTY_WORN);
});

it('pauses the room while decorate mode is open', () => {
  expect(renderCard().getByTestId('kip-room').props.room).not.toContain(':paused');
  const s = renderCard({ paused: true });
  expect(s.getByTestId('kip-room').props.room).toContain(':paused');
});
