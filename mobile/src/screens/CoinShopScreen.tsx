import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
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
import { loadCoins, loadFirstWeek, useCoins } from '../lib/coins/coinsStore';
import { SHOP_TABS, pieceSheet, shopTiles, type ShopTab } from '../lib/coins/shop';
import { useMyKip } from '../lib/kip/myKip';
import { getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { ROOM_COPY, coinCount, itemName, spokenName } from '../lib/room/roomCopy';

const S = ROOM_COPY.shop;
const TARGET = 'h-[44px]';

// The coin shop (spec 2026-10-15 §6.6, C1, F6), full screen (ruling 8). The week's featured set, the tabs, the tiles
// (a rule piece not earned yet is locked with its rule), and the piece sheet, a panel at the bottom: where it goes, what
// you have and have after, Not now and Get for n. Never optimistic: Get stays loading until the server answers, then
// the piece is in the inventory with NEW. A dropped connection keeps the attempt's request id, so a retry can't buy
// twice; any server answer drops it (ruling 30).
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
  const attempt = useRef<{ itemId: string; requestId: string } | null>(null);
  const busy = useRef(false);

  const load = useCallback(() => {
    setFailed(false);
    void loadCoins();
    if (!getCosmetics()) void loadCosmetics();
    fetchShop().then(setShop, () => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (text: string, spoken = text) => {
    setNotice({ text, spoken });
    AccessibilityInfo.announceForAccessibility(spoken);
  };
  const buy = async (itemId: string) => {
    if (busy.current) return;
    busy.current = true;
    if (attempt.current?.itemId !== itemId) attempt.current = { itemId, requestId: newRequestId() };
    setBuying(true);
    setNotice(null);
    try {
      await buyPiece(itemId, attempt.current.requestId);
      attempt.current = null;
      setPicked(null);
      say(S.bought(itemName(itemId)), S.bought(spokenName(itemId)));
      // A read dropped by the purchase is replaced at once (ruling T11T12-RELOAD): the room and the first-week list.
      void loadCosmetics();
      void loadFirstWeek();
    } catch (err) {
      // The server answered: nothing was bought, and a new tap is a new purchase. Anything else keeps the id.
      if (isServerAnswer(err)) attempt.current = null;
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === 'not_enough_coins') {
        await loadCoins();
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
  const sheet = offer ? pieceSheet(offer.itemId, offer.price, coins?.balance ?? 0, counts) : null;
  const setName = shop ? S.sets[shop.set.id] ?? shop.set.id : '';
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
        <Button testID="shop-close" variant="ghost" className={TARGET} disabled={buying} onPress={() => navigation.goBack()}>{S.close}</Button>
        <PageTitle className="shrink text-center">{S.title}</PageTitle>
        <WalletChip testID="shop-wallet" from="shop" />
      </View>
      <Text className="px-4 pb-2 text-caption text-muted-foreground">{S.sub}</Text>
      {notice && !sheet ? <Text testID="shop-notice" accessibilityLiveRegion="polite" accessibilityLabel={notice.spoken} className="px-4 pb-2 text-caption">{notice.text}</Text> : null}
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
        <ScrollView contentContainerStyle={{ paddingBottom: sheet ? 280 : 32 }}>
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
                accessibilityLabel={t.label} accessibilityState={{ selected: picked === t.itemId }}
                onPress={() => { setPicked(t.itemId); setNotice(null); }}>
                <View className="items-center gap-1" style={{ opacity: t.locked ? 0.45 : 1 }}>
                  <ItemIcon id={t.itemId} colour={me.colour} />
                  <Text className="text-center text-fine" numberOfLines={2}>{t.name}</Text>
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
      {sheet && picked ? (
        <View testID="shop-sheet" accessibilityViewIsModal className="absolute bottom-0 left-0 right-0 gap-2 rounded-t-lg border-t border-border bg-background p-4 pb-8">
          <Text accessibilityLabel={spokenName(picked)} className="text-heading">{sheet.name}</Text>
          {sheet.where.text ? <Text accessibilityLabel={sheet.where.spoken} className="text-caption text-muted-foreground">{sheet.where.text}</Text> : null}
          {/* While the sheet is open the rest of the screen is hidden from a screen reader, so its notice is here. */}
          {notice ? <Text testID="shop-notice" accessibilityLiveRegion="polite" accessibilityLabel={notice.spoken} className="text-caption">{notice.text}</Text> : null}
          {sheet.locked ? (
            <Text testID="shop-sheet-locked" accessibilityLabel={S.lockedSpoken(sheet.lockedSpoken ?? '')} className="text-body">{S.locked(sheet.locked)}</Text>
          ) : (
            <>
              <Text testID="shop-sheet-have" accessibilityLabel={sheet.haveSpoken} className="text-body tabular-nums">{sheet.have}</Text>
              <Text className="text-caption text-muted-foreground">{S.goes}</Text>
            </>
          )}
          <View className="flex-row gap-2">
            <Button testID="shop-not-now" variant="outline" className={`${TARGET} flex-1`} disabled={buying} onPress={() => setPicked(null)}>{S.notNow}</Button>
            {sheet.locked ? null : (
              <Button testID="shop-get" className={`${TARGET} flex-1`} disabled={!sheet.canBuy} loading={buying} onPress={() => void buy(picked)}>{sheet.button}</Button>
            )}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
