// The answer card (spec 2026-09-30, sections 1.3 and 2.3). The model only
// names fact ids and short labels; the server fills every displayed value from
// the fact sheet (resolveCard in validate.ts), so a card can never show a
// number the user does not have.

import type { Fact } from './facts';

export type CardStatus = 'below' | 'near' | 'above';

export interface CardItem {
  factId: string;
  label: string;
  display: string;
  value: number;
  usual?: number;
  status?: CardStatus;
}

export interface AnswerCard {
  headline: string;
  tiles?: CardItem[];
  ranked?: CardItem[];
  tip?: string;
  source: string;
}

/** Within this fraction of the usual, either side, a value reads as "near" usual. */
export const NEAR_BAND = 0.1;

/**
 * ±10% of usual = near; otherwise below/above, inverted when lower is better (resting HR).
 * Counts (steps) get no status, matching the fact sheet, which renders no
 * comparison for them: today's count builds up through the day, so a morning
 * total would always read as below usual.
 */
export function statusOf(fact: Fact): CardStatus | undefined {
  if (fact.usual === undefined || fact.usual === 0 || fact.unit === 'count') return undefined;
  const ratio = (fact.value - fact.usual) / Math.abs(fact.usual);
  if (Math.abs(ratio) <= NEAR_BAND + 1e-9) return 'near';
  const higher = ratio > 0;
  return higher !== Boolean(fact.lowerIsBetter) ? 'above' : 'below';
}
