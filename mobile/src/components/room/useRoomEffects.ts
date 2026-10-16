import { useMemo } from 'react';
import { NEUTRAL_LIVING, livingKey, roomEffects, type Living, type RoomEffects } from '../../lib/room/effects';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { layoutKey } from '../../lib/room/layout';
import { useClockMinute } from '../../lib/room/useClockMinute';

export interface RoomEffectsOpts {
  /** Keeps the minute (the page is not focused, the room is paused or out of sight, or the editor is dragging:
   * PF3-CLOCK), so nothing rebuilds until it is let go. */
  hold?: boolean;
  /** The editor: a napping cat stays on its own tile, so a tap or a drag finds it where it is placed. */
  editing?: boolean;
  /** The caller's own effects (the editor's, FINAL-FIX M2): returned as they are, with no work and no minute timer
   * here, so a room and the view that draws it never read two minutes. */
  given?: RoomEffects;
}

const NO_NAPS: ReadonlyMap<string, string> = new Map();

/**
 * The room's effects for a view (spec §8): recomputed when the layout, the tier or the living room changes, and, while
 * a running clock or cat is in the room, when the minute turns (ruling 7: never on a tick). The cat's 22:00 nap comes
 * with the minute that crosses it (ruling 6): one new state, so one rebuild.
 */
export function useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING, opts: RoomEffectsOpts = {}): RoomEffects {
  const key = `${layoutKey(layout)}#${tier}#${livingKey(living)}`;
  const given = opts.given;
  const base = useMemo(() => given ?? roomEffects(layout, tier, living, null), [key, given]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useClockMinute(!given && base.needsClock, !!opts.hold);
  return useMemo(() => {
    if (given) return given;
    const e = now ? roomEffects(layout, tier, living, now) : base;
    // In the editor the cat stays where it is placed, curled up if it is night, so a tap or a drag finds it there.
    return opts.editing && e.napOn.size ? { ...e, napOn: NO_NAPS } : e;
  }, [base, now, opts.editing, given]); // eslint-disable-line react-hooks/exhaustive-deps
}
