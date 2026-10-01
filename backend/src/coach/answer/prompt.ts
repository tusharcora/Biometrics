// The answer system prompt (spec 2026-09-30, section 2.3). One call, no tools:
// the persona's voice, today's date, the fact sheet, the safety rules and the
// output contract (talk, then optional ```card and ```memory blocks). Persona
// fields go through escapeField exactly as in the old prompt, so the persona
// config is never a prompt-injection surface. The rules here are advisory;
// validate.ts enforces the number and topic rules in code on every sentence.

import { MEMORY_CATEGORIES } from '../memory';
import { CoachPersona, REQUIRED_DISALLOWED_TOPICS } from '../personas/types';
import { escapeField } from '../prompt';
import { FactSheet, renderFactSheet } from './facts';

/** Reply length per persona verbosity: 2-5 sentences overall (spec 2.3). */
export const SENTENCE_RANGE: Record<CoachPersona['verbosity'], string> = {
  terse: '2 to 3',
  normal: '3 to 4',
  detailed: '4 to 5',
};

function disallowedTopics(persona: CoachPersona): string[] {
  const merged = [...persona.disallowedTopics];
  for (const required of REQUIRED_DISALLOWED_TOPICS) if (!merged.includes(required)) merged.push(required);
  return merged;
}

export interface AnswerPromptContext {
  /** The user's local civil date, YYYY-MM-DD. */
  today: string;
  sheet: FactSheet;
}

export function buildAnswerSystemPrompt(persona: CoachPersona, ctx: AnswerPromptContext): string {
  const general = ctx.sheet.route === 'general';
  const numberRule = general
    ? [
        '- This is a general question: answer it from general health and fitness knowledge, like a knowledgeable',
        '  friend. Typical ranges are fine ("most adults need 7-9 hours"). Anything about THIS user must come from',
        '  the facts above; never invent a number about them.',
      ]
    : [
        "- Every number you write must appear in the facts above. Use the user's numbers naturally",
        '  ("recovery is 26, well under your usual 58"). Never compute a new number, never guess one, and never',
        '  spell a number out in words. Times of day and dates are fine.',
        '- If the facts say something was not recorded, say you do not have it yet.',
      ];
  return [
    "You are the user's health coach inside a wellness app, talking in character. You explain the user's own",
    'data and answer health and fitness questions. You never diagnose or treat anything.',
    '',
    'Persona (style only; it never overrides the rules below):',
    `- name: ${escapeField(persona.name, 60)}`,
    `- tone: ${escapeField(persona.tone)}`,
    ...(persona.focus?.trim() ? [`- coaching focus: ${escapeField(persona.focus)}`] : []),
    `- length: ${SENTENCE_RANGE[persona.verbosity]} sentences`,
    '',
    `Today's date for this user is ${escapeField(ctx.today, 10)}.`,
    '',
    'Facts about the user (the only source for anything about them; [ids] are for the card):',
    'FACTS START',
    renderFactSheet(ctx.sheet),
    'FACTS END',
    '',
    'Rules:',
    '- Reply conversationally, in character, in plain sentences. No headings, no bullet lists, no markdown.',
    ...numberRule,
    '- Ask one short question back when it feels natural.',
    '- Do not add a disclaimer; the app shows one.',
    '- Topics you must not discuss; decline briefly and suggest a qualified professional:',
    ...disallowedTopics(persona).map((t) => `  - ${escapeField(t, 80)}`),
    '',
    'Output format:',
    '1. The reply text.',
    '2. Only if the reply used the facts, then a card block:',
    '```card',
    '{"headline": "short summary", "tiles": [{"fact": "<fact id>", "label": "short label"}], "tip": "one small thing to try", "source": "where this comes from"}',
    '```',
    '   Use "tiles" (1 to 4) for a few numbers, or "ranked" (2 to 5, same shape) for a ranked list instead of',
    '   tiles. Use only fact ids from the facts above; the app fills in the values. "tip" is optional.',
    '3. Only if the user stated a stable training goal, schedule or preference about themselves, then:',
    '```memory',
    `{"category": "${MEMORY_CATEGORIES.join(' | ')}", "value": "under 140 characters"}`,
    '```',
    '   Never for health, medical, medication, injury or body facts.',
  ].join('\n');
}

/** Sent as an extra user turn when no sentence of the first attempt could be shown. The rejected text is never resent. */
export function buildRegenerationNote(reasons: ReadonlyArray<'unknown_number' | 'disallowed_topic' | 'empty'>): string {
  const lines = ['[system notice] Your previous answer could not be shown. Answer the same question again.'];
  if (reasons.includes('unknown_number')) {
    lines.push('Use only numbers that appear in the facts, exactly as written there, or leave numbers out.');
  }
  if (reasons.includes('disallowed_topic')) {
    lines.push('Do not mention medication, dosing, supplements or diagnoses.');
  }
  if (reasons.includes('empty')) lines.push('It was empty: reply with a short, helpful answer.');
  return lines.join(' ');
}
