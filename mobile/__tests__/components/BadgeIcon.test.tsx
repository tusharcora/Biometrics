import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BadgeIcon } from '../../src/components/achievements/BadgeIcon';
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
  expect(screen.getByTestId('b-pip-5')).toHaveStyle({ backgroundColor: '#A3E635', width: 7, height: 7 });
});

it('takes an explicit KIP colour and can leave the pips out', () => {
  setMyKipColour('lime');
  render(<BadgeIcon family="SLEEP_GOAL" level={5} size={44} testID="b" colour="cobalt" />);
  expect(screen.getByTestId('b-pip-5')).toHaveStyle({ backgroundColor: '#3B82F6' });
  render(<BadgeIcon family="SLEEP_GOAL" level={5} size={44} pips={false} colour="cobalt" testID="c" />);
  expect(screen.queryByTestId('c-pips')).toBeNull();
});
