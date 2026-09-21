import React from 'react';
import type { ViewProps } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { MOTION } from '../../theme';

export function revealDelay(index: number): number {
  return Math.max(0, index) * MOTION.stagger;
}

// Staggered fade-up entrance. With reduced motion the content simply appears.
export function Reveal({ index = 0, children, ...props }: ViewProps & { index?: number; className?: string; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(revealDelay(index)).duration(MOTION.duration.reveal)} {...props}>
      {children}
    </Animated.View>
  );
}
