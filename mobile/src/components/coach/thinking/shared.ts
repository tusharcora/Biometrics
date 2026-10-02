import { useRef } from 'react';
import { Platform } from 'react-native';
import { isLoaded } from 'expo-font';
import { useColorScheme } from 'nativewind';
import { chipTextColor } from '../../characters/CoachCard';
import { CHARACTERS } from '../../characters/registry';
import type { CharacterId } from '../../characters/types';
import { useSpriteClock } from '../../characters/useSpriteClock';

// The pixel face used by the tag (C) and dialog (I) styles (spec §5). App.tsx
// loads it without blocking start-up; until it is in, the system mono stands in.
export const SILKSCREEN = 'Silkscreen';
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function pixelFont(): string {
  try {
    return isLoaded(SILKSCREEN) ? SILKSCREEN : MONO;
  } catch {
    return MONO;
  }
}

/** '#RRGGBB' at an alpha, as '#RRGGBBAA'. */
export function hexAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

/**
 * The coach's name and colours for a thinking style. `accent` is for fills;
 * `text` is the accent darkened until it reads in light mode (pale accents
 * such as Luna's vanish on white), the accent itself in dark mode.
 */
export function useCoachVoice(id: CharacterId) {
  const { colorScheme } = useColorScheme();
  const info = CHARACTERS[id];
  return { name: info.name, accent: info.accent, text: chipTextColor(info.accent, colorScheme) };
}

/**
 * Milliseconds since this style appeared, re-rendering on the shared sprite
 * tick. Paused (screen out of focus, Reduce Motion) → 0: the first frame.
 */
export function useElapsed(paused: boolean): number {
  const t = useSpriteClock(paused);
  const mountedAt = useRef(Date.now());
  return paused || t === 0 ? 0 : Math.max(0, Date.now() - mountedAt.current);
}

/** 0–3 dots, one more every 400 ms. */
export const dotCount = (elapsed: number) => Math.floor(elapsed / 400) % 4;

/** A label as speech: no trailing ellipsis. */
export const spoken = (label: string) => label.replace(/(…|\.\.\.)$/, '').trim();
