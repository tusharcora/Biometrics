import React, { useEffect, useState } from 'react';
import { AppState, Linking, PixelRatio, Pressable, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import type { Recap } from '../api/recaps';
import { useCharacter } from '../characters/CharacterContext';
import { STORY_FRAME_COUNT, STORY_FRAME_INSETS, STORY_PROGRESS_HEIGHT, WeeklyStoryFrame, type StoryFrameIndex } from '../components/recap/WeeklyStoryView';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { readIncludePrefs } from '../lib/recapPrefs';
import { DESIGN_HEIGHT, DESIGN_WIDTH, exportLayout, recapCoachId, resolveIncludes, type Includes } from '../lib/recapShare';
import { recapTint, type RecapTint } from '../lib/recapTheme';
import { tapSide } from '../lib/storyViewer';
import { EXPORT_NOTICES, useRecapExport } from '../lib/useRecapExport';
import { useStoryViewer } from '../lib/useStoryViewer';

/** A drag down past this (points), or flung faster than CLOSE_VELOCITY, closes the viewer. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 1000;
/** Room under the frame for Save and Share. */
const ACTIONS_HEIGHT = 76;

// The weekly story viewer (recap restyle 2026-10-05): the three frames full screen, Instagram
// style. Each frame runs about five seconds under an animated bar and moves on by itself; a tap
// on the right half goes forward, the left half back; press and hold pauses; a swipe down or
// the close button closes, as does going past the last frame. Save and Share act on the frame on
// screen through the same off-screen 1080×1920 capture as the builder. With reduce motion on,
// nothing runs by itself: the bar shows the frame reached and taps step through.
export function RecapStoryScreen() {
  const { params } = useRoute<any>() as { params: { recap: Recap } };
  const navigation = useNavigation<any>();
  const { characterId } = useCharacter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const recap = params.recap;
  const coachId = recapCoachId(recap, characterId);
  const tint = recapTint(coachId);

  // The builder's stored choices: a part switched off there stays off in a shared frame.
  const [prefs, setPrefs] = useState<Partial<Includes> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void readIncludePrefs('story').then((stored) => {
      if (!cancelled) setPrefs(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const includes = resolveIncludes('story', prefs ?? {}, recap.stats);

  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'));
  const viewer = useStoryViewer({ count: STORY_FRAME_COUNT, autoAdvance: !reduceMotion, onClose: leave });
  const index = viewer.index as StoryFrameIndex;
  const { exportRef, busy, notice, save, share } = useRecapExport();
  const layout = exportLayout('story', PixelRatio.get());

  // The share sheet or the Photos prompt is up: the story waits under it.
  const { pause, resume } = viewer;
  useEffect(() => {
    if (busy) pause('share');
    else resume('share');
  }, [busy, pause, resume]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? resume('background') : pause('background')));
    return () => sub.remove();
  }, [pause, resume]);

  // The frame as large as fits between the safe area and the actions.
  const scale = Math.min(width / DESIGN_WIDTH, (height - insets.top - insets.bottom - ACTIONS_HEIGHT) / DESIGN_HEIGHT.story);
  const frameW = DESIGN_WIDTH * scale;
  const frameH = DESIGN_HEIGHT.story * scale;

  const dragY = useSharedValue(0);
  const swipe = Gesture.Pan()
    .withTestId('story-viewer-swipe')
    .activeOffsetY(12)
    .failOffsetX([-24, 24])
    .onStart(() => {
      runOnJS(pause)('drag');
    })
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(viewer.close)();
      } else {
        dragY.value = reduceMotion ? 0 : withSpring(0);
      }
    })
    .onFinalize(() => {
      runOnJS(resume)('drag');
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }], opacity: 1 - Math.min(dragY.value / 600, 0.5) }));

  const onTap = (e: GestureResponderEvent) => (tapSide(e.nativeEvent.locationX, frameW) === 'next' ? viewer.next() : viewer.prev());
  const canExport = prefs !== null && !busy;

  return (
    <View testID="story-viewer" style={{ flex: 1, backgroundColor: tint.ground }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <GestureDetector gesture={swipe}>
          <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, dragStyle]}>
            <View style={{ width: frameW, height: frameH }}>
              <WeeklyStoryFrame testID="story" recap={recap} coachId={coachId} includes={includes} scale={scale} index={index} showProgress={false} />
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: STORY_FRAME_INSETS.top * scale, left: STORY_FRAME_INSETS.left * scale, right: STORY_FRAME_INSETS.right * scale }}
              >
                <ViewerProgress tint={tint} index={index} progress={viewer.progress} scale={scale} />
              </View>
              <Pressable
                testID="story-viewer-tap"
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
                onPressIn={() => pause('hold')}
                onPressOut={() => resume('hold')}
                onPress={onTap}
                // A long hold only pauses: letting go does not also step.
                delayLongPress={250}
                onLongPress={() => undefined}
                accessibilityRole="adjustable"
                accessibilityLabel={`Your week, frame ${index + 1} of ${STORY_FRAME_COUNT}`}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? viewer.next() : viewer.prev())}
              />
              <Pressable
                testID="story-viewer-close"
                accessibilityRole="button"
                accessibilityLabel="Close story"
                hitSlop={12}
                onPress={viewer.close}
                style={{ position: 'absolute', top: (STORY_FRAME_INSETS.top + STORY_PROGRESS_HEIGHT + 12) * scale, right: STORY_FRAME_INSETS.right * scale - 4 }}
              >
                <Ionicons name="close" size={Math.round(26 * scale)} color={tint.text} />
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
        <View style={{ minHeight: ACTIONS_HEIGHT, paddingHorizontal: 20, paddingTop: 12, gap: 8 }}>
          <View className="flex-row gap-3">
            <Button testID="story-viewer-save" className="flex-1" variant="secondary" disabled={!canExport} onPress={() => void save()}>
              Save image
            </Button>
            <Button testID="story-viewer-share" className="flex-1" disabled={!canExport} onPress={() => void share()}>
              Share
            </Button>
          </View>
          {notice ? (
            <View className="flex-row items-center justify-center gap-3">
              <Text testID="story-viewer-notice" className="text-center text-sm" style={{ color: notice === 'saved' ? tint.soft : '#FCA5A5' }}>
                {EXPORT_NOTICES[notice]}
              </Text>
              {notice === 'denied' ? (
                <Pressable testID="story-viewer-open-settings" accessibilityRole="button" onPress={() => void Linking.openSettings()}>
                  <Text className="text-sm font-semibold" style={{ color: tint.text }}>Open Settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
      {/* The export view: the frame on screen at a fixed size, off screen, the only thing captured. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <View ref={exportRef} collapsable={false} testID="story-export-view" style={{ width: layout.width, height: layout.height }}>
          <WeeklyStoryFrame testID="story-export" recap={recap} coachId={coachId} includes={includes} scale={layout.scale} index={index} />
        </View>
      </View>
    </View>
  );
}

/** The viewer's own bar, drawn exactly over the frame's: past frames full, the current one filling. */
function ViewerProgress({ tint, index, progress, scale }: { tint: RecapTint; index: number; progress: SharedValue<number>; scale: number }) {
  const u = (n: number) => n * scale;
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));
  return (
    <View testID="story-viewer-progress" style={{ flexDirection: 'row', gap: u(4), height: u(STORY_PROGRESS_HEIGHT) }}>
      {Array.from({ length: STORY_FRAME_COUNT }, (_, i) => (
        <View key={i} style={{ flex: 1, borderRadius: u(2), backgroundColor: tint.track, overflow: 'hidden' }}>
          {i < index ? <View style={{ width: '100%', height: '100%', backgroundColor: tint.text }} /> : null}
          {i === index ? <Animated.View style={[{ height: '100%', backgroundColor: tint.text }, fill]} /> : null}
        </View>
      ))}
    </View>
  );
}
