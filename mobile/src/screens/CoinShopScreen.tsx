import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { fetchShop, type ShopDTO } from '../api/coins';
import { CoinGlyph } from '../components/coins/CoinGlyph';
import { WalletChip } from '../components/coins/WalletChip';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { buyPiece, isServerAnswer, newRequestId } from '../lib/coins/actions';
import { getCoins, loadCoins, loadFirstWeek, useCoins, type Coins } from '../lib/coins/coinsStore';
import { SHOP_TABS, pieceSheet, shopTiles, type ShopTab } from '../lib/coins/shop';
import { useMyKip } from '../lib/kip/myKip';
import { getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { ROOM_COPY, coinCount, itemName, spokenName } from '../lib/room/roomCopy';

const S = ROOM_COPY.shop;
const TARGET = 'h-[44px]';

/** Where a screen reader's focus goes after the next render (ruling T11-FIX). */
type FocusTarget = 'name' | 'notice' | { tile: string };

/** The `needed` of a 409 not_enough_coins body, when it has one. */
function neededOf(err: unknown): number | null {
  const body = err instanceof ApiError ? (err.body as { needed?: unknown } | undefined) : undefined;
  return typeof body?.needed === 'number' && body.needed > 0 ? body.needed : null;
}

// The coin shop (spec 2026-10-15 §6.6, C1, F6), full screen (ruling 8). The week's featured set, the tabs, the tiles
// (a rule piece not earned yet is locked with its rule), and the piece sheet, a panel at the bottom: where it goes, what
// you have and have after, Not now and Get for n. Never optimistic: Get stays loading until the server answers, then
// the piece is in the inventory with NEW. A dropped connection keeps the attempt's request id, so a retry can't buy
// twice; any server answer drops it (ruling 30). The sheet is modal to a screen reader on both platforms, takes its
// focus when it opens and hands it back to the tile (or to the notice after a purchase) when it closes (T11-FIX).
export function CoinShopScreen() {
  const navigation = useNavigation<any>();
  const me = useMyKip();
  const cosmetics = useCosmetics();
  const coins = useCoins();
  const [shop, setShop] = useState<ShopDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<ShopTab>('all');
  const [setOnly, setSetOnly] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  // What the last tap came to, on screen and read aloud (a piece's name may hold a "·").
  const [notice, setNotice] = useState<{ text: string; spoken: string } | null>(null);
  // A 409's `needed` when the wallet re-read after it didn't land: the sheet still says what is missing.
  const [short, setShort] = useState<{ itemId: string; needed: number; coins: Coins | null } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const attempt = useRef<{ itemId: string; requestId: string } | null>(null);
  const busy = useRef(false);

  const nameRef = useRef<RNText>(null);
  const noticeRef = useRef<RNText>(null);
  const tileRefs = useRef(new Map<string, View>());
  const focusNext = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const el = target === 'name' ? nameRef.current : target === 'notice' ? noticeRef.current : tileRefs.current.get(target.tile);
    const node = el ? findNodeHandle(el) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  });

  const load = useCallback(() => {
    setFailed(false);
    void loadCoins();
    if (!getCosmetics()) void loadCosmetics();
    fetchShop().then(setShop, () => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  // While a purchase waits on the server nothing leaves (ruling T13-FIX M7): Close is disabled, and Android's back
  // button (or any other way out) is held here.
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void }) => {
    if (busy.current) e.preventDefault();
  }), [navigation]);

  // The notice is a polite live region on Android; iOS has none, so it is announced there (EditNotices' pattern).
  const say = (text: string, spoken = text) => {
    setNotice({ text, spoken });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  };
  const open = (itemId: string) => {
    setPicked(itemId);
    setNotice(null);
    focusNext.current = 'name';
  };
  const close = () => {
    if (picked) focusNext.current = { tile: picked };
    setPicked(null);
  };
  const buy = async (itemId: string) => {
    if (busy.current) return;
    busy.current = true;
    if (attempt.current?.itemId !== itemId) attempt.current = { itemId, requestId: newRequestId() };
    setBuying(true);
    setNotice(null);
    setShort(null);
    try {
      await buyPiece(itemId, attempt.current.requestId);
      attempt.current = null;
      setPicked(null);
      focusNext.current = 'notice';
      say(S.bought(itemName(itemId)), S.bought(spokenName(itemId)));
      // A read dropped by the purchase is replaced at once (ruling T11T12-RELOAD): the room and the first-week list.
      void loadCosmetics();
      void loadFirstWeek();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (isServerAnswer(err)) {
        // The server answered: nothing was bought, and a new tap is a new purchase.
        attempt.current = null;
      } else {
        // No answer: the purchase may have landed. Read both again, so a piece that was bought shows as owned with
        // the right balance (the id is kept, so a retry can't buy it twice).
        void loadCoins();
        void loadCosmetics();
      }
      if (code === 'not_enough_coins') {
        const before = getCoins();
        const after = await loadCoins();
        const needed = neededOf(err);
        // The re-read didn't land: the server's own count of what is missing stands in for the wallet.
        if (after === before && needed !== null) setShort({ itemId, needed, coins: after });
        say(S.short);
      } else if (code === 'not_for_sale') {
        say(S.notForSale);
      } else {
        // A 500, a bad body or no connection at all (ruling T11-ERR): a plain retry, never "not in the shop".
        say(S.failed);
      }
    } finally {
      busy.current = false;
      setBuying(false);
    }
  };

  const counts = cosmetics?.counts ?? {};
  const offer = picked && shop ? shop.items.find((i) => i.itemId === picked) : undefined;
  // The balance the sheet works from: the wallet, or a 409's own count while the wallet couldn't be read again.
  const balance = offer && short && short.itemId === offer.itemId && short.coins === coins ? offer.price - short.needed : coins?.balance ?? null;
  const sheet = offer ? pieceSheet(offer.itemId, offer.price, balance ?? 0, counts) : null;
  const walletKnown = balance !== null;
  const setName = shop ? S.sets[shop.set.id] ?? S.setUnknown : '';
  // While the sheet is open the screen behind it is hidden from a screen reader: accessibilityViewIsModal is iOS's
  // way, importantForAccessibility Android's.
  const behind = sheet ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const } : {};
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View testID="shop-behind" className="flex-1" {...behind}>
        <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
          <Button testID="shop-close" variant="ghost" className={TARGET} disabled={buying} onPress={() => navigation.goBack()}>{S.close}</Button>
          <PageTitle className="shrink text-center">{S.title}</PageTitle>
          <WalletChip testID="shop-wallet" from="shop" />
        </View>
        <Text className="px-4 pb-2 text-caption text-muted-foreground">{S.sub}</Text>
        {notice && !sheet ? (
          <Text ref={noticeRef} testID="shop-notice" accessibilityLiveRegion="polite" accessibilityLabel={notice.spoken} className="px-4 pb-2 text-caption">{notice.text}</Text>
        ) : null}
        {!shop ? (
          failed ? (
            <View testID="shop-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
              <Text className="text-body">{S.loadFailed}</Text>
              <Button testID="shop-retry" className={TARGET} onPress={load}>{S.retry}</Button>
            </View>
          ) : (
            <Skeleton testID="shop-loading" className="m-4 h-72 rounded-lg" />
          )
        ) : (
          <ScrollView testID="shop-scroll" contentContainerStyle={{ paddingBottom: sheet ? sheetHeight + 16 : 32 }}>
            {shop.set.itemIds.length ? (
              <Card testID="shop-week" className="mx-4 mb-3 gap-2 p-3">
                <SectionLabel>{S.thisWeek}</SectionLabel>
                <Text accessibilityLabel={S.setSpoken(setName, shop.set.itemIds.length)} className="text-body">{S.setLine(setName, shop.set.itemIds.length)}</Text>
                <View className="flex-row">
                  <Button testID="shop-week-toggle" variant="outline" size="sm" className={TARGET} onPress={() => setSetOnly((v) => !v)}>{setOnly ? S.seeAll : S.seeSet}</Button>
                </View>
              </Card>
            ) : null}
            <View testID="shop-tabs" accessibilityRole="tablist" accessibilityLabel={S.tabsLabel} className="flex-row flex-wrap gap-2 px-4 pb-3">
              {SHOP_TABS.map((t) => (
                <Button key={t} testID={`shop-tab-${t}`} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} size="sm" className={TARGET}
                  variant={tab === t ? 'default' : 'outline'} onPress={() => setTab(t)}>
                  {S.tabs[t]}
                </Button>
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2 px-4">
              {shopTiles(shop, counts, tab, setOnly).map((t) => (
                <Button key={t.itemId} testID={`shop-tile-${t.itemId}`} variant="outline" className="h-auto min-h-[96px] w-[31%] p-2"
                  ref={(el: View | null) => { if (el) tileRefs.current.set(t.itemId, el); else tileRefs.current.delete(t.itemId); }}
                  accessibilityLabel={t.label} accessibilityState={{ selected: picked === t.itemId }} disabled={buying}
                  onPress={() => open(t.itemId)}>
                  <View className="items-center gap-1" style={{ opacity: t.locked ? 0.45 : 1 }}>
                    <ItemIcon id={t.itemId} colour={me.colour} />
                    <Text className="text-center text-fine" numberOfLines={2}>{t.name}</Text>
                    {t.effect ? <Text className="text-center text-fine text-muted-foreground" numberOfLines={2}>{ROOM_COPY.effects.doesSomething}</Text> : null}
                    {t.locked ? (
                      <Text className="text-center text-fine text-muted-foreground" numberOfLines={2}>{t.lockLine}</Text>
                    ) : (
                      <View className="flex-row items-center gap-1">
                        <CoinGlyph size={10} />
                        <Text className="text-fine tabular-nums">{coinCount(t.price)}</Text>
                      </View>
                    )}
                    {t.owned > 0 ? <Text className="text-fine text-muted-foreground">{S.owned(t.owned)}</Text> : null}
                  </View>
                </Button>
              ))}
            </View>
            <Text className="px-4 pt-4 text-fine text-muted-foreground">{S.footer}</Text>
          </ScrollView>
        )}
      </View>
      {sheet && picked ? (
        <View testID="shop-sheet" accessibilityViewIsModal onLayout={(e) => setSheetHeight(Math.ceil(e.nativeEvent.layout.height))}
          className="absolute bottom-0 left-0 right-0 gap-2 rounded-t-lg border-t border-border bg-background p-4 pb-8">
          <Text ref={nameRef} testID="shop-sheet-name" accessibilityLabel={spokenName(picked)} className="text-heading">{sheet.name}</Text>
          {sheet.where.text ? <Text accessibilityLabel={sheet.where.spoken} className="text-caption text-muted-foreground">{sheet.where.text}</Text> : null}
          {sheet.effect ? <Text testID="shop-sheet-effect" className="text-body">{sheet.effect}</Text> : null}
          {/* While the sheet is open the rest of the screen is hidden from a screen reader, so its notice is here. */}
          {notice ? <Text testID="shop-notice" accessibilityLiveRegion="polite" accessibilityLabel={notice.spoken} className="text-caption">{notice.text}</Text> : null}
          {sheet.locked ? (
            <Text testID="shop-sheet-locked" accessibilityLabel={S.lockedSpoken(sheet.lockedSpoken ?? '')} className="text-body">{S.locked(sheet.locked)}</Text>
          ) : walletKnown ? (
            <>
              <Text testID="shop-sheet-have" accessibilityLabel={sheet.haveSpoken} className="text-body tabular-nums">{sheet.have}</Text>
              <Text className="text-caption text-muted-foreground">{S.goes}</Text>
            </>
          ) : (
            // Until the wallet is read the sheet never guesses a balance ("You have 0", "Needs 150 more").
            <Skeleton testID="shop-sheet-loading" className="h-10 rounded-lg" />
          )}
          <View className="flex-row gap-2">
            <Button testID="shop-not-now" variant="outline" className={`${TARGET} flex-1`} disabled={buying} onPress={close}>{S.notNow}</Button>
            {sheet.locked ? null : (
              <Button testID="shop-get" className={`${TARGET} flex-1`} disabled={!walletKnown || !sheet.canBuy} loading={buying || !walletKnown}
                onPress={() => void buy(picked)}>
                {walletKnown ? sheet.button : S.get(coinCount(offer!.price))}
              </Button>
            )}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
