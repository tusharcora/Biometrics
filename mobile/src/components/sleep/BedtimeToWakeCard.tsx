import React from 'react';
import { View } from 'react-native';
import type { SleepGoal, SleepNight } from '../../api/sleep';
import { addDays } from '../../lib/heatmap';
import { SLEEP_COPY } from '../../lib/sleepCopy';
import { isNapOnly } from '../../lib/sleepStats';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { SegmentedControl } from '../ui/segmented-control';
import { WindowChart } from './WindowChart';

export type SleepRange = 'week' | 'two-weeks';

// Bedtime to wake over A-6..A or A-13..A (spec §3.9). Nap-only dates are not nights (plan ruling 5).
export function BedtimeToWakeCard({ anchor, date, nights, goal, range, onRange, onSelect }: {
  anchor: string; date: string; nights: SleepNight[]; goal: SleepGoal | null; range: SleepRange;
  onRange: (r: SleepRange) => void; onSelect: (date: string) => void;
}) {
  const days = range === 'week' ? 7 : 14;
  const dates = Array.from({ length: days }, (_, i) => addDays(anchor, i - (days - 1)));
  return (
    <Card testID="sleep-window-card" className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <SectionLabel>{SLEEP_COPY.bedtimeToWake}</SectionLabel>
        <View style={{ width: 168 }}>
          <SegmentedControl
            testID="sleep-range"
            options={[{ value: 'week', label: SLEEP_COPY.rangeWeek }, { value: 'two-weeks', label: SLEEP_COPY.rangeTwoWeeks }]}
            value={range}
            onChange={onRange}
          />
        </View>
      </View>
      <WindowChart dates={dates} nights={nights.filter((n) => !isNapOnly(n))} goal={goal} selectedDate={date} onPressNight={onSelect} />
    </Card>
  );
}
