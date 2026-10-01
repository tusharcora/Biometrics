// Sentence and card validation (spec 2026-09-30, section 2.4). Replaces the
// {{tool.path}} placeholder rule: the model writes numbers directly, and every
// number it writes must be one the fact sheet already holds.
//
//   * Numbers: every number, duration and h:mm in a sentence must match a
//     number in the rendered fact sheet (or a fact's value/usual): integers
//     within ±1, decimals within ±1%, durations within ±1% or ±1 minute, with
//     "6h 48m" = "408 minutes" = "6.8 hours". A hedged number ("about 7
//     hours", "~8,000 steps", "just under 400 minutes") may be within ±10% of a
//     value of the same family (durations vs plain numbers). Exempt: times of day ("10pm",
//     "at 22:30"), month-name dates, ordinals and line-start list markers.
//     On the general route an unknown number is allowed as general knowledge
//     ("most adults need 7–9 hours") unless the sentence states it about the
//     user ("you slept 5 hours", "your recovery is 40").
//   * Topics: medication and dosing (the crisis classifier's medication
//     patterns), supplement recommendations and diagnoses are never shown.
//
// A sentence is judged on its own so the pipeline can drop one bad sentence
// and keep streaming (drop-and-continue). Spelled-out numbers ("seven hours")
// are not detected; the prompt forbids them.

import { classifyCrisis } from '../guardrails/crisis';
import { AnswerCard, CardItem, statusOf } from './card';
import { Fact, FactSheet, renderFactSheet } from './facts';
import type { RawCard } from './parse';
import type { AnswerRoute } from './route';

/** `hedged` marks a number introduced by "about", "around", "~" and the like (HEDGE_RE). */
export type NumberToken = ({ kind: 'plain'; value: number } | { kind: 'duration'; minutes: number }) & { hedged?: true };

/** A hedged approximation just before a number; checked against the text ending at the number. */
const HEDGE_RE = /(?:\b(?:about|around|roughly|nearly|almost|close\s+to|just\s+(?:under|over))\s+|~\s*)$/i;
/** How far a hedged number may be from a fact value of its family (durations or plain numbers). */
export const HEDGE_TOLERANCE = 0.1;

const EXEMPT_PATTERNS: RegExp[] = [
  // A list marker at the start of a line: "1. Sleep earlier tonight."
  /^\s*\d{1,2}[.)]\s/gm,
  // A clock time with a meridiem; the lookahead stops "5 amazing" matching as "5 am".
  /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(a\.?m\.?|p\.?m\.?)(?![A-Za-z])/gi,
  // A 24-hour time introduced as a time of day: "at 22:30", "after 04:00".
  /\b(at|after|before|around|by|until|till|from|past)\s+([01]?\d|2[0-3]):[0-5]\d\b/gi,
  // A month name followed by a day: "March 14", "Sep 26".
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b/g,
  // An ordinal: "the 14th".
  /\b\d{1,2}(st|nd|rd|th)\b/g,
];

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const HOURS = String.raw`(?:hours?|hrs?|h)`;
const MINUTES = String.raw`(?:minutes?|mins?|m)`;

const RANGE_RE = new RegExp(String.raw`${NUM}\s*(?:-|–|—|to)\s*${NUM}\s*(${HOURS}|${MINUTES})\b`, 'gi');
const HOURS_MINUTES_RE = new RegExp(String.raw`(\d+)\s*${HOURS}\s*(?:and\s*)?(\d+)\s*${MINUTES}\b`, 'gi');
const HOURS_RE = new RegExp(String.raw`${NUM}\s*${HOURS}\b`, 'gi');
const MINUTES_RE = new RegExp(String.raw`${NUM}\s*${MINUTES}\b`, 'gi');
const CLOCK_DURATION_RE = /\b(\d{1,2}):([0-5]\d)\b/g;
const PLAIN_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

interface Located {
  start: number;
  token: NumberToken;
}

