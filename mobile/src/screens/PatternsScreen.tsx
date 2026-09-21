import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { fetchHabitConfig, fetchPatterns, type PatternsDTO } from '../api/habits';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { CorrelationCard } from '../components/ui/correlation-card';
import { COLORS } from '../theme';
import { buildNotEnoughDataLine } from '../lib/patternSentence';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: PatternsDTO; labels: Record<string, string> };

function humanize(habitType: string): string {
  return habitType.toLowerCase().replace(/_/g, ' ');
}

// Confirmed patterns only: the server returns nothing that has not held up in
// two consecutive weekly runs, and this screen never invents candidates.
export function PatternsScreen() {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        // Labels are a nicety: the patterns must still show if the config call fails.
        const [data, habitTypes] = await Promise.all([fetchPatterns(), fetchHabitConfig().catch(() => [])]);
        if (cancelled) return;
        const labels: Record<string, string> = {};
        for (const habit of habitTypes) labels[habit.type] = habit.label;
        setState({ status: 'ready', data, labels });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="patterns-loading" className="gap-4 p-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">Patterns are unavailable right now.</Text>
          <Button testID="patterns-retry" variant="ghost" size="sm" onPress={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { data, labels } = state;
  const labelFor = (habitType: string) => labels[habitType] ?? humanize(habitType);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        {data.patterns.map((pattern) => (
          <CorrelationCard
            key={`${pattern.habitType}-${pattern.factor}-${pattern.lagDays}`}
            pattern={pattern}
            habitLabel={labelFor(pattern.habitType)}
          />
        ))}

        {data.patterns.length === 0 ? (
          <Card testID="patterns-empty" className="flex-row items-start gap-3">
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            <View className="flex-1 gap-1">
              <Text className="text-sm font-semibold">No patterns yet</Text>
              <Text className="text-sm text-muted-foreground">
                A pattern only appears once it holds up in two weekly checks in a row, so the earliest you can see one is about two weeks
                after you start logging. Patterns are comparisons within your own data, not medical claims.
              </Text>
            </View>
          </Card>
        ) : null}

        {data.notEnoughData.length > 0 ? (
          <Card className="gap-4">
            <Text className="text-sm font-semibold">Not enough data yet</Text>
            {data.notEnoughData.map((item) => {
              const unexposedShort = item.unexposedDays < item.requiredEach;
              const have = Math.min(unexposedShort ? item.unexposedDays : item.exposedDays, item.requiredEach);
              return (
                <View key={item.habitType} testID={`not-enough-data-${item.habitType}`} className="gap-2">
                  <Text className="text-sm text-muted-foreground">{buildNotEnoughDataLine(item, labelFor(item.habitType))}</Text>
                  <View
                    testID={`not-enough-data-progress-${item.habitType}`}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: item.requiredEach, now: have }}
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <View className="h-full rounded-full bg-accent" style={{ width: `${(have / Math.max(item.requiredEach, 1)) * 100}%` }} />
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
