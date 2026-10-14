import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCoachStatus, type CoachStatusDTO } from '../api/coach';
import { isNetworkError } from '../api/client';
import { useCoachStatusContext } from './coachStatus/CoachStatusProvider';

// Anything with a React Navigation-style addListener. Optional so a screen can
// be rendered (or tested) without a navigator.
interface FocusSource {
  addListener?: (event: 'focus', callback: () => void) => () => void;
}

// null means "not known (yet)": the coach UI treats that exactly like
// disabled, so nothing about the coach is ever shown speculatively, and a
// failed status request leaves the rest of the app untouched. `offline` means
// the last read never reached the server (spec §3.4): the last status stays.
//
// In the app the status lives in CoachStatusProvider (fetched once, shared by
// every caller). A component rendered on its own, without the provider (as in
// most screen tests), falls back to fetching its own copy, as it always did.
export function useCoachStatus(navigation?: FocusSource) {
  const shared = useCoachStatusContext();
  const [localStatus, setLocalStatus] = useState<CoachStatusDTO | null>(null);
  const [localOffline, setLocalOffline] = useState(false);
  const hasProvider = shared !== null;
  // A reply landing after unmount is dropped.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const localRefresh = useCallback(async () => {
    try {
      const next = await fetchCoachStatus();
      if (!mounted.current) return;
      setLocalStatus(next);
      setLocalOffline(false);
    } catch (err) {
      if (!mounted.current) return;
      if (isNetworkError(err)) setLocalOffline(true);
      else setLocalStatus(null);
    }
  }, []);
  const refresh = shared ? shared.refreshStatus : localRefresh;

  useEffect(() => {
    if (hasProvider) return;
    void localRefresh();
  }, [hasProvider, localRefresh]);

  // Consent can change on another screen (accept, revoke); refetch on return so
  // an entry point never routes off stale status.
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      void refresh();
    });
    return unsubscribe;
  }, [navigation, refresh]);

  if (shared) return { status: shared.status, setStatus: shared.setStatus, refresh, offline: shared.offline, setOffline: shared.setOffline };
  return { status: localStatus, setStatus: setLocalStatus, refresh, offline: localOffline, setOffline: setLocalOffline };
}

export type CoachEntryRoute = 'Coach' | 'CoachConsent';

// Where an entry point should go, or null when it must not render at all.
// `consented` from the server is authoritative -- including after the consent
// version changes, when the server reports consented:false again.
export function coachEntryRoute(status: CoachStatusDTO | null): CoachEntryRoute | null {
  if (!status || !status.enabled) return null;
  return status.consented ? 'Coach' : 'CoachConsent';
}
