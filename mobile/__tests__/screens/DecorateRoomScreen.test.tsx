import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AccessibilityInfo, Alert, Dimensions, Platform } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics, putCosmetics } from '../../src/api/cosmetics';
import { EDIT_CELL_PT, initialPan } from '../../src/components/edit/EditRoom';
import { DecorateRoomScreen, EDIT_ROOM_HEIGHT, editRoomHeight, initialState } from '../../src/screens/DecorateRoomScreen';
import { getCosmetics, loadCosmetics, markCosmeticsSeen, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { LIFT_PT, targetOf } from '../../src/lib/room/edit/drag';
import { initEditor } from '../../src/lib/room/edit/editor';
import { targetPoint } from '../../src/lib/room/edit/targets';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { drawIsoStatic, pieceAt } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { useDecorateOpen } from '../../src/lib/room/decorateOpen';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

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

/** The chair's exit tile in window points (the jest stand-in for measureInWindow leaves the room's origin at 0, 0). */
function seatExit() {
  const pan = initialPan(initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 2, newIds: [] }), Dimensions.get('window').width, EDIT_ROOM_HEIGHT);
  const [x, y] = projOf(isoGrid(1))(3.5, 2.5);
  return { x: pan.x + x * EDIT_CELL_PT, y: pan.y + y * EDIT_CELL_PT + LIFT_PT };
}

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

  it('a save starting clears the last failure, so Android re-announces the same failure (ruling T12-CARRY)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
    let reject!: (e: unknown) => void;
    (putCosmetics as jest.Mock).mockReturnValue(new Promise((_, r) => { reject = r; }));
    act(() => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.queryByTestId('edit-notice')).toBeNull();
    await act(async () => { reject(new Error('offline')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
  });
});

describe('dragging on the screen (spec §5.3)', () => {
  /** The screen's room: full window width, EDIT_ROOM_HEIGHT tall, starting at initialPan. */
  const roomPan = () => initialPan(initialState(getCosmetics()!, {}), Dimensions.get('window').width, EDIT_ROOM_HEIGHT);
  const hits = () => drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'clear', night: false, colour: 'coral' }).hits;
  /** A finger point on piece `id`: the middle of a cell where it is the topmost piece. */
  const grip = (id: string) => {
    const all = hits();
    const pan = roomPan();
    for (const [x, y, w, h, c] of all.find((q) => q.id === id)!.rects) {
      if (c.startsWith('rgba')) continue;
      for (let i = x; i < x + w; i++) for (let j = y; j < y + h; j++) {
        if (pieceAt(all, i, j) === id) return { x: pan.x + (i + 0.5) * EDIT_CELL_PT, y: pan.y + (j + 0.5) * EDIT_CELL_PT };
      }
    }
    throw new Error(`no cell of ${id} is on top`);
  };
  /** Where the finger that grabbed the fern goes to carry it over floor point (i, j). */
  const carry = (i: number, j: number) => {
    const fern = starterLayout().pieces.find((q) => q.id === 'plant')!;
    const [hx, hy] = targetPoint(isoGrid(1), starterLayout(), fern.item, targetOf(fern), fern.facing);
    const [x, y] = projOf(isoGrid(1))(i, j);
    const at = grip('plant');
    return { x: at.x + (x - hx) * EDIT_CELL_PT, y: at.y + (y - hy) * EDIT_CELL_PT };
  };
  const drag = (from: { x: number; y: number }, to: { x: number; y: number }) => act(() => fireGestureHandler(getByGestureTestId('edit-room-drag'), [
    { state: State.BEGAN, ...from }, { state: State.ACTIVE, ...from }, { state: State.ACTIVE, ...to }, { state: State.END, ...to },
  ]));

  it('the room is pinned above the scrolling toolbar and lists, so a drag never scrolls the page (ruling T12-FIX)', async () => {
    const s = await openEditor();
    expect(within(s.getByTestId('edit-scroll')).queryByTestId('edit-room')).toBeNull();
    expect(within(s.getByTestId('edit-scroll')).getByTestId('edit-history')).toBeTruthy();
    expect(within(s.getByTestId('edit-editing')).getByTestId('edit-room')).toBeTruthy();
  });

  it('held and let go in place, the desk, plank, desk item and lamp stay put with no undo step (ruling T12-FIX)', async () => {
    const s = await openEditor();
    const before = s.getByTestId('edit-room-view').props.layout;
    for (const id of ['desk', 'plank', 'deskitem', 'lamp']) {
      drag(grip(id), grip(id));
      expect([id, s.getByTestId('edit-room-view').props.layout]).toEqual([id, before]);
      expect(s.queryByTestId('edit-reason')).toBeNull();
    }
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
  });

  it('letting go on an invalid spot puts the piece back, adds no undo step and says why (Review Focus 3)', async () => {
    const s = await openEditor();
    const before = s.getByTestId('edit-room-view').props.layout;
    drag(grip('plant'), carry(9, 9));
    expect(s.getByTestId('edit-room-view').props.layout).toBe(before);
    expect(s.getByTestId('edit-room-view').props.hide).toBeNull();
    expect(s.getByTestId('edit-reason')).toHaveTextContent("Doesn't fit here");
    // Picking it up selected it; put the selection down to see the history.
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
  });

  it('letting go on a valid spot moves the piece as one undo step', async () => {
    const s = await openEditor();
    drag(grip('plant'), carry(6.5, 5.5));
    const plant = JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((p: { id: string }) => p.id === 'plant');
    expect([plant.x, plant.y]).toEqual([6, 5]);
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(false);
  });
});

