import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  acceptRequest, blockFromRequest, buddyErrorCode, cancelRequest, declineRequest, fetchActivity, fetchBuddyPage, fetchRequests, markActivitySeen,
  type ActivityItem, type BuddyIdentity, type BuddyRow, type IncomingRequest, type OutgoingRequest,
} from '../api/buddies';
import { BuddyListRow } from '../components/buddies/BuddyListRow';
import { IdentityGate } from '../components/buddies/IdentityGate';
import { MoodNoticeSheet } from '../components/buddies/MoodNoticeSheet';
import { useMoodNoticeGate } from '../components/buddies/useMoodNoticeGate';
import { Character } from '../components/characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../components/characters/types';
import { Button } from '../components/ui/button';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Text } from '../components/ui/text';
import { activityLine, buddyErrorMessage } from '../lib/buddyCopy';
import { refreshBuddies, useBuddies } from '../lib/buddiesStore';
import { offerPushAfterPairing } from '../lib/buddyPushOffer';
import { refreshSocial } from '../lib/socialStore';
import { useRefreshBuddiesOnFocus } from '../lib/useRefreshBuddiesOnFocus';

type Tab = 'buddies' | 'requests' | 'activity';
type Nav = { navigate: (name: string, params?: object) => void; addListener?: (event: 'focus', callback: () => void) => () => void };
type Gate = ReturnType<typeof useMoodNoticeGate>;
type RequestItem = { kind: 'in'; request: IncomingRequest } | { kind: 'out'; request: OutgoingRequest };

/** Rows in order, each id once (a page boundary can repeat a row). */
function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

// Buddies (spec 2026-10-06 buddies §7, design 2): the paged list, pending requests (accept / decline
// / block) and Activity with an unseen dot. The header line is fixed text, never model output.
export function BuddiesScreen() {
  const navigation = useNavigation() as unknown as Nav;
  const route = useRoute() as { params?: { tab?: Tab; open?: number } };
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <IdentityGate>
        {(identity) => <BuddiesBody identity={identity} navigation={navigation} initialTab={route.params?.tab ?? 'buddies'} openedAt={route.params?.open} />}
      </IdentityGate>
    </SafeAreaView>
  );
}

function BuddiesBody({ identity, navigation, initialTab, openedAt }: { identity: BuddyIdentity; navigation: Nav; initialTab: Tab; openedAt?: number }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // A request push tapped while this screen is open changes the params; its new `open` re-selects
  // the tab even when `tab` is the one the screen already has.
  useEffect(() => setTab(initialTab), [initialTab, openedAt]);
  useRefreshBuddiesOnFocus();
  const gate = useMoodNoticeGate(identity.moodNoticeSeen);
  const [unseen, setUnseen] = useState(0);
  // Bumped each time Activity marks everything seen: a count read that started before it is dropped,
  // so a slower read can't bring the dot back.
  const cleared = useRef(0);
  const readUnseen = useCallback(() => {
    const at = cleared.current;
    fetchActivity()
      .then((page) => {
        if (at === cleared.current) setUnseen(page.unseen);
      })
      .catch(() => undefined);
  }, []);
  // On mount and each time the screen comes back into focus.
  useEffect(() => {
    readUnseen();
    return navigation.addListener?.('focus', readUnseen);
  }, [navigation, readUnseen]);
  const onSeen = useCallback(() => {
    cleared.current++;
    setUnseen(0);
  }, []);
  const openRequests = useCallback(() => setTab('requests'), []);
  const options = [
    { value: 'buddies' as const, label: 'Buddies' },
    { value: 'requests' as const, label: 'Requests' },
    { value: 'activity' as const, label: unseen > 0 ? 'Activity •' : 'Activity' },
  ];
  return (
    <View className="flex-1 gap-3 px-4 pt-3">
      <Text className="text-sm text-muted-foreground">You see their coach's mood, never their numbers unless they share them.</Text>
      <SegmentedControl testID="buddies-tabs" options={options} value={tab} onChange={setTab} />
      {tab === 'buddies' ? <BuddyListTab navigation={navigation} /> : null}
      {tab === 'requests' ? <RequestsTab gate={gate} navigation={navigation} /> : null}
      {tab === 'activity' ? <ActivityTab navigation={navigation} onSeen={onSeen} onOpenRequests={openRequests} /> : null}
      <MoodNoticeSheet {...gate.sheet} />
    </View>
  );
}

