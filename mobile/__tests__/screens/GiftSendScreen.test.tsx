import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { sendGift } from '../../src/api/rooms';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { GiftSendScreen } from '../../src/screens/GiftSendScreen';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/rooms', () => ({ ...jest.requireActual('../../src/api/rooms'), sendGift: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const mockNav = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: { buddyId: 'b1', name: 'Maya' } }) }));

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 } }));
  await act(async () => { await loadCosmetics(); });
});

it('lists the spares, picks a note, sends once with one request id, and the count drops at once (spec §10.3)', async () => {
  (sendGift as jest.Mock).mockResolvedValue({ id: 'x', counts: { ...STARTER_COUNTS, 'plant.fern': 1 } });
  // The reload after the send (T11T12-RELOAD) waits, so the count seen first is the send's own answer.
  const reload = deferred<ReturnType<typeof cosmeticsDTO>>();
  (fetchCosmetics as jest.Mock).mockReturnValueOnce(reload.promise);
  render(<GiftSendScreen />);
  expect(screen.getByTestId('gift-title')).toHaveTextContent('Send Maya a gift');
  expect(screen.getByTestId('gift-spare-plant.fern').props.accessibilityLabel).toBe('Fern, 1 spare');
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  fireEvent.press(screen.getByTestId('gift-note-thought'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(sendGift).toHaveBeenCalledTimes(1);
  expect(sendGift).toHaveBeenCalledWith('b1', expect.stringMatching(/^[0-9a-f-]{36}$/), 'plant.fern', 'thought');
  expect(getCosmetics()?.counts['plant.fern']).toBe(1);
  // No spare is left, and a sent piece is never NEW for the sender.
  expect(screen.queryByTestId('gift-spare-plant.fern')).toBeNull();
  expect(getCosmetics()?.fresh).toEqual([]);
  expect(screen.getByTestId('gift-notice')).toHaveTextContent('Sent the Fern to Maya.');
  // The cosmetics are read again at once (T11T12-RELOAD), and that read lands.
  expect(fetchCosmetics).toHaveBeenCalledTimes(2);
  await act(async () => { reload.resolve(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 1 }, version: 2 })); });
  expect(getCosmetics()?.version).toBe(2);
});

it('a lost answer keeps the same request id for the retry; a server answer drops it (P2 ruling 30)', async () => {
  (sendGift as jest.Mock)
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new ApiError(403, 'not_spare', 'not_spare'))
    .mockRejectedValueOnce(new ApiError(429, 'gift_limit', 'gift_limit'));
  render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(screen.getByTestId('gift-notice')).toHaveTextContent("Couldn't send that just now.");
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(screen.getByTestId('gift-notice')).toHaveTextContent(/^That piece isn't a spare\./);
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  // The limit's line is made from GIFTS_PER_DAY.
  expect(screen.getByTestId('gift-notice')).toHaveTextContent(/^That's 3 gifts today\./);
  const [first, second, third] = (sendGift as jest.Mock).mock.calls.map((c) => c[1]);
  expect(first).toBe(second);
  expect(third).not.toBe(second);
});

it('a request id is never reused for another piece (P2 ruling 30)', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2, 'plant.cactus': 2 } }));
  await act(async () => { await loadCosmetics({ fresh: true }); });
  (sendGift as jest.Mock).mockRejectedValue(new Error('network'));
  render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  fireEvent.press(screen.getByTestId('gift-spare-plant.cactus'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  const [first, second] = (sendGift as jest.Mock).mock.calls.map((c) => c[1]);
  expect(first).not.toBe(second);
});

it('a try-later answer reads the neutral busy line (FINAL-I2), and a retry sends again with a new id', async () => {
  (sendGift as jest.Mock).mockRejectedValueOnce(new ApiError(503, 'try_later', 'try_later')).mockResolvedValueOnce({ id: 'x', counts: { ...STARTER_COUNTS, 'plant.fern': 1 } });
  render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(screen.getByTestId('gift-notice')).toHaveTextContent("Couldn't do that just now.");
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: false });
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(screen.getByTestId('gift-notice')).toHaveTextContent('Sent the Fern to Maya.');
});

it('with no spares says how a piece becomes one, and never mentions money', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { await loadCosmetics({ fresh: true }); });
  render(<GiftSendScreen />);
  expect(screen.getByTestId('gift-none')).toHaveTextContent(/^No spares yet\./);
  expect(screen.queryByText(/\$|buy|price/i)).toBeNull();
});

it('closes with its own 44-pt Close button (PF4-F16)', () => {
  render(<GiftSendScreen />);
  expect(String(screen.getByTestId('gift-close').props.className ?? '')).not.toMatch(/rounded-full/);
  fireEvent.press(screen.getByTestId('gift-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('a send answer that lands after sign-out publishes nothing into the next account (T10-FIX M2)', async () => {
  const late = deferred<{ id: string; counts: Record<string, number> }>();
  (sendGift as jest.Mock).mockReturnValueOnce(late.promise);
  const s = render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  s.unmount();
  // Signed out, and another account signed in with its own room read.
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 5 } }));
  await act(async () => { await loadCosmetics(); });
  // Any later read waits, so only the late answer could change what is shown.
  (fetchCosmetics as jest.Mock).mockReturnValue(new Promise(() => {}));
  await act(async () => { late.resolve({ id: 'x', counts: { ...STARTER_COUNTS, 'plant.fern': 1 } }); });
  expect(getCosmetics()?.counts['plant.fern']).toBe(5);
});

it('a failed read of your pieces says so with Try again, never an endless spinner (T10-FIX M3)', async () => {
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockRejectedValueOnce(new Error('network'));
  render(<GiftSendScreen />);
  await act(async () => undefined);
  expect(screen.queryByTestId('gift-loading')).toBeNull();
  expect(screen.getByTestId('gift-load-failed')).toHaveTextContent(/^Couldn't load your pieces just now\./);
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 } }));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-load-retry')); });
  expect(screen.queryByTestId('gift-load-failed')).toBeNull();
  expect(screen.getByTestId('gift-spare-plant.fern')).toBeTruthy();
});

it('a picked piece that is no longer a spare is let go: Send is off, and it is not picked when it comes back (T10-FIX M5)', async () => {
  render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: false });
  // Placed on another device: the next read has no spare fern.
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 1 }, version: 2 }));
  await act(async () => { await loadCosmetics({ fresh: true }); });
  expect(screen.queryByTestId('gift-spare-plant.fern')).toBeNull();
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: true });
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 }, version: 3 }));
  await act(async () => { await loadCosmetics({ fresh: true }); });
  expect(screen.getByTestId('gift-spare-plant.fern').props.accessibilityState).toMatchObject({ selected: false });
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: true });
});
