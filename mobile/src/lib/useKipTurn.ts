import { useEffect, useState } from 'react';
import type { KipMood, KipPose } from './kip/kipArt';
import type { KipStage, KipStageId } from './kipStage';

export const TURN_FRAME_MS = 80;

export type KipLook = { pose: KipPose; mood: KipMood; facing: 'desk' | 'you' };
const lookOf = (s: KipStage): KipLook => ({ pose: s.pose, mood: s.mood, facing: s.pose === 'type' ? 'desk' : 'you' });
// Plan ruling 7: the turn is two 80 ms frames (still glancing, facing the desk, then you) before pointing.
const TURN: readonly KipLook[] = [
  { pose: 'rest', mood: 'glance', facing: 'desk' },
  { pose: 'rest', mood: 'glance', facing: 'you' },
];

// KIP turns to face you when the first sentence arrives (spec §4): a 2-frame swap over 160 ms. Every other change
// is immediate; Reduce Motion cuts, also mid-turn.
export function useKipTurn(stage: KipStage, reduceMotion: boolean): KipLook {
  const [previous, setPrevious] = useState<KipStageId>(stage.id);
  const [frame, setFrame] = useState<number | null>(null);
  // React's "adjust state when a prop changes" pattern: the first turn frame shows on the same render as the change.
  if (previous !== stage.id) {
    setPrevious(stage.id);
    setFrame(previous === 'thinking' && stage.id === 'answering' && !reduceMotion ? 0 : null);
  } else if (reduceMotion && frame !== null) {
    setFrame(null);
  }
  useEffect(() => {
    if (frame === null) return undefined;
    const id = setTimeout(() => setFrame((f) => (f !== null && f + 1 < TURN.length ? f + 1 : null)), TURN_FRAME_MS);
    return () => clearTimeout(id);
  }, [frame]);
  return frame === null || reduceMotion ? lookOf(stage) : TURN[frame]!;
}
