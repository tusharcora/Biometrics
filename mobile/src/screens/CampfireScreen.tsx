// The Campfire page (spec 2026-10-07 social §6, design V5Campfire), pushed from the camp banner. The scene: me and up
// to 7 buddies around the fire (the server's order: me, then latest activity) and "+N" for the rest; night (stars, a
// moon, a lit fire once anyone is in bed on time) or day (sky, unlit logs) by my clock; asleep coaches rest with
// "z z"; a camp note shows in a one-line bubble over its coach (mine: a dashed "+ Add a note" when I have none).
// Below: my note composer (live count, Share, Clear note), the fire strength card, Say goodnight (while my own window
// is open: from min(20:00, my goal − 60 min) to 05:59; otherwise "You can say goodnight from 8:00 PM") / Message
// camp, and "Who's here" with each whole note. Every time here is 12-hour. A buddy's coach opens their week and
// "Message camp" opens Buddies until chats arrive in S3. An older server (bare 404) says the camp isn't open yet.
// Camp notes are buddies' free text: shown here only, never logged.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { buddyErrorCode } from '../api/buddies';
import { clearCampNote, fetchCamp, saveCampNote, type Camp, type CampMember, type CampNote } from '../api/social';
import { Character } from '../components/characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../components/characters/types';
import { pixelFont } from '../components/coach/thinking/shared';
import { GoodnightButton } from '../components/social/GoodnightButton';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PressableScale } from '../components/ui/pressable-scale';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import {
  CAMP_NOTE_MAX, campKicker, campStatus, fireLine, goodnightOpensLine, noteLength, personName,
} from '../lib/socialCopy';
import { refreshSocial } from '../lib/socialStore';
import type { RootStackParamList } from '../navigation/RootNavigator';

type State = { status: 'loading' } | { status: 'ready'; camp: Camp } | { status: 'unavailable' } | { status: 'error' };

export const SCENE_HEIGHT = 340;
/** The back button and the kicker + title (10 px + a 32-px display line) sit in this band at the scene's top. */
export const SCENE_HEADER_HEIGHT = 60;
/** One coach's slot: bubble (≤ 24) + "z z" (12) + coach (44) + name (16) + three 2-px gaps = 102, rounded up. */
export const COACH_W = 76;
export const COACH_H = 104;
/** The fire: four 10-px flame rows over 8-px logs, as wide as the logs. */
export const FIRE_W = 50;
export const FIRE_H = 48;
const NIGHT_SKY = '#0F1230';
const NIGHT_GROUND = '#161B3D';
const DAY_SKY = '#8EC5EE';
const DAY_GROUND = '#5B7F3A';
const MOON = '#FDE68A';
const SEGMENT_ON = '#F97316';
const SEGMENT_OFF = '#2E323B';

export interface Box { left: number; top: number; width: number; height: number }

/**
 * Seats around the fire: [0] is mine, then up to 7 buddies. `dx` = the slot's centre from the scene's centre (px),
 * `top` = px from the scene's top. Three bands, centred so the layout is the same on every phone:
 *   back  (top 64–168):  dx ±50        → x spans c−88…c−12 and c+12…c+88
 *   sides (top 128–232): dx ±130       → x spans c−168…c−92 and c+92…c+168 (clear of the back pair by 4 px)
 *   front (top 236–340): dx ±50, ±130  → the same four columns, 4 px below the side seats
 * The fire sits at c−25…c+25, top 182–230: below the back pair (168), above the front row (236), and 67 px inside
 * the side seats. Width needed: 2 × 168 = 336 ≤ 375, the narrowest supported phone. The test checks every pair.
 */
const SEATS = [
  { dx: -50, top: 236 }, { dx: 50, top: 236 }, { dx: -130, top: 128 }, { dx: 130, top: 128 },
  { dx: -50, top: 64 }, { dx: 50, top: 64 }, { dx: -130, top: 236 }, { dx: 130, top: 236 },
] as const;
const FIRE_TOP = 182;

export function seatBoxes(width: number): Box[] {
  return SEATS.map((s) => ({ left: width / 2 + s.dx - COACH_W / 2, top: s.top, width: COACH_W, height: COACH_H }));
}

