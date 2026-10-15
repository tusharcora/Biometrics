import { landingOf } from '../../src/lib/coins/landing';

it('lands every unseen positive earn once, as their total, named by the newest (ruling 12)', () => {
  expect(landingOf([
    { kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false },
    { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false },
    { kind: 'recap', amount: 10, at: '2026-11-10T09:00:00.000Z', seen: true },
  ])).toEqual({ total: 25, kind: 'sleep_goal', more: 1, through: '2026-11-11T07:12:00.000Z' });
});

it('never lands a 0-coin row, a spend or a seen event (Review Focus 5, ruling 6)', () => {
  expect(landingOf([
    { kind: 'recap', amount: 0, at: '2026-11-11T09:00:00.000Z', seen: false },
    { kind: 'buy', amount: -150, at: '2026-11-11T08:00:00.000Z', seen: false },
    { kind: 'steps', amount: 15, at: '2026-11-11T07:00:00.000Z', seen: true },
  ])).toBeNull();
});

it('never lands a kind this build does not know (a later phase\'s source has no line yet)', () => {
  expect(landingOf([{ kind: 'gift' as never, amount: 30, at: '2026-11-11T09:00:00.000Z', seen: false }])).toBeNull();
});
