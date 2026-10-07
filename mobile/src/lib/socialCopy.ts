import type { Person } from '../api/buddies';
import type { Camp, CampMember, CheckInMood, Goodnight, HighlightItem, SocialHome, StoryFrame, TimelineItem } from '../api/social';
import { FAMILY_NAMES, levelTitle, MAX_LEVEL } from './badges';
import { STICKER_LABEL } from './buddyCopy';

// Social copy (spec 2026-10-07 social §5, §6, §7). Fixed templates over typed fields: no free text, no health numbers
// (the only counts are the circle's own actions, like stickers sent or nights the fire was lit). The one exception is
// a camp note's own text, which only the Campfire page shows (campStatus and the coach bubbles).

export const CHECKIN_OPTIONS: ReadonlyArray<{ mood: CheckInMood; label: string; color: string }> = [
  { mood: 'RESTED', label: 'Rested', color: '#86EFAC' },
  { mood: 'OKAY', label: 'Okay', color: '#93C5FD' },
  { mood: 'TIRED', label: 'Tired', color: '#FDBA74' },
];
const MOOD_WORD: Record<CheckInMood, string> = { RESTED: 'rested', OKAY: 'okay', TIRED: 'tired' };

/** "You" for me; otherwise the display name, or "@handle" when it is unset (''). */
export const personName = (p: Person, mine: boolean) => (mine ? 'You' : p.displayName || `@${p.handle}`);

// The kinds and types this app knows. A newer server may add more (S3 adds chats); lists skip what they don't know
// instead of crashing on it. The same goes for an unknown value inside a known kind (a new top-story reason, sticker,
// badge family or recap kind, a goodnight without its on-time flag, a campfire without a count): skipped, never
// worded as something it isn't ("checked in every day", "a undefined", "undefined II", "monthly").
const TIMELINE_KINDS: ReadonlySet<string> = new Set<TimelineItem['kind']>([
  'checkin', 'step_goal', 'badge', 'sticker', 'recap_share', 'goodnight', 'camp_note',
]);
const HIGHLIGHT_TYPES: ReadonlySet<string> = new Set<HighlightItem['type']>([
  'top_story', 'most_cheered_you', 'comeback', 'checked_in_every_day', 'most_stickers_sent', 'campfire', 'joined', 'first_badge',
]);
const TOP_STORY_REASONS: ReadonlySet<string> = new Set(['badge', 'checked_in_every_day', 'on_time_every_night']);
const STORY_FRAME_KINDS: ReadonlySet<string> = new Set<StoryFrame['kind']>(['checkin', 'badge', 'recap', 'goodnight']);
const RECAP_KINDS: ReadonlySet<string> = new Set(['WEEK', 'MONTH']);
const has = (table: object, key: unknown) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
const knownMood = (mood: unknown) => has(MOOD_WORD, mood);
const knownBadge = (family: unknown, level: unknown) =>
  has(FAMILY_NAMES, family) && Number.isInteger(level) && (level as number) >= 1 && (level as number) <= MAX_LEVEL;

function isKnownTimelineItem(i: TimelineItem): boolean {
  if (!TIMELINE_KINDS.has(i.kind)) return false;
  switch (i.kind) {
    case 'checkin': return i.locked || knownMood(i.mood);
    case 'badge': return knownBadge(i.badge?.family, i.badge?.level);
    case 'sticker': return has(STICKER_LABEL, i.sticker);
    case 'recap_share': return RECAP_KINDS.has(i.recapKind);
    case 'goodnight': return typeof i.onTime === 'boolean';
    default: return true;
  }
}

function isKnownHighlight(i: HighlightItem): boolean {
  if (!HIGHLIGHT_TYPES.has(i.type)) return false;
  if (i.type === 'campfire') return Number.isInteger(i.nights) && i.nights > 0;
  if (i.type !== 'top_story') return true;
  if (!TOP_STORY_REASONS.has(i.reason)) return false;
  return i.reason !== 'badge' || knownBadge(i.family, i.level);
}

function isKnownStoryFrame(f: StoryFrame): boolean {
  if (!STORY_FRAME_KINDS.has(f.kind)) return false;
  switch (f.kind) {
    case 'checkin': return f.locked || knownMood(f.mood);
    case 'badge': return knownBadge(f.family, f.level);
    case 'recap': return RECAP_KINDS.has(f.recapKind);
    case 'goodnight': return typeof f.onTime === 'boolean';
    default: return true;
  }
}

export const knownTimelineItems = (items: readonly TimelineItem[]) => items.filter(isKnownTimelineItem);
export const knownHighlights = (items: readonly HighlightItem[]) => items.filter(isKnownHighlight);
export const knownStoryFrames = (frames: readonly StoryFrame[]) => frames.filter(isKnownStoryFrame);

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
    case 'goodnight':
      return { name, rest: item.onTime ? 'said goodnight, on time' : 'said goodnight' };
    case 'camp_note':
      return { name, rest: 'left a camp note' };
  }
}

