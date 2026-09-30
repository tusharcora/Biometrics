import type { ComponentType } from 'react';
import type { CharacterArtProps, CharacterId } from '../types';
import { BeepArt } from './BeepArt';
import { DozeArt } from './DozeArt';
import { EmberArt } from './EmberArt';
import { HootArt } from './HootArt';
import { MochiArt } from './MochiArt';
import { NimbusArt } from './NimbusArt';
import { PipArt } from './PipArt';

// Filled in one character at a time (phases 2–3); CharacterCanvas draws Hoot
// for any character whose art hasn't landed yet.
export const ART: Partial<Record<CharacterId, ComponentType<CharacterArtProps>>> = {
  hoot: HootArt,
  pip: PipArt,
  mochi: MochiArt,
  nimbus: NimbusArt,
  ember: EmberArt,
  beep: BeepArt,
  doze: DozeArt,
};
