import { useCallback, useRef, useState } from 'react';
import { confirmMoodNotice } from '../../api/buddies';
import type { MoodNoticeSheetProps } from './MoodNoticeSheet';

/**
 * The one-time mood notice before the first pairing action (spec §4): `run(action)` runs it at once
 * once the notice was confirmed, else holds it behind the sheet until the user confirms.
 */
export function useMoodNoticeGate(initiallySeen: boolean): { run: (action: () => void) => void; sheet: MoodNoticeSheetProps } {
  const [seen, setSeen] = useState(initiallySeen);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [failed, setFailed] = useState(false);
  // The held action as of now (closing the sheet mid-confirm drops it), and a double tap confirms once.
  const pendingRef = useRef<null | (() => void)>(null);
  const confirming = useRef(false);

  const hold = useCallback((action: null | (() => void)) => {
    pendingRef.current = action;
    setPending(() => action);
  }, []);

  const run = useCallback(
    (action: () => void) => {
      if (seen) {
        action();
        return;
      }
      setFailed(false);
      hold(action);
    },
    [seen, hold],
  );

  const confirm = useCallback(async () => {
    if (confirming.current) return;
    confirming.current = true;
    try {
      await confirmMoodNotice();
    } catch {
      setFailed(true);
      return;
    } finally {
      confirming.current = false;
    }
    setSeen(true);
    const action = pendingRef.current;
    hold(null);
    action?.();
  }, [hold]);

  return { run, sheet: { visible: pending !== null, failed, onConfirm: () => void confirm(), onClose: () => hold(null) } };
}
