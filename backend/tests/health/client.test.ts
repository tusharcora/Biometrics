import nock from 'nock';
import { fetchMetricRange, fetchSleepSessions } from '../../src/health/client';

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

  it('fetches sleep sessions via dataPoints.list on "sleep", one per API object, with start/end/minutesAsleep', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => typeof q.filter === 'string' && q.filter.includes('sleep.interval.end_time'))
      .reply(200, {
        dataPoints: [
          {
            sleep: {
              interval: { startTime: '2026-09-01T22:00:00Z', endTime: '2026-09-02T06:10:00Z' },
              // Confirmed live: minutesAsleep is a numeric string, the same
              // string-encoded-int64 pattern as steps' countSum.
              summary: { minutesAsleep: '415' },
            },
          },
          {
            sleep: {
              interval: { startTime: '2026-09-02T13:00:00Z', endTime: '2026-09-02T13:50:00Z' },
              summary: { minutesAsleep: '45' },
            },
          },
        ],
      });

    const sessions = await fetchSleepSessions('token-1', '2026-09-01', '2026-09-03');
    // Whole sessions, NOT collapsed to one value per day: two sessions on one
    // day stay two objects so the caller can store and sum them idempotently.
    expect(sessions).toEqual([
      { startTime: new Date('2026-09-01T22:00:00Z'), endTime: new Date('2026-09-02T06:10:00Z'), minutesAsleep: 415 },
      { startTime: new Date('2026-09-02T13:00:00Z'), endTime: new Date('2026-09-02T13:50:00Z'), minutesAsleep: 45 },
    ]);
  });

  it('skips sleep objects missing an interval bound or minutesAsleep instead of guessing', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, {
        dataPoints: [
          { sleep: { interval: { startTime: '2026-09-01T22:00:00Z' }, summary: { minutesAsleep: '415' } } },
          { sleep: { interval: { startTime: '2026-09-01T22:00:00Z', endTime: '2026-09-02T06:00:00Z' }, summary: {} } },
          { sleep: { interval: { startTime: 'garbage', endTime: '2026-09-02T06:00:00Z' }, summary: { minutesAsleep: '1' } } },
          { sleep: { interval: { startTime: '2026-09-03T22:00:00Z', endTime: '2026-09-04T06:00:00Z' }, summary: { minutesAsleep: '400' } } },
        ],
      });

    const sessions = await fetchSleepSessions('token-1', '2026-09-01', '2026-09-05');
    expect(sessions).toEqual([
      { startTime: new Date('2026-09-03T22:00:00Z'), endTime: new Date('2026-09-04T06:00:00Z'), minutesAsleep: 400 },
    ]);
  });

  it('fetches HRV via dataPoints.list on the separate "daily-heart-rate-variability" collection, one point per day', async () => {
    // Confirmed live against a real Fitbit-linked account: HRV is a daily
    // pre-aggregated type, not sample-based. dailyRollUp explicitly rejects
    // it ("DailyRollup is not supported for data type
    // heart-rate-variability, only list/reconcile supported"), and its data
    // lives under a *separate* URL collection (hyphenated:
    // daily-heart-rate-variability) from the raw heart-rate-variability
    // collection, filtered by an underscored `daily_heart_rate_variability.date`
    // civil-date literal (no time component, unlike the other filter types).
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints')
      .query((q) => typeof q.filter === 'string' && q.filter.includes('daily_heart_rate_variability.date'))
      .reply(200, {
        dataPoints: [
          {
            dataSource: { recordingMethod: 'DERIVED', device: { displayName: 'Google Fitbit Air' }, platform: 'FITBIT' },
            dailyHeartRateVariability: {
              date: { year: 2026, month: 9, day: 14 },
              averageHeartRateVariabilityMilliseconds: 69.6,
              nonRemHeartRateBeatsPerMinute: '44',
              entropy: 3.758,
              deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 81.1,
            },
          },
          {
            dataSource: { recordingMethod: 'DERIVED', device: { displayName: 'Google Fitbit Air' }, platform: 'FITBIT' },
            dailyHeartRateVariability: {
              date: { year: 2026, month: 9, day: 13 },
              averageHeartRateVariabilityMilliseconds: 91.8,
              nonRemHeartRateBeatsPerMinute: '41',
              entropy: 3.827,
              deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds: 118.1,
            },
          },
        ],
      });

    const points = await fetchMetricRange('token-1', 'HRV', '2026-09-13', '2026-09-15');

    // Already one row per day from Google -- no day-grouping needed. Order
    // follows the response (Google returns most-recent-first).
    expect(points).toEqual([
      { recordedAt: new Date('2026-09-14T00:00:00Z'), value: 69.6 },
      { recordedAt: new Date('2026-09-13T00:00:00Z'), value: 91.8 },
    ]);
  });

  it('returns no HRV points when the range has no data', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints')
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

    await fetchSleepSessions('token-1', '2026-09-01', '2026-09-01');

    expect(capturedFilter).toBe(
      'sleep.interval.end_time >= "2026-09-01T00:00:00Z" AND sleep.interval.end_time < "2026-09-01T00:00:00Z"',
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

    await expect(fetchSleepSessions('token-1', '2026-09-01', '2026-09-02')).rejects.toThrow();
  });

  it('chunks a dailyRollUp request over 14 days into multiple <=14-day calls', async () => {
    // Confirmed live: heart-rate's dailyRollUp rejects any single request
    // spanning more than 14 days (INVALID_ROLLUP_QUERY_DURATION). A 20-day
    // range must become two calls: [09-01, 09-15) and [09-15, 09-21).
    const capturedRanges: unknown[] = [];
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp', (body) => {
        capturedRanges.push(body.range);
        return true;
      })
      .reply(200, {
        rollupDataPoints: [
          { civilStartTime: { date: { year: 2026, month: 9, day: 1 } }, heartRate: { beatsPerMinuteMin: 50 } },
        ],
      })
      .post('/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp', (body) => {
        capturedRanges.push(body.range);
        return true;
      })
      .reply(200, {
        rollupDataPoints: [
          { civilStartTime: { date: { year: 2026, month: 9, day: 15 } }, heartRate: { beatsPerMinuteMin: 55 } },
        ],
      });

    const points = await fetchMetricRange('token-1', 'RESTING_HR', '2026-09-01', '2026-09-21');

    expect(capturedRanges).toEqual([
      { start: { date: { year: 2026, month: 9, day: 1 } }, end: { date: { year: 2026, month: 9, day: 15 } } },
      { start: { date: { year: 2026, month: 9, day: 15 } }, end: { date: { year: 2026, month: 9, day: 21 } } },
    ]);
    expect(points).toEqual([
      { recordedAt: new Date('2026-09-01T00:00:00Z'), value: 50 },
      { recordedAt: new Date('2026-09-15T00:00:00Z'), value: 55 },
    ]);
  });
});

