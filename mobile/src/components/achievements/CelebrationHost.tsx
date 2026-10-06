import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { celebrate, pendingLevels, refreshAchievements, resetAchievements, useAchievements } from '../../lib/achievementsStore';
import { celebrationQueue } from '../../lib/celebrationQueue';
import { MODAL_ROUTES, navigationRef } from '../../navigation/navigationRef';
import { CelebrationModal } from './CelebrationModal';

/** Not yet: the navigator isn't ready, or a native modal route is up (a Modal over it is dropped). */
function mustWait(): boolean {
  if (!navigationRef.isReady()) return true;
  const route = navigationRef.getCurrentRoute()?.name;
  return route !== undefined && MODAL_ROUTES.has(route);
}

/** Re-read on every navigation state change, and once the container is ready. */
function useMustWait(): boolean {
  const [wait, setWait] = useState(mustWait);
  useEffect(() => {
    const update = () => setWait(mustWait());
    const offState = navigationRef.addListener('state', update);
    const offReady = navigationRef.addListener('ready', update);
    update();
    return () => {
      offState();
      offReady();
    };
  }, []);
  return wait;
}

// Shows new badge levels once (spec 2026-10-06 §6): checks on app start (mount), on every return to
// the foreground, and whenever a screen refreshes the store (a saved check-in does). One family at a
// time, highest level first, all inside one Modal; closing one marks that family's new levels
// celebrated. Held while a native modal route is up. Mounted once inside the signed-in navigator,
// so signing out unmounts it and forgets everything.
export function CelebrationHost() {
  const snapshot = useAchievements();
  const wait = useMustWait();

  useEffect(() => {
    void refreshAchievements();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAchievements();
    });
    return () => {
      sub.remove();
      resetAchievements();
    };
  }, []);

  if (wait || snapshot.state.status !== 'ready') return null;
  const next = celebrationQueue(pendingLevels(snapshot))[0];
  if (!next) return null;
  const thresholds = snapshot.state.data.families.find((f) => f.family === next.family)?.thresholds ?? [];
  // Not keyed: the Modal stays presented and the next family swaps in inside it.
  return <CelebrationModal celebration={next} thresholds={thresholds} onDone={() => void celebrate(next.ids)} />;
}
