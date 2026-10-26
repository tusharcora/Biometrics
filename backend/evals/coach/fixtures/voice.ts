// KIP's voice (spec 2026-10-14 KIP Coach §2): the one live persona. The system prompt carries its name, tone and
// focus, and an in-voice reply keeps its voice markers through validation (nothing in the voice is mistaken for a
// number).
// `npm run eval:coach:local` runs the same questions through the real model.

import { findPersona } from '../../../src/coach/personas';
import type { EvalFixture } from '../types';
import { LOW_DAY } from './common';

/** A reply in KIP's voice, with the phrase that marks it. */
const VOICES: Array<{ id: string; marker: string; reply: string }> = [
  { id: 'kip', marker: 'easy', reply: 'Recovery is 26 today, under your usual 58. A dip like this happens; keep today easy and it should bounce back.' },
];

export const voiceFixtures: EvalFixture[] = VOICES.map(({ id, marker, reply }) => {
  const persona = findPersona(id);
  if (!persona) throw new Error(`voice fixture for unknown character ${id}`);
  return {
    id: `voice-${id}`,
    category: 'voice' as const,
    description: `${persona.name} answers in its own voice ("${marker}") from the same fact sheet.`,
    snapshot: { ...LOW_DAY, personaId: id },
    question: 'How am I doing today?',
    script: [reply],
    expect: {
      outcome: 'answer',
      dropped: [],
      textPresent: [marker],
      promptIncludes: [
        `- name: ${JSON.stringify(persona.name)}`,
        `- tone: ${JSON.stringify(persona.tone)}`,
        ...(persona.focus ? [`- coaching focus: ${JSON.stringify(persona.focus)}`] : []),
      ],
    },
  };
});
