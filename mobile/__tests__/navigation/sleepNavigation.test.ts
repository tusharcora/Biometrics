import { openNight } from '../../src/navigation/sleepNavigation';

describe('openNight', () => {
  it('opens the night screen for the given date', () => {
    const nav = { navigate: jest.fn() };

    openNight(nav, '2026-10-08');

    expect(nav.navigate).toHaveBeenCalledTimes(1);
    expect(nav.navigate).toHaveBeenCalledWith('SleepNight', { date: '2026-10-08' });
  });
});
