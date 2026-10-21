// The weekly challenge, the pure parts (spec 2026-10-15 §10.4; P4 rulings 3, 7): how many of the theme's pieces a room
// holds (the catalogue's tags, once per placement), the brief's checklist, the days left to the entrant's own close
// (the server's closesAt: the app never works out a week or a Sunday itself), and an entry's snapshot as a room to
// draw neutral.
import type { ChallengeTag } from '../../api/rooms';
import { catalogueItem } from './catalogue';
import type { RoomLayout, Tier } from './iso/geometry';
import { readLayout } from './layout';
import { tierOfSize } from './visit';

const DAY_MS = 86_400_000;

export function briefCount(layout: RoomLayout, tag: ChallengeTag): number {
  return layout.pieces.filter((p) => !!catalogueItem(p.item)?.tags?.includes(tag)).length;
}

export function checklist(layout: RoomLayout, theme: { tag: ChallengeTag; atLeast: number }): { count: number; atLeast: number; met: boolean } {
  const count = briefCount(layout, theme.tag);
  return { count, atLeast: theme.atLeast, met: count >= theme.atLeast };
}

/** Whole days left before the close, never below 0 (the last day reads "Last day"); a close it can't read is 0. */
export function daysLeft(closesAt: string, now: Date): number {
  const ms = Date.parse(closesAt) - now.getTime();
  return ms > 0 ? Math.floor(ms / DAY_MS) : 0;
}

/** An entry's snapshot as the app draws it: a broken layout is the starter room, a missing size the first one. */
export function entryRoom(snapshot: { layout: unknown; size: { n: number; m: number } }): { layout: RoomLayout; tier: Tier; size: { n: number; m: number } } {
  const size = { n: Number(snapshot?.size?.n) || 7, m: Number(snapshot?.size?.m) || 7 };
  return { layout: readLayout(snapshot?.layout), tier: tierOfSize(size), size };
}
