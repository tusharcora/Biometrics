import React from 'react';
import { act, render } from '@testing-library/react-native';
import { LatticeLoader, formatElapsed } from '../../src/components/coach/lattice-loader';

describe('formatElapsed', () => {
  it.each([
    [0, '0.0s'],
    [2.44, '2.4s'],
    [59.96, '59.9s'],
    [63, '1m 3.0s'],
  ])('formats %p seconds as %p', (seconds, text) => {
    expect(formatElapsed(seconds)).toBe(text);
  });
});

describe('LatticeLoader', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws a 3x3 orbit while working: eight ring dots around an empty centre', () => {
    const { getAllByTestId, getByTestId, queryAllByTestId } = render(<LatticeLoader status="working" testID="ll" />);
    expect(getAllByTestId(/^ll-dot-\d$/)).toHaveLength(8);
    expect(getByTestId('ll-hole')).toBeTruthy();
    expect(queryAllByTestId(/^ll-mark-on-/)).toHaveLength(0);
  });

  it('shows the label and a timer from zero while working', () => {
    const { getByTestId, getByLabelText } = render(<LatticeLoader status="working" testID="ll" />);
    expect(getByTestId('ll')).toHaveTextContent(/Thinking/);
    expect(getByTestId('ll-timer')).toHaveTextContent('0.0s');
    expect(getByLabelText('Thinking, in progress')).toBeTruthy();
  });

  it('counts the elapsed time up while working', () => {
    const { getByTestId } = render(<LatticeLoader status="working" testID="ll" />);
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(getByTestId('ll-timer')).toHaveTextContent('1.2s');
  });

  it('settles into a check mark and "Done in" with the given elapsed time', () => {
    const { getByTestId, getByLabelText, getAllByTestId, queryAllByTestId, queryByTestId } = render(
      <LatticeLoader status="done" elapsedSeconds={2.4} testID="ll" />,
    );
    // The check is drawn with four dots: top right, middle left, middle right, bottom middle.
    expect(getAllByTestId(/^ll-mark-on-\d$/).map((d) => d.props.testID)).toEqual([
      'll-mark-on-2',
      'll-mark-on-3',
      'll-mark-on-5',
      'll-mark-on-7',
    ]);
    expect(queryAllByTestId(/^ll-dot-\d$/)).toHaveLength(0);
    expect(getByTestId('ll')).toHaveTextContent(/Done in 2\.4s$/);
    expect(getByLabelText('Done in 2.4 seconds')).toBeTruthy();
    expect(queryByTestId('ll-timer')).toBeNull();
  });

  it('settles with its own count when the caller gives no elapsed time, and stops counting', () => {
    const { getByTestId, rerender } = render(<LatticeLoader status="working" testID="ll" />);
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    rerender(<LatticeLoader status="done" testID="ll" />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getByTestId('ll')).toHaveTextContent(/Done in 3\.1s$/);
  });
});
