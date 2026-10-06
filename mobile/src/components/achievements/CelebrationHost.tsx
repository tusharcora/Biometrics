import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { celebrate, pendingLevels, refreshAchievements, resetAchievements, useAchievements } from '../../lib/achievementsStore';
import { celebrationQueue } from '../../lib/celebrationQueue';
import { CelebrationModal } from './CelebrationModal';

// Shows new badge levels once (spec 2026-10-06 §6): checks on app start (mount), on every return to
// the foreground, and whenever a screen refreshes the store (a saved check-in does). One modal per
// family, highest level first; closing it marks that family's new levels celebrated. Mounted once
// inside the signed-in navigator, so signing out unmounts it and forgets everything.
export function CelebrationHost() {
  const snapshot = useAchievements();

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

  if (snapshot.state.status !== 'ready') return null;
  const next = celebrationQueue(pendingLevels(snapshot))[0];
  if (!next) return null;
  const thresholds = snapshot.state.data.families.find((f) => f.family === next.family)?.thresholds ?? [];
  return <CelebrationModal key={`${next.family}-${next.level}`} celebration={next} thresholds={thresholds} onDone={() => void celebrate(next.ids)} />;
}
