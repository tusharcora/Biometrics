import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { CoinGlyph } from './CoinGlyph';
import { useCoins } from '../../lib/coins/coinsStore';
import { ROOM_COPY, coinCount } from '../../lib/room/roomCopy';

// The header has no room to grow with the text (TodayBar caps its numbers the same way).
const MAX_FONT_SCALE = 1.3;

// The wallet (spec 2026-10-15 §6.7): the coin and the balance, tabular, in the KIP page's header, the editor's and the
// shop's. A shadcn Button (ruling 9), at least 44 points tall, that opens the coin history (ruling 38). Nothing until the first
// read lands. It only reads the store: marking coins seen is KIP's bubble's job (ruling PF-F13).
export function WalletChip({ testID = 'wallet', from }: { testID?: string; from?: 'shop' }) {
  const coins = useCoins();
  const navigation = useNavigation<any>();
  if (!coins) return null;
  const n = coinCount(coins.balance);
  return (
    <Button
      testID={testID}
      variant="outline"
      size="sm"
      className="h-auto min-h-[44px] px-3 py-1"
      accessibilityLabel={ROOM_COPY.coins.walletLabel(n)}
      onPress={() => navigation.navigate('CoinHistory', from ? { from } : undefined)}
    >
      <View className="flex-row items-center gap-1.5">
        <CoinGlyph />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} className="text-caption font-medium tabular-nums">{n}</Text>
      </View>
    </Button>
  );
}
