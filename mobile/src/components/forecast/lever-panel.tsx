import { Pressable, View } from 'react-native';
import type { ForecastLeverDTO } from '../../api/forecast';
import { FORECAST_COPY } from '../../lib/forecastCopy';
import type { LeverValues } from '../../lib/forecastGrid';
import { Card } from '../ui/card';
import { Slider } from '../ui/slider';
import { Text } from '../ui/text';

export interface LeverPanelProps {
  levers: ForecastLeverDTO[];
  values: LeverValues;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
}

/** One slider per lever; levers without a CONFIRMED effect are muted and captioned. Controlled. */
export function LeverPanel({ levers, values, onChange, onReset }: LeverPanelProps) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">{FORECAST_COPY.planHeading}</Text>
        <Pressable onPress={onReset} accessibilityRole="button">
          <Text className="text-primary">{FORECAST_COPY.reset}</Text>
        </Pressable>
      </View>
      {levers.map((lever) => {
        const value = lever.key === 'SLEEP' ? values.sleepHours : (values.habits[lever.key] ?? 0);
        const muted = lever.effect !== 'CONFIRMED';
        const tone = muted ? 'text-muted-foreground' : 'text-foreground';
        return (
          <View key={lever.key} className="gap-1">
            <View className="flex-row justify-between">
              <Text className={tone}>{lever.label}</Text>
              <Text className={tone}>{`${value} ${lever.unit}`}</Text>
            </View>
            <Slider
              testID={`lever-${lever.key}`}
              value={value}
              min={lever.min}
              max={lever.max}
              step={lever.step}
              threshold={lever.threshold}
              muted={muted}
              onChange={(v) => onChange(lever.key, v)}
              accessibilityLabel={lever.label}
              formatValue={(v) => `${v} ${lever.unit}`}
            />
            {lever.effect === 'NONE_YET' ? <Text className="text-xs text-muted-foreground">{FORECAST_COPY.noneYet}</Text> : null}
          </View>
        );
      })}
    </Card>
  );
}
