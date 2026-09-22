import React, { memo, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { COLORS, METRIC_CONFIG, MOTION } from '../theme';
import {
  cellAt,
  compareToAverage,
  formatDayTitle,
  formatShortDate,
  gridGeometry,
  historyNote,
  monthGrid,
  monthLabels,
  monthStart,
  monthTitle,
  rangeStats,
  shiftMonth,
  viewRange,
  weekColumnsGrid,
  yearStart,
  type HeatCell,
  type HeatGrid,
  type HeatLevel,
  type HeatmapView,
  type StepsByDate,
} from '../lib/heatmap';
import { Card } from './ui/card';
import { SegmentedControl } from './ui/segmented-control';
import { Sheet } from './ui/sheet';
import { Text } from './ui/text';

const VIEW_OPTIONS: { value: HeatmapView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'ytd', label: 'YTD' },
];

// Month is a roomy calendar of circles; Year/YTD are compact week columns of
// rects that scroll sideways when a year does not fit the screen.
const MONTH_GEOMETRY = { minBin: 28, maxBin: 52, gap: 6 };
const WEEKS_GEOMETRY = { minBin: 13, maxBin: 20, gap: 3 };
// Cells re-reveal in groups of columns (rows, for a month) rather than one by
// one, so a year does not schedule 371 separate animations.
const WEEK_COLUMNS_PER_GROUP = 8;
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL_HEIGHT = 16;

type Palette = (typeof COLORS)['dark'];

function levelColor(level: HeatLevel | null, palette: Palette): string {
  if (level === null) return palette.heatEmpty;
  return [palette.heat0, palette.heat1, palette.heat2, palette.heat3, palette.heat4][level];
}

const formatSteps = METRIC_CONFIG.STEPS.format;

interface CellGroupProps {
  cells: HeatCell[];
  shape: 'circle' | 'rect';
  bin: number;
  gap: number;
  width: number;
  height: number;
  palette: Palette;
  selectedDate: string | null;
}

// One Svg layer per reveal group; memoised so opening the day sheet (which
// only changes the selection) does not redraw every other group.
const CellGroup = memo(function CellGroup({ cells, shape, bin, gap, width, height, palette, selectedDate }: CellGroupProps) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {cells.map((c) => {
        const fill = levelColor(c.level, palette);
        const selected = c.date === selectedDate;
        if (shape === 'circle') {
          // The tapped day grows to fill its bin while its sheet is open.
          const r = selected ? bin / 2 - gap / 4 : bin / 2 - gap / 2;
          return (
            <Circle
              key={c.date}
              cx={c.col * bin + bin / 2}
              cy={c.row * bin + bin / 2}
              r={r}
              fill={fill}
              stroke={selected ? palette.foreground : c.level === null ? palette.hairline : undefined}
              strokeWidth={selected ? 2 : 1}
            />
          );
        }
        return (
          <Rect
            key={c.date}
            x={c.col * bin + gap / 2}
            y={c.row * bin + gap / 2}
            width={bin - gap}
            height={bin - gap}
            rx={2}
            fill={fill}
            stroke={selected ? palette.foreground : undefined}
            strokeWidth={selected ? 1.5 : 0}
          />
        );
      })}
    </Svg>
  );
});

