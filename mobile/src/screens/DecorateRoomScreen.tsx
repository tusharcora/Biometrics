import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { EditRoom } from '../components/edit/EditRoom';
import { useMyKip } from '../lib/kip/myKip';
import { useTodayScene } from '../lib/home/useTodayScene';
import { setDecorateOpen } from '../lib/room/decorateOpen';
import { loadCosmetics, markCosmeticsSeen, useCosmetics, type Cosmetics } from '../lib/room/cosmeticsStore';
import { editorReducer, initEditor, isChanged, type DecorateParams, type EditorAction, type EditorState } from '../lib/room/edit/editor';
import { ROOM_COPY } from '../lib/room/roomCopy';

/** The editor's room: a whole 7 × 7 room at 2 points (plan ruling 17); bigger rooms pan. */
export const EDIT_ROOM_HEIGHT = 320;

// The free-build editor (spec 2026-10-15 §5): a full-screen modal over the KIP page (C6's "drawer over the chat"
// drawn as this modal, §5.1). Cancel / EDITING / Done, the room count, the room. The KIP page's loops pause while it
// is open (Spec B ruling 17). Task 11 adds the toolbar, the pieces list and Done; Task 12 the drag; Task 13 the drawer.
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
  const [saving] = useState(false);
  const savingRef = useRef(false);
  // While a save is in flight nothing reaches the draft, a screen reader's activation included (Spec B Task 14 minor).
  const act = useCallback((a: EditorAction) => { if (!savingRef.current) dispatch(a); }, []);

  // Opening the editor marks everything shown as seen (Spec B §4); the New tab keeps its snapshot (ruling 15).
  useEffect(() => { void markCosmeticsSeen(cosmetics.fresh.map((f) => f.itemId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = isChanged(state);
  const cancel = () => {
    if (!changed) { leaving.current = true; navigation.goBack(); return; }
    Alert.alert(ROOM_COPY.discard.title, undefined, [
      { text: ROOM_COPY.discard.keep, style: 'cancel' },
      { text: ROOM_COPY.discard.discard, style: 'destructive', onPress: () => { leaving.current = true; navigation.goBack(); } },
    ]);
  };
  const n = state.draft.layout.pieces.length;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-1">
        <Button testID="edit-cancel" variant="ghost" disabled={saving} onPress={cancel}>{ROOM_COPY.cancel}</Button>
        <PageTitle>{ROOM_COPY.edit.title}</PageTitle>
        <Button testID="edit-done" disabled>{ROOM_COPY.done}</Button>
      </View>
      <Text testID="edit-count" accessibilityLabel={ROOM_COPY.edit.countLabel(n, cosmetics.cap)} className="px-4 pb-2 text-caption text-muted-foreground">
        {ROOM_COPY.edit.count(n, cosmetics.cap)}
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View testID="edit-editing" pointerEvents={saving ? 'none' : 'auto'}>
          <EditRoom state={state} dispatch={act} width={width} height={EDIT_ROOM_HEIGHT} window={day.window} colour={me.colour} reduceMotion={reduceMotion} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
