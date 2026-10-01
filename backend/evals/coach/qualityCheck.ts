// Quality checks for the owner's bar: an answer should be "informative,
// personable, not automated". The runtime validator only keeps answers honest
// (every number grounded, no disallowed topic); these eval-only checks look at
// whether an answer is any good, following the prompt's "How to answer well"
// block (answer/prompt.ts):
//
//   answersFirst    the first shown sentence answers the question (it names one
//                   of the words the fixture says the answer is about), instead
//                   of filler like "Great question!".
//   namesDrivers    every score driver on the fact sheet ([factor.*]) is named,
//                   not just one.
//   nextStep        at least one sentence is a concrete step, in words: it
//                   opens with (or contains) a suggestion and carries no number
//                   (times of day are fine: the validator exempts them).
//   noStockCheckIn  no generic check-in question ("How have you been feeling
//                   lately?"); a specific question back is fine.
//
// Like the direction check, these are deliberately simple lexicon checks, not
// a judge model: they over- or under-flag free prose, so scripted fixtures opt
// in, and `npm run eval:coach:local` reports them for a human to read.

import type { Fact, FactSheet } from '../../src/coach/answer/facts';
import { extractNumbers } from '../../src/coach/answer/validate';

export interface QualityExpectation {
  /** The first shown sentence must contain one of these words or phrases (case-insensitive, whole words). */
  answersFirst?: string[];
  /** Every [factor.*] driver on the fact sheet must be named somewhere in the reply. */
  namesDrivers?: boolean;
  /** Some sentence must be a concrete next step written in words. */
  nextStep?: boolean;
  /** No generic check-in question. */
  noStockCheckIn?: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w: string) => new RegExp(String.raw`\b${escapeRe(w)}\b`, 'i');

/** How a reply may name each score driver, by the factor part of its fact id. */
const DRIVER_MENTION: Record<string, RegExp> = {
  hrv: /\bhrv\b|heart rate variability/i,
  rhr: /\bresting\s+(?:hr|heart)|\brhr\b/i,
  sleep_debt: /\bsleep\b|\bslept\b|\bnights?\b/i,
  sleep_duration: /\bsleep\b|\bslept\b|\bnights?\b/i,
  sleep_efficiency: /\bsleep\b|\brestless\b|\befficien/i,
  circadian_consistency: /\bbedtimes?\b|\bconsisten|\bschedule\b|\broutine\b/i,
};

/** "Resting HR effect on the recovery score" -> "Resting HR". */
const driverName = (fact: Fact) => fact.label.replace(/\s+effect on the .*$/i, '');

/** A sentence that opens with a suggestion, or carries one ("you could ..."). */
const STEP_OPENER =
  /^(?:(?:so|then|maybe|perhaps|for now|today|tonight|this evening),?\s+)?(?:try|aim|keep|take|plan|consider|swap|skip|start|stick|save|ease|go|get|head|wind|make|give|choose|stay|hold|protect|focus|add|cut|move|build|book|set|leave|treat|let\s+(?:today|tonight|this))\b/i;
const STEP_PHRASE = /\b(?:you could|you might|it may help to|it might help to|try to|aim to|a good (?:idea|move|step) (?:is|would be) to|worth (?:trying|keeping|making))\b/i;

/** A concrete step written in words: a suggestion with no number in it (times of day and dates are not numbers). */
export function isNextStep(sentence: string): boolean {
  const s = sentence.trim();
  return (STEP_OPENER.test(s) || STEP_PHRASE.test(s)) && extractNumbers(s).length === 0;
}

const STOCK_CHECK_IN =
  /\bhow (?:are|have) you (?:been )?feeling\b|\bhow(?:'s| is| has) your (?:day|week)\b|\bhow has (?:the|this) week (?:been|felt)\b|\banything (?:new|changed|different)\b|\bany (?:recent )?changes? (?:in|to) your\b|\bhow are things\b|\bhow is everything\b|\bwhat did your (?:evening|day) look like\b|\bfeeling stressed\b/i;

/** Problems with a reply against the quality bar; [] when it meets every check asked for. */
export function checkQuality(sentences: readonly string[], sheet: FactSheet, want: QualityExpectation): string[] {
  const problems: string[] = [];
  const text = sentences.join(' ');
  if (want.answersFirst) {
    const first = sentences[0] ?? '';
    if (!want.answersFirst.some((w) => wordRe(w).test(first))) {
      problems.push(`the first sentence does not answer the question (expected one of ${want.answersFirst.map((w) => `"${w}"`).join(', ')}): ${JSON.stringify(first)}`);
    }
  }
  if (want.namesDrivers) {
    const drivers = sheet.facts.filter((f) => f.id.startsWith('factor.'));
    if (drivers.length === 0) problems.push('the fact sheet has no score drivers to name');
    for (const d of drivers) {
      const key = d.id.slice('factor.'.length);
      const mention = DRIVER_MENTION[key] ?? wordRe(driverName(d));
      if (!mention.test(text)) problems.push(`the reply does not name the driver ${driverName(d)}`);
    }
  }
  if (want.nextStep && !sentences.some(isNextStep)) problems.push('the reply offers no concrete next step in words');
  if (want.noStockCheckIn) {
    const stock = sentences.find((s) => s.trim().endsWith('?') && STOCK_CHECK_IN.test(s));
    if (stock) problems.push(`the reply asks a stock check-in question: ${JSON.stringify(stock)}`);
  }
  return problems;
}
