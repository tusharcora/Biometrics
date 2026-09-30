import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Character } from '../../components/characters/Character';
import { CHARACTERS } from '../../components/characters/registry';
import { CHARACTER_IDS, CHARACTER_MOODS } from '../../components/characters/types';

// Dev-only: every character in every mood, full size and both mini sizes, with
// a background and a pause toggle. Plain React Native styles on purpose, so it
// works independently of the app's theming. Shown by launching with
// EXPO_PUBLIC_CHARACTER_GALLERY=1 (see App.tsx). Watch the perf monitor here.
export function CharacterGalleryScreen() {
  const [dark, setDark] = useState(true);
  const [paused, setPaused] = useState(false);
  const background = dark ? '#0c0c0d' : '#fafaf9';
  const foreground = dark ? '#f5f5f4' : '#1c1917';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: background }} contentContainerStyle={{ padding: 24, paddingTop: 72, gap: 28 }}>
      <Text style={{ color: foreground, fontSize: 20, fontWeight: '700' }}>Character gallery</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Pressable testID="gallery-theme" onPress={() => setDark(!dark)}>
          <Text style={{ color: foreground }}>Background: {dark ? 'dark' : 'light'}</Text>
        </Pressable>
        <Pressable testID="gallery-pause" onPress={() => setPaused(!paused)}>
          <Text style={{ color: foreground }}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
      </View>
      {CHARACTER_IDS.map((id) => (
        <View key={id} style={{ gap: 8 }}>
          <Text style={{ color: foreground, fontWeight: '600' }}>{CHARACTERS[id].name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            {CHARACTER_MOODS.map((mood) => (
              <View key={mood} style={{ alignItems: 'center', gap: 4 }}>
                <Character characterId={id} mood={mood} size={96} paused={paused} />
                <Text style={{ color: foreground, fontSize: 11 }}>{mood}</Text>
              </View>
            ))}
            <Character characterId={id} mood="idle" size={64} mini paused={paused} />
            <Character characterId={id} mood="thinking" size={20} paused={paused} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
