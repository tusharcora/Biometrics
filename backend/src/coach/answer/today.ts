// The Coach page's picture of today (spec 2026-09-30 sections 1.2 and 4): four
// "today vs usual" bars and one sentence. The bars and the template sentence
// are built from the `today` fact sheet by code, so they are always available
// and always agree with each other; the AI sentence is an optional upgrade
// written by the user's engine and validated like a reply.

import type { CardStatus } from './card';
import { statusOf } from './card';
import type { Fact, FactSheet, FactUnit } from './facts';
import { formatValue } from './facts';

export type TodayMetric = 'recovery' | 'sleep' | 'hrv' | 'rhr';

/** The fact-sheet ids the bars read (phase 1's `today` route must emit these). */
export const TODAY_FACT_IDS: Record<TodayMetric, string> = {
  recovery: 'recovery.today',
  sleep: 'sleep.total',
  hrv: 'hrv.today',
  rhr: 'rhr.today',
};

const METRICS: TodayMetric[] = ['recovery', 'sleep', 'hrv', 'rhr'];
const LABELS: Record<TodayMetric, string> = { recovery: 'Recovery', sleep: 'Sleep', hrv: 'HRV', rhr: 'Resting HR' };
/** How a metric is named mid-sentence. */
const MID_SENTENCE: Record<TodayMetric, string> = { recovery: 'recovery', sleep: 'sleep', hrv: 'HRV', rhr: 'resting HR' };

export interface TodaySpan {
  text: string;
  metric?: TodayMetric;
}

export interface TodaySentence {
  text: string;
  spans: TodaySpan[];
}

export interface TodayBar {
  metric: TodayMetric;
  label: string;
  value: number;
  usual: number | null;
  unit: FactUnit;
  display: string;
  usualDisplay: string | null;
  status: CardStatus | null;
  scaleMax: number;
}

export interface TodaySummaryDTO {
  date: string;
  hasData: boolean;
  sentence: (TodaySentence & { source: 'ai' | 'template' }) | null;
  bars: TodayBar[];
}

function factFor(sheet: FactSheet, metric: TodayMetric): Fact | undefined {
  return sheet.facts.find((f) => f.id === TODAY_FACT_IDS[metric]);
}

/** Recovery 0-100; the others 0 -> 1.4 x the larger of value and usual, rounded up to a whole unit. */
function scaleFor(metric: TodayMetric, value: number, usual: number | null): number {
  if (metric === 'recovery') return 100;
  return Math.ceil(1.4 * Math.max(value, usual ?? value));
}

export function buildBars(sheet: FactSheet): TodayBar[] {
  const bars: TodayBar[] = [];
  for (const metric of METRICS) {
    const fact = factFor(sheet, metric);
    if (!fact) continue;
    const usual = fact.usual ?? null;
    bars.push({
      metric,
      label: LABELS[metric],
      value: fact.value,
      usual,
      unit: fact.unit,
      display: fact.display,
      usualDisplay: usual === null ? null : formatValue(fact.unit, usual),
      status: statusOf(fact) ?? null,
      scaleMax: scaleFor(metric, fact.value, usual),
    });
  }
  return bars;
}

function relativeGap(bar: TodayBar): number {
  return bar.usual ? Math.abs(bar.value - bar.usual) / Math.abs(bar.usual) : 0;
}

/** "Sleep", "Sleep and HRV", "Sleep, HRV and resting HR". */
function nameList(bars: TodayBar[]): string {
  const names = bars.map((b, i) => (i === 0 ? LABELS[b.metric] : MID_SENTENCE[b.metric]));
  if (names.length === 1) return `${names[0]} is close to usual.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are both close to usual.`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are all close to usual.`;
}

/**
 * "Recovery {v}, {below|near|above} your usual {u}. {largest driver sentence}."
 * The driver is the metric furthest from its usual, preferring one that moved
 * the same way as recovery (it is the likely "why").
 */
export function templateSentence(sheet: FactSheet): TodaySentence {
  const bars = buildBars(sheet);
  if (bars.length === 0) return { text: '', spans: [] };
  const spans: TodaySpan[] = [];
  const lead = bars[0]!;

  if (lead.metric === 'recovery' && lead.usual !== null && lead.status !== null) {
    spans.push({ text: `Recovery ${lead.display}`, metric: 'recovery' }, { text: `, ${lead.status} your usual ${lead.usualDisplay}.` });
  } else {
    spans.push({ text: `${lead.label} ${lead.display}`, metric: lead.metric }, { text: ' today.' });
  }

  const others = bars.slice(1).filter((b) => b.usual !== null && b.usual !== 0 && b.status !== null);
  const moved = others.filter((b) => b.status !== 'near');
  const sameWay = lead.metric === 'recovery' && lead.status !== 'near' ? moved.filter((b) => b.status === lead.status) : [];
  const pool = sameWay.length > 0 ? sameWay : moved;
  const driver = pool.reduce<TodayBar | null>((best, b) => (best === null || relativeGap(b) > relativeGap(best) ? b : best), null);

  if (driver) {
    const lower = driver.value < driver.usual!;
    const word = driver.metric === 'sleep' ? (lower ? 'shorter' : 'longer') : lower ? 'lower' : 'higher';
    spans[spans.length - 1]!.text += ' ';
    spans.push(
      { text: `${driver.label} ${driver.display}`, metric: driver.metric },
      { text: ` is ${word} than your usual ${driver.usualDisplay}.` },
    );
  } else if (others.length > 0) {
    spans[spans.length - 1]!.text += ` ${nameList(others)}`;
  }
  return { text: spans.map((s) => s.text).join(''), spans };
}

const METRIC_WORDS: Array<[TodayMetric, RegExp]> = [
  ['recovery', /\brecovery\b/i],
  ['sleep', /\b(sleep|slept)\b/i],
  ['hrv', /\bHRV\b/i],
  ['rhr', /\bresting (heart rate|HR)\b/i],
];

/** Tappable spans for a model-written sentence: the first mention of each metric. */
export function spansFor(text: string): TodaySpan[] {
  const hits = METRIC_WORDS.map(([metric, re]) => {
    const m = re.exec(text);
    return m ? { metric, start: m.index, end: m.index + m[0].length } : null;
  })
    .filter((h): h is { metric: TodayMetric; start: number; end: number } => h !== null)
    .sort((a, b) => a.start - b.start);

  const spans: TodaySpan[] = [];
  let at = 0;
  for (const hit of hits) {
    if (hit.start < at) continue; // overlaps an earlier mention
    if (hit.start > at) spans.push({ text: text.slice(at, hit.start) });
    spans.push({ text: text.slice(hit.start, hit.end), metric: hit.metric });
    at = hit.end;
  }
  if (at < text.length) spans.push({ text: text.slice(at) });
  return spans;
}
