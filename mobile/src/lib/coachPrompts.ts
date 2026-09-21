import type { ScoreType } from '../api/scores';

// Questions pre-filled into the chat from an entry point. They deliberately
// carry no numbers: the coach must fetch today's real values itself (spec 2),
// and a score copied from the screen into the prompt would be a second,
// possibly stale, source of truth.
export function scoreQuestion(type: ScoreType): string {
  return type === 'SLEEP' ? 'Why did my sleep score change today?' : 'Why did my score change today?';
}
