import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { fetchScoreDetail, type ScoreDetailDTO } from '../api/scores';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { ScoreRing } from '../components/ui/score-ring';
import { BaselineProgressRing } from '../components/ui/baseline-progress-ring';
import { ConfidenceBadge } from '../components/ui/confidence-badge';
import { FactorBar, factorBarScale } from '../components/ui/factor-bar';
import { COLORS } from '../theme';
import { withAlpha } from '../lib/utils';
import { Glow } from '../components/ui/glow';
import { GlassSurface } from '../components/ui/glass-surface';
import { PressableScale } from '../components/ui/pressable-scale';
import { SectionLabel } from '../components/ui/section-label';
import { StillOrb } from '../components/ui/still-orb';
import { coachEntryRoute, useCoachStatus } from '../lib/useCoachStatus';
import { navigateToCoachEntry } from '../navigation/coachNavigation';
import { scoreQuestion } from '../lib/coachPrompts';
import {
  buildBaselineSentence,
  buildScoreHeadline,
  buildScoreVerdict,
  metricName,
  pickColdStartProgress,
  scoreBand,
  type ScoreBand,
  scoreTypeLabel,
  sortFactorsByImpact,
} from '../lib/scoreInsights';
import type { RootStackParamList } from '../navigation/RootNavigator';

type ScoreDetailRoute = RouteProp<RootStackParamList, 'ScoreDetail'>;

const RING = 216;
const GLOW = 300;

const BAND_LABEL: Record<ScoreBand, string> = {
  scoreExcellent: 'Excellent',
  scoreGood: 'Good',
  scoreFair: 'Fair',
  scorePoor: 'Low',
};

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; detail: ScoreDetailDTO };

// Renders the Stat Engine's intermediate outputs directly, in pipeline order
// (spec 6): ring -> confidence -> headline -> factor breakdown -> baselines.
// Nothing here calls a model; the headline is derived from the score itself.
export function ScoreDetailScreen() {
  const route = useRoute<ScoreDetailRoute>();
  const navigation = useNavigation<any>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const { date, type = 'RECOVERY' } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const { status: coachStatus } = useCoachStatus(navigation);
  const coachRoute = coachEntryRoute(coachStatus);
  // Context, not the hook: tests render this screen without a provider.
  const insets = useContext(SafeAreaInsetsContext);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: scoreTypeLabel(type) });
  }, [navigation, type]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const detail = await fetchScoreDetail(date, type);
        if (cancelled) return;
        setState(detail ? { status: 'ready', detail } : { status: 'empty' });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, type]);

  const detail = state.status === 'ready' ? state.detail : null;
  const factors = useMemo(() => (detail ? sortFactorsByImpact(detail.score.factors) : []), [detail]);
  const scale = useMemo(() => factorBarScale(factors), [factors]);

  if (state.status === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View testID="score-detail-loading" className="items-center gap-5 px-5 pt-6">
          <Skeleton className="h-[216px] w-[216px] rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">Something went wrong loading this score.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'empty' || !detail) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-muted-foreground">No score for this day yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { score } = detail;
  // The duration factor is scored against the user's sleep goal, so a SLEEP
  // baseline is never listed as something the Sleep Score was compared to.
  const baselines = score.type === 'SLEEP' ? detail.baselines.filter((b) => b.metric !== 'SLEEP') : detail.baselines;
  const cold = pickColdStartProgress(score.coldStart);
  const band = score.score !== null ? scoreBand(score.score, detail.bands) : null;
  const tone = band ? colors[band] : colors.accent;
  const verdict = buildScoreVerdict(score);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 24, paddingHorizontal: 20, paddingTop: 48, paddingBottom: coachRoute ? 120 : 32 }}>
        <View className="items-center gap-4">
          <View style={{ width: RING, height: RING }} className="items-center justify-center">
            <Glow color={tone} size={GLOW} around={RING} />
            {score.score === null && cold ? (
              <BaselineProgressRing daysCollected={cold.daysCollected} daysRequired={cold.daysRequired} size={RING} strokeWidth={14} />
            ) : (
              <ScoreRing
                score={score.score}
                factors={score.factors}
                size={RING}
                strokeWidth={16}
                bands={detail.bands}
                numeralClassName="text-numeral-xl"
                label={formatScoreDate(score.date)}
              />
            )}
          </View>
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <ConfidenceBadge level={score.confidenceLevel} />
            {band ? (
              <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: withAlpha(tone, 0.14) }}>
                <Text className="text-xs font-medium" style={{ color: tone }}>
                  {BAND_LABEL[band]}
                </Text>
              </View>
            ) : null}
          </View>
          <View className="gap-2 px-2">
            {verdict ? <Text className="font-display text-display text-center">{verdict}</Text> : null}
            <Text testID="score-headline" className="text-center text-sm leading-5 text-muted-foreground">
              {buildScoreHeadline(score)}
            </Text>
          </View>
        </View>

        {factors.length > 0 ? (
          <View className="gap-2">
            <SectionLabel className="px-1">What moved it</SectionLabel>
            <Card className="gap-5 py-5">
              {factors.map((factor) => (
                <FactorBar key={factor.factor} factor={factor} scale={scale} />
              ))}
            </Card>
          </View>
        ) : null}

        {score.score !== null && score.coldStart.length > 0 ? (
          <View className="gap-2">
            <SectionLabel className="px-1">Still building</SectionLabel>
            <Card className="gap-2">
              {score.coldStart.map((entry) => (
                <View key={entry.metric} className="flex-row items-center gap-3">
                  <BaselineProgressRing daysCollected={entry.daysCollected} daysRequired={entry.daysRequired} size={28} strokeWidth={4} showLabel={false} />
                  <Text className="flex-1 text-sm">{`${entry.daysCollected}/${entry.daysRequired} days of ${metricName(entry.metric)}`}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {baselines.length > 0 ? (
          <View className="gap-2">
            <SectionLabel className="px-1">Baselines used</SectionLabel>
            <View className="overflow-hidden rounded-card border border-border bg-card">
              {baselines.map((baseline, i) => (
                <Text key={baseline.metric} className={`px-4 py-3.5 text-sm ${i > 0 ? 'border-t border-border' : ''}`}>
                  {buildBaselineSentence(baseline)}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {coachRoute ? (
        <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: Math.max(insets?.bottom ?? 0, 16) }} pointerEvents="box-none">
          <PressableScale
            testID="ask-coach-button"
            accessibilityRole="button"
            onPress={() => navigateToCoachEntry(navigation, coachRoute, scoreQuestion(score.type))}
          >
            <GlassSurface
              scheme={scheme === 'light' ? 'light' : 'dark'}
              fallbackColor={colors.surfaceRaised}
              borderRadius={30}
              style={{ height: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.hairline }}
            >
              <StillOrb size={40} glow={false} />
              <Text className="flex-1 text-base font-semibold">Ask Coach about this</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ marginRight: 8 }} />
            </GlassSurface>
          </PressableScale>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// "Tue, Sep 29" from the score's civil date, without a timezone shift.
export function formatScoreDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
