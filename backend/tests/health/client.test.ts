import nock from 'nock';
import { fetchMetricRange } from '../../src/health/client';

afterEach(() => nock.cleanAll());

describe('fetchMetricRange', () => {
  it('fetches STEPS via dailyRollUp on parent "steps"', async () => {
    nock('https://health.googleapis.com')
      .post('/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp')
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
      .post('/v4/users/me/dataTypes/heart-rate/dataPoints:dailyRollUp')
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
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01T22:00:00Z'), value: 415 }]);
  });

  it('fetches HRV via dataPoints.list on "heartRateVariability", taking the last sample of the range', async () => {
    nock('https://health.googleapis.com')
      .get('/v4/users/me/dataTypes/heartRateVariability/dataPoints')
      .query((q) => typeof q.filter === 'string' && q.filter.includes('heartRateVariability.sample_time.physical_time'))
      .reply(200, {
        dataPoints: [
          {
            heartRateVariability: {
              sampleTime: { physicalTime: '2026-09-01T06:00:00Z' },
              rootMeanSquareOfSuccessiveDifferencesMilliseconds: 38.2,
            },
          },
          {
            heartRateVariability: {
              sampleTime: { physicalTime: '2026-09-01T23:00:00Z' },
              rootMeanSquareOfSuccessiveDifferencesMilliseconds: 41.7,
            },
          },
        ],
      });

    const points = await fetchMetricRange('token-1', 'HRV', '2026-09-01', '2026-09-02');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01T23:00:00Z'), value: 41.7 }]);
  });
});
