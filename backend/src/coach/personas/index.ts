import type { CoachPersona, PersonaSet } from './v1';
import { v1Personas } from './v1';

export type { CoachPersona, PersonaSet, Verbosity, Proactivity } from './v1';
export { REQUIRED_DISALLOWED_TOPICS } from './v1';

/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export const PERSONA_SETS: Record<string, PersonaSet> = {
  [v1Personas.version]: v1Personas,
};

export const LIVE_PERSONA_VERSION = 'v1';

function liveSet(): PersonaSet {
  return PERSONA_SETS[LIVE_PERSONA_VERSION]!;
}

export const DEFAULT_PERSONA_ID = liveSet().defaultPersonaId;

export function listPersonas(): CoachPersona[] {
  return liveSet().personas;
}

export function findPersona(id: unknown): CoachPersona | undefined {
  return typeof id === 'string' ? listPersonas().find((p) => p.id === id) : undefined;
}

/** A stored id that no longer exists (persona retired in a later version) falls back to the default. */
export function resolvePersona(id: string | null | undefined): CoachPersona {
  return findPersona(id) ?? findPersona(DEFAULT_PERSONA_ID)!;
}
