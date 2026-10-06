import React from 'react';
import { Modal, PixelRatio } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HIDDEN_OK, withCharacter } from '../../jest-mocks/characterContext';
import { CelebrationModal } from '../../src/components/achievements/CelebrationModal';
import { captureToPng, shareImage } from '../../src/lib/recapCapture';

jest.mock('../../src/lib/recapCapture', () => ({ captureToPng: jest.fn(), saveImage: jest.fn(), shareImage: jest.fn() }));
let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => mockReduceMotion };
});

const GOLD = { family: 'SLEEP_GOAL' as const, level: 3, value: 14, earnedOn: '2026-10-14', ids: ['s3'] };
const THRESHOLDS = [3, 7, 14, 30, 100];

beforeEach(() => {
  jest.clearAllMocks();
  mockReduceMotion = false;
});
afterEach(() => jest.restoreAllMocks());

it('shows the new level with the coach, its value, the coach line and confetti', () => {
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={jest.fn()} />));
  expect(screen.getByTestId('celebration-title')).toHaveTextContent('SLEEP GOAL STREAK III');
  expect(screen.getByTestId('celebration-value')).toHaveTextContent('14 nights in a row at your sleep goal.');
  expect(screen.getByTestId('celebration-coach-line')).toHaveTextContent('16 more nights for Diamond');
  expect(screen.getByTestId('celebration-badge').props.accessibilityLabel).toBe('Sleep goal streak, level III, Gold');
  expect(screen.getByTestId('celebration-coach', HIDDEN_OK)).toBeTruthy();
  expect(screen.getByTestId('celebration-confetti', HIDDEN_OK)).toBeTruthy();
});

it('says "Top level!" at level V', () => {
  render(withCharacter(<CelebrationModal celebration={{ ...GOLD, level: 5, value: 100 }} thresholds={THRESHOLDS} onDone={jest.fn()} />));
  expect(screen.getByTestId('celebration-coach-line')).toHaveTextContent('Top level!');
});

it('draws no confetti under Reduce Motion', () => {
  mockReduceMotion = true;
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={jest.fn()} />));
  expect(screen.queryByTestId('celebration-confetti', HIDDEN_OK)).toBeNull();
});

it('closes with "Nice!"', () => {
  const onDone = jest.fn();
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={onDone} />));
  fireEvent.press(screen.getByTestId('celebration-done'));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('closes once, however fast "Nice!" is pressed twice', () => {
  const onDone = jest.fn();
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={onDone} />));
  fireEvent.press(screen.getByTestId('celebration-done'));
  fireEvent.press(screen.getByTestId('celebration-done'));
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('celebration-done')).toBeDisabled();
});

it('closes once when the system back gesture follows "Nice!" (Android back)', () => {
  const onDone = jest.fn();
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={onDone} />));
  fireEvent.press(screen.getByTestId('celebration-done'));
  screen.UNSAFE_getByType(Modal).props.onRequestClose();
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('closes once when the system back gesture comes first', () => {
  const onDone = jest.fn();
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={onDone} />));
  screen.UNSAFE_getByType(Modal).props.onRequestClose();
  screen.UNSAFE_getByType(Modal).props.onRequestClose();
  fireEvent.press(screen.getByTestId('celebration-done'));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('says so when the share image could not be made', async () => {
  (captureToPng as jest.Mock).mockRejectedValue(new Error('capture'));
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={jest.fn()} />));
  expect(screen.queryByTestId('celebration-notice')).toBeNull();
  fireEvent.press(screen.getByTestId('celebration-share'));
  expect(await screen.findByTestId('celebration-notice')).toHaveTextContent("The image couldn't be made. Please try again.");
  expect(shareImage).not.toHaveBeenCalled();
});

it('shares a 1080 px badge card through the recap export pipeline', async () => {
  jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  (captureToPng as jest.Mock).mockResolvedValue('file:///cache/recap-1.png');
  (shareImage as jest.Mock).mockResolvedValue(undefined);
  render(withCharacter(<CelebrationModal celebration={GOLD} thresholds={THRESHOLDS} onDone={jest.fn()} />));
  expect(screen.getByTestId('celebration-export', HIDDEN_OK)).toHaveStyle({ width: 360, height: 360 });
  expect(screen.getByTestId('badge-share-card', HIDDEN_OK)).toHaveTextContent(/SLEEP GOAL STREAK III/);
  expect(screen.getByTestId('badge-share-app', HIDDEN_OK)).toHaveTextContent('Biometrics');
  fireEvent.press(screen.getByTestId('celebration-share'));
  await waitFor(() => expect(shareImage).toHaveBeenCalledWith('file:///cache/recap-1.png'));
});
