import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchIdentity } from '../../src/api/buddies';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { captureToPng, saveImage, shareImage } from '../../src/lib/recapCapture';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { useRoomSocial } from '../../src/lib/room/giftsStore';
import { ShareRoomScreen } from '../../src/screens/ShareRoomScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/lib/recapCapture', () => ({ captureToPng: jest.fn(async () => 'file:///card.png'), saveImage: jest.fn(async () => 'saved'), shareImage: jest.fn(async () => undefined) }));
jest.mock('../../src/api/buddies', () => ({ ...jest.requireActual('../../src/api/buddies'), fetchIdentity: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
jest.mock('../../src/lib/room/giftsStore', () => ({ useRoomSocial: jest.fn() }));
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ tier: 2 }));
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'maya', displayName: 'Maya Lee', displayNamePrefill: '', moodNoticeSeen: true });
  (useRoomSocial as jest.Mock).mockReturnValue({ gifts: [], cheers: 0, challenge: null });
  await act(async () => { await loadCosmetics(); });
});

it('draws the saved room neutral, KIP waving, no name by default; nothing leaves the phone until a tap (spec §10.5)', async () => {
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  // The export copy is hidden from screen readers (one card is read, not two), so its queries include hidden nodes.
  for (const id of ['share-preview', 'share-export']) {
    const room = screen.getByTestId(id, { includeHiddenElements: true });
    expect(room.props.living).toBeUndefined();
    expect(room.props.live).toBe(''); // T11-FIX: the card stays still
    expect(room.props.room).toMatch(/^wave:idle:none:lines:fallback:/);
  }
  expect(screen.getAllByText("KIP's room").length).toBeGreaterThan(0);
  expect(screen.getAllByText('8 × 8 · 7 pieces').length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText('8 by 8, 7 pieces').length).toBeGreaterThan(0);
  expect(screen.queryByText("Maya's room")).toBeNull();
  expect(screen.getByText('The card shows the room only: no health numbers, no streaks.')).toBeTruthy();
  expect(screen.getByText('Makes an image; nothing is posted')).toBeTruthy();
  expect(screen.getByTestId('share-name').props.value).toBe(false);
  expect(screen.getByTestId('share-waves').props.value).toBe(true);
  expect(captureToPng).not.toHaveBeenCalled();
  expect(saveImage).not.toHaveBeenCalled();
  expect(shareImage).not.toHaveBeenCalled();
});

it('the switches change the card; Save and Share capture the 1080-px card', async () => {
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  fireEvent(screen.getByTestId('share-name'), 'valueChange', true);
  fireEvent(screen.getByTestId('share-waves'), 'valueChange', false);
  expect(screen.getAllByText("Maya's room").length).toBeGreaterThan(0);
  expect(screen.getByTestId('share-export', { includeHiddenElements: true }).props.room).toMatch(/^rest:/);
  expect(screen.getByTestId('share-preview').props.room).toMatch(/^rest:/);
  expect(screen.getAllByText("Maya's room", { includeHiddenElements: true }).length).toBe(2);
  await act(async () => { fireEvent.press(screen.getByTestId('share-save')); });
  expect(saveImage).toHaveBeenCalledWith('file:///card.png');
  expect(screen.getByTestId('share-notice').props.children).toBe('Saved to Photos.');
  await act(async () => { fireEvent.press(screen.getByTestId('share-share')); });
  expect(shareImage).toHaveBeenCalledWith('file:///card.png', 'Share your room');
});

describe('FINAL-M6', () => {
  it('a switch clears the last result line: it no longer describes the card', async () => {
    render(<ShareRoomScreen />);
    await act(async () => undefined);
    await act(async () => { fireEvent.press(screen.getByTestId('share-save')); });
    expect(screen.getByTestId('share-notice').props.children).toBe('Saved to Photos.');
    fireEvent(screen.getByTestId('share-name'), 'valueChange', true);
    expect(screen.getByTestId('share-notice').props.children).toBe('');
    await act(async () => { fireEvent.press(screen.getByTestId('share-save')); });
    fireEvent(screen.getByTestId('share-waves'), 'valueChange', false);
    expect(screen.getByTestId('share-notice').props.children).toBe('');
  });

  it('the export copy is hidden from screen readers, and the card text never grows with Dynamic Type', async () => {
    render(<ShareRoomScreen />);
    await act(async () => undefined);
    const wrap = screen.getByTestId('share-export-wrap', { includeHiddenElements: true });
    expect([wrap.props.accessibilityElementsHidden, wrap.props.importantForAccessibility]).toEqual([true, 'no-hide-descendants']);
    for (const text of ["KIP's room", '8 × 8 · 7 pieces']) {
      for (const node of screen.getAllByText(text, { includeHiddenElements: true })) expect(node.props.maxFontSizeMultiplier).toBe(1);
    }
  });
});

it('says the theme week while a theme is live, never a closed or unknown one (ruling 23)', async () => {
  (useRoomSocial as jest.Mock).mockReturnValue({ gifts: [], cheers: 0, challenge: { live: true, themeId: 'cosyAutumn', entry: false } });
  const s = render(<ShareRoomScreen />);
  await act(async () => undefined);
  expect(s.getAllByText('8 × 8 · 7 pieces · Cosy autumn week', { includeHiddenElements: true }).length).toBe(2);
  expect(s.getAllByLabelText('8 by 8, 7 pieces, Cosy autumn week').length).toBeGreaterThan(0);
  s.unmount();
  for (const challenge of [{ live: false, themeId: 'cosyAutumn', entry: true }, { live: true, themeId: 'newTheme', entry: false }]) {
    (useRoomSocial as jest.Mock).mockReturnValue({ gifts: [], cheers: 0, challenge });
    const t = render(<ShareRoomScreen />);
    await act(async () => undefined);
    expect(t.getAllByText('8 × 8 · 7 pieces', { includeHiddenElements: true }).length).toBe(2);
    t.unmount();
  }
});

it('a refused Photos permission or a failed capture says so and keeps the screen (no crash)', async () => {
  (saveImage as jest.Mock).mockResolvedValueOnce('denied');
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  await act(async () => { fireEvent.press(screen.getByTestId('share-save')); });
  expect(screen.getByTestId('share-notice').props.children).toBe('Photos access is off. Allow it in Settings to save images.');
  (captureToPng as jest.Mock).mockRejectedValueOnce(new Error('capture_failed'));
  await act(async () => { fireEvent.press(screen.getByTestId('share-share')); });
  expect(shareImage).not.toHaveBeenCalled();
  expect(screen.getByTestId('share-notice').props.children).toBe("The image couldn't be made.");
  expect(screen.getByTestId('share-notice').props.accessibilityLiveRegion).toBe('polite');
});

it('Close goes back, and a missing name never shows a byline', async () => {
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'maya', displayName: '', displayNamePrefill: '', moodNoticeSeen: true });
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  fireEvent(screen.getByTestId('share-name'), 'valueChange', true);
  expect(screen.getAllByText(/'s room$/, { includeHiddenElements: true }).map((n) => n.props.children)).toEqual(["KIP's room", "KIP's room"]);
  fireEvent.press(screen.getByTestId('share-close'));
  expect(mockGoBack).toHaveBeenCalled();
});
