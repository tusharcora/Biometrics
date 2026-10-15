import { historyRows, todayShare, whenLabel } from '../../src/lib/coins/history';
import { EARN_AMOUNTS } from '../../src/lib/coins/amounts';
import { ROOM_COPY, coinCount } from '../../src/lib/room/roomCopy';

// Built on the device's own clock (ruling 29), so the cases hold in any zone the suite runs in.
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString();
const NOW = new Date(2026, 10, 11, 18, 40);

it('says when on the device clock: "Today, 07:12", "Yesterday", or the weekday and date', () => {
  expect(whenLabel(at(2026, 10, 11, 7, 12), NOW)).toBe('Today, 07:12');
  expect(whenLabel(at(2026, 10, 10, 23, 59), NOW)).toBe('Yesterday');
  expect(whenLabel(at(2026, 10, 9, 8, 0), NOW)).toBe('Mon 9 Nov');
});

it('labels each row by kind with its amount; a cap row reads +0 with the reason; spoken rows carry no "·" or "−" (ruling 35, PF-COPY)', () => {
  const rows = historyRows([
    { kind: 'sleep_goal', amount: 20, at: at(2026, 10, 11, 7, 12), seen: false },
    { kind: 'recap', amount: 0, at: at(2026, 10, 11, 9, 0), seen: true },
    { kind: 'buy', amount: -150, at: at(2026, 10, 10, 12, 0), seen: true },
  ], NOW);
  expect(rows.map((r) => [r.label, r.when, r.amount])).toEqual([
    ['Hit your sleep goal', 'Today, 07:12', '+20'],
    ['Read your weekly recap', 'Today, 09:00', '+0 · daily cap'],
    ['Coin shop', 'Yesterday', '−150'],
  ]);
  expect(rows.map((r) => r.spoken)).toEqual([
    'Hit your sleep goal, Today, 07:12, plus 20 coins',
    'Read your weekly recap, Today, 09:00, plus 0 coins, daily cap reached',
    'Coin shop, Yesterday, minus 150 coins',
  ]);
  for (const r of rows) expect(r.spoken).not.toMatch(/·|−/);
});

it('fills the day\'s bar to the cap and no further, and groups thousands', () => {
  expect([todayShare({ earned: 40, cap: 60 }), todayShare({ earned: 90, cap: 60 }), todayShare({ earned: 0, cap: 60 })]).toEqual([40 / 60, 1, 0]);
  expect([coinCount(0), coinCount(360), coinCount(1500), coinCount(1234567)]).toEqual(['0', '360', '1,500', '1,234,567']);
});

it('labels a kind this build does not know neutrally, never as another kind', () => {
  const [row] = historyRows([{ kind: 'gift' as never, amount: 3, at: at(2026, 10, 11, 8, 0), seen: true }], NOW);
  expect([row!.label, row!.spoken]).toEqual(['KIP coins', 'KIP coins, Today, 08:00, plus 3 coins']);
});

it('"How to earn" states what the server pays (backend/src/coins/sources.ts EARN_AMOUNTS)', () => {
  expect(EARN_AMOUNTS).toEqual({ sleep_goal: 20, steps: 15, recap: 10, checkin: 5 });
  expect(ROOM_COPY.coins.how).toEqual(['Sleep goal +20', 'Step goal +15', 'Recap read +10', 'Check-in +5']);
});
