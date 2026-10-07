// Social story viewer (spec 2026-10-07 social §4.2): the recap story engine (useStoryViewer + ViewerProgress) over
// a buddy's frames for their day. Reaching the last frame marks it seen (once) and refreshes Social; running past
// the end closes. Replies are stickers until chats arrive in S3; my own story has none.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useReducedMotion } from 'react-native-reanimated';
import { buddyErrorCode, sendSticker, type StickerKind } from '../api/buddies';
import { fetchStory, markStorySeen, type Story } from '../api/social';
import { ViewerProgress } from '../components/recap/ViewerProgress';
import { CheckInSheet } from '../components/social/CheckInSheet';
import { SocialStoryFrame } from '../components/social/SocialStoryFrame';
import { Text } from '../components/ui/text';
import { buddyErrorMessage, STICKERS } from '../lib/buddyCopy';
import { knownStoryFrames, personName } from '../lib/socialCopy';
import { refreshSocial, useSocial } from '../lib/socialStore';
import { useStoryViewer } from '../lib/useStoryViewer';

const GROUND = '#0F1230';

type Loaded = { phase: 'loading' } | { phase: 'ready'; story: Story } | { phase: 'gone' } | { phase: 'error' };

export function SocialStoryScreen() {
  const navigation = useNavigation();
  const { authorId } = (useRoute().params ?? {}) as { authorId: string };
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });
  const leave = useCallback(() => navigation.goBack(), [navigation]);
  // Retry is not tied to an effect: it checks this, so a load that lands after leaving sets nothing.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (live: () => boolean) => {
    setLoaded({ phase: 'loading' });
    try {
      const story = await fetchStory(authorId);
      // Frames this app can't draw (a newer server's kind or value) are skipped, not drawn blank or mislabelled.
      const frames = knownStoryFrames(story.frames);
      // Nothing left to play (it emptied since the ring was drawn): not available, never an endless loader.
      if (live()) setLoaded(frames.length > 0 ? { phase: 'ready', story: { ...story, frames } } : { phase: 'gone' });
    } catch (e) {
      // No longer buddies (or no such person): gone. Anything else (offline, 5xx): retryable.
      const code = buddyErrorCode(e);
      const status = (e as { status?: number } | null)?.status;
      if (live()) setLoaded(code === 'not_buddies' || status === 404 ? { phase: 'gone' } : { phase: 'error' });
    }
  }, [authorId]);
  useEffect(() => {
    let live = true;
    void load(() => live);
    return () => {
      live = false;
    };
  }, [load]);

  if (loaded.phase === 'ready') return <Viewer story={loaded.story} onClose={leave} />;
  return (
    <SafeAreaView testID={`social-story-${loaded.phase}`} style={{ flex: 1, backgroundColor: GROUND }}>
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center gap-4 px-8">
        {loaded.phase === 'loading' ? <ActivityIndicator color="#FFFFFF" /> : null}
        {loaded.phase === 'gone' ? <Text className="text-center text-white">This story isn't available anymore.</Text> : null}
        {loaded.phase === 'error' ? (
          <>
            <Text className="text-center text-white">Couldn't load this story</Text>
            <Text testID="social-story-retry" accessibilityRole="button" onPress={() => void load(() => mounted.current)} className="rounded-full bg-white px-5 py-2 font-semibold text-black">Retry</Text>
          </>
        ) : null}
        <Text testID="social-story-close" accessibilityRole="button" onPress={leave} className="font-semibold text-white">Close</Text>
      </View>
    </SafeAreaView>
  );
}

function Viewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const social = useSocial();
  const mine = social.status === 'ready' && social.home.me.person.id === story.author.id;
  const myMood = social.status === 'ready' ? social.home.me.checkIn?.mood ?? null : null;
  const reduceMotion = useReducedMotion();
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The ref guards a double tap before the re-render.
  const sending = useRef(false);
  const seen = useRef(false);
  // A sticker reply can land after the viewer closed: no message then.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const viewer = useStoryViewer({ count: story.frames.length, autoAdvance: !reduceMotion, onClose });
  const { pause, resume, close } = viewer;
  const last = story.frames.length - 1;

  // Seen = the viewer reached the last frame (spec §4.2), once per open, even if they close right there.
  useEffect(() => {
    if (viewer.index === last && !seen.current) {
      seen.current = true;
      void markStorySeen(story.author.id)
        .catch(() => undefined)
        .finally(() => {
          void refreshSocial();
        });
    }
  }, [viewer.index, last, story.author.id]);

  // Past the last frame there are no end actions here: it closes.
  useEffect(() => {
    if (viewer.ended) close();
  }, [viewer.ended, close]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? resume('background') : pause('background')));
    return () => sub.remove();
  }, [pause, resume]);

  // Nothing moves on by itself under VoiceOver / TalkBack: the reader sets the pace by tap.
  useEffect(() => {
    let live = true;
    const apply = (on: boolean) => (on ? pause('screenReader') : resume('screenReader'));
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live) apply(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', apply);
    return () => {
      live = false;
      sub.remove();
    };
  }, [pause, resume]);

  async function reply(kind: StickerKind) {
    if (sending.current) return;
    sending.current = true;
    setMessage(null);
    try {
      await sendSticker(story.author.id, kind);
      if (mounted.current) setMessage('Sent');
    } catch (e) {
      if (mounted.current) setMessage(buddyErrorMessage(buddyErrorCode(e)));
    } finally {
      sending.current = false;
    }
  }

  // The check-in sheet is up: the story waits under it. After a check-in the frame stays locked in this
  // open viewer; the next open shows the mood.
  const unlock = () => {
    pause('sheet');
    setCheckingIn(true);
  };
  const closeSheet = () => {
    setCheckingIn(false);
    resume('sheet');
  };

  const frame = story.frames[viewer.index]!;
  return (
    <SafeAreaView testID="social-story" style={{ flex: 1, backgroundColor: GROUND }}>
      <StatusBar style="light" />
      <View className="px-4 pt-2">
        <ViewerProgress count={story.frames.length} index={viewer.index} progress={viewer.progress} track="rgba(255,255,255,0.3)" fill="#FFFFFF" />
      </View>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text testID="social-story-name" numberOfLines={1} className="flex-1 font-semibold text-white">{personName(story.author, mine)}</Text>
        <Text testID="social-story-close" accessibilityRole="button" onPress={close} className="text-white">Close</Text>
      </View>
      <View testID={`story-frame-${viewer.index}`} className="flex-1">
        <Pressable
          testID="social-story-prev"
          accessibilityRole="button"
          accessibilityLabel="Previous"
          onPress={viewer.prev}
          onPressIn={() => pause('hold')}
          onPressOut={() => resume('hold')}
          // A long hold only pauses: letting go does not also step.
          delayLongPress={250}
          onLongPress={() => undefined}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%' }}
        />
        <Pressable
          testID="social-story-next"
          accessibilityRole="button"
          // On the last frame Next closes: say so.
          accessibilityLabel={viewer.index === last ? 'Close story' : 'Next'}
          onPress={viewer.next}
          onPressIn={() => pause('hold')}
          onPressOut={() => resume('hold')}
          // A long hold only pauses: letting go does not also step.
          delayLongPress={250}
          onLongPress={() => undefined}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%' }}
        />
        {/* Over the tap areas, letting taps through: the locked frame's Check in button stays reachable. */}
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <SocialStoryFrame frame={frame} author={story.author} mine={mine} onUnlock={unlock} />
        </View>
      </View>
      {mine ? null : (
        <View className="gap-2 px-4 pb-4">
          <View className="flex-row gap-2">
            {STICKERS.map((s) => (
              <Text
                key={s.kind}
                testID={`story-reply-${s.kind}`}
                accessibilityRole="button"
                onPress={() => void reply(s.kind)}
                className="flex-1 rounded-full border border-white/30 py-2 text-center text-sm text-white"
              >
                {s.label}
              </Text>
            ))}
          </View>
          {message ? <Text testID="story-message" className="text-center text-sm text-white/80">{message}</Text> : null}
        </View>
      )}
      <CheckInSheet visible={checkingIn} current={myMood} onClose={closeSheet} />
    </SafeAreaView>
  );
}