function BuddyListTab({ navigation }: { navigation: Nav }) {
  const store = useBuddies();
  const first = store.status === 'ready' ? store.page : null;
  const [more, setMore] = useState<BuddyRow[]>([]);
  // undefined: follow the store's first page; null: no more pages.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  // `loading` shows only after a re-render; two end-reached events in one frame load a page once.
  const loadingRef = useRef(false);
  // A fresh first page (focus, after a request is answered) starts paging over; a page that was
  // loading for the old list is dropped.
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setMore([]);
    setCursor(undefined);
  }, [first]);
  const rows = useMemo(() => uniqueById([...(first?.buddies ?? []), ...more]), [first, more]);

  if (store.status === 'idle') return <ActivityIndicator testID="buddies-loading" />;
  if (!first) {
    return (
      <View testID="buddies-error" className="items-center gap-3 py-8">
        <Text className="text-muted-foreground">Couldn't load your buddies.</Text>
        <Button variant="outline" onPress={() => void refreshBuddies()}>Try again</Button>
      </View>
    );
  }
  const next = cursor === undefined ? first.nextCursor : cursor;

  async function loadMore() {
    if (!next || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const at = generation.current;
    try {
      const page = await fetchBuddyPage(next);
      if (page && at === generation.current) {
        setMore((prev) => [...prev, ...page.buddies]);
        setCursor(page.nextCursor);
      }
    } catch {
      // Keep what is shown; the next scroll to the end tries again.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <FlatList
      testID="buddies-list"
      data={rows}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <BuddyListRow row={item} onPress={() => navigation.navigate('BuddyWeek', { buddyId: item.id })} />}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text testID="buddies-empty" className="py-8 text-center text-muted-foreground">No buddies yet. Pair up with a friend to see each other's mood.</Text>}
      ListFooterComponent={
        <View className="gap-3 py-4">
          {loading ? <ActivityIndicator /> : null}
          <Button testID="buddies-add" onPress={() => navigation.navigate('PairUp')}>Add a buddy</Button>
        </View>
      }
    />
  );
}

function RequestsTab({ gate, navigation }: { gate: Gate; navigation: Nav }) {
  const [lists, setLists] = useState<{ incoming: IncomingRequest[]; outgoing: OutgoingRequest[] } | null | 'error'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // `busy` disables the buttons only after a re-render; a double tap in one frame calls the API once.
  const inFlight = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    try {
      const next = await fetchRequests();
      if (live.current) setLists(next);
    } catch {
      if (live.current) setLists('error');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // One answer at a time. The lists are re-read either way (a refused answer may mean the request
  // is gone); the shared buddies refresh after an answer that went through.
  function perform(fn: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    void (async () => {
      try {
        try {
          await fn();
          void refreshBuddies();
          void refreshSocial();
        } catch (e) {
          if (live.current) setMessage(buddyErrorMessage(buddyErrorCode(e)));
        }
        await load();
      } finally {
        inFlight.current = false;
        if (live.current) setBusy(false);
      }
    })();
  }
  // Accepting pairs, so it waits for the one-time mood notice; the guard sits inside the held
  // action, so "Not now" leaves nothing taken.
  const accept = (id: string) =>
    gate.run(() =>
      perform(async () => {
        const { buddyId } = await acceptRequest(id);
        navigation.navigate('BuddyWeek', { buddyId });
        // After the navigation, never awaited: the first pairing on this device offers notifications once.
        void offerPushAfterPairing();
      }),
    );
  const block = (r: IncomingRequest) => {
    if (inFlight.current) return;
    Alert.alert(`Block ${r.from.displayName}?`, "They won't be told. You can unblock them in Profile.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => perform(() => blockFromRequest(r.id)) },
    ]);
  };

  if (lists === null) return <ActivityIndicator testID="requests-loading" />;
  if (lists === 'error') return <Text testID="requests-error" className="py-8 text-center text-muted-foreground">Couldn't load requests.</Text>;
  const items: RequestItem[] = [
    ...lists.incoming.map((request) => ({ kind: 'in' as const, request })),
    ...lists.outgoing.map((request) => ({ kind: 'out' as const, request })),
  ];
  return (
    <FlatList
      testID="requests-list"
      data={items}
      keyExtractor={(i) => `${i.kind}-${i.request.id}`}
      contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
      ListHeaderComponent={message ? <Text testID="requests-message" className="text-sm text-destructive">{message}</Text> : null}
      ListEmptyComponent={<Text testID="requests-empty" className="py-8 text-center text-muted-foreground">No requests right now.</Text>}
      renderItem={({ item }) =>
        item.kind === 'in' ? (
          <View testID={`request-in-${item.request.id}`} className="gap-2 rounded-card border border-border bg-card p-3">
            <View className="flex-row items-center gap-3">
              <Character characterId={isCharacterId(item.request.from.coachId) ? item.request.from.coachId : DEFAULT_CHARACTER_ID} mood="idle" size={40} paused />
              <View className="flex-1">
                <Text className="font-semibold">{item.request.from.displayName}</Text>
                <Text className="text-sm text-muted-foreground">@{item.request.from.handle} wants to be your buddy</Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button testID={`request-accept-${item.request.id}`} size="sm" disabled={busy} onPress={() => accept(item.request.id)}>Accept</Button>
              <Button testID={`request-decline-${item.request.id}`} size="sm" variant="outline" disabled={busy} onPress={() => perform(() => declineRequest(item.request.id))}>Decline</Button>
              <Button testID={`request-block-${item.request.id}`} size="sm" variant="destructive" disabled={busy} onPress={() => block(item.request)}>Block</Button>
            </View>
          </View>
        ) : (
          <View testID={`request-out-${item.request.id}`} className="flex-row items-center justify-between rounded-card border border-border bg-card p-3">
            {/* The handle as typed when sent; an older request has none, so it reads neutrally. */}
            <Text className="flex-1">{item.request.toHandle ? `@${item.request.toHandle} · Pending` : 'Pending request'}</Text>
            <Button testID={`request-cancel-${item.request.id}`} size="sm" variant="ghost" disabled={busy} onPress={() => perform(() => cancelRequest(item.request.id))}>Cancel</Button>
          </View>
        )
      }
    />
  );
}

