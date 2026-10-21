// The share card (spec 2026-10-15 §10.5; P4 ruling 23): 1080 px wide whatever the screen (the recap card's way), the
// size and pieces (never a level), the theme's week while one is live, and your first name only when you ask.
import { ROOM_COPY } from './roomCopy';

export const SHARE_PIXELS = 1080;
const ASPECT = 1.25;

export function shareSize(pixelRatio: number): { width: number; height: number } {
  const width = SHARE_PIXELS / pixelRatio;
  return { width, height: width * ASPECT };
}

export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = (displayName ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}

export function shareLines(i: { size: { n: number; m: number }; pieces: number; themeTitle: string | null; name: string | null; showName: boolean }): { title: string; meta: string; metaSpoken: string; byline: string | null } {
  const S = ROOM_COPY.share;
  const first = i.showName ? firstNameOf(i.name) : null;
  return {
    title: S.title,
    meta: S.meta(i.size, i.pieces, i.themeTitle),
    metaSpoken: S.metaSpoken(i.size, i.pieces, i.themeTitle),
    byline: first ? S.byline(first) : null,
  };
}
