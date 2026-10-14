import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { RoomView } from '../components/room/RoomView';
import { HotspotLayer } from '../components/decorate/HotspotLayer';
import { DecorateTray } from '../components/decorate/DecorateTray';
import { useAchievements } from '../lib/achievementsStore';
import { useMyKip } from '../lib/kip/myKip';
import { useTodayScene } from '../lib/home/useTodayScene';
import { useReducedMotion } from 'react-native-reanimated';
import { isWornSlot } from '../lib/room/catalogue';
import { decorateReducer, displayLook, initDecorate, isChanged, type DecorateSlot, type DecorateTab } from '../lib/room/decorate';
import type { RoomSlot } from '../lib/room/slots';
import { setDecorateOpen } from '../lib/room/decorateOpen';
import { drawableLoadout } from '../lib/room/draw';
import { getCosmetics, loadCosmetics, markCosmeticsSeen, saveCosmeticsLoadout, useCosmetics } from '../lib/room/cosmeticsStore';
import { progressFromAchievements, ROOM_COPY } from '../lib/room/roomCopy';
import { infoLine, type TrayContext } from '../lib/room/tray';

const ROOM_HEIGHT = 220; // the whole 110-cell height at 2 points (ruling 16)

// Decorate mode (spec 2026-10-14 KIP's room §6; K4b): Cancel / DECORATE / Done, the room with hotspot tags, the info
// line with Undo, the Room / KIP / Sets tabs and the tray. A full-screen modal route; the KIP page's loops pause
// while it is open (ruling 17).
export function DecorateRoomScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { tab?: DecorateTab; slot?: DecorateSlot };
  const cosmetics = useCosmetics();
  // The read failed (loadCosmetics keeps nothing and swallows the error): say so, with Try again and Close.
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    void loadCosmetics().then((loaded) => setFailed(!loaded));
  }, []);
  useEffect(() => {
    setDecorateOpen(true);
    if (!cosmetics) load();
    return () => setDecorateOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cosmetics) {
    // The route has no swipe to close, so Cancel is here from the first frame.
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
          <Button testID="decorate-cancel" variant="ghost" onPress={() => navigation.goBack()}>{ROOM_COPY.cancel}</Button>
          <PageTitle>{ROOM_COPY.title}</PageTitle>
          <View className="w-16" />
        </View>
        {failed ? (
          <View testID="decorate-load-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{ROOM_COPY.loadFailed.text}</Text>
            <View className="flex-row gap-2">
              <Button testID="decorate-retry" className="flex-1" onPress={load}>{ROOM_COPY.loadFailed.retry}</Button>
              <Button testID="decorate-close" variant="outline" className="flex-1" onPress={() => navigation.goBack()}>{ROOM_COPY.loadFailed.close}</Button>
            </View>
          </View>
        ) : (
          <Skeleton testID="decorate-loading" className="m-4 h-56 rounded-lg" />
        )}
      </SafeAreaView>
    );
  }
  return <Decorate params={params} navigation={navigation} />;
}

