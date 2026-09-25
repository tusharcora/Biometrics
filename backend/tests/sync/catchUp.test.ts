import { catchUpWindow } from '../../src/sync/catchUp';

describe('catchUpWindow', () => {
  it('starts the day before the last sync and ends after today', () => {
    expect(catchUpWindow(new Date('2026-09-23T15:42:00Z'), '2026-09-24', 'UTC')).toEqual({
      startDate: '2026-09-22',
      endDate: '2026-09-25',
    });
  });

  it('uses the civil date of the last sync in the user time zone', () => {
    // 02:00 UTC on the 23rd is still the evening of the 22nd in New York.
    expect(catchUpWindow(new Date('2026-09-23T02:00:00Z'), '2026-09-24', 'America/New_York')).toEqual({
      startDate: '2026-09-21',
      endDate: '2026-09-25',
    });
  });

  it('caps the window at 14 days', () => {
    expect(catchUpWindow(new Date('2026-07-01T00:00:00Z'), '2026-09-24', 'UTC')).toEqual({
      startDate: '2026-09-11',
      endDate: '2026-09-25',
    });
  });

  it('covers the last 14 days when there was never a sync', () => {
    expect(catchUpWindow(null, '2026-09-24', 'UTC')).toEqual({ startDate: '2026-09-11', endDate: '2026-09-25' });
  });

  it('still covers yesterday and today when the last sync was today', () => {
    expect(catchUpWindow(new Date('2026-09-24T09:00:00Z'), '2026-09-24', 'UTC')).toEqual({
      startDate: '2026-09-23',
      endDate: '2026-09-25',
    });
  });
});
