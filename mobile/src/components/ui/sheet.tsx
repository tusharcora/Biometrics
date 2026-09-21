import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Modal, PanResponder, Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '../../theme';

export const DISMISS_DISTANCE = 80;
export const DISMISS_VELOCITY = 0.8;

export function shouldDismiss(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
}

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}

// Bottom detail sheet. Slides in on show; a backdrop tap, the Android back
// button, or a downward drag on the handle slides it out and then calls
// `onClose` exactly once. (A parent that flips `visible` off directly just
// makes it disappear, without the exit animation.)
export function Sheet({ visible, onClose, children, testID = 'sheet' }: SheetProps) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const translateY = useSharedValue(height);
  const closing = useRef(false);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    translateY.value = height;
    translateY.value = reduced ? 0 : withSpring(0, MOTION.spring.settle);
  }, [visible, height, reduced, translateY]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduced) {
      onClose();
      return;
    }
    translateY.value = withTiming(height, { duration: MOTION.duration.normal });
    setTimeout(onClose, MOTION.duration.normal);
  }, [height, onClose, reduced, translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_e, g) => {
          translateY.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismiss(g.dy, g.vy)) dismiss();
          else translateY.value = withSpring(0, MOTION.spring.settle);
        },
      }),
    [dismiss, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent onRequestClose={dismiss}>
      <View testID={testID} className="flex-1 justify-end">
        <Pressable
          testID={`${testID}-backdrop`}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={dismiss}
          className="absolute inset-0 bg-black/50"
        />
        <Animated.View style={sheetStyle} className="rounded-t-3xl border border-hairline bg-surface-raised px-4 pb-8 pt-2">
          <View testID={`${testID}-handle`} className="items-center py-2" {...pan.panHandlers}>
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
