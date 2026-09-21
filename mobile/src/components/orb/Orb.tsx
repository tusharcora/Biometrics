import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ThinkingOrb } from './ThinkingOrb';
import type { OrbSize, OrbState } from './types';

export const DIMMED_OPACITY = 0.45;

export interface OrbProps {
  state: OrbState;
  size: OrbSize;
  paused?: boolean;
  dimmed?: boolean;
  label?: string;
  testID?: string;
}

// The app's orb. The theme is passed explicitly because this app's theme is a
// manual toggle, and the vendored component's "auto" only follows the OS.
export function Orb({ state, size, paused = false, dimmed = false, label, testID }: OrbProps) {
  const { colorScheme } = useColorScheme();
  return (
    <View testID={testID} style={{ width: size, height: size, opacity: dimmed ? DIMMED_OPACITY : 1 }}>
      <ThinkingOrb
        state={state}
        size={size}
        paused={paused}
        theme={colorScheme === 'light' ? 'light' : 'dark'}
        accessibilityLabel={label}
      />
    </View>
  );
}
