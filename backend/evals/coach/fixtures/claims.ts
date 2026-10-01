// Claims the runtime validator cannot judge, because every number in them is
// real: a direction that contradicts the fact sheet ("higher than usual" for a
// value below it), and a real number pinned on the wrong metric. The runtime
// check scopes numbers to the metrics a sentence names, but lets any metric use
// metric-less values (score drivers, notes), so "your HRV is 9" passes when 9
// is the points HRV cost the recovery score. The eval's direction and attribution checks
// catch both; the must-fail fixtures prove it. The last must-fail fixture runs
// the pipeline with its own validation switched off and proves the eval's
// `grounded` check still catches an invented number.

import type { EvalFixture, NegativeFixture } from '../types';
import { LOW_DAY } from './common';

const base = { snapshot: LOW_DAY, question: 'How am I doing today?' };

export const claimFixtures: EvalFixture[] = [
  {
    ...base,
    id: 'direction-agrees-with-usual',
    category: 'direction',
    description: 'Recovery 26 against a usual 58: "lower than usual" agrees with the fact sheet.',
    script: ['Your recovery is 26, lower than usual.'],
    expect: { outcome: 'answer', dropped: [], directionOf: 'recovery.today' },
  },
  {
    ...base,
    id: 'direction-resting-hr-above-usual',
    category: 'direction',
    description: 'Resting HR 58 against a usual 55 is higher, even though higher is worse for this metric.',
    script: ['Your resting heart rate is 58 bpm, higher than usual.'],
    expect: { outcome: 'answer', dropped: [], directionOf: 'rhr.today' },
  },
  {
    ...base,
    id: 'attribution-each-number-on-its-metric',
    category: 'attribution',
    description: 'Every number sits with its own metric.',
    script: ['Your HRV is 41 ms against a usual 52 ms. Your resting heart rate is 58 bpm.'],
    expect: { outcome: 'answer', dropped: [], attribution: true },
  },
];

export const claimNegativeFixtures: NegativeFixture[] = [
  {
    ...base,
    id: 'direction-contradicts-usual',
    category: 'direction',
    description: 'The reply says "higher than usual" for 26 against 58: every number is valid, so only the eval catches it.',
    script: ['Your recovery is 26, higher than usual.'],
    expect: { outcome: 'answer', dropped: [], directionOf: 'recovery.today' },
    mustFailCheck: 'direction',
  },
  {
    ...base,
    id: 'attribution-borrowed-number',
    category: 'attribution',
    description: '"HRV is 9" borrows the 9 points HRV cost the recovery score: a metric-less value, so only the eval catches it.',
    script: ['Your HRV is 9 this morning.'],
    expect: { outcome: 'answer', dropped: [], attribution: true },
    mustFailCheck: 'attribution',
  },
  {
    ...base,
    id: 'numbers-invented-unguarded',
    category: 'numbers',
    description: "With the pipeline's validation switched off, an invented HRV reaches the user; the eval's grounded check must catch it.",
    script: ['Your HRV is 95 ms this morning.'],
    expect: { outcome: 'answer' },
    mustFailCheck: 'grounded',
    unguarded: true,
  },
];
