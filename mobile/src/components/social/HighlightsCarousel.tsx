// Week highlights carousel (spec 2026-10-07 social §7, design V5): "Week {n} highlights", the top story large, the
// rest small, kickers colour-coded by type (top story indigo, most cheered amber, comeback green, others muted);
// "All" → Highlights. Types this app doesn't know are skipped; with none left the carousel renders nothing.

import React from 'react';
import { ScrollView, View } from 'react-native';
import type { Highlights } from '../../api/social';
import { highlightKicker, highlightKickerColor, highlightLine, highlightsTitle, knownHighlights } from '../../lib/socialCopy';
import { PressableScale } from '../ui/pressable-scale';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';

export function HighlightsCarousel({ highlights, onOpenAll }: { highlights: Highlights; onOpenAll: () => void }) {
  const items = knownHighlights(highlights.items);
  if (items.length === 0) return null;
  return (
    <View testID="highlights-carousel" className="gap-3">
      <View className="flex-row items-center justify-between">
        <View testID="highlights-title"><SectionLabel>{highlightsTitle(highlights.weekStart)}</SectionLabel></View>
        <PressableScale testID="highlights-all" accessibilityRole="link" onPress={onOpenAll}>
          <Text className="text-sm font-semibold text-accent">All</Text>
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {items.map((item, index) => {
          const color = highlightKickerColor(item);
          return (
            <View key={index} testID={`highlight-${index}`} className={`gap-1 rounded-tile border p-3 ${index === 0 ? 'w-56 border-coach bg-coach/20' : 'w-40 border-border bg-card'}`}>
              <Text testID={`highlight-${index}-kicker`} className={`text-[10px] font-semibold uppercase tracking-widest ${color ? '' : 'text-muted-foreground'}`}
                style={color ? { color } : undefined}>
                {highlightKicker(item)}
              </Text>
              <Text className={index === 0 ? 'font-display text-display-sm' : 'text-sm font-semibold'}>{highlightLine(item)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
