import nock from 'nock';
import { fetchMetricRange } from '../../src/health/client';

afterEach(() => nock.cleanAll());

describe('fetchMetricRange', () => {
  it('fetches STEPS via dailyRollUp on parent "steps"', async () => {
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp', (body) => {
        return (
          body.range?.start?.date?.year === 2026 &&
          body.range?.start?.date?.month === 9 &&
          body.range?.start?.date?.day === 1 &&
          body.range?.end?.date?.year === 2026 &&
          body.range?.end?.date?.month === 9 &&
          body.range?.end?.date?.day === 2 &&
          !('civilStartTime' in body) &&
          !('civilEndTime' in body)
        );
      })
      .reply(200, {
        rollupDataPoints: [
          {
            civilStartTime: { date: { year: 2026, month: 9, day: 1 } },
            civilEndTime: { date: { year: 2026, month: 9, day: 2 } },
            steps: { countSum: '8123' },
          },
        ],
      });

    const points = await fetchMetricRange('token-1', 'STEPS', '2026-09-01', '2026-09-02');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01'), value: 8123 }]);
  });

  it('fetches RESTING_HR via dailyRollUp on parent "heart-rate" (kebab-case)', async () => {
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp', (body) => {
        return (
          body.range?.start?.date?.year === 2026 &&
          body.range?.start?.date?.month === 9 &&
          body.range?.start?.date?.day === 1 &&
          body.range?.end?.date?.year === 2026 &&
          body.range?.end?.date?.month === 9 &&
          body.range?.end?.date?.day === 2 &&
          !('civilStartTime' in body) &&
          !('civilEndTime' in body)
        );
      })
      .reply(200, {
        rollupDataPoints: [
          {
            civilStartTime: { date: { year: 2026, month: 9, day: 1 } },
            civilEndTime: { date: { year: 2026, month: 9, day: 2 } },
            heartRate: { beatsPerMinuteMin: 52, beatsPerMinuteMax: 140, beatsPerMinuteAvg: 78 },
          },
        ],
      });

    const points = await fetchMetricRange('token-1', 'RESTING_HR', '2026-09-01', '2026-09-02');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01'), value: 52 }]);
  });

  it('fetches SLEEP via dataPoints.list on "sleep" using minutesAsleep from the summary', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => typeof q.filter === 'string' && q.filter.includes('sleep.interval.start_time'))
      .reply(200, {
        dataPoints: [
          {
            sleep: {
              interval: { startTime: '2026-09-01T22:00:00Z' },
              summary: { minutesAsleep: 415 },
            },
          },
        ],
      });

    const points = await fetchMetricRange('token-1', 'SLEEP', '2026-09-01', '2026-09-02');
    // recordedAt is keyed on UTC-midnight of the session's start date, the
    // same day-keying convention STEPS/RESTING_HR use, not the raw instant.
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01T00:00:00Z'), value: 415 }]);
  });

  it('keys each SLEEP session on the UTC calendar date of its start, one point per session', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, {
        dataPoints: [
          { sleep: { interval: { startTime: '2026-09-01T22:15:00Z' }, summary: { minutesAsleep: 415 } } },
          { sleep: { interval: { startTime: '2026-09-02T23:40:00Z' }, summary: { minutesAsleep: 390 } } },
        ],
      });

    const points = await fetchMetricRange('token-1', 'SLEEP', '2026-09-01', '2026-09-03');
    expect(points).toEqual([
      { recordedAt: new Date('2026-09-01T00:00:00Z'), value: 415 },
      { recordedAt: new Date('2026-09-02T00:00:00Z'), value: 390 },
    ]);
  });

  it('fetches HRV via dataPoints.list on "heartRateVariability", returning the last sample of EACH day', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/heartRateVariability/dataPoints')
      .query((q) => typeof q.filter === 'string' && q.filter.includes('heartRateVariability.sample_time.physical_time'))
      .reply(200, {
        // Deliberately out of chronological order, spanning three days with
        // multiple samples on two of them, to prove grouping is per-day and
        // "last" is chronological rather than positional.
        dataPoints: [
          { heartRateVariability: { sampleTime: { physicalTime: '2026-09-02T23:30:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 45.1 } },
          { heartRateVariability: { sampleTime: { physicalTime: '2026-09-01T06:00:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 38.2 } },
          { heartRateVariability: { sampleTime: { physicalTime: '2026-09-03T04:10:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 50.0 } },
          { heartRateVariability: { sampleTime: { physicalTime: '2026-09-01T23:00:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 41.7 } },
          { heartRateVariability: { sampleTime: { physicalTime: '2026-09-02T07:45:00Z' }, rootMeanSquareOfSuccessiveDifferencesMilliseconds: 43.9 } },
        ],
      });

    const points = await fetchMetricRange('token-1', 'HRV', '2026-09-01', '2026-09-04');

    // One point per day that had a sample (3 days -> 3 points, NOT 1), each the
    // chronologically last sample of that day, keyed on UTC midnight.
    expect(points).toHaveLength(3);
    expect(points).toEqual([
      { recordedAt: new Date('2026-09-01T00:00:00Z'), value: 41.7 },
      { recordedAt: new Date('2026-09-02T00:00:00Z'), value: 45.1 },
      { recordedAt: new Date('2026-09-03T00:00:00Z'), value: 50.0 },
    ]);
  });

  it('returns no HRV points when the range has no samples', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/heartRateVariability/dataPoints')
      .query(true)
      .reply(200, { dataPoints: [] });

    expect(await fetchMetricRange('token-1', 'HRV', '2026-09-01', '2026-09-02')).toEqual([]);
  });

  // Documents the range semantics callers must honour: dataPoints.list is
  // filtered half-open (`>= start AND < end`), so start === end is an
  // unsatisfiable filter and can never return anything. A caller wanting a
  // single day must pass [day, day + 1) -- see handleFetchJob in sync/worker.ts.
  it('builds a half-open dataPoints.list filter, so startDate === endDate is an empty range', async () => {
    let capturedFilter: string | undefined;
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => {
        capturedFilter = q.filter as string;
        return true;
      })
      .reply(200, { dataPoints: [] });

    await fetchMetricRange('token-1', 'SLEEP', '2026-09-01', '2026-09-01');

    expect(capturedFilter).toBe(
      'sleep.interval.start_time >= "2026-09-01T00:00:00Z" AND sleep.interval.start_time < "2026-09-01T00:00:00Z"',
    );
  });

  it('rejects a malformed date string instead of sending Google NaN date parts', async () => {
    await expect(fetchMetricRange('token-1', 'STEPS', '2026-9', '2026-09-02')).rejects.toThrow(
      'Invalid date string "2026-9": expected YYYY-MM-DD',
    );
    await expect(fetchMetricRange('token-1', 'STEPS', '2026-09-01', 'not-a-date')).rejects.toThrow(
      /Invalid date string/,
    );
  });

  it('throws when dailyRollUp returns a non-200 status', async () => {
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp')
      .reply(500, {});

    await expect(fetchMetricRange('token-1', 'STEPS', '2026-09-01', '2026-09-02')).rejects.toThrow();
  });

  it('throws when dataPoints.list returns a non-200 status', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(500, {});

    await expect(fetchMetricRange('token-1', 'SLEEP', '2026-09-01', '2026-09-02')).rejects.toThrow();
  });
});
