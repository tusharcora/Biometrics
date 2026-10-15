import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { ApiError } from '../api/client';
import { EditNotices } from '../components/edit/EditNotices';
import { EditRoom, type EditRoomHandle } from '../components/edit/EditRoom';
import { EditToolbar } from '../components/edit/EditToolbar';
import { PiecesList } from '../components/edit/PiecesList';
import { useMyKip } from '../lib/kip/myKip';
import { useTodayScene } from '../lib/home/useTodayScene';
import { setDecorateOpen } from '../lib/room/decorateOpen';
import { getCosmetics, loadCosmetics, markCosmeticsSeen, saveCosmeticsLoadout, useCosmetics, type Cosmetics } from '../lib/room/cosmeticsStore';
import { editorReducer, initEditor, isChanged, type DecorateParams, type EditorAction, type EditorState } from '../lib/room/edit/editor';
import { ROOM_COPY } from '../lib/room/roomCopy';

/** The editor's room: a whole 7 × 7 room at 2 points (plan ruling 17); bigger rooms pan. */
export const EDIT_ROOM_HEIGHT = 320;

// The free-build editor (spec 2026-10-15 §5): a full-screen modal over the KIP page (C6's "drawer over the chat"
// drawn as this modal, §5.1). Cancel / EDITING / Done, the room count, the room. The KIP page's loops pause while it
// is open (Spec B ruling 17). Under the room: the notices, the toolbar and the pieces list. The room holds the drag;
// Task 13's drawer drives it through the room's handle.
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
  const { width } = useWindowDimensions();
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialState(cosmetics, params));
  const leaving = useRef(false);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const savingRef = useRef(false);
  // The room's drag, for the drawer's tiles to drive (plan ruling 16, Task 13).
  const roomRef = useRef<EditRoomHandle>(null);
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
        <Button testID="edit-done" disabled={!changed || saving} loading={saving} onPress={() => void save()}>{ROOM_COPY.done}</Button>
      </View>
      <Text testID="edit-count" accessibilityLabel={ROOM_COPY.edit.countLabel(n, cosmetics.cap)} className="px-4 pb-2 text-caption text-muted-foreground">
        {ROOM_COPY.edit.count(n, cosmetics.cap)}
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View testID="edit-editing" pointerEvents={saving ? 'none' : 'auto'}>
          <EditRoom ref={roomRef} state={state} dispatch={act} width={width} height={EDIT_ROOM_HEIGHT} window={day.window} colour={me.colour} reduceMotion={reduceMotion} showGrid={showGrid} />
          <EditNotices state={state} />
          <EditToolbar state={state} dispatch={act} showGrid={showGrid} onToggleGrid={() => setShowGrid((v) => !v)} />
          <PiecesList state={state} dispatch={act} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
