import React from 'react';
import { View } from 'react-native';
import type { DailyScoreDTO, ScoreBandsDTO } from '../../api/scores';
import { pickColdStartProgress } from '../../lib/scoreInsights';
import { BaselineProgressRing, baselineLabel } from '../ui/baseline-progress-ring';
import { Card } from '../ui/card';
import { ConfidenceBadge } from '../ui/confidence-badge';
import { PressableScale } from '../ui/pressable-scale';
import { ScoreRing } from '../ui/score-ring';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';

type ScoreState = DailyScoreDTO | null | undefined;

// The Sleep Score as a half-width tile beside Ask Coach. A present score
// always shows its confidence; the cold-start ring is only for a null score,
// and it is too small to hold its own "4/7 days", so that sits beside it.
export function SleepTile({
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
  if (failed) {
    return (
      <Card testID="sleep-score-unavailable" className="flex-1">
        <Text className="text-sm text-muted-foreground">Sleep Score is unavailable right now.</Text>
      </Card>
    );
  }

  if (score === undefined) {
    return <Skeleton testID="sleep-score-loading" className="h-[132px] flex-1 rounded-card" />;
  }

  if (score === null) {
    return (
      <Card testID="sleep-score-empty" className="flex-1">
        <Text className="text-sm text-muted-foreground">Your Sleep Score will appear once a night of sleep has been recorded.</Text>
      </Card>
    );
  }

  const cold = score.score === null ? pickColdStartProgress(score.coldStart) : null;

  return (
    <PressableScale testID="sleep-score-card" accessibilityRole="button" onPress={() => onPress(score)} className="flex-1">
      <Card className="flex-1 gap-3">
        <View className="flex-row items-center gap-3">
          {cold ? (
            <BaselineProgressRing
              daysCollected={cold.daysCollected}
              daysRequired={cold.daysRequired}
              size={52}
              strokeWidth={6}
              showLabel={false}
            />
          ) : (
            <ScoreRing score={score.score} factors={score.factors} bands={bands} size={52} strokeWidth={6} numeralClassName="text-base" />
          )}
          <View className="flex-1 gap-0.5">
            <SectionLabel>Sleep Score</SectionLabel>
            {cold ? <Text className="text-sm font-semibold">{baselineLabel(cold.daysCollected, cold.daysRequired)}</Text> : null}
          </View>
        </View>
        {score.score !== null ? (
          <ConfidenceBadge level={score.confidenceLevel} />
        ) : (
          <Text className="text-xs text-muted-foreground">Building your baseline</Text>
        )}
      </Card>
    </PressableScale>
  );
}
