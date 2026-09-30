import { useEffect, useState } from 'react';
import type { CharacterMood } from '../components/characters/types';
import { useCharacterOptional } from './CharacterContext';
import { ANSWERING_MS, characterMood } from './characterMood';

// characterMood() for a component, with today's recovery band from
// CharacterProvider (none outside it). While a reply is fresh it schedules one
// re-render for the moment "answering" ends, so the mood falls back without a
// per-frame clock.
export function useCharacterMood({ sending, answeredAt }: { sending: boolean; answeredAt: number | null }): CharacterMood {
  const recoveryBand = useCharacterOptional()?.recoveryBand ?? null;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (answeredAt === null) return;
    const remaining = answeredAt + ANSWERING_MS - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setTick((n) => n + 1), remaining);
    return () => clearTimeout(timer);
  }, [answeredAt]);

  return characterMood({ sending, answeredAt, now: Date.now(), recoveryBand });
}
