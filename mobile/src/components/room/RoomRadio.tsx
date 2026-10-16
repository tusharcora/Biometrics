import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { loadRoomSound, useRoomSound } from '../../lib/room/sound';

/** Quiet: the room's loop sits under whatever else is playing. */
export const RADIO_VOLUME = 0.35;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RADIO_LOOP = require('../../../assets/sounds/radio-loop.m4a');

// Before the first report the state can be unknown; only a backgrounded or interrupted app (a call, Control Centre) is
// silent.
const inForeground = (s: string | null | undefined) => s !== 'background' && s !== 'inactive';

/**
 * The radio's lo-fi loop (spec 2026-10-15 §8.2, P3 ruling 15). The room card mounts this only while a running radio is
 * in the room; it plays only with the device switch on, while `active` (the KIP page focused, the room card in view and
 * not under the collapsed header, the editor not over it) and the app in the foreground. It honours the silent switch,
 * mixes with other audio and never plays in the background. Reduce Motion leaves it alone: the switch is the user's
 * own choice, and sound is not motion. Renders nothing.
 */
export function RoomRadio({ active }: { active: boolean }) {
  const on = useRoomSound();
  const player = useAudioPlayer(RADIO_LOOP);
  const [foreground, setForeground] = useState(() => inForeground(AppState.currentState));
  useEffect(() => {
    void loadRoomSound();
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false, allowsRecording: false }).catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => setForeground(inForeground(s)));
    return () => sub.remove();
  }, []);
  const play = active && on && foreground;
  // No pause on unmount (ruling PF3-AUDIO): the hook releases the player then, which stops it, and a released player
  // must not be touched.
  useEffect(() => {
    player.loop = true;
    player.volume = RADIO_VOLUME;
    if (play) player.play();
    else player.pause();
  }, [player, play]);
  return null;
}
