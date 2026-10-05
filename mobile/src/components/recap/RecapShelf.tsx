import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { fetchRecaps, type RecapSummary } from '../../api/recaps';
import { useCharacterOptional } from '../../characters/CharacterContext';
import { todayCivil } from '../../lib/heatmap';
import { shelfItems } from '../../lib/recapShelf';
import { recapCoachId } from '../../lib/recapShare';
import { recapTint, STORY_RING_NEUTRAL, storyRingColor } from '../../lib/recapTheme';
import { recapDestination, useWatchedRecaps } from '../../lib/unwatchedRecap';
import { COLORS, FONTS } from '../../theme';
import { DEFAULT_CHARACTER_ID } from '../characters/types';
import { pixelFont } from '../coach/thinking/shared';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';

const CIRCLE = 64;
/** How many recaps the shelf shows (newest first); "See all" has the rest. */
const SHELF_LIMIT = 30;

interface Navigator {
  navigate: (name: string, params?: object) => void;
  addListener?: (event: 'focus', callback: () => void) => () => void;
}

// The story shelf at the top of Sleep (weekly story placement, design D): "Recaps" with See all,
// then a row of circles, newest first, each on its coach's ground. An unwatched recap wears its
// coach's ring, a watched one a neutral ring. A week plays its story; a month opens its recap.
// Hidden while loading and when there are no recaps (or they could not be loaded).
export function RecapShelf({ navigation }: { navigation: Navigator }) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = COLORS[scheme];
  const characterId = useCharacterOptional()?.characterId ?? DEFAULT_CHARACTER_ID;
  const watched = useWatchedRecaps();
  const [recaps, setRecaps] = useState<RecapSummary[] | null>(null);

  // Only the latest load, while mounted, lands; a failed reload keeps what is shown.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const run = ++latest.current;
    try {
      const next = await fetchRecaps({ limit: SHELF_LIMIT });
      if (run === latest.current) setRecaps(next);
    } catch {
      // Nothing new to show.
    }
  }, []);

  useEffect(() => {
    void load();
    const off = navigation.addListener?.('focus', () => void load());
    return () => {
      latest.current++;
      off?.();
    };
  }, [navigation, load]);

  const items = useMemo(() => shelfItems(recaps ?? [], todayCivil(), watched), [recaps, watched]);
  if (items.length === 0) return null;
  const pixel = pixelFont();

  return (
    <View testID="recap-shelf" className="gap-2.5">
      <View className="flex-row items-baseline justify-between">
        <SectionLabel testID="recap-shelf-title">Recaps</SectionLabel>
        <Pressable testID="recap-shelf-see-all" accessibilityRole="button" accessibilityLabel="See all recaps" hitSlop={8} onPress={() => navigation.navigate('Recaps')} className="active:opacity-70">
          <Text className="text-sm font-semibold text-accent">See all</Text>
        </Pressable>
      </View>
      {/* Bleeds to the screen edges so the row scrolls under the page's padding. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
        {items.map((item) => {
          const coach = recapCoachId(item, characterId);
          const tint = recapTint(coach);
          return (
            <Pressable
              key={item.id}
              testID={`recap-shelf-item-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              onPress={() => {
                const to = recapDestination(item);
                navigation.navigate(to.name, to.params);
              }}
              className="items-center active:opacity-80"
              style={{ gap: 6, width: CIRCLE + 8 }}
            >
              <View
                testID={`recap-shelf-ring-${item.id}`}
                style={{
                  width: CIRCLE,
                  height: CIRCLE,
                  borderRadius: CIRCLE / 2,
                  borderWidth: item.unwatched ? 3 : 2,
                  borderColor: item.unwatched ? storyRingColor(coach, scheme) : STORY_RING_NEUTRAL[scheme],
                  padding: 3,
                }}
              >
                <View
                  testID={`recap-shelf-circle-${item.id}`}
                  style={{ flex: 1, borderRadius: CIRCLE / 2, backgroundColor: tint.ground, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text testID={`recap-shelf-badge-${item.id}`} style={{ fontFamily: pixel, fontSize: 11, lineHeight: 12, color: tint.accentText, textAlign: 'center' }}>
                    {item.badge}
                  </Text>
                </View>
              </View>
              <Text
                testID={`recap-shelf-label-${item.id}`}
                numberOfLines={1}
                style={{ fontSize: 12, fontFamily: item.unwatched ? FONTS.sansSemibold : FONTS.sans, color: item.unwatched ? colors.foreground : colors.muted }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
