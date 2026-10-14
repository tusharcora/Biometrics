import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCoachStatus, setCoachThinking, type CoachStatusDTO } from '../../api/coach';
import { isNetworkError } from '../../api/client';
import { useOptionalAuth } from '../../auth/AuthContext';
import { DEFAULT_THINKING_TEXT, isThinkingText, resolveThinkingText, type ThinkingTextId } from '../thinkingText';
import { resyncWindDownTitle } from '../windDown';
import { clearCachedThinking, purgeCachedCharacter, readCachedThinkingText, writeCachedThinkingText } from './thinkingCache';

export interface CoachStatusValue {
  /** null = not known (yet) or the read failed with a server error; treated like a disabled coach. */
  status: CoachStatusDTO | null;
  /** A status request has settled, successfully or not. */
  statusLoaded: boolean;
  /** The last status read or send failed before reaching the server (spec §3.4); cleared by the next success. */
  offline: boolean;
  /** What the chat shows while KIP works on an answer; the default until known and when signed out. */
  thinkingText: ThinkingTextId;
  refreshStatus(): Promise<void>;
  setStatus(next: CoachStatusDTO | null): void;
  setOffline(next: boolean): void;
  /** Optimistic: switches at once, reverts and rethrows if the save fails. */
  chooseThinkingText(text: ThinkingTextId): Promise<void>;
}

const CoachStatusContext = createContext<CoachStatusValue | null>(null);

// For test helpers (jest-mocks/coachStatus.tsx) that provide a fake value.
export const CoachStatusContextForTests = CoachStatusContext;

export function useCoachStatusContext(): CoachStatusValue | null {
  return useContext(CoachStatusContext);
}

// 'pending' while the auth session is still loading on a cold start: the
// cached thinking text stays up and nothing is fetched or cleared until it settles.
function accountKey(userId: string | null, isPending: boolean): string {
  if (userId !== null) return `user:${userId}`;
  return isPending ? 'pending' : 'signed-out';
}

