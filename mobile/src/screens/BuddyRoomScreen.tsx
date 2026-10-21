import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, findNodeHandle, useWindowDimensions, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { cheerBuddyRoom, fetchBuddyRoom } from '../api/rooms';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import { useCosmetics } from '../lib/room/cosmeticsStore';
import { ROOM_COPY, spokenName } from '../lib/room/roomCopy';
import { missingPieces, pieceInfo, readVisit, type RoomVisit } from '../lib/room/visit';

const V = ROOM_COPY.visit;
type State = { status: 'loading' } | { status: 'ready'; visit: RoomVisit } | { status: 'closed' } | { status: 'error' };

// A buddy's room (spec 2026-10-15 §10.1, §10.2, C4; P4 rulings 8, 21, 24, 27): read-only, drawn neutral, the size
// only. Nothing on it can be selected or edited: no piece actions, no taps, only a pan. Cheer once a day (both of you
// earn, inside the 5 paid cheers a day); the week's count; the pieces you don't have and how to get them; Send a gift.
// A 404 is the one closed answer for every reason (the server says nothing more, and neither does this screen); a
// cheer already given today shows as cheered; any other failure leaves the cheer offered with the reason's line. A
// screen reader lands on the title; a cheer is announced (iOS) and shown in a live line (Android). Nothing is logged.
export function BuddyRoomScreen() {
  const navigation = useNavigation<any>();
  const { buddyId, name: given } = (useRoute().params ?? {}) as { buddyId: string; name?: string };
  const { width } = useWindowDimensions();
  const mine = useCosmetics();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  // `busy` disables the cheer only after a re-render; a double tap in one frame cheers once.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Loads once per mount (and on "Try again"); a failure never retries by itself.
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const visit = readVisit(await fetchBuddyRoom(buddyId));
      if (mounted.current) setState({ status: 'ready', visit });
    } catch (e) {
      if (mounted.current) setState(e instanceof ApiError && e.status === 404 ? { status: 'closed' } : { status: 'error' });
    }
  }, [buddyId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [state.status]);

  async function cheer() {
    if (state.status !== 'ready' || state.visit.cheeredToday || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNote(null);
    const cheered = (add: number) =>
      setState((s) => (s.status === 'ready' ? { status: 'ready', visit: { ...s.visit, cheeredToday: true, cheersThisWeek: s.visit.cheersThisWeek + add } } : s));
    try {
      const { paid } = await cheerBuddyRoom(buddyId);
      if (!mounted.current) return;
      cheered(1);
      setNote(paid ? V.cheeredPaid : V.cheered);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(paid ? V.cheeredPaidSpoken : V.cheered);
    } catch (e) {
      if (!mounted.current) return;
      const code = e instanceof ApiError ? e.code ?? null : null;
      // Already cheered today (on another device): the count already holds it.
      if (code === 'already_cheered') cheered(0);
      else if (e instanceof ApiError && e.status === 404) setState({ status: 'closed' });
      else setNote(buddyErrorMessage(code));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (state.status === 'loading') {
    return <SafeAreaView className="flex-1 items-center justify-center bg-background"><ActivityIndicator testID="visit-loading" /></SafeAreaView>;
  }
  if (state.status === 'closed' || state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text testID={state.status === 'closed' ? 'visit-closed' : 'visit-error'} className="text-center text-body text-muted-foreground">
          {state.status === 'closed' ? V.closed : V.failed}
        </Text>
        {state.status === 'error' ? <Button testID="visit-retry" variant="secondary" className="h-[44px]" onPress={() => void load()}>{V.retry}</Button> : null}
      </SafeAreaView>
    );
  }

  const v = state.visit;
  const name = v.name || given || '';
  const missing = missingPieces(v.layout, mine?.counts ?? {});
  const shown = info ? pieceInfo(info) : null;
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <PageTitle ref={titleRef} testID="visit-title">{V.title(name)}</PageTitle>
        <Text testID="visit-size" accessibilityLabel={V.sizeSpoken(v.size, v.layout.pieces.length)} className="text-caption text-muted-foreground tabular-nums">
          {V.size(v.size, v.layout.pieces.length)}
        </Text>
        <NeutralRoom
          testID="visit-room"
          layout={v.layout}
          tier={v.tier}
          colour={v.colour}
          worn={v.worn}
          pose="wave"
          bubble={V.hi}
          width={width - 32}
          height={260}
          label={V.label(name)}
          pannable
        />
        <Text className="text-caption text-muted-foreground">{V.looking}</Text>
        <Button testID="visit-cheer" className="h-[44px]" disabled={busy || v.cheeredToday} onPress={() => void cheer()}>
          {v.cheeredToday ? V.cheeredToday : V.cheer(name)}
        </Button>
        <Text testID="visit-cheers" className="text-caption text-muted-foreground tabular-nums">{V.cheersWeek(v.cheersThisWeek)}</Text>
        <Text testID="visit-note" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{note ?? ''}</Text>
        <Button testID="visit-gift" variant="outline" className="h-[44px]" onPress={() => navigation.navigate('GiftSend', { buddyId, name })}>{V.gift}</Button>
        {missing.length ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-heading">{V.missing}</Text>
            <View className="flex-row flex-wrap gap-2">
              {missing.map((id) => (
                <Button
                  key={id}
                  testID={`visit-missing-${id}`}
                  variant={info === id ? 'default' : 'outline'}
                  className="h-auto min-h-[64px] w-[72px] flex-col gap-1 rounded-lg p-1"
                  accessibilityLabel={V.missingSpoken(spokenName(id), pieceInfo(id).spoken)}
                  accessibilityState={{ selected: info === id }}
                  onPress={() => setInfo(id)}
                >
                  <ItemIcon id={id} colour={v.colour} size={40} />
                </Button>
              ))}
            </View>
            {shown ? (
              <View
                testID="visit-missing-info"
                accessible
                accessibilityLabel={V.missingSpoken(spokenName(info!), shown.spoken)}
                accessibilityLiveRegion="polite"
                className="gap-1 rounded-lg border border-border p-3">
                <Text className="text-body font-semibold">{shown.name}</Text>
                <Text className="text-caption text-muted-foreground">{shown.line}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
