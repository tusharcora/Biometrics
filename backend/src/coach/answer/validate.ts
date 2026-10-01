// Sentence and card validation (spec 2026-09-30, section 2.4). Replaces the
// {{tool.path}} placeholder rule: the model writes numbers directly, and every
// number it writes must be one the fact sheet already holds.
//
//   * Numbers: every number, duration and h:mm in a sentence must match a
//     value the sheet holds: a fact's value, usual or precomputed comparison,
//     or a number in a fact note or sheet note. Digits inside fact ids and
//     labels ("recovery.avg7", "30-day average") never count. Integers match
//     within ±1, decimals within ±1%, durations within ±1% or ±1 minute, with
//     "6h 48m" = "408 minutes" = "6.8 hours". A hedged number ("about 7
//     hours", "~8,000 steps", "just under 400 minutes") may be within ±10%.
//   * Units and metrics: a number with a unit next to it ("62 ms", "26%",
//     "3,120 steps", "32 points", "26/100") matches only values of that unit;
//     a bare number matches any non-duration value. When the sentence names
//     one or more metrics (recovery, sleep score, HRV, resting HR, sleep,
//     steps), only the named metrics' values (and metric-less ones, e.g.
//     notes) count, so "Your HRV is 61" cannot borrow resting HR's 61, nor
//     "Your recovery dropped 8%" the HRV trend's 8%, nor "Your HRV is 26
//     after a short night" recovery's 26. The one exception is a unit
//     owned by a single metric that is related to the named one: "your sleep
//     score was 36 ... your average dipped to 6h 53m" matches the duration
//     against the sleep facts (see candidatesFor).
//   * Number words ("seven hours", "five points", "nine thousand steps") are
//     read as numbers when a unit or metric word follows; "one thing to try"
//     is left alone.
//   * Exempt: times of day ("10pm", "at 22:30"), month-name dates with an
//     optional year ("Sep 26, 2026"), ordinals, line-start list markers, the
//     "/100" or "out of 100" scale and the sheet's 7- and 30-day windows.
//   * General route: an unknown number is allowed as general knowledge
//     ("most adults need 7–9 hours") unless the sentence is about the user:
//     "you/your" within a few words of the number, a time word ("last night",
//     "today"), a user-only score (recovery, sleep score), or a phrase like
//     "you slept"/"your HRV".
//   * Topics: medication and dosing (the crisis classifier's medication
//     patterns), supplement recommendations and diagnoses are never shown.
//
// A sentence is judged on its own so the pipeline can drop one bad sentence
// and keep streaming (drop-and-continue). Known limit: the direction of a
// change ("higher" vs "lower") is not checked.

import { classifyCrisis } from '../guardrails/crisis';
import { AnswerCard, CardItem, deltaDisplayOf, statusOf } from './card';
import { Fact, FactSheet, FactUnit, USUAL_DAYS, comparisonDiff } from './facts';
import type { RawCard } from './parse';
import type { AnswerRoute } from './route';

/** `hedged` marks a number introduced by "about", "around", "~" and the like (HEDGE_RE). */
export type NumberToken = ({ kind: 'plain'; value: number } | { kind: 'duration'; minutes: number }) & { hedged?: true };

/** A hedged approximation just before a number; checked against the text ending at the number. */
const HEDGE_RE = /(?:\b(?:about|around|roughly|nearly|almost|close\s+to|just\s+(?:under|over))\s+|~\s*)$/i;
/** How far a hedged number may be from a fact value of its family (durations or plain numbers). */
export const HEDGE_TOLERANCE = 0.1;

/** The kind of value a number is: durations, one per unit, or 'none' (a bare count from a note). */
type Family = 'duration' | 'ms' | 'bpm' | 'percent' | 'count' | 'score' | 'none';
export type Metric = 'recovery' | 'sleep_score' | 'hrv' | 'rhr' | 'sleep' | 'steps';

const FAMILY_OF_UNIT: Record<FactUnit, Family> = {
  minutes: 'duration',
  ms: 'ms',
  bpm: 'bpm',
  percent: 'percent',
  count: 'count',
  score: 'score',
  none: 'none',
};

