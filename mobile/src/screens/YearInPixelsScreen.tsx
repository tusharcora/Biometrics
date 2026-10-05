import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { fetchSleep, fetchSleepGoal } from '../api/sleep';
import { useCharacter } from '../characters/CharacterContext';
import { YearPixelsView } from '../components/recap/YearPixelsView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { todayCivil } from '../lib/heatmap';
import { DESIGN_WIDTH } from '../lib/recapShare';
import { yearPixels, type YearPixels } from '../lib/yearPixels';

type State = { phase: 'loading' } | { phase: 'ready'; pixels: YearPixels; goal: number } | { phase: 'error' };

// Year in pixels (spec 2026-10-04 §1b): drawn on the phone from GET /me/sleep for this calendar
// year (nights keyed by the local date they ended on), against the CURRENT goal (and it says so)
// with the CURRENT coach. In-app it follows light/dark; its share image is always dark.
export function YearInPixelsScreen() {
  const navigation = useNavigation<any>();
  const { characterId } = useCharacter();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  // The user's local civil date, so tonight's square is never drawn as a past night.
  const today = todayCivil();
  const year = Number(today.slice(0, 4));
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const [sleep, goal] = await Promise.all([fetchSleep(`${year}-01-01`, `${year}-12-31`), fetchSleepGoal()]);
      setState({ phase: 'ready', pixels: yearPixels(year, sleep.nights, goal.sleepGoalMinutes, today), goal: goal.sleepGoalMinutes });
    } catch {
      setState({ phase: 'error' });
    }
  }, [year, today]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20, alignItems: 'center' }}>
        {state.phase === 'loading' ? <Skeleton className="h-80 w-full rounded-card" /> : null}
        {state.phase === 'error' ? (
          <Card testID="year-error" className="w-full gap-3">
            <Text className="text-sm text-muted-foreground">Your year could not be loaded.</Text>
            <Button testID="year-retry" variant="secondary" size="sm" onPress={() => void load()}>
              Try again
            </Button>
          </Card>
        ) : null}
        {state.phase === 'ready' ? (
          <>
            <YearPixelsView
              year={year}
              pixels={state.pixels}
              goalMinutes={state.goal}
              coachId={characterId}
              includes={{ count: true, coach: true }}
              scale={(width - 40) / DESIGN_WIDTH}
              palette={colorScheme === 'dark' ? 'dark' : 'light'}
            />
            <Button testID="year-share" onPress={() => navigation.navigate('RecapBuilder', { format: 'year' })}>
              Make a shareable image
            </Button>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
