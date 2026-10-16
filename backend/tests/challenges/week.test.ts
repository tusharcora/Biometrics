// The challenge clock's dev pin (P4 plan, PF4-F5): CHALLENGE_NOW moves the clock on a dev server only, never in
// production, and the Jest setup clears it so a dev shell's value never leaks into a run.
import { mondayOf, pinnedNow, previousWeek } from '../../src/challenges/week';

it('the Jest setup deletes CHALLENGE_NOW', () => {
  const was = process.env.CHALLENGE_NOW;
  process.env.CHALLENGE_NOW = '2026-10-28T12:00:00.000Z';
  try {
    jest.isolateModules(() => { require('../setupEnv'); });
    expect(process.env.CHALLENGE_NOW).toBeUndefined();
  } finally {
    if (was === undefined) delete process.env.CHALLENGE_NOW;
    else process.env.CHALLENGE_NOW = was;
  }
});

it('CHALLENGE_NOW pins the clock outside production and is ignored in production', () => {
  const at = '2026-10-28T12:00:00.000Z';
  expect(pinnedNow({ CHALLENGE_NOW: at, NODE_ENV: 'development' })?.toISOString()).toBe(at);
  expect(pinnedNow({ CHALLENGE_NOW: at })?.toISOString()).toBe(at);
  expect(pinnedNow({ CHALLENGE_NOW: at, NODE_ENV: 'production' })).toBeNull();
  expect(pinnedNow({ CHALLENGE_NOW: 'not a date' })).toBeNull();
  expect(pinnedNow({})).toBeNull();
});

it('Mondays and the week before, across a year end', () => {
  expect(mondayOf('2026-W44')).toBe('2026-10-26');
  expect(mondayOf('2026-W01')).toBe('2025-12-29');
  expect(previousWeek('2026-W01')).toBe('2025-W52');
  expect(previousWeek('2026-W44')).toBe('2026-W43');
  expect(() => mondayOf('2026-W99')).toThrow();
});
