import { useCallback, useEffect, useState } from 'react';
import { fetchCoachStatus, type CoachStatusDTO } from '../api/coach';

// Anything with a React Navigation-style addListener. Optional so a screen can
// be rendered (or tested) without a navigator.
interface FocusSource {
  addListener?: (event: 'focus', callback: () => void) => () => void;
}

// null means "not known (yet)": the coach UI treats that exactly like
// disabled, so nothing about the coach is ever shown speculatively, and a
// failed status request leaves the rest of the app untouched.
export function useCoachStatus(navigation?: FocusSource) {
  const [status, setStatus] = useState<CoachStatusDTO | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchCoachStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCoachStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Consent can change on another screen (accept, revoke); refetch on return so
  // an entry point never routes off stale status.
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      void refresh();
    });
    return unsubscribe;
  }, [navigation, refresh]);

  return { status, setStatus, refresh };
}

export type CoachEntryRoute = 'Coach' | 'CoachConsent';

// Where an entry point should go, or null when it must not render at all.
// `consented` from the server is authoritative -- including after the consent
// version changes, when the server reports consented:false again.
export function coachEntryRoute(status: CoachStatusDTO | null): CoachEntryRoute | null {
  if (!status || !status.enabled) return null;
  return status.consented ? 'Coach' : 'CoachConsent';
}
