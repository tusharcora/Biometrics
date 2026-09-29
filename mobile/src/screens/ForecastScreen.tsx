import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { ReadyForecastDTO } from '../api/forecast';
import { ContributionBars } from '../components/forecast/contribution-bars';
import { ForecastHero } from '../components/forecast/forecast-hero';
import { LeverPanel } from '../components/forecast/lever-panel';
import { TrackRecordChart } from '../components/forecast/track-record-chart';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { FORECAST_COPY } from '../lib/forecastCopy';
import { contributionLabel, findCell, type LeverValues } from '../lib/forecastGrid';
import { useForecast } from '../lib/useForecast';
import { COLORS } from '../theme';

export function ForecastScreen() {
  const state = useForecast();

  if (state.status === 'error') {
    return (
      <Card testID="forecast-error" className="m-4">
        <Text>{FORECAST_COPY.loadError}</Text>
      </Card>
    );
  }
  if (state.status === 'loading') return <Skeleton testID="forecast-loading" className="m-4 h-64" />;
  const { forecast } = state;
  if (forecast.status === 'NOT_ENOUGH_DATA') {
    return (
      <Card className="m-4">
        <Text>
          {forecast.reason === 'NO_HISTORY' ? FORECAST_COPY.unlocksAfter(forecast.daysOfHistory) : FORECAST_COPY.lowConfidence}
        </Text>
      </Card>
    );
  }
  return <ReadyForecast forecast={forecast} />;
}

function ReadyForecast({ forecast }: { forecast: ReadyForecastDTO }) {
  const [values, setValues] = useState<LeverValues>(forecast.defaults);
  const cell = useMemo(() => findCell(forecast, values), [forecast, values]);
  const { withinPoints, hits, days, series } = forecast.trackRecord;
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  const setLever = (key: string, v: number) =>
    setValues((prev) => (key === 'SLEEP' ? { ...prev, sleepHours: v } : { ...prev, habits: { ...prev.habits, [key]: v } }));

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <ForecastHero cell={cell} />
      <LeverPanel levers={forecast.levers} values={values} onChange={setLever} onReset={() => setValues(forecast.defaults)} />

      <Card className="gap-3">
        <Text className="text-base font-semibold">{FORECAST_COPY.whyHeading}</Text>
        <Text className="text-xs text-muted-foreground">{FORECAST_COPY.effectOrder}</Text>
        <ContributionBars
          items={cell.contributions.map((c) => ({ key: c.key, points: c.points, label: contributionLabel(c.key, forecast, values) }))}
        />
      </Card>

      <Card className="gap-2">
        <Text className="text-base font-semibold">{FORECAST_COPY.trackRecordHeading}</Text>
        <TrackRecordChart series={series} actualColor={colors.muted} forecastColor={colors.accent} />
        <Text className="text-sm text-muted-foreground">{FORECAST_COPY.trackRecord(withinPoints, hits, days)}</Text>
      </Card>

      <Text className="text-center text-xs text-muted-foreground">{FORECAST_COPY.disclaimer}</Text>
    </ScrollView>
  );
}