/** The sheet's averaging windows ("7-day average", "last 30 days") are not data. */
const WINDOW_DAYS = `(?:7|${USUAL_DAYS})`;

const EXEMPT_PATTERNS: RegExp[] = [
  // A list marker at the start of a line: "1. Sleep earlier tonight."
  /^\s*\d{1,2}[.)]\s/gm,
  // A clock time with a meridiem; the lookahead stops "5 amazing" matching as "5 am".
  /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(a\.?m\.?|p\.?m\.?)(?![A-Za-z])/gi,
  // A 24-hour time introduced as a time of day: "at 22:30", "after 04:00".
  /\b(at|after|before|around|by|until|till|from|past)\s+([01]?\d|2[0-3]):[0-5]\d\b/gi,
  // A month name followed by a day and an optional year: "March 14", "Sep 26, 2026".
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b(,?\s+\d{4}\b)?/g,
  // An ordinal: "the 14th".
  /\b\d{1,2}(st|nd|rd|th)\b/g,
  // The score scale after a number: "26/100", "26 out of 100" (the 26 is still checked).
  /(?<=\d)\s*\/\s*100\b/g,
  /(?<=\d)\s+out\s+of\s+100\b/gi,
  // The sheet's windows: "7-day average", "30-night", "the last 30 days", and the trend label's own
  // "over 30 days" (also "in/across/for the past 7 nights"), which the model echoes.
  new RegExp(String.raw`\b${WINDOW_DAYS}-(?:day|night)s?\b`, 'gi'),
  new RegExp(String.raw`\b(?:last|past)\s+${WINDOW_DAYS}\s+(?:days|nights)\b`, 'gi'),
  new RegExp(String.raw`\b(?:over|in|across|for)\s+(?:the\s+)?(?:(?:last|past)\s+)?${WINDOW_DAYS}\s+(?:days|nights)\b`, 'gi'),
];

