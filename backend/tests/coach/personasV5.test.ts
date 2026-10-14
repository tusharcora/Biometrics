import {
  DEFAULT_PERSONA_ID, LEGACY_PERSONA_IDS, LIVE_PERSONA_VERSION, PERSONA_SETS, REQUIRED_DISALLOWED_TOPICS,
  findPersona, isKnownPersonaId, listPersonas, resolvePersona,
} from '../../src/coach/personas';
import type { FactSheet } from '../../src/coach/answer/facts';
import { v1Personas } from '../../src/coach/personas/v1';
import { v2Personas } from '../../src/coach/personas/v2';
import { v3Personas } from '../../src/coach/personas/v3';
import { v4Personas } from '../../src/coach/personas/v4';
import { buildAnswerSystemPrompt, buildDigestSystemPrompt } from '../../src/coach/answer/prompt';
import { buildTodaySummaryPrompt } from '../../src/coach/answer/today';

const OLD_IDS = [v1Personas, v2Personas, v3Personas, v4Personas].flatMap((s) => s.personas.map((p) => p.id));

const SHEET: FactSheet = {
  route: 'today',
  facts: [{ id: 'recovery.today', label: 'Recovery today', value: 26, unit: 'score', display: '26', usual: 58 }],
  notes: ['No sleep recorded last night'],
};

describe('persona set v5: KIP', () => {
  it('is live, with KIP as its one persona', () => {
    expect(LIVE_PERSONA_VERSION).toBe('v5');
    expect(DEFAULT_PERSONA_ID).toBe('kip');
    expect(listPersonas()).toHaveLength(1);
    expect(listPersonas()[0]).toMatchObject({
      id: 'kip',
      name: 'KIP',
      tone: 'Friendly, plain-spoken and a little playful: the user\'s own small coach who knows their data. Calm about a dip, glad about a win, never preachy or gushing.',
      focus: 'Whatever the question is about: sleep, recovery, training or steady habits.',
      verbosity: 'normal',
      proactivity: 'threshold-triggered',
    });
  });

  it('keeps the required topics and v4\'s supplement rule', () => {
    expect(listPersonas()[0]!.disallowedTopics).toEqual([...REQUIRED_DISALLOWED_TOPICS, 'supplement recommendations']);
  });

  it.each([null, undefined, 'kip', ...OLD_IDS, ...Object.keys(LEGACY_PERSONA_IDS), 'nobody', 42])(
    'resolvePersona(%p) is KIP',
    (id) => {
      expect(resolvePersona(id as string | null | undefined).id).toBe('kip');
    },
  );

  it('findPersona knows every id any set ever had, and nothing else', () => {
    for (const id of ['kip', ...OLD_IDS, ...Object.keys(LEGACY_PERSONA_IDS)]) {
      expect(findPersona(id)?.id).toBe('kip');
      expect(isKnownPersonaId(id)).toBe(true);
    }
    for (const id of ['nobody', '', 3, null, 'toString', '__proto__']) {
      expect(findPersona(id)).toBeUndefined();
      expect(isKnownPersonaId(id)).toBe(false);
    }
  });

  it('leaves v1–v4 registered and unedited', () => {
    expect(Object.keys(PERSONA_SETS).sort()).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    expect(v4Personas.personas.map((p) => p.id)).toEqual([
      'mochi', 'boba', 'sprout', 'avo', 'peep', 'bun', 'kit', 'axo', 'boo', 'cap', 'jelly', 'pengu', 'luna', 'gloop', 'bao',
    ]);
    expect(v4Personas.defaultPersonaId).toBe('mochi');
    expect(v1Personas.personas.map((p) => p.id).sort()).toEqual(['clinical', 'direct', 'encouraging']);
    for (const version of ['v1', 'v2', 'v3', 'v4']) {
      expect(PERSONA_SETS[version]).toBe([v1Personas, v2Personas, v3Personas, v4Personas].find((s) => s.version === version));
      expect(JSON.stringify(PERSONA_SETS[version])).toMatchSnapshot(version);
    }
  });
});

describe('the prompts open as KIP and keep their rules', () => {
  const KIP = listPersonas()[0]!;

  it('the answer prompt names KIP, then the unchanged rules', () => {
    const prompt = buildAnswerSystemPrompt(KIP, { today: '2026-09-30', sheet: SHEET });
    expect(prompt.startsWith("You are KIP, the user's own coach inside a wellness app, talking in character.")).toBe(true);
    expect(prompt).toContain('- name: "KIP"');
    for (const topic of [...REQUIRED_DISALLOWED_TOPICS, 'supplement recommendations']) expect(prompt).toContain(topic);
  });

  it('the day sentence is written by the user\'s own coach, KIP', () => {
    const prompt = buildTodaySummaryPrompt(KIP, SHEET, '2026-09-30');
    expect(prompt).toContain('You are "KIP", the user\'s own coach in a health app.');
    expect(prompt).not.toContain('companion coach');
  });

  it('the weekly note speaks as KIP', () => {
    expect(buildDigestSystemPrompt(KIP, { today: '2026-09-30', sheet: { ...SHEET, route: 'trends' } })).toContain('- name: "KIP"');
  });
});
