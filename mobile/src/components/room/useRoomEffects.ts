import { useMemo } from 'react';
import { NEUTRAL_LIVING, livingKey, roomEffects, type Living, type RoomEffects } from '../../lib/room/effects';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { layoutKey } from '../../lib/room/layout';

/** The room's effects for a view (spec §8), recomputed only when the layout, the tier or the living room changes. */
export function useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING): RoomEffects {
  const key = `${layoutKey(layout)}#${tier}#${livingKey(living)}`;
  return useMemo(() => roomEffects(layout, tier, living, null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
