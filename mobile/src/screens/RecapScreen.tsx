import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { ApiError } from '../api/client';
import { fetchRecap, type Recap } from '../api/recaps';
import { useCharacter } from '../characters/CharacterContext';
import { Character } from '../components/characters/Character';
import { characterInfo } from '../components/characters/registry';
import type { CharacterId } from '../components/characters/types';
import { MilestoneTiles } from '../components/milestones/MilestoneTiles';
import { WeeklyStoryView } from '../components/recap/WeeklyStoryView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { compareChanges, milestoneTiles, monthName } from '../lib/recapCopy';
import { readIncludePrefs } from '../lib/recapPrefs';
import { DESIGN_HEIGHT, DESIGN_WIDTH, previewScale, recapCoachId, resolveIncludes, type Includes } from '../lib/recapShare';
import { changeColor } from '../lib/recapTheme';
import { openRecap } from '../lib/unwatchedRecap';

type State = { phase: 'loading' } | { phase: 'ready'; recap: Recap } | { phase: 'missing' } | { phase: 'error' };

// One recap (spec 2026-10-04 §3): a month (1d) with its milestones and comparison, or a week as its
// story card with the paragraph under it. Reached from the Recaps list, the Home card, the coach
// digest card and a tapped push. Marked opened (its own POST) once it is on screen.
export function RecapScreen() {
  const { params } = useRoute<any>() as { params: { id: string } };
  const navigation = useNavigation<any>();
  const { characterId } = useCharacter();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<State>({ phase: 'loading' });
  // The builder's stored story choices: the week's preview shows what a shared frame would.
  const [storyPrefs, setStoryPrefs] = useState<Partial<Includes> | null>(null);
  // The recap already marked opened: a re-render or refocus never posts again.
  const opened = useRef<string | null>(null);
  // The id this screen shows now. A push tapped while a recap is open re-uses this screen with a
  // new id; an answer for the earlier id that lands late is dropped (T19 ruling).
  const current = useRef(params.id);
  current.current = params.id;

  const load = useCallback(async () => {
    const id = params.id;
    setState({ phase: 'loading' });
    try {
      const recap = await fetchRecap(id);
      if (current.current === id) setState({ phase: 'ready', recap });
    } catch (e) {
      if (current.current !== id) return;
      // 404: gone (coach data deleted) or not this account's (stale push, account switch).
      setState(e instanceof ApiError && e.status === 404 ? { phase: 'missing' } : { phase: 'error' });
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void readIncludePrefs('story').then((stored) => {
      if (!cancelled) setStoryPrefs(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.phase !== 'ready' || opened.current === state.recap.id) return;
    opened.current = state.recap.id;
    // Best effort: the screen never depends on it. Clears the avatar's story ring at once.
    void openRecap(state.recap.id);
  }, [state]);

  // A push can open this screen with nothing behind it; then "back" is home.
  const leave = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'));

  // The line was written in the recap's own coach's voice, so that coach is named (ruling S6).
  const coachId = state.phase === 'ready' ? recapCoachId(state.recap, characterId) : characterId;
  const coachName = characterInfo(coachId).name;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        {state.phase === 'loading' ? <Skeleton testID="recap-loading" className="h-64 w-full rounded-card" /> : null}
        {state.phase === 'missing' ? (
          <View className="gap-3">
            <Card testID="recap-missing">
              <Text className="text-base">This recap isn't available.</Text>
            </Card>
            <Button testID="recap-missing-back" variant="secondary" size="sm" onPress={leave}>
              Go back
            </Button>
          </View>
        ) : null}
        {state.phase === 'error' ? (
          <Card testID="recap-error" className="gap-3">
            <Text className="text-sm text-muted-foreground">Your recap could not be loaded.</Text>
            <Button testID="recap-retry" variant="secondary" size="sm" onPress={() => void load()}>
              Try again
            </Button>
          </Card>
        ) : null}
        {state.phase === 'ready' && state.recap.kind === 'MONTH' ? (
          <MonthBody recap={state.recap} coachId={coachId} coachName={coachName} onShare={() => navigation.navigate('RecapBuilder', { id: state.recap.id, format: 'card' })} />
        ) : null}
        {state.phase === 'ready' && state.recap.kind === 'WEEK' ? (
          <View className="gap-4">
            <Text testID="recap-title" className="font-display text-display-lg">{`Your week with ${coachName}`}</Text>
            {/* The preview opens the full-screen story viewer, like the button under it. */}
            <Pressable
              testID="recap-story-preview"
              accessibilityRole="button"
              accessibilityLabel="View story"
              className="items-center"
              onPress={() => navigation.navigate('RecapStory', { recap: state.recap })}
            >
              {storyPrefs ? (
                <WeeklyStoryView recap={state.recap} coachId={coachId} includes={resolveIncludes('story', storyPrefs, state.recap.stats)} scale={previewScale('story', width - 40, 520)} />
              ) : (
                // Until the stored choices load: no flash of a part switched off.
                <View style={{ width: DESIGN_WIDTH * previewScale('story', width - 40, 520), height: DESIGN_HEIGHT.story * previewScale('story', width - 40, 520) }}>
                  <Skeleton className="h-full w-full rounded-card" />
                </View>
              )}
            </Pressable>
            <Button testID="recap-view-story" variant="secondary" onPress={() => navigation.navigate('RecapStory', { recap: state.recap })}>
              View story
            </Button>
            {state.recap.story ? (
              <Card>
                <Text testID="recap-story-text" className="text-base leading-snug">{state.recap.story}</Text>
              </Card>
            ) : null}
            <Button testID="recap-make-share" onPress={() => navigation.navigate('RecapBuilder', { id: state.recap.id, format: 'story' })}>
              Make a shareable recap
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MonthBody({ recap, coachId, coachName, onShare }: { recap: Recap; coachId: CharacterId; coachName: string; onShare: () => void }) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const rows = compareChanges(recap.stats.comparison);
  return (
    <View className="gap-4">
      <Text testID="recap-title" className="font-display text-display-lg">{`${monthName(recap.periodStart)} with ${coachName}`}</Text>
      <Card className="flex-row items-center gap-3.5">
        <View testID="recap-line-coach">
          <Character characterId={coachId} mood="idle" size={72} />
        </View>
        <Text testID="recap-line" className="flex-1 text-base leading-snug">{`“${recap.line}”`}</Text>
      </Card>
      <View className="gap-2">
        <SectionLabel>Milestones</SectionLabel>
        <MilestoneTiles testID="recap-milestones" tiles={milestoneTiles(recap.stats.milestones)} />
      </View>
      {rows.length > 0 ? (
        <View className="gap-2">
          <SectionLabel>Compared with last month</SectionLabel>
          <Card testID="recap-compare" className="py-1">
            {rows.map((row, i) => (
              <View
                key={row.key}
                testID={`recap-compare-${row.key}`}
                className={i < rows.length - 1 ? 'min-h-11 flex-row items-center justify-between border-b border-border' : 'min-h-11 flex-row items-center justify-between'}
              >
                <Text className="text-base">{row.label}</Text>
                <Text testID={`recap-compare-${row.key}-change`} className="text-base font-semibold" style={{ color: changeColor(row.tone, scheme) }}>
                  {row.text}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
      <Button testID="recap-make-share" onPress={onShare}>
        Make a shareable recap
      </Button>
    </View>
  );
}