export function timelineLine(item: TimelineItem): string {
  const { name, rest } = timelineParts(item);
  return `${name} ${rest}`;
}

/**
 * The sticker a row offers: none on my own rows, on stickers, on goodnights (they're off to bed) and camp notes (the
 * note is read on the Campfire), or on a locked check-in (no mood to react to).
 */
export function timelineAction(item: TimelineItem): 'cheer' | 'rest_up' | null {
  if (item.mine || item.kind === 'sticker' || item.kind === 'goodnight' || item.kind === 'camp_note') return null;
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
    case 'campfire': return 'Campfire';
    case 'joined': return 'New at camp';
    case 'first_badge': return 'First badge';
  }
}

/** The kicker's colour (design V5); null = the muted foreground. */
export function highlightKickerColor(item: HighlightItem): string | null {
  switch (item.type) {
    case 'top_story': return '#A5B4FC';
    case 'most_cheered_you': return '#FCD34D';
    case 'comeback': return '#86EFAC';
    case 'campfire': return '#FB923C';
    default: return null;
  }
}

export function highlightLine(item: HighlightItem): string {
  const who = personName(item.actor, item.mine);
  switch (item.type) {
    case 'top_story':
      if (item.reason === 'badge') return `${who} reached ${levelTitle(item.family, item.level)}`;
      if (item.reason === 'on_time_every_night') return `${who} ${item.mine ? 'were' : 'was'} in bed on time every night`;
      return `${who} checked in every day`;
    case 'most_cheered_you': return `${who} cheered you most`;
    case 'comeback': return `${who} bounced back to rested`;
    case 'checked_in_every_day': return `${who} checked in every day`;
    case 'most_stickers_sent': return `${who} sent ${item.count} stickers`;
    case 'campfire': return `The fire was lit ${item.nights} nights`;
    case 'joined': return `${who} joined the camp`;
    case 'first_badge': return item.mine ? 'You earned your first badge' : `${who} earned their first badge`;
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

// ---- The camp (spec §6) ----

/** A camp note's limit, as the server counts it: code points after sanitising (NFC, invisibles removed) and trimming. */
export const CAMP_NOTE_MAX = 40;

/**
 * A draft's length for the counter: code points of the NFC, trimmed draft. It may over-count (the server also strips
 * format and control characters) but never under-counts: NFC can turn one code point into two (U+2ADC), so the
 * counter normalises as the server does.
 */
export function noteLength(draft: string): number {
  const text = typeof draft.normalize === 'function' ? draft.normalize('NFC') : draft;
  return [...text.trim()].length;
}

/** The banner's second line: who's awake and asleep at night; who checked in by day, or from an S1 server. */
export function campBannerLine(camp: SocialHome['camp']): string {
  if (camp.night === true && typeof camp.awake === 'number' && typeof camp.asleep === 'number') return `${camp.awake} awake · ${camp.asleep} asleep`;
  return `${camp.checkedIn} checked in`;
}

export const fireLine = (fire: Camp['fire']) => `${fire.lit} of ${fire.of} in bed on time`;

// Every time on the Campfire is 12-hour (owner ruling): "10:15 PM".
const twelveHour = (hour: number, minute: number) => `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;

/** "10:15 PM": a moment on the phone's clock, for the Campfire. */
export function campClock(iso: string): string {
  const d = new Date(iso);
  return twelveHour(d.getHours(), d.getMinutes());
}

/** "Who's here": "awake · {their whole note}" or "awake", or "asleep since 10:15 PM · on time". */
export function campStatus(m: CampMember): string {
  if (m.asleep) return `asleep${m.asleepSince ? ` since ${campClock(m.asleepSince)}` : ''}${m.onTime ? ' · on time' : ''}`;
  return m.note ? `awake · ${m.note}` : 'awake';
}

export const goodnightSaidLine = (g: Goodnight) => (g.onTime ? 'Goodnight said, on time' : 'Goodnight said');

/** "You can say goodnight from 8:00 PM", from my window's opening ("HH:MM", my clock). */
export function goodnightOpensLine(opensAt: string): string {
  const [hour, minute] = opensAt.split(':').map(Number) as [number, number];
  return `You can say goodnight from ${twelveHour(hour, minute)}`;
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** "TUESDAY · 10:42 PM": the Campfire header's kicker, on the phone's clock. */
export function campKicker(now: Date): string {
  return `${WEEKDAYS[now.getDay()]} · ${twelveHour(now.getHours(), now.getMinutes())}`;
}
