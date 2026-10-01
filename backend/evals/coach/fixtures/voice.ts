// Per-character voice (spec 2026-09-30, section 2.3): every companion answers
// in its own voice from the same facts. For each character the system prompt
// must carry its name, tone and focus, and an in-voice reply keeps its voice
// markers through validation (nothing in the voice is mistaken for a number).
// `npm run eval:coach:local` runs the same questions through the real model.

import { findPersona } from '../../../src/coach/personas';
import type { EvalFixture } from '../types';
import { LOW_DAY } from './common';

/** A reply in each character's voice, with the phrase that marks it. */
const VOICES: Array<{ id: string; marker: string; reply: string }> = [
  { id: 'hoot', marker: 'I wonder', reply: 'Recovery is 26 today, well under your usual 58. I wonder if the short night is behind it, since your HRV dipped too. An easy day will help it bounce back.' },
  { id: 'pip', marker: 'You showed up', reply: 'You showed up, and that counts! Recovery is 26 today, so a gentle day is the win.' },
  { id: 'mochi', marker: 'No pressure', reply: 'No pressure today. Recovery is 26, so rest is doing its job.' },
  { id: 'nimbus', marker: "Today's forecast", reply: "Today's forecast: cloudy, with recovery at 26. Plan a light day around it." },
  { id: 'ember', marker: 'ease off', reply: 'Recovery is 26 today. This is a day to ease off, not push.' },
  { id: 'beep', marker: 'Recovery: 26', reply: 'Recovery: 26. Usual: 58. HRV: 41 ms, usual 52 ms.' },
  { id: 'doze', marker: '*yawn*', reply: '*yawn* Recovery is 26 this morning. Let us keep today slow and cosy.' },
  { id: 'beat', marker: 'Your heart', reply: 'Your heart is working a little harder today, at 58 bpm resting. Be kind to it.' },
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
