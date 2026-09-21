import React from 'react';
import { render } from '@testing-library/react-native';
import { Orb, DIMMED_OPACITY } from '../../src/components/orb/Orb';

let mockScheme: 'light' | 'dark' | undefined = 'dark';
jest.mock('nativewind', () => ({ useColorScheme: () => ({ colorScheme: mockScheme }) }));

describe('Orb', () => {
  it('passes state, size and pause to the orb and pins its theme to the app theme', () => {
    mockScheme = 'light';
    const { getByTestId } = render(<Orb state="breathing" size={64} paused testID="o" />);

    expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('breathing:64:paused:light');
  });

  it('defaults to the dark ink when the scheme is not known', () => {
    mockScheme = undefined;
    const { getByTestId } = render(<Orb state="working" size={20} />);

    expect(getByTestId('thinking-orb').props.accessibilityLabel).toBe('working:20:playing:dark');
  });

  it('is full opacity normally and dimmed when asked', () => {
    mockScheme = 'dark';
    const { getByTestId, rerender } = render(<Orb state="breathing" size={64} testID="o" />);
    expect(getByTestId('o')).toHaveStyle({ opacity: 1 });

    rerender(<Orb state="breathing" size={64} dimmed testID="o" />);
    expect(getByTestId('o')).toHaveStyle({ opacity: DIMMED_OPACITY });
  });

  it('is exactly its size square', () => {
    mockScheme = 'dark';
    const { getByTestId } = render(<Orb state="breathing" size={64} testID="o" />);
    expect(getByTestId('o')).toHaveStyle({ width: 64, height: 64 });
  });
});
