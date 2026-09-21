// The framing carried from Phase 1's metricInsights.ts: every coach reply ends
// with it, added by the server, never left to the model to remember (spec
// section 4, last bullet).

export const COACH_DISCLAIMER =
  'This is a comparison against your own recent readings, not a medical assessment.';

export function withDisclaimer(text: string): string {
  return `${text.trimEnd()}\n\n${COACH_DISCLAIMER}`;
}

/** Inverse of withDisclaimer, used when replaying stored replies to the model as history. */
export function stripDisclaimer(text: string): string {
  return text.endsWith(COACH_DISCLAIMER) ? text.slice(0, -COACH_DISCLAIMER.length).trimEnd() : text;
}