/** Every number, duration and h:mm in `text`, in order, outside the exempt shapes. Signs are ignored. */
export function extractNumbers(text: string): NumberToken[] {
  const masked = new Array<boolean>(text.length).fill(false);
  const free = (s: number, e: number) => masked.slice(s, e).every((m) => !m);
  const mask = (s: number, e: number) => masked.fill(true, s, e);
  for (const re of EXEMPT_PATTERNS) for (const m of text.matchAll(re)) mask(m.index!, m.index! + m[0].length);

  const found: Located[] = [];
  const scan = (re: RegExp, toTokens: (m: RegExpMatchArray) => NumberToken[]) => {
    for (const m of text.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      mask(s, e);
      const hedged = HEDGE_RE.test(text.slice(0, s));
      toTokens(m).forEach((token, i) => found.push({ start: s + i, token: hedged ? { ...token, hedged: true } : token }));
    }
  };
  const isHours = (unit: string) => /^h/i.test(unit);
  const minutes = (n: number): NumberToken => ({ kind: 'duration', minutes: Math.round(n * 1000) / 1000 });

  scan(RANGE_RE, (m) => {
    const factor = isHours(m[3]!) ? 60 : 1;
    return [minutes(Number(m[1]) * factor), minutes(Number(m[2]) * factor)];
  });
  scan(HOURS_MINUTES_RE, (m) => [minutes(Number(m[1]) * 60 + Number(m[2]))]);
  scan(HOURS_RE, (m) => [minutes(Number(m[1]) * 60)]);
  scan(MINUTES_RE, (m) => [minutes(Number(m[1]))]);
  scan(CLOCK_DURATION_RE, (m) => [minutes(Number(m[1]) * 60 + Number(m[2]))]);
  scan(PLAIN_RE, (m) => [{ kind: 'plain', value: Number(m[0].replace(/,/g, '')) }]);

  return found.sort((a, b) => a.start - b.start).map((f) => f.token);
}

interface Allowed {
  plain: number[];
  durations: number[];
}

const allowedCache = new WeakMap<FactSheet, Allowed>();

function allowedFor(sheet: FactSheet): Allowed {
  const cached = allowedCache.get(sheet);
  if (cached) return cached;
  const allowed: Allowed = { plain: [], durations: [] };
  for (const t of extractNumbers(renderFactSheet(sheet))) {
    if (t.kind === 'plain') allowed.plain.push(t.value);
    else allowed.durations.push(t.minutes);
  }
  for (const f of sheet.facts) {
    const list = f.unit === 'minutes' ? allowed.durations : allowed.plain;
    list.push(Math.abs(f.value));
    if (f.usual !== undefined) list.push(Math.abs(f.usual));
  }
  allowedCache.set(sheet, allowed);
  return allowed;
}

function isKnown(token: NumberToken, allowed: Allowed): boolean {
  // A hedged approximation ("about 7 hours" for 6h 48m) may be within 10% of a value of its family.
  const hedge = (a: number) => (token.hedged ? Math.abs(a) * HEDGE_TOLERANCE : 0);
  if (token.kind === 'duration') {
    return allowed.durations.some((a) => Math.abs(token.minutes - a) <= Math.max(1, a * 0.01, hedge(a)));
  }
  const tolerance = (a: number) => Math.max(Number.isInteger(token.value) ? 1 : Math.max(0.05, Math.abs(a) * 0.01), hedge(a));
  return allowed.plain.some((a) => Math.abs(token.value - a) <= tolerance(a));
}

/** A sentence stating a number ABOUT the user: never a general-knowledge figure. */
const USER_CLAIM_RE =
  /\b(you|you've|you're)\s+(slept|got|had|walked|logged|averaged|scored|hit|reached|were|are at)\b|\byour\s+(recovery|sleep|hrv|heart|resting|rhr|steps?|scores?|readings?|average|numbers?|data|bedtime|night|week|month)\b/i;

const DIAGNOSIS_RE =
  /\bdiagnos\w*|\b(you\s+(may|might|could|probably|likely)?\s*have|sounds?\s+like|signs?\s+of|symptoms?\s+of|consistent\s+with)\s+(an?\s+)?(sleep\s+apnea|apnoea|apnea|insomnia|depression|anxiety|diabetes|hypertension|arrhythmia|afib|atrial\s+fibrillation|thyroid|anemia|heart\s+disease|(a\s+)?(disorder|condition|disease|infection))\b/i;

