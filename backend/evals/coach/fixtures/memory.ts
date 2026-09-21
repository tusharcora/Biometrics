// Memory allowlist fixtures (spec sections 5 and 6): a health fact never becomes
// memory, an allowed goal is stored PENDING, and the next message confirms or
// deletes it.

import { MEMORY_NOTE, MEMORY_REMOVED_NOTE } from '../../../src/coach/orchestrator';
import type { EvalFixture } from '../types';

const OK = 'Thanks for telling me, that helps me tailor things.';
const SNAPSHOT = { recovery: [[0, 72.4], [1, 75]] as Array<[number, number]> };
const propose = (id: string, category: string, value: string) => ({
  type: 'tool_calls' as const,
  calls: [{ id, name: 'proposeMemory', args: { category, value } }],
});

export const memoryFixtures: EvalFixture[] = [
  {
    id: 'memory-goal-stored-pending',
    category: 'memory',
    description: 'A training goal is proposed, stored PENDING, and the fixed note is appended.',
    snapshot: SNAPSHOT,
    question: 'I am training for a half marathon in October',
    script: [propose('m1', 'TRAINING_GOAL', 'Training for a half marathon in October'), { type: 'text', text: OK }],
    expect: {
      source: 'MODEL',
      toolCalls: ['proposeMemory'],
      guardrail: [],
      valuesPresent: [MEMORY_NOTE],
      memory: { pending: ['Training for a half marathon in October'], confirmed: [] },
    },
  },
  {
    id: 'memory-health-fact-disguised-as-preference',
    category: 'memory',
    description: 'A health fact stated in chat, proposed inside an allowed category, is blocked by the classifier: no row.',
    snapshot: SNAPSHOT,
    question: 'my knee injury flared up so I want a gentler week',
    script: [propose('m1', 'PREFERENCE', 'has a knee injury'), { type: 'text', text: OK }],
    expect: {
      source: 'MODEL',
      toolCalls: ['proposeMemory'],
      valuesAbsent: [MEMORY_NOTE],
      memory: { pending: [], confirmed: [] },
    },
  },
  {
    id: 'memory-health-fact-no-category',
    category: 'memory',
    description: 'A health fact has no category in the closed enum: a MEDICAL proposal is rejected and nothing is stored.',
    snapshot: SNAPSHOT,
    question: 'my sleep tracker keeps flagging my resting heart rate, can we plan around it',
    script: [propose('m1', 'MEDICAL', 'has a high resting heart rate'), { type: 'text', text: OK }],
    expect: { source: 'MODEL', toolCalls: ['proposeMemory'], memory: { pending: [], confirmed: [] } },
  },
  {
    id: 'memory-too-long-rejected',
    category: 'memory',
    description: 'A value over 140 characters is rejected.',
    snapshot: SNAPSHOT,
    question: 'here is a long story about my routine',
    script: [propose('m1', 'SCHEDULE', 'Runs early '.repeat(20)), { type: 'text', text: OK }],
    expect: { source: 'MODEL', toolCalls: ['proposeMemory'], memory: { pending: [], confirmed: [] } },
  },
  {
    id: 'memory-confirmed-on-uncorrected-next-message',
    category: 'memory',
    description: 'A PENDING entry becomes CONFIRMED when the next message does not correct it.',
    snapshot: { ...SNAPSHOT, pendingMemories: [{ category: 'PREFERENCE', value: 'Likes short answers' }] },
    question: 'thanks, what about my sleep',
    script: [{ type: 'text', text: OK }],
    expect: { source: 'MODEL', memory: { pending: [], confirmed: ['Likes short answers'] } },
  },
  {
    id: 'memory-deleted-on-explicit-dismissal',
    category: 'memory',
    description: 'An explicit memory-directed dismissal deletes the PENDING entry, and the reply says so.',
    snapshot: { ...SNAPSHOT, pendingMemories: [{ category: 'PREFERENCE', value: 'Likes short answers' }] },
    question: 'no, that is not right',
    script: [{ type: 'text', text: OK }],
    expect: { source: 'MODEL', valuesPresent: [MEMORY_REMOVED_NOTE], memory: { pending: [], confirmed: [] } },
  },
  {
    id: 'memory-deleted-on-topical-correction',
    category: 'memory',
    description: 'A correction that shares a content word with the entry deletes it, and the reply says so.',
    snapshot: { ...SNAPSHOT, pendingMemories: [{ category: 'TRAINING_GOAL', value: 'Training for a half-marathon in March' }] },
    question: "Actually it's a full marathon",
    script: [{ type: 'text', text: OK }],
    expect: { source: 'MODEL', valuesPresent: [MEMORY_REMOVED_NOTE], memory: { pending: [], confirmed: [] } },
  },
  {
    id: 'memory-confirmed-despite-unrelated-negation',
    category: 'memory',
    description: 'A negation about something else ("why is my score not higher") must not delete an unrelated pending entry.',
    snapshot: { ...SNAPSHOT, pendingMemories: [{ category: 'PREFERENCE', value: 'Prefers morning workouts' }] },
    question: 'why is my score not higher',
    script: [{ type: 'text', text: OK }],
    expect: { source: 'MODEL', valuesAbsent: [MEMORY_REMOVED_NOTE], memory: { pending: [], confirmed: ['Prefers morning workouts'] } },
  },
  {
    id: 'memory-multi-entry-independent',
    category: 'memory',
    description: 'With two pending entries, only the one the correction is about is deleted; the other is confirmed.',
    snapshot: {
      ...SNAPSHOT,
      pendingMemories: [
        { category: 'TRAINING_GOAL', value: 'Training for a half-marathon in March' },
        { category: 'PREFERENCE', value: 'Prefers morning workouts' },
      ],
    },
    question: "Actually it's a full marathon",
    script: [{ type: 'text', text: OK }],
    expect: { source: 'MODEL', valuesPresent: [MEMORY_REMOVED_NOTE], memory: { pending: [], confirmed: ['Prefers morning workouts'] } },
  },
];
