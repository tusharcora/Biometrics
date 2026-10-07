// Stories row (spec 2026-10-07 social §4, item 2): my check-in first (dashed ring + teal "+" until I check in),
// then buddies with a story today in the server's order — unseen first, then newest (plan ruling) — (teal ring =
// unseen, grey = seen, lock = I haven't checked in), then "See all" → All buddies.

import React from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Person } from '../../api/buddies';
import type { CheckIn, StoryRing } from '../../api/social';
import { Character } from '../characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../characters/types';
import { CHECKIN_OPTIONS, personName } from '../../lib/socialCopy';
import { PressableScale } from '../ui/pressable-scale';
import { Text } from '../ui/text';

const TEAL = '#2DD4BF';
const SEEN = '#3A3F4A';
const NOT_CHECKED_IN = '#4338CA';

function Avatar({ person, ring, dashed }: { person: Person; ring: string; dashed?: boolean }) {
  return (
    <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: ring, borderStyle: dashed ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center' }}>
      <Character characterId={isCharacterId(person.coachId) ? person.coachId : DEFAULT_CHARACTER_ID} mood="idle" size={34} paused />
    </View>
  );
}

export function StoriesRow({ me, rings, onCheckIn, onOpenStory, onSeeAll }: {
  me: { person: Person; checkIn: CheckIn | null };
  rings: StoryRing[];
  onCheckIn: () => void;
  onOpenStory: (authorId: string) => void;
  onSeeAll: () => void;
}) {
  const myColor = (me.checkIn && CHECKIN_OPTIONS.find((o) => o.mood === me.checkIn!.mood)?.color) || NOT_CHECKED_IN;
  return (
    <ScrollView testID="stories-row" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      <PressableScale testID="story-me" accessibilityRole="button" accessibilityLabel={me.checkIn ? 'Your story' : 'Check in'}
        onPress={() => (me.checkIn ? onOpenStory(me.person.id) : onCheckIn())} className="items-center gap-1">
        <View>
          <Avatar person={me.person} ring={myColor} dashed={!me.checkIn} />
          {me.checkIn ? null : (
            <View testID="story-me-plus" style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={14} color="#0B0F14" />
            </View>
          )}
        </View>
        <Text className="text-xs text-muted-foreground">{me.checkIn ? 'You' : 'Check in'}</Text>
      </PressableScale>
      {rings.map((r) => {
        const name = personName(r.author, false);
        return (
          <PressableScale key={r.author.id} testID={`story-${r.author.id}`} accessibilityRole="button"
            accessibilityLabel={`${name}'s story${r.unseen ? ', new' : ''}`}
            onPress={() => onOpenStory(r.author.id)} className="items-center gap-1">
            <View>
              <Avatar person={r.author} ring={r.unseen ? TEAL : SEEN} />
              {r.locked ? (
                <View testID={`story-${r.author.id}-lock`} className="absolute bottom-0 right-0 h-5 w-5 items-center justify-center rounded-full bg-muted">
                  <Ionicons name="lock-closed" size={11} color="#9B9DA6" />
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>{name}</Text>
          </PressableScale>
        );
      })}
      <PressableScale testID="stories-see-all" accessibilityRole="button" onPress={onSeeAll} className="items-center justify-center px-2">
        <Text className="text-sm font-semibold text-accent">See all</Text>
      </PressableScale>
    </ScrollView>
  );
}
