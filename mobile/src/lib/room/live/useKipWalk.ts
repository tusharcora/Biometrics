import { useEffect, useMemo, useRef, useState } from 'react';
import type { Box } from '../grid';
import type { RoomEffects } from '../effects';
import type { RoomLayout, Tier } from '../iso/geometry';
import type { Tile } from '../iso/movers';
import { layoutKey } from '../layout';
import type { KipMover } from '../../../components/room/RoomView';
import { STEP_MS, TRIP_MIN_MS, TRIP_SPAN_MS, USE_MS, USE_POSE, headsLeft, planTrip, posAt, type UseKind } from './walk';

export type KipWalk =
  | { phase: 'seat' }
  | { phase: 'walk' | 'use'; pos: [number, number]; depth: Tile; flip: boolean; kind: UseKind; target: string };
const SEAT: KipWalk = { phase: 'seat' };

export interface KipWalkInput {
  enabled: boolean;
  layout: RoomLayout;
  tier: Tier;
  effects: RoomEffects;
  /** The room card's crop in room cells: targets outside it are never picked (spec §9.2). */
  view: Box | null;
  rng?: () => number;
}

/**
 * KIP's trips between answers (spec §9.2, ruling 13). Disabled (a turn, the prompt focused, the screen blurred, Reduce
 * Motion, the editor, a bubble) it is on the seat in that same render, with every timer cleared; enabled again, it
 * rests 20–40 s first. A new room (layout or tier) starts over from the seat, and so does a cat that starts wandering
 * or falls asleep while KIP goes to it (it is no longer where KIP is heading). It says nothing to a screen reader:
 * the room stays one image with one label.
 */
export function useKipWalk({ enabled, layout, tier, effects, view, rng = Math.random }: KipWalkInput): KipWalk {
  // The room the walk was planned in joins it, so a moved piece puts KIP on its seat in that same render too; so does
  // a cat target's state when the trip was planned.
  const [state, setState] = useState<{ room: string; walk: KipWalk; cat: string }>({ room: '', walk: SEAT, cat: '' });
  const last = useRef<string | null>(null);
  // Read when a trip is planned, so a new crop or a minute's effects never restart the timers.
  const inputs = useRef({ layout, tier, effects, view, rng });
  inputs.current = { layout, tier, effects, view, rng };
  const layoutId = useMemo(() => layoutKey(layout), [layout]);
  const roomKey = `${layoutId}#${tier}`;
  const w = state.walk;
  const catMoved = w.phase !== 'seat' && w.kind === 'cat' && (effects.states.get(w.target) ?? '') !== state.cat;
  useEffect(() => {
    const setWalk = (walk: KipWalk, cat = '') => setState({ room: roomKey, walk, cat });
    setWalk(SEAT);
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = (ms: number, f: () => void) => { timer = setTimeout(f, ms); };
    const rest = () => later(TRIP_MIN_MS + Math.floor(inputs.current.rng() * TRIP_SPAN_MS), go);
    const go = () => {
      const c = inputs.current;
      const trip = c.view ? planTrip(c.layout, c.tier, c.effects, c.view, last.current, c.rng) : null;
      if (!trip) { rest(); return; }
      last.current = trip.target.id;
      const cat = trip.target.kind === 'cat' ? c.effects.states.get(trip.target.id) ?? '' : '';
      const end = 2 * (trip.path.length - 1);
      const show = (s: number, dir: 1 | -1, phase: 'walk' | 'use') => {
        const here = posAt(trip.path, s, dir);
        const flip = phase === 'use' ? trip.faceLeft : headsLeft(here.pos, posAt(trip.path, Math.max(0, Math.min(end, s + dir)), dir).pos);
        setWalk({ phase, pos: here.pos, depth: here.depth, flip, kind: trip.target.kind, target: trip.target.id }, cat);
      };
      const out = (s: number) => {
        if (s >= end) { show(end, 1, 'use'); later(USE_MS, () => back(end)); return; }
        show(s, 1, 'walk');
        later(STEP_MS, () => out(s + 1));
      };
      const back = (s: number) => {
        if (s <= 0) { setWalk(SEAT); rest(); return; }
        show(s - 1, -1, 'walk');
        later(STEP_MS, () => back(s - 1));
      };
      out(0);
    };
    rest();
    return () => { if (timer) clearTimeout(timer); };
  }, [enabled, roomKey, catMoved]);
  return enabled && state.room === roomKey && !catMoved ? w : SEAT;
}

/** What RoomView draws for a walk: null at the seat. */
export function walkMover(w: KipWalk): KipMover | null {
  if (w.phase === 'seat') return null;
  const using = w.phase === 'use';
  return { pos: w.pos, depth: w.depth, flip: w.flip, pose: using ? USE_POSE[w.kind] : 'rest', moving: !using, sway: using && w.kind === 'sound' };
}
