// The Campfire's pull-up glass panel (redesign 2026-10-07). Three resting heights: Peek (the fire's strength), Half
// (adds the camp note and goodnight) and Full (adds "Who's here" and Message camp). The content is one scroll view;
// a lower stop shows its top part. It snaps to the nearest stop by position and velocity, never in between; the
// handle steps up a stop (Full goes back to Peek), and screen readers get increment / decrement on it. The keyboard
// lifts the panel so the composer stays in view. Same material, radius and spring as the app's Sheet.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { COLORS, MOTION } from '../../theme';
import { GlassSurface } from '../ui/glass-surface';
import { PEEK_RESERVE } from './campSceneGeometry';

export type CampStop = 'peek' | 'half' | 'full';
export type CampStops = Record<CampStop, number>;
export const STOP_ORDER: readonly CampStop[] = ['peek', 'half', 'full'];
export const STOP_LABEL: Record<CampStop, string> = { peek: 'peek', half: 'half open', full: 'fully open' };
const PANEL_RADIUS = 38;
/** The handle row and the fire's strength: what Peek shows above the home indicator. */
export const PEEK_CONTENT = 106;
/** How far ahead (s) a fling's velocity carries the panel before it picks the nearest stop. */
const FLING_S = 0.15;

/**
 * Each stop's panel top, in px from the screen's top. Peek: the handle and the fire above the home indicator (never
 * taller than PEEK_RESERVE, the room the scene keeps clear). Half: 40% down. Full: 11% down, below the status bar.
 */
export function panelStops(height: number, insets: { top: number; bottom: number }): CampStops {
  return {
    peek: height - Math.min(PEEK_RESERVE, PEEK_CONTENT + insets.bottom),
    half: Math.round(height * 0.4),
    full: Math.max(insets.top + 8, Math.round(height * 0.11)),
  };
}

/** The stop a drag released at `y` with velocity `vy` (px/s, down is positive) settles on: the nearest to where it's headed. */
export function snapStop(stops: CampStops, y: number, vy: number): CampStop {
  'worklet';
  const ahead = y + vy * FLING_S;
  let best: CampStop = 'peek';
  for (const s of ['peek', 'half', 'full'] as const) {
    if (Math.abs(stops[s] - ahead) < Math.abs(stops[best] - ahead)) best = s;
  }
  return best;
}

/** The handle's tap: up a stop, and from Full back to Peek. */
export const nextStop = (stop: CampStop): CampStop => STOP_ORDER[(STOP_ORDER.indexOf(stop) + 1) % STOP_ORDER.length]!;

/** Increment (up) and decrement (down), stopping at either end. */
export function stepStop(stop: CampStop, by: 1 | -1): CampStop {
  const i = Math.min(STOP_ORDER.length - 1, Math.max(0, STOP_ORDER.indexOf(stop) + by));
  return STOP_ORDER[i]!;
}

/** The panel's stop and its animated top. Reduce Motion snaps with no spring. */
export function useCampPanel(stops: CampStops, reduced: boolean) {
  const [stop, setStop] = useState<CampStop>('peek');
  const top = useSharedValue(stops.peek);
  const latest = useRef({ stops, reduced });
  latest.current = { stops, reduced };
  const moveTo = useCallback((next: CampStop) => {
    setStop(next);
    const y = latest.current.stops[next];
    top.value = latest.current.reduced ? y : withSpring(y, MOTION.spring.settle);
  }, [top]);
  // A new screen size (rotation, split view) moves the panel to its stop's new top.
  useEffect(() => {
    top.value = stops[stop];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.peek, stops.half, stops.full]);
  return { stop, moveTo, top };
}

/** The keyboard's height, following it in and out (at once with Reduce Motion). */
function useKeyboardHeight(reduced: boolean): SharedValue<number> {
  const height = useSharedValue(0);
  useEffect(() => {
    // iOS says where the keyboard is headed before it moves; Android only once it has.
    const ios = Platform.OS === 'ios';
    const to = (h: number, duration: number) => {
      height.value = reduced ? h : withTiming(h, { duration: duration || 250 });
    };
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => to(e.endCoordinates.height, e.duration));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => to(0, e.duration));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [height, reduced]);
  return height;
}

interface CampPanelProps {
  stops: CampStops;
  stop: CampStop;
  top: SharedValue<number>;
  moveTo: (stop: CampStop) => void;
  height: number;
  bottomInset: number;
  /** A screen reader is on: the panel scrolls at every stop, so all of it can be reached. */
  screenReader: boolean;
  reduced: boolean;
  /** Always in view (Peek's content): it and the handle are where the panel is dragged from. */
  header: React.ReactNode;
  children: React.ReactNode;
}

export function CampPanel({ stops, stop, top, moveTo, height, bottomInset, screenReader, reduced, header, children }: CampPanelProps) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'light' ? 'light' : 'dark';
  const colors = COLORS[scheme];
  const keyboard = useKeyboardHeight(reduced);
  const scroll = useRef<ScrollView>(null);
  const start = useSharedValue(0);

  // A lower stop shows the top of the content.
  useEffect(() => {
    if (stop !== 'full') scroll.current?.scrollTo({ y: 0, animated: !reduced });
  }, [stop, reduced]);

  const drag = Gesture.Pan()
    .withTestId('camp-panel-drag')
    .activeOffsetY([-8, 8])
    .onStart(() => {
      start.value = top.value;
    })
    .onUpdate((e) => {
      top.value = Math.min(stops.peek, Math.max(stops.full, start.value + e.translationY));
    })
    .onEnd((e) => {
      runOnJS(moveTo)(snapStop(stops, top.value, e.velocityY));
    });

  // The keyboard lifts the panel by its height, up to Full.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(stops.full, top.value - keyboard.value) }],
  }));

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') moveTo(stepStop(stop, 1));
    else if (e.nativeEvent.actionName === 'decrement') moveTo(stepStop(stop, -1));
    else if (e.nativeEvent.actionName === 'activate') moveTo(nextStop(stop));
  };

  // Taller than Full by a corner's worth, so its bottom corners stay below the screen.
  const panelHeight = height - stops.full + PANEL_RADIUS * 2;
  return (
    <Animated.View testID="camp-panel" style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: panelHeight }, panelStyle]}>
      <GlassSurface scheme={scheme} fallbackColor={colors.surfaceRaised} borderRadius={PANEL_RADIUS}
        style={{ flex: 1, borderWidth: 1, borderColor: colors.hairline }}>
        <GestureDetector gesture={drag}>
          <View>
            <Pressable testID="camp-panel-handle" accessibilityRole="adjustable" accessibilityLabel={`Camp details, ${STOP_LABEL[stop]}`}
              accessibilityHint={stop === 'full' ? 'Shows less' : 'Shows more'} accessibilityValue={{ text: STOP_LABEL[stop] }}
              accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={onAction}
              onPress={() => moveTo(nextStop(stop))} className="h-[30px] items-center justify-center">
              <View className="h-1 w-10 rounded-full bg-muted-foreground/40" />
            </Pressable>
            <View className="px-5">{header}</View>
          </View>
        </GestureDetector>
        <ScrollView ref={scroll} testID="camp-panel-scroll" scrollEnabled={stop === 'full' || screenReader} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={stop === 'full'}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: stops[stop] - stops.full + PANEL_RADIUS * 2 + bottomInset + 24, gap: 14 }}>
          {children}
        </ScrollView>
      </GlassSurface>
    </Animated.View>
  );
}
