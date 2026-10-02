// mobile/__tests__/components/Character.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Character, DIMMED_OPACITY } from '../../src/components/characters/Character';
import { CharacterContext, type CharacterContextValue } from '../../src/characters/CharacterContext';

let mockReduceMotion = false;
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReduceMotion,
}));

// An unlabelled character is hidden from the accessibility tree, so queries must opt in to hidden elements.
const HIDDEN_OK = { includeHiddenElements: true };
const canvas = (utils: ReturnType<typeof render>) =>
  utils.getByTestId('character-canvas', HIDDEN_OK).props.accessibilityLabel;

describe('Character', () => {
  beforeEach(() => {
    mockReduceMotion = false;
  });

  it('draws the given character, mood, size and pause state', () => {
    const utils = render(<Character characterId="ember" mood="thinking" size={64} paused />);
    expect(canvas(utils)).toBe('character:ember:thinking:64:paused:full');
  });

  it('is Hoot outside a provider when no id is given', () => {
    const utils = render(<Character mood="idle" size={56} />);
    expect(canvas(utils)).toBe('character:hoot:idle:56:playing:full');
  });

  it("is the provider's character when no id is given", () => {
    const value = { characterId: 'doze' } as CharacterContextValue;
    const utils = render(
      <CharacterContext.Provider value={value}>
        <Character mood="resting" size={56} />
      </CharacterContext.Provider>,
    );
    expect(canvas(utils)).toBe('character:doze:resting:56:playing:full');
  });

  it('uses the mini variant at 40 px and below unless told otherwise', () => {
    expect(canvas(render(<Character characterId="pip" mood="idle" size={40} />))).toBe('character:pip:idle:40:playing:mini');
    expect(canvas(render(<Character characterId="pip" mood="idle" size={41} />))).toBe('character:pip:idle:41:playing:full');
    expect(canvas(render(<Character characterId="pip" mood="idle" size={64} mini />))).toBe('character:pip:idle:64:playing:mini');
    expect(canvas(render(<Character characterId="pip" mood="idle" size={20} mini={false} />))).toBe(
      'character:pip:idle:20:playing:full',
    );
  });

  it('holds still when Reduce Motion is on', () => {
    mockReduceMotion = true;
    const utils = render(<Character characterId="beat" mood="answering" size={64} />);
    expect(canvas(utils)).toBe('character:beat:answering:64:paused:full');
  });

  it('is full opacity normally and dimmed when asked, and exactly its size', () => {
    const { getByTestId, rerender } = render(<Character mood="idle" size={64} testID="c" />);
    expect(getByTestId('c', HIDDEN_OK)).toHaveStyle({ opacity: 1, width: 64, height: 64 });
    rerender(<Character mood="idle" size={64} dimmed testID="c" />);
    expect(getByTestId('c', HIDDEN_OK)).toHaveStyle({ opacity: DIMMED_OPACITY });
  });

  it('is hidden from screen readers unless it has a label', () => {
    const { getByTestId, rerender } = render(<Character mood="idle" size={40} testID="c" />);
    expect(getByTestId('c', HIDDEN_OK).props.accessibilityElementsHidden).toBe(true);
    expect(getByTestId('c', HIDDEN_OK).props.importantForAccessibility).toBe('no-hide-descendants');

    rerender(<Character mood="idle" size={40} testID="c" accessibilityLabel="Hoot, your coach" />);
    expect(getByTestId('c', HIDDEN_OK).props.accessibilityRole).toBe('image');
    expect(getByTestId('c', HIDDEN_OK).props.accessibilityLabel).toBe('Hoot, your coach');
    expect(getByTestId('c', HIDDEN_OK).props.accessibilityElementsHidden).toBe(false);
  });
});
