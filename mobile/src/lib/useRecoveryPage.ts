import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchRecoveryMonth, fetchRecoveryPage, type RecoveryMonthDTO, type RecoveryPageDTO } from '../api/recovery';
import { useSync } from '../sync/SyncProvider';

export type MonthLoad = { status: 'loading' | 'error' | 'ready'; data?: RecoveryMonthDTO };

// Loads the bundle for `date` (undefined = today). Today refetches on focus and after a sync,
// because scores land after the morning sync. Months are cached by YYYY-MM for calendar paging.
export function useRecoveryPage(date?: string) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [page, setPage] = useState<RecoveryPageDTO | null>(null);
  const [errorKind, setErrorKind] = useState<'future' | 'other' | null>(null);
  const [months, setMonths] = useState<Record<string, MonthLoad>>({});
  const inflight = useRef(new Set<string>());
  // The mount effect already loads, so the first focus (the mount itself) is skipped.
  const focusedOnce = useRef(false);
  const { dataVersion } = useSync();
  const isToday = date === undefined;

  const load = useCallback(async (quiet: boolean) => {
    if (!quiet) setState('loading');
    try {
      const p = await fetchRecoveryPage(date ?? 'today');
      setPage(p);
      setMonths((m) => ({ ...m, [p.month.month]: { status: 'ready', data: p.month } }));
      setState('ready');
      setErrorKind(null);
    } catch (e) {
      if (quiet) return;
      setErrorKind((e as { status?: number } | null)?.status === 400 ? 'future' : 'other');
      setState('error');
    }
  }, [date]);

  useEffect(() => { void load(false); }, [load, dataVersion]);
  useFocusEffect(useCallback(() => {
    if (!focusedOnce.current) { focusedOnce.current = true; return; }
    if (isToday) void load(true);
  }, [isToday, load]));

  const loadMonth = useCallback((m: string) => {
    if (months[m]?.status === 'ready' || inflight.current.has(m)) return;
    inflight.current.add(m);
    setMonths((s) => ({ ...s, [m]: { status: 'loading' } }));
    fetchRecoveryMonth(m)
      .then((r) => setMonths((s) => ({ ...s, [m]: { status: 'ready', data: r.month } })))
      .catch(() => setMonths((s) => ({ ...s, [m]: { status: 'error' } })))
      .finally(() => inflight.current.delete(m));
  }, [months]);

  return {
    state, page, errorKind,
    reload: () => void load(false),
    month: (m: string): MonthLoad => months[m] ?? { status: 'loading' },
    loadMonth,
  };
}
