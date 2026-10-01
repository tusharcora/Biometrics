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
        // validate.ts rejects a general-route figure near you/your or a day word as a claim about the user.
        '- State general figures about people in general ("most adults need 7-9 hours", not "you need 7-9',
        '  hours"), and keep you, your and day words like today or last night out of those sentences.',
      ]
    : [
        "- Every number you write must appear in the facts above. Use the user's numbers naturally",
        '  ("recovery is 26, well under your usual 58"). Never compute a new number, never guess one, and never',
        '  spell a number out in words. Times of day and dates are fine.',
        '- If the facts say something was not recorded, say you do not have it yet.',
      ];
  // A real id from this sheet, never a placeholder: small models copy example literals verbatim.
  const exampleFact = ctx.sheet.facts[0]?.id;
  const cardFormat = exampleFact
    ? [
        '2. Only if the reply used the facts, then a card block, for example:',
        '```card',
        `{"headline": "short summary", "tiles": [{"fact": ${JSON.stringify(exampleFact)}, "label": "short label"}], "tip": "one small thing to try", "source": "where this comes from"}`,
        '```',
        '   Use "tiles" (1 to 4) for a few numbers, or "ranked" (2 to 5, same shape) for a ranked list instead of',
        '   tiles. Use only fact ids from the facts above; the app fills in the values. "tip" is optional.',
        '   The headline, tip and source follow the same number rule as the reply, or the whole card is dropped.',
      ]
    : ['2. No card block: there are no facts to show.'];
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
    'How to answer well:',
    '- Answer their actual question in your first sentence.',
    '- When [factor.*] facts show what drove a score, explain that why in plain words.',
    '- Offer one specific, doable next step.',
    '- If a note mentions their goal or preference, connect your answer to it.',
    '- Talk like a friend who knows their data, not like a report.',
    '',
    'Rules:',
    '- Plain sentences, in character: no headings, bullet lists or markdown.',
    ...numberRule,
    '- Ask one short question back when it feels natural.',
    '- Do not add a disclaimer; the app shows one.',
    '- If they describe urgent-sounding symptoms (chest pain, fainting, trouble breathing), tell them to seek',
    '  urgent medical care now, and do not coach around it.',
    '- Topics you must not discuss; decline briefly and suggest a qualified professional:',
    ...disallowedTopics(persona).map((t) => `  - ${escapeField(t, 80)}`),
    '',
    'Output format:',
    '1. The reply text.',
    ...cardFormat,
    '3. Only if the user stated a stable training goal, schedule or preference about themselves, then a',
    '   ```memory block holding one JSON object with "category" and "value". The category is one of',
    `   ${MEMORY_CATEGORIES.join(', ')}; the value is what they told you, under 140 characters.`,
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
