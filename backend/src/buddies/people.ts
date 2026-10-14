// How another person appears to a buddy: display name, handle, chosen coach, KIP colour and what their KIP wears.
// Never their email, and never their room or what they own.

import type { Prisma } from '@prisma/client';
import { resolvePersona } from '../coach/personas';
import { kipWornOf, type KipWornDTO } from '../cosmetics/worn';
import { kipColourOf, type KipColourName } from '../kip/colours';

export const PERSON_SELECT = {
  id: true, handle: true, displayName: true, coachPersonaId: true, kipColour: true, cosmeticLoadout: { select: { worn: true } },
} as const;

export interface PersonDTO {
  id: string;
  handle: string;
  displayName: string;
  /** A character id (mobile src/components/characters/types.ts). */
  coachId: string;
  kipColour: KipColourName;
  /** What their KIP wears (spec 2026-10-14 KIP's room §7); never their room. */
  kipWorn: KipWornDTO;
}

export function toPerson(u: {
  id: string; handle: string | null; displayName: string | null; coachPersonaId: string | null; kipColour: string | null;
  cosmeticLoadout: { worn: Prisma.JsonValue } | null;
}): PersonDTO {
  return {
    id: u.id,
    handle: u.handle ?? '',
    displayName: u.displayName ?? u.handle ?? '',
    coachId: resolvePersona(u.coachPersonaId).id,
    kipColour: kipColourOf(u.kipColour),
    kipWorn: kipWornOf(u.cosmeticLoadout?.worn),
  };
}
