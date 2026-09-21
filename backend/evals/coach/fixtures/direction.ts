// Fixture category (b) from spec section 7: directional claims (section 4's
// claim-grounding scope boundary). The runtime guardrail grounds VALUES, not
// comparative claims, so a reply can quote a grounded number and still say
// "higher" when the grounded `direction` says "lower". The eval checker is what
// catches that.
//
// The key setup: today 71 vs yesterday 68 would read as "higher" to anyone
// eyeballing the raw numbers, but the grounded `direction` handed to the model is
// deliberately set to 'lower'. A reply that follows the naive reading instead of
// quoting the field must FAIL the eval; one that quotes the field must pass.

import type { EvalFixture, NegativeFixture } from '../types';

/** Raw numbers say "up" (71 vs 68); the grounded field is overridden to 'lower'. */
const NAIVE_HIGHER_GROUNDED_LOWER: Pick<EvalFixture, 'snapshot' | 'groundedOverrides'> = {
  snapshot: { recovery: [[0, 71], [1, 68]] },
  groundedOverrides: { direction: 'lower', deltaFromYesterday: -3 },
};

const base = { category: 'direction' as const, question: 'how does today compare to yesterday' };

export const directionFixtures: EvalFixture[] = [
  {
    ...base,
    id: 'direction-quotes-the-field',
    description: 'Naive numbers say higher, grounded field says lower: a reply that QUOTES {{getDailyScore.direction}} passes.',
    ...NAIVE_HIGHER_GROUNDED_LOWER,
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.' }],
    expect: {
      source: 'MODEL',
      modelCalls: 1,
      guardrail: [],
      valuesPresent: ['Your recovery is 71, lower than yesterday.'],
      directionConsistent: true,
    },
  },
  {
    ...base,
    id: 'direction-prose-agrees-with-the-field',
    description: 'Prose that happens to agree with the grounded direction also passes (the check is on agreement, not on syntax).',
    ...NAIVE_HIGHER_GROUNDED_LOWER,
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, a little lower than yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], directionConsistent: true },
  },
  {
    ...base,
    id: 'direction-unchanged-field',
    description: "Equal scores: the grounded direction is 'unchanged' and the reply quotes it.",
    snapshot: { recovery: [[0, 70], [1, 70]] },
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} from yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], valuesPresent: ['unchanged from yesterday'], directionConsistent: true },
  },
  {
    ...base,
    id: 'direction-higher-field',
    description: "A genuine increase: the server-computed direction is 'higher' and the reply quotes it.",
    snapshot: { recovery: [[0, 80], [1, 70]] },
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], valuesPresent: ['higher than yesterday'], directionConsistent: true },
  },
];

/**
 * These replies pass the RUNTIME guardrail (every digit is grounded), so source
 * is MODEL with no guardrail events, and yet they must FAIL the eval on the
 * `direction` check and on nothing else.
 */
export const directionNegativeFixtures: NegativeFixture[] = [
  {
    ...base,
    id: 'direction-contradicts-naive-reading',
    description: 'Follows the naive reading of 71 vs 68 ("higher") although the grounded direction is lower.',
    ...NAIVE_HIGHER_GROUNDED_LOWER,
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, higher than yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], directionConsistent: true },
    mustFailCheck: 'direction',
  },
  {
    ...base,
    id: 'direction-contradicts-with-up',
    description: 'Says "up from yesterday" against a grounded lower.',
    ...NAIVE_HIGHER_GROUNDED_LOWER,
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, up from yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], directionConsistent: true },
    mustFailCheck: 'direction',
  },
  {
    ...base,
    id: 'direction-claims-change-when-unchanged',
    description: "Claims an improvement when the grounded direction is 'unchanged'.",
    snapshot: { recovery: [[0, 70], [1, 70]] },
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, improved since yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], directionConsistent: true },
    mustFailCheck: 'direction',
  },
  {
    ...base,
    id: 'direction-says-worse-when-higher',
    description: "Says worse when the grounded direction is 'higher'.",
    snapshot: { recovery: [[0, 80], [1, 70]] },
    script: [{ type: 'text', text: 'Your recovery is {{getDailyScore.recoveryScore}}, worse than yesterday.' }],
    expect: { source: 'MODEL', modelCalls: 1, guardrail: [], directionConsistent: true },
    mustFailCheck: 'direction',
  },
];
