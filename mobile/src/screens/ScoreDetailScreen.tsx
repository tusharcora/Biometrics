import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import {
  buildBaselineSentence,
  buildScoreHeadline,
  metricName,
  pickColdStartProgress,
  scoreTypeLabel,
  sortFactorsByImpact,
} from '../lib/scoreInsights';
import type { RootStackParamList } from '../navigation/RootNavigator';

type ScoreDetailRoute = RouteProp<RootStackParamList, 'ScoreDetail'>;

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; detail: ScoreDetailDTO };

// Renders the Stat Engine's intermediate outputs directly, in pipeline order
// (spec 6): ring -> confidence -> headline -> factor breakdown -> baselines.
// Nothing here calls a model; the headline is derived from the score itself.
export function ScoreDetailScreen() {
  const route = useRoute<ScoreDetailRoute>();
  const navigation = useNavigation<any>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const { date, type } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

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
        <View testID="score-detail-loading" className="items-center gap-4 p-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
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

  const { score, baselines } = detail;
  const cold = pickColdStartProgress(score.coldStart);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16 }}>
        <View className="items-center gap-3">
          {score.score === null && cold ? (
            <BaselineProgressRing daysCollected={cold.daysCollected} daysRequired={cold.daysRequired} size={120} strokeWidth={10} />
          ) : (
            <ScoreRing score={score.score} factors={score.factors} size={120} strokeWidth={10} />
          )}
          <ConfidenceBadge level={score.confidenceLevel} />
        </View>

        <Card className="flex-row items-start gap-3">
          <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
          <Text testID="score-headline" className="flex-1 text-sm text-muted-foreground">
            {buildScoreHeadline(score)}
          </Text>
        </Card>

        {factors.length > 0 ? (
          <Card className="gap-4">
            <Text className="text-sm font-semibold">What moved your score</Text>
            {factors.map((factor) => (
              <FactorBar key={factor.factor} factor={factor} scale={scale} />
            ))}
          </Card>
        ) : null}

        {score.score !== null && score.coldStart.length > 0 ? (
          <Card className="gap-1">
            <Text className="text-sm font-semibold">Still building</Text>
            {score.coldStart.map((entry) => (
              <Text key={entry.metric} className="text-sm text-muted-foreground">
                {`${entry.daysCollected}/${entry.daysRequired} days of ${metricName(entry.metric)}`}
              </Text>
            ))}
          </Card>
        ) : null}

        {baselines.length > 0 ? (
          <Card className="gap-2">
            <Text className="text-sm font-semibold">Baselines used</Text>
            {baselines.map((baseline) => (
              <Text key={baseline.metric} className="text-sm text-muted-foreground">
                {buildBaselineSentence(baseline)}
              </Text>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
