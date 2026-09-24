import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ThoughtLine, formatThoughtTime } from '../../src/components/coach/thought-line';

describe('formatThoughtTime', () => {
  it.each([
    [0, '0.0s'],
    [2.44, '2.4s'],
    [59.96, '59.9s'],
    [63, '1m 3.0s'],
  ])('formats %p seconds as %p', (seconds, text) => {
    expect(formatThoughtTime(seconds)).toBe(text);
  });
});

describe('ThoughtLine', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the label and a timer from zero while working', () => {
    const { getByTestId, getByLabelText } = render(<ThoughtLine working testID="line" />);
    expect(getByTestId('line')).toHaveTextContent(/Thinking…/);
    expect(getByTestId('line-timer')).toHaveTextContent('0.0s');
    expect(getByLabelText('Thinking')).toBeTruthy();
  });

  it('counts the elapsed time up while working', () => {
    const { getByTestId } = render(<ThoughtLine working testID="line" />);
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(getByTestId('line-timer')).toHaveTextContent('1.2s');
  });

  it('settles to "Thought for" with the given elapsed time', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <ThoughtLine working={false} elapsedSeconds={2.4} testID="line" />,
    );
    expect(getByTestId('line')).toHaveTextContent(/Thought for 2\.4s$/);
    expect(getByLabelText('Thought for 2.4 seconds')).toBeTruthy();
    expect(queryByTestId('line-timer')).toBeNull();
  });

  it('settles in place with its own count when the caller gives no elapsed time', () => {
    const { getByTestId, rerender } = render(<ThoughtLine working testID="line" />);
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    rerender(<ThoughtLine working={false} testID="line" />);
    expect(getByTestId('line')).toHaveTextContent(/Thought for 3\.1s$/);
  });

  it('stops counting once settled', () => {
    const { getByTestId, rerender } = render(<ThoughtLine working testID="line" />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    rerender(<ThoughtLine working={false} testID="line" />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getByTestId('line')).toHaveTextContent(/Thought for 1\.0s$/);
  });
});
