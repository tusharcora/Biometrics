import { useEffect, useState } from 'react';
import type { ClockNow } from './effects';

/** The device's local hour and minute (the one place the room reads the wall clock). */
export function clockNow(d: Date): ClockNow {
  const h = d.getHours();
  return { hhmm: `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, hour: h };
}

/**
 * The local time, refreshed just after each minute turns, while `active` (a running clock or cat is in the room); null
 * and no timer otherwise. While `hold` (the page is not focused, the room is paused or out of sight, or the editor is
 * dragging: PF3-CLOCK, spec §3.7) it keeps the minute it has and runs no timer; let go, it reads the time at once. The same minute keeps the same object,
 * so nothing downstream re-renders for nothing.
 */
export function useClockMinute(active: boolean, hold = false): ClockNow | null {
  const [now, setNow] = useState<ClockNow>(() => clockNow(new Date()));
  // Starting (a clock placed, the page back in focus, a drop), the minute is read in that same render, so the room is
  // never built once with an old minute and again with the new one.
  const live = active && !hold;
  const [wasLive, setWasLive] = useState(live);
  if (live !== wasLive) {
    setWasLive(live);
    if (live) {
      const next = clockNow(new Date());
      if (next.hhmm !== now.hhmm) setNow(next);
    }
  }
  useEffect(() => {
    if (!live) return undefined;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      const next = clockNow(d);
      setNow((prev) => (prev.hhmm === next.hhmm ? prev : next));
      id = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    tick();
    return () => clearTimeout(id);
  }, [live]);
  return active ? now : null;
}