function groupCells(grid: HeatGrid, view: HeatmapView): HeatCell[][] {
  const groups: HeatCell[][] = [];
  for (const c of grid.cells) {
    const g = view === 'month' ? c.row : Math.floor(c.col / WEEK_COLUMNS_PER_GROUP);
    (groups[g] ??= []).push(c);
  }
  return groups.filter(Boolean);
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View className="w-[31%] grow gap-0.5 rounded-xl bg-muted px-3 py-2.5">
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
      <Text testID={testID} className="text-base font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

export interface ActivityHeatmapProps {
  steps: StepsByDate;
  earliestDate: string | null;
  today: string;
  goal?: number;
}

export function ActivityHeatmap({ steps, earliestDate, today, goal = METRIC_CONFIG.STEPS.goal ?? 10000 }: ActivityHeatmapProps) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const reduced = useReducedMotion();
  const [view, setView] = useState<HeatmapView>('month');
  const [monthCursor, setMonthCursor] = useState(() => monthStart(today));
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<HeatCell | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const firstMonth = monthStart(yearStart(today));
  const lastMonth = monthStart(today);
  const range = viewRange(view, today, monthCursor);

  const grid = useMemo(
    () => (view === 'month' ? monthGrid(monthCursor, today, steps, goal) : weekColumnsGrid(range.start, range.end, steps, goal)),
    [view, monthCursor, today, steps, goal, range.start, range.end],
  );
  const groups = useMemo(() => groupCells(grid, view), [grid, view]);
  const labels = useMemo(() => (view === 'month' ? [] : monthLabels(grid)), [grid, view]);
  const stats = useMemo(() => rangeStats(steps, range.start, range.end, today, goal), [steps, range.start, range.end, today, goal]);
  const note = historyNote(earliestDate, range.start, today);

  const geometry = gridGeometry(grid, width, view === 'month' ? MONTH_GEOMETRY : WEEKS_GEOMETRY);
  const shape = view === 'month' ? 'circle' : 'rect';
  const rangeLabel = view === 'month' ? monthTitle(monthCursor) : view === 'year' ? 'the last 12 months' : `${today.slice(0, 4)} so far`;

  function onGridPress(e: GestureResponderEvent) {
    const top = view === 'month' ? 0 : MONTH_LABEL_HEIGHT;
    const hit = cellAt(grid, geometry.bin, e.nativeEvent.locationX, e.nativeEvent.locationY - top);
    if (hit) setSelected(hit);
  }

  const gridBody = (
    <Pressable
      testID="heatmap-grid"
      onPress={onGridPress}
      accessibilityRole="image"
      accessibilityLabel={`Steps heat map for ${rangeLabel}: ${stats.activeDays} active days, ${stats.goalDays} at goal.`}
      style={{ width: geometry.width, height: geometry.height + (view === 'month' ? 0 : MONTH_LABEL_HEIGHT) }}
    >
      {/* Nothing inside the grid may take the touch: the hit-test reads
          locationX/Y, which are relative to whichever element was touched. */}
      {view !== 'month' ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: geometry.width, height: MONTH_LABEL_HEIGHT }}>
          {labels.map((l) => (
            <Text
              key={`${l.col}-${l.label}`}
              className="absolute text-[10px] text-muted-foreground"
              style={{ left: l.col * geometry.bin, top: 0 }}
            >
              {l.label}
            </Text>
          ))}
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: view === 'month' ? 0 : MONTH_LABEL_HEIGHT }}>
        {groups.map((cells, g) => (
          <Animated.View
            // Keyed by what is shown, so switching view or month re-reveals the cells.
            key={`${view}-${monthCursor}-${g}`}
            entering={reduced ? undefined : FadeIn.delay(g * MOTION.stagger).duration(MOTION.duration.normal)}
            style={{ position: 'absolute', left: 0, top: 0, width: geometry.width, height: geometry.height }}
            pointerEvents="none"
          >
            <CellGroup
              cells={cells}
              shape={shape}
              bin={geometry.bin}
              gap={geometry.gap}
              width={geometry.width}
              height={geometry.height}
              palette={palette}
              selectedDate={selected?.date ?? null}
            />
          </Animated.View>
        ))}
      </View>
    </Pressable>
  );

  return (
    <View className="gap-4">
      <SegmentedControl testID="heatmap-view" options={VIEW_OPTIONS} value={view} onChange={setView} />

      <Card className="gap-3">
        {view === 'month' ? (
          <View className="flex-row items-center justify-between">
            <Pressable
              testID="heatmap-prev-month"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              disabled={monthCursor <= firstMonth}
              onPress={() => setMonthCursor((m) => shiftMonth(m, -1))}
              hitSlop={10}
              className={monthCursor <= firstMonth ? 'opacity-30' : 'active:opacity-60'}
            >
              <Ionicons name="chevron-back" size={20} color={palette.foreground} />
            </Pressable>
            <Text testID="heatmap-title" className="text-base font-semibold">
              {monthTitle(monthCursor)}
            </Text>
            <Pressable
              testID="heatmap-next-month"
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={monthCursor >= lastMonth}
              onPress={() => setMonthCursor((m) => shiftMonth(m, 1))}
              hitSlop={10}
              className={monthCursor >= lastMonth ? 'opacity-30' : 'active:opacity-60'}
            >
              <Ionicons name="chevron-forward" size={20} color={palette.foreground} />
            </Pressable>
          </View>
        ) : (
          <Text testID="heatmap-title" className="text-base font-semibold">
            {view === 'year' ? 'Last 12 months' : `${today.slice(0, 4)} year to date`}
          </Text>
        )}

        <View testID="heatmap-canvas" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            view === 'month' ? (
              <View className="items-center gap-1">
                <View className="flex-row" style={{ width: geometry.width }}>
                  {WEEKDAY_INITIALS.map((d, i) => (
                    <Text key={i} className="text-center text-[11px] text-muted-foreground" style={{ width: geometry.bin }}>
                      {d}
                    </Text>
                  ))}
                </View>
                {gridBody}
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                // Open on the most recent weeks: today is at the right edge.
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
              >
                {gridBody}
              </ScrollView>
            )
          ) : null}
        </View>

        <View testID="heatmap-legend" className="flex-row items-center justify-end gap-1.5">
          <View className="mr-auto flex-row items-center gap-1.5">
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: palette.heatEmpty, borderWidth: 1, borderColor: palette.hairline }} />
            <Text className="text-[11px] text-muted-foreground">No data</Text>
          </View>
          <Text className="text-[11px] text-muted-foreground">Less</Text>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((level) => (
            <View key={level} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: levelColor(level, palette) }} />
          ))}
          <Text className="text-[11px] text-muted-foreground">More</Text>
        </View>

        {note ? (
          <Text testID="heatmap-history-note" className="text-xs text-muted-foreground">
            {note}
          </Text>
        ) : null}
      </Card>

      <View testID="heatmap-stats" className="flex-row flex-wrap gap-2">
        <Stat testID="stat-total" label="Total steps" value={formatSteps(stats.total)} />
        <Stat testID="stat-average" label="Daily average" value={stats.average === null ? '--' : formatSteps(stats.average)} />
        <Stat testID="stat-active" label="Active days" value={String(stats.activeDays)} />
        <Stat testID="stat-streak" label="Goal streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
        <Stat
          testID="stat-best"
          label="Best day"
          value={stats.best ? `${formatSteps(stats.best.steps)} · ${formatShortDate(stats.best.date)}` : '--'}
        />
      </View>

      <Sheet testID="day-sheet" visible={selected !== null} onClose={() => setSelected(null)}>
        {selected ? <DayDetail cell={selected} goal={goal} average={stats.average} /> : null}
      </Sheet>
    </View>
  );
}

function DayDetail({ cell, goal, average }: { cell: HeatCell; goal: number; average: number | null }) {
  const comparison = cell.steps === null ? null : compareToAverage(cell.steps, average);
  return (
    <View testID="day-detail" className="gap-2 pb-2">
      <Text className="text-sm text-muted-foreground">{formatDayTitle(cell.date)}</Text>
      {cell.steps === null ? (
        <Text testID="day-detail-empty" className="text-base">
          No steps were recorded for this day.
        </Text>
      ) : (
        <>
          <Text testID="day-detail-steps" className="text-3xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {`${formatSteps(cell.steps)} steps`}
          </Text>
          <Text testID="day-detail-goal" className="text-base">
            {`${Math.round((cell.steps / goal) * 100)}% of your ${formatSteps(goal)}-step goal`}
          </Text>
          {comparison ? (
            <Text testID="day-detail-comparison" className="text-sm text-muted-foreground">
              {comparison}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
