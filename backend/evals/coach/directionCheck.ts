// Directional-claim checker (spec section 4, claim-grounding scope boundary).
//
// The runtime guardrail grounds VALUES, not comparative claims: a reply reading
// "your recovery is {{getDailyScore.recoveryScore}}, higher than yesterday"
// passes it even when the grounded direction is 'lower'. The spec assigns that
// class of error to the eval harness, and this is the eval's checker.
//
// Given the final, resolved reply and the `direction` value the model was
// actually handed ('higher' | 'lower' | 'unchanged'), it finds directional words
// (whole words, case-insensitive) and reports any that contradict it:
//
//   grounded 'higher'    -> any DOWN word or FLAT word contradicts
//   grounded 'lower'     -> any UP word or FLAT word contradicts
//   grounded 'unchanged' -> any UP word or DOWN word contradicts
//
// A reply that quotes the field (writes {{getDailyScore.direction}}, which
// resolves to "higher"/"lower"/"unchanged") passes; so does prose that happens to
// agree with it. Deliberately simple and conservative for the eval's purposes:
// it is a lexicon check, not a claim-verification model, so fixtures must keep
// directional language unambiguous (no "lower stress", no negations such as
// "not lower"). It is only ever run on fixtures that opt in.

import { COACH_DISCLAIMER } from '../../src/coach/guardrails/disclaimer';
import type { Direction } from './types';

type Sense = 'up' | 'down' | 'flat';

const LEXICON: Record<Sense, string[]> = {
  up: ['higher', 'up', 'increase', 'increased', 'increasing', 'rose', 'risen', 'rise', 'rising', 'better', 'improved', 'improving', 'improvement', 'climbed', 'gained', 'above', 'jumped', 'boosted', 'stronger'],
  down: ['lower', 'down', 'decrease', 'decreased', 'decreasing', 'dropped', 'drop', 'fell', 'fallen', 'falling', 'declined', 'decline', 'worse', 'dipped', 'dip', 'slipped', 'below', 'weaker', 'reduced'],
  flat: ['unchanged', 'same', 'steady', 'flat', 'stable'],
};

const SENSE_OF = new Map<string, Sense>();
for (const sense of Object.keys(LEXICON) as Sense[]) for (const w of LEXICON[sense]) SENSE_OF.set(w, sense);

export interface DirectionalClaim {
  word: string;
  sense: Sense;
}

export interface DirectionCheck {
  ok: boolean;
  claims: DirectionalClaim[];
  contradictions: DirectionalClaim[];
}

const AGREES: Record<Direction, Sense> = { higher: 'up', lower: 'down', unchanged: 'flat' };

export function extractDirectionalClaims(text: string): DirectionalClaim[] {
  const body = text.endsWith(COACH_DISCLAIMER) ? text.slice(0, -COACH_DISCLAIMER.length) : text;
  const claims: DirectionalClaim[] = [];
  for (const m of body.toLowerCase().matchAll(/[a-z]+/g)) {
    const sense = SENSE_OF.get(m[0]);
    if (sense) claims.push({ word: m[0], sense });
  }
  return claims;
}

export function checkDirectionalClaims(text: string, grounded: Direction): DirectionCheck {
  const claims = extractDirectionalClaims(text);
  const contradictions = claims.filter((c) => c.sense !== AGREES[grounded]);
  return { ok: contradictions.length === 0, claims, contradictions };
}
