import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { fetchRecaps } from '../../src/api/recaps';
import { resetMyKip, setMyKipColour } from '../../src/lib/kip/myKip';
import { getTimezoneState } from '../../src/lib/timezone';
import { storyRingColor } from '../../src/lib/recapTheme';
import { openRecap } from '../../src/lib/unwatchedRecap';
import { SettingsScreen } from '../../src/screens/SettingsScreen';

jest.mock('../../src/lib/timezone');
jest.mock('../../src/api/recaps', () => ({ fetchRecaps: jest.fn(), markRecapOpened: jest.fn() }));

const navigate = jest.fn();
// Several Profile parts listen for focus (the ring, the badges, the card statuses), so keep every listener.
const focus = new Set<() => void>();
const navigation = { navigate, addListener: jest.fn((_e: string, fn: () => void) => (focus.add(fn), () => focus.delete(fn))) };
const week = { id: 'w1', kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A week.', personaId: 'mochi', builtAt: '2026-10-05T09:00:00.000Z', openedAt: null };

async function open() {
  render(<NavigationContext.Provider value={navigation as never}><SettingsScreen /></NavigationContext.Provider>);
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'UTC', overridden: false });
  (fetchRecaps as jest.Mock).mockResolvedValue([week]);
  setMyKipColour('lime');
});

afterEach(() => resetMyKip());

it("rings the passport's KIP photo in your KIP's colour and plays the week's story from it", async () => {
  await open();
  const frame = StyleSheet.flatten(screen.getByTestId('passport-photo').props.style);
  // Your KIP's colour (lime); the recap's stored personaId (Mochi) is ignored.
  expect([storyRingColor('lime', 'light'), storyRingColor('lime', 'dark')]).toContain(frame.borderColor);
  expect(screen.getByTestId('passport-recap-dot')).toBeTruthy();
  expect(screen.getByTestId('passport-recap').props.accessibilityLabel).toBe('Your KIP. Your week is ready. Play your story');
  fireEvent.press(screen.getByTestId('passport-recap'));
  expect(navigate).toHaveBeenCalledWith('RecapStory', { id: 'w1' });
});

it('asks for weeks only: a month never rings the photo', async () => {
  (fetchRecaps as jest.Mock).mockResolvedValue([{ ...week, id: 'sep', kind: 'MONTH', periodStart: '2026-09-01' }]);
  await open();
  expect(fetchRecaps).toHaveBeenCalledWith({ kind: 'WEEK', limit: 1 });
  expect(screen.queryByTestId('passport-recap')).toBeNull();
});

it('drops the ring once the recap is opened, and re-reads it on focus', async () => {
  await open();
  await act(async () => openRecap('w1'));
  expect(screen.queryByTestId('passport-recap')).toBeNull();
  expect(screen.queryByTestId('passport-recap-dot')).toBeNull();
  (fetchRecaps as jest.Mock).mockResolvedValue([{ ...week, id: 'w2', periodStart: '2026-10-05', periodEnd: '2026-10-11' }]);
  await act(async () => focus.forEach((fn) => fn()));
  expect(screen.getByTestId('passport-recap')).toBeTruthy();
});
