// KIP's states on the KIP page (spec 2026-10-14 KIP Coach §3.3, §3.4) as pure functions: the room's pose, mood,
// bubble and monitor; the status line; and the spoken labels. CoachScreen derives the input; the room, the header
// and the collapsed header read the result.
import type { KipMood, KipPose } from './kip/kipArt';
import { verdictWord } from './kipCopy';
import type { MonitorScreen } from './room/items';
import type { RoomWeather } from './room/weather';
import type { ScoreBand } from './scoreInsights';

export type KipStageId = 'loading' | 'empty' | 'idle' | 'thinking' | 'answering' | 'error' | 'offline' | 'unavailable' | 'consent';

export interface KipStage {
  id: KipStageId;
  pose: KipPose;
  mood: KipMood;
  bubble: string | null;
  screen: MonitorScreen;
}

export interface KipStageInput {
  phase: 'loading' | 'unavailable' | 'needs-consent' | 'ready';
  statusUnverified: boolean;
  offline: boolean;
  /** Waiting for the first sentence. */
  waiting: boolean;
  /** A turn is running (waiting or sentences arriving). */
  streaming: boolean;
  /** The error card is showing. */
  error: boolean;
  /** No messages yet. */
  empty: boolean;
  /** The day's pose and mood: Home F's sceneState mapping (useTodayScene). */
  idle: { pose: KipPose; mood: KipMood };
}

const at = (id: KipStageId, pose: KipPose, mood: KipMood, bubble: string | null = null, screen: MonitorScreen = 'lines'): KipStage =>
  ({ id, pose, mood, bubble, screen });

export function kipStage(i: KipStageInput): KipStage {
  if (i.phase === 'loading') return at('loading', 'rest', 'idle');
  if (i.phase === 'unavailable') return at('unavailable', 'rest', 'sleepy');
  if (i.phase === 'needs-consent') return at('consent', 'wave', 'curious', 'MAY I?');
  if (i.waiting) return at('thinking', 'type', 'glance', 'ON IT…', 'dots');
  if (i.streaming) return at('answering', 'point', 'glance', "HERE'S MY TAKE", 'chart');
  if (i.offline) return at('offline', 'rest', 'sleepy', 'Z Z');
  if (i.error) return at('error', 'shrug', 'startled', 'OOPS');
  if (i.statusUnverified) return at('unavailable', 'rest', 'sleepy');
  if (i.empty) return at('empty', 'wave', 'idle', 'HI!');
  return at('idle', i.idle.pose, i.idle.mood);
}

const POCKET = 'In the pocket room';
const DOT = ' · ';

export function kipStatusLine(stage: KipStageId, recovery: { score: number | null; band: ScoreBand | null }, collapsed: boolean): string {
  if (stage === 'thinking') return 'Typing it up…';
  if (stage === 'offline') return 'Offline';
  if (stage === 'answering') return collapsed && recovery.score !== null ? `Answering${DOT}Recovery ${recovery.score}` : 'Answering';
  const verdict = recovery.score === null ? null : verdictWord(recovery.band);
  return !collapsed && verdict && (stage === 'idle' || stage === 'empty') ? `${POCKET}${DOT}${verdict} day` : POCKET;
}

/** A shown line as a screen reader should hear it: a comma, never "middle dot" (spoken-label rule). */
export function spokenLine(line: string): string {
  return line.split(DOT).join(', ');
}

const DOING: Record<KipStageId, string> = {
  loading: 'resting', empty: 'waving', idle: 'resting', thinking: 'typing', answering: 'turned to face you',
  error: 'shrugging', offline: 'asleep', unavailable: 'asleep', consent: 'waving',
};
const SKY_WORD: Record<RoomWeather, string> = {
  clear: 'clear', mostly: 'mostly clear', cloudy: 'cloudy', stormy: 'stormy', short: 'hazy', fallback: 'mostly clear',
};
// The Recovery page's weather for a band (recoveryCopy's BAND_WEATHER), in the window's words.
const BAND_SKY: Record<ScoreBand, string> = {
  scoreExcellent: SKY_WORD.clear, scoreGood: SKY_WORD.mostly, scoreFair: SKY_WORD.cloudy, scorePoor: SKY_WORD.stormy,
};

export function windowWord(w: { weather: RoomWeather; night: boolean }): string {
  return w.night ? 'night' : SKY_WORD[w.weather];
}

/** The room's one label (spec 2026-10-15 §9.1): "KIP in its room, typing. Window: cloudy". */
export function roomLabel(stage: KipStageId, window: { weather: RoomWeather; night: boolean }): string {
  return `KIP in its room, ${DOING[stage]}. Window: ${windowWord(window)}`;
}

/**
 * The hot tag's spoken label (§3.1): the score and its Recovery weather, from the score's band. Not the window's
 * sky, which is "night" after 20:00 and would read "night day".
 */
export function hotTagLabel(recovery: { score: number | null; band: ScoreBand | null }): string {
  if (recovery.score === null) return 'Recovery, no reading yet. Open Recovery';
  return recovery.band ? `Recovery ${recovery.score}, ${BAND_SKY[recovery.band]} day. Open Recovery` : `Recovery ${recovery.score}. Open Recovery`;
}
