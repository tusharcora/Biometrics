import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ApiError } from '../api/client';
import { GIFT_NOTES, sendGift, type GiftNote } from '../api/rooms';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { isServerAnswer, newRequestId } from '../lib/coins/actions';
import { useMyKip } from '../lib/kip/myKip';
import { applyCounts, cosmeticsSession, getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { spareTiles } from '../lib/room/gifts';
import { ROOM_COPY, itemName, roomErrorMessage, spokenName } from '../lib/room/roomCopy';
import type { RootStackParamList } from '../navigation/RootNavigator';

const G = ROOM_COPY.gifts;

// Send a spare (spec 2026-10-15 §10.3, C4; P4 ruling 11): pick from your spares, pick a note from the fixed three,
// Send gift. Never optimistic: the count drops when the server answers, and your cosmetics are read again at once
// (T11T12-RELOAD). One request id per gift: kept for a retry after a lost answer, dropped after any server answer
// (P2 ruling 30), and never reused for another piece (this screen is one recipient). A screen reader lands on the
// title; the result is announced (iOS) and shown in a live line (Android). Nothing is logged.
export function GiftSendScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GiftSend'>>();
  const { buddyId, name } = useRoute<RouteProp<RootStackParamList, 'GiftSend'>>().params;
  const cosmetics = useCosmetics();
  const me = useMyKip();
  const [item, setItem] = useState<string | null>(null);
  const [note, setNote] = useState<GiftNote>('cosy');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; spoken: string } | null>(null);
  // `busy` disables Send only after a re-render; a double tap in one frame sends once.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef<{ id: string; itemId: string } | null>(null);
  const titleRef = useRef<RNText>(null);
  // Opened before your cosmetics were read (as in the coin shop): read them; a failed read says so with Try again
  // rather than spinning on (T10-FIX M3).
  const [loadFailed, setLoadFailed] = useState(false);
  const readPieces = () => {
    setLoadFailed(false);
    void loadCosmetics().then((c) => { if (mounted.current && !c) setLoadFailed(true); });
  };
  useEffect(() => {
    mounted.current = true;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
    if (!getCosmetics()) readPieces();
    return () => {
      mounted.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const spares = cosmetics ? spareTiles(cosmetics.counts, cosmetics.layout) : [];
  // A picked piece that is no longer a spare (placed or sent elsewhere) is let go, and stays unpicked if it comes
  // back (T10-FIX M5).
  const spareKey = spares.map((s) => s.itemId).join(',');
  useEffect(() => {
    if (item && !spareKey.split(',').includes(item)) setItem(null);
  }, [item, spareKey]);
  const picked = item && spareKey.split(',').includes(item) ? item : null;

  async function send() {
    // The piece picked as the spares are now.
    const item = picked;
    if (!item || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    // Another piece is another gift: it never takes the id of one whose answer was lost.
    if (requestId.current?.itemId !== item) requestId.current = { id: newRequestId(), itemId: item };
    const say = (text: string, spoken = text) => {
      setNotice({ text, spoken });
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
    };
    // The account this send belongs to: an answer after a sign-out touches nothing (T10-FIX M2).
    const at = cosmeticsSession();
    try {
      const { counts } = await sendGift(buddyId, requestId.current.id, item, note);
      requestId.current = null;
      applyCounts(counts, at);
      if (!mounted.current) return;
      setItem(null);
      say(G.sent(itemName(item), name), G.sent(spokenName(item), name));
    } catch (e) {
      if (isServerAnswer(e)) requestId.current = null;
      if (!mounted.current) return;
      say(e instanceof ApiError ? roomErrorMessage(e.code ?? null) : G.failed);
    } finally {
      inFlight.current = false;
      // Whatever the answer, the counts are read again, so a stale spare never stays offered (same account only).
      if (at === cosmeticsSession()) void loadCosmetics();
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-2 pt-1">
        <Text ref={titleRef} testID="gift-title" accessibilityRole="header" className="shrink text-heading">{G.title(name)}</Text>
        <Button testID="gift-close" variant="ghost" className="h-[44px]" onPress={() => navigation.goBack()}>{G.close}</Button>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}>
        <Text accessibilityRole="header" className="text-caption text-muted-foreground">{G.spares}</Text>
        {!cosmetics ? (
          loadFailed ? (
            <View testID="gift-load-failed" className="gap-3 rounded-lg border border-border bg-card p-4">
              <Text className="text-body">{G.loadFailed}</Text>
              <Button testID="gift-load-retry" variant="secondary" className="h-[44px] self-start" onPress={readPieces}>{G.retry}</Button>
            </View>
          ) : (
            <ActivityIndicator testID="gift-loading" />
          )
        ) : spares.length ? (
          <View className="flex-row flex-wrap gap-2">
            {spares.map((s) => (
              <Button
                key={s.itemId}
                testID={`gift-spare-${s.itemId}`}
                variant={picked === s.itemId ? 'default' : 'outline'}
                className="h-auto min-h-[64px] w-[72px] flex-col gap-1 rounded-lg p-1"
                accessibilityLabel={G.spareSpoken(spokenName(s.itemId), s.spare)}
                accessibilityState={{ selected: picked === s.itemId }}
                disabled={busy}
                onPress={() => setItem(s.itemId)}
              >
                <ItemIcon id={s.itemId} colour={me.colour} size={36} />
                <Text className="text-fine tabular-nums">{G.spare(s.spare)}</Text>
              </Button>
            ))}
          </View>
        ) : (
          <Text testID="gift-none" className="text-body text-muted-foreground">{G.none}</Text>
        )}
        <Text accessibilityRole="header" className="text-caption text-muted-foreground">{G.noteLabel}</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {GIFT_NOTES.map((n) => (
            <Button
              key={n}
              testID={`gift-note-${n}`}
              variant={note === n ? 'default' : 'outline'}
              className="h-[44px]"
              accessibilityRole="radio"
              accessibilityState={{ checked: note === n }}
              disabled={busy}
              onPress={() => setNote(n)}
            >
              {G.notes[n]}
            </Button>
          ))}
        </View>
        <Button testID="gift-send" className="h-[44px]" disabled={!picked || busy} onPress={() => void send()}>{G.send}</Button>
        <Text testID="gift-notice" accessibilityLiveRegion="polite" accessibilityLabel={notice?.spoken} className="text-caption text-muted-foreground">
          {notice?.text ?? ''}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
