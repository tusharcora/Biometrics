// Every KIP coach string (spec 2026-10-14 KIP Coach §3, §7). Components never inline copy.
import { BAND_WORD } from './recoveryCopy';
import type { ScoreBand } from './scoreInsights';

export const KIP_NAME = 'KIP';

/** KIP's three thinking lines (§1 Decoupling 2), as "KIP is …". */
export const KIP_THINKING_VERBS = ['typing it up', 'working on it', 'checking your numbers'] as const;

export const KIP_COPY = {
  thinkingLabel: `${KIP_NAME} is ${KIP_THINKING_VERBS[0]}`,
  thinkingTextIntro: 'How the chat shows KIP is working on a reply.',
  /** The offline state (§3.4); no button, the question stays in the prompt bar. */
  offline: `${KIP_NAME} can't reach the internet. Ask again when you're back online.`,
} as const;

/** "fair": the Recovery page's band word in lower case (§3.3 "{verdict} day"). */
export function verdictWord(band: ScoreBand | null): string | null {
  return band ? BAND_WORD[band].toLowerCase() : null;
}