function Decorate({ params, navigation }: { params: { tab?: DecorateTab; slot?: DecorateSlot }; navigation: any }) {
  const cosmetics = useCosmetics()!;
  const me = useMyKip();
  const achievements = useAchievements();
  const reduceMotion = useReducedMotion();
  const day = useTodayScene(navigation);
  const { width } = useWindowDimensions();
  const [state, dispatch] = useReducer(decorateReducer, undefined, () => initDecorate({ room: cosmetics.room, worn: cosmetics.worn }, params, cosmetics.version));
  const leaving = useRef(false);
  const [saving, setSaving] = useState(false);

  // Opening decorate mode marks everything shown as seen (spec §4).
  useEffect(() => {
    void markCosmeticsSeen(cosmetics.fresh.map((f) => f.itemId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: TrayContext = useMemo(
    () => ({ owned: cosmetics.owned, facts: progressFromAchievements(achievements, cosmetics.counters) }),
    [cosmetics.owned, cosmetics.counters, achievements],
  );
  const look = displayLook(state);
  const loadout = useMemo(() => drawableLoadout(look.room), [look.room]);
  const changed = isChanged(state);
  const info = infoLine(state, ctx);
  const lockedSlot: RoomSlot | null = state.preview?.kind === 'item' && !isWornSlot(state.preview.slot) ? state.preview.slot : null;

  // Cancel, the Android back button and a dismiss gesture all ask first when something changed (one confirm, P30).
  const confirmDiscard = (onDiscard: () => void) =>
    Alert.alert(ROOM_COPY.discard.title, undefined, [
      { text: ROOM_COPY.discard.keep, style: 'cancel' },
      { text: ROOM_COPY.discard.discard, style: 'destructive', onPress: () => { leaving.current = true; onDiscard(); } },
    ]);
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
    if (leaving.current || !changed) return;
    e.preventDefault();
    confirmDiscard(() => navigation.dispatch(e.data.action));
  }), [navigation, changed]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    if (!changed) { leaving.current = true; navigation.goBack(); return; }
    confirmDiscard(() => navigation.goBack());
  };

  // The notice below the info line is a polite live region on Android; iOS has none, so every failed save is
  // announced as it happens (an identical second failure too).
  const announce = (text: string) => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  };

  const save = async () => {
    setSaving(true);
    try {
      // The draft holds only owned pieces and keeps every stored id you did not touch (rulings 18, 25). It is saved
      // against the version it was built on, so a newer room read meanwhile answers 409 instead of being overwritten.
      const next = await saveCosmeticsLoadout({ room: state.draft.room, worn: state.draft.worn, version: state.baseVersion });
      dispatch({ type: 'saved', look: { room: next.room, worn: next.worn }, version: next.version });
      leaving.current = true;
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
        // Another device saved, or something you placed is no longer yours: show the server's room and stay. A read
        // that fails (or is dropped) leaves the same cached object in the store, so identity tells a real refresh.
        const before = getCosmetics();
        const fresh = await loadCosmetics();
        if (fresh && fresh !== before) {
          dispatch({ type: 'refreshed', look: { room: fresh.room, worn: fresh.worn }, version: fresh.version });
          announce(ROOM_COPY.refreshed);
          return;
        }
      }
      dispatch({ type: 'saveFailed' });
      announce(ROOM_COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <Button testID="decorate-cancel" variant="ghost" disabled={saving} onPress={cancel}>{ROOM_COPY.cancel}</Button>
        <PageTitle>{ROOM_COPY.title}</PageTitle>
        <Button testID="decorate-done" disabled={!changed || saving} onPress={() => void save()}>{ROOM_COPY.done}</Button>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* While a save is in flight nothing can be edited: its answer replaces the draft and closes the screen. */}
        <View testID="decorate-editing" pointerEvents={saving ? 'none' : 'auto'}>
          <View style={{ width, height: ROOM_HEIGHT }}>
            <RoomView
              testID="decorate-room"
              loadout={loadout}
              worn={look.worn}
              weather={day.window.weather}
              night={day.window.night}
              colour={me.colour}
              pose="rest"
              mood="glance"
              screen="lines"
              bubble={null}
              crop={{ width, height: ROOM_HEIGHT }}
              cellPt={2}
              reduceMotion={reduceMotion}
              accessibilityLabel={info.spoken}
            />
            {state.tab === 'room' ? <HotspotLayer crop={{ width, height: ROOM_HEIGHT }} selectedSlot={state.roomSlot} lockedSlot={lockedSlot} onSelect={(slot) => dispatch({ type: 'slot', slot })} /> : null}
          </View>
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View testID="decorate-info" accessible accessibilityLabel={info.spoken} className="shrink grow gap-0.5">
              <Text className="font-pixel text-label text-muted-foreground">{info.label}</Text>
              <Text className={info.muted ? 'text-caption text-muted-foreground' : 'text-caption'}>{info.text}</Text>
            </View>
            <Button testID="decorate-undo" variant="ghost" size="sm" disabled={state.history.length === 0} accessibilityLabel={ROOM_COPY.undoLabel} onPress={() => dispatch({ type: 'undo' })}>
              {ROOM_COPY.undo}
            </Button>
          </View>
          {state.notice ? (
            <Text testID="decorate-notice" accessibilityLiveRegion="polite" className="px-4 pb-2 text-caption text-muted-foreground">
              {state.notice === 'refreshed' ? ROOM_COPY.refreshed : ROOM_COPY.saveFailed}
            </Text>
          ) : null}
          <View testID="decorate-tabs" accessibilityRole="tablist" accessibilityLabel={ROOM_COPY.tabsLabel} className="flex-row gap-2 px-4">
            {(['room', 'kip', 'sets'] as const).map((tab) => (
              <Button
                key={tab}
                testID={`decorate-tab-${tab}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: state.tab === tab }}
                variant={state.tab === tab ? 'default' : 'outline'}
                className="flex-1"
                onPress={() => dispatch({ type: 'tab', tab })}
              >
                {ROOM_COPY.tabs[tab]}
              </Button>
            ))}
          </View>
          <DecorateTray state={state} dispatch={dispatch} ctx={ctx} colour={me.colour} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
