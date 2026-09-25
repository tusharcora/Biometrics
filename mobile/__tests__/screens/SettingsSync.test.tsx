import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { useSync } from '../../src/sync/SyncProvider';
import { getTimezoneState, listTimeZones } from '../../src/lib/timezone';

jest.mock('../../src/sync/SyncProvider', () => ({ useSync: jest.fn() }));
jest.mock('../../src/lib/timezone');

const syncNow = jest.fn();
const set = (over: object) =>
  (useSync as jest.Mock).mockReturnValue({ state: 'idle', lastSyncedAt: null, connection: 'CONNECTED', dataVersion: 0, syncNow, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  (getTimezoneState as jest.Mock).mockResolvedValue({ timezone: 'America/Los_Angeles', overridden: false });
  (listTimeZones as jest.Mock).mockReturnValue([]);
});

it('shows when it last synced and syncs from "Sync now"', () => {
  set({ lastSyncedAt: new Date(Date.now() - 12 * 60_000).toISOString() });
  const { getByTestId } = render(<SettingsScreen />);
  expect(getByTestId('settings-last-synced')).toHaveTextContent('Last synced 12 min ago');
  fireEvent.press(getByTestId('settings-sync-now'));
  expect(syncNow).toHaveBeenCalledWith('manual');
});

it('says so when it has never synced', () => {
  set({ lastSyncedAt: null });
  expect(render(<SettingsScreen />).getByTestId('settings-last-synced')).toHaveTextContent('Not synced yet');
});

it('disables "Sync now" while syncing', () => {
  set({ state: 'syncing' });
  const { getByTestId } = render(<SettingsScreen />);
  expect(getByTestId('settings-sync-now')).toBeDisabled();
  expect(getByTestId('settings-sync-now')).toHaveTextContent('Syncing…');
});

it('hides the sync rows when Google Health is not connected', () => {
  set({ connection: 'NOT_CONNECTED' });
  const { queryByTestId } = render(<SettingsScreen />);
  expect(queryByTestId('settings-sync-now')).toBeNull();
  expect(queryByTestId('settings-last-synced')).toBeNull();
});
