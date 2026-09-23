// Reference hints for the one regenerate. A local model reads the tool
// results, then often copies a value ("down 8%") instead of writing its
// {{reference}}. The guardrail rightly rejects that (a copied number and an
// invented one look the same), but a generic "use references" retry kept
// failing the same way. This finds, for each number the model wrote outside a
// reference, the tool-result fields that actually hold it, so the retry can
// say exactly which reference to write. It never suggests anything that is not
// in this turn's results, so an invented number gets no hint at all, and it
// does not loosen the guardrail: the retry is validated exactly as before.

import type { TurnToolResult } from './grounding';

const REF_RE = /\{\{[^{}]*\}\}/g;
// A number as written in prose: 8, 1,748, 62.2, optionally a trailing %.
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?%?/g;
const MAX_LITERALS = 4;
const MAX_REFS_PER_LITERAL = 2;

export interface ReferenceHint {
  literal: string;
  references: string[];
}

interface Leaf {
  path: string;
  value: string | number;
}

// ISO dates ("2026-09-17") are storage keys, not something to show; dateLabel is.
const SKIP_KEYS = new Set(['date', 'from', 'to']);

function leavesOf(node: unknown, path: string, out: Leaf[]): void {
  if (typeof node === 'string' || (typeof node === 'number' && Number.isFinite(node))) {
    out.push({ path, value: node });
  } else if (Array.isArray(node)) {
    node.forEach((child, i) => leavesOf(child, `${path}[${i}]`, out));
  } else if (node !== null && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (!SKIP_KEYS.has(key)) leavesOf(child, `${path}.${key}`, out);
    }
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `value` holds `literal` as a whole number (so "8" does not match "78.1"). */
function holds(value: string | number, literal: string): boolean {
  if (typeof value === 'number') {
    const plain = literal.replace(/[,%]/g, '');
    return String(Math.abs(value)) === plain || String(value) === plain;
  }
  return new RegExp(`(?<![\\d.,])${escapeRe(literal)}(?![\\d])`).test(value);
}

export function suggestReferences(raw: string, results: readonly TurnToolResult[]): ReferenceHint[] {
  // References read the most recent call of a tool, so only that one is offered.
  const latest = new Map<string, unknown>();
  for (const r of results) latest.set(r.name, r.result);
  const leaves: Leaf[] = [];
  for (const [name, result] of latest) leavesOf(result, name, leaves);

  const prose = raw.replace(REF_RE, ' ');
  const literals = [...new Set(prose.match(NUMBER_RE) ?? [])].slice(0, MAX_LITERALS);

  const hints: ReferenceHint[] = [];
  for (const literal of literals) {
    const matching = leaves.filter((leaf) => holds(leaf.value, literal));
    // Ready-to-read strings when any match (they carry units and signs correctly:
    // a raw trendPercent of -8 would render "-8"), else raw numbers; shorter paths first.
    const strings = matching.filter((leaf) => typeof leaf.value === 'string');
    const matches = (strings.length > 0 ? strings : matching)
      .sort((a, b) => a.path.length - b.path.length)
      .slice(0, MAX_REFS_PER_LITERAL)
      .map((leaf) => `{{${leaf.path}}}`);
    if (matches.length > 0) hints.push({ literal, references: matches });
  }
  return hints;
}

// A display value worth matching verbatim: it has a digit AND a unit, sign word
// or % ("4h 30m", "69.0 ms", "8,331 steps", "down 8%", "115%"). Bare numbers
// ("4", "52") are excluded on purpose: a small integer in prose matches too many
// unrelated fields to prove where it came from.
const DISPLAY_VALUE_RE = /\d.*[a-z%]|[a-z].*\d/i;

/**
 * Replaces each exact copy of a unit-bearing display value from this turn's
 * tool results with its {{reference}}, before validation. Such a phrase is
 * grounded by construction (it IS a value the tools returned this turn), so
 * this only stops the guardrail rejecting a correct answer because the model
 * copied "down 8%" instead of writing {{getMetricHistory.trendDisplay}}. An
 * invented or altered value matches nothing and is still rejected; bare
 * numbers are never matched. Longest values first, so "2h 25m less than the
 * night before" wins over "2h 25m".
 */
export function referenceCopiedValues(raw: string, results: readonly TurnToolResult[]): string {
  const latest = new Map<string, unknown>();
  for (const r of results) latest.set(r.name, r.result);
  const leaves: Leaf[] = [];
  for (const [name, result] of latest) leavesOf(result, name, leaves);

  const byValue = new Map<string, string>();
  for (const leaf of leaves) {
    if (typeof leaf.value !== 'string' || !DISPLAY_VALUE_RE.test(leaf.value)) continue;
    if (!byValue.has(leaf.value)) byValue.set(leaf.value, leaf.path);
  }
  const values = [...byValue.keys()].sort((a, b) => b.length - a.length);
  if (values.length === 0) return raw;

  // Only prose is rewritten; existing {{references}} are left untouched.
  return raw
    .split(/(\{\{[^{}]*\}\})/)
    .map((segment) => {
      if (segment.startsWith('{{')) return segment;
      let out = segment;
      for (const value of values) {
        const re = new RegExp(`(?<![\\w.,])${escapeRe(value)}(?![\\w])`, 'gi');
        out = out.replace(re, `{{${byValue.get(value)}}}`);
      }
      return out;
    })
    .join('');
}
