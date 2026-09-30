import React from 'react';
import { Group } from '@shopify/react-native-skia';
import { useMoodLayer } from './useMoodLayer';
import type { CharacterArtProps, CharacterMood } from '../types';

export interface MoodLayerProps {
  /** True when the character is paused OR this is not the current mood: hold the still pose. */
  paused: boolean;
  mini: boolean;
}

export type MoodLayerComponents = Record<CharacterMood, React.ComponentType<MoodLayerProps>>;

// Draws all four mood layers and cross-fades between them. Only the current
// mood's layer animates; the others hold still (so a fading-out layer freezes).
export function MoodLayers({ mood, mini, paused, layers }: CharacterArtProps & { layers: MoodLayerComponents }) {
  const idle = useMoodLayer(mood, 'idle', paused);
  const thinking = useMoodLayer(mood, 'thinking', paused);
  const answering = useMoodLayer(mood, 'answering', paused);
  const resting = useMoodLayer(mood, 'resting', paused);
  const { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting } = layers;
  return (
    <>
      <Group opacity={idle}>
        <Idle paused={paused || mood !== 'idle'} mini={mini} />
      </Group>
      <Group opacity={thinking}>
        <Thinking paused={paused || mood !== 'thinking'} mini={mini} />
      </Group>
      <Group opacity={answering}>
        <Answering paused={paused || mood !== 'answering'} mini={mini} />
      </Group>
      <Group opacity={resting}>
        <Resting paused={paused || mood !== 'resting'} mini={mini} />
      </Group>
    </>
  );
}
