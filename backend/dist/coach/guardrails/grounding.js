"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReference = parseReference;
exports.resolveReferences = resolveReferences;
exports.hasUnwrappedDigit = hasUnwrappedDigit;
exports.validateReply = validateReply;
const TOOL_RE = /^[A-Za-z][A-Za-z0-9_]*/;
const FIELD_RE = /^\.([A-Za-z_][A-Za-z0-9_]*)/;
const INDEX_RE = /^\[(\d{1,3})\]/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function parseReference(raw) {
    let rest = raw.trim();
    const tool = TOOL_RE.exec(rest)?.[0];
    if (!tool)
        return null;
    rest = rest.slice(tool.length);
    const path = [];
    while (rest.length > 0) {
        const field = FIELD_RE.exec(rest);
        if (field) {
            if (FORBIDDEN_KEYS.has(field[1]))
                return null;
            path.push(field[1]);
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
function lookup(results, ref) {
    const forTool = results.filter((r) => r.name === ref.tool);
    // A reference still reads the most recent call of that tool, which is fine
    // while every call asked the same question. When the model has called the
    // same tool with different arguments in one turn -- getDailyScore for today
    // AND for a day it wanted to compare against -- "the most recent" is a
    // coin flip, and the reference resolves to a real number from the wrong day
    // with nothing to notice it. Refuse instead: an unresolved reference is an
    // invalid_field_path, which regenerates the reply rather than shipping a
    // confidently wrong figure.
    // Only calls whose arguments were actually recorded can be compared. The
    // turn preamble is a getDailyScore for today recorded without args, so it
    // must not look "different" from the model asking for the same thing.
    const recordedArgs = forTool.filter((r) => r.args !== undefined).map((r) => JSON.stringify(r.args));
    if (new Set(recordedArgs).size > 1)
        return undefined;
    const latest = forTool[forTool.length - 1];
    let node = latest?.result;
    for (const seg of ref.path) {
        if (typeof seg === 'number') {
            if (!Array.isArray(node) || seg >= node.length)
                return undefined;
            node = node[seg];
        }
        else {
            // Own properties only: `length`, `toString` etc. are not tool-result fields.
            if (typeof node !== 'object' || node === null || Array.isArray(node) || !Object.prototype.hasOwnProperty.call(node, seg)) {
                return undefined;
            }
            node = node[seg];
        }
    }
    if (typeof node === 'string' || typeof node === 'boolean')
        return node;
    if (typeof node === 'number' && Number.isFinite(node))
        return node;
    return undefined;
}
const REF_RE = /\{\{([^{}]*)\}\}/g;
function resolveReferences(raw, results) {
    let out = '';
    let last = 0;
    const spans = [];
    const invalid = [];
    const invalidSpans = [];
    for (const m of raw.matchAll(REF_RE)) {
        const start = m.index;
        out += raw.slice(last, start);
        last = start + m[0].length;
        const ref = parseReference(m[1]);
        const value = ref ? lookup(results, ref) : undefined;
        if (value === undefined) {
            // Left verbatim (never shown: the reply is rejected) so a leftover is visible in logs as a path, not text.
            invalid.push(m[1]);
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
const EXEMPT_PATTERNS = [
    // A list marker at the start of a line: "1. Sleep earlier tonight."
    /^\s*\d{1,2}[.)]\s/gm,
    // A clock time with an explicit meridiem. The trailing lookahead stops "5 amazing" matching as "5 am".
    /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(a\.?m\.?|p\.?m\.?)(?![A-Za-z])/gi,
    // A month name followed by a day: "March 14".
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?\b/g,
    // An ordinal: "the 14th".
    /\b\d{1,2}(st|nd|rd|th)\b/g,
];
function exemptSpans(text) {
    const spans = [];
    for (const re of EXEMPT_PATTERNS) {
        for (const m of text.matchAll(re))
            spans.push([m.index, m.index + m[0].length]);
    }
    return spans;
}
/** True when `text` holds a digit (any Unicode decimal digit) outside every allowed span. */
function hasUnwrappedDigit(text, groundedSpans) {
    const allowed = [...groundedSpans, ...exemptSpans(text)];
    const digit = /\p{Nd}/gu;
    for (const m of text.matchAll(digit)) {
        const i = m.index;
        if (!allowed.some(([s, e]) => i >= s && i < e))
            return true;
    }
    return false;
}
/** Any "{{" or "}}" left outside a resolved value: a malformed or unterminated reference. */
function hasStrayBraces(text, groundedSpans) {
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
function validateReply(raw, results) {
    if (raw.trim().length === 0)
        return { ok: false, reasons: ['empty_reply'] };
    const resolved = resolveReferences(raw, results);
    const reasons = [];
    // A reference to a path that is not in this turn's results is treated exactly
    // like an unwrapped number: rejected, never rendered "close enough".
    if (resolved.invalid.length > 0 || hasStrayBraces(resolved.text, resolved.spans))
        reasons.push('invalid_field_path');
    if (hasUnwrappedDigit(resolved.text, [...resolved.spans, ...resolved.invalidSpans]))
        reasons.push('unwrapped_number');
    return reasons.length > 0 ? { ok: false, reasons } : { ok: true, text: resolved.text };
}
//# sourceMappingURL=grounding.js.map