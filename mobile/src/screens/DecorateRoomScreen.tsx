import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { ApiError } from '../api/client';
import { COACH_PLACE_AT_ONCE_BELOW, CoachMark } from '../components/edit/CoachMark';
import { EditNotices } from '../components/edit/EditNotices';
import { EditRoom, type EditRoomHandle } from '../components/edit/EditRoom';
import { EditToolbar } from '../components/edit/EditToolbar';
import { WalletChip } from '../components/coins/WalletChip';
import { InventoryDrawer } from '../components/edit/InventoryDrawer';
import { PiecesList } from '../components/edit/PiecesList';
import { useMyKip } from '../lib/kip/myKip';
import { useTodayScene } from '../lib/home/useTodayScene';
import { setDecorateOpen } from '../lib/room/decorateOpen';
import { getCosmetics, loadCosmetics, markCosmeticsSeen, saveCosmeticsLoadout, useCosmetics, type Cosmetics } from '../lib/room/cosmeticsStore';
import { editorReducer, initEditor, isChanged, type DecorateParams, type EditorAction, type EditorState, type Outcome } from '../lib/room/edit/editor';
import { nudgeAnnouncement } from '../lib/room/edit/labels';
import { ROOM_COPY } from '../lib/room/roomCopy';

/** The editor's room: a whole 7 × 7 room at 2 points (plan ruling 17); bigger rooms pan. */
export const EDIT_ROOM_HEIGHT = 320;

/** At most 320 points and 42% of the window (ruling T13-LAYOUT), so a 568-point phone keeps room for the rest. */
export function editRoomHeight(windowHeight: number): number {
  return Math.min(EDIT_ROOM_HEIGHT, Math.round(windowHeight * 0.42));
}

// The free-build editor (spec 2026-10-15 §5): a full-screen modal over the KIP page (C6's "drawer over the chat"
// drawn as this modal, §5.1). Cancel / EDITING / Done, the room count, the room. The KIP page's loops pause while it
// is open (Spec B ruling 17). The room and the notices stay put; under them the toolbar, the inventory drawer and the
// pieces list scroll (ruling T13-LAYOUT). The room holds the drag; the drawer's tiles drive it through the room's
// handle (plan ruling 16).
export function DecorateRoomScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as DecorateParams;
  const cosmetics = useCosmetics();
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
          <Button testID="edit-cancel" variant="ghost" onPress={() => navigation.goBack()}>{ROOM_COPY.cancel}</Button>
          <PageTitle>{ROOM_COPY.edit.title}</PageTitle>
          <View className="w-16" />
        </View>
        {failed ? (
          <View testID="edit-load-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{ROOM_COPY.loadFailed.text}</Text>
            <View className="flex-row gap-2">
              <Button testID="edit-retry" className="flex-1" onPress={load}>{ROOM_COPY.loadFailed.retry}</Button>
              <Button testID="edit-close" variant="outline" className="flex-1" onPress={() => navigation.goBack()}>{ROOM_COPY.loadFailed.close}</Button>
            </View>
          </View>
        ) : (
          <Skeleton testID="edit-loading" className="m-4 h-72 rounded-lg" />
        )}
      </SafeAreaView>
    );
  }
  return <Editor cosmetics={cosmetics} params={params} navigation={navigation} />;
}

export function initialState(c: Cosmetics, params: DecorateParams): EditorState {
  return initEditor({ layout: c.layout, worn: c.worn, tier: c.tier, counts: c.counts, version: c.version, newIds: c.fresh.map((f) => f.itemId) }, params);
}

