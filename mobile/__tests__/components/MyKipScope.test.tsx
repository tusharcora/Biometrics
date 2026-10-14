import React from 'react';
import { act, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { MyKipScope } from '../../src/components/kip/MyKipScope';
import { readToasted, writeToasted } from '../../src/lib/room/toasted';

jest.mock('../../src/lib/kip/myKip', () => ({ loadMyKipColour: jest.fn(async () => undefined), resetMyKip: jest.fn() }));
jest.mock('../../src/lib/room/cosmeticsStore', () => ({ loadCosmetics: jest.fn(async () => null), resetCosmetics: jest.fn() }));
const store: Record<string, string> = {};
jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (k) => store[k] ?? null);
jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (k, v) => { store[k] = v; });
const del = jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (k) => { delete store[k]; });

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  jest.clearAllMocks();
});

it("signing out forgets the toasted pieces, so the next account's backfill summary is not swallowed", async () => {
  await writeToasted({ ids: ['wall.panel'], backfill: 7 });
  const s = render(<MyKipScope />);
  s.unmount();
  await act(async () => undefined);
  expect(del).toHaveBeenCalledWith('kipToasted');
  expect(await readToasted()).toEqual({ ids: [], backfill: 0 });
});

it('a keychain failure while forgetting them is swallowed', async () => {
  del.mockRejectedValueOnce(new Error('keychain'));
  const s = render(<MyKipScope />);
  s.unmount();
  await act(async () => undefined);
  expect(del).toHaveBeenCalledWith('kipToasted');
});