function ActivityTab({ navigation, onSeen, onOpenRequests }: { navigation: Nav; onSeen: () => void; onOpenRequests: () => void }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loadingMore = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Loaded, and marked seen, once per visit to the tab.
  useEffect(() => {
    let live = true;
    void (async () => {
      let page;
      try {
        page = await fetchActivity();
      } catch {
        if (live) setFailed(true);
        return;
      }
      if (!live) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      if (page.unseen > 0) {
        try {
          await markActivitySeen();
          onSeen();
        } catch {
          // The dot stays; the next visit tries again.
        }
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await fetchActivity(cursor);
      if (!mounted.current) return;
      setItems((prev) => uniqueById([...(prev ?? []), ...page.items]));
      setCursor(page.nextCursor);
    } catch {
      // Keep what is shown.
    } finally {
      loadingMore.current = false;
    }
  }
  // A request item carries no status, so it only switches to the Requests tab (which shows what is
  // still pending); it never offers an answer itself. In-screen: navigating to this same route with
  // the tab param it already has would do nothing.
  const open = (item: ActivityItem) => (item.kind === 'request' ? onOpenRequests() : navigation.navigate('BuddyWeek', { buddyId: item.actor.id }));

  if (failed) return <Text testID="activity-error" className="py-8 text-center text-muted-foreground">Couldn't load Activity.</Text>;
  if (items === null) return <ActivityIndicator testID="activity-loading" />;
  return (
    <FlatList
      testID="activity-list"
      data={items}
      keyExtractor={(i) => i.id}
      onEndReached={() => void loadMore()}
      ListEmptyComponent={<Text testID="activity-empty" className="py-8 text-center text-muted-foreground">Nothing yet.</Text>}
      renderItem={({ item }) => (
        <Pressable testID={`activity-${item.id}`} onPress={() => open(item)} accessibilityRole="button" className="flex-row items-center gap-3 py-2 active:opacity-70">
          <Character characterId={isCharacterId(item.actor.coachId) ? item.actor.coachId : DEFAULT_CHARACTER_ID} mood="idle" size={36} paused />
          <Text className="flex-1">{activityLine(item)}</Text>
          {!item.seen ? <View testID={`activity-${item.id}-unseen`} className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
        </Pressable>
      )}
    />
  );
}
