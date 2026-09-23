import type { CoachPersona, PersonaSet } from './v1';
export type { CoachPersona, PersonaSet, Verbosity, Proactivity } from './v1';
export { REQUIRED_DISALLOWED_TOPICS } from './v1';
/** Every shipped version, by id. Add a new file and register it here; never edit an old one. */
export declare const PERSONA_SETS: Record<string, PersonaSet>;
export declare const LIVE_PERSONA_VERSION = "v1";
export declare const DEFAULT_PERSONA_ID: string;
export declare function listPersonas(): CoachPersona[];
export declare function findPersona(id: unknown): CoachPersona | undefined;
/** A stored id that no longer exists (persona retired in a later version) falls back to the default. */
export declare function resolvePersona(id: string | null | undefined): CoachPersona;
//# sourceMappingURL=index.d.ts.map