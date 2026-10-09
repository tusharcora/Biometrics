import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { DailyScoreDTO, ScoreBandsDTO } from '../../api/scores';
import { RECOVERY_COPY } from '../../lib/recoveryCopy';
import { buildScoreVerdict, pickColdStartProgress, scoreBand } from '../../lib/scoreInsights';
import { COLORS } from '../../theme';
import { BaselineProgressRing } from '../ui/baseline-progress-ring';
import { Card } from '../ui/card';
import { ConfidenceBadge } from '../ui/confidence-badge';
import { Glow } from '../ui/glow';
import { PressableScale } from '../ui/pressable-scale';
import { ScoreRing } from '../ui/score-ring';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';

const RING = 216;
const GLOW = 340;

// undefined while loading, null when no score exists yet.
type ScoreState = DailyScoreDTO | null | undefined;

// The one thing Home leads with: today's Recovery Score as a large ring with
// a glow in its band colour, and a one-line verdict under it. The cold-start
// ring and every fallback keep the same testIDs the old score card had.
export function RecoveryHero({
  score,
  bands,
  failed,
  onPress,
}: {
  score: ScoreState;
  bands?: ScoreBandsDTO;
  failed: boolean;
  onPress: (score: DailyScoreDTO) => void;
}) {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;

  if (failed) {
    return (
      <Card testID="recovery-score-unavailable">
        <Text className="text-caption text-muted-foreground">Recovery Score is unavailable right now.</Text>
      </Card>
    );
  }

  if (score === undefined) {
    return <Skeleton testID="recovery-score-loading" className="h-[300px] w-full rounded-card" />;
  }

  if (score === null) {
    return (
      <Card testID="recovery-score-empty">
        <Text className="text-caption text-muted-foreground">Your Recovery Score will appear once it has been calculated.</Text>
      </Card>
    );
  }

  const cold = score.score === null ? pickColdStartProgress(score.coldStart) : null;
  const tone = score.score === null ? colors.accent : colors[scoreBand(score.score, bands)];
  const verdict = buildScoreVerdict(score);

  return (
    <PressableScale
      testID="recovery-score-card"
      accessibilityRole="button"
      accessibilityHint="Opens your Recovery page"
      onPress={() => onPress(score)}
      className="items-center gap-4 pt-2"
    >
      <View style={{ width: RING, height: RING }} className="items-center justify-center">
        <Glow color={tone} size={GLOW} around={RING} />
        {cold ? (
          <BaselineProgressRing daysCollected={cold.daysCollected} daysRequired={cold.daysRequired} size={RING} strokeWidth={14} />
        ) : (
          <ScoreRing
            score={score.score}
            factors={score.factors}
            bands={bands}
            size={RING}
            strokeWidth={16}
            numeralClassName="text-score"
            label="Recovery Score"
          />
        )}
      </View>

      {cold ? (
        <View className="items-center gap-1 px-6">
          <SectionLabel>Recovery Score</SectionLabel>
          <Text className="text-heading text-center">Building your baseline</Text>
        </View>
      ) : (
        <View className="items-center gap-3 px-4">
          {verdict ? <Text className="text-heading text-center">{verdict}</Text> : null}
          <View className="flex-row items-center gap-2">
            <ConfidenceBadge level={score.confidenceLevel} />
            <View className="flex-row items-center gap-0.5">
              <Text className="text-caption font-medium text-muted-foreground">{RECOVERY_COPY.openFromHome}</Text>
              <Ionicons name="chevron-forward" size={12} color={colors.muted} />
            </View>
          </View>
        </View>
      )}
    </PressableScale>
  );
}
