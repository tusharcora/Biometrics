import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContext } from '@react-navigation/native';
import { YourCoachRow } from '../../src/components/your-coach-row';
import { characterLabel, withCharacter } from '../../jest-mocks/characterContext';
import type { CharacterId } from '../../src/components/characters/types';

const navigate = jest.fn();
let listeners: Record<string, () => void> = {};
const navigation = {
  navigate,
  isFocused: () => true,
  addListener: (event: string, cb: () => void) => {
    listeners[event] = cb;
    return () => {
      delete listeners[event];
    };
  },
};

function renderRow(characterId: CharacterId | null) {
  const row = (
    <NavigationContext.Provider value={navigation as never}>
      <YourCoachRow />
    </NavigationContext.Provider>
  );
  return render(characterId ? withCharacter(row, { characterId }) : row);
}

beforeEach(() => {
  jest.clearAllMocks();
  listeners = {};
});

describe('YourCoachRow', () => {
  it('shows the current character, small and animating, with its name', () => {
    const utils = renderRow('ember');

    expect(utils.getByTestId('your-coach-row')).toHaveTextContent(/Ember/);
    expect(characterLabel(utils, 'your-coach-row')).toBe('character:ember:idle:36:playing:mini');
  });

  it('is announced as "<Name>, your coach"', () => {
    const utils = renderRow('doze');

    expect(utils.getByLabelText('Doze, your coach')).toBeTruthy();
    expect(utils.getByTestId('your-coach-row').props.accessibilityLabel).toBe('Doze, your coach');
  });

  it('opens Meet your coach in switch mode', () => {
    const utils = renderRow('pip');

    fireEvent.press(utils.getByTestId('your-coach-row'));

    expect(navigate).toHaveBeenCalledWith('MeetYourCoach', { mode: 'switch' });
  });

  it('shows Hoot outside the provider', () => {
    const utils = renderRow(null);

    expect(utils.getByTestId('your-coach-row')).toHaveTextContent(/Hoot/);
    expect(characterLabel(utils, 'your-coach-row')).toBe('character:hoot:idle:36:playing:mini');
  });

  it('holds still while Profile is not focused and moves again on return', () => {
    const utils = renderRow('beat');

    act(() => listeners.blur?.());
    expect(characterLabel(utils, 'your-coach-row')).toBe('character:beat:idle:36:paused:mini');

    act(() => listeners.focus?.());
    expect(characterLabel(utils, 'your-coach-row')).toBe('character:beat:idle:36:playing:mini');
  });
});