// The coach status for the whole app (spec §1 Decoupling 4): fetched once per account, shared by every
// useCoachStatus() caller, and nothing about a character. Signed out, it shows the default thinking text, the
// cache is cleared and nothing is fetched.
export function CoachStatusProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const auth = useOptionalAuth();
  const account = accountKey(auth?.session?.userId ?? null, auth?.isPending ?? false);
  const [status, setStatusState] = useState<CoachStatusDTO | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [thinkingText, setThinkingText] = useState<ThinkingTextId>(DEFAULT_THINKING_TEXT);

  // Bumped on every account change and on unmount. A request that started
  // under an older epoch is dropped, so a reply for the previous account (or
  // one landing after sign-out or unmount) never reaches the screen.
  const epoch = useRef(0);
  const signedIn = useRef(false);
  // Set once the server (or a choice) has named this account's thinking text,
  // so the (slower) cache read cannot put an older one back.
  const thinkingKnown = useRef(false);
  // Thinking saves still in flight, and a counter bumped on every choice. A
  // status reply that may predate a choice leaves the text as it is.
  const pendingThinking = useRef(0);
  const thinkingSeq = useRef(0);
  // The text on screen, kept in step with the state synchronously so a choice
  // made before the next render still sees the one it replaces.
  const thinkingRef = useRef<ThinkingTextId>(DEFAULT_THINKING_TEXT);
  // Ruling H4: the retired characterId key is purged once per provider mount,
  // and a wind-down reminder still titled with a retired coach's name is
  // rescheduled as KIP.
  const purged = useRef(false);

  const showThinking = useCallback((next: ThinkingTextId) => {
    thinkingRef.current = next;
    setThinkingText(next);
  }, []);

  // keepThinking: a choice may be newer than this status, so the text on
  // screen stays (and the status carries it, not the server's older one).
  const applyStatus = useCallback(
    (next: CoachStatusDTO | null, keepThinking: boolean = pendingThinking.current > 0) => {
      if (!next) {
        setStatusState(null);
        return;
      }
      if (keepThinking) {
        setStatusState({ ...next, thinkingText: thinkingRef.current });
        return;
      }
      const text = resolveThinkingText(next.thinkingText);
      setStatusState(next);
      thinkingKnown.current = true;
      showThinking(text);
      void writeCachedThinkingText(text);
    },
    [showThinking],
  );
  const setStatus = useCallback((next: CoachStatusDTO | null) => applyStatus(next), [applyStatus]);

  const refreshStatus = useCallback(async () => {
    if (!signedIn.current) return;
    const started = epoch.current;
    // The server may answer this GET before it applies a PUT still in flight,
    // so a choice pending now, or made while it runs, can be missing from the reply.
    const seqAtStart = thinkingSeq.current;
    const pendingAtStart = pendingThinking.current > 0;
    try {
      const next = await fetchCoachStatus();
      if (epoch.current !== started) return;
      setOffline(false);
      applyStatus(next, pendingAtStart || pendingThinking.current > 0 || thinkingSeq.current !== seqAtStart);
    } catch (err) {
      if (epoch.current !== started) return;
      // Offline keeps the last known status; any other failure is unknown, as before.
      if (isNetworkError(err)) setOffline(true);
      else setStatusState(null);
    }
    setStatusLoaded(true);
  }, [applyStatus]);

  useEffect(() => {
    if (purged.current) return;
    purged.current = true;
    void purgeCachedCharacter();
    void resyncWindDownTitle();
  }, []);

  useEffect(() => {
    epoch.current += 1;
    const started = epoch.current;
    signedIn.current = account.startsWith('user:');
    thinkingKnown.current = false;
    pendingThinking.current = 0;
    setStatusState(null);
    setStatusLoaded(false);
    setOffline(false);
    if (account === 'signed-out') {
      // The next account must never see this one's thinking text.
      showThinking(DEFAULT_THINKING_TEXT);
      void clearCachedThinking();
      return;
    }
    void readCachedThinkingText().then((cached) => {
      if (cached && epoch.current === started && !thinkingKnown.current) showThinking(cached);
    });
    if (signedIn.current) void refreshStatus();
  }, [account, refreshStatus, showThinking]);

  useEffect(
    () => () => {
      epoch.current += 1;
    },
    [],
  );

  const chooseThinkingText = useCallback(
    async (text: ThinkingTextId) => {
      // Signed out (or still loading) there is no account to save to.
      if (!signedIn.current) return;
      if (!isThinkingText(text)) throw new Error(`Unknown thinking text: ${String(text)}`);
      const started = epoch.current;
      const previous = thinkingRef.current;
      thinkingSeq.current += 1;
      const seq = thinkingSeq.current;
      pendingThinking.current += 1;
      thinkingKnown.current = true;
      showThinking(text);
      setStatusState((s) => (s ? { ...s, thinkingText: text } : s));
      void writeCachedThinkingText(text);
      try {
        await setCoachThinking({ text });
      } catch (error) {
        // Put the previous text back, unless the account changed or a newer choice has since replaced this one.
        if (epoch.current === started && thinkingSeq.current === seq) {
          showThinking(previous);
          setStatusState((s) => (s ? { ...s, thinkingText: previous } : s));
          void writeCachedThinkingText(previous);
        }
        throw error;
      } finally {
        // An account change has already reset the count.
        if (epoch.current === started) pendingThinking.current -= 1;
      }
    },
    [showThinking],
  );

  const value = useMemo<CoachStatusValue>(
    () => ({ status, statusLoaded, offline, thinkingText, refreshStatus, setStatus, setOffline, chooseThinkingText }),
    [status, statusLoaded, offline, thinkingText, refreshStatus, setStatus, chooseThinkingText],
  );
  return <CoachStatusContext.Provider value={value}>{children}</CoachStatusContext.Provider>;
}
