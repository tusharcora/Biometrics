// Number-attribution checker. The runtime validator (answer/validate.ts)
// accepts a number that appears ANYWHERE on the fact sheet, so "your HRV is 58
// ms" passes when 58 is the usual Recovery score: every number is real, but it
// is pinned on the wrong metric. The eval catches that class: a sentence that
// names exactly one metric may only use numbers from that metric's own facts
// (same tolerance, units and hedging rules as the runtime check, which it
// reuses on a sheet cut down to that metric). Sentences naming no metric or
// several are not judged. Only run on fixtures that opt in.

import type { FactSheet } from '../../src/coach/answer/facts';
import { extractNumbers, validateSentence } from '../../src/coach/answer/validate';

const METRICS: Array<{ name: string; mention: RegExp; factPrefixes: string[] }> = [
  { name: 'recovery', mention: /\brecovery\b/i, factPrefixes: ['recovery.'] },
  { name: 'hrv', mention: /\bhrv\b|heart rate variability/i, factPrefixes: ['hrv.'] },
  { name: 'resting heart rate', mention: /resting heart rate|\bresting hr\b|\brhr\b/i, factPrefixes: ['rhr.'] },
  { name: 'sleep', mention: /\bsle(?:ep|pt)\b/i, factPrefixes: ['sleep.', 'sleep_score.'] },
  { name: 'steps', mention: /\bsteps?\b/i, factPrefixes: ['steps.'] },
];

export interface AttributionProblem {
  sentence: string;
  metric: string;
}

export function checkAttribution(sentences: readonly string[], sheet: FactSheet): { ok: boolean; problems: AttributionProblem[] } {
  const problems: AttributionProblem[] = [];
  for (const sentence of sentences) {
    const named = METRICS.filter((m) => m.mention.test(sentence));
    if (named.length !== 1 || extractNumbers(sentence).length === 0) continue;
    const metric = named[0]!;
    const own: FactSheet = {
      route: 'today', // never the general route: no general-knowledge allowance here
      facts: sheet.facts.filter((f) => metric.factPrefixes.some((p) => f.id.startsWith(p))),
      notes: [],
    };
    if (!validateSentence(sentence, own).ok) problems.push({ sentence, metric: metric.name });
  }
  return { ok: problems.length === 0, problems };
}