describe('the drawer in the editor (spec §5.4)', () => {
  type TileHandlers = { onStart: (e: object) => void; onUpdate: (e: object) => void; onEnd: (e: object, ok: boolean) => void };
  /** A tile's hold, its handlers called directly so the piece can stay in the air (ruling: RNGH always ends a gesture). */
  const tileHold = (item: string) => (getByGestureTestId(`drawer-drag-${item}`) as unknown as { handlers: TileHandlers }).handlers;

  it('Place puts the picked piece on the nearest free spot and selects it; the count goes up', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 }, version: 2 }));
    fireEvent.press(s.getByTestId('drawer-tile-plant.fern'));
    fireEvent.press(s.getByTestId('drawer-place'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('8 / 40 in room');
    expect(s.getByTestId('edit-tool-line')).toHaveTextContent('Fern · on the floor');
  });

  it('opens on New with the toasted piece picked when asked (spec §1 Toasts)', async () => {
    const s = await openEditor({ drawer: 'new', item: 'corner.beanbag' }, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, fresh: [{ itemId: 'corner.beanbag', source: 'anyFamily:2' }], version: 2 }));
    expect(s.getByTestId('drawer-tab-new').props.accessibilityState.selected).toBe(true);
    expect(s.getByTestId('drawer-tile-corner.beanbag').props.accessibilityState.selected).toBe(true);
  });

  it('a beanbag dragged in onto the chair goes back to the inventory, and says why (Review Focus 3)', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, version: 2 }));
    const before = s.getByTestId('edit-room-view').props.layout;
    const { x, y } = seatExit();
    // In the air over the chair: red, with the reason.
    act(() => tileHold('corner.beanbag').onStart({ absoluteX: 20, absoluteY: 700 }));
    act(() => tileHold('corner.beanbag').onUpdate({ absoluteX: x, absoluteY: y }));
    expect(s.getByTestId('edit-drag-reason')).toHaveTextContent("Blocks KIP's chair");
    act(() => tileHold('corner.beanbag').onEnd({ absoluteX: x, absoluteY: y }, true));
    expect(s.getByTestId('edit-room-view').props.layout).toBe(before);
    expect(s.getByTestId('edit-reason')).toHaveTextContent("Blocks KIP's chair");
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
    // The same as one whole gesture (RNGH ends it): the screen says why again. Selecting clears the last reason first.
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    expect(s.queryByTestId('edit-reason')).toBeNull();
    act(() => fireGestureHandler(getByGestureTestId('drawer-drag-corner.beanbag'), [{ state: State.BEGAN, absoluteX: 20, absoluteY: 700 }, { state: State.ACTIVE, absoluteX: 20, absoluteY: 700 }, { state: State.ACTIVE, absoluteX: x, absoluteY: y }, { state: State.END, absoluteX: x, absoluteY: y }]));
    expect(s.getByTestId('edit-room-view').props.layout).toBe(before);
    expect(s.getByTestId('edit-reason')).toHaveTextContent("Blocks KIP's chair");
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
  });

  it('a live drawer drag holds both scrolls still from lift to drop, and to a cancel (T13-FIX)', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'corner.beanbag': 1, 'plant.fern': 2 }, version: 2 }));
    const scrolls = () => [s.getByTestId('edit-scroll').props.scrollEnabled, s.getByTestId('drawer-scroll').props.scrollEnabled];
    expect(scrolls()).toEqual([true, true]);
    act(() => tileHold('plant.fern').onStart({ absoluteX: 20, absoluteY: 700 }));
    expect(scrolls()).toEqual([false, false]);
    act(() => tileHold('plant.fern').onUpdate({ absoluteX: 30, absoluteY: 400 }));
    expect(scrolls()).toEqual([false, false]);
    act(() => tileHold('plant.fern').onEnd({ absoluteX: 30, absoluteY: 400 }, true));
    expect(scrolls()).toEqual([true, true]);
    act(() => tileHold('corner.beanbag').onStart({ absoluteX: 20, absoluteY: 700 }));
    expect(scrolls()).toEqual([false, false]);
    act(() => tileHold('corner.beanbag').onEnd({ absoluteX: 20, absoluteY: 700 }, false));
    expect(scrolls()).toEqual([true, true]);
  });

  it('the drawer is never taller than the scroll area it sits in, once measured (T13-FIX)', async () => {
    const s = await openEditor();
    const windowHalf = Math.round(Dimensions.get('window').height * 0.42);
    expect(s.getByTestId('drawer').props.style.height).toBe(windowHalf);
    fireEvent(s.getByTestId('edit-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 180 } } });
    expect(s.getByTestId('drawer').props.style.height).toBe(180);
    fireEvent.press(s.getByTestId('drawer-handle'));
    expect(s.getByTestId('drawer').props.style.height).toBe(180);
  });

  it('a style tile changes the room in one undo step', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ version: 2 }));
    fireEvent.press(s.getByTestId('drawer-tab-room'));
    fireEvent.press(s.getByTestId('drawer-tile-wall.dots'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).styles.wallpaper).toBe('wall.dots');
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).styles.wallpaper).toBe('wall.plain');
  });
});

