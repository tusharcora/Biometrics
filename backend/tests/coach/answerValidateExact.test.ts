import type { FactSheet } from '../../src/coach/answer/facts';
import { countDisplay } from '../../src/coach/answer/facts';
import { validateSentence } from '../../src/coach/answer/validate';

const EXACT = { exactNumbers: true } as const;
const ok = { ok: true };
const unknown = { ok: false, reason: 'unknown_number' };

const RECAP: FactSheet = {
  route: 'recap',
  facts: [
    { id: 'sleep.goal', label: 'Sleep goal', value: 480, unit: 'minutes', display: '8h 0m' },
    { id: 'sleep.nights', label: 'Nights with sleep recorded this week', value: 6, unit: 'nights', display: '6 nights' },
    { id: 'sleep.avg', label: 'Average sleep a night', value: 432, unit: 'minutes', display: '7h 12m' },
    { id: 'sleep.on_goal', label: 'Nights at or above the sleep goal', value: 5, unit: 'nights', display: '5 nights' },
    { id: 'sleep.streak', label: 'Most nights on goal in a row', value: 4, unit: 'nights', display: '4 nights' },
    { id: 'recovery.best', label: 'Best recovery (Thursday)', value: 87, unit: 'score', display: '87/100' },
    { id: 'recovery.avg', label: 'Average recovery', value: 71, unit: 'score', display: '71/100' },
    { id: 'steps.total', label: 'Steps in total', value: 52340, unit: 'count', display: '52,340' },
    { id: 'steps.daily_avg', label: 'Average steps a day', value: 7477, unit: 'count', display: '7,477' },
    { id: 'sleep.days_logged', label: 'Days with sleep logged', value: 31, unit: 'days', display: '31 days' },
  ],
  notes: [],
};
const TIMES: FactSheet = {
  route: 'recap',
  facts: [{ id: 'sleep.early', label: 'Early nights', value: 3, unit: 'times', display: '3 times' }],
  notes: [],
};

describe('validateSentence with exactNumbers (recaps)', () => {
  it('rejects a night count that is off by one (6 vs 5)', () => {
    const sheet: FactSheet = {
      route: 'recap',
      facts: [
        { id: 'sleep.nights', label: 'Nights with sleep recorded this week', value: 7, unit: 'nights', display: '7 nights' },
        { id: 'sleep.on_goal', label: 'Nights at or above the sleep goal', value: 5, unit: 'nights', display: '5 nights' },
      ],
      notes: [],
    };
    expect(validateSentence('You reached your goal on 5 nights.', sheet, EXACT)).toEqual(ok);
    expect(validateSentence('You reached your goal on 6 nights.', sheet, EXACT)).toEqual(unknown);
  });

  it('rejects a score off by one (88 vs 87) that the chat check accepts', () => {
    expect(validateSentence('Your best recovery was 87/100.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('Your best recovery was 88/100.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('Your best recovery was 88/100.', RECAP)).toEqual(ok);
  });

  it('checks "7-night streak" and "last 7 nights" as numbers instead of exempting them', () => {
    expect(validateSentence('That was a 4-night streak.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('That was a 7-night streak.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('That was a 7-night streak.', RECAP)).toEqual(ok);
    expect(validateSentence('Over the last 7 nights you slept well.', RECAP, EXACT)).toEqual(unknown);
  });

  it('never lets a steps sentence borrow a night count', () => {
    expect(validateSentence('Your steps averaged 6 a day.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('You walked 6 steps.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('You walked 52,340 steps, 7,477 a day.', RECAP, EXACT)).toEqual(ok);
  });

  it('lets a bare number match only a count fact, and a night count only next to "nights"', () => {
    expect(validateSentence('You were on goal 5 of 6 nights.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('Recovery averaged 71.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('Recovery averaged 71/100.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('You hit 5.', RECAP, EXACT)).toEqual(unknown);
  });

  it('gives hedges no tolerance and durations exactly ±1 minute', () => {
    expect(validateSentence('You slept about 7 hours a night.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('You slept about 7 hours a night.', RECAP)).toEqual(ok);
    expect(validateSentence('You slept 7h 13m a night.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('You slept 7.2 hours a night.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('You slept 7h 14m a night.', RECAP, EXACT)).toEqual(unknown);
  });

  it('reads number words before night, day and time nouns (Review Focus 2)', () => {
    expect(validateSentence('You were on goal five nights.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('You were on goal seven nights.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('That was a seven-night run.', RECAP, EXACT)).toEqual(unknown);
    // The chat check leaves the words alone, which is why recaps need the stricter mode.
    expect(validateSentence('You were on goal seven nights.', RECAP)).toEqual(ok);
  });

  it('keeps days and times as their own families', () => {
    expect(validateSentence('Sleep was logged on 31 days.', RECAP, EXACT)).toEqual(ok);
    expect(validateSentence('Sleep was logged on 31 nights.', RECAP, EXACT)).toEqual(unknown);
    expect(validateSentence('You turned in early 3 times.', TIMES, EXACT)).toEqual(ok);
    expect(validateSentence('You turned in early 4 times.', TIMES, EXACT)).toEqual(unknown);
  });

  it('keeps dates, times of day and the /100 scale exempt', () => {
    expect(validateSentence('On Oct 9 you went to bed at 10:30pm and slept 7h 12m.', RECAP, EXACT)).toEqual(ok);
  });

  it('formats count units', () => {
    expect(countDisplay('nights', 1)).toBe('1 night');
    expect(countDisplay('days', 31)).toBe('31 days');
    expect(countDisplay('times', 3)).toBe('3 times');
  });

  it('reads the singular "time" too (pre-flight M12)', () => {
    const once: FactSheet = {
      route: 'recap',
      facts: [{ id: 'sleep.early', label: 'Early nights', value: 1, unit: 'times', display: '1 time' }],
      notes: [],
    };
    expect(validateSentence('You turned in early 1 time.', once, EXACT)).toEqual(ok);
    expect(validateSentence('You turned in early one time.', once, EXACT)).toEqual(ok);
    expect(validateSentence('You turned in early 2 time.', once, EXACT)).toEqual(unknown);
  });
});