/** A unit right after a plain number, which limits what the number may match. */
const UNIT_AFTER: Array<[RegExp, Family]> = [
  [/^\s*(?:ms|milliseconds?)\b/i, 'ms'],
  [/^\s*(?:bpm|beats)\b/i, 'bpm'],
  [/^\s*(?:%|percent\b|per\s+cent\b)/i, 'percent'],
  [/^\s*steps\b/i, 'count'],
  [/^\s*(?:points?\b|pts\b|\/\s*100\b|out\s+of\s+100\b)/i, 'score'],
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

// ---- number words -------------------------------------------------------

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** A unit or metric word that turns a preceding number word into a number. */
const UNIT_OR_METRIC_WORD = String.raw`(?:hours?|hrs?|minutes?|mins?|ms|milliseconds?|bpm|beats|percent|per\s+cent|points?|pts|steps|hrv|recovery|sleep|resting\s+heart)\b`;
const WORD_NUMBER_RE = new RegExp(
  String.raw`\b(?:(${TENS.join('|')})(?:[-\s]+(${ONES.slice(1, 10).join('|')}))?|(${ONES.join('|')})|(a))(?:\s+(hundred|thousand))?(?=\s+${UNIT_OR_METRIC_WORD})`,
  'gi',
);

/** "seven hours" → "7 hours", "nine thousand steps" → "9000 steps"; number words elsewhere are left alone. */
function wordsToDigits(text: string): string {
  return text.replace(WORD_NUMBER_RE, (match, tens?: string, unit?: string, ones?: string, a?: string, scale?: string) => {
    if (a !== undefined && scale === undefined) return match;
    let n = a !== undefined ? 1 : tens !== undefined ? 20 + 10 * TENS.indexOf(tens.toLowerCase()) : ONES.indexOf(ones!.toLowerCase());
    if (unit !== undefined) n += ONES.indexOf(unit.toLowerCase());
    if (scale !== undefined) n *= scale.toLowerCase() === 'hundred' ? 100 : 1000;
    return String(n);
  });
}

// ---- extraction ---------------------------------------------------------

interface Scanned {
  start: number;
  token: NumberToken;
  /** For a plain number: the unit written right after it, if any. */
  unit?: Family;
}

/** Every number in `input` with its adjacent unit, in order, outside the exempt shapes. */
function scanNumbers(input: string): Scanned[] {
  const text = wordsToDigits(input);
  const masked = new Array<boolean>(text.length).fill(false);
  const free = (s: number, e: number) => masked.slice(s, e).every((m) => !m);
  const mask = (s: number, e: number) => masked.fill(true, s, e);
  for (const re of EXEMPT_PATTERNS) for (const m of text.matchAll(re)) mask(m.index!, m.index! + m[0].length);

  const found: Scanned[] = [];
  const scan = (re: RegExp, toTokens: (m: RegExpMatchArray) => NumberToken[]) => {
    for (const m of text.matchAll(re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      mask(s, e);
      const hedged = HEDGE_RE.test(text.slice(0, s));
      toTokens(m).forEach((token, i) => {
        const item: Scanned = { start: s + i, token: hedged ? { ...token, hedged: true } : token };
        if (token.kind === 'plain') {
          const after = text.slice(e);
          const unit = UNIT_AFTER.find(([re]) => re.test(after));
          if (unit) item.unit = unit[1];
        }
        found.push(item);
      });
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

  return found.sort((a, b) => a.start - b.start);
}

/** Every number, duration and h:mm in `text`, in order, outside the exempt shapes. Signs are ignored. */
export function extractNumbers(text: string): NumberToken[] {
  return scanNumbers(text).map((s) => s.token);
}

// ---- the allowed values -------------------------------------------------

interface Allowed {
  value: number;
  family: Family;
  /** Undefined for values not tied to one metric (sheet notes, score drivers). */
  metric: Metric | undefined;
}

const METRIC_OF_ID_HEAD: Record<string, Metric> = {
  recovery: 'recovery',
  sleep_score: 'sleep_score',
  hrv: 'hrv',
  rhr: 'rhr',
  sleep: 'sleep',
  steps: 'steps',
};

/** 'hrv.today' → hrv; 'habit.caffeine.hrv.lag2' → the habit's factor (hrv, rhr, sleep_*); 'factor.*' → none. */
function metricOf(fact: Fact): Metric | undefined {
  const [head, , factor] = fact.id.split('.');
  if (head === 'habit') {
    if (factor === 'hrv' || factor === 'rhr') return factor;
    return factor?.startsWith('sleep') ? 'sleep' : undefined;
  }
  return head === undefined ? undefined : METRIC_OF_ID_HEAD[head];
}

function noteValues(text: string, metric: Metric | undefined): Allowed[] {
  return scanNumbers(text).map((s) =>
    s.token.kind === 'duration'
      ? { value: s.token.minutes, family: 'duration', metric }
      : { value: s.token.value, family: s.unit ?? 'none', metric },
  );
}

// Sheets are treated as immutable once built, so the allowed values are computed once per sheet.
const allowedCache = new WeakMap<FactSheet, Allowed[]>();

/** Built from structured fact data, never from the rendered text, so id and label digits stay out. */
function allowedFor(sheet: FactSheet): Allowed[] {
  const cached = allowedCache.get(sheet);
  if (cached) return cached;
  const allowed: Allowed[] = [];
  for (const f of sheet.facts) {
    const family = FAMILY_OF_UNIT[f.unit];
    const metric = metricOf(f);
    const diff = comparisonDiff(f);
    for (const value of [f.value, f.usual, diff]) {
      if (value !== undefined) allowed.push({ value: Math.abs(value), family, metric });
    }
    if (f.note) allowed.push(...noteValues(f.note, metric));
  }
  for (const note of sheet.notes) allowed.push(...noteValues(note, undefined));
  allowedCache.set(sheet, allowed);
  return allowed;
}

const PLAIN_FAMILIES: Family[] = ['ms', 'bpm', 'percent', 'count', 'score', 'none'];

/** Unit families that belong to one metric, so a value in them can only be that metric's. */
const SINGLE_OWNER: Partial<Record<Family, Metric>> = { duration: 'sleep', ms: 'hrv', bpm: 'rhr', count: 'steps' };
/** A named metric may borrow a single-owner family from these metrics only. */
const RELATED: Partial<Record<Metric, Metric[]>> = { sleep_score: ['sleep'] };

/**
 * The values a number may match. Its unit family always limits them (a
 * duration, "62 ms", "61 bpm", "8%", "9,645 steps", "6.3 points"; a bare number
 * is any non-duration family). When the sentence names one metric, only that
 * metric's values and metric-less ones (notes, score drivers) count, so
 * "Your HRV is 61" cannot borrow resting HR's 61 and "Your recovery dropped 8%"
 * cannot borrow the HRV trend's 8%.
 *
 * One exception: a number whose unit family belongs to a single metric
 * (durations: sleep, ms: HRV, bpm: resting HR, steps: steps) may match that
 * owner's values when the named metric is related to it and has none of its
 * own in the family. Today that is the sleep score and sleep durations, so
 * "Your sleep score was 36, ... your average dipped to 6h 53m" passes while
 * "Your recovery is 61 bpm" does not. Percent and points are shared by several
 * metrics and never fall back.
 */
function candidatesFor(s: Scanned, allowed: Allowed[], named: ReadonlySet<Metric>): Allowed[] {
  const { token } = s;
  const families = token.kind === 'duration' ? ['duration'] : s.unit ? [s.unit] : PLAIN_FAMILIES;
  const inFamily = allowed.filter((a) => families.includes(a.family));
  // A sentence naming no metric is judged by unit family alone.
  if (named.size === 0) return inFamily;
  // With one or more named metrics (two is the norm in a summary: "A short night (6h 48m) pulled
  // your HRV down to 41"), a number may match only the named metrics' values and metric-less ones.
  const scope = new Set(named);
  const unit: Family | undefined = token.kind === 'duration' ? 'duration' : s.unit;
  const owner = unit === undefined ? undefined : SINGLE_OWNER[unit];
  if (owner !== undefined) {
    const borrows = [...named].some((m) => (RELATED[m] ?? []).includes(owner) && !inFamily.some((a) => a.metric === m));
    if (borrows) scope.add(owner);
  }
  return inFamily.filter((a) => !a.metric || scope.has(a.metric));
}

function isKnown(s: Scanned, allowed: Allowed[], named: ReadonlySet<Metric>): boolean {
  const { token } = s;
  const candidates = candidatesFor(s, allowed, named);
  // A hedged approximation ("about 7 hours" for 6h 48m) may be within 10% of a value.
  const hedge = (a: number) => (token.hedged ? Math.abs(a) * HEDGE_TOLERANCE : 0);
  if (token.kind === 'duration') {
    return candidates.some(({ value: a }) => Math.abs(token.minutes - a) <= Math.max(1, a * 0.01, hedge(a)));
  }
  const tolerance = (a: number) => Math.max(Number.isInteger(token.value) ? 1 : Math.max(0.05, Math.abs(a) * 0.01), hedge(a));
  return candidates.some(({ value: a }) => Math.abs(token.value - a) <= tolerance(a));
}

const WEEKDAY = String.raw`(?:mon|tues|wednes|thurs|fri|satur|sun)day`;
/** "night" as a time or window, or in a suggestion, rather than the night's sleep. */
const NIGHT_NOT_SLEEP_RE = new RegExp(
  [
    String.raw`\b(?:last|past|this|that|each|every|per|tomorrow|the\s+other|at)\s+(?:\d+\s+)?nights?\b`,
    String.raw`\b(?:on\s+)?${WEEKDAY}\s+nights?\b`,
    String.raw`\b\d+[-\s]nights?\b`,
    String.raw`\bnights?\s+(?:ago|before)\b`,
    String.raw`\b(?:early|earlier)\s+night\b`,
  ].join('|'),
  'g',
);

/** The metrics a sentence names (the eval's attribution check reads it too, so the two always agree). */
export function namedMetrics(sentence: string): Set<Metric> {
  let s = sentence.toLowerCase();
  const found = new Set<Metric>();
  const take = (re: RegExp, metric: Metric) => {
    if (re.test(s)) {
      found.add(metric);
      s = s.replace(re, ' ');
    }
  };
  take(/\bsleep\s+scores?\b/g, 'sleep_score');
  take(/\bhrv\b|\bheart\s+rate\s+variability\b/g, 'hrv');
  take(/\brhr\b|\bresting\s+(?:hr|heart(?:\s+rate)?)\b/g, 'rhr');
  take(/\brecovery\b/g, 'recovery');
  // "night" names sleep ("A short night (6h 48m) pulled your HRV down to 41"), except as a time or
  // window ("last night", "past 7 nights", "30-night") or a suggestion ("an early night").
  s = s.replace(NIGHT_NOT_SLEEP_RE, ' ');
  take(/\b(?:sleep|sleeping|slept|asleep|nights?)\b/g, 'sleep');
  take(/\bsteps\b/g, 'steps');
  return found;
}

// ---- general-route allowance --------------------------------------------

/** A sentence stating a number ABOUT the user: never a general-knowledge figure. */
const USER_CLAIM_RE =
  /\b(you|you've|you're)\s+(slept|got|had|walked|logged|averaged|scored|hit|reached|were|are at)\b|\byour\s+(recovery|sleep|hrv|heart|resting|rhr|steps?|scores?|readings?|average|numbers?|data|bedtime|night|week|month)\b/i;
/** A time word that ties a number to the user's own days. */
const USER_TIME_RE = /\b(last\s+night|tonight|today|yesterday|this\s+(morning|week|month)|last\s+week)\b/i;
/** Scores only the user has: any number near them is the user's. */
const USER_SCORE_RE = /\b(recovery|sleep\s+scores?)\b/i;
const YOU_WORDS = new Set(['you', "you've", "you're", 'your', 'yours', "you'd", "you'll", 'yourself']);
/** How many words apart "you"/"your" and a number may be for the number to be about the user. */
const YOU_NUMBER_WORDS = 4;

function youNearNumber(text: string): boolean {
  const words = text.replace(/[‘’]/g, "'").split(/\s+/);
  const you: number[] = [];
  const numbers: number[] = [];
  words.forEach((w, i) => {
    if (YOU_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, ''))) you.push(i);
    if (/\d/.test(w)) numbers.push(i);
  });
  return you.some((y) => numbers.some((n) => Math.abs(y - n) <= YOU_NUMBER_WORDS));
}

function isAboutUser(sentence: string): boolean {
  const text = wordsToDigits(sentence);
  return USER_CLAIM_RE.test(text) || USER_TIME_RE.test(text) || USER_SCORE_RE.test(text) || youNearNumber(text);
}

// ---- topics and verdict -------------------------------------------------

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
  const scanned = scanNumbers(sentence);
  if (scanned.length === 0) return { ok: true };
  const allowed = allowedFor(sheet);
  const named = namedMetrics(sentence);
  if (scanned.every((s) => isKnown(s, allowed, named))) return { ok: true };
  // General knowledge ("most adults need 7–9 hours") only on the general route, and never about the user.
  if (sheet.route === 'general' && !isAboutUser(sentence)) return { ok: true };
  return { ok: false, reason: 'unknown_number' };
}

// ---- card ---------------------------------------------------------------

export const MAX_TILES = 4;
export const MAX_RANKED = 5;
const MAX_HEADLINE_CHARS = 120;
const MAX_LABEL_CHARS = 32;
const MAX_TIP_CHARS = 200;

/**
 * What a card's numbers come from, per route: the window its sheet covers.
 * Set by the app, never the model, which made up vague ones ("Wellness App
 * Data", "Sleep tracking data").
 */
export const CARD_SOURCE: Record<AnswerRoute, string> = {
  today: 'Today',
  sleep: 'Last night and your past 7 nights',
  trends: 'Your last 30 days',
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
    const delta = deltaDisplayOf(fact);
    if (delta) row.deltaDisplay = delta;
    out.push(row);
    if (out.length === max) break;
  }
  return out;
}

/**
 * Schema-checks the model's card and fills every value from the fact sheet;
 * the source label comes from the route (CARD_SOURCE).
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

  // Any model-written source is ignored (R18).
  const card: AnswerCard = { headline, source: CARD_SOURCE[sheet.route] };
  if (tiles.length > 0) card.tiles = tiles;
  else card.ranked = ranked;
  const tip = cleanText(raw.tip, MAX_TIP_CHARS, sheet);
  if (tip !== null) card.tip = tip;
  return card;
}
