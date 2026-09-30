import type { ComponentType } from 'react';
import type { CharacterArtProps, CharacterId } from '../types';
import { HootArt } from './HootArt';
import { PipArt } from './PipArt';

// Filled in one character at a time (phases 2–3); CharacterCanvas draws Hoot
// for any character whose art hasn't landed yet.
export const ART: Partial<Record<CharacterId, ComponentType<CharacterArtProps>>> = {
  hoot: HootArt,
  pip: PipArt,
};
