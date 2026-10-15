import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { DecorateRoomScreen } from '../../src/screens/DecorateRoomScreen';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { useDecorateOpen } from '../../src/lib/room/decorateOpen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
// The window's weather (useTodayScene): no real HTTP from Jest (Spec B ruling P29).
jest.mock('../../src/api/scores', () => ({ ...jest.requireActual('../../src/api/scores'), fetchScoresWithBands: jest.fn(async () => ({ scores: [], bands: undefined })) }));
jest.mock('../../src/api/sleep', () => ({ ...jest.requireActual('../../src/api/sleep'), fetchSleep: jest.fn(async () => ({ nights: [] })) }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined), postRoomWelcomed: jest.fn(async () => undefined) }));
type RemoveEvent = { preventDefault: () => void; data: { action: unknown } };
const mockListeners: Record<string, (e: RemoveEvent) => void> = {};
const mockNav = {
  goBack: jest.fn(), navigate: jest.fn(), dispatch: jest.fn(),
  addListener: jest.fn((event: string, cb: (e: RemoveEvent) => void) => { mockListeners[event] = cb; return () => undefined; }),
};
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

async function openEditor(params?: object, dto = cosmeticsDTO({ version: 2 })) {
  mockParams = params;
  (fetchCosmetics as jest.Mock).mockResolvedValue(dto);
  await act(async () => { await loadCosmetics(); });
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCosmetics(); });

it('shows EDITING, the room count, and the whole room at 2 points, Done disabled (spec §5.2)', async () => {
  const s = await openEditor();
  expect(s.getByText('EDITING')).toBeTruthy();
  expect(s.getByTestId('edit-count')).toHaveTextContent('7 / 40 in room');
  expect(s.getByTestId('edit-count').props.accessibilityLabel).toBe('7 of 40 pieces in the room');
  const room = s.getByTestId('edit-room-view');
  expect([room.props.tier, JSON.parse(room.props.layout).pieces.length, room.props.room.split(':')[7]]).toEqual([1, 7, '2']);
  expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
});

it('pauses the KIP page\'s loops while open (Spec B ruling 17)', async () => {
  const seen: boolean[] = [];
  function Probe() { seen.push(useDecorateOpen()); return null; }
  const p = render(<Probe />);
  const s = await openEditor();
  expect(seen.at(-1)).toBe(true);
  s.unmount();
  p.rerender(<Probe />);
  expect(seen.at(-1)).toBe(false);
});

it('Cancel with nothing changed closes at once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const s = await openEditor();
  fireEvent.press(s.getByTestId('edit-cancel'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});

it('a failed read shows Try again and Close (Spec B Task 13 ruling)', async () => {
  (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
  mockParams = undefined;
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('edit-load-failed')).toBeTruthy();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { fireEvent.press(s.getByTestId('edit-retry')); });
  expect(s.getByText('EDITING')).toBeTruthy();
});
