import { useEffect, useState } from 'react';

// A shared ~60 ms tick for frame-based pixel animation: KIP's loops, the room's 3-frame loops and the thinking
// styles (spec 2026-10-14 KIP Coach §1 Decoupling 3). One interval serves every subscriber; it only runs while at
// least one unpaused subscriber is mounted. Callers pass paused = unfocused || Reduce Motion. Paused → frozen at 0.
const listeners = new Set<(t: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
const start = Date.now();

export function useFrameClock(paused: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (paused) {
      setT(0);
      return;
    }
    listeners.add(setT);
    if (!timer) {
      timer = setInterval(() => {
        const now = Date.now() - start;
        listeners.forEach((l) => l(now));
      }, 60);
    }
    return () => {
      listeners.delete(setT);
      if (!listeners.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [paused]);
  return t;
}