export function fireBox(width: number): Box {
  return { left: width / 2 - FIRE_W / 2, top: FIRE_TOP, width: FIRE_W, height: FIRE_H };
}

const STARS = [[0.08, 30], [0.28, 18], [0.5, 40], [0.69, 14], [0.9, 70], [0.16, 80], [0.6, 76], [0.36, 100], [0.06, 130], [0.84, 124]] as const;

/** A pixel crescent: a pale disc with a sky-coloured disc over its upper right (per the canvas). */
function Moon() {
  return (
    <View testID="camp-moon" accessible accessibilityRole="image" accessibilityLabel="The moon is up" style={{ position: 'absolute', top: 14, right: 20, width: 22, height: 22 }}>
      <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: MOON }} />
      <View style={{ position: 'absolute', left: 7, top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: NIGHT_SKY }} />
    </View>
  );
}

function Fire({ lit }: { lit: boolean }) {
  return (
    <View testID={lit ? 'camp-fire-lit' : 'camp-fire-unlit'} accessible accessibilityRole="image"
      accessibilityLabel={lit ? 'The fire is lit' : 'The fire is out'} style={{ width: FIRE_W, height: FIRE_H, alignItems: 'center', justifyContent: 'flex-end' }}>
      {lit ? (
        <>
          <View style={{ width: 10, height: 10, backgroundColor: '#FEF3C7' }} />
          <View style={{ width: 20, height: 10, backgroundColor: '#FDE68A' }} />
          <View style={{ width: 30, height: 10, backgroundColor: '#FB923C' }} />
          <View style={{ width: 40, height: 10, backgroundColor: '#F97316' }} />
        </>
      ) : null}
      <View style={{ width: 50, height: 8, backgroundColor: '#78350F' }} />
    </View>
  );
}

