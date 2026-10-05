import React, { useCallback, useEffect, useRef, useState } from 'react';
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

  // Only the latest load, while mounted, may set the card.
  const latest = useRef(0);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    const run = ++latest.current;
    let next: RecapSummary | null = null;
    try {
      const [newest] = await fetchRecaps({ limit: 1 });
      if (newest && newest.openedAt === null && (await readDismissedRecapId()) !== newest.id) next = newest;
    } catch {
      // No card.
    }
    if (mounted.current && run === latest.current) setRecap(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Home stays mounted, so coming back to it reloads the card: a recap opened from Recaps or a
  // push hides it. The first focus (opening Home) is already covered by the load above.
  const blurred = useRef(false);
  useEffect(() => {
    const offBlur = navigation.addListener?.('blur', () => {
      blurred.current = true;
    });
    const offFocus = navigation.addListener?.('focus', () => {
      if (!blurred.current) return;
      blurred.current = false;
      void load();
    });
    return () => {
      offBlur?.();
      offFocus?.();
    };
  }, [navigation, load]);

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
