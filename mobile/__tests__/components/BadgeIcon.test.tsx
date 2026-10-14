import React from 'react';
import { StyleSheet } from 'react-native';
import { Polygon } from 'react-native-svg';
import { render, screen, within } from '@testing-library/react-native';
import { BadgeIcon } from '../../src/components/achievements/BadgeIcon';
import { TIER_SURFACE, tierInk } from '../../src/lib/badgeArt';
import { contrast } from '../../src/lib/colour';
import { resetMyKipColour, setMyKipColour } from '../../src/lib/kip/myKipColour';

afterEach(() => resetMyKipColour());

it('names the family, level and tier for screen readers, and fills one pip per level', () => {
  render(<BadgeIcon family="SLEEP_GOAL" level={3} size={58} testID="b" />);
  expect(screen.getByTestId('b').props.accessibilityLabel).toBe('Sleep goal streak, level III, Gold');
  for (const i of [1, 2, 3]) expect(screen.getByTestId(`b-pip-${i}`)).toHaveStyle({ backgroundColor: '#FACC15', width: 4, height: 4 });
  for (const i of [4, 5]) expect(screen.getByTestId(`b-pip-${i}`)).toHaveStyle({ backgroundColor: '#3F3F46' });
});

it('draws a locked badge grey', () => {
  render(<BadgeIcon family="CHECK_IN" level={0} size={58} testID="b" />);
  expect(screen.getByTestId('b').props.accessibilityLabel).toBe('Daily check-in, locked');
  for (const i of [1, 2, 3, 4, 5]) expect(screen.getByTestId(`b-pip-${i}`)).toHaveStyle({ backgroundColor: '#3F3F46' });
});

it("draws level V (Legend) in your KIP's colour", () => {
  setMyKipColour('lime');
  render(<BadgeIcon family="STEP_GOAL" level={5} size={100} testID="b" />);
  expect(screen.getByTestId('b').props.accessibilityLabel).toBe('Step goal streak, level V, Legend');
  // The ring art is the raw colour; the pips are a UI mark, lifted until they read on the page.
  expect(within(screen.getByTestId('b')).UNSAFE_getAllByType(Polygon)[0]!.props.fill).toBe('#A3E635');
  const pip = tierInk(5, 'lime', TIER_SURFACE.light).ring;
  expect(screen.getByTestId('b-pip-5')).toHaveStyle({ backgroundColor: pip, width: 7, height: 7 });
  expect(contrast(pip, TIER_SURFACE.light)).toBeGreaterThanOrEqual(4.5);
});

it('makes level-V pips read on the surface it is given (a dark share card)', () => {
  render(<BadgeIcon family="STEP_GOAL" level={5} size={100} colour="ink" pipSurface="#0B0B0F" testID="b" />);
  const pip = StyleSheet.flatten(screen.getByTestId('b-pip-5').props.style).backgroundColor as string;
  expect(contrast(pip, '#0B0B0F')).toBeGreaterThanOrEqual(4.5);
});

it('takes an explicit KIP colour and can leave the pips out', () => {
  setMyKipColour('lime');
  render(<BadgeIcon family="SLEEP_GOAL" level={5} size={44} testID="b" colour="cobalt" />);
  expect(screen.getByTestId('b-pip-5')).toHaveStyle({ backgroundColor: tierInk(5, 'cobalt', TIER_SURFACE.light).ring });
  render(<BadgeIcon family="SLEEP_GOAL" level={5} size={44} pips={false} colour="cobalt" testID="c" />);
  expect(screen.queryByTestId('c-pips')).toBeNull();
});
