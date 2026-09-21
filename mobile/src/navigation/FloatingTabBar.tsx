import React, { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Orb } from '../components/orb/Orb';
import { hubOrbAppearance } from '../lib/hubOrb';
import { useCoachStatus } from '../lib/useCoachStatus';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { COLORS, MOTION } from '../theme';
import { FLOATING_BAR_HEIGHT, FLOATING_BAR_MARGIN, HUB_TAB, TAB_LABELS, activeCircleTarget, slotCenterX } from './tabBarLayout';

const CIRCLE_SIZE = 48;
// The pill has a 1 dp border, so its content area is 2 dp shorter.
const CIRCLE_TOP = (FLOATING_BAR_HEIGHT - 2 - CIRCLE_SIZE) / 2;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Activity: 'calendar-outline',
  Metrics: 'stats-chart-outline',
  Profile: 'person-outline',
};

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useContext(SafeAreaInsetsContext);
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const reduced = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const { status, refresh } = useCoachStatus();
  const [innerWidth, setInnerWidth] = useState(0);

  const activeName = state.routes[state.index]?.name ?? 'Home';
  const hub = hubOrbAppearance(status, activeName === HUB_TAB);
  const target = activeCircleTarget(activeName);

  // Consent can change while another tab is open (accept, revoke), so re-read
  // the coach status whenever the user moves between tabs -- but not on first
  // render, where useCoachStatus has already fetched.
  const previousIndex = useRef(state.index);
  useEffect(() => {
    if (previousIndex.current === state.index) return;
    previousIndex.current = state.index;
    void refresh();
  }, [state.index, refresh]);

  const circleX = useSharedValue(0);
  const circleScale = useSharedValue(target.visible ? 1 : 0);
  useEffect(() => {
    const x = slotCenterX(target.index, innerWidth, state.routes.length) - CIRCLE_SIZE / 2;
    const scale = target.visible ? 1 : 0;
    circleX.value = reduced ? x : withSpring(x, MOTION.spring.settle);
    circleScale.value = reduced ? scale : withSpring(scale, MOTION.spring.settle);
  }, [target.index, target.visible, innerWidth, state.routes.length, reduced, circleX, circleScale]);
  const circleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: circleX.value }, { scale: circleScale.value }] }));

  const hidden = useSharedValue(0);
  useEffect(() => {
    hidden.value = withTiming(keyboardVisible ? 1 : 0, { duration: MOTION.duration.fast });
  }, [keyboardVisible, hidden]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value,
    transform: [{ translateY: hidden.value * (FLOATING_BAR_HEIGHT + 40) }],
  }));

  function press(route: (typeof state.routes)[number], focused: boolean) {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      (navigation.navigate as unknown as (name: string, params?: object) => void)(route.name, route.params);
    }
  }

  return (
    <Animated.View
      testID="floating-tab-bar"
      pointerEvents={keyboardVisible ? 'none' : 'box-none'}
      style={[{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets?.bottom ?? 0, FLOATING_BAR_MARGIN) }, barStyle]}
    >
      <View
        className="border border-hairline bg-bar"
        style={{
          height: FLOATING_BAR_HEIGHT,
          borderRadius: FLOATING_BAR_HEIGHT / 2,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <View className="flex-1 flex-row items-center" onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}>
          <Animated.View
            pointerEvents="none"
            className="absolute left-0 rounded-full bg-bar-active"
            style={[{ width: CIRCLE_SIZE, height: CIRCLE_SIZE, top: CIRCLE_TOP }, circleStyle]}
          />
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const isHub = route.name === HUB_TAB;
            return (
              <Pressable
                key={route.key}
                testID={`tab-${route.name}`}
                accessibilityRole="button"
                accessibilityLabel={TAB_LABELS[route.name] ?? route.name}
                accessibilityState={{ selected: focused }}
                onPress={() => press(route, focused)}
                hitSlop={4}
                className="flex-1 items-center justify-center"
                style={{ height: FLOATING_BAR_HEIGHT - 2 }}
              >
                {isHub ? (
                  <Orb testID="hub-orb" size={64} state={hub.state} paused={hub.paused} dimmed={hub.dimmed} />
                ) : (
                  <Ionicons
                    name={ICONS[route.name] ?? 'ellipse-outline'}
                    size={22}
                    color={focused ? colors.barIconActive : colors.barIcon}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}
