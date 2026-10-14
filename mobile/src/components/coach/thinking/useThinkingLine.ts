import { useEffect, useState } from 'react';
import { KIP_THINKING_VERBS } from '../../../lib/kipCopy';

export const LINE_MS = 2400;

// KIP's line for the thinking text (spec §1 Decoupling 2), moving to the next of three every 2.4 s. Paused holds it.
export function useThinkingLine(paused: boolean): { line: string; index: number } {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % KIP_THINKING_VERBS.length), LINE_MS);
    return () => clearInterval(timer);
  }, [paused]);
  return { line: KIP_THINKING_VERBS[index]!, index };
}
