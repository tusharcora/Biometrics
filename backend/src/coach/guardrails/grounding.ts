// Post-response numeric grounding (spec section 4). The model states measured
// quantities only through references; the server resolves them against THIS
// turn's tool results and then scans the resolved text for any digit that is
// neither inside a resolved value nor inside one of a small closed set of
// exempt shapes. Reject-and-regenerate, never strip-and-patch: nothing here
// edits model output to make it pass.
//
// Reference grammar (documented for the system prompt and the eval fixtures):
//
//   reference := "{{" toolName ( "." field | "[" index "]" )+ "}}"
//   toolName  := [A-Za-z][A-Za-z0-9_]*          e.g. getDailyScore
//   field     := [A-Za-z_][A-Za-z0-9_]*         e.g. recoveryScore
//   index     := [0-9]{1,3}                     e.g. factors[0]
//
//   {{getDailyScore.recoveryScore}}
//   {{getDailyScore.factors[0].points}}
//   {{getHabitCorrelations.correlations[0].effectSizePercent}}
//
// A reference reads the MOST RECENT call of that tool in the turn (the turn
// preamble counts as a getDailyScore call). It must land on a string, finite
// number or boolean; a missing path, null, object or array is an invalid path.

export interface TurnToolResult {
  name: string;
  result: unknown;
}

export type GuardrailReason = 'unwrapped_number' | 'invalid_field_path' | 'empty_reply';

export type GroundingVerdict = { ok: true; text: string } | { ok: false; reasons: GuardrailReason[] };

export type PathSegment = string | number;

export interface ParsedReference {
  tool: string;
  path: PathSegment[];
}

const TOOL_RE = /^[A-Za-z][A-Za-z0-9_]*/;
const FIELD_RE = /^\.([A-Za-z_][A-Za-z0-9_]*)/;
const INDEX_RE = /^\[(\d{1,3})\]/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function parseReference(raw: string): ParsedReference | null {
  let rest = raw.trim();
  const tool = TOOL_RE.exec(rest)?.[0];
  if (!tool) return null;
  rest = rest.slice(tool.length);
  const path: PathSegment[] = [];
  while (rest.length > 0) {
    const field = FIELD_RE.exec(rest);
    if (field) {
      if (FORBIDDEN_KEYS.has(field[1]!)) return null;
      path.push(field[1]!);
      rest = rest.slice(field[0].length);
      continue;
    }
    const index = INDEX_RE.exec(rest);
    if (index) {
      path.push(Number(index[1]));
      rest = rest.slice(index[0].length);
      continue;
    }
    return null;
  }
  return path.length > 0 ? { tool, path } : null;
}

type Primitive = string | number | boolean;

function lookup(results: readonly TurnToolResult[], ref: ParsedReference): Primitive | undefined {
  let latest: TurnToolResult | undefined;
  for (const r of results) if (r.name === ref.tool) latest = r;
  let node: unknown = latest?.result;
  for (const seg of ref.path) {
    if (typeof seg === 'number') {
      if (!Array.isArray(node) || seg >= node.length) return undefined;
      node = node[seg];
    } else {
      // Own properties only: `length`, `toString` etc. are not tool-result fields.
      if (typeof node !== 'object' || node === null || Array.isArray(node) || !Object.prototype.hasOwnProperty.call(node, seg)) {
        return undefined;
      }
      node = (node as Record<string, unknown>)[seg];
    }
  }
  if (typeof node === 'string' || typeof node === 'boolean') return node;
  if (typeof node === 'number' && Number.isFinite(node)) return node;
  return undefined;
}

export interface Resolution {
  text: string;
  /** [start, end) offsets into `text` of each resolved value; digits inside them are grounded. */
  spans: Array<[number, number]>;
  /** The raw content of every reference that did not resolve. */
  invalid: string[];
  /** Where those unresolved references sit in `text`; already rejected, so their own digits are not double-counted. */
  invalidSpans: Array<[number, number]>;
}

const REF_RE = /\{\{([^{}]*)\}\}/g;

