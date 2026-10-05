// Year in pixels (spec 2026-10-04 §1, §3): one cell per night of the calendar year against the
// user's CURRENT goal, not stored on the server. A night after today is "future": drawn empty,
// never short, never counted.

export type PixelLevel = 'goal' | 'short' | 'none' | 'future';

export interface YearPixels {
  rows: Array<{ month: number; cells: Array<{ date: string; level: PixelLevel }> }>;
  onGoal: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function yearPixels(year: number, nights: Array<{ date: string; minutesAsleep: number }>, goalMinutes: number, today: string): YearPixels {
  const minutes = new Map(nights.filter((n) => n.minutesAsleep > 0).map((n) => [n.date, n.minutesAsleep]));
  let onGoal = 0;
  const rows = Array.from({ length: 12 }, (_, month) => {
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = Array.from({ length: days }, (_, i) => {
      const date = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
      const m = minutes.get(date);
      const level: PixelLevel = date > today ? 'future' : m === undefined ? 'none' : m >= goalMinutes ? 'goal' : 'short';
      if (level === 'goal') onGoal++;
      return { date, level };
    });
    return { month, cells };
  });
  return { rows, onGoal };
}
