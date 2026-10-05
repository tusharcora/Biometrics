import { availableIncludes, exportLayout, fitQuote, previewScale, QUOTE_LINE_HEIGHT, quoteLines, recapCoachId, resolveIncludes } from '../../src/lib/recapShare';

// 30 words, 199 characters: the longest line the coach writes for a recap.
const LONG = 'Six nights running on goal this September, and your bedtimes finally settled into a calm, unhurried rhythm after a rocky start; protect that wind-down routine and October looks wonderfully promising.';

const FULL = { nightsWithData: 25, avgSleepMinutes: 455, longestOnGoalStreak: 6, bestRecovery: { date: '2026-09-09', score: 88 }, steps: { total: 210000, dailyAverage: 7000 } };

it('hides the switches of missing stats and a zero streak', () => {
  expect(availableIncludes('card', FULL)).toEqual(['avgSleep', 'streak', 'bestRecovery', 'steps', 'quote', 'coach']);
  expect(availableIncludes('card', { nightsWithData: 9, avgSleepMinutes: 400, longestOnGoalStreak: 0 })).toEqual(['avgSleep', 'quote', 'coach']);
  expect(availableIncludes('story', { nightsWithData: 4 })).toEqual(['quote', 'coach']);
  expect(availableIncludes('year', null)).toEqual(['count', 'coach']);
});

it('keeps every available switch on unless switched off, and every unavailable one off', () => {
  const inc = resolveIncludes('card', { quote: false }, { nightsWithData: 9, avgSleepMinutes: 400 });
  expect(inc).toMatchObject({ avgSleep: true, quote: false, coach: true, steps: false, streak: false, bestNight: false, count: false });
});

it('lays the export view out at 1080 / pixel ratio points (1080 px on any device)', () => {
  expect(exportLayout('card', 3)).toEqual({ width: 360, height: 360, scale: 1 });
  expect(exportLayout('card', 2)).toEqual({ width: 540, height: 540, scale: 1.5 });
  expect(exportLayout('story', 2)).toEqual({ width: 540, height: 960, scale: 1.5 });
  expect(exportLayout('year', 3)).toEqual({ width: 360, height: 360, scale: 1 });
});

it('fits a preview into its box', () => {
  expect(previewScale('card', 300, 1000)).toBeCloseTo(300 / 360);
  expect(previewScale('story', 360, 320)).toBeCloseTo(0.5);
});

it("shows the recap's own coach on the card and story, since the line is in that voice (ruling S6)", () => {
  expect(recapCoachId({ personaId: 'luna' }, 'mochi')).toBe('luna');
  expect(recapCoachId({ personaId: null }, 'mochi')).toBe('mochi');
  expect(recapCoachId({ personaId: 'retired-coach' }, 'boba')).toBe('boba');
});

it('wraps a quote word by word', () => {
  expect(quoteLines('Short.', 20, 304)).toBe(1);
  // At 10pt a 4-letter word is ~17pt wide, so a 30pt line holds one word.
  expect(quoteLines('aaaa bbbb cccc', 10, 30)).toBe(3);
});

it('keeps a short quote at its base size and shrinks a 30-word quote until it fits its box', () => {
  expect(fitQuote('A steady week.', 304, 76, 20)).toEqual({ fontSize: 20, lines: 1 });
  // The card's tightest box (coach and four stats on) and the story's.
  for (const [width, height, base] of [[304, 76, 20], [296, 160, 22]] as const) {
    const fit = fitQuote(`“${LONG}”`, width, height, base);
    expect(fit.fontSize).toBeLessThan(base);
    expect(fit.fontSize).toBeGreaterThanOrEqual(12);
    expect(fit.lines).toBe(quoteLines(`“${LONG}”`, fit.fontSize, width));
    expect(fit.lines * fit.fontSize * QUOTE_LINE_HEIGHT).toBeLessThanOrEqual(height);
  }
});