export function resolveReferences(raw: string, results: readonly TurnToolResult[]): Resolution {
  let out = '';
  let last = 0;
  const spans: Array<[number, number]> = [];
  const invalid: string[] = [];
  const invalidSpans: Array<[number, number]> = [];
  for (const m of raw.matchAll(REF_RE)) {
    const start = m.index!;
    out += raw.slice(last, start);
    last = start + m[0].length;
    const ref = parseReference(m[1]!);
    const value = ref ? lookup(results, ref) : undefined;
    if (value === undefined) {
      // Left verbatim (never shown: the reply is rejected) so a leftover is visible in logs as a path, not text.
      invalid.push(m[1]!);
      invalidSpans.push([out.length, out.length + m[0].length]);
      out += m[0];
      continue;
    }
    const rendered = String(value);
    spans.push([out.length, out.length + rendered.length]);
    out += rendered;
  }
  out += raw.slice(last);
  return { text: out, spans, invalid, invalidSpans };
}

// ---- digit scan -----------------------------------------------------------

// Exempt shapes, each matched as a complete span. Digits inside one are
// ignored; digits outside every one are still scanned, so "10pm for 8 hours"
// is rejected for the "8". Deliberately NOT exempt: bare counts, unit-suffixed
// values, percentages, decimals, ratios ("7/10"), numeric slash dates ("3/14")
// and a bare h:mm ("7:32", indistinguishable from a duration).
const EXEMPT_PATTERNS: RegExp[] = [
  // A list marker at the start of a line: "1. Sleep earlier tonight."
  /^\s*\d{1,2}[.)]\s/gm,
  // A clock time with an explicit meridiem. The trailing lookahead stops "5 amazing" matching as "5 am".
  /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(a\.?m\.?|p\.?m\.?)(?![A-Za-z])/gi,
  // A month name followed by a day: "March 14".
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b/g,
  // An ordinal: "the 14th".
  /\b\d{1,2}(st|nd|rd|th)\b/g,
];

function exemptSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const re of EXEMPT_PATTERNS) {
    for (const m of text.matchAll(re)) spans.push([m.index!, m.index! + m[0].length]);
  }
  return spans;
}

/** True when `text` holds a digit (any Unicode decimal digit) outside every allowed span. */
export function hasUnwrappedDigit(text: string, groundedSpans: ReadonlyArray<[number, number]>): boolean {
  const allowed = [...groundedSpans, ...exemptSpans(text)];
  const digit = /\p{Nd}/gu;
  for (const m of text.matchAll(digit)) {
    const i = m.index!;
    if (!allowed.some(([s, e]) => i >= s && i < e)) return true;
  }
  return false;
}

/** Any "{{" or "}}" left outside a resolved value: a malformed or unterminated reference. */
function hasStrayBraces(text: string, groundedSpans: ReadonlyArray<[number, number]>): boolean {
  let masked = '';
  let last = 0;
  for (const [s, e] of [...groundedSpans].sort((a, b) => a[0] - b[0])) {
    masked += text.slice(last, s);
    last = e;
  }
  masked += text.slice(last);
  return /\{\{|\}\}/.test(masked);
}

/**
 * Validates one buffered model reply as a unit. On success returns the RESOLVED
 * text (the only thing that may reach the client); on failure returns every
 * reason so the orchestrator can log them distinctly.
 */
export function validateReply(raw: string, results: readonly TurnToolResult[]): GroundingVerdict {
  if (raw.trim().length === 0) return { ok: false, reasons: ['empty_reply'] };
  const resolved = resolveReferences(raw, results);
  const reasons: GuardrailReason[] = [];
  // A reference to a path that is not in this turn's results is treated exactly
  // like an unwrapped number: rejected, never rendered "close enough".
  if (resolved.invalid.length > 0 || hasStrayBraces(resolved.text, resolved.spans)) reasons.push('invalid_field_path');
  if (hasUnwrappedDigit(resolved.text, [...resolved.spans, ...resolved.invalidSpans])) reasons.push('unwrapped_number');
  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, text: resolved.text };
}
