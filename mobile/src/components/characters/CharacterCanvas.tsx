import React from 'react';
import { Canvas, Group } from '@shopify/react-native-skia';
import { ART } from './art';
import type { CharacterId, CharacterMood } from './types';

export interface CharacterCanvasProps {
  characterId: CharacterId;
  mood: CharacterMood;
  size: number;
  paused: boolean;
  mini: boolean;
}

// The only file that touches Skia's Canvas. Every jest test sees the stub in
// jest-mocks/CharacterCanvas.js instead; animation is checked on a simulator.
export function CharacterCanvas({ characterId, mood, size, paused, mini }: CharacterCanvasProps) {
  const Art = ART[characterId] ?? ART.hoot;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 100 }]}>{Art ? <Art mood={mood} mini={mini} paused={paused} /> : null}</Group>
    </Canvas>
  );
}
