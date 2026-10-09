import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NightDetail } from '../../src/components/activity-sheets';
import type { SleepNight } from '../../src/api/sleep';
import { FONTS } from '../../src/theme';

// Synthetic values only.
const NIGHT: SleepNight = {
  date: '2026-09-22',
  minutesAsleep: 467,
  minutesInBed: 486,
  bedtime: '23:52',
  wakeTime: '07:58',
  sleepScore: 71,
  minutesAwake: null,
  stageMinutes: null,
  hasStages: false,
};

const STEPS_LINK = { steps: 12480, onPress: () => {} };

describe('NightDetail', () => {
  it('opens the full night from the sheet', () => {
    const onOpenFull = jest.fn();
    const { getByTestId } = render(
      <NightDetail date="2026-09-22" night={NIGHT} goal={480} average={null} stepsLink={STEPS_LINK} onOpenFull={onOpenFull} />,
    );

    expect(getByTestId('night-open-full')).toHaveTextContent('Open full night');
    fireEvent.press(getByTestId('night-open-full'));

    expect(onOpenFull).toHaveBeenCalledTimes(1);
  });

  it('has no link without a recorded night', () => {
    const { queryByTestId } = render(
      <NightDetail date="2026-09-22" night={null} goal={480} average={null} stepsLink={STEPS_LINK} onOpenFull={jest.fn()} />,
    );

    expect(queryByTestId('night-open-full')).toBeNull();
  });

  it('sets the times in tabular figures and keeps the steps tile value to one shrinking line', () => {
    const { getByTestId, getByText } = render(
      <NightDetail date="2026-09-22" night={NIGHT} goal={480} average={null} stepsLink={STEPS_LINK} onOpenFull={jest.fn()} />,
    );
    for (const id of ['night-detail-bedtime', 'night-detail-wake']) {
      expect(StyleSheet.flatten(getByTestId(id).props.style)).toEqual(expect.objectContaining({ fontFamily: FONTS.sansSemibold, fontVariant: ['tabular-nums'] }));
    }
    expect(StyleSheet.flatten(getByTestId('night-detail-asleep').props.style)).toEqual(expect.objectContaining({ fontVariant: ['tabular-nums'] }));
    const steps = getByText('12,480');
    expect(steps.props.numberOfLines).toBe(1);
    expect(steps.props.adjustsFontSizeToFit).toBe(true);
    expect(StyleSheet.flatten(steps.props.style).fontVariant).toEqual(['tabular-nums']);
  });
});
