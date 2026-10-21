import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, findNodeHandle, useWindowDimensions, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../api/client';
import { cheerEntry, enterChallenge, fetchChallenge, type ChallengeDTO, type ChallengeEntryDTO } from '../api/rooms';
import { ItemIcon } from '../components/room/ItemIcon';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import { loadCoins } from '../lib/coins/coinsStore';
import { kipColourOf } from '../lib/kip/kipColour';
import { useMyKip } from '../lib/kip/myKip';
import { kipWornOf } from '../lib/kip/wornArt';
import { daysLeft, entryRoom } from '../lib/room/challenge';
import { loadCosmetics } from '../lib/room/cosmeticsStore';
import { loadRoomSocial } from '../lib/room/giftsStore';
import { ROOM_COPY, itemName, spokenName, themeWords } from '../lib/room/roomCopy';
import type { RootStackParamList } from '../navigation/RootNavigator';

const C = ROOM_COPY.challenge;
const TARGET = 'h-[44px]';
const ENTRY_ROOM_HEIGHT = 180;
type State = { status: 'loading' } | { status: 'ready'; dto: ChallengeDTO } | { status: 'error' };
type Note = { text: string; spoken: string };

// The weekly theme challenge (spec 2026-10-15 §10.4, C3; P4 rulings 6, 7, 10, 22, 24, 28): the brief and its rewards;
// the consent line above Start my entry (entering is the opt-in for the snapshot); your entry's checklist and the way
// to the editor's theme tab; your buddies' entries drawn neutral, each cheered once; last week's results in your
// circle, names only. Every date is the server's (its week, closesAt and open): the app never works one out. Who is
// shown is the server's too (anyone blocked either way is already left out, PF4-F18). After an entry or a cheer the
// room, the coins and the room card's challenge are read again (T11T12-RELOAD). A cheer refused 409 shows as cheered
// or that entry closed (an entry carries no closed flag, so a buddy whose own week closed first is found this way);
// a 503 keeps it offered. Close (and Android's back) leave at any time except while an entry or a cheer waits on the
// server (PF4-F16, the coin shop's hold). A screen reader lands on the title; results of a tap are announced (iOS) and
// shown in a live line (Android). Nothing is logged.
export function RoomChallengeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'RoomChallenge'>>();
  const me = useMyKip();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  // Entries a cheer found closed (409 challenge_closed): their own week ended before yours.
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  // `busy` disables the buttons only after a re-render; a double tap in one frame acts once.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Loads once per mount (and on Try again); a failure never retries by itself.
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const dto = await fetchChallenge();
      if (mounted.current) setState({ status: 'ready', dto });
    } catch {
      if (mounted.current) setState({ status: 'error' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // A read after a refusal keeps what is shown when it fails.
  const refresh = async () => {
    try {
      const dto = await fetchChallenge();
      if (mounted.current) setState({ status: 'ready', dto });
    } catch {
      // The screen stays as it was; Close and a new open read again.
    }
  };
  useEffect(() => {
    if (state.status !== 'ready') return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [state.status]);

  // While an entry or a cheer waits on the server nothing leaves: Close is disabled and Android's back is held.
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void }) => {
    if (inFlight.current) e.preventDefault();
  }), [navigation]);

  // The note is a polite live region on Android; iOS has none, so it is announced there (the house pattern).
  const say = (text: string, spoken = text) => {
    setNote({ text, spoken });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  };
  async function run(fn: () => Promise<void>, failed: (e: unknown) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      if (mounted.current) failed(e);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const codeOf = (e: unknown) => (e instanceof ApiError ? e.code ?? null : null);

  const start = () => run(async () => {
    const dto = await enterChallenge();
    if (!mounted.current) return;
    setState({ status: 'ready', dto });
    // The +30 is paid after the server's commit, so the coins are read afresh; the room card learns of the entry.
    void loadCosmetics();
    void loadCoins({ fresh: true });
    void loadRoomSocial();
    if (dto.entry?.paid) say(C.enteredPaid, C.enteredPaidSpoken);
    else say(C.entered);
  }, (e) => {
    const code = codeOf(e);
    if (code === 'challenge_closed' || code === 'no_challenge') {
      say(code === 'challenge_closed' ? C.closed : C.none);
      void refresh();
    } else if (code === 'try_later') {
      say(buddyErrorMessage(code));
    } else {
      say(C.enterFailed);
      if (!(e instanceof ApiError)) {
        // No answer: the entry may have landed. Read everything again.
        void loadCosmetics();
        void loadCoins({ fresh: true });
        void loadRoomSocial();
        void refresh();
      }
    }
  });

  const markCheered = (userId: string, add: number) =>
    setState((s) => (s.status === 'ready'
      ? { status: 'ready', dto: { ...s.dto, entries: s.dto.entries.map((e) => (e.userId === userId ? { ...e, cheers: e.cheers + add, cheeredByMe: true } : e)) } }
      : s));
  const cheer = (entry: ChallengeEntryDTO) => run(async () => {
    const { paid } = await cheerEntry(entry.userId);
    if (!mounted.current) return;
    markCheered(entry.userId, 1);
    void loadCosmetics();
    void loadCoins({ fresh: true });
    if (paid) say(C.cheeredPaid, C.cheeredPaidSpoken(entry.name));
    else say(C.cheered, C.cheeredSpoken(entry.name));
  }, (e) => {
    const code = codeOf(e);
    // Cheered already (on another device): the count the server sent holds it.
    if (code === 'already_cheered') markCheered(entry.userId, 0);
    else if (code === 'challenge_closed') {
      setClosed((s) => new Set(s).add(entry.userId));
      say(C.entryClosedLine(entry.name));
    } else if (e instanceof ApiError && e.status === 404) {
      // No longer buddies, or the entry is gone: the list is read again.
      say(C.entryGone);
      void refresh();
    } else if (code === 'try_later') say(buddyErrorMessage(code));
    else {
      say(C.cheerFailed);
      if (!(e instanceof ApiError)) void refresh();
    }
  });

  const header = (
    <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
      <Text testID="challenge-head" accessibilityLabel={C.headSpoken} className="shrink font-pixel text-label text-muted-foreground">{C.head}</Text>
      <Button testID="challenge-close" variant="ghost" className={TARGET} disabled={busy} onPress={() => navigation.goBack()}>{C.close}</Button>
    </View>
  );
  if (state.status !== 'ready') {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
        {header}
        {state.status === 'loading' ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator testID="challenge-loading" /></View>
        ) : (
          <View testID="challenge-failed" className="flex-1 items-center justify-center gap-3 p-6">
            <Text className="text-center text-body text-muted-foreground">{C.failed}</Text>
            <Button testID="challenge-retry" variant="secondary" className={TARGET} onPress={() => void load()}>{C.retry}</Button>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const d = state.dto;
  const words = d.theme ? themeWords(d.theme.id) : null;
  const others = d.entries.filter((e) => !e.mine);
  const days = d.closesAt ? daysLeft(d.closesAt, new Date()) : 0;
  const r = d.results;
  // Your own win is said as yours; the server puts your name first among the winners when you won (judge.ts).
  const winners = r ? (r.you.won ? r.winners.slice(1) : r.winners).filter(Boolean) : [];
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}>
        {d.theme && words ? (
          <Card className="gap-2 p-4">
            <PageTitle ref={titleRef} testID="challenge-title">{words.title}</PageTitle>
            <Text testID="challenge-brief" className="text-body">{words.brief}</Text>
            <Text className="text-body text-muted-foreground">{C.how}</Text>
            {d.open ? (
              <Text testID="challenge-tags" accessibilityLabel={C.tagsSpoken(others.length, days)} className="text-caption tabular-nums text-muted-foreground">
                {C.tags(others.length, days)}
              </Text>
            ) : (
              <Text testID="challenge-closed" className="text-caption text-muted-foreground">{C.closed}</Text>
            )}
          </Card>
        ) : (
          <Text ref={titleRef} testID="challenge-none" accessibilityRole="header" className="text-body text-muted-foreground">{C.none}</Text>
        )}
        {d.theme ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-heading">{C.rewards}</Text>
            <Text accessibilityLabel={C.enterSpoken} className="text-body">{C.enter}</Text>
            <View testID="challenge-reward-piece" accessible accessibilityLabel={C.piece(spokenName(d.theme.themePiece))} className="flex-row items-center gap-2">
              <ItemIcon id={d.theme.themePiece} colour={me.colour} size={36} />
              <Text className="shrink text-body">{C.piece(itemName(d.theme.themePiece))}</Text>
            </View>
            <View testID="challenge-reward-trophy" accessible accessibilityLabel={C.trophy(spokenName(d.theme.trophy))} className="flex-row items-center gap-2">
              <ItemIcon id={d.theme.trophy} colour={me.colour} size={36} />
              <Text className="shrink text-body">{C.trophy(itemName(d.theme.trophy))}</Text>
            </View>
          </View>
        ) : null}
        {d.theme && d.open && !d.entry ? (
          <View testID="challenge-enter" className="gap-2">
            <Text testID="challenge-consent" className="text-caption text-muted-foreground">{C.consent}</Text>
            <Button testID="challenge-start" className={TARGET} disabled={busy} onPress={() => void start()}>{C.start}</Button>
            <Text testID="challenge-snapshot" className="text-caption text-muted-foreground">{C.snapshot}</Text>
          </View>
        ) : null}
        {d.theme && words && d.entry ? (
          <Card className="gap-2 p-4">
            <Text testID="challenge-entered" accessibilityLabel={d.entry.paid ? C.enteredPaidSpoken : C.entered} className="text-body font-semibold">
              {d.entry.paid ? C.enteredPaid : C.entered}
            </Text>
            {/* The count is the server's, over the entry's snapshot. */}
            <Text testID="challenge-checklist" accessibilityLabel={C.checklistSpoken(words.tagName, d.entry.count, d.theme.atLeast)} className="text-caption tabular-nums">
              {C.checklist(words.tagName, d.entry.count, d.theme.atLeast)}
            </Text>
            {d.open ? (
              <Button testID="challenge-build" variant="outline" className={TARGET} disabled={busy} onPress={() => navigation.navigate('DecorateRoom', { drawer: 'theme' })}>
                {C.build}
              </Button>
            ) : null}
          </Card>
        ) : null}
        <Text testID="challenge-note" accessibilityLiveRegion="polite" accessibilityLabel={note?.spoken} className="text-caption text-muted-foreground">{note?.text ?? ''}</Text>
        {d.entries.length ? <Text accessibilityRole="header" className="text-heading">{C.entries}</Text> : null}
        {d.entries.map((e) => {
          const room = entryRoom(e.snapshot);
          const shut = closed.has(e.userId);
          return (
            <View key={e.userId} className="gap-2">
              <NeutralRoom
                testID={`entry-room-${e.userId}`}
                layout={room.layout}
                tier={room.tier}
                colour={kipColourOf(e.kipColour)}
                worn={kipWornOf(e.kipWorn)}
                pose="rest"
                bubble={null}
                width={width - 32}
                height={ENTRY_ROOM_HEIGHT}
                label={C.entryLabel(e.name)}
              />
              <View className="flex-row items-center justify-between gap-2">
                <Text className="shrink text-body font-semibold">{e.name}</Text>
                <Text testID={`entry-cheers-${e.userId}`} className="text-caption tabular-nums">{C.cheers(e.cheers)}</Text>
              </View>
              {/* Never your own entry (ruling 10); the server never lists it, and this never offers it. */}
              {e.mine ? null : (
                <Button
                  testID={`entry-cheer-${e.userId}`}
                  variant="outline"
                  className={TARGET}
                  accessibilityLabel={e.cheeredByMe ? C.cheeredSpoken(e.name) : shut ? C.entryClosedLine(e.name) : C.cheer(e.name)}
                  disabled={busy || e.cheeredByMe || shut || !d.open}
                  onPress={() => void cheer(e)}
                >
                  {e.cheeredByMe ? C.cheered : shut ? C.entryClosed : C.cheer(e.name)}
                </Button>
              )}
            </View>
          );
        })}
        {r ? (
          <Card className="gap-2 p-4">
            <Text accessibilityRole="header" className="text-heading">{C.results}</Text>
            {r.ranked ? (
              <>
                {r.you.won ? <Text testID="results-mine" className="text-body font-semibold">{C.youWon}</Text> : null}
                {winners.map((w, i) => <Text key={`${w}-${i}`} testID="results-won" className="text-body font-semibold">{C.won(w)}</Text>)}
                {winners.length ? <Text testID="results-glow" className="text-caption text-muted-foreground">{C.glow}</Text> : null}
                {r.entries.map((row, i) => (
                  <Text key={`${row.name}-${i}`} testID={`results-row-${i}`} accessibilityLabel={C.resultSpoken(row.name, row.cheers)} className="text-caption tabular-nums">
                    {C.result(row.name, row.cheers)}
                  </Text>
                ))}
              </>
            ) : (
              <Text testID="results-unranked" className="text-body">{C.unranked}</Text>
            )}
            {r.you.entered && !r.you.won ? <Text testID="results-you" className="text-caption">{C.youEntered}</Text> : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
