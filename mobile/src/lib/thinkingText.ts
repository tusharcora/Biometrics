// "While KIP thinks" (spec 2026-10-14 KIP Coach §1, Decoupling 1): how the chat shows KIP working on a reply.
// The app keeps five styles. The server still accepts all ten (backend/src/coach/thinking.ts) for older apps, so a
// stored tag, nameplate, bouncy, dialog or strip reads here as steps.
export const THINKING_TEXTS = ['lines', 'placeholder', 'typewriter', 'steps', 'shimmer'] as const;
export type ThinkingTextId = (typeof THINKING_TEXTS)[number];
export const DEFAULT_THINKING_TEXT: ThinkingTextId = 'steps';

export const isThinkingText = (v: unknown): v is ThinkingTextId =>
  typeof v === 'string' && (THINKING_TEXTS as readonly string[]).includes(v);

export function resolveThinkingText(v: unknown): ThinkingTextId {
  return isThinkingText(v) ? v : DEFAULT_THINKING_TEXT;
}

export const THINKING_TEXT_NAMES: Record<ThinkingTextId, { name: string; blurb: string }> = {
  lines: { name: 'KIP\'s lines', blurb: 'KIP says what it is up to, a new line every few seconds.' },
  placeholder: { name: 'Reply placeholder', blurb: 'A pulsing reply bubble where the answer will appear.' },
  typewriter: { name: 'Typewriter', blurb: 'KIP types its line letter by letter.' },
  steps: { name: 'Steps', blurb: 'The real steps, ticked off as they happen.' },
  shimmer: { name: 'Colour shimmer', blurb: 'A wash of KIP\'s colour, with a timer.' },
};
