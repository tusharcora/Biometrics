import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Audio from 'expo-audio';
import { RADIO_VOLUME, RoomRadio } from '../../src/components/room/RoomRadio';
import { resetRoomSound, setRoomSound } from '../../src/lib/room/sound';

jest.mock('expo-secure-store');
const player = (Audio as unknown as { __player: { play: jest.Mock; pause: jest.Mock; loop: boolean; volume: number } }).__player;
let appState: (s: AppStateStatus) => void = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
  resetRoomSound();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => { appState = cb as (s: AppStateStatus) => void; return { remove: jest.fn() } as never; });
});

it('stays silent with the switch off, the default (Review Focus 3)', async () => {
  render(<RoomRadio active />);
  await act(async () => undefined);
  expect(player.play).not.toHaveBeenCalled();
  expect([player.loop, player.volume]).toEqual([true, RADIO_VOLUME]);
});

it('honours the silent switch, mixes with other audio and never plays in the background (ruling 15)', async () => {
  render(<RoomRadio active />);
  await act(async () => undefined);
  expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false, allowsRecording: false });
});

it('plays the loop with the switch on, and pauses when the room is covered, blurred or backgrounded', async () => {
  const s = render(<RoomRadio active />);
  await act(async () => undefined);
  await act(async () => { await setRoomSound(true); });
  expect(player.play).toHaveBeenCalledTimes(1);
  s.rerender(<RoomRadio active={false} />);
  expect(player.pause).toHaveBeenCalled();
  s.rerender(<RoomRadio active />);
  expect(player.play).toHaveBeenCalledTimes(2);
  act(() => appState('background'));
  expect(player.pause.mock.calls.length).toBeGreaterThanOrEqual(2);
  act(() => appState('active'));
  expect(player.play).toHaveBeenCalledTimes(3);
  await act(async () => { await setRoomSound(false); });
  expect(player.play).toHaveBeenCalledTimes(3);
  s.unmount();
});

it('never touches the player after unmount: the hook releases it, which stops it (ruling PF3-AUDIO)', async () => {
  const s = render(<RoomRadio active />);
  await act(async () => undefined);
  await act(async () => { await setRoomSound(true); });
  const calls = [player.play.mock.calls.length, player.pause.mock.calls.length];
  s.unmount();
  await act(async () => { await setRoomSound(false); });
  act(() => appState('background'));
  expect([player.play.mock.calls.length, player.pause.mock.calls.length]).toEqual(calls);
});

it('a stored switch read that lands late does not turn the sound back off (ruling PF3-AUDIO)', async () => {
  let land: (v: string | null) => void = () => undefined;
  (SecureStore.getItemAsync as jest.Mock).mockReturnValueOnce(new Promise((r) => { land = r; }));
  render(<RoomRadio active />);
  await act(async () => { await setRoomSound(true); });
  expect(player.play).toHaveBeenCalledTimes(1);
  const paused = player.pause.mock.calls.length;
  await act(async () => { land(null); });
  expect(player.pause).toHaveBeenCalledTimes(paused);
  expect(player.play).toHaveBeenCalledTimes(1);
});
