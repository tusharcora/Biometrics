// How another person appears to a buddy: display name, handle and chosen coach. Never their email.

import { resolvePersona } from '../coach/personas';

export const PERSON_SELECT = { id: true, handle: true, displayName: true, coachPersonaId: true } as const;

export interface PersonDTO {
  id: string;
  handle: string;
  displayName: string;
  /** A character id (mobile src/components/characters/types.ts). */
  coachId: string;
}

export function toPerson(u: { id: string; handle: string | null; displayName: string | null; coachPersonaId: string | null }): PersonDTO {
  return { id: u.id, handle: u.handle ?? '', displayName: u.displayName ?? u.handle ?? '', coachId: resolvePersona(u.coachPersonaId).id };
}
