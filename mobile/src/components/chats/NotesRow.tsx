import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { Person } from '../../api/buddies';
import type { BuddyNote, StatusNote } from '../../api/chats';
import { personName } from '../../lib/socialCopy';
import { Text } from '../ui/text';
import { ChatAvatar } from './ChatAvatar';

// The Chats notes row (spec §8.1; the owner-approved Inbox board): my avatar first ("Share a note" in an outlined
// bubble, or my note), then each buddy's live note in a bubble over their avatar (a teal ring while their story is
// unseen). Tapping a buddy's note opens their thread with it quoted; a long press reports it. The avatars are not
// buttons (allowlisted); the name under each sits outside the press target, whose label already says it. A note that
// expired while the inbox is open is hidden here, before the next read drops it.
function Bubble({ text, prompt }: { text: string; prompt: boolean }) {
  return (
    <View className={`min-h-[26px] max-w-[72px] justify-center rounded-xl px-2 py-1 ${prompt ? 'border border-border' : 'bg-secondary'}`}>
      <Text numberOfLines={2} className={`text-center text-[10.5px] leading-[13px] ${prompt ? 'text-muted-foreground' : 'text-foreground'}`}>{text}</Text>
    </View>
  );
}

const live = (note: { expiresAt: string }, now: number) => Date.parse(note.expiresAt) > now;

export function NotesRow({ me, mine: mineNote, buddies: buddyNotes, ringed, now = Date.now(), onMine, onOpen, onReport }: {
  me: Person;
  mine: StatusNote | null;
  buddies: BuddyNote[];
  /** Buddies with an unseen story: their avatar wears the teal ring. */
  ringed?: ReadonlySet<string>;
  /** The render's clock (ms); notes expiring at or before it are hidden. */
  now?: number;
  onMine: () => void;
  onOpen: (note: BuddyNote) => void;
  onReport: (note: BuddyNote) => void;
}) {
  const mine = mineNote && live(mineNote, now) ? mineNote : null;
  const buddies = buddyNotes.filter((n) => live(n, now));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
      <View className="w-[68px] items-center gap-1">
        <Pressable
          testID="note-mine"
          onPress={onMine}
          accessibilityRole="button"
          accessibilityLabel={mine ? `Your note: ${mine.text}. Change it` : 'Share a note'}
          className="items-center gap-1"
        >
          <Bubble text={mine?.text ?? 'Share a note'} prompt={!mine} />
          <ChatAvatar person={me} size={60} />
        </Pressable>
        <Text importantForAccessibility="no" accessibilityElementsHidden className="text-xs text-muted-foreground">Your note</Text>
      </View>
      {buddies.map((n) => (
        <View key={n.person.id} className="w-[68px] items-center gap-1">
          <Pressable
            testID={`note-${n.person.id}`}
            onPress={() => onOpen(n)}
            onLongPress={() => onReport(n)}
            accessibilityRole="button"
            accessibilityLabel={`${personName(n.person, false)}'s note: ${n.text}. Reply`}
            accessibilityActions={[{ name: 'longpress', label: 'Report note' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'longpress') onReport(n);
            }}
            className="items-center gap-1"
          >
            <Bubble text={n.text} prompt={false} />
            <ChatAvatar person={n.person} size={60} ring={ringed?.has(n.person.id) ?? false} />
          </Pressable>
          <Text numberOfLines={1} importantForAccessibility="no" accessibilityElementsHidden className="text-xs text-muted-foreground">{personName(n.person, false)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
