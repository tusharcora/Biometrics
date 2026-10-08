// Chat free text (spec 2026-10-07 social §8.1, §8.2, §9). Pure. A message's text: NFC; \r\n, \r, U+2028 and U+2029
// become \n; every other control (Cc) and every format character (Cf) is removed — bidi overrides and zero-widths
// go, and a ZWJ emoji sequence falls apart into its emoji (as for camp notes); three or more newlines in a row become
// two; trimmed; 1-1000 code points with something visible. Variation selectors stay, so an emoji keeps its form.
// A Chats note uses the camp-note sanitiser (no newlines at all), 1-60 code points. A lone surrogate is refused
// before sanitising (Postgres cannot store it).
// The text is user free text: never logged (not even its length), never sent to the coach, never in analytics.

import { hasVisibleCharacter, isWellFormed, sanitiseDisplayName } from '../buddies/identity';

export const MESSAGE_TEXT_MAX = 1000;
export const STATUS_NOTE_MAX = 60;
/** An inbox line, a reply quote and a push preview: one line of at most this many code points. */
export const PREVIEW_MAX = 80;

export function sanitiseMessageText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?|[\u2028\u2029]/g, '\n')
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === '\n' ? c : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text to store, or null when it is not a valid message text. */
export function checkMessageText(raw: unknown): string | null {
  if (typeof raw !== 'string' || !isWellFormed(raw)) return null;
  const text = sanitiseMessageText(raw);
  const length = [...text].length;
  return length >= 1 && length <= MESSAGE_TEXT_MAX && hasVisibleCharacter(text) ? text : null;
}

/** A Chats note to store, or null. */
export function checkStatusNote(raw: unknown): string | null {
  if (typeof raw !== 'string' || !isWellFormed(raw)) return null;
  const text = sanitiseDisplayName(raw);
  const length = [...text].length;
  return length >= 1 && length <= STATUS_NOTE_MAX && hasVisibleCharacter(text) ? text : null;
}

/** One line: whitespace runs (newlines too) become one space; longer than `max` code points is cut and ends in "…". */
export function previewText(text: string, max: number = PREVIEW_MAX): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  const points = [...flat];
  return points.length <= max ? flat : `${points.slice(0, max).join('').trimEnd()}…`;
}
