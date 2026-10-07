// The camp banner (spec 2026-10-07 social §4, item 1; plan ruling for S1): "THE CAMP" + "{n} checked in" and up to
// two coach faces of buddies who checked in today. Static in S1 — S2 makes it open the Campfire page.

import React from 'react';
import { View } from 'react-native';
import { Character } from '../characters/Character';
import { DEFAULT_CHARACTER_ID, isCharacterId } from '../characters/types';
import { pixelFont } from '../coach/thinking/shared';
import { Text } from '../ui/text';

export function CampBanner({ checkedIn, faces }: { checkedIn: number; faces: string[] }) {
  return (
    <View testID="camp-banner" accessibilityRole="summary" accessibilityLabel={`The camp, ${checkedIn} checked in`}
      className="h-[74px] flex-row items-center gap-3 overflow-hidden rounded-tile bg-[#0F1230] px-4">
      <View className="h-8 w-8 items-center justify-center">
        <View style={{ width: 8, height: 8, backgroundColor: '#FDE68A' }} />
        <View style={{ width: 16, height: 8, backgroundColor: '#FB923C' }} />
        <View style={{ width: 24, height: 6, backgroundColor: '#78350F' }} />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] text-[#A5B4FC]" style={{ fontFamily: pixelFont() }}>THE CAMP</Text>
        <Text className="text-sm font-semibold text-white">{checkedIn} checked in</Text>
      </View>
      <View className="flex-row">
        {faces.slice(0, 2).map((coachId, index) => (
          // The second face tucks under the first.
          <View key={index} testID={`camp-face-${index}`} style={index > 0 ? { marginLeft: -6 } : undefined}
            className="h-9 w-9 items-center justify-center rounded-full bg-[#1B2048]">
            <Character characterId={isCharacterId(coachId) ? coachId : DEFAULT_CHARACTER_ID} mood="idle" size={26} paused />
          </View>
        ))}
      </View>
    </View>
  );
}
