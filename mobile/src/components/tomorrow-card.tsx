import { Pressable, View } from 'react-native';
import { FORECAST_COPY, FORECAST_MIN_DAYS } from '../lib/forecastCopy';
import { findCell } from '../lib/forecastGrid';
import type { ForecastState } from '../lib/useForecast';
import { BaselineProgressRing } from './ui/baseline-progress-ring';
import { Card } from './ui/card';
import { ConfidenceBadge } from './ui/confidence-badge';
import { ScoreRing } from './ui/score-ring';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

/** Dashboard summary of tomorrow's default forecast. Presentational: the screen owns loading. */
export function TomorrowCard({ state, onPress }: { state: ForecastState; onPress: () => void }) {
  if (state.status === 'error') {
    return (
      <Card testID="tomorrow-unavailable">
        <Text className="text-muted-foreground">{FORECAST_COPY.unavailable}</Text>
      </Card>
    );
  }
  if (state.status === 'loading') return <Skeleton testID="tomorrow-loading" className="h-28 w-full" />;
  const { forecast } = state;
  if (forecast.status === 'NOT_ENOUGH_DATA') {
    return (
      <Card testID="tomorrow-locked" className="flex-row items-center gap-4">
        <BaselineProgressRing daysCollected={Math.min(forecast.daysOfHistory, FORECAST_MIN_DAYS)} daysRequired={FORECAST_MIN_DAYS} />
        <Text className="flex-1 text-muted-foreground">
          {forecast.reason === 'NO_HISTORY' ? FORECAST_COPY.unlocksAfter(forecast.daysOfHistory) : FORECAST_COPY.lowConfidence}
        </Text>
      </Card>
    );
  }
  const cell = findCell(forecast, forecast.defaults);
  return (
    <Pressable testID="tomorrow-card" onPress={onPress} accessibilityRole="button">
      <Card className="flex-row items-center gap-4">
        <ScoreRing score={cell.score} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold">{FORECAST_COPY.title}</Text>
          <Text className="text-muted-foreground">{FORECAST_COPY.band(cell.band[0], cell.band[1])}</Text>
          <ConfidenceBadge level={cell.confidence} />
          <Text className="text-sm font-semibold text-accent">{FORECAST_COPY.planCta}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
