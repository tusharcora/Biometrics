import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { YearPixelsView } from '../components/recap/YearPixelsView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { todayCivil } from '../lib/heatmap';
import { useMyKipColour } from '../lib/kip/myKipColour';
import { DESIGN_WIDTH } from '../lib/recapShare';
import { loadYearInPixels, type YearInPixels } from '../lib/yearPixels';

type State = { phase: 'loading' } | ({ phase: 'ready' } & YearInPixels) | { phase: 'error' };

// Year in pixels (spec 2026-10-04 §1b): drawn on the phone from GET /me/sleep for this calendar
// year (nights keyed by the local date they ended on), against the CURRENT goal (and it says so)
// with your KIP, tinted by its colour like its share image (recap restyle; KIP Coach §7.7).
export function YearInPixelsScreen() {
  const navigation = useNavigation<any>();
  const mine = useMyKipColour();
  const { width } = useWindowDimensions();
  // The user's local civil date, so tonight's square is never drawn as a past night.
  const today = todayCivil();
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'ready', ...(await loadYearInPixels(today)) });
    } catch {
      setState({ phase: 'error' });
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20, alignItems: 'center' }}>
        {state.phase === 'loading' ? <Skeleton className="h-80 w-full rounded-card" /> : null}
        {state.phase === 'error' ? (
          <Card testID="year-error" className="w-full gap-3">
            <Text className="text-caption text-muted-foreground">Your year could not be loaded.</Text>
            <Button testID="year-retry" variant="secondary" size="sm" className="self-start" onPress={() => void load()}>
              Try again
            </Button>
          </Card>
        ) : null}
        {state.phase === 'ready' ? (
          <>
            <YearPixelsView
              year={state.year}
              pixels={state.pixels}
              goalMinutes={state.goalMinutes}
              kipColour={mine}
              includes={{ count: true, coach: true }}
              scale={(width - 40) / DESIGN_WIDTH}
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
