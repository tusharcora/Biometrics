import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { ApiError } from '../api/client';
import { WalletChip } from '../components/coins/WalletChip';
import { record, useDisposed } from '../components/room/pictures';
import { RoomView } from '../components/room/RoomView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { refreshAchievements, useAchievements } from '../lib/achievementsStore';
import { growRoom, isServerAnswer, newRequestId } from '../lib/coins/actions';
import { getCoins, loadCoins, loadFirstWeek, useCoins, type Coins } from '../lib/coins/coinsStore';
import { familiesOf, gateOf, needsLine, sizeRows, type FamilyStanding, type GateLine } from '../lib/coins/sizes';
import { useMyKip } from '../lib/kip/myKip';
import { getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { nextRowsRects } from '../lib/room/edit/overlay';
import { TIERS, toTier, type Tier } from '../lib/room/iso/geometry';
import { isoGrid } from '../lib/room/iso/grid';
import { ROOM_COPY, coinCount } from '../lib/room/roomCopy';

const Z = ROOM_COPY.sizes;
const TARGET = 'h-[44px]';

/**
 * A 409 gate's own counts (ruling T11-ERR): its coins stand in while the wallet it was refused against is still the
 * one shown (the re-read didn't land), and its badgeNeeded while the badges are unread (ruling T13-FIX M2).
 */
interface Short { tier: Tier; coinsNeeded: number; badgeNeeded: boolean; coins: Coins | null }

function shortOf(err: unknown, tier: Tier, coins: Coins | null): Short | null {
  const body = err instanceof ApiError ? (err.body as { coinsNeeded?: unknown; badgeNeeded?: unknown } | undefined) : undefined;
  if (typeof body?.coinsNeeded !== 'number' || typeof body.badgeNeeded !== 'boolean') return null;
  return { tier, coinsNeeded: body.coinsNeeded, badgeNeeded: body.badgeNeeded, coins };
}

/** What Grow still needs: the wallet and the badges, or a refusal's own counts where those are not known. */
function blockerOf(tier: Tier, coins: Coins | null, families: readonly FamilyStanding[] | null, short: Short | null): string | null {
  if (!coins || tier >= 3) return null;
  const g = gateOf((tier + 1) as 2 | 3);
  const s = short && short.tier === tier ? short : null;
  const coinsShort = s && s.coins === coins ? s.coinsNeeded : Math.max(0, g.price - coins.balance);
  const level = families?.find((f) => f.family === g.family)?.level ?? 0;
  return needsLine(tier, coinsShort, families ? level < g.level : !!s?.badgeNeeded, families);
}

function Gate({ testID, gate }: { testID: string; gate: GateLine }) {
  return (
    <View testID={testID} accessible accessibilityLabel={Z.gateSpoken(gate.title, gate.progress)} className="flex-row items-center justify-between gap-2">
      <Text className="shrink text-caption">{gate.title}</Text>
      <Text className={gate.met ? 'text-caption tabular-nums text-primary' : 'text-caption tabular-nums text-muted-foreground'}>{gate.progress}</Text>
    </View>
  );
}

// Room sizes (spec 2026-10-15 §7, C2, F5), full screen (ruling 8). Your room drawn whole at the next size with the new
// rows dashed (ruling 15), each size and both its gates, and Grow, which spends once: a dropped connection keeps the
// request id, any server answer drops it (ruling 30). A refused gate or a stale size reads everything again and says
// so; anything else is a plain retry (ruling T11-ERR). Grown, the room redraws at the new size with KIP cheering
// "MORE ROOM!" (still under Reduce Motion), the NEW tags (ruling 16) and the card, which takes a screen reader's focus
// while the list behind it is hidden; Place things goes back to the editor that opened it, or opens one.
export function RoomSizesScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { from?: 'editor' };
  const me = useMyKip();
  const reduceMotion = useReducedMotion();
  const cosmetics = useCosmetics();
  const coins = useCoins();
  const badges = useAchievements();
  const families = familiesOf(badges);
  const [failed, setFailed] = useState(false);
  const [grown, setGrown] = useState<{ tier: Tier; stored: number } | null>(null);
  const [growing, setGrowing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [short, setShort] = useState<Short | null>(null);
  const attempt = useRef<{ tier: 2 | 3; requestId: string } | null>(null);
  const busy = useRef(false);

  // The unlock card takes a screen reader's focus once it is drawn (CoinShop's pattern, ruling T11-FIX).
  const titleRef = useRef<RNText>(null);
  const focusTitle = useRef(false);
  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  });

  const load = useCallback(() => {
    setFailed(false);
    void refreshAchievements();
    void Promise.all([loadCoins(), getCosmetics() ?? loadCosmetics()]).then(([c, r]) => setFailed(!c || !r));
  }, []);
  useEffect(() => { load(); }, [load]);

  // While a grow waits on the server nothing leaves (ruling T13-FIX M7): Close is disabled, and Android's back button
  // (or any other way out) is held here.
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void }) => {
    if (busy.current) e.preventDefault();
  }), [navigation]);

  // The notice is a polite live region on Android; iOS has none, so it is announced there (EditNotices' pattern).
  const say = (text: string) => {
    setNotice(text);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  };

  const tier = cosmetics?.tier ?? 1;
  const nextTier = tier < 3 ? ((tier + 1) as 2 | 3) : null;
  const walletKnown = coins !== null;
  // Until the badges are read Grow waits too; once read (or failed) the server judges the badge.
  const ready = walletKnown && badges.state.status !== 'idle';
  const blocker = blockerOf(tier, coins, families, short);
  const shown: Tier = grown ? grown.tier : nextTier ?? tier;
  const g = isoGrid(shown);
  const dashed = !grown && nextTier !== null;
  const overlay = useDisposed(useMemo(() => record([dashed ? nextRowsRects(g, TIERS[tier].n) : []], 1), [dashed, shown, tier])); // eslint-disable-line react-hooks/exhaustive-deps

  // The unlock moment. A read dropped by the grow is replaced at once (ruling T11T12-RELOAD): the room and the
  // first-week list. A grown room in the store is never replaced by an older answer.
  const landed = (to: Tier, stored: number) => {
    attempt.current = null;
    focusTitle.current = true;
    setGrown({ tier: to, stored });
    void loadCosmetics();
    void loadFirstWeek();
  };

  const grow = async () => {
    if (!nextTier || busy.current) return;
    busy.current = true;
    if (attempt.current?.tier !== nextTier) attempt.current = { tier: nextTier, requestId: newRequestId() };
    const { requestId } = attempt.current;
    setGrowing(true);
    setNotice(null);
    setShort(null);
    try {
      let res: Awaited<ReturnType<typeof growRoom>>;
      try {
        res = await growRoom(nextTier, requestId);
      } catch (err) {
        if (isServerAnswer(err)) throw err;
        // No answer: the grow may have landed. Send it once more with the same id (ruling T13-FIX I1): a grow that
        // landed answers again as a replay, so the unlock moment still comes; one that didn't is made now.
        res = await growRoom(nextTier, requestId);
      }
      landed(toTier(res.tier), res.stored);
    } catch (err) {
      const code = err instanceof ApiError && err.status === 409 ? err.code : undefined;
      if (isServerAnswer(err)) {
        // The server answered: nothing grew, and a new tap is a new request (ruling 30).
        attempt.current = null;
      } else {
        // Still no answer: the room read again says whether it grew. If it did, that is the unlock moment (what the
        // window stored isn't known, so no line about it); if not, the id is kept, so a retry can't spend twice. The
        // read is fresh: one that started before the grow can't answer it (ruling T14-CARRY).
        const [room] = await Promise.all([loadCosmetics({ fresh: true }), loadCoins()]);
        if (room && room.tier >= nextTier) {
          landed(nextTier, 0);
          return;
        }
      }
      if (code === 'gate' || code === 'stale_tier') {
        // Not yet, or another device grew it: read the wallet, the room and the badges again, so the rows and the
        // line under Grow say what is needed now. A gate's own counts stand in for what can't be read (Short).
        const before = getCoins();
        const [after] = await Promise.all([loadCoins(), loadCosmetics(), refreshAchievements()]);
        if (code === 'gate') setShort(shortOf(err, tier, after === before ? after : null));
        say(Z.notYet);
      } else {
        // A bad body, an unreadable stored room (500) or no connection: a plain retry (ruling T11-ERR).
        say(Z.failed);
      }
    } finally {
      busy.current = false;
      setGrowing(false);
    }
  };

  const placeThings = () => (params.from === 'editor' ? navigation.goBack() : navigation.replace('DecorateRoom'));
  const gate = grown && grown.tier !== 1 ? gateOf(grown.tier as 2 | 3) : null;
  const added = grown && grown.tier !== 1 ? TIERS[grown.tier].cap - TIERS[(grown.tier - 1) as Tier].cap : 0;
  // While the unlock card shows, the list behind it is hidden from a screen reader: accessibilityElementsHidden is
  // iOS's way, importantForAccessibility Android's.
  const behind = grown ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const } : {};
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
        <Button testID="sizes-close" variant="ghost" className={TARGET} disabled={growing} onPress={() => navigation.goBack()}>{Z.close}</Button>
        <PageTitle className="shrink text-center">{Z.title}</PageTitle>
        <WalletChip testID="sizes-wallet" />
      </View>
      {/* No room yet, or a wallet that couldn't be read over a room already loaded (ruling T13-FIX M1). */}
      {!cosmetics || (failed && !coins) ? (
        failed ? (
          <View testID="sizes-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{Z.loadFailed}</Text>
            <Button testID="sizes-retry" className={TARGET} onPress={load}>{Z.retry}</Button>
          </View>
        ) : (
          <Skeleton testID="sizes-loading" className="m-4 h-72 rounded-lg" />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          <View
            testID="sizes-preview"
            accessible
            accessibilityRole="image"
            accessibilityLabel={dashed ? Z.previewLabel(g.n) : Z.grownLabel(g.n)}
            style={{ width: g.W, height: g.H, alignSelf: 'center', overflow: 'hidden' }}
          >
            <RoomView
              testID="sizes-room"
              layout={cosmetics.layout}
              tier={shown}
              living={cosmetics.living}
              worn={me.worn}
              weather="clear"
              night={false}
              colour={me.colour}
              pose={grown ? 'cheer' : 'rest'}
              mood={grown ? 'proud' : 'idle'}
              screen="lines"
              bubble={grown ? Z.moreRoom : null}
              crop={{ width: g.W, height: g.H }}
              cellPt={1}
              offset={{ x: 0, y: 0 }}
              reduceMotion={reduceMotion}
              accessible={false}
            />
            <Canvas pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: g.W, height: g.H }}>
              <Picture picture={overlay} />
            </Canvas>
          </View>
          {grown && gate ? (
            <Card testID="sizes-grown" className="gap-2 p-3">
              <View className="flex-row flex-wrap gap-2">
                {[Z.newFloor, Z.newWall].map((tag) => (
                  <Text key={tag} className="rounded-lg border border-primary px-1 font-pixel text-label text-primary">{tag}</Text>
                ))}
              </View>
              <Text ref={titleRef} testID="sizes-grown-title" accessibilityRole="header" className="text-heading">{Z.grewTitle}</Text>
              <Text className="text-body">{Z.grewWhy(grown.tier as 2 | 3, coinCount(gate.price), grown.tier === 2 ? gate.threshold : gate.level)}</Text>
              <Text testID="sizes-grown-more" accessibilityLabel={Z.grewMoreSpoken(added, grown.tier === 3)} className="text-caption text-muted-foreground">
                {Z.grewMore(added, grown.tier === 3)}
              </Text>
              {grown.stored ? <Text testID="sizes-stored" className="text-caption">{Z.stored(grown.stored)}</Text> : null}
              <View className="flex-row gap-2">
                <Button testID="sizes-place" className={`${TARGET} flex-1`} onPress={placeThings}>{Z.place}</Button>
                <Button testID="sizes-later" variant="outline" className={`${TARGET} flex-1`} onPress={() => navigation.goBack()}>{Z.later}</Button>
              </View>
            </Card>
          ) : null}
          <View testID="sizes-list" className="gap-3" {...behind}>
            <Text className="text-caption text-muted-foreground">{Z.sub}</Text>
            {sizeRows(tier, coins?.balance ?? 0, families).map((row) => (
              <Card key={row.tier} testID={`sizes-row-${row.tier}`} className="gap-1 p-3">
                <Text testID={`sizes-row-name-${row.tier}`} accessibilityLabel={Z.rowSpoken(row.name, row.sizeSpoken)} className="text-body font-semibold">{Z.row(row.name, row.size)}</Text>
                <Text testID={`sizes-row-pieces-${row.tier}`} accessibilityLabel={row.piecesSpoken} className="text-caption text-muted-foreground">{row.pieces}</Text>
                {row.status === 'yours' ? (
                  <Text className="font-pixel text-label text-primary">{Z.yours}</Text>
                ) : walletKnown ? (
                  <>
                    <Gate testID={`sizes-coins-${row.tier}`} gate={row.coins!} />
                    <Gate testID={`sizes-badge-${row.tier}`} gate={row.badge!} />
                  </>
                ) : (
                  // Until the wallet is read the gates never guess a balance ("0 of 600").
                  <Skeleton testID={`sizes-gates-loading-${row.tier}`} className="h-10 rounded-lg" />
                )}
              </Card>
            ))}
            {/* The notice sits with Grow, where the tap was, so a small phone shows it without scrolling (T13-FIX M5). */}
            {!grown && (nextTier || notice) ? (
              <View testID="sizes-grow-area" className="gap-2">
                {nextTier ? (
                  <Button testID="sizes-grow" className={TARGET} accessibilityLabel={Z.growSpoken(TIERS[nextTier].n)} disabled={!ready || !!blocker} loading={growing || !ready}
                    onPress={() => void grow()}>
                    {Z.grow(TIERS[nextTier].n)}
                  </Button>
                ) : null}
                {notice ? <Text testID="sizes-notice" accessibilityLiveRegion="polite" className="text-caption">{notice}</Text> : null}
                {nextTier && ready && blocker ? <Text testID="sizes-blocker" className="text-caption">{blocker}</Text> : null}
                {nextTier ? <Text className="text-caption text-muted-foreground">{Z.both}</Text> : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
