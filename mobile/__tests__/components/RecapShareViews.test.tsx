import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Recap } from '../../src/api/recaps';
import { RecapCardView } from '../../src/components/recap/RecapCardView';
import { WeeklyStoryView } from '../../src/components/recap/WeeklyStoryView';
import { YearPixelsView } from '../../src/components/recap/YearPixelsView';
import { resolveIncludes } from '../../src/lib/recapShare';
import { yearPixels } from '../../src/lib/yearPixels';

const BASE = { personaId: 'luna', builtAt: '2026-10-05T09:00:00.000Z', openedAt: null, sleepGoalMinutes: 480, lineSource: 'ai' as const, story: null, rebuiltAt: null };
const MONTH: Recap = {
  ...BASE, id: 'm', kind: 'MONTH', periodStart: '2026-09-01', periodEnd: '2026-09-30', line: 'Six nights in a row on goal, lovely.',
  stats: { nightsWithData: 25, avgSleepMinutes: 455, longestOnGoalStreak: 6, bestRecovery: { date: '2026-09-09', score: 88 } },
};
const WEEK: Recap = {
  ...BASE, id: 'w', kind: 'WEEK', periodStart: '2026-09-28', periodEnd: '2026-10-04', line: 'A steady week.',
  stats: {
    nightsWithData: 6, bestNight: { date: '2026-09-29', minutesAsleep: 500 },
    weekStrip: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((date, i) => ({
      date, minutesAsleep: i === 2 ? null : 480 - (i === 4 ? 60 : 0), onGoal: i === 2 ? null : i !== 4, recovery: null,
    })),
  },
};

describe('RecapCardView', () => {
  it('shows MY {MONTH}, the coach, the quote, the included stats and the app name at the design size × scale', () => {
    render(<RecapCardView recap={MONTH} coachId="luna" includes={resolveIncludes('card', {}, MONTH.stats)} scale={1.5} />);
    expect(screen.getByText('MY SEPTEMBER')).toBeTruthy();
    expect(screen.getByText('Luna')).toBeTruthy();
    expect(screen.getByTestId('recap-card-quote')).toHaveTextContent('“Six nights in a row on goal, lovely.”');
    expect(screen.getByTestId('recap-card-stat-bestRecovery')).toHaveTextContent('88Best recovery');
    expect(screen.queryByTestId('recap-card-stat-steps')).toBeNull();
    expect(screen.getByTestId('recap-card-app')).toHaveTextContent('Biometrics');
    expect(screen.getByTestId('recap-card')).toHaveStyle({ width: 540, height: 540 });
  });

  it('leaves out what is switched off', () => {
    render(<RecapCardView recap={MONTH} coachId="luna" includes={resolveIncludes('card', { quote: false, coach: false, streak: false }, MONTH.stats)} scale={1} />);
    expect(screen.queryByTestId('recap-card-quote')).toBeNull();
    expect(screen.queryByTestId('recap-card-coach')).toBeNull();
    expect(screen.queryByTestId('recap-card-stat-streak')).toBeNull();
  });
});

describe('WeeklyStoryView', () => {
  it('draws a 9:16 story with the Mon–Sun strip coloured by on goal, and the best night', () => {
    render(<WeeklyStoryView recap={WEEK} coachId="luna" includes={resolveIncludes('story', {}, WEEK.stats)} scale={1} />);
    expect(screen.getByTestId('recap-story-title')).toHaveTextContent('How Luna saw my week');
    expect(screen.getByTestId('recap-story-day-2026-09-28').props.accessibilityLabel).toBe('M: on goal');
    expect(screen.getByTestId('recap-story-day-2026-09-30').props.accessibilityLabel).toBe('W: no data');
    expect(screen.getByTestId('recap-story-day-2026-10-02').props.accessibilityLabel).toBe('F: short');
    expect(screen.getByTestId('recap-story-best')).toHaveTextContent('Best night · Tuesday · 8h 20m');
    expect(screen.getByTestId('recap-story')).toHaveStyle({ width: 360, height: 640 });
  });
});

describe('YearPixelsView', () => {
  it('shows the count and the current-goal caption', () => {
    const pixels = yearPixels(2026, [{ date: '2026-01-02', minutesAsleep: 500 }], 450, '2026-10-05');
    render(<YearPixelsView year={2026} pixels={pixels} goalMinutes={450} coachId="luna" includes={resolveIncludes('year', {}, null)} scale={1} palette="dark" />);
    expect(screen.getByTestId('year-pixels-count')).toHaveTextContent('1 night on goal');
    expect(screen.getByTestId('year-pixels-caption')).toHaveTextContent('on your current goal of 7h 30m');
    expect(screen.getByTestId('year-pixels-cell-2026-01-02').props.accessibilityLabel).toBe('goal');
  });
});
