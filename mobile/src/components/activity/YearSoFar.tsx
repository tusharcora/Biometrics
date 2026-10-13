// "2026 so far" (A-2), beside the month stats: the year's total, daily average and goal days, steps or sleep.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ACTIVITY_COPY, compactSteps } from '../../lib/activityCopy';
import { yearSoFar } from '../../lib/activityWeek';
import type { ValuesByDate } from '../../lib/heatmap';
import { formatDuration } from '../../lib/sleepStats';
import { METRIC_CONFIG } from '../../theme';
import { SectionError } from '../sleep/Section';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';

const COPY = ACTIVITY_COPY.year;
type Metric = 'steps' | 'sleep';

export type YearSleep = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; minutes: ValuesByDate };

function Figure({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-caption text-muted-foreground">{label}</Text>
      <Text testID={testID} className="text-heading tabular-nums" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function YearSoFar({ steps, sleep, today, stepGoal, sleepGoal, onRetrySleep }: {
  steps: ValuesByDate;
  sleep: YearSleep;
  today: string;
  stepGoal: number;
  sleepGoal: number;
  onRetrySleep: () => void;
}) {
  const [metric, setMetric] = useState<Metric>('steps');
  const stepYear = useMemo(() => yearSoFar(steps, today, stepGoal), [steps, today, stepGoal]);
  const sleepMinutes = sleep.phase === 'ready' ? sleep.minutes : null;
  const sleepYear = useMemo(() => (sleepMinutes ? yearSoFar(sleepMinutes, today, sleepGoal) : null), [sleepMinutes, today, sleepGoal]);

  let body: React.ReactNode;
  if (metric === 'steps') {
    body = (
      <>
        <Figure testID="year-total" label={COPY.total} value={compactSteps(stepYear.total)} />
        <Figure testID="year-average" label={COPY.average} value={stepYear.average === null ? ACTIVITY_COPY.stats.none : METRIC_CONFIG.STEPS.format(stepYear.average)} />
        <Figure testID="year-goal" label={COPY.goalDays} value={String(stepYear.goalDays)} />
      </>
    );
  } else if (sleep.phase === 'error') {
    body = <SectionError testID="year-sleep-retry" message={COPY.error} onRetry={onRetrySleep} />;
  } else if (!sleepYear) {
    body = <Skeleton testID="year-sleep-loading" className="h-32 w-full rounded-tile" />;
  } else {
    body = (
      <>
        <Figure testID="year-total" label={COPY.total} value={ACTIVITY_COPY.stats.hours(sleepYear.total)} />
        <Figure testID="year-average" label={ACTIVITY_COPY.stats.nightlyAverage} value={sleepYear.average === null ? ACTIVITY_COPY.stats.none : formatDuration(sleepYear.average)} />
        <Figure testID="year-goal" label={COPY.goalNights} value={String(sleepYear.goalDays)} />
      </>
    );
  }

  return (
    <Card testID="year-so-far" className="flex-1 gap-3 p-3">
      <SectionLabel>{COPY.label(today.slice(0, 4))}</SectionLabel>
      <View accessibilityRole="tablist" className="flex-row gap-1.5">
        {(['steps', 'sleep'] as const).map((m) => (
          <Button
            key={m}
            testID={`year-tab-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: metric === m }}
            variant={metric === m ? 'default' : 'outline'}
            size="xs"
            className="flex-1"
            onPress={() => setMetric(m)}
          >
            {ACTIVITY_COPY.tabs[m]}
          </Button>
        ))}
      </View>
      {body}
    </Card>
  );
}
