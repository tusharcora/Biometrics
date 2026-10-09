import React from 'react';
import { Pressable, View } from 'react-native';
import { MOOD_COLORS } from '../../lib/buddyCopy';
import { useBuddies } from '../../lib/buddiesStore';
import { useRefreshBuddiesOnFocus } from '../../lib/useRefreshBuddiesOnFocus';
import { Character } from '../characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../characters/types';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';

const SHOWN = 5;

// Home's Buddies row (spec 2026-10-06 buddies §7): hidden until there is a buddy or a pending
// request; up to five coach sprites with mood dots, and "See all".
export function BuddiesRow({ onOpen }: { onOpen: () => void }) {
  const state = useBuddies();
  useRefreshBuddiesOnFocus();
  if (state.status !== 'ready') return null;
  const { buddies, incomingRequests, outgoingRequests } = state.page;
  if (buddies.length === 0 && incomingRequests + outgoingRequests === 0) return null;
  return (
    <Pressable testID="home-buddies-row" onPress={onOpen} accessibilityRole="button" accessibilityLabel="Buddies, see all" className="active:opacity-80">
      <Card className="gap-3 p-4">
        <View className="flex-row items-center justify-between">
          <SectionLabel>Buddies</SectionLabel>
          <Text className="text-caption text-muted-foreground">See all</Text>
        </View>
        {buddies.length > 0 ? (
          <View className="flex-row gap-3">
            {buddies.slice(0, SHOWN).map((b) => (
              <View key={b.id} testID={`home-buddy-${b.id}`} className="items-center">
                <Character characterId={isCharacterId(b.coachId) ? b.coachId : DEFAULT_CHARACTER_ID} mood={b.mood === 'low' ? 'resting' : 'idle'} size={40} paused />
                <View testID={`home-buddy-${b.id}-dot`} className="-mt-2 h-3 w-3 rounded-full border border-background" style={{ backgroundColor: MOOD_COLORS[b.mood] }} />
              </View>
            ))}
          </View>
        ) : null}
        {incomingRequests > 0 ? (
          <Text testID="home-buddies-requests" className="text-caption text-muted-foreground">
            {incomingRequests === 1 ? '1 buddy request' : `${incomingRequests} buddy requests`}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
