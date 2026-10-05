import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fetchRecaps } from '../../src/api/recaps';
import { RecapReadyCard } from '../../src/components/recap/RecapReadyCard';

jest.mock('../../src/api/recaps');
jest.mock('expo-secure-store');
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

const list = fetchRecaps as jest.Mock;
let store: Record<string, string>;
const recap = (over: Record<string, unknown> = {}) => ({
  id: 'm1', kind: 'MONTH', periodStart: '2026-09-01', periodEnd: '2026-09-30', line: 'A good month.', personaId: 'mochi', builtAt: '2026-10-01T09:00:00.000Z', openedAt: null, ...over,
});

// Lets the card's fetch and keychain read finish, so a "stays hidden" check could fail.
const settle = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((k: string) => Promise.resolve(store[k] ?? null));
  (SecureStore.setItemAsync as jest.Mock).mockImplementation((k: string, v: string) => {
    store[k] = v;
    return Promise.resolve();
  });
  list.mockResolvedValue([recap()]);
});

it('announces an unopened month and opens it (then gets out of the way)', async () => {
  render(<RecapReadyCard />);
  expect(await screen.findByText('Your September recap is ready')).toBeTruthy();
  expect(list).toHaveBeenCalledWith({ limit: 1 });
  fireEvent.press(screen.getByTestId('recap-ready-open'));
  expect(mockNavigate).toHaveBeenCalledWith('Recap', { id: 'm1' });
  expect(screen.queryByTestId('recap-ready-card')).toBeNull();
});

it('says "Your week is ready" for a week', async () => {
  list.mockResolvedValue([recap({ id: 'w1', kind: 'WEEK', periodStart: '2026-09-28' })]);
  render(<RecapReadyCard />);
  expect(await screen.findByText('Your week is ready')).toBeTruthy();
});

it('stays hidden once the newest recap was opened, dismissed, or could not be loaded', async () => {
  list.mockResolvedValue([recap({ openedAt: '2026-10-01T10:00:00.000Z' })]);
  const opened = render(<RecapReadyCard />);
  await waitFor(() => expect(list).toHaveBeenCalled());
  await settle();
  expect(opened.queryByTestId('recap-ready-card')).toBeNull();
  // An opened recap is hidden before the dismissal is even read.
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  opened.unmount();

  store.recapCardDismissed = 'm1';
  list.mockResolvedValue([recap()]);
  const dismissed = render(<RecapReadyCard />);
  await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith('recapCardDismissed'));
  await settle();
  expect(dismissed.queryByTestId('recap-ready-card')).toBeNull();
  dismissed.unmount();

  list.mockRejectedValue(new Error('offline'));
  render(<RecapReadyCard />);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  await settle();
  expect(screen.queryByTestId('recap-ready-card')).toBeNull();
});

it('dismisses and remembers that recap only; a newer one shows again', async () => {
  const first = render(<RecapReadyCard />);
  fireEvent.press(await first.findByTestId('recap-ready-dismiss'));
  expect(first.queryByTestId('recap-ready-card')).toBeNull();
  await waitFor(() => expect(store.recapCardDismissed).toBe('m1'));
  first.unmount();
  list.mockResolvedValue([recap({ id: 'w9', kind: 'WEEK', periodStart: '2026-10-05' })]);
  render(<RecapReadyCard />);
  expect(await screen.findByTestId('recap-ready-card')).toBeTruthy();
});
