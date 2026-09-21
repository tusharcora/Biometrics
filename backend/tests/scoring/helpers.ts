import { DailyPoint } from '../../src/scoring/types';
import { shiftDate } from '../../src/scoring/dates';

/** Consecutive daily points starting at `start`. */
export function series(start: string, values: number[]): DailyPoint[] {
  return values.map((value, i) => ({ date: shiftDate(start, i), value }));
}

/** `n` values alternating between `a` and `b` (median (a+b)/2, raw MAD |b-a|/2). */
export function alternating(n: number, a: number, b: number): number[] {
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));
}
