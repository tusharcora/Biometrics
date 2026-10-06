import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { HIDDEN_OK } from '../../jest-mocks/characterContext';
import { contrast } from '../../src/components/characters/palette';
import { MilestoneTiles } from '../../src/components/milestones/MilestoneTiles';
import type { MilestoneTile } from '../../src/lib/milestones';
import { COLORS } from '../../src/theme';

const TILES: MilestoneTile[] = [
  { key: 'streak', label: '6 nights on goal in a row', glyph: 'star', earned: true },
  { key: 'bestRecoveryWeek', label: 'Best recovery week', glyph: 'heart', earned: false },
  { key: 'everyDayLogged', label: 'Every night logged', glyph: 'calendar', earned: false },
  { key: 'steadiestMonth', label: 'Steadiest bedtimes yet', glyph: 'moon', earned: true },
];

const opacityOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, HIDDEN_OK).props.style)?.opacity ?? 1;

it('lays every tile out three to a row, the last row padded so the columns stay put', () => {
  render(<MilestoneTiles tiles={TILES} testID="tiles" />);
  expect(screen.getByTestId('tiles-row-0').children).toHaveLength(3);
  // One tile and two empty slots.
  expect(screen.getByTestId('tiles-row-1').children).toHaveLength(3);
  expect(screen.queryByTestId('tiles-row-2')).toBeNull();
  expect(screen.getByTestId('tiles-steadiestMonth')).toHaveTextContent('Steadiest bedtimes yet');
});

const hex = (rgb: string) => '#' + rgb.match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join('');

it('draws an earned tile at full strength with its glyph; a locked one dims only its lock, its label muted but readable', () => {
  render(<MilestoneTiles tiles={TILES} testID="tiles" />);
  expect(opacityOf('tiles-streak')).toBe(1);
  expect(opacityOf('tiles-streak-icon')).toBe(1);
  expect(screen.getByTestId('tiles-streak-label')).toHaveStyle({ color: COLORS.light.foreground });
  expect(screen.getByTestId('tiles-streak-glyph', HIDDEN_OK)).toBeTruthy();
  expect(screen.queryByTestId('tiles-streak-lock', HIDDEN_OK)).toBeNull();
  expect(screen.getByTestId('tiles-streak').props.accessibilityLabel).toBe('6 nights on goal in a row, earned');

  // The tile itself stays at full opacity, so its label keeps its contrast.
  expect(opacityOf('tiles-bestRecoveryWeek')).toBe(1);
  expect(opacityOf('tiles-bestRecoveryWeek-icon')).toBe(0.5);
  expect(screen.getByTestId('tiles-bestRecoveryWeek-label')).toHaveStyle({ color: COLORS.light.muted });
  expect(screen.getByTestId('tiles-bestRecoveryWeek-lock', HIDDEN_OK)).toBeTruthy();
  expect(screen.queryByTestId('tiles-bestRecoveryWeek-glyph', HIDDEN_OK)).toBeNull();
  expect(screen.getByTestId('tiles-bestRecoveryWeek').props.accessibilityLabel).toBe('Best recovery week, locked');
  expect(screen.getByTestId('tiles-bestRecoveryWeek')).toHaveTextContent('Best recovery week');
});

it.each(['light', 'dark'] as const)('keeps the muted label at 4.5:1 on the %s tile', (scheme) => {
  expect(contrast(hex(COLORS[scheme].muted), hex(COLORS[scheme].card))).toBeGreaterThanOrEqual(4.5);
});
