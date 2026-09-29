import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Orb } from '../orb/Orb';
import { COLORS } from '../../theme';
import { Glow } from './glow';

// The coach's orb, held still, at any size -- for the small places that stand
// for the coach (the Ask Coach tile, the recap header, the Coach title). It is
// the real orb (paused), so the coach has one face everywhere, and paused so
// only the tab bar's orb (and a reply in progress) pays for animation.
// ThinkingOrb ships 20 and 64 dp presets; other sizes scale the nearer one.
export function StillOrb({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const base = size <= 28 ? 20 : 64;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {glow ? <Glow color={colors.accent} size={size * 2.4} around={size} intensity={0.3} /> : null}
      <View style={{ transform: [{ scale: size / base }] }}>
        <Orb state="breathing" size={base} paused />
      </View>
    </View>
  );
}
