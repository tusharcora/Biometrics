import { useMemo } from 'react';
import { NEUTRAL_LIVING, livingKey, roomEffects, type Living, type RoomEffects } from '../../lib/room/effects';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { layoutKey } from '../../lib/room/layout';
import { useClockMinute } from '../../lib/room/useClockMinute';

/**
 * The room's effects for a view (spec §8): recomputed when the layout, the tier or the living room changes, and, while
 * a running clock or cat is in the room, when the minute turns (ruling 7: never on a tick). `hold` keeps the minute
 * (the page is not focused, or the editor is dragging: PF3-CLOCK), so nothing rebuilds until it is let go.
 */
export function useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING, hold = false): RoomEffects {
  const key = `${layoutKey(layout)}#${tier}#${livingKey(living)}`;
  const base = useMemo(() => roomEffects(layout, tier, living, null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useClockMinute(base.needsClock, hold);
  return useMemo(() => (now ? roomEffects(layout, tier, living, now) : base), [base, now]); // eslint-disable-line react-hooks/exhaustive-deps
}
