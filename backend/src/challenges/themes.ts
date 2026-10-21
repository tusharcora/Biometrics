// The weekly theme challenge's calendar (spec 2026-10-15 §10.4, C3), server-side: four themes, one a week by the
// user's local ISO week, rotating from 2026-W44 (P4 ruling 4). Each has a rule over the challenge tags (§2.1), the
// week's theme piece (80 coins, in the shop only in its weeks) and the trophy (the most-cheered room in your circle).
// The words (titles, briefs) are the app's (ROOM_COPY.challenge.themes); the server sends the theme's id.
// OWNER NOTE (PF4-OWNER): the three themes after Cosy autumn (their briefs and thresholds, their pieces' and trophies'
// names) and the weekly rotation after the first four weeks are placeholders for the owner to confirm.
import type { ChallengeTag } from '../cosmetics/catalogue';
import { shippedItem, tagsOf } from '../cosmetics/catalogue';
import { weekNumber } from '../coins/shopWeeks';
import type { RoomLayout } from '../room/geometry';

export type ThemeId = 'cosyAutumn' | 'greenThumb' | 'nightOwl' | 'tidyDesk';
export interface Theme { id: ThemeId; rule: { tag: ChallengeTag; atLeast: number }; themePiece: string; trophy: string }

export const THEMES: readonly Theme[] = [
  { id: 'cosyAutumn', rule: { tag: 'warm', atLeast: 3 }, themePiece: 'lamp.harvest', trophy: 'corner.acorn' },
  { id: 'greenThumb', rule: { tag: 'plant', atLeast: 4 }, themePiece: 'plant.ivy', trophy: 'corner.can' },
  { id: 'nightOwl', rule: { tag: 'glow', atLeast: 3 }, themePiece: 'lamp.moon', trophy: 'corner.owl' },
  { id: 'tidyDesk', rule: { tag: 'desk', atLeast: 3 }, themePiece: 'item.organiser', trophy: 'item.goldpen' },
];
/** OWNER NOTE (P4 ruling 4): the first challenge week; set with release 6's date at merge. */
export const CHALLENGES_START_WEEK = '2026-W44';

/** The theme of an ISO week, or null before the first challenge week or for a malformed week. */
export function themeFor(weekId: string): Theme | null {
  const n = weekNumber(weekId);
  const start = weekNumber(CHALLENGES_START_WEEK)!;
  if (n === null || n < start) return null;
  return THEMES[(n - start) % THEMES.length]!;
}

/** How many placements in the layout carry the tag (once per placement). */
export function briefCount(layout: RoomLayout, tag: ChallengeTag): number {
  return layout.pieces.filter((p) => {
    const item = shippedItem(p.item);
    return !!item && tagsOf(item).includes(tag);
  }).length;
}

export const meetsBrief = (layout: RoomLayout, theme: Theme): boolean => briefCount(layout, theme.rule.tag) >= theme.rule.atLeast;
