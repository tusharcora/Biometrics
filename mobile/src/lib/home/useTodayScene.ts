import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchScoresWithBands, type DailyScoreDTO, type ScoreBandsDTO, type ScoresResult } from '../../api/scores';
import { fetchSleep, type SleepNight } from '../../api/sleep';
import type { Read } from '../../components/home/TodayTiles';
import { useSync } from '../../sync/SyncProvider';
import { todayCivil } from '../heatmap';
import type { WeatherKey } from '../recoveryCopy';
import { roomWeatherOf, type RoomWeather } from '../room/weather';
import { scoreBand, type ScoreBand } from '../scoreInsights';
import { nextSceneBoundary, sceneState, todayScore, todayWeather, type SceneState } from './scene';

export interface FocusNavigation {
  isFocused?: () => boolean;
  addListener?: (event: 'focus' | 'blur', callback: () => void) => (() => void) | undefined;
}

export interface TodayScene {
  now: Date;
  today: string;
  focused: boolean;
  scores: Read<ScoresResult>;
  night: Read<SleepNight | null>;
  bands: ScoreBandsDTO | undefined;
  recoveryScore: DailyScoreDTO | null;
  sleepScore: DailyScoreDTO | null;
  lastNight: SleepNight | null;
  weather: WeatherKey;
  scene: SceneState;
  recovery: { score: number | null; band: ScoreBand | null };
  window: { weather: RoomWeather; night: boolean };
}

// Today's scene for Home F and the KIP page's window (spec 2026-10-14 KIP Coach §6): the same reads Home always made
// (fetchScoresWithBands(7), fetchSleep(today, today)), so the window agrees with Home and the Recovery tile. It
// recomputes on focus, on return to the foreground and at the next scene boundary (05:00, 12:00, 18:00, 20:00).
// A failed read gives the fallback state; it never blocks the page.
export function useTodayScene(navigation: FocusNavigation): TodayScene {
  const { dataVersion } = useSync();
  const [now, setNow] = useState(() => new Date());
  const [focused, setFocused] = useState<boolean>(() => navigation.isFocused?.() ?? true);
  const [scores, setScores] = useState<Read<ScoresResult>>({ status: 'loading' });
  const [night, setNight] = useState<Read<SleepNight | null>>({ status: 'loading' });
  const today = todayCivil(now);
  const navRef = useRef(navigation);
  navRef.current = navigation;

  useEffect(() => {
    // Independent of the metric cards: a scores failure must not take the rest
    // of the dashboard down with it.
    let cancelled = false;
    fetchScoresWithBands(7)
      .then((value) => { if (!cancelled) setScores({ status: 'ready', value }); })
      .catch(() => { if (!cancelled) setScores({ status: 'failed' }); });
    return () => { cancelled = true; };
  }, [dataVersion, today]);

  useEffect(() => {
    // Last night is dated by the morning you woke up: today. A failed read means "not short".
    let cancelled = false;
    fetchSleep(today, today)
      .then((res) => { if (!cancelled) setNight({ status: 'ready', value: res.nights.find((n) => n.date === today) ?? null }); })
      .catch(() => { if (!cancelled) setNight({ status: 'failed' }); });
    return () => { cancelled = true; };
  }, [dataVersion, today]);

  // The state and the greeting follow the clock: again on focus, on return to the foreground, and at the next boundary.
  useEffect(() => {
    const nav = navRef.current;
    const offFocus = nav.addListener?.('focus', () => {
      setFocused(true);
      setNow(new Date());
    });
    const offBlur = nav.addListener?.('blur', () => setFocused(false));
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      offFocus?.();
      offBlur?.();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (!focused) return;
    const id = setTimeout(() => setNow(new Date()), nextSceneBoundary(now).getTime() - now.getTime());
    return () => clearTimeout(id);
  }, [focused, now]);

  const allScores = scores.status === 'ready' ? scores.value.scores : null;
  // Undefined until loaded (and on an older server): scoreBand uses its defaults.
  const bands = scores.status === 'ready' ? scores.value.bands : undefined;
  const recoveryScore = todayScore(allScores, 'RECOVERY', today);
  const sleepScore = todayScore(allScores, 'SLEEP', today);
  // While a new day's read is in flight, the old day's night must not stand in for it.
  const todaysNight: Read<SleepNight | null> = night.status === 'ready' && night.value && night.value.date !== today ? { status: 'loading' } : night;
  const lastNight = todaysNight.status === 'ready' ? todaysNight.value : null;
  const weather = todayWeather(recoveryScore, bands);
  const scene = sceneState({ now, recovery: weather, night: lastNight });
  const score = recoveryScore && recoveryScore.score !== null ? Math.round(recoveryScore.score) : null;
  return {
    now, today, focused, scores, night: todaysNight, bands, recoveryScore, sleepScore, lastNight, weather, scene,
    recovery: { score, band: score === null ? null : scoreBand(score, bands) },
    window: roomWeatherOf(scene.key),
  };
}