describe('the editor on small and large phones (ruling T13-LAYOUT)', () => {
  afterEach(() => jest.restoreAllMocks());
  const atHeight = (height: number) =>
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height, scale: 2, fontScale: 1 });

  it('the room is min(320, 42% of the window) tall', () => {
    expect([editRoomHeight(568), editRoomHeight(844), editRoomHeight(1334)]).toEqual([239, 320, 320]);
  });

  it.each([[568, 239], [844, 320]])('at %i points the room is %i tall and pinned; the toolbar and the drawer scroll under it', async (height, room) => {
    atHeight(height);
    const s = await openEditor();
    expect(s.getByTestId('edit-room').props.style.height).toBe(room);
    expect(within(s.getByTestId('edit-scroll')).queryByTestId('edit-room')).toBeNull();
    expect(within(s.getByTestId('edit-scroll')).getByTestId('edit-history')).toBeTruthy();
    expect(within(s.getByTestId('edit-scroll')).getByTestId('drawer')).toBeTruthy();
  });

  it('the notices stay pinned under the room, outside the scroll; Replace desk with the same desk says why (ruling UI-OUTCOMES)', async () => {
    atHeight(568);
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'desk.monitor': 2 }, version: 2 }));
    fireEvent.press(s.getByTestId('drawer-tile-desk.monitor'));
    expect(s.getByTestId('drawer-place')).toHaveTextContent('Replace desk');
    fireEvent.press(s.getByTestId('drawer-place'));
    expect(s.getByTestId('edit-reason')).toHaveTextContent('That desk is in the room already');
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
    expect(within(s.getByTestId('edit-scroll')).queryByTestId('edit-reason')).toBeNull();
  });
});

describe('without dragging (spec §5.7)', () => {
  // The press order is ruling T14's: back left from tile 1, 2 is off the floor, so the plant ends at (0, 1) and Done is live.
  it.each(['ios', 'android'] as const)('place, move, nudge and save with presses only; each nudge says where it went or why not, once (%s)', async (os) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const platform = Platform.OS;
    Platform.OS = os;
    try {
      const s = await openEditor();
      fireEvent.press(s.getByTestId('edit-piece-plant'));
      fireEvent.press(s.getByTestId('edit-move'));
      announce.mockClear();
      fireEvent.press(s.getByTestId('edit-nudge-frontLeft'));
      expect(announce.mock.calls).toEqual([['Moved. Tile 1, 2']]);
      fireEvent.press(s.getByTestId('edit-nudge-backLeft'));
      expect(announce).toHaveBeenLastCalledWith("Can't move there: doesn't fit here");
      // The result is pinned under the room (ruling T14-FIX), outside the scrolling part, and not a live region: the
      // announcement is the one way it is said.
      const status = s.getByTestId('edit-nudge-status');
      expect(status).toHaveTextContent("Can't move there: doesn't fit here");
      expect(within(s.getByTestId('edit-scroll')).queryByTestId('edit-nudge-status')).toBeNull();
      expect(within(s.getByTestId('edit-editing')).getByTestId('edit-nudge-status')).toBeTruthy();
      expect(status.props.accessibilityLiveRegion).toBeUndefined();
      expect(s.queryByTestId('edit-reason')).toBeNull();
      expect(announce).toHaveBeenCalledTimes(2);
      fireEvent.press(s.getByTestId('edit-nudge-backLeft'));
      expect(announce).toHaveBeenCalledTimes(3); // the same refusal again is said again, on Android too
      expect(announce).toHaveBeenLastCalledWith("Can't move there: doesn't fit here");
      fireEvent.press(s.getByTestId('edit-nudge-done'));
      expect(s.getByTestId('edit-flip')).toBeTruthy();
      expect(s.queryByTestId('edit-nudge-status')).toBeNull();
      (putCosmetics as jest.Mock).mockImplementation(async (body) => cosmeticsDTO({ layout: body.layout, version: 3 }));
      await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
      expect((putCosmetics as jest.Mock).mock.calls[0][0].layout.pieces.find((p: { id: string }) => p.id === 'plant')).toMatchObject({ layer: 'floor', x: 0, y: 1 });
      expect(mockNav.goBack).toHaveBeenCalled();
    } finally {
      Platform.OS = platform;
      announce.mockRestore();
    }
  });

  it('Put on… a surface and back to the floor, by presses', async () => {
    const s = await openEditor();
    fireEvent.press(s.getByTestId('edit-piece-plant'));
    fireEvent.press(s.getByTestId('edit-move'));
    fireEvent.press(s.getByTestId('edit-put-desk'));
    expect(s.getByTestId('edit-nudge-status')).toHaveTextContent('Moved. On the desk');
    expect(s.queryByTestId('edit-nudge-frontLeft')).toBeNull();
    fireEvent.press(s.getByTestId('edit-put-floor'));
    // nearestFloor from the desk's spot 1: the free tile (1, 0) beside the desk, said as tile 2, 1.
    expect(s.getByTestId('edit-nudge-status')).toHaveTextContent('Moved. Tile 2, 1');
    const plant = JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((p: { id: string }) => p.id === 'plant');
    expect(plant).toMatchObject({ layer: 'floor', x: 1, y: 0 });
  });
});

