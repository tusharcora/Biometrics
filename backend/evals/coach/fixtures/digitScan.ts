// Fixture category (a) from spec section 7: the digit-scan exemptions in section 4,
// in BOTH directions, to guard against regressing either way.
//   accept: list markers, am/pm times, month-name dates and ordinals must pass
//           the guardrail untouched (one model call, no guardrail event).
//   reject: ratios ("7/10"), bare h:mm ("7:32"), bare counts, "5 amazing tips",
//           unit values, percentages, a digit adjacent to an exempt span, numeric
//           slash dates and a bad {{field}} path must be rejected and regenerated
//           once (the scripted second reply is a fully grounded one).

import type { EvalFixture } from '../types';

const SNAPSHOT = { recovery: [[0, 72.4], [1, 75]] as Array<[number, number]> };
const GROUNDED = 'Your recovery is {{getDailyScore.recoveryScore}}.';

const accept: Array<[id: string, text: string, mustContain: string]> = [
  ['list-marker', '1. Sleep earlier tonight.\n2. Keep the room cool.', '1. Sleep earlier tonight.'],
  ['clock-pm', 'Try winding down by 10pm tonight.', 'winding down by 10pm tonight'],
  ['clock-pm-with-minutes', 'Aim to be in bed by 10:30 pm.', 'bed by 10:30 pm'],
  ['clock-am-dotted', 'An alarm at 7 a.m. keeps your rhythm regular.', 'alarm at 7 a.m.'],
  ['month-name-date', 'Your last full rest day was March 14.', 'March 14'],
  ['ordinal-date', 'You have been consistent since the 14th.', 'since the 14th'],
  [
    'fully-grounded',
    'Your recovery is {{getDailyScore.recoveryScore}}, {{getDailyScore.direction}} than yesterday.',
    'Your recovery is 72.4, lower than yesterday.',
  ],
];

const reject: Array<[id: string, bad: string, reason: 'unwrapped_number' | 'invalid_field_path']> = [
  ['ratio', 'Your recovery is about 7/10 today.', 'unwrapped_number'],
  ['bare-h-mm-duration', 'You slept 7:32 last night.', 'unwrapped_number'],
  ['bare-count', 'Here are 3 tips for tonight.', 'unwrapped_number'],
  ['resembles-am', 'Here are 5 amazing tips.', 'unwrapped_number'],
  ['unit-hours', 'You slept 8 hours.', 'unwrapped_number'],
  ['unit-ms', 'Your HRV is 42ms.', 'unwrapped_number'],
  ['percentage', 'Your recovery is up 12% today.', 'unwrapped_number'],
  ['adjacent-to-exempt', 'Wind down by 10pm for 8 hours of sleep.', 'unwrapped_number'],
  ['numeric-slash-date', 'Your dip started 3/14.', 'unwrapped_number'],
  ['bad-field-path', 'Your HRV change is {{getDailyScore.hrvDelta}} today.', 'invalid_field_path'],
];

export const digitScanFixtures: EvalFixture[] = [
  ...accept.map(
    ([id, text, mustContain]): EvalFixture => ({
      id: `digit-scan-accept-${id}`,
      category: 'digit-scan-accept',
      description: `An exempt shape (${id}) passes the guardrail untouched.`,
      snapshot: SNAPSHOT,
      question: 'any advice for tonight',
      script: [{ type: 'text', text }],
      expect: { source: 'MODEL', modelCalls: 1, guardrail: [], valuesPresent: [mustContain] },
    }),
  ),
  ...reject.map(
    ([id, bad, reason]): EvalFixture => ({
      id: `digit-scan-reject-${id}`,
      category: 'digit-scan-reject',
      description: `A non-exempt shape (${id}) is rejected and regenerated once.`,
      snapshot: SNAPSHOT,
      question: 'any advice for tonight',
      script: [
        { type: 'text', text: bad },
        { type: 'text', text: GROUNDED },
      ],
      expect: {
        source: 'MODEL',
        modelCalls: 2,
        guardrail: [{ reason, attempt: 1, outcome: 'regenerate' }],
        valuesPresent: ['Your recovery is 72.4.'],
        valuesAbsent: [bad],
      },
    }),
  ),
];
