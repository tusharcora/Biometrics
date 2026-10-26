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
  // Screen-reader hints on what sends a question: a Today bar or underlined word, and a follow-up chip.
  asksKipAboutIt: `Asks ${KIP_NAME} about it`,
  asksKip: `Asks ${KIP_NAME}`,
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
  // Settings → KIP, the Conversations sheet, memory, consent and the hosted engine (§7.4–§7.6).
  settingsGroup: KIP_NAME,
  yourKipSubtitle: (colourName: string) => `${colourName} · coaches you on the KIP tab`,
  changeColour: 'Change colour',
  whileKipThinks: 'While KIP thinks',
  whileKipThinksSubtitle: 'How the chat shows KIP is working',
  memoryTitle: 'What KIP remembers',
  memorySubtitle: (n: number) => `See, edit or delete · ${n} ${n === 1 ? 'thing' : 'things'}`,
  memoryIntro: 'Things you told me that help me answer. Only you can see them, and you can delete any of them.',
  memoryLoadError: "What KIP remembers couldn't be loaded.",
  memoryEmptyBody:
    'KIP only remembers your training goals, your schedule and your preferences, and never health or medical details. Anything it remembers will appear here, and you can change or delete it at any time.',
  whatIsSent: 'What is sent when you ask something',
  turnOff: 'Turn off KIP coaching',
  onFooter: 'KIP stays on Home; nothing is shared for coaching.',
  setUp: 'Set up KIP coaching',
  offFooter: 'KIP coaching is off. Nothing is shared, and the rest of the app works as normal.',
  turnOffError: "KIP coaching couldn't be turned off. Please try again.",
  hostedTitle: "KIP's AI engine",
  consentTitle: 'KIP coaching',
  consentHeadingFull: 'Before you use KIP coaching',
  consentDeclineNote:
    'Choosing not to turn on KIP coaching changes nothing else in the app. Your scores, habits and patterns all keep working exactly as they do now. You can turn it off again at any time in Settings.',
  hostedUnavailable: "Claude isn't available right now. KIP keeps answering on-device.",
  hostedGone: "Claude isn't available on this server right now. KIP answers on-device.",
} as const;

/** "fair": the Recovery page's band word in lower case (§3.3 "{verdict} day"). */
export function verdictWord(band: ScoreBand | null): string | null {
  return band ? BAND_WORD[band].toLowerCase() : null;
}