// Confirmed live against a real account (2026-09-21): a 30-day sleep window
// holds 25 sessions, but the first dataPoints.list response returns only 12
// and carries a nextPageToken. The client used to ignore the token and so
// silently stored 12 of 25 nights.
describe('list pagination', () => {
  const sleepPoint = (day: number) => ({
    sleep: {
      interval: { startTime: `2026-09-${String(day).padStart(2, '0')}T05:00:00Z`, endTime: `2026-09-${String(day).padStart(2, '0')}T13:00:00Z` },
      summary: { minutesAsleep: String(400 + day) },
    },
  });
  const hrvPoint = (day: number) => ({
    dailyHeartRateVariability: { date: { year: 2026, month: 9, day }, averageHeartRateVariabilityMilliseconds: 60 + day },
  });

  it('follows nextPageToken across pages and returns every sleep session, with the same filter on each page', async () => {
    const scope = nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => !q.pageToken && String(q.filter).includes('sleep.interval.end_time'))
      .reply(200, { dataPoints: [sleepPoint(20), sleepPoint(19)], nextPageToken: 'page-2' })
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => q.pageToken === 'page-2' && String(q.filter).includes('sleep.interval.end_time'))
      .reply(200, { dataPoints: [sleepPoint(18)], nextPageToken: 'page-3' })
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => q.pageToken === 'page-3' && String(q.filter).includes('sleep.interval.end_time'))
      .reply(200, { dataPoints: [sleepPoint(17), sleepPoint(16)] });

    const sessions = await fetchSleepSessions('token-1', '2026-09-01', '2026-09-22');

    expect(sessions.map((s) => s.minutesAsleep)).toEqual([420, 419, 418, 417, 416]);
    expect(scope.isDone()).toBe(true);
  });

  it('follows nextPageToken for daily HRV as well', async () => {
    const scope = nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints')
      .query((q) => !q.pageToken)
      .reply(200, { dataPoints: [hrvPoint(20), hrvPoint(19)], nextPageToken: 'hrv-2' })
      .get('/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints')
      .query((q) => q.pageToken === 'hrv-2')
      .reply(200, { dataPoints: [hrvPoint(18)] });

    const points = await fetchMetricRange('token-1', 'HRV', '2026-09-01', '2026-09-22');

    expect(points.map((p) => p.value)).toEqual([80, 79, 78]);
    expect(scope.isDone()).toBe(true);
  });

  it('makes a single request when there is no nextPageToken', async () => {
    const scope = nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, { dataPoints: [sleepPoint(20)] });

    const sessions = await fetchSleepSessions('token-1', '2026-09-01', '2026-09-22');

    expect(sessions).toHaveLength(1);
    expect(scope.isDone()).toBe(true);
  });

  it('treats an empty nextPageToken as the last page', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, { dataPoints: [sleepPoint(20)], nextPageToken: '' });

    await expect(fetchSleepSessions('token-1', '2026-09-01', '2026-09-22')).resolves.toHaveLength(1);
  });

  it('gives up with a clear error instead of looping forever if the token never ends', async () => {
    nock('https://health.googleapis.com')
      .persist()
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query(true)
      .reply(200, { dataPoints: [sleepPoint(20)], nextPageToken: 'again' });

    await expect(fetchSleepSessions('token-1', '2026-09-01', '2026-09-22')).rejects.toThrow(/more pages/i);
  });

  it('still surfaces the HTTP status when a later page fails', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => !q.pageToken)
      .reply(200, { dataPoints: [sleepPoint(20)], nextPageToken: 'page-2' })
      .get('/v4/users/me/dataTypes/sleep/dataPoints')
      .query((q) => q.pageToken === 'page-2')
      .reply(401, {});

    await expect(fetchSleepSessions('token-1', '2026-09-01', '2026-09-22')).rejects.toMatchObject({ status: 401 });
  });
});
