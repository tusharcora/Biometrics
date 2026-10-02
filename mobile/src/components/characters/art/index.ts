import type { ComponentType } from 'react';
import type { CharacterArtProps, CharacterId } from '../types';
import { BeatArt } from './BeatArt';
import { BeepArt } from './BeepArt';
import { DozeArt } from './DozeArt';
import { EmberArt } from './EmberArt';
import { HootArt } from './HootArt';
import { MochiArt } from './MochiArt';
import { NimbusArt } from './NimbusArt';
import { PipArt } from './PipArt';

export const ART: Record<CharacterId, ComponentType<CharacterArtProps>> = {
  hoot: HootArt,
  pip: PipArt,
  mochi: MochiArt,
  nimbus: NimbusArt,
  ember: EmberArt,
  beep: BeepArt,
  doze: DozeArt,
  beat: BeatArt,
};
