import type { CoachPersona, PersonaSet } from './types';
import { v1Personas } from './v1';
import { LEGACY_PERSONA_IDS, v2Personas } from './v2';
import { v3Personas } from './v3';
import { v4Personas } from './v4';
import { v5Personas } from './v5';

export type { CoachPersona, CharacterPersona, PersonaSet, Verbosity, Proactivity } from './types';
export { REQUIRED_DISALLOWED_TOPICS } from './types';
export { LEGACY_PERSONA_IDS } from './v2';

/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export const PERSONA_SETS: Record<string, PersonaSet> = {
  [v1Personas.version]: v1Personas,
  [v2Personas.version]: v2Personas,
  [v3Personas.version]: v3Personas,
  [v4Personas.version]: v4Personas,
  [v5Personas.version]: v5Personas,
};

export const LIVE_PERSONA_VERSION = 'v5';

function liveSet(): PersonaSet {
  return PERSONA_SETS[LIVE_PERSONA_VERSION]!;
}

export const DEFAULT_PERSONA_ID = liveSet().defaultPersonaId;

export function listPersonas(): CoachPersona[] {
  return liveSet().personas;
}

// Every id any registered set ever had, plus the v1 → v2 legacy keys: an old app's request never fails (§2).
const KNOWN_IDS: ReadonlySet<string> = new Set([
  ...Object.values(PERSONA_SETS).flatMap((set) => set.personas.map((p) => p.id)),
  ...Object.keys(LEGACY_PERSONA_IDS),
]);

export function isKnownPersonaId(id: unknown): boolean {
  return typeof id === 'string' && KNOWN_IDS.has(id);
}

/** The live persona for any id the app ever stored or sent; undefined for anything else. */
export function findPersona(id: unknown): CoachPersona | undefined {
  return isKnownPersonaId(id) ? liveSet().personas[0] : undefined;
}

/** Any stored id, known or not (or none), resolves to the live persona: in v5, KIP. */
export function resolvePersona(id: string | null | undefined): CoachPersona {
  return findPersona(id) ?? findPersona(DEFAULT_PERSONA_ID)!;
}
