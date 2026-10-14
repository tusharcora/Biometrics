// The thinking attachment setting (spec §4). Ids match backend/src/coach/thinking.ts.
export const THINKING_ATTACHMENTS = ['bulb', 'cloud', 'typing', 'hourglass', 'gears', 'question', 'sparkles', 'clock', 'spinner'] as const;
export type ThinkingAttachmentId = (typeof THINKING_ATTACHMENTS)[number];
export const DEFAULT_THINKING_ATTACHMENT: ThinkingAttachmentId = 'bulb';

const has = (list: readonly string[], v: unknown) => typeof v === 'string' && list.includes(v);
export const isThinkingAttachment = (v: unknown): v is ThinkingAttachmentId => has(THINKING_ATTACHMENTS, v);

export const THINKING_ATTACHMENT_NAMES: Record<ThinkingAttachmentId, { name: string; blurb: string }> = {
  bulb: { name: 'Lightbulb', blurb: 'Flickers while it thinks, lights up when the answer lands.' },
  cloud: { name: 'Thought cloud', blurb: 'A thought bubble; the dots fill in one by one.' },
  typing: { name: 'Typing bubble', blurb: 'Three bouncing dots, like "is typing".' },
  hourglass: { name: 'Hourglass', blurb: 'Sand trickles through, grain by grain.' },
  gears: { name: 'Gears', blurb: 'Two cogs turning together.' },
  question: { name: '? → !', blurb: 'A question mark that pops into an !.' },
  sparkles: { name: 'Sparkles', blurb: 'Little stars twinkle around the head.' },
  clock: { name: 'Clock', blurb: 'The hand sweeps round, then a ding.' },
  spinner: { name: 'Spinner', blurb: 'A ring of pixels chasing each other.' },
};

// The text styles moved to lib/thinkingText.ts (spec 2026-10-14 KIP Coach §1); this re-export goes in Task 14.
export { THINKING_TEXTS, DEFAULT_THINKING_TEXT, isThinkingText, THINKING_TEXT_NAMES, type ThinkingTextId } from '../../lib/thinkingText';
