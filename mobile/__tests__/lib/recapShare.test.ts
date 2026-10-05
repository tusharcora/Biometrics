import { availableIncludes, exportLayout, previewScale, recapCoachId, resolveIncludes } from '../../src/lib/recapShare';

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
