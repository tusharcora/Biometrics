import type { CoachPersona, PersonaSet } from './types';
import { v1Personas } from './v1';
import { LEGACY_PERSONA_IDS, v2Personas } from './v2';
import { v3Personas } from './v3';

export type { CoachPersona, CharacterPersona, PersonaSet, Verbosity, Proactivity } from './types';
export { REQUIRED_DISALLOWED_TOPICS } from './types';
export { LEGACY_PERSONA_IDS } from './v2';

/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export const PERSONA_SETS: Record<string, PersonaSet> = {
  [v1Personas.version]: v1Personas,
  [v2Personas.version]: v2Personas,
  [v3Personas.version]: v3Personas,
};

export const LIVE_PERSONA_VERSION = 'v3';

function liveSet(): PersonaSet {
  return PERSONA_SETS[LIVE_PERSONA_VERSION]!;
}

export const DEFAULT_PERSONA_ID = liveSet().defaultPersonaId;

export function listPersonas(): CoachPersona[] {
  return liveSet().personas;
}

/**
 * A retired v1 id becomes the character that replaced it; anything else is
 * returned as is. Own keys only, so "toString" or "__proto__" never match.
 */
export function canonicalPersonaId(id: string): string {
  return Object.hasOwn(LEGACY_PERSONA_IDS, id) ? LEGACY_PERSONA_IDS[id as keyof typeof LEGACY_PERSONA_IDS] : id;
}

export function findPersona(id: unknown): CoachPersona | undefined {
  if (typeof id !== 'string') return undefined;
  const canonical = canonicalPersonaId(id);
  return listPersonas().find((p) => p.id === canonical);
}

/** A stored id that no longer exists (persona retired in a later version) falls back to the default. */
export function resolvePersona(id: string | null | undefined): CoachPersona {
  return findPersona(id) ?? findPersona(DEFAULT_PERSONA_ID)!;
}
