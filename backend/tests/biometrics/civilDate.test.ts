import { isValidTimeZone, localCivilDate, civilDateToUtcMidnight } from '../../src/biometrics/civilDate';

describe('isValidTimeZone', () => {
  it.each(['UTC', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Auckland'])('accepts %s', (tz) => {
    expect(isValidTimeZone(tz)).toBe(true);
  });

  it.each(['', 'Not/AZone', 'PST8PDT-ish', '+05:00', '-08:00', 'America/', 42, null, undefined, {}])(
    'rejects %p',
    (tz) => {
      expect(isValidTimeZone(tz)).toBe(false);
    },
  );
});

describe('localCivilDate', () => {
  it('is UTC-identical for UTC', () => {
    expect(localCivilDate(new Date('2026-09-02T23:59:59Z'), 'UTC')).toBe('2026-09-02');
    expect(localCivilDate(new Date('2026-09-03T00:00:00Z'), 'UTC')).toBe('2026-09-03');
  });

  // West of UTC: a session ending 22:30 local Sep 2 in Los Angeles (UTC-7 in
  // September) is 05:30Z on Sep 3 -- after UTC midnight, still local Sep 2.
  it('west of UTC: an end instant after UTC midnight but before local midnight is the earlier local date', () => {
    expect(localCivilDate(new Date('2026-09-03T05:30:00Z'), 'America/Los_Angeles')).toBe('2026-09-02');
    expect(localCivilDate(new Date('2026-09-03T07:00:00Z'), 'America/Los_Angeles')).toBe('2026-09-03');
  });

  // East of UTC: 00:30 local Sep 3 in Auckland (UTC+12 in early September)
  // is 12:30Z on Sep 2 -- before UTC midnight, already local Sep 3.
  it('east of UTC: an end instant before UTC midnight but after local midnight is the later local date', () => {
    expect(localCivilDate(new Date('2026-09-02T12:30:00Z'), 'Pacific/Auckland')).toBe('2026-09-03');
    expect(localCivilDate(new Date('2026-09-02T11:59:00Z'), 'Pacific/Auckland')).toBe('2026-09-02');
  });

  it('handles a half-hour offset zone', () => {
    // Asia/Kolkata is UTC+5:30: 18:30Z is exactly local midnight.
    expect(localCivilDate(new Date('2026-09-02T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-09-02');
    expect(localCivilDate(new Date('2026-09-02T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-09-03');
  });

  it('follows DST: the same UTC clock time maps to different local dates across a transition', () => {
    // US DST ends 2026-11-01: LA is UTC-7 before, UTC-8 after.
    expect(localCivilDate(new Date('2026-11-01T07:30:00Z'), 'America/Los_Angeles')).toBe('2026-11-01');
    expect(localCivilDate(new Date('2026-11-02T07:30:00Z'), 'America/Los_Angeles')).toBe('2026-11-01');
    expect(localCivilDate(new Date('2026-11-02T08:00:00Z'), 'America/Los_Angeles')).toBe('2026-11-02');
  });

  it('throws on an invalid zone rather than silently falling back to UTC', () => {
    expect(() => localCivilDate(new Date('2026-09-02T00:00:00Z'), 'Nope/Zone')).toThrow();
  });
});

describe('civilDateToUtcMidnight', () => {
  it('returns UTC midnight of the civil date, the recordedAt convention of every other metric', () => {
    expect(civilDateToUtcMidnight('2026-09-02')).toEqual(new Date('2026-09-02T00:00:00Z'));
  });
});
