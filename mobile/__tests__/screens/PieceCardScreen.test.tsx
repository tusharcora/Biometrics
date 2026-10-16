import React from 'react';
import type * as ReactNative from 'react-native';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { getRoomSound, resetRoomSound } from '../../src/lib/room/sound';
import { PieceCardScreen } from '../../src/screens/PieceCardScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('expo-secure-store');
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const mockNav = { goBack: jest.fn(), navigate: jest.fn() };
let mockParams: object = { pieceId: 'p1' };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

async function open(pieceId = 'p1') {
  mockParams = { pieceId };
  const radio = { id: 'p1', item: 'item.radio', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 1 };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout: { ...starterLayout(), pieces: [...starterLayout().pieces, radio] }, counts: { ...cosmeticsDTO().counts, 'item.radio': 1 } }));
  await act(async () => { await loadCosmetics(); });
  const s = render(<PieceCardScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCosmetics(); resetRoomSound(); (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null); });

it('shows the radio\'s card and takes a screen reader\'s focus on its name (spec §8.1, house pattern)', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  // The test renderer has no native views: each ref stands for itself, so the test sees which element got focus.
  const node = jest.spyOn(require('react-native') as typeof ReactNative, 'findNodeHandle').mockImplementation(((el: unknown) => el) as never);
  const s = await open();
  expect(s.getByTestId('card-name')).toHaveTextContent('Old radio');
  expect(s.getByTestId('card-effect')).toHaveTextContent(/^Plays a quiet lo-fi loop while the room is open\./);
  expect(s.getByTestId('card-earned').props.accessibilityLabel).toBe('From the coin shop, 150 coins');
  expect(focus.mock.calls.map(([el]) => (el as unknown as { props?: { testID?: string } }).props?.testID)).toEqual(['card-name']);
  focus.mockRestore();
  node.mockRestore();
});

it('the sound switch starts off and is remembered on the device (spec §8.2, ruling 15)', async () => {
  const s = await open();
  expect(s.getByTestId('card-sound').props.value).toBe(false);
  await act(async () => { fireEvent(s.getByTestId('card-sound'), 'valueChange', true); });
  expect(getRoomSound()).toBe(true);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kipRoomSound', '1');
});

it('Move and Store open the editor with the piece selected; Store has already stored it (ruling 16)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('card-store'));
  expect(mockNav.goBack).toHaveBeenCalled();
  expect(mockNav.navigate).toHaveBeenCalledWith('DecorateRoom', { select: 'p1', store: true });
  fireEvent.press(s.getByTestId('card-move'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('DecorateRoom', { select: 'p1' });
});

it('a piece that has left the room says so', async () => {
  const s = await open('gone');
  expect(s.getByTestId('card-gone')).toBeTruthy();
  expect(s.queryByTestId('card-move')).toBeNull();
});

it('reads the stored sound switch when it opens, and Close goes back (T13-CARRY)', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('1');
  const s = await open();
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('kipRoomSound');
  expect(s.getByTestId('card-sound').props.value).toBe(true);
  fireEvent.press(s.getByTestId('card-close'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
});

it('a plant has a card with no switch, and its buttons are read with its name (ruling 16)', async () => {
  const s = await open('plant');
  expect(s.getByTestId('card-name')).toHaveTextContent('Fern');
  expect(s.queryByTestId('card-sound')).toBeNull();
  expect(s.getByTestId('card-move').props.accessibilityLabel).toBe('Move the fern');
  expect(s.getByTestId('card-store').props.accessibilityLabel).toBe('Store the fern');
});
