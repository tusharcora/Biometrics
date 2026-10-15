import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics, putCosmetics } from '../../src/api/cosmetics';
import { DecorateRoomScreen } from '../../src/screens/DecorateRoomScreen';
import { getCosmetics, loadCosmetics, markCosmeticsSeen, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
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

const select = (s: ReturnType<typeof render>, id: string) => fireEvent.press(s.getByTestId(`edit-piece-${id}`));

describe('the toolbar (spec §5.3)', () => {
  it('with nothing selected shows Undo, Redo and the grid toggle; the pieces list selects', async () => {
    const s = await openEditor();
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
    expect(s.getByTestId('edit-grid').props.accessibilityLabel).toBe('Hide grid');
    fireEvent.press(s.getByTestId('edit-grid'));
    expect(s.getByTestId('edit-grid').props.accessibilityLabel).toBe('Show grid');
    expect(s.getByTestId('edit-piece-plant').props.accessibilityLabel).toBe('Fern, on the floor, tile 1, 1');
    select(s, 'plant');
    expect(s.getByTestId('edit-tool-line')).toHaveTextContent('Fern · on the floor');
    expect(s.getByTestId('edit-piece-plant').props.accessibilityState.selected).toBe(true);
  });

  it('Flip changes the room and enables Done; Undo puts it back and Done greys again', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((q: { id: string }) => q.id === 'plant').mirror).toBe(true);
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(s.getByTestId('edit-redo'));
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
  });

  it('Turn is greyed for a symmetric piece; the desk can turn but never be stored or copied', async () => {
    const s = await openEditor();
    select(s, 'plant');
    expect(s.getByTestId('edit-turn').props.accessibilityState.disabled).toBe(true);
    select(s, 'desk');
    expect([s.getByTestId('edit-turn'), s.getByTestId('edit-store'), s.getByTestId('edit-another')].map((b) => b.props.accessibilityState.disabled)).toEqual([false, true, true]);
  });

  it('Store sends a piece and what is on it to the inventory, and says so (Review Focus 4)', async () => {
    const s = await openEditor();
    select(s, 'plank');
    expect(s.getByTestId('edit-store').props.accessibilityLabel).toBe('Store wall plank and 1 piece on it');
    fireEvent.press(s.getByTestId('edit-store'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('5 / 40 in room');
    expect(s.queryByTestId('edit-piece-shelf')).toBeNull();
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('7 / 40 in room');
  });

  it('Turn is greyed when the turned piece would not fit (spec §5.3)', async () => {
    const crowded = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'plant.cactus', layer: 'floor' as const, x: 2, y: 2, facing: 'L' as const, mirror: false }] };
    const s = await openEditor(undefined, cosmeticsDTO({ layout: crowded }));
    select(s, 'desk');
    // Turned, the desk would cover the cactus at (2, 2): Turn is greyed rather than refused.
    expect(s.getByTestId('edit-turn').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Done and Cancel (Spec B §6.4 rulings, spec §5.3)', () => {
  it('Done saves the draft against the version it was built on, and closes', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockImplementation(async (body) => cosmeticsDTO({ layout: body.layout, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(putCosmetics).toHaveBeenCalledWith(expect.objectContaining({ version: 2, worn: expect.any(Object), layout: expect.objectContaining({ v: 1 }) }));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    expect(getCosmetics()!.version).toBe(3);
  });

  it('409: stays open with the server\'s layout, says it was refreshed, Done greyed (Review Focus 2)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    const theirs = { ...starterLayout(), pieces: starterLayout().pieces.map((q) => (q.id === 'desk' ? { ...q, y: 4 } : q)) };
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout: theirs, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout)).toEqual(theirs);
    expect(s.getByTestId('edit-notice')).toHaveTextContent('Something changed on another device. Your room was refreshed.');
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
  });

  it('a failed re-read keeps the draft and says the save failed; Done stays enabled', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
  });

  it('nothing can be edited while a save is in flight (Spec B Task 14 rulings)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    let resolve!: (v: unknown) => void;
    (putCosmetics as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    act(() => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-editing').props.pointerEvents).toBe('none');
    fireEvent.press(s.getByTestId('edit-flip'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((q: { id: string }) => q.id === 'plant').mirror).toBe(true);
    await act(async () => { resolve(cosmeticsDTO({ version: 3 })); });
  });

  it('Cancel with changes asks first; a dismiss is held the same way', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    fireEvent.press(s.getByTestId('edit-cancel'));
    expect(alert.mock.calls[0]![0]).toBe('Discard your changes?');
    const prevent = jest.fn();
    act(() => mockListeners.beforeRemove!({ preventDefault: prevent, data: { action: { type: 'GO_BACK' } } }));
    expect(prevent).toHaveBeenCalled();
    (alert.mock.calls[0]![2] as Array<{ onPress?: () => void }>)[1]!.onPress!();
    expect(mockNav.goBack).toHaveBeenCalled();
  });
});

describe('an honest refresh and the save lock (Spec B Task 14 rulings)', () => {
  const plantMirror = (s: ReturnType<typeof render>) =>
    JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((q: { id: string }) => q.id === 'plant').mirror;

  it('a 403 shows the server\'s room and says it was refreshed', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(403, 'not_owned', 'not_owned'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ version: 2 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent('Something changed on another device. Your room was refreshed.');
    expect(plantMirror(s)).toBe(false);
  });

  it('a re-read the store drops (older than what is shown) is no refresh: the draft stays and the save failed', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ version: 1 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
    expect(plantMirror(s)).toBe(true);
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
  });

  it('a re-read dropped by a mark-seen in the meantime is no refresh either (the store republished the same room)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    let land!: (v: unknown) => void;
    (fetchCosmetics as jest.Mock).mockReturnValue(new Promise((r) => { land = r; }));
    act(() => { fireEvent.press(s.getByTestId('edit-done')); });
    await act(async () => undefined);
    await act(async () => { await markCosmeticsSeen(['rug.red']); });
    await act(async () => { land(cosmeticsDTO({ version: 3 })); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
    expect(plantMirror(s)).toBe(true);
  });

  it('announces every failed save on iOS, the same failure twice included', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(announce.mock.calls.filter((c) => c[0] === "Couldn't save your room. Try again.")).toHaveLength(2);
    announce.mockRestore();
  });

  it('while a save is in flight Cancel is disabled and a dismiss is held without asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    let resolve!: (v: unknown) => void;
    (putCosmetics as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    act(() => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-cancel').props.accessibilityState.disabled).toBe(true);
    const prevent = jest.fn();
    act(() => mockListeners.beforeRemove!({ preventDefault: prevent, data: { action: { type: 'GO_BACK' } } }));
    expect(prevent).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    await act(async () => { resolve(cosmeticsDTO({ version: 3 })); });
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