function Editor({ cosmetics, params, navigation }: { cosmetics: Cosmetics; params: DecorateParams; navigation: any }) {
  const me = useMyKip();
  const reduceMotion = useReducedMotion();
  const day = useTodayScene(navigation);
  const { width, height } = useWindowDimensions();
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialState(cosmetics, params));
  const leaving = useRef(false);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const savingRef = useRef(false);
  // The room's drag, for the drawer's tiles to drive (plan ruling 16).
  const roomRef = useRef<EditRoomHandle>(null);
  // A drawer tile's drag holds the page's scroll still from lift to drop (T13-FIX), and the drawer is never taller
  // than the scroll area's visible height.
  const [drawerDrag, setDrawerDrag] = useState(false);
  const [scrollHeight, setScrollHeight] = useState<number | undefined>(undefined);
  // While a save is in flight nothing reaches the draft, a screen reader's activation included (Spec B Task 14 minor).
  const act = useCallback((a: EditorAction) => { if (!savingRef.current) dispatch(a); }, []);

  // Opening the editor marks everything shown as seen (Spec B §4); the New tab keeps its snapshot (ruling 15).
  useEffect(() => { void markCosmeticsSeen(cosmetics.fresh.map((f) => f.itemId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = isChanged(state);
  // Cancel, the Android back button and a dismiss gesture all ask first when something changed (one confirm, P30).
  // While a save is in flight nothing leaves: Cancel is disabled and a dismiss is held without asking.
  const confirmDiscard = (onDiscard: () => void) =>
    Alert.alert(ROOM_COPY.discard.title, undefined, [
      { text: ROOM_COPY.discard.keep, style: 'cancel' },
      { text: ROOM_COPY.discard.discard, style: 'destructive', onPress: () => { leaving.current = true; onDiscard(); } },
    ]);
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
    if (leaving.current) return;
    if (savingRef.current) { e.preventDefault(); return; }
    if (!changed) return;
    e.preventDefault();
    confirmDiscard(() => navigation.dispatch(e.data.action));
  }), [navigation, changed]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = () => {
    if (!changed) { leaving.current = true; navigation.goBack(); return; }
    confirmDiscard(() => navigation.goBack());
  };

  // A polite live region on Android; iOS has none, so each failure is announced as it happens, every time.
  const announce = (text: string) => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text); };

  // Each nudge or Put on… says where the piece went or why not (spec §5.7), on both platforms (ruling T14-FIX): a live
  // region stays quiet when its text doesn't change, so Android would miss the same refusal twice. The reducer makes a
  // new `outcome` for every press, so each press is said exactly once.
  const lastSaid = useRef<Outcome | null>(null);
  useEffect(() => {
    if (!state.nudging || !state.outcome || state.outcome === lastSaid.current) return;
    lastSaid.current = state.outcome;
    const text = nudgeAnnouncement(state);
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [state.outcome, state.nudging]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // A save clears the last notice, so the same failure again is announced again (ruling T12-CARRY).
    dispatch({ type: 'saving' });
    try {
      // Saved against the version the draft was built on (Spec B final review fix #1): a newer room read meanwhile
      // answers 409 instead of being overwritten.
      const next = await saveCosmeticsLoadout({ layout: state.draft.layout, worn: state.draft.worn, version: state.baseVersion });
      dispatch({ type: 'saved', draft: { layout: next.layout, worn: next.worn }, version: next.version });
      leaving.current = true;
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
        // Another device saved, or something placed is no longer yours: show the server's room and stay. Only a read
        // that really landed counts (Spec B Task 14 ruling): a failed, dropped or older read leaves the store as it
        // was, and a mark-seen republishes the same layout object, so a new layout object is the honest test.
        const before = getCosmetics();
        const fresh = await loadCosmetics();
        if (fresh && fresh !== before && fresh.layout !== before?.layout) {
          dispatch({ type: 'refreshed', draft: { layout: fresh.layout, worn: fresh.worn }, version: fresh.version, counts: fresh.counts, tier: fresh.tier });
          announce(ROOM_COPY.refreshed);
          return;
        }
      }
      dispatch({ type: 'saveFailed' });
      announce(ROOM_COPY.saveFailed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const n = state.draft.layout.pieces.length;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-1">
        <Button testID="edit-cancel" variant="ghost" disabled={saving} onPress={cancel}>{ROOM_COPY.cancel}</Button>
        <PageTitle>{ROOM_COPY.edit.title}</PageTitle>
        <View className="flex-row items-center gap-2">
          <WalletChip testID="edit-wallet" />
          <Button testID="edit-done" disabled={!changed || saving} loading={saving} onPress={() => void save()}>{ROOM_COPY.done}</Button>
        </View>
      </View>
      <Text testID="edit-count" accessibilityLabel={ROOM_COPY.edit.countLabel(n, cosmetics.cap)} className="px-4 pb-2 text-caption text-muted-foreground">
        {ROOM_COPY.edit.count(n, cosmetics.cap)}
      </Text>
      {/* The room is pinned above the scrolling part (ruling T12-FIX), so a drag or a pan in it never scrolls the page. */}
      <View testID="edit-editing" className="flex-1" pointerEvents={saving ? 'none' : 'auto'}>
        <EditRoom ref={roomRef} state={state} dispatch={act} width={width} height={editRoomHeight(height)} window={day.window} colour={me.colour} reduceMotion={reduceMotion} showGrid={showGrid} />
        <EditNotices state={state} />
        <ScrollView
          testID="edit-scroll"
          style={{ flex: 1 }}
          scrollEnabled={!drawerDrag}
          onLayout={(e) => setScrollHeight(e.nativeEvent.layout.height)}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <EditToolbar state={state} dispatch={act} showGrid={showGrid} onToggleGrid={() => setShowGrid((v) => !v)} />
          {/* The guided first placement (spec §11.1): just above the drawer the lantern comes from. */}
          <CoachMark state={state} dispatch={act} placeAtOnce={height < COACH_PLACE_AT_ONCE_BELOW} />
          <InventoryDrawer state={state} dispatch={act} room={roomRef} colour={me.colour} counters={cosmetics.counters} maxHeight={scrollHeight} onDragChange={setDrawerDrag} />
          <PiecesList state={state} dispatch={act} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