function Coach({ member, onPress }: { member: CampMember; onPress: () => void }) {
  const id = member.person.id;
  const name = personName(member.person, member.mine);
  return (
    <PressableScale testID={`camp-coach-${id}`} accessibilityRole="button" accessibilityLabel={member.mine ? 'You. Write your camp note' : `${name}, ${member.asleep ? 'asleep' : 'awake'}`}
      accessibilityHint={member.mine ? undefined : 'Opens their week'} onPress={onPress} style={{ width: COACH_W, height: COACH_H, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
      {member.note ? (
        // One truncated line, no wider than the seat, so bubbles never cross; "Who's here" shows the whole note.
        <Text testID={`camp-bubble-${id}`} numberOfLines={1} style={{ maxWidth: COACH_W }}
          className="rounded-[10px] bg-white px-2 py-1 text-[11px] font-semibold text-black">
          {member.note}
        </Text>
      ) : member.mine ? (
        <Text testID="camp-bubble-add" numberOfLines={1} style={{ maxWidth: COACH_W }}
          className="rounded-[10px] border border-dashed border-[#6366F1] px-2 py-1 text-[11px] font-semibold text-[#C7D2FE]">
          + Add a note
        </Text>
      ) : null}
      <Text testID={`camp-zz-${id}`} className="min-h-[12px] text-[10px] text-[#C7D2FE]" style={{ fontFamily: pixelFont() }}>{member.asleep ? 'z z' : ''}</Text>
      <Character characterId={isCharacterId(member.person.coachId) ? member.person.coachId : DEFAULT_CHARACTER_ID} mood={member.asleep ? 'resting' : 'idle'} size={44} paused />
      <Text numberOfLines={1} className="text-xs font-semibold text-white">{name}</Text>
    </PressableScale>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale testID="camp-back" accessibilityRole="button" accessibilityLabel="Back to Social" onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full bg-black/40">
      <Ionicons name="chevron-back" size={18} color="#F5F5F4" />
    </PressableScale>
  );
}

export function CampfireScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  // `busy` disables the buttons only after a re-render; a double tap in one frame sends once.
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // My last shared note, from the server's answer: Clear stays offered even if the re-read after sharing fails.
  const [shared, setShared] = useState<CampNote | null>(null);
  // Each load's number: only the latest one may write, so an older answer never overwrites a newer one.
  const loads = useRef(0);

  const load = useCallback(async () => {
    const n = ++loads.current;
    try {
      const camp = await fetchCamp();
      if (!mounted.current || n !== loads.current) return;
      setState(camp ? { status: 'ready', camp } : { status: 'unavailable' });
      setShared(null);
    } catch {
      if (!mounted.current || n !== loads.current) return;
      // A failed re-read keeps the camp already on screen, but not buddies' notes: someone unpaired or blocked
      // since may still be in it. Their notes come back with the next good read.
      setState((s) => (s.status === 'ready'
        ? { status: 'ready', camp: { ...s.camp, members: s.camp.members.map((m) => (m.mine ? m : { ...m, note: null })) } }
        : { status: 'error' }));
    }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  // Any change re-reads this page and the Social home (the banner's counts, the timeline).
  const changed = useCallback(() => {
    void load();
    void refreshSocial();
  }, [load]);

  async function run(action: () => Promise<unknown>, after?: () => void, failed?: () => void) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (mounted.current) after?.();
      changed();
    } catch (e) {
      if (mounted.current) {
        failed?.();
        setMessage(buddyErrorMessage(buddyErrorCode(e)));
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (state.status !== 'ready') {
    return (
      <SafeAreaView testID={`camp-${state.status}`} className="flex-1 bg-background px-5 pt-4">
        <BackButton onPress={() => navigation.goBack()} />
        {state.status === 'loading' ? <Skeleton className="mt-4 h-64 w-full rounded-card" /> : null}
        {state.status === 'unavailable' ? (
          <Card className="mt-4 gap-2">
            <Text className="font-semibold">The camp isn't open yet</Text>
            <Text className="text-sm text-muted-foreground">Your buddies are still on Social.</Text>
          </Card>
        ) : null}
        {state.status === 'error' ? (
          <Card className="mt-4 gap-3">
            <Text className="text-sm">Couldn't load the camp.</Text>
            <Button testID="camp-retry" accessibilityRole="button" variant="secondary" onPress={() => void load()}>Try again</Button>
          </Card>
        ) : null}
      </SafeAreaView>
    );
  }

  const { camp } = state;
  const mine = camp.members.find((m) => m.mine) ?? null;
  const seats = seatBoxes(width);
  const fire = fireBox(width);
  const seated = camp.members.slice(0, seats.length);
  const more = camp.members.length - seated.length;
  const length = noteLength(draft);
  const canShare = !busy && length > 0 && length <= CAMP_NOTE_MAX;
  // The draft empties as it is sent and comes back if the server refuses it (unless I've typed again since).
  const share = () => {
    const sent = draft;
    setDraft('');
    void run(
      async () => setShared((await saveCampNote(sent)).note),
      undefined,
      () => setDraft((d) => (d === '' ? sent : d)),
    );
  };

  return (
    <SafeAreaView edges={['top']} testID="campfire" className="flex-1 bg-background">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <View testID={camp.night ? 'camp-scene-night' : 'camp-scene-day'}
          style={{ height: SCENE_HEIGHT, overflow: 'hidden', backgroundColor: camp.night ? NIGHT_SKY : DAY_SKY }}>
          {camp.night
            ? STARS.map(([x, y], i) => <View key={i} style={{ position: 'absolute', left: x * width, top: y, width: 3, height: 3, backgroundColor: '#C7D2FE' }} />)
            : null}
          {camp.night ? <Moon /> : null}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, backgroundColor: camp.night ? NIGHT_GROUND : DAY_GROUND }} />
          <View className="flex-row items-center gap-3 px-4" style={{ height: SCENE_HEADER_HEIGHT }}>
            <BackButton onPress={() => navigation.goBack()} />
            <View>
              <Text className="text-[10px] text-[#A5B4FC]" style={{ fontFamily: pixelFont() }}>{campKicker(new Date())}</Text>
              <Text className="font-display text-display text-white">The camp</Text>
            </View>
          </View>
          <View style={{ position: 'absolute', left: fire.left, top: fire.top }}>
            <Fire lit={camp.night && camp.fire.segments > 0} />
          </View>
          {seated.map((m, i) => (
            <View key={m.person.id} style={{ position: 'absolute', left: seats[i]!.left, top: seats[i]!.top }}>
              <Coach member={m} onPress={() => (m.mine ? input.current?.focus() : navigation.navigate('BuddyWeek', { buddyId: m.person.id }))} />
            </View>
          ))}
          {more > 0 ? (
            // Under the moon, right of the back-right seat and above the side seat: clear of every coach.
            <Text testID="camp-more" accessibilityLabel={`${more} more at the camp`} style={{ position: 'absolute', right: 16, top: 42 }} className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">
              {`+${more}`}
            </Text>
          ) : null}
        </View>

        <View className="gap-4 px-5 pt-4">
          <Card className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-sm font-semibold">Your camp note</Text>
              <Text testID="camp-note-count" accessibilityLabel={`${length} of ${CAMP_NOTE_MAX} characters`} className={`text-sm ${length > CAMP_NOTE_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                {`${length}/${CAMP_NOTE_MAX}`}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TextInput ref={input} testID="camp-note-input" accessibilityLabel="Your camp note" value={draft} onChangeText={setDraft}
                placeholder="Say something to the camp..." placeholderTextColor="#9B9DA6" autoCorrect={false}
                className="h-10 flex-1 rounded-tile border border-border bg-card px-3 text-base text-foreground" />
              <Button testID="camp-note-share" accessibilityRole="button" accessibilityLabel="Share your camp note" size="sm" disabled={!canShare} onPress={share}>Share</Button>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">Shows above your coach until sunrise</Text>
              {mine?.note || shared ? (
                <Button testID="camp-note-clear" accessibilityRole="button" accessibilityLabel="Clear your camp note" variant="secondary" size="sm" disabled={busy}
                  onPress={() => void run(clearCampNote, () => setShared(null))}>Clear note</Button>
              ) : null}
            </View>
            {message ? <Text testID="camp-message" className="text-sm text-destructive">{message}</Text> : null}
          </Card>

          <Card className="gap-2">
            <View className="flex-row justify-between">
              <Text className="text-sm font-semibold">Fire strength</Text>
              <Text testID="camp-fire-line" className="text-sm text-[#FDBA74]">{fireLine(camp.fire)}</Text>
            </View>
            <View testID="camp-fire-strength" className="flex-row gap-1" accessible accessibilityRole="progressbar" accessibilityLabel="Fire strength"
              accessibilityValue={{ min: 0, max: 5, now: camp.fire.segments }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} testID={`camp-fire-segment-${i}`} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: i < camp.fire.segments ? SEGMENT_ON : SEGMENT_OFF }} />
              ))}
            </View>
            <Text className="text-xs text-muted-foreground">The fire grows as your circle gets to bed by their goal. Keep it lit.</Text>
            <Text testID="camp-nights-lit" className="text-xs text-muted-foreground">{`Nights lit this week: ${camp.nightsLitThisWeek}`}</Text>
          </Card>

          <View className="flex-row items-start gap-2">
            <View className="flex-1">
              {/* My own window (owner ruling Q1), not the scene's night: an 18:00 goal opens it at 17:00. */}
              {camp.goodnightOpen ? (
                <GoodnightButton testID="camp-goodnight" goodnight={camp.goodnight} onChanged={changed} />
              ) : (
                <Text testID="camp-goodnight-later" className="text-sm text-muted-foreground">{goodnightOpensLine(camp.goodnightOpensAt)}</Text>
              )}
            </View>
            <Button testID="camp-message-camp" accessibilityRole="button" variant="secondary" onPress={() => navigation.navigate('Buddies')}>Message camp</Button>
          </View>

          <SectionLabel>Who's here</SectionLabel>
          {camp.members.map((m) => (
            <View key={m.person.id} testID={`camp-who-${m.person.id}`} className="flex-row items-center gap-3">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.asleep ? '#A78BFA' : '#86EFAC' }} />
              {/* No line limit: "Who's here" is where a whole note is read (the bubble is one truncated line). */}
              <Text className="flex-1 text-sm">
                <Text className="font-semibold">{personName(m.person, m.mine)}</Text>
                {' '}
                <Text testID={`camp-who-status-${m.person.id}`} className="text-muted-foreground">{campStatus(m)}</Text>
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
