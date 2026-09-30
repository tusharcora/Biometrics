import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchCoachStatus, setCoachPersona, type CoachStatusDTO } from '../api/coach';
import { fetchScoresWithBands } from '../api/scores';
import { useOptionalAuth } from '../auth/AuthContext';
import { DEFAULT_CHARACTER_ID, isCharacterId, type CharacterId } from '../components/characters/types';
import { scoreBand, type ScoreBand } from '../lib/scoreInsights';
import { CharacterContext, type CharacterContextValue } from './CharacterContext';
import { clearCachedCharacter, readCachedCharacter, writeCachedCharacter } from './characterCache';

export { useCharacter, useCharacterOptional } from './CharacterContext';

type StatusSetter = (next: CoachStatusDTO | null) => void;

// Lets useCoachStatus() callers replace the shared status locally (e.g. right
// after revoking consent) without widening CharacterContextValue.
const StatusSetterContext = createContext<StatusSetter | null>(null);

export function useSetCoachStatus(): StatusSetter | null {
  return useContext(StatusSetterContext);
}

// 'pending' while the auth session is still loading on a cold start: the
// cached character stays up and nothing is fetched or cleared until it settles.
function accountKey(userId: string | null, isPending: boolean): string {
  if (userId !== null) return `user:${userId}`;
  return isPending ? 'pending' : 'signed-out';
}

