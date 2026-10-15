// The window's sky (spec 2026-10-14 KIP Coach §6), ported from lib2.js `sky2`: smooth sun, puffy clouds, rain on
// the glass, the moon; dithered gradients. The states are Home F's (lib/home/scene.ts SceneKey), with night as its
// own flag so the room can veil itself and light the lamp.
import type { SceneKey } from '../home/scene';
import { ROOM_H, ROOM_W, type Box } from './grid';
import { E, clipB, glow, gradV, poly, px, R, type Rects } from './paint';

export type RoomWeather = 'clear' | 'mostly' | 'cloudy' | 'stormy' | 'short' | 'fallback';

/** Home's scene key → the window: `night` is the moon and the veil; `short` is haze and a small sun. */
export function roomWeatherOf(key: SceneKey): { weather: RoomWeather; night: boolean } {
  return key === 'night' ? { weather: 'fallback', night: true } : { weather: key, night: false };
}

type SkyKey = RoomWeather | 'night';
const SKY: Record<SkyKey, readonly string[]> = {
  clear: ['#3B82F6', '#5596F8', '#71AAFA', '#93C1FC'],
  mostly: ['#3F86F6', '#5998F8', '#76ADFA', '#9CC6FC'],
  short: ['#6C93D8', '#86A6DE', '#A4BCE3', '#C7D3E6'],
  fallback: ['#3F86F6', '#5998F8', '#76ADFA', '#9CC6FC'],
  cloudy: ['#66758D', '#76849B', '#8794AA', '#9EA9BC'],
  stormy: ['#192131', '#202A3A', '#283244', '#323D52'],
  night: ['#060A17', '#0A1122', '#0F1830', '#1A1A45'],
};

/** The sun's disc colour; tests use it to find the sun. */
export const SUN = '#FCD34D';
/** Rain streak colour on the glass. */
export const RAIN = '#8FB4E8';
/** The night veil over the whole room (light layer): its colour and alpha, for items that dim their own loop frames. */
export const NIGHT_VEIL_RGB = '#060818';
export const NIGHT_VEIL_ALPHA = 0.56;
export const NIGHT_VEIL = `rgba(6,8,24,${NIGHT_VEIL_ALPHA})`;

function puff(t: Rects, cx: number, cy: number, s: number, base: string, hl: string, sh: string): void {
  E(t, cx, cy + s * 0.35, s * 1.7, s * 0.5, sh);
  E(t, cx - s * 0.7, cy + s * 0.05, s * 0.75, s * 0.6, base);
  E(t, cx + s * 0.6, cy, s * 0.85, s * 0.68, base);
  E(t, cx - s * 0.05, cy - s * 0.35, s * 0.7, s * 0.66, base);
  E(t, cx - s * 0.2, cy - s * 0.7, s * 0.4, s * 0.22, hl);
}

/** The sky inside box b, clipped to it. */
export function windowSky(r: Rects, b: Box, weather: RoomWeather, night: boolean): void {
  const t: Rects = [];
  const { x, y, w, h } = b;
  const key: SkyKey = night ? 'night' : weather;
  const s = Math.max(4, Math.round(h * 0.14));
  gradV(t, x, y, w, h, SKY[key]);
  const sx = x + w * 0.72, sy = y + h * 0.27;
  if (key === 'clear' || key === 'mostly') {
    glow(t, sx, sy, s * 2.8, s * 2.8, '253,230,138', 0.1);
    E(t, sx, sy, s, s, SUN);
    E(t, sx - s * 0.25, sy - s * 0.25, s * 0.62, s * 0.62, '#FDE68A');
  }
  if (key === 'mostly') puff(t, x + w * 0.3, y + h * 0.62, s * 1.1, '#F3F5F9', '#FFFFFF', '#D6DCE6');
  if (key === 'short') {
    // A short night: a small sun low in a hazy sky.
    E(t, sx, y + h * 0.4, s * 0.6, s * 0.6, SUN);
    for (let yy = Math.round(y + h * 0.55); yy < y + h; yy += 3) R(t, x, yy, w, 1, 'rgba(255,244,214,0.28)');
  }
  if (key === 'fallback') puff(t, x + w * 0.4, y + h * 0.55, s, '#F3F5F9', '#FFFFFF', '#D6DCE6');
  if (key === 'cloudy') {
    E(t, sx, sy, s * 0.8, s * 0.8, '#E9D9A6');
    puff(t, x + w * 0.28, y + h * 0.36, s * 1.2, '#DCE1E8', '#EEF1F5', '#B9C1CD');
    puff(t, x + w * 0.74, y + h * 0.56, s * 1.3, '#C7CFDA', '#DCE1E8', '#A9B3C2');
    puff(t, x + w * 0.2, y + h * 0.84, s, '#BAC3D0', '#CDD4DE', '#A0AABA');
  }
  if (key === 'stormy') {
    puff(t, x + w * 0.3, y + h * 0.22, s * 1.5, '#2A3446', '#3A465C', '#1A2130');
    puff(t, x + w * 0.76, y + h * 0.3, s * 1.4, '#252F40', '#354157', '#161C29');
    for (let i = 0; i < w; i += 3) {
      const yy = Math.round(y + h * 0.45 + ((i * 7) % 11));
      px(t, x + i, yy, RAIN);
      px(t, x + i + 1, yy + 1, RAIN);
    }
    poly(t, [[x + w * 0.56, y + h * 0.38], [x + w * 0.6, y + h * 0.38], [x + w * 0.55, y + h * 0.56], [x + w * 0.58, y + h * 0.56],
      [x + w * 0.5, y + h * 0.78], [x + w * 0.52, y + h * 0.58], [x + w * 0.49, y + h * 0.58]], '#FDE047');
  }
  if (key === 'night') {
    glow(t, sx, sy, s * 2.4, s * 2.4, '226,232,240', 0.06);
    E(t, sx, sy, s, s, '#EEF2F7');
    E(t, sx + s * 0.35, sy - s * 0.2, s * 0.8, s * 0.8, SKY.night[1]!);
    for (const [qx, qy] of [[0.12, 0.2], [0.3, 0.12], [0.22, 0.55], [0.45, 0.35], [0.86, 0.7], [0.6, 0.62], [0.08, 0.8], [0.4, 0.82]] as const) {
      px(t, Math.round(x + w * qx), Math.round(y + h * qy), '#F8FAFC');
    }
  }
  for (const q of clipB(t, [x, y, w, h])) r.push(q);
}

export const DAYLIGHT: Record<RoomWeather, number> = { clear: 0.11, mostly: 0.09, short: 0.07, fallback: 0.07, cloudy: 0.05, stormy: 0.03 };

/** Daylight falling from the window onto the floor (by weather), from window x0..x1 whose sill is at ybot. */
export function daylight(r: Rects, weather: RoomWeather, x0: number, x1: number, ybot: number): void {
  const a = DAYLIGHT[weather];
  poly(r, [[x0 + 2, ybot], [x1 + 2, ybot], [x1 + 30, ROOM_H], [x0 + 12, ROOM_H]], `rgba(255,241,210,${a})`);
  poly(r, [[x0 + 6, ybot + 6], [x1 - 2, ybot + 6], [x1 + 20, ROOM_H], [x0 + 16, ROOM_H]], `rgba(255,241,210,${(a * 0.6).toFixed(3)})`);
}

export function nightVeil(r: Rects): void {
  R(r, 0, 0, ROOM_W, ROOM_H, NIGHT_VEIL);
}
