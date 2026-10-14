import { createContext, useContext, useMemo } from 'react';
import type { CoachStatusDTO } from '../api/coach';
import type { ScoreBand } from '../lib/scoreInsights';
import type { CharacterId } from '../components/characters/types';
import { DEFAULT_THINKING_ATTACHMENT, type ThinkingAttachmentId, type ThinkingTextId } from '../components/characters/thinking';
import { useCoachStatusContext } from '../lib/coachStatus/CoachStatusProvider';

export interface CharacterContextValue {
  characterId: CharacterId;
  personaChosen: boolean;
  /** null = not known (yet) or the request failed; treated like a disabled coach, as before. */
  status: CoachStatusDTO | null;
  /** A status request has settled, successfully or not. */
  statusLoaded: boolean;
  /** scoreBand() of today's recovery score; null when there is none or it failed to load. */
  recoveryBand: ScoreBand | null;
  /** What the coach shows while it works on an answer; the defaults until known and when signed out. */
  thinkingAttachment: ThinkingAttachmentId;
  thinkingText: ThinkingTextId;
  refreshStatus(): Promise<void>;
  /** Optimistic: switches at once, reverts and rethrows if the save fails. */
  chooseCharacter(id: CharacterId): Promise<void>;
  /** Optimistic like chooseCharacter. Only the settings given are sent and changed. */
  chooseThinking(body: { attachment?: ThinkingAttachmentId; text?: ThinkingTextId }): Promise<void>;
}

export const CharacterContext = createContext<CharacterContextValue | null>(null);

const noChoice = async () => {};

// Ruling 1 (plan 2026-10-14-kip-coach): until Task 14 deletes it, an old caller with no CharacterContext.Provider
// above it gets the coach status from CoachStatusProvider and Mochi as the look. Both contexts are always read,
// so the hook order is stable.
export function useCharacterOptional(): CharacterContextValue | null {
  const explicit = useContext(CharacterContext);
  const coach = useCoachStatusContext();
  // Memoised on the coach value, so a consumer's effect keyed on it does not rerun every render.
  const fromCoach = useMemo<CharacterContextValue | null>(
    () =>
      coach && {
        characterId: 'mochi',
        personaChosen: true,
        status: coach.status,
        statusLoaded: coach.statusLoaded,
        recoveryBand: null,
        thinkingAttachment: DEFAULT_THINKING_ATTACHMENT,
        thinkingText: coach.thinkingText,
        refreshStatus: coach.refreshStatus,
        chooseCharacter: noChoice,
        chooseThinking: async ({ text }) => {
          if (text) await coach.chooseThinkingText(text);
        },
      },
    [coach],
  );
  return explicit ?? fromCoach;
}

export function useCharacter(): CharacterContextValue {
  const value = useCharacterOptional();
  if (!value) throw new Error('useCharacter must be used inside CoachStatusProvider');
  return value;
}
