import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { fetchRecaps, type RecapSummary } from '../../api/recaps';
import { readDismissedRecapId, writeDismissedRecapId } from '../../lib/recapCardDismissal';
import { readyCardTitle } from '../../lib/recapCopy';
import { COLORS } from '../../theme';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';

// Home's "Your {Month} recap is ready" / "Your week is ready" card (spec 2026-10-04 §3): shown
// while the newest recap is unopened and not dismissed. Optional: any failure renders nothing.
export function RecapReadyCard() {
  const navigation = useNavigation<any>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [recap, setRecap] = useState<RecapSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [newest] = await fetchRecaps({ limit: 1 });
        if (!newest || newest.openedAt !== null) return;
        if ((await readDismissedRecapId()) === newest.id) return;
        if (!cancelled) setRecap(newest);
      } catch {
        // No card.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!recap) return null;

  return (
    <Card testID="recap-ready-card" className="flex-row items-center gap-3 border-coach/25 bg-coach/10">
      <Pressable
        testID="recap-ready-open"
        accessibilityRole="button"
        className="flex-1 gap-1 active:opacity-80"
        onPress={() => {
          setRecap(null);
          navigation.navigate('Recap', { id: recap.id });
        }}
      >
        <SectionLabel className="text-coach">Recap</SectionLabel>
        <Text className="font-display text-display-sm">{readyCardTitle(recap)}</Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={2}>
          {recap.line}
        </Text>
      </Pressable>
      <Pressable
        testID="recap-ready-dismiss"
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={12}
        onPress={() => {
          void writeDismissedRecapId(recap.id);
          setRecap(null);
        }}
      >
        <Ionicons name="close" size={18} color={colors.muted} />
      </Pressable>
    </Card>
  );
}
