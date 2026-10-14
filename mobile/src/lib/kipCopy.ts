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
  // The KIP page (§3.1–§3.4).
  pageTitle: KIP_NAME,
  conversationsLabel: 'Conversations and what KIP remembers',
  newChatLabel: 'New chat',
  promptPlaceholder: 'Ask KIP…',
  promptLabel: 'Message KIP',
  deskLabel: "KIP'S DESK",
  windowCaption: "Window shows today's Recovery",
  recoveryTag: 'RECOVERY',
  emptyHeading: "Hi, I'm KIP. What would you like to know?",
  emptyBody: 'Ask about your sleep, recovery or training, or anything health and fitness.',
  errorHeading: 'KIP lost the thread',
  unavailable: "KIP isn't available right now.",
  statusUnverified: "We couldn't check KIP just now. You can still send a message.",
  consentHeading: 'KIP needs your OK first',
  consentBody: 'Before KIP can look at your scores, see exactly what is sent when you ask something.',
  consentReview: 'Review what is shared',
  consentNotNow: 'Not now',
  replyLabel: KIP_NAME,
  // Collapse and "Shrink room" (§3.5).
  shrinkRoom: 'Shrink room',
  expandRoomLabel: "Expand KIP's room",
} as const;

/** "fair": the Recovery page's band word in lower case (§3.3 "{verdict} day"). */
export function verdictWord(band: ScoreBand | null): string | null {
  return band ? BAND_WORD[band].toLowerCase() : null;
}
