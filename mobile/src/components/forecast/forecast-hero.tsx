import { View } from 'react-native';
import type { ForecastCellDTO } from '../../api/forecast';
import { FORECAST_COPY } from '../../lib/forecastCopy';
import { Card } from '../ui/card';
import { ConfidenceBadge } from '../ui/confidence-badge';
import { ScoreRing } from '../ui/score-ring';
import { Text } from '../ui/text';

/** The forecast score ring, its band and confidence for one grid cell. */
export function ForecastHero({ cell }: { cell: ForecastCellDTO }) {
  return (
    <Card className="items-center gap-2 py-6">
      <View testID="forecast-score-value" accessibilityLabel={`Forecast ${Math.round(cell.score)}`}>
        <ScoreRing score={cell.score} size={148} strokeWidth={12} />
      </View>
      <Text testID="forecast-band" className="text-muted-foreground">
        {FORECAST_COPY.band(cell.band[0], cell.band[1])}
      </Text>
      <ConfidenceBadge level={cell.confidence} />
    </Card>
  );
}
