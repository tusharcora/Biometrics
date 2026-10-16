import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Switch, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { useMyRoom } from '../lib/room/cosmeticsStore';
import { pieceCard } from '../lib/room/card';
import { lowerName } from '../lib/room/edit/labels';
import { ROOM_COPY } from '../lib/room/roomCopy';
import { loadRoomSound, setRoomSound, useRoomSound } from '../lib/room/sound';
import { useClockMinute } from '../lib/room/useClockMinute';
import { COLORS } from '../theme';

const C = ROOM_COPY.card;
const TARGET = 'h-[44px]';

// The piece card (spec 2026-10-15 §8.1, F7; P3 ruling 16): a native sheet over the KIP page, opened by tapping an
// effect piece or a plant in the room, or through the room image's actions. Name, where it goes, how it was earned,
// what it does and how it is now; the radio's sound switch (read from the device as it opens, T13-CARRY); Move and
// Store open the editor with the piece selected. It takes a screen reader's focus on its name, or on the line saying the piece has gone (the CoinShop pattern),
// and the room card puts focus back on the room when it closes. The native sheet is its own screen, so what is behind
// it is already out of reach on both platforms (no importantForAccessibility needed); the KIP page under it is
// blurred, which keeps the radio silent until it closes (PF3-AUDIO).
export function PieceCardScreen() {
  const navigation = useNavigation<any>();
  const { pieceId } = (useRoute().params ?? {}) as { pieceId?: string };
  const { layout, tier, living } = useMyRoom();
  const now = useClockMinute(true);
  const card = pieceId ? pieceCard(layout, tier, living, now, pieceId) : null;
  const sound = useRoomSound();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const nameRef = useRef<RNText>(null);
  useEffect(() => {
    void loadRoomSound();
    const node = nameRef.current ? findNodeHandle(nameRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const toEditor = (store: boolean) => {
    navigation.goBack();
    navigation.navigate('DecorateRoom', store ? { select: pieceId, store: true } : { select: pieceId });
  };
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-2">
          {card ? (
            <Text ref={nameRef} testID="card-name" accessibilityRole="header" accessibilityLabel={card.nameSpoken} className="shrink text-heading">
              {card.name}
            </Text>
          ) : (
            <View />
          )}
          <Button testID="card-close" variant="ghost" className={TARGET} onPress={() => navigation.goBack()}>{C.close}</Button>
        </View>
        {card ? (
          <>
            <Text testID="card-where" accessibilityLabel={card.where.spoken} className="text-caption text-muted-foreground">{card.where.text}</Text>
            <Text testID="card-earned" accessibilityLabel={card.earned.spoken} className="text-caption text-muted-foreground">{card.earned.text}</Text>
            {card.effect ? (
              <View className="gap-1">
                <Text className="font-pixel text-label text-muted-foreground">{C.effectTitle}</Text>
                <Text testID="card-effect" className="text-body">{card.effect}</Text>
              </View>
            ) : null}
            {card.state ? <Text testID="card-state" className="text-body">{card.state}</Text> : null}
            {card.resting ? <Text testID="card-resting" className="text-caption text-muted-foreground">{card.resting}</Text> : null}
            {card.sound ? (
              <>
                <View className="min-h-[44px] flex-row items-center justify-between gap-3">
                  <Text className="shrink text-body">{C.sound}</Text>
                  <Switch testID="card-sound" accessibilityLabel={C.sound} value={sound} onValueChange={(v) => void setRoomSound(v)} trackColor={{ true: colors.accent }} />
                </View>
                <Text className="text-caption text-muted-foreground">{C.soundHint}</Text>
              </>
            ) : null}
            <Text className="text-fine text-muted-foreground">{ROOM_COPY.effects.onlyForFun}</Text>
            <View className="flex-row gap-2">
              <Button testID="card-move" variant="outline" className={`${TARGET} flex-1`} accessibilityLabel={C.moveLabel(lowerName(card.nameSpoken))} onPress={() => toEditor(false)}>{C.move}</Button>
              <Button testID="card-store" variant="outline" className={`${TARGET} flex-1`} accessibilityLabel={C.storeLabel(lowerName(card.nameSpoken))} onPress={() => toEditor(true)}>{C.store}</Button>
            </View>
          </>
        ) : (
          <Text ref={nameRef} testID="card-gone" className="text-body">{C.gone}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
