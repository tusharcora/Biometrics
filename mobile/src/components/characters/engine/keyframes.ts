// CSS keyframes as a worklet: kf(t, [0, 0.5, 1], [1, 1.02, 1]) is
// `0%{v:1} 50%{v:1.02} 100%{v:1}` with the timing function applied per
// segment, exactly as CSS does. t is a 0..1 loop progress (see useLoop).
export type Ease = 'linear' | 'ease' | 'ease-in-out' | 'ease-in' | 'ease-out';

export function cubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = ((ax * t + bx) * t + cx) * t - x;
    if (Math.abs(err) < 1e-5) break;
    const slope = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(slope) < 1e-6) break;
    t -= err / slope;
  }
  t = Math.min(1, Math.max(0, t));
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return ((ay * t + by) * t + cy) * t;
}

export function ease(kind: Ease, x: number): number {
  'worklet';
  switch (kind) {
    case 'linear':
      return x;
    case 'ease':
      return cubicBezier(0.25, 0.1, 0.25, 1, x);
    case 'ease-in':
      return cubicBezier(0.42, 0, 1, 1, x);
    case 'ease-out':
      return cubicBezier(0, 0, 0.58, 1, x);
    default:
      return cubicBezier(0.42, 0, 0.58, 1, x);
  }
}

export function kf(t: number, stops: readonly number[], values: readonly number[], easing: Ease = 'ease-in-out'): number {
  'worklet';
  const n = stops.length;
  if (n === 0) return 0;
  if (t <= stops[0]!) return values[0]!;
  if (t >= stops[n - 1]!) return values[n - 1]!;
  for (let i = 1; i < n; i++) {
    const end = stops[i]!;
    if (t <= end) {
      const start = stops[i - 1]!;
      const span = end - start;
      const u = span <= 0 ? 1 : (t - start) / span;
      const from = values[i - 1]!;
      return from + (values[i]! - from) * ease(easing, u);
    }
  }
  return values[n - 1]!;
}

/** Shifts a loop's progress, like a negative CSS animation-delay: phase(t, 0.25) starts a quarter in. */
export function phase(t: number, offset: number): number {
  'worklet';
  const p = (t + offset) % 1;
  return p < 0 ? p + 1 : p;
}
