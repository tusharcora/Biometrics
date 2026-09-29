import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

export interface TrackRecordChartProps {
  series: Array<{ date: string; forecast: number; actual: number }>;
  height?: number;
  actualColor: string;
  forecastColor: string;
}

/** Actual scores as a line, past forecasts as dots, on a shared 0-100 axis. */
export function TrackRecordChart({ series, height = 96, actualColor, forecastColor }: TrackRecordChartProps) {
  const [width, setWidth] = useState(0);
  const x = (i: number) => (series.length <= 1 ? width / 2 : (i / (series.length - 1)) * (width - 8) + 4);
  const y = (v: number) => height - 4 - (v / 100) * (height - 8);
  return (
    <View testID="track-record-chart" style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && series.length > 0 ? (
        <Svg width={width} height={height}>
          <Polyline
            points={series.map((p, i) => `${x(i)},${y(p.actual)}`).join(' ')}
            fill="none"
            stroke={actualColor}
            strokeWidth={2}
          />
          {series.map((p, i) => (
            <Circle key={p.date} cx={x(i)} cy={y(p.forecast)} r={3} fill={forecastColor} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
