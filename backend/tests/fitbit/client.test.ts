import nock from 'nock';
import { fetchMetricRange } from '../../src/fitbit/client';

afterEach(() => nock.cleanAll());

describe('fetchMetricRange', () => {
  it('fetches resting heart rate for a range', async () => {
    nock('https://api.fitbit.com')
      .get('/1/user/-/activities/heart/date/2026-09-01/2026-09-02.json')
      .reply(200, {
        'activities-heart': [
          { dateTime: '2026-09-01', value: { restingHeartRate: 58 } },
          { dateTime: '2026-09-02', value: { restingHeartRate: 60 } },
        ],
      });

    const points = await fetchMetricRange('token-1', 'RESTING_HR', '2026-09-01', '2026-09-02');
    expect(points).toEqual([
      { recordedAt: new Date('2026-09-01'), value: 58 },
      { recordedAt: new Date('2026-09-02'), value: 60 },
    ]);
  });

  it('fetches steps for a range', async () => {
    nock('https://api.fitbit.com')
      .get('/1/user/-/activities/steps/date/2026-09-01/2026-09-01.json')
      .reply(200, { 'activities-steps': [{ dateTime: '2026-09-01', value: '8123' }] });

    const points = await fetchMetricRange('token-1', 'STEPS', '2026-09-01', '2026-09-01');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01'), value: 8123 }]);
  });

  it('fetches sleep minutes for a range', async () => {
    nock('https://api.fitbit.com')
      .get('/1.2/user/-/sleep/date/2026-09-01/2026-09-01.json')
      .reply(200, { sleep: [{ dateOfSleep: '2026-09-01', minutesAsleep: 415 }] });

    const points = await fetchMetricRange('token-1', 'SLEEP', '2026-09-01', '2026-09-01');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01'), value: 415 }]);
  });

  it('fetches HRV for a range', async () => {
    nock('https://api.fitbit.com')
      .get('/1/user/-/hrv/date/2026-09-01/2026-09-01.json')
      .reply(200, { hrv: [{ dateTime: '2026-09-01', value: { dailyRmssd: 42.3 } }] });

    const points = await fetchMetricRange('token-1', 'HRV', '2026-09-01', '2026-09-01');
    expect(points).toEqual([{ recordedAt: new Date('2026-09-01'), value: 42.3 }]);
  });
});
