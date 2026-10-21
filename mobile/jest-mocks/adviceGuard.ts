// The no-health-advice guard for app copy (spec 2026-10-15 §8.3, P3 ruling 18, PF4-F17), shared by the copy tests.

/**
 * Every string under a copy object, with each function called on sample arguments: a name first or a number first,
 * at 0, 1 and 7, so every branch (awardCount's none, one and many) is read.
 */
const SAMPLE_ARGS: readonly (readonly unknown[])[] = [0, 1, 7].flatMap((n) => [['fern', n, n], [n, n, n]]);
export function copyStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return SAMPLE_ARGS.flatMap((a) => copyStrings((v as (...a: unknown[]) => unknown)(...a)));
  if (v && typeof v === 'object') return Object.values(v).flatMap(copyStrings);
  return [];
}
export const ADVICE = /\b(should|try|more|need|needs|must)\b/i;
// Health verbs that open a sentence. "Move" and "Store" are the room's own buttons (moving furniture is no advice).
export const HEALTH_VERB = /(^|[.!?:]\s+)(sleep|walk|drink|rest|exercise|go|get|hit|reach|eat)\b/i;
export const advises = (s: string) => ADVICE.test(s) || HEALTH_VERB.test(s);
