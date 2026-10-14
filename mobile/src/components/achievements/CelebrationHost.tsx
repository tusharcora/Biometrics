import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { celebrate, pendingLevels, refreshAchievements, resetAchievements, useAchievements } from '../../lib/achievementsStore';
import { celebrationQueue, type Celebration } from '../../lib/celebrationQueue';
import { decorateTarget, piecesForBadge } from '../../lib/room/announce';
import { loadCosmetics, useCosmetics } from '../../lib/room/cosmeticsStore';
import { MODAL_ROUTES, navigationRef } from '../../navigation/navigationRef';
import { CelebrationModal } from './CelebrationModal';

/**
 * How long a native modal route takes to finish dismissing. Its state flips to the route below at
 * once, while the dismissal still animates; a Modal presented meanwhile is dropped on iOS.
 */
export const MODAL_DISMISS_MS = 600;

type WaitReason = 'not-ready' | 'modal' | null;

/** Why not yet: the navigator isn't ready, or a native modal route is up (a Modal over it is dropped). */
function waitReason(): WaitReason {
  if (!navigationRef.isReady()) return 'not-ready';
  const route = navigationRef.getCurrentRoute()?.name;
  return route !== undefined && MODAL_ROUTES.has(route) ? 'modal' : null;
}

/**
 * Re-read on every navigation state change, and once the container is ready. Waiting starts at
 * once; leaving a modal route releases only after MODAL_DISMISS_MS.
 */
function useMustWait(): boolean {
  const [wait, setWait] = useState(() => waitReason() !== null);
  useEffect(() => {
    let last = waitReason();
    let release: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      const reason = waitReason();
      const previous = last;
      last = reason;
      if (reason !== null) {
        if (release) clearTimeout(release);
        release = null;
        setWait(true);
      } else if (previous === 'modal') {
        if (release) clearTimeout(release);
        release = setTimeout(() => {
          release = null;
          setWait(false);
        }, MODAL_DISMISS_MS);
      } else if (!release) {
        setWait(false);
      }
    };
    const offState = navigationRef.addListener('state', update);
    const offReady = navigationRef.addListener('ready', update);
    update();
    return () => {
      offState();
      offReady();
      if (release) clearTimeout(release);
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
  // The celebration on screen, kept until it is closed: a refresh meanwhile that brings a higher
  // level for another family queues it behind this one instead of swapping it in under the user.
  const shown = useRef<Celebration | null>(null);
  const cosmetics = useCosmetics();
  // Decorate's piece, opened once the queue is empty and the Modal has gone; forgotten on sign-out.
  const decorateItem = useRef<string | null>(null);

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

  let next: Celebration | null = null;
  if (!wait && snapshot.state.status === 'ready') {
    const pending = pendingLevels(snapshot);
    // Closing hides its ids at once, which ends the pin.
    const pinned = shown.current && pending.some((p) => shown.current!.ids.includes(p.id)) ? shown.current : null;
    next = pinned ?? celebrationQueue(pending)[0] ?? null;
    shown.current = next;
  }
  const showing = next ? next.ids.join(',') : null;

  // A badge earned mid-session (a saved check-in) brings room pieces the sign-in read lacks: read again, and the
  // room line fills in.
  useEffect(() => {
    if (showing) void loadCosmetics();
  }, [showing]);

  // Decorate opens its modal route only once nothing is celebrated any more and the Modal has had MODAL_DISMISS_MS to
  // go: a route presented over a live Modal is refused on iOS. A family arriving meanwhile restarts the wait.
  useEffect(() => {
    if (showing || wait || !decorateItem.current) return undefined;
    const timer = setTimeout(() => {
      const itemId = decorateItem.current;
      decorateItem.current = null;
      if (itemId) navigationRef.navigate('DecorateRoom', decorateTarget(itemId));
    }, MODAL_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [showing, wait]);

  if (!next || snapshot.state.status !== 'ready') return null;
  const current = next;
  const thresholds = snapshot.state.data.families.find((f) => f.family === current.family)?.thresholds ?? [];
  // The unseen room pieces this badge brought, every level up to the one shown (ruling 10).
  const pieces = cosmetics ? piecesForBadge(cosmetics.fresh, current.family, current.level) : [];
  // Not keyed: the Modal stays presented and the next family swaps in inside it.
  return (
    <CelebrationModal
      celebration={current}
      thresholds={thresholds}
      pieces={pieces}
      onDecorate={(itemId) => {
        decorateItem.current = itemId;
        void celebrate(current.ids);
      }}
      onDone={() => void celebrate(current.ids)}
    />
  );
}
