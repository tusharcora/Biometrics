import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { loadCoins, loadMoreCoins, useCoins } from '../lib/coins/coinsStore';
import { historyRows, todayShare } from '../lib/coins/history';
import { ROOM_COPY } from '../lib/room/roomCopy';

const C = ROOM_COPY.coins;

// Coin history (spec 2026-10-15 §6.7, F6's sheet): the native modal sheet (ruling 8). Today against the cap with its
// bar, the rows newest first with Load more, How to earn, and the way to the shop (not when it was opened from there).
// Opening it reads the server, which also catches up on earns. It never marks coins seen: only KIP's bubble does
// (ruling PF-F13), so an earn read here still lands on the KIP page.
export function CoinHistoryScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { from?: 'shop' };
  const stored = useCoins();
  // A balance from a purchase or a grow alone has blank days and rows: it waits for a read like no coins at all.
  const coins = stored?.fromServer ? stored : null;
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState<'idle' | 'busy' | 'failed'>('idle');
  const load = useCallback(() => {
    setFailed(false);
    void loadCoins().then((c) => setFailed(!c?.fromServer));
  }, []);
  useEffect(() => { load(); }, [load]);
  const loadMore = useCallback(() => {
    setMore('busy');
    void loadMoreCoins().then((ok) => setMore(ok ? 'idle' : 'failed'));
  }, []);
  const rows = coins ? historyRows(coins.events, new Date()) : [];
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <PageTitle>{C.historyTitle}</PageTitle>
        <Button testID="history-close" variant="ghost" className="h-[44px]" onPress={() => navigation.goBack()}>{C.close}</Button>
      </View>
      {!coins ? (
        failed ? (
          <View testID="history-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{C.loadFailed}</Text>
            <Button testID="history-retry" className="h-[44px]" onPress={load}>{C.retry}</Button>
          </View>
        ) : (
          <Skeleton testID="history-loading" className="m-4 h-40 rounded-lg" />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          <Card testID="history-today" className="gap-2 p-3">
            <Text accessibilityLabel={C.earnedTodaySpoken(coins.today.earned, coins.today.cap)} className="text-body tabular-nums">
              {C.earnedToday(coins.today.earned, coins.today.cap)}
            </Text>
            <View className="h-2 overflow-hidden rounded-lg bg-muted">
              <View testID="history-today-bar" className="h-2 rounded-lg bg-primary" style={{ width: `${Math.round(todayShare(coins.today) * 100)}%` }} />
            </View>
            <Text className="text-caption text-muted-foreground">{C.capLine}</Text>
          </Card>
          {rows.length ? (
            <View testID="history-rows">
              {rows.map((r) => (
                <View key={r.key} testID="history-row" accessible accessibilityLabel={r.spoken} className="flex-row items-center justify-between gap-3 border-b border-border py-2">
                  <View className="shrink gap-0.5">
                    <Text className="text-body">{r.label}</Text>
                    <Text className="text-caption text-muted-foreground">{r.when}</Text>
                  </View>
                  <Text className="text-body font-medium tabular-nums">{r.amount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text testID="history-empty" className="text-caption text-muted-foreground">{C.empty}</Text>
          )}
          {coins.next ? (
            <View className="gap-2">
              {more === 'failed' ? (
                <Text testID="history-more-failed" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{C.loadMoreFailed}</Text>
              ) : null}
              <Button testID="history-more" variant="outline" className="h-[44px]" disabled={more === 'busy'} loading={more === 'busy'} onPress={loadMore}>
                {C.loadMore}
              </Button>
            </View>
          ) : null}
          <View testID="history-how" className="gap-1">
            <SectionLabel>{C.howTitle}</SectionLabel>
            {C.how.map((line) => <Text key={line} className="text-caption">{line}</Text>)}
          </View>
          {params.from === 'shop' ? null : <Button testID="history-shop" className="h-[44px]" onPress={() => navigation.navigate('CoinShop')}>{C.shop}</Button>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
