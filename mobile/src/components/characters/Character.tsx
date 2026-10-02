import React from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useCharacterOptional } from '../../characters/CharacterContext';
import { Glow } from '../ui/glow';
import { CharacterCanvas } from './CharacterCanvas';
import { characterInfo } from './registry';
import { DEFAULT_CHARACTER_ID, type CharacterId, type CharacterMood } from './types';

export const DIMMED_OPACITY = 0.45;
/** At this size and below a full body doesn't read, so the head-only mini variant is the default. */
export const MINI_MAX_SIZE = 40;

export interface CharacterProps {
  /** Omitted → the user's current character (CharacterProvider), or Hoot outside it. */
  characterId?: CharacterId;
  mood: CharacterMood;
  size: number;
  paused?: boolean;
  dimmed?: boolean;
  mini?: boolean;
  glow?: boolean;
  /** Set → announced as an image. Unset → decorative and hidden from screen readers. */
  accessibilityLabel?: string;
  testID?: string;
}

// The coach's face everywhere the orb used to be (spec §1).
export function Character({
  characterId,
  mood,
  size,
  paused = false,
  dimmed = false,
  mini,
  glow = false,
  accessibilityLabel,
  testID,
}: CharacterProps) {
  const current = useCharacterOptional();
  const id = characterId ?? current?.characterId ?? DEFAULT_CHARACTER_ID;
  const reduceMotion = useReducedMotion();
  const labelled = accessibilityLabel !== undefined;
  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!labelled}
      importantForAccessibility={labelled ? 'yes' : 'no-hide-descendants'}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: dimmed ? DIMMED_OPACITY : 1 }}
    >
      {glow ? <Glow color={characterInfo(id).accent} size={size * 2.4} around={size} intensity={0.3} /> : null}
      <CharacterCanvas
        characterId={id}
        mood={mood}
        size={size}
        paused={paused || reduceMotion}
        mini={mini ?? size <= MINI_MAX_SIZE}
      />
    </View>
  );
}
