import type { ScoreType } from '../api/scores';
import type { RecoveryState } from '../api/recovery';
import { formatDayShort } from './recoveryCopy';

// Questions pre-filled into the chat from an entry point. They deliberately
// carry no numbers: the coach must fetch today's real values itself (spec 2),
// and a score copied from the screen into the prompt would be a second,
// possibly stale, source of truth.
export function scoreQuestion(type: ScoreType): string {
  return type === 'SLEEP' ? 'Why did my sleep score change today?' : 'Why did my score change today?';
}

export function recoveryQuestion(p: { state: RecoveryState; isToday: boolean; date: string }): string {
  if (p.state === 'BUILDING') return 'When will my recovery score be ready?';
  if (p.state === 'NO_DATA') return p.isToday ? "Why don't I have a recovery score today?" : `Why don't I have a recovery score for ${formatDayShort(p.date)}?`;
  return p.isToday ? 'Why is my recovery where it is today?' : `Why was my recovery what it was on ${formatDayShort(p.date)}?`;
}
