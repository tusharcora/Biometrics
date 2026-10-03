import { pickMainSession } from '../../src/biometrics/mainSession';

const s = (start: string, end: string, minutesAsleep: number) => ({ startTime: new Date(start), endTime: new Date(end), minutesAsleep });

it('picks the most minutes asleep, earliest start on a tie, skipping empty intervals', () => {
  const nap = s('2026-10-01T13:00:00Z', '2026-10-01T15:30:00Z', 140);
  const night = s('2026-09-30T23:00:00Z', '2026-10-01T06:00:00Z', 400);
  expect(pickMainSession([nap, night])).toBe(night);
  const a = s('2026-09-30T22:00:00Z', '2026-10-01T02:00:00Z', 200);
  const b = s('2026-10-01T02:30:00Z', '2026-10-01T07:00:00Z', 200);
  expect(pickMainSession([b, a])).toBe(a);
  expect(pickMainSession([s('2026-10-01T07:00:00Z', '2026-10-01T07:00:00Z', 999), night])).toBe(night);
  expect(pickMainSession([])).toBeNull();
});
