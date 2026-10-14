// Test helpers for components that read CharacterContext. Kept out of
// __tests__ so jest does not collect it as a suite (like forecastFixture.ts).
import React from 'react';
import { within, type render } from '@testing-library/react-native';
import { CharacterContext, type CharacterContextValue } from '../src/characters/CharacterContext';
import { HIDDEN_OK } from './coachStatus';

// Characters are decorative and hidden from screen readers, so queries for
// them must opt in to hidden elements. Defined in coachStatus.tsx (ruling H6).
export { HIDDEN_OK };

export function fakeCharacter(overrides: Partial<CharacterContextValue> = {}): CharacterContextValue {
  return {
    characterId: 'mochi',
    personaChosen: true,
    status: null,
    statusLoaded: true,
    recoveryBand: null,
    thinkingAttachment: 'bulb',
    thinkingText: 'steps',
    refreshStatus: jest.fn(async () => {}),
    chooseCharacter: jest.fn(async () => {}),
    chooseThinking: jest.fn(async () => {}),
    ...overrides,
  };
}

export function withCharacter(ui: React.ReactElement, overrides: Partial<CharacterContextValue> = {}): React.ReactElement {
  return <CharacterContext.Provider value={fakeCharacter(overrides)}>{ui}</CharacterContext.Provider>;
}

// The CharacterCanvas mock's label inside the element with this testID:
// "character:<id>:<mood>:<size>:<paused|playing>:<attachment|none>".
export function characterLabel(screen: Pick<ReturnType<typeof render>, 'getByTestId'>, testID: string): string {
  return within(screen.getByTestId(testID, HIDDEN_OK)).getByTestId('character-canvas', HIDDEN_OK).props.accessibilityLabel;
}
