import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NightDetail } from '../../src/components/activity-sheets';
import type { SleepNight } from '../../src/api/sleep';

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
});