// The user's character, the coach status and today's recovery band, for the
// whole app (spec §1). Owns the coach status, so useCoachStatus() reads it from
// here instead of fetching once per screen. Signed out, it is always Hoot, the
// cached id is cleared and nothing is fetched.
export function CharacterProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const auth = useOptionalAuth();
  const userId = auth?.session?.userId ?? null;
  const account = accountKey(userId, auth?.isPending ?? false);

  const [characterId, setCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER_ID);
  const [personaChosen, setPersonaChosen] = useState(false);
  const [status, setStatus] = useState<CoachStatusDTO | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [recoveryBand, setRecoveryBand] = useState<ScoreBand | null>(null);

  // Bumped on every account change and on unmount. A request that started
  // under an older epoch is dropped, so a reply for the previous account (or
  // one landing after sign-out or unmount) never reaches the screen.
  const epoch = useRef(0);
  const signedIn = useRef(false);
  // Set once the server has named this account's character, so the (slower)
  // cache read cannot put an older one back.
  const serverKnown = useRef(false);
  // A choice still waiting on PUT: a status fetch that started before it must
  // not undo it.
  const pendingChoice = useRef<CharacterId | null>(null);
  // Bumped on every choice. lastChoice is the choice now in effect (pending or
  // saved; a failed one hands back the one before it). A status fetch that
  // started before a newer choice may carry the server's pre-choice persona,
  // whichever order the replies land in, so that choice is laid over it.
  const choiceSeq = useRef(0);
  const lastChoice = useRef<{ seq: number; id: CharacterId } | null>(null);
  const latest = useRef({ characterId, personaChosen, status });
  latest.current = { characterId, personaChosen, status };

  const applyStatus = useCallback((next: CoachStatusDTO | null, choice: CharacterId | null = pendingChoice.current) => {
    const merged = next && choice ? { ...next, personaId: choice, personaChosen: true } : next;
    setStatus(merged);
    // An empty personaId means the server did not say (a malformed status);
    // keep showing the cached character then. An unknown id is Hoot.
    if (!merged || !merged.personaId) return;
    const id = isCharacterId(merged.personaId) ? merged.personaId : DEFAULT_CHARACTER_ID;
    serverKnown.current = true;
    setCharacterId(id);
    setPersonaChosen(merged.personaChosen);
    void writeCachedCharacter(id);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!signedIn.current) return;
    const started = epoch.current;
    const seqAtStart = choiceSeq.current;
    try {
      const next = await fetchCoachStatus();
      if (epoch.current !== started) return;
      const choiceSince = choiceSeq.current !== seqAtStart ? (lastChoice.current?.id ?? null) : null;
      applyStatus(next, choiceSince ?? pendingChoice.current);
    } catch {
      if (epoch.current !== started) return;
      // Unknown, which every coach entry treats as disabled. The character
      // itself stays as it was (cached or last known).
      setStatus(null);
    }
    setStatusLoaded(true);
  }, [applyStatus]);

  const refreshRecovery = useCallback(async () => {
    if (!signedIn.current) return;
    const started = epoch.current;
    try {
      const { scores, bands } = await fetchScoresWithBands(1, 'RECOVERY');
      if (epoch.current !== started) return;
      const today = scores.find((s) => s.type === 'RECOVERY' && s.score !== null);
      setRecoveryBand(today && today.score !== null ? scoreBand(today.score, bands) : null);
    } catch {
      if (epoch.current === started) setRecoveryBand(null);
    }
  }, []);

  useEffect(() => {
    epoch.current += 1;
    const started = epoch.current;
    signedIn.current = account.startsWith('user:');
    serverKnown.current = false;
    pendingChoice.current = null;
    lastChoice.current = null;
    setStatus(null);
    setStatusLoaded(false);
    setRecoveryBand(null);

    if (account === 'signed-out') {
      // Signed-out screens always show Hoot, and the next account must never
      // see this one's character.
      setCharacterId(DEFAULT_CHARACTER_ID);
      setPersonaChosen(false);
      void clearCachedCharacter();
      return;
    }

    void readCachedCharacter().then((cached) => {
      // The cache validates too; checked again here because CharacterCanvas
      // has no fallback, so an unknown id must never reach it.
      if (isCharacterId(cached) && epoch.current === started && !serverKnown.current) setCharacterId(cached);
    });
    if (signedIn.current) {
      void refreshStatus();
      void refreshRecovery();
    }
  }, [account, refreshStatus, refreshRecovery]);

  // Today's recovery can change while the app is in the background (a sync,
  // or a new day), so it is read again whenever the app comes back.
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') void refreshRecovery();
      previous = next;
    });
    return () => subscription.remove();
  }, [refreshRecovery]);

  useEffect(
    () => () => {
      epoch.current += 1;
    },
    [],
  );

  const chooseCharacter = useCallback(async (id: CharacterId) => {
    // Signed out (or still loading) there is no account to save to, and the
    // character must stay Hoot.
    if (!signedIn.current) return;
    if (!isCharacterId(id)) throw new Error(`Unknown character: ${String(id)}`);
    const started = epoch.current;
    const previous = latest.current;
    const previousChoice = lastChoice.current;
    choiceSeq.current += 1;
    const seq = choiceSeq.current;
    lastChoice.current = { seq, id };
    pendingChoice.current = id;
    setCharacterId(id);
    setPersonaChosen(true);
    setStatus((s) => (s ? { ...s, personaId: id, personaChosen: true } : s));
    void writeCachedCharacter(id);
    try {
      await setCoachPersona(id);
      if (epoch.current === started) serverKnown.current = true;
    } catch (error) {
      // Put the previous character back, unless the account changed or a
      // newer choice has since replaced this one.
      if (epoch.current === started && lastChoice.current?.seq === seq) {
        lastChoice.current = previousChoice;
        setCharacterId(previous.characterId);
        setPersonaChosen(previous.personaChosen);
        setStatus((s) => (s ? { ...s, personaId: previous.status?.personaId ?? s.personaId, personaChosen: previous.personaChosen } : s));
        void writeCachedCharacter(previous.characterId);
      }
      throw error;
    } finally {
      if (pendingChoice.current === id) pendingChoice.current = null;
    }
  }, []);

  const value = useMemo<CharacterContextValue>(
    () => ({ characterId, personaChosen, status, statusLoaded, recoveryBand, refreshStatus, chooseCharacter }),
    [characterId, personaChosen, status, statusLoaded, recoveryBand, refreshStatus, chooseCharacter],
  );

  return (
    <CharacterContext.Provider value={value}>
      <StatusSetterContext.Provider value={applyStatus}>{children}</StatusSetterContext.Provider>
    </CharacterContext.Provider>
  );
}
