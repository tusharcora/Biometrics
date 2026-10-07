import React from 'react';
import { Pressable, View } from 'react-native';
import type { BuddyRow } from '../../api/buddies';
import { MOOD_COLORS } from '../../lib/buddyCopy';
import { Character } from '../characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../characters/types';
import { Text } from '../ui/text';

export function BuddyListRow({ row, onPress }: { row: BuddyRow; onPress: () => void }) {
  return (
    <Pressable
      testID={`buddy-row-${row.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.displayName}, ${row.moodLine}${row.unseenSticker ? ', new sticker' : ''}`}
      className="flex-row items-center gap-3 py-2 active:opacity-70"
    >
      <Character characterId={isCharacterId(row.coachId) ? row.coachId : DEFAULT_CHARACTER_ID} mood={row.mood === 'low' ? 'resting' : 'idle'} size={48} paused />
      <View className="flex-1">
        <Text className="font-semibold">{row.displayName}</Text>
        <Text testID={`buddy-row-${row.id}-mood`} className="text-sm" style={{ color: MOOD_COLORS[row.mood] }}>{row.moodLine}</Text>
      </View>
      {row.unseenSticker ? <View testID={`buddy-row-${row.id}-unseen`} className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
    </Pressable>
  );
}
