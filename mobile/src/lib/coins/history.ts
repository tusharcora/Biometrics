// The coin history's rows (spec 2026-10-15 §6.7, F6): a label by kind (ruling 35), when on the device's clock (ruling
// 29), and the amount; a 0-coin row says why. Spoken rows use words for the sign and never a "·" (ruling PF-COPY).
import type { CoinEventDTO } from '../../api/coins';
import { ROOM_COPY } from '../room/roomCopy';

const C = ROOM_COPY.coins;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today, 07:12", "Yesterday" or "Mon 9 Nov". */
export function whenLabel(at: string, now: Date): string {
  const d = new Date(at);
  if (sameDay(d, now)) return C.today(d.getHours(), d.getMinutes());
  if (sameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return C.yesterday;
  return C.dated(C.days[d.getDay()]!, d.getDate(), C.months[d.getMonth()]!);
}

export interface HistoryRow { key: string; label: string; when: string; amount: string; spoken: string }

export function historyRows(events: readonly CoinEventDTO[], now: Date): HistoryRow[] {
  return events.map((e, i) => {
    // A kind this build does not know yet still gets a row.
    const label = (C.kinds as Partial<Record<string, string>>)[e.kind] ?? C.kindUnknown;
    const when = whenLabel(e.at, now);
    const capped = e.amount === 0;
    return { key: `${e.at}-${i}`, label, when, amount: C.amount(e.amount, capped), spoken: C.rowSpoken(label, when, C.amountSpoken(e.amount, capped)) };
  });
}

/** How full the day's bar is, 0 to 1. */
export function todayShare(today: { earned: number; cap: number }): number {
  return today.cap > 0 ? Math.max(0, Math.min(1, today.earned / today.cap)) : 0;
}
