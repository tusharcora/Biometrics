import React, { useEffect, useState } from 'react';
import { View, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { CoachConsentRequiredError, CoachDisabledError, fetchLatestDigest, type CoachDigestDTO } from '../api/coach';
import { COLORS } from '../theme';
import { Text } from './ui/text';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

type State = { status: 'loading' } | { status: 'hidden' } | { status: 'error' } | { status: 'ready'; digest: CoachDigestDTO };

function formatDigestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The latest weekly recap from the coach. The caller only mounts this when the
// coach is enabled and consented; it renders nothing at all when there is no
// digest, so a quiet week leaves no empty card.
export function CoachDigestCard() {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const digest = await fetchLatestDigest();
        if (!cancelled) setState(digest ? { status: 'ready', digest } : { status: 'hidden' });
      } catch (e) {
        if (cancelled) return;
        // The server saying the coach is off is not a failure worth showing.
        setState(e instanceof CoachDisabledError || e instanceof CoachConsentRequiredError ? { status: 'hidden' } : { status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'hidden') return null;

  if (state.status === 'loading') {
    return <Skeleton testID="coach-digest-loading" className="h-24 w-full" />;
  }

  if (state.status === 'error') {
    return (
      <Card testID="coach-digest-error">
        <Text className="text-sm text-muted-foreground">Your weekly recap is unavailable right now.</Text>
      </Card>
    );
  }

  const { digest } = state;

  return (
    <>
      <Pressable testID="coach-digest-card" accessibilityRole="button" onPress={() => setOpen(true)} className="active:opacity-80">
        <Card className="gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="newspaper-outline" size={18} color={colors.accent} />
            <Text className="flex-1 text-base font-semibold">Your weekly recap</Text>
            <Text testID="coach-digest-date" className="text-xs text-muted-foreground">
              {formatDigestDate(digest.createdAt)}
            </Text>
          </View>
          <Text testID="coach-digest-preview" numberOfLines={3} className="text-sm text-muted-foreground">
            {digest.text}
          </Text>
          <Text className="text-xs text-muted-foreground">Tap to read it all</Text>
        </Card>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-background">
          <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold">Your weekly recap</Text>
              <Text className="text-xs text-muted-foreground">{formatDigestDate(digest.createdAt)}</Text>
            </View>
            <Text testID="coach-digest-full" className="text-base">
              {digest.text}
            </Text>
          </ScrollView>
          <View className="items-center p-2">
            <Button testID="coach-digest-close" variant="ghost" onPress={() => setOpen(false)}>
              Close
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
