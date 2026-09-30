import React, { useEffect, useState } from 'react';
import { Group } from '@shopify/react-native-skia';
import { MOOD_FADE_MS, useMoodLayer } from './useMoodLayer';
import type { CharacterArtProps, CharacterMood } from '../types';

export interface MoodLayerProps {
  /** True when the character is paused OR this layer is neither the current mood nor fading out: hold the still pose. */
  paused: boolean;
  mini: boolean;
}

export type MoodLayerComponents = Record<CharacterMood, React.ComponentType<MoodLayerProps>>;

// Draws all four mood layers and cross-fades between them. The current mood's
// layer animates, and so does the layer fading out (for MOOD_FADE_MS after the
// mood changed away from it) so it doesn't snap to its still pose mid-fade; the
// others hold still. Paused: every layer holds still and switching is instant.
export function MoodLayers({ mood, mini, paused, layers }: CharacterArtProps & { layers: MoodLayerComponents }) {
  // Set during render (not in an effect) so the outgoing layer never sees a
  // paused=true render, which would reset its loop to the still pose.
  const [shownMood, setShownMood] = useState(mood);
  const [fadingOut, setFadingOut] = useState<CharacterMood | null>(null);
  if (mood !== shownMood) {
    setShownMood(mood);
    setFadingOut(paused ? null : shownMood);
  }
  useEffect(() => {
    if (fadingOut === null) return;
    const timer = setTimeout(() => setFadingOut(null), MOOD_FADE_MS);
    return () => clearTimeout(timer);
  }, [fadingOut, mood]);
  const layerPaused = (layer: CharacterMood) => paused || (layer !== mood && layer !== fadingOut);

  const idle = useMoodLayer(mood, 'idle', paused);
  const thinking = useMoodLayer(mood, 'thinking', paused);
  const answering = useMoodLayer(mood, 'answering', paused);
  const resting = useMoodLayer(mood, 'resting', paused);
  const { idle: Idle, thinking: Thinking, answering: Answering, resting: Resting } = layers;
  return (
    <>
      <Group opacity={idle}>
        <Idle paused={layerPaused('idle')} mini={mini} />
      </Group>
      <Group opacity={thinking}>
        <Thinking paused={layerPaused('thinking')} mini={mini} />
      </Group>
      <Group opacity={answering}>
        <Answering paused={layerPaused('answering')} mini={mini} />
      </Group>
      <Group opacity={resting}>
        <Resting paused={layerPaused('resting')} mini={mini} />
      </Group>
    </>
  );
}