describe('the guided first placement (spec §11.1)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('walks the three steps: place the lantern on the lime tile, Turn, then Done; Skip ends it', async () => {
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    expect(s.getByTestId('coach-mark')).toHaveTextContent(/Your first piece.*Takes 10 seconds/);
    expect(s.getByTestId('coach-title').props.accessibilityLabel).toBe('Your first piece. Takes 10 seconds');
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 1 of 3');
    expect(s.queryByTestId('coach-place')).toBeNull();
    act(() => { jest.advanceTimersByTime(10_000); });
    fireEvent.press(s.getByTestId('coach-place')); // without a drag, after 10 seconds
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((p: { item: string }) => p.item === 'lamp.welcome')).toMatchObject({ x: 5, y: 3 });
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 2 of 3');
    fireEvent.press(s.getByTestId('edit-turn'));
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 3 of 3');
    fireEvent.press(s.getByTestId('coach-skip'));
    expect(s.queryByTestId('coach-mark')).toBeNull();
  });

  it('offers Place at once to a screen reader', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValueOnce(true);
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    await act(async () => undefined);
    expect(s.getByTestId('coach-place')).toBeTruthy();
  });

  it('says each new step once, and Undo after placing goes back to step 1 with Place offered again', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValueOnce(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    await act(async () => undefined);
    expect(announce).not.toHaveBeenCalled();
    fireEvent.press(s.getByTestId('coach-place'));
    expect(announce.mock.calls.filter(([t]) => t === 'Step 2 of 3. Now tap Turn. It faces the other way.')).toHaveLength(1);
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    expect(announce.mock.calls.filter(([t]) => t === 'Step 2 of 3. Now tap Turn. It faces the other way.')).toHaveLength(1);
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 1 of 3');
    expect(s.getByTestId('coach-place')).toBeTruthy();
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.some((p: { item: string }) => p.item === 'lamp.welcome')).toBe(false);
  });

  it('is not shown without the coach param', async () => {
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome' });
    expect(s.queryByTestId('coach-mark')).toBeNull();
  });

  it.each([[568, true], [844, false]])('at %i points Place is offered at once: %s (ruling T15-FIX: the drawer is below the fold on a short phone)', async (height, atOnce) => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width: 320, height, scale: 2, fontScale: 1 });
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    expect(!!s.queryByTestId('coach-place')).toBe(atOnce);
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(s.getByTestId('coach-place')).toBeTruthy();
  });

  it('draws the lime tile only on step 1 (ruling T15-FIX)', async () => {
    const overlay = require('../../src/lib/room/edit/overlay');
    const lime = jest.spyOn(overlay, 'coachRects');
    const plain = await openEditor();
    expect(lime).not.toHaveBeenCalled();
    plain.unmount();
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    expect(lime).toHaveBeenCalledWith(expect.anything(), [5, 3]);
    act(() => { jest.advanceTimersByTime(10_000); });
    fireEvent.press(s.getByTestId('coach-place'));
    lime.mockClear();
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    fireEvent.press(s.getByTestId('edit-grid')); // the overlay is drawn again, now on step 2
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 2 of 3');
    expect(lime).not.toHaveBeenCalled();
  });
});
