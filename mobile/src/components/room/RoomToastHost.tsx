import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, type AccessibilityActionEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeOut, SlideInUp } from 'react-native-reanimated';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { getAchievementsSnapshot, pendingLevels } from '../../lib/achievementsStore';
import { decorateTarget, nextToast, toastSpoken, type RoomToast } from '../../lib/room/announce';
import { loadCosmetics } from '../../lib/room/cosmeticsStore';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import { readToasted, writeToasted } from '../../lib/room/toasted';
import { MODAL_ROUTES, navigationRef } from '../../navigation/navigationRef';

export const ROOM_TOAST_MS = 6000;

const currentRoute = () => (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);
const onModalRoute = () => {
  const route = currentRoute();
  return route !== undefined && MODAL_ROUTES.has(route);
};

/** A modal route is up, or a badge celebration is waiting (it names its own pieces). */
function held(): boolean {
  return onModalRoute() || pendingLevels(getAchievementsSnapshot()).length > 0;
}

// "New for KIP's room: Light oak" with Decorate (spec 2026-10-14 KIP's room §4; ruling 12: its own host, rounded-lg,
// not the pill toast): checked on mount (sign-in), on every return to the foreground and whenever the KIP tab gains
// focus. Each piece once (kipToasted); a held check spends nothing, so the next one shows it. Mounted inside the
// signed-in navigator.
export function RoomToastHost() {
  const [toast, setToast] = useState<RoomToast | null>(null);
  // With a screen reader on the toast stays until it is used or dismissed: 6 s is too short to reach its actions.
  const [stays, setStays] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const cosmetics = await loadCosmetics();
      if (!cosmetics || held() || !mounted.current) return;
      const { toast: next, toasted } = nextToast(cosmetics.fresh, await readToasted());
      await writeToasted(toasted);
      if (!next) return;
      const reader = await AccessibilityInfo.isScreenReaderEnabled().catch(() => false);
      if (mounted.current) {
        setStays(reader);
        setToast(next);
        AccessibilityInfo.announceForAccessibility(toastSpoken(next));
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    let last = currentRoute();
    const off = navigationRef.addListener('state', () => {
      const name = currentRoute();
      if (name === 'Coach' && last !== 'Coach') void check();
      // A native modal route covers the toast: it goes rather than wait under it.
      if (onModalRoute()) setToast(null);
      last = name;
    });
    return () => {
      mounted.current = false;
      sub.remove();
      off();
    };
  }, [check]);

  useEffect(() => {
    if (!toast || stays) return undefined;
    const timer = setTimeout(() => setToast(null), ROOM_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, stays]);

  if (!toast) return null;
  const decorate = () => {
    setToast(null);
    navigationRef.navigate('DecorateRoom', toast.kind === 'items' ? decorateTarget(toast.itemIds[0]!) : undefined);
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate') decorate();
    else if (e.nativeEvent.actionName === 'escape') setToast(null);
  };
  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* One element for a screen reader: the line, Decorate on activate, Dismiss on escape. */}
      <Animated.View
        entering={SlideInUp.duration(250)}
        exiting={FadeOut.duration(250)}
        testID="room-toast"
        accessible
        accessibilityLabel={toastSpoken(toast)}
        accessibilityHint={ROOM_COPY.toastHint}
        accessibilityActions={[{ name: 'activate', label: ROOM_COPY.decorate }, { name: 'escape', label: ROOM_COPY.dismiss }]}
        onAccessibilityAction={onAction}
        className="mx-4 mt-2 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
      >
        <Text className="shrink grow text-body">{toast.text}</Text>
        <Button testID="room-toast-decorate" variant="outline" size="sm" onPress={decorate}>
          {ROOM_COPY.decorate}
        </Button>
      </Animated.View>
    </SafeAreaView>
  );
}