const SUPPLEMENT_RE =
  /\b(supplements?|melatonin|magnesium|ashwagandha|valerian|l-?theanine|glycine|cbd|zinc|vitamin\s+[a-z0-9]+|creatine|5-?htp|tryptophan|gaba)\b/i;

export function isDisallowedTopic(sentence: string): boolean {
  return classifyCrisis(sentence).categories.includes('medication') || DIAGNOSIS_RE.test(sentence) || SUPPLEMENT_RE.test(sentence);
}

export type SentenceVerdict = { ok: true } | { ok: false; reason: 'unknown_number' | 'disallowed_topic' };

export function validateSentence(sentence: string, sheet: FactSheet): SentenceVerdict {
  if (isDisallowedTopic(sentence)) return { ok: false, reason: 'disallowed_topic' };
  const tokens = extractNumbers(sentence);
  if (tokens.length === 0) return { ok: true };
  const allowed = allowedFor(sheet);
  const generalAllowance = sheet.route === 'general' && !USER_CLAIM_RE.test(sentence);
  for (const t of tokens) {
    if (!isKnown(t, allowed) && !generalAllowance) return { ok: false, reason: 'unknown_number' };
  }
  return { ok: true };
}

// ---- card ---------------------------------------------------------------

export const MAX_TILES = 4;
export const MAX_RANKED = 5;
const MAX_HEADLINE_CHARS = 120;
const MAX_LABEL_CHARS = 32;
const MAX_TIP_CHARS = 200;
const MAX_SOURCE_CHARS = 60;

export const DEFAULT_CARD_SOURCE: Record<AnswerRoute, string> = {
  today: "Today's scores and readings",
  sleep: 'Sleep · last 7 nights',
  trends: 'Trends · last 30 days',
  general: 'Your profile',
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A short model-written string that passes sentence validation, else null. */
function cleanText(value: unknown, max: number, sheet: FactSheet): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length === 0 || text.length > max) return null;
  return validateSentence(text, sheet).ok ? text : null;
}

function labelFor(value: unknown, fact: Fact): string {
  if (typeof value !== 'string') return fact.label;
  const label = value.replace(/\s+/g, ' ').trim();
  return label.length > 0 && label.length <= MAX_LABEL_CHARS && !/\d/.test(label) ? label : fact.label;
}

function rows(raw: unknown, max: number, facts: Map<string, Fact>): CardItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CardItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isObject(item) || typeof item.fact !== 'string') continue;
    const fact = facts.get(item.fact);
    if (!fact || seen.has(fact.id)) continue;
    seen.add(fact.id);
    const row: CardItem = { factId: fact.id, label: labelFor(item.label, fact), display: fact.display, value: fact.value };
    if (fact.usual !== undefined) row.usual = fact.usual;
    const status = statusOf(fact);
    if (status) row.status = status;
    out.push(row);
    if (out.length === max) break;
  }
  return out;
}

/**
 * Schema-checks the model's card and fills every value from the fact sheet.
 * Unknown fact ids are dropped; a card without a valid headline or without any
 * valid tile/ranked row is dropped (null) and the talk is shown alone.
 */
export function resolveCard(raw: RawCard | undefined, sheet: FactSheet): AnswerCard | null {
  if (!isObject(raw)) return null;
  const headline = cleanText(raw.headline, MAX_HEADLINE_CHARS, sheet);
  if (headline === null) return null;
  const facts = new Map(sheet.facts.map((f) => [f.id, f]));
  const tiles = rows(raw.tiles, MAX_TILES, facts);
  const ranked = tiles.length > 0 ? [] : rows(raw.ranked, MAX_RANKED, facts);
  if (tiles.length === 0 && ranked.length === 0) return null;

  const card: AnswerCard = { headline, source: cleanText(raw.source, MAX_SOURCE_CHARS, sheet) ?? DEFAULT_CARD_SOURCE[sheet.route] };
  if (tiles.length > 0) card.tiles = tiles;
  else card.ranked = ranked;
  const tip = cleanText(raw.tip, MAX_TIP_CHARS, sheet);
  if (tip !== null) card.tip = tip;
  return card;
}
