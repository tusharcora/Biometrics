import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ThinkingOrb } from '../../components/orb/ThinkingOrb';
import type { OrbState, OrbTheme } from '../../components/orb/types';

export const ORB_STATES: OrbState[] = [
  'working',
  'searching',
  'solving',
  'listening',
  'connecting',
  'weaving',
  'composing',
  'breathing',
  'shaping',
];

// Dev-only: every orb state at both sizes, with a theme and a pause toggle.
// Plain React Native styles on purpose, so it works independently of the app's
// theming. Shown by launching with EXPO_PUBLIC_ORB_GALLERY=1 (see App.tsx).
export function OrbGalleryScreen() {
  const [theme, setTheme] = useState<Exclude<OrbTheme, 'auto'>>('dark');
  const [paused, setPaused] = useState(false);
  const dark = theme === 'dark';
  const background = dark ? '#0c0c0d' : '#fafaf9';
  const foreground = dark ? '#f5f5f4' : '#1c1917';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingTop: 72, gap: 20 }}>
      <Text style={{ color: foreground, fontSize: 20, fontWeight: '700' }}>Orb gallery</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable testID="gallery-theme" onPress={() => setTheme(dark ? 'light' : 'dark')}>
          <Text style={{ color: foreground }}>Theme: {theme}</Text>
        </Pressable>
        <Pressable testID="gallery-pause" onPress={() => setPaused(!paused)}>
          <Text style={{ color: foreground }}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
      </View>
      {ORB_STATES.map((state) => (
        <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <ThinkingOrb state={state} size={64} theme={theme} paused={paused} />
          <ThinkingOrb state={state} size={20} theme={theme} paused={paused} />
          <Text style={{ color: foreground }}>{state}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
