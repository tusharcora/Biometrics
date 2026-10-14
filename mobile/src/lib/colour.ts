// Colour helpers shared by the app (moved from components/characters/palette.ts and sprites/compose.ts, spec
// 2026-10-14 KIP Coach §1), plus the KIP label colour rule (§3.4).
import { KIP_COLOURS, type KipColour } from './kip/kipArt';

export function darkenHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0')).join('');
}

export function mixHex(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  return '#' + [16, 8, 0].map((s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k).toString(16).padStart(2, '0')).join('');
}

/** '#RRGGBB' at an alpha, as '#RRGGBBAA'. */
export function hexAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

// The card surfaces (global.css --color-card, light and dark).
export const CARD = { light: '#FFFFFF', dark: '#14161B' } as const;
/** The art panel's top wash and the focus chip's own wash, both of the accent. */
export const PANEL_ALPHA = 0.1;
export const CHIP_ALPHA = 0.16;
const MIN_CONTRAST = 4.6;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => {
    const c = ((n >> s) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two '#RRGGBB' colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The focus chip's real fill: its 16 % wash over the panel's 10 % wash over the card. */
export function chipBackground(accent: string, scheme: 'light' | 'dark'): string {
  return mixHex(mixHex(CARD[scheme], accent, PANEL_ALPHA), accent, CHIP_ALPHA);
}

/**
 * Focus-chip text colour, reading at 4.6:1 (4.5 plus rounding headroom) on the
 * chip's composited fill. Light mode darkens the accent (pale ones such as
 * Luna's vanish on white); dark mode lightens it toward white (Cap, Pengu and
 * Jelly sit under 4.5 on the dark card). The thinking styles reuse it for
 * their coach-coloured text.
 */
export function chipTextColor(accent: string, scheme: 'light' | 'dark' | null | undefined): string {
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const chip = chipBackground(accent, mode);
  for (let i = 0; i <= 20; i++) {
    const k = i * 0.05;
    const text = k === 0 ? accent : mode === 'dark' ? mixHex(accent, '#FFFFFF', k) : darkenHex(accent, 1 - k);
    if (contrast(text, chip) >= MIN_CONTRAST) return text;
  }
  return mode === 'dark' ? '#FFFFFF' : '#000000';
}

const LABEL_CONTRAST = 4.5;

/**
 * KIP's colour for a "KIP" label on a card (spec §3.4), or null to use `foreground`: the colour only where it reads
 * at 4.5:1 on the dark card (all but ink and slate); light mode always uses foreground.
 */
export function kipLabelColour(colour: KipColour, scheme: 'light' | 'dark' | null | undefined): string | null {
  if (scheme !== 'dark') return null;
  const hex = KIP_COLOURS[colour];
  return contrast(hex, CARD.dark) >= LABEL_CONTRAST ? hex : null;
}
