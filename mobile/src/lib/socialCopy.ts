import type { Person } from '../api/buddies';
import type { CheckInMood, HighlightItem, TimelineItem } from '../api/social';
import { levelTitle } from './badges';
import { STICKER_LABEL } from './buddyCopy';

// Social copy (spec 2026-10-07 social §5, §7). Fixed templates over typed fields: no free text, no health numbers
// (the only counts are the circle's own actions, like stickers sent).

export const CHECKIN_OPTIONS: ReadonlyArray<{ mood: CheckInMood; label: string; color: string }> = [
  { mood: 'RESTED', label: 'Rested', color: '#86EFAC' },
  { mood: 'OKAY', label: 'Okay', color: '#93C5FD' },
  { mood: 'TIRED', label: 'Tired', color: '#FDBA74' },
];
const MOOD_WORD: Record<CheckInMood, string> = { RESTED: 'rested', OKAY: 'okay', TIRED: 'tired' };

/** "You" for me; otherwise the display name, or "@handle" when it is unset (''). */
export const personName = (p: Person, mine: boolean) => (mine ? 'You' : p.displayName || `@${p.handle}`);

/** A timeline line as the bold name and the muted rest; every line starts with its actor. */
export function timelineParts(item: TimelineItem): { name: string; rest: string } {
  const name = personName(item.actor, item.mine);
  switch (item.kind) {
    case 'checkin':
      if (item.locked) return { name, rest: 'checked in' };
      return { name, rest: item.mine ? `checked in: ${MOOD_WORD[item.mood]}` : `woke up ${MOOD_WORD[item.mood]}` };
    case 'step_goal':
      return { name, rest: item.mine ? 'passed your step goal' : 'passed their step goal' };
    case 'badge':
      return { name, rest: `reached ${levelTitle(item.badge.family, item.badge.level)}` };
    case 'sticker':
      return {
        name,
        rest: item.mine ? `sent ${personName(item.to, false)} a ${STICKER_LABEL[item.sticker]}` : `sent you a ${STICKER_LABEL[item.sticker]}`,
      };
    case 'recap_share':
      return { name, rest: `shared ${item.mine ? 'your' : 'their'} ${item.recapKind === 'WEEK' ? 'weekly' : 'monthly'} recap` };
  }
}

export function timelineLine(item: TimelineItem): string {
  const { name, rest } = timelineParts(item);
  return `${name} ${rest}`;
}

/** The sticker a row offers: none on my own rows, on stickers, or on a locked check-in (no mood to react to). */
export function timelineAction(item: TimelineItem): 'cheer' | 'rest_up' | null {
  if (item.mine || item.kind === 'sticker') return null;
  if (item.kind === 'checkin') {
    if (item.locked) return null;
    return item.mood === 'TIRED' ? 'rest_up' : 'cheer';
  }
  return 'cheer';
}

export function highlightKicker(item: HighlightItem): string {
  switch (item.type) {
    case 'top_story': return 'Top story';
    case 'most_cheered_you': return 'Most cheered';
    case 'comeback': return 'Comeback';
    case 'checked_in_every_day': return 'Every day';
    case 'most_stickers_sent': return 'Most generous';
  }
}

/** The kicker's colour (design V5); null = the muted foreground. */
export function highlightKickerColor(item: HighlightItem): string | null {
  switch (item.type) {
    case 'top_story': return '#A5B4FC';
    case 'most_cheered_you': return '#FCD34D';
    case 'comeback': return '#86EFAC';
    default: return null;
  }
}

export function highlightLine(item: HighlightItem): string {
  const who = personName(item.actor, item.mine);
  switch (item.type) {
    case 'top_story':
      return item.reason === 'badge' ? `${who} reached ${levelTitle(item.family, item.level)}` : `${who} checked in every day`;
    case 'most_cheered_you': return `${who} cheered you most`;
    case 'comeback': return `${who} bounced back to rested`;
    case 'checked_in_every_day': return `${who} checked in every day`;
    case 'most_stickers_sent': return `${who} sent ${item.count} stickers`;
  }
}

/** ISO-8601 week number of the week starting on `monday` (YYYY-MM-DD): the week its Thursday falls in. */
export function isoWeekNumber(monday: string): number {
  const thursday = new Date(`${monday}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / 86_400_000 / 7) + 1;
}

/** "Week 40 highlights". */
export const highlightsTitle = (weekStart: string) => `Week ${isoWeekNumber(weekStart)} highlights`;

/** "8:05": the local time of a timeline row. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
