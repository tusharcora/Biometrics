import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kip } from '../../components/kip/Kip';
import { Text } from '../../components/ui/text';
import { KIP_MOODS, KIP_POSES, kipPoseFrames, type KipColour } from '../../lib/kip/kipArt';

const COLOURS: KipColour[] = ['coral', 'cobalt', 'lime'];

// Dev only (EXPO_PUBLIC_KIP_GALLERY=1): every pose × mood × the States board's three colours (spec §4). Replaces the
// character gallery. The `type` pose shows frame 0; its loop is checked in the room.
export function KipGalleryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
        {COLOURS.map((colour) => (
          <View key={colour} className="gap-3">
            <Text className="text-heading">{colour}</Text>
            {KIP_POSES.map((pose) => (
              <View key={pose} className="gap-1">
                <Text className="text-caption text-muted-foreground">{`${pose}${kipPoseFrames(pose) > 1 ? ' (3 frames)' : ''}`}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {KIP_MOODS.map((mood) => (
                    <Kip key={mood} testID={`kip-gallery-${colour}-${pose}-${mood}`} colour={colour} pose={pose} mood={mood} scale={3} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
