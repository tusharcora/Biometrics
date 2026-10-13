// "2026 so far" year grid (board A-2): a square per day from 1 January through today in week columns,
// coloured like the calendar, today outlined, months labelled underneath. Drawn as one image; the
// calendar's Year and YTD views are where a day can be opened.

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { ACTIVITY_COPY } from '../../lib/activityCopy';
import { heatLevel, monthLabels, sleepHeatLevel, viewRange, weekColumnsGrid, type HeatLevel, type ValuesByDate } from '../../lib/heatmap';
import { COLORS } from '../../theme';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';

type Palette = (typeof COLORS)['dark'];
const GAP = 2;
const MAX_BIN = 12;
const LABEL_HEIGHT = 14;

function fillFor(level: HeatLevel | null, metric: 'steps' | 'sleep', p: Palette): string {
  if (level === null) return p.heatEmpty;
  const ramp = metric === 'steps' ? [p.heat0, p.heat1, p.heat2, p.heat3, p.heat4] : [p.heat0, p.sleepHeat1, p.sleepHeat2, p.sleepHeat3, p.sleepHeat4];
  return ramp[level]!;
}

export function YearGrid({ metric, values, today, goal }: {
  metric: 'steps' | 'sleep';
  /** null while the metric loads. */
  values: ValuesByDate | null;
  today: string;
  goal: number;
}) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const [width, setWidth] = useState(0);
  const grid = useMemo(
    () => (values ? weekColumnsGrid(viewRange('ytd', today, today).start, today, values, goal, metric === 'steps' ? heatLevel : sleepHeatLevel) : null),
    [values, today, goal, metric],
  );
  const labels = useMemo(() => (grid ? monthLabels(grid) : []), [grid]);
  const bin = grid && width > 0 ? Math.min(MAX_BIN, Math.floor(width / grid.cols)) : 0;
  const side = bin - GAP;
  const todayCell = grid?.cells[grid.cells.length - 1];

  return (
    <Card testID="year-grid-card" className="gap-2 p-3">
      <SectionLabel>{ACTIVITY_COPY.year.gridTitle(today.slice(0, 4), metric)}</SectionLabel>
      {!grid ? (
        <Skeleton testID="year-grid-loading" className="h-24 w-full rounded-tile" />
      ) : (
        <View testID="year-grid" accessible accessibilityRole="image" accessibilityLabel={ACTIVITY_COPY.year.gridLabel(metric, today)}>
          <View testID="year-grid-canvas" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: bin * grid.rows }}>
            {bin > GAP ? (
              <Svg width={bin * grid.cols} height={bin * grid.rows}>
                {grid.cells.map((c) => (
                  <Rect key={c.date} x={c.col * bin} y={c.row * bin} width={side} height={side} fill={fillFor(c.level, metric, palette)} />
                ))}
                {todayCell ? (
                  <Rect x={todayCell.col * bin - 0.5} y={todayCell.row * bin - 0.5} width={side + 1} height={side + 1} fill="none" stroke={palette.foreground} strokeWidth={1} />
                ) : null}
              </Svg>
            ) : null}
          </View>
          <View testID="year-grid-months" style={{ height: LABEL_HEIGHT }}>
            {labels.map((l) => (
              <Text key={l.col} className="text-fine text-muted-foreground" style={{ position: 'absolute', left: l.col * bin, top: 0 }}>
                {l.label}
              </Text>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}
