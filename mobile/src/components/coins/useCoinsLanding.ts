import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { markCoinsSeen, useCoins } from '../../lib/coins/coinsStore';
import { LANDING_MS, landingOf, type Landing } from '../../lib/coins/landing';
import { ROOM_COPY } from '../../lib/room/roomCopy';

/**
 * The coins that land while `active` (spec §6.7): shown for LANDING_MS and marked seen as they show, so they never land
 * twice. `active` means KIP's bubble is really on screen (ruling PF-F13); until then they wait, unseen. The bubble is
 * the room's own, which never floats, so Reduce Motion changes nothing (ruling 12). The line under the room is a polite
 * live region for Android; iOS has none, so it is told here, once per landing (the EditNotices pattern).
 */
export function useCoinsLanding(active: boolean): Landing | null {
  const coins = useCoins();
  const [shown, setShown] = useState<Landing | null>(null);
  useEffect(() => {
    if (!active || shown || !coins) return;
    const next = landingOf(coins.events);
    if (!next) return;
    setShown(next);
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(ROOM_COPY.coins.landSpoken(next.total, ROOM_COPY.coins.landLine(ROOM_COPY.coins.landed[next.kind], next.more)));
    }
    void markCoinsSeen(next.through);
  }, [active, coins, shown]);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(null), LANDING_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}
