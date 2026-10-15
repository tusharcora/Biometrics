import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FirstWeekTaskKey } from '../../api/coins';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { useFirstWeek } from '../../lib/coins/coinsStore';
import { ROOM_COPY, coinCount } from '../../lib/room/roomCopy';

const F = ROOM_COPY.firstWeek;
const BONUS: ReadonlySet<FirstWeekTaskKey> = new Set<FirstWeekTaskKey>(['place', 'streak7']);

// The first-week list (spec 2026-10-15 §11.2, C7): seven days from day 1, inside the KIP page's room card, gone after
// day 7 (the server answers open: false). Each row ticks when the server says so; only the two bonus rows pay extra.
// "Cheer a buddy's room" ticks from P4 (plan ruling 24). The next size's dashed rows are on Room sizes (plan ruling 15),
// so the next line names it and a button opens it (ruling PF-F12). Each row is read as one line, in words.
export function FirstWeekCard() {
  const week = useFirstWeek();
  const navigation = useNavigation<any>();
  if (!week || !week.open) return null;
  const coins = coinCount(week.next.coins);
  return (
    <Card testID="first-week" className="gap-2 p-3">
      <SectionLabel>{F.title}</SectionLabel>
      <Text accessibilityLabel={F.headSpoken(week.day, week.done)} className="text-body">{F.head(week.day, week.done)}</Text>
      {week.tasks.map((t) => (
        <View
          key={t.key}
          testID={`first-week-${t.key}`}
          accessible
          accessibilityLabel={F.rowSpoken(F.tasks[t.key], t.done, t.reward, BONUS.has(t.key))}
          className="flex-row items-center justify-between gap-2"
        >
          <View className="shrink flex-row items-center gap-2">
            <Text className={t.done ? 'text-caption text-primary' : 'text-caption text-muted-foreground'}>{t.done ? F.done : F.notDone}</Text>
            <Text className={t.done ? 'shrink text-caption text-muted-foreground' : 'shrink text-caption'}>{F.tasks[t.key]}</Text>
          </View>
          <Text className="text-caption tabular-nums">{F.reward(t.reward, BONUS.has(t.key))}</Text>
        </View>
      ))}
      <Text accessibilityLabel={F.nextSpoken(coins, week.next.streak)} className="text-caption text-muted-foreground">
        {F.next(coins, week.next.streak)}
      </Text>
      <View className="flex-row gap-2">
        <Button testID="first-week-shop" variant="outline" className="h-[44px] flex-1" onPress={() => navigation.navigate('CoinShop')}>
          {F.shop}
        </Button>
        <Button testID="first-week-sizes" variant="outline" className="h-[44px] flex-1" onPress={() => navigation.navigate('RoomSizes')}>
          {F.sizes}
        </Button>
      </View>
    </Card>
  );
}
