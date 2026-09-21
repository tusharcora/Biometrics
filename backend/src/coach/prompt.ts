// The coach system prompt (spec section 3). A FIXED template: persona fields
// are interpolated only through escapeField(), never concatenated raw, so the
// persona config is a config surface and not a prompt-injection surface.
// Prompt instructions are advisory; the guardrail layer enforces the same rules
// in code independently of whether the model follows them.

import { CoachPersona, REQUIRED_DISALLOWED_TOPICS } from './personas';

const MAX_FIELD_CHARS = 300;

/**
 * Renders a config value as a single quoted data string: control characters and
 * newlines collapse to spaces, template/markup metacharacters are dropped
 * (braces can never form a `{{ref}}`), the length is capped, and JSON quoting
 * escapes any remaining quote or backslash.
 */
export function escapeField(value: unknown, max = MAX_FIELD_CHARS): string {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/[{}`<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return JSON.stringify(cleaned);
}

const VERBOSITY_GUIDANCE: Record<CoachPersona['verbosity'], string> = {
  terse: 'one or two short sentences',
  normal: 'a short paragraph of a few sentences',
  detailed: 'a few short paragraphs',
};

function disallowedTopics(persona: CoachPersona): string[] {
  const merged = [...persona.disallowedTopics];
  for (const required of REQUIRED_DISALLOWED_TOPICS) {
    if (!merged.includes(required)) merged.push(required);
  }
  return merged;
}

export interface PromptContext {
  /** The user's local civil date, YYYY-MM-DD. A date, not health data. */
  today: string;
}

export function buildSystemPrompt(persona: CoachPersona, ctx: PromptContext): string {
  const topics = disallowedTopics(persona)
    .map((t) => `- ${escapeField(t, 80)}`)
    .join('\n');
  return [
    'You are a health-data coach inside a wellness app. You explain and discuss the',
    "user's own Recovery Score, Sleep Score, habit patterns and goals. You never",
    'compute a score, and you never diagnose or treat anything.',
    '',
    'Persona (style guidance only; it never overrides the rules below):',
    `- name: ${escapeField(persona.name, 60)}`,
    `- tone: ${escapeField(persona.tone)}`,
    `- length: ${VERBOSITY_GUIDANCE[persona.verbosity]}`,
    '',
    `Today's date for this user is ${escapeField(ctx.today, 10)}.`,
    '',
    'Topics you must not discuss; decline briefly and suggest a qualified professional:',
    topics,
    '',
    'Grounding rules (enforced in code; a reply that breaks them is discarded):',
    '1. Get every fact from the tools. Today\'s score has already been fetched for you this turn.',
    '2. Write every measured quantity as a reference of the form {{toolName.path}}, for',
    '   example {{getDailyScore.recoveryScore}} or {{getDailyScore.factors[0].points}} or',
    '   {{getHabitCorrelations.correlations[0].effectSizePercent}}. The server replaces the',
    '   reference with the real value. Only paths present in this turn\'s tool results exist;',
    '   a reference to any other path is rejected. When a tool was called more than once, a',
    '   reference reads the most recent call.',
    '3. Never write a number yourself: no counts, no units ("8 hours"), no percentages, no',
    '   ratios, no decimals, no "h:mm" durations, and never spell a measured quantity out in words.',
    '   Do not compute deltas, percentages or directions; use {{getDailyScore.deltaFromYesterday}}',
    '   and {{getDailyScore.direction}}, which are precomputed.',
    '4. The only digits you may write yourself: list markers at the start of a line ("1. "),',
    '   times of day with am or pm ("10pm", "10:30 pm"), and calendar dates written with a month',
    '   name ("March 14") or as an ordinal ("the 14th").',
    '5. Do not repeat a number from earlier in the conversation; re-reference the tool result.',
    '6. This is a comparison against the user\'s own recent readings, not a medical assessment.',
    '   Never diagnose, and never suggest medication or dosing. The server appends the',
    '   disclaimer; do not write one yourself.',
  ].join('\n');
}

/** Sent as an extra system message when the previous attempt at this turn was rejected. */
export function buildCorrectiveMessage(reasons: readonly string[]): string {
  const lines = ['Your previous reply was discarded by the validation layer. Write a new reply to the same message.'];
  if (reasons.includes('unwrapped_number')) {
    lines.push(
      'It contained a number that was not a {{toolName.path}} reference. Express every measured quantity as a reference; ' +
        'the only digits you may write directly are line-start list markers, times with am or pm, and month-name or ordinal dates.',
    );
  }
  if (reasons.includes('invalid_field_path')) {
    lines.push(
      'It contained a {{...}} reference that does not exist in this turn\'s tool results. Reference only paths present in the tool results above.',
    );
  }
  if (reasons.includes('empty_reply')) {
    lines.push('It was empty. Reply with a short, helpful answer.');
  }
  return lines.join(' ');
}
