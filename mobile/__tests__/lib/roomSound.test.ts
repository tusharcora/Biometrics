import * as fs from 'fs';
import * as path from 'path';
import * as SecureStore from 'expo-secure-store';
import { ROOM_SOUND_KEY, getRoomSound, loadRoomSound, resetRoomSound, setRoomSound } from '../../src/lib/room/sound';

jest.mock('expo-secure-store');
const store = SecureStore as jest.Mocked<typeof SecureStore>;
afterEach(() => { resetRoomSound(); jest.clearAllMocks(); });

it('is off until you turn it on, and remembers the switch on this device only (spec §8.2)', async () => {
  store.getItemAsync.mockResolvedValueOnce(null);
  expect(await loadRoomSound()).toBe(false);
  await setRoomSound(true);
  expect(store.setItemAsync).toHaveBeenCalledWith(ROOM_SOUND_KEY, '1');
  expect(getRoomSound()).toBe(true);
  // Your choice this session is the truth: no re-read replaces it.
  expect(await loadRoomSound()).toBe(true);
  expect(store.getItemAsync).toHaveBeenCalledTimes(1);
  // A fresh session reads it back.
  resetRoomSound();
  store.getItemAsync.mockResolvedValueOnce('1');
  expect(await loadRoomSound()).toBe(true);
});

it('a keychain failure reads as off, and a failed write keeps the choice for the session', async () => {
  store.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await loadRoomSound()).toBe(false);
  store.setItemAsync.mockRejectedValueOnce(new Error('locked'));
  await setRoomSound(true);
  expect(getRoomSound()).toBe(true);
  // The radio mounting again (another visit to the page) does not lose it to a failing keychain.
  store.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await loadRoomSound()).toBe(true);
  store.getItemAsync.mockReset();
});

it('a stored read that lands after a toggle never overrides it (ruling PF3-AUDIO)', async () => {
  let land: (v: string | null) => void = () => undefined;
  store.getItemAsync.mockReturnValueOnce(new Promise((r) => { land = r; }));
  const read = loadRoomSound();
  await setRoomSound(true);
  land(null);
  expect(await read).toBe(true);
  expect(getRoomSound()).toBe(true);
  // A read that failed late does not either.
  resetRoomSound();
  let fail: (e: Error) => void = () => undefined;
  store.getItemAsync.mockReturnValueOnce(new Promise((_r, j) => { fail = j; }));
  const failed = loadRoomSound();
  await setRoomSound(true);
  fail(new Error('locked'));
  expect(await failed).toBe(true);
  // And a reset since wins over a read begun before it.
  resetRoomSound();
  store.getItemAsync.mockReturnValueOnce(new Promise((r) => { land = r; }));
  const stale = loadRoomSound();
  resetRoomSound();
  land('1');
  expect(await stale).toBe(false);
});

it('bundles one loop of about 20 seconds under 300 KB (spec §0)', () => {
  const bytes = fs.statSync(path.join(__dirname, '../../assets/sounds/radio-loop.m4a')).size;
  expect(bytes).toBeGreaterThan(40 * 1024); // 20 s at 64 kb/s is about 160 KB
  expect(bytes).toBeLessThan(300 * 1024);
});

it('the audio module asks for no microphone and never plays in the background (ruling PF3-AUDIO)', () => {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'));
  const entry = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-audio');
  expect(entry?.[1]).toEqual({ microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false });
  expect(JSON.stringify(app.expo.ios.infoPlist ?? {})).not.toMatch(/Microphone/);
  expect(JSON.stringify(app.expo.android ?? {})).not.toMatch(/RECORD_AUDIO/);
});
