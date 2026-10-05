import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { HIDDEN_OK } from '../../jest-mocks/characterContext';
import { MilestoneTiles, type MilestoneTile } from '../../src/components/milestones/MilestoneTiles';

const TILES: MilestoneTile[] = [
  { key: 'streak', label: '6 nights on goal in a row', glyph: 'star', earned: true },
  { key: 'bestRecoveryWeek', label: 'Best recovery week', glyph: 'heart', earned: false },
  { key: 'everyDayLogged', label: 'Every night logged', glyph: 'calendar', earned: false },
  { key: 'steadiestMonth', label: 'Steadiest bedtimes yet', glyph: 'moon', earned: true },
];

const opacityOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)?.opacity ?? 1;

it('lays every tile out three to a row, the last row padded so the columns stay put', () => {
  render(<MilestoneTiles tiles={TILES} testID="tiles" />);
  expect(screen.getByTestId('tiles-row-0').children).toHaveLength(3);
  // One tile and two empty slots.
  expect(screen.getByTestId('tiles-row-1').children).toHaveLength(3);
  expect(screen.queryByTestId('tiles-row-2')).toBeNull();
  expect(screen.getByTestId('tiles-steadiestMonth')).toHaveTextContent('Steadiest bedtimes yet');
});

it('draws an earned tile at full strength with its glyph, a locked one dimmed with a lock', () => {
  render(<MilestoneTiles tiles={TILES} testID="tiles" />);
  expect(opacityOf('tiles-streak')).toBe(1);
  expect(screen.getByTestId('tiles-streak-glyph', HIDDEN_OK)).toBeTruthy();
  expect(screen.queryByTestId('tiles-streak-lock', HIDDEN_OK)).toBeNull();
  expect(screen.getByTestId('tiles-streak').props.accessibilityLabel).toBe('6 nights on goal in a row, earned');

  expect(opacityOf('tiles-bestRecoveryWeek')).toBe(0.5);
  expect(screen.getByTestId('tiles-bestRecoveryWeek-lock', HIDDEN_OK)).toBeTruthy();
  expect(screen.queryByTestId('tiles-bestRecoveryWeek-glyph', HIDDEN_OK)).toBeNull();
  expect(screen.getByTestId('tiles-bestRecoveryWeek').props.accessibilityLabel).toBe('Best recovery week, locked');
  expect(screen.getByTestId('tiles-bestRecoveryWeek')).toHaveTextContent('Best recovery week');
});
