import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { COLORS, METRIC_CONFIG, MOTION } from '../theme';
import {
  cellAt,
  formatShortDate,
  gridGeometry,
  heatLevel,
  historyNote,
  monthGrid,
  monthLabels,
  monthStart,
  monthTitle,
  rangeStats,
  shiftMonth,
  sleepHeatLevel,
  viewRange,
  weekColumnsGrid,
  yearStart,
  type HeatCell,
  type HeatGrid,
  type HeatLevel,
  type HeatmapView,
  type LevelOf,
  type StepsByDate,
  type ValuesByDate,
} from '../lib/heatmap';
import { formatClock, formatDuration, sleepRangeStats, type SleepByDate } from '../lib/sleepStats';
import { DayDetail, NightDetail } from './activity-sheets';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SectionLabel } from './ui/section-label';
import { SegmentedControl } from './ui/segmented-control';
import { Sheet } from './ui/sheet';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

const VIEW_OPTIONS: { value: HeatmapView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'ytd', label: 'YTD' },
];

// Month is a roomy calendar of large squares; Year/YTD are compact week columns
// of small squares that scroll sideways when a year does not fit the screen.
const MONTH_GEOMETRY = { minBin: 28, maxBin: 52, gap: 6 };
const WEEKS_GEOMETRY = { minBin: 13, maxBin: 20, gap: 3 };
// Cells re-reveal in groups of columns (rows, for a month) rather than one by
// one, so a year does not schedule 371 separate animations.
const WEEK_COLUMNS_PER_GROUP = 8;
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABEL_HEIGHT = 16;
// The month pager: each page is the width less PAGE_PEEK, so the other page's
// card shows PAGE_PEEK - PAGE_GAP at the edge as a cue to swipe.
const PAGE_PEEK = 24;
const PAGE_GAP = 10;

type Palette = (typeof COLORS)['dark'];

export type ActivityMetric = 'steps' | 'sleep';

export type SleepState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; nights: SleepByDate; earliestDate: string | null };

interface MetricSpec {
  metric: ActivityMetric;
  label: string;
  // Prefix on every testID, so both metrics' cards can be on screen at once.
  prefix: string;
  icon: 'footsteps-outline' | 'moon-outline';
  goal: number;
  levelOf: LevelOf;
  ramp: (p: Palette) => readonly [string, string, string, string, string];
  accent: (p: Palette) => string;
  history: 'step' | 'sleep';
}

const STEPS_SPEC: MetricSpec = {
  metric: 'steps',
  label: 'Steps',
  prefix: '',
  icon: 'footsteps-outline',
  goal: METRIC_CONFIG.STEPS.goal ?? 10000,
  levelOf: heatLevel,
  ramp: (p) => [p.heat0, p.heat1, p.heat2, p.heat3, p.heat4],
  accent: (p) => p.metricSteps,
  history: 'step',
};

const SLEEP_SPEC: MetricSpec = {
  metric: 'sleep',
  label: 'Sleep',
  prefix: 'sleep-',
  icon: 'moon-outline',
  goal: METRIC_CONFIG.SLEEP.goal ?? 480,
  levelOf: sleepHeatLevel,
  ramp: (p) => [p.heat0, p.sleepHeat1, p.sleepHeat2, p.sleepHeat3, p.sleepHeat4],
  accent: (p) => p.metricSleep,
  history: 'sleep',
};

function levelColor(level: HeatLevel | null, palette: Palette, spec: MetricSpec): string {
  if (level === null) return palette.heatEmpty;
  return spec.ramp(palette)[level];
}

const formatSteps = METRIC_CONFIG.STEPS.format;

// Corners scale with the square so a month's large tiles and a year's small
// ones read as the same shape; a year square (10-17 dp) stays at 2 dp.
function cornerRadius(side: number): number {
  return Math.max(2, Math.round(side * 0.14));
}

interface CellGroupProps {
  cells: HeatCell[];
  // 'tile': a month's large squares (outlined when empty, tapped day grows);
  // 'rect': a year's compact week-column squares.
  shape: 'tile' | 'rect';
  bin: number;
  gap: number;
  width: number;
  height: number;
  palette: Palette;
  spec: MetricSpec;
  selectedDate: string | null;
}

// One Svg layer per reveal group; memoised so opening the day sheet (which
// only changes the selection) does not redraw every other group.
const CellGroup = memo(function CellGroup({ cells, shape, bin, gap, width, height, palette, spec, selectedDate }: CellGroupProps) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {cells.map((c) => {
        const fill = levelColor(c.level, palette, spec);
        const selected = c.date === selectedDate;
        const month = shape === 'tile';
        // A month's tapped day grows to fill its bin while its sheet is open.
        const inset = month && selected ? gap / 4 : gap / 2;
        const side = bin - inset * 2;
        return (
          <Rect
            key={c.date}
            x={c.col * bin + inset}
            y={c.row * bin + inset}
            width={side}
            height={side}
            rx={cornerRadius(side)}
            fill={fill}
            stroke={selected ? palette.foreground : month && c.level === null ? palette.hairline : undefined}
            strokeWidth={selected ? (month ? 2 : 1.5) : month ? 1 : 0}
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
    <View className="w-[31%] grow gap-1 rounded-tile border border-border bg-card px-3 py-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text testID={testID} className="text-numeral-sm font-bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

interface HeatmapCardProps {
  spec: MetricSpec;
  values: ValuesByDate;
  earliestDate: string | null;
  today: string;
  view: HeatmapView;
  monthCursor: string;
  onMonthCursor: (month: string) => void;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  accessibilityLabel: string;
  // Year/YTD stack both metrics, so each card names its metric instead of a month.
  summary?: string;
}

// One metric's heat map: month calendar or week columns, legend and history note.
function HeatmapCard({
  spec,
  values,
  earliestDate,
  today,
  view,
  monthCursor,
  onMonthCursor,
  selectedDate,
  onSelect,
  accessibilityLabel,
  summary,
}: HeatmapCardProps) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const p = spec.prefix;

  const firstMonth = monthStart(yearStart(today));
  const lastMonth = monthStart(today);
  const range = viewRange(view, today, monthCursor);

  const grid = useMemo(
    () =>
      view === 'month'
        ? monthGrid(monthCursor, today, values, spec.goal, spec.levelOf)
        : weekColumnsGrid(range.start, range.end, values, spec.goal, spec.levelOf),
    [view, monthCursor, today, values, spec, range.start, range.end],
  );
  const groups = useMemo(() => groupCells(grid, view), [grid, view]);
  const labels = useMemo(() => (view === 'month' ? [] : monthLabels(grid)), [grid, view]);
  const note = historyNote(earliestDate, range.start, today, spec.history);

  const geometry = gridGeometry(grid, width, view === 'month' ? MONTH_GEOMETRY : WEEKS_GEOMETRY);
  const shape = view === 'month' ? 'tile' : 'rect';

  function onGridPress(e: GestureResponderEvent) {
    const top = view === 'month' ? 0 : MONTH_LABEL_HEIGHT;
    const hit = cellAt(grid, geometry.bin, e.nativeEvent.locationX, e.nativeEvent.locationY - top);
    if (hit) onSelect(hit.date);
  }

  const gridBody = (
    <Pressable
      testID={`${p}heatmap-grid`}
      onPress={onGridPress}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
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
              spec={spec}
              selectedDate={selectedDate}
            />
          </Animated.View>
        ))}
      </View>
    </Pressable>
  );

  return (
    <Card className="gap-3">
      {view === 'month' ? (
        <View className="flex-row items-center justify-between">
          <Pressable
            testID={`${p}heatmap-prev-month`}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            disabled={monthCursor <= firstMonth}
            onPress={() => onMonthCursor(shiftMonth(monthCursor, -1))}
            hitSlop={10}
            className={monthCursor <= firstMonth ? 'opacity-30' : 'active:opacity-60'}
          >
            <Ionicons name="chevron-back" size={20} color={palette.foreground} />
          </Pressable>
          <Text testID={`${p}heatmap-title`} className="text-base font-semibold">
            {monthTitle(monthCursor)}
          </Text>
          <Pressable
            testID={`${p}heatmap-next-month`}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={monthCursor >= lastMonth}
            onPress={() => onMonthCursor(shiftMonth(monthCursor, 1))}
            hitSlop={10}
            className={monthCursor >= lastMonth ? 'opacity-30' : 'active:opacity-60'}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.foreground} />
          </Pressable>
        </View>
      ) : (
        <View testID={`${p}heatmap-metric`} className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: levelColor(1, palette, spec) }}>
              <Ionicons name={spec.icon} size={15} color={spec.accent(palette)} />
            </View>
            <Text className="text-base font-semibold">{spec.label}</Text>
          </View>
          {summary ? (
            <Text className="text-sm text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
              {summary}
            </Text>
          ) : null}
        </View>
      )}

      <View testID={`${p}heatmap-canvas`} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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

      <View testID={`${p}heatmap-legend`} className="flex-row items-center justify-end gap-1.5">
        <View className="mr-auto flex-row items-center gap-1.5">
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: palette.heatEmpty, borderWidth: 1, borderColor: palette.hairline }} />
          <Text className="text-[11px] text-muted-foreground">No data</Text>
        </View>
        <Text className="text-[11px] text-muted-foreground">Less</Text>
        {([0, 1, 2, 3, 4] as HeatLevel[]).map((level) => (
          <View key={level} style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: levelColor(level, palette, spec) }} />
        ))}
        <Text className="text-[11px] text-muted-foreground">More</Text>
      </View>

      {note ? (
        <Text testID={`${p}heatmap-history-note`} className="text-xs text-muted-foreground">
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

export interface ActivityHeatmapProps {
  steps: StepsByDate;
  earliestDate: string | null;
  today: string;
  sleep: SleepState;
  onRetrySleep?: () => void;
  // The Sleep screen; the link is drawn wherever the sleep header shows.
  onOpenSleepDetails?: () => void;
}

// The Activity tab: Steps and Sleep. Month swipes between one page per metric;
// Year and YTD stack both; tapping a day opens that metric's sheet.
export function ActivityHeatmap({ steps, earliestDate, today, sleep, onRetrySleep, onOpenSleepDetails }: ActivityHeatmapProps) {
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'light' ? COLORS.light : COLORS.dark;
  const reduced = useReducedMotion();
  const [view, setView] = useState<HeatmapView>('month');
  const [monthCursor, setMonthCursor] = useState(() => monthStart(today));
  const [page, setPage] = useState<ActivityMetric>('steps');
  const [selection, setSelection] = useState<{ metric: ActivityMetric; date: string } | null>(null);
  const [pagerWidth, setPagerWidth] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const range = viewRange(view, today, monthCursor);
  const rangeLabel = view === 'month' ? monthTitle(monthCursor) : view === 'year' ? 'the last 12 months' : `${today.slice(0, 4)} so far`;

  const stepStats = useMemo(() => rangeStats(steps, range.start, range.end, today, STEPS_SPEC.goal), [steps, range.start, range.end, today]);
  const nights = sleep.phase === 'ready' ? sleep.nights : null;
  const sleepValues = useMemo<ValuesByDate>(
    () => new Map(nights ? [...nights].map(([date, n]) => [date, n.minutesAsleep] as const) : []),
    [nights],
  );
  const sleepStats = useMemo(
    () => (nights ? sleepRangeStats(nights, range.start, range.end, today, SLEEP_SPEC.goal) : null),
    [nights, range.start, range.end, today],
  );

  // The second page's offset: the steps card then peeks in from the left.
  const pageWidth = pagerWidth > 0 ? pagerWidth - PAGE_PEEK : undefined;
  const sleepOffset = pagerWidth > 0 ? pagerWidth - 2 * PAGE_PEEK + PAGE_GAP : 0;

  function goTo(metric: ActivityMetric) {
    setPage(metric);
    pagerRef.current?.scrollTo?.({ x: metric === 'sleep' ? sleepOffset : 0, animated: !reduced });
  }

  function onPagerSettle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(e.nativeEvent.contentOffset.x > sleepOffset / 2 ? 'sleep' : 'steps');
  }

  // Back in Month (the pager remounts at the first page) or once it is
  // measured, put it back on the page the header says is showing.
  useEffect(() => {
    if (view === 'month' && pagerWidth > 0 && page === 'sleep') {
      pagerRef.current?.scrollTo?.({ x: sleepOffset, animated: false });
    }
    // Only on a remount or a resize: a swipe already moved the pager itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pagerWidth]);

  function select(metric: ActivityMetric, date: string) {
    setSelection({ metric, date });
  }

  // From one metric's sheet to the same day on the other: the month pager follows.
  function crossTo(metric: ActivityMetric, date: string) {
    setSelection({ metric, date });
    if (view === 'month') goTo(metric);
  }

  const stepsCard = (
    <HeatmapCard
      spec={STEPS_SPEC}
      values={steps}
      earliestDate={earliestDate}
      today={today}
      view={view}
      monthCursor={monthCursor}
      onMonthCursor={setMonthCursor}
      selectedDate={selection?.metric === 'steps' ? selection.date : null}
      onSelect={(date) => select('steps', date)}
      accessibilityLabel={`Steps heat map for ${rangeLabel}: ${stepStats.activeDays} active days, ${stepStats.goalDays} at goal.`}
      summary={stepStats.average === null ? undefined : `${formatSteps(stepStats.average)} avg / day`}
    />
  );

  const stepsStatsRow = (
    <View testID="heatmap-stats" className="flex-row flex-wrap gap-2">
      <Stat testID="stat-total" label="Total steps" value={formatSteps(stepStats.total)} />
      <Stat testID="stat-average" label="Daily average" value={stepStats.average === null ? '--' : formatSteps(stepStats.average)} />
      <Stat testID="stat-active" label="Active days" value={String(stepStats.activeDays)} />
      <Stat testID="stat-streak" label="Goal streak" value={`${stepStats.streak} day${stepStats.streak === 1 ? '' : 's'}`} />
      <Stat
        testID="stat-best"
        label="Best day"
        value={stepStats.best ? `${formatSteps(stepStats.best.steps)} · ${formatShortDate(stepStats.best.date)}` : '--'}
      />
    </View>
  );

  let sleepSection: React.ReactNode;
  if (sleep.phase === 'loading') {
    sleepSection = (
      <View testID="sleep-loading" className="gap-4">
        <Skeleton className="h-80 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
      </View>
    );
  } else if (sleep.phase === 'error') {
    sleepSection = (
      <Card testID="sleep-error" className="items-center gap-3 py-10">
        <Text className="text-center text-muted-foreground">Your sleep could not be loaded.</Text>
        {onRetrySleep ? (
          <Button testID="sleep-retry" onPress={onRetrySleep}>
            Try again
          </Button>
        ) : null}
      </Card>
    );
  } else {
    sleepSection = (
      <>
        <HeatmapCard
          spec={SLEEP_SPEC}
          values={sleepValues}
          earliestDate={sleep.earliestDate}
          today={today}
          view={view}
          monthCursor={monthCursor}
          onMonthCursor={setMonthCursor}
          selectedDate={selection?.metric === 'sleep' ? selection.date : null}
          onSelect={(date) => select('sleep', date)}
          accessibilityLabel={`Sleep heat map for ${rangeLabel}: ${sleepStats?.nights ?? 0} nights recorded, ${sleepStats?.goalNights ?? 0} at goal.`}
          summary={sleepStats?.averageMinutes == null ? undefined : `${formatDuration(sleepStats.averageMinutes)} avg / night`}
        />
        <View testID="sleep-heatmap-stats" className="flex-row flex-wrap gap-2">
          <Stat
            testID="sleep-stat-average"
            label="Avg asleep"
            value={sleepStats?.averageMinutes == null ? '--' : formatDuration(sleepStats.averageMinutes)}
          />
          <Stat testID="sleep-stat-goal" label="Nights at goal" value={String(sleepStats?.goalNights ?? 0)} />
          <Stat
            testID="sleep-stat-streak"
            label="Goal streak"
            value={`${sleepStats?.streak ?? 0} night${sleepStats?.streak === 1 ? '' : 's'}`}
          />
          <Stat
            testID="sleep-stat-bedtime"
            label="Avg bedtime"
            value={sleepStats?.averageBedtime ? formatClock(sleepStats.averageBedtime) : '--'}
          />
          <Stat
            testID="sleep-stat-longest"
            label="Longest night"
            value={sleepStats?.longest ? `${formatDuration(sleepStats.longest.minutes)} · ${formatShortDate(sleepStats.longest.date)}` : '--'}
          />
        </View>
      </>
    );
  }

  const title = view === 'month' ? (page === 'sleep' ? 'Sleep' : 'Steps') : 'Steps & sleep';
  const subtitle =
    view === 'month'
      ? page === 'sleep'
        ? `Nightly sleep against your ${METRIC_CONFIG.SLEEP.goalLabel}`
        : `Daily steps against your ${METRIC_CONFIG.STEPS.goalLabel} goal`
      : null;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <View className="flex-row items-end justify-between">
          <View className="gap-1">
            <SectionLabel>Activity</SectionLabel>
            <Text testID="activity-title" className="font-display text-display-lg">
              {title}
            </Text>
          </View>
          {view === 'month' ? (
            <View accessibilityRole="tablist" className="flex-row items-center pb-2">
              {(['steps', 'sleep'] as const).map((metric) => {
                const on = page === metric;
                const color = metric === 'sleep' ? palette.metricSleep : palette.metricSteps;
                return (
                  <Pressable
                    key={metric}
                    testID={`activity-page-${metric}`}
                    accessibilityRole="tab"
                    accessibilityLabel={metric === 'sleep' ? 'Sleep page' : 'Steps page'}
                    accessibilityState={{ selected: on }}
                    onPress={() => goTo(metric)}
                    className="h-11 items-center justify-center px-1.5"
                  >
                    <View style={{ height: 8, width: on ? 22 : 8, borderRadius: 4, backgroundColor: on ? color : palette.hairline }} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
        {onOpenSleepDetails && (view !== 'month' || page === 'sleep') ? (
          <Pressable
            testID="activity-sleep-details"
            accessibilityRole="link"
            hitSlop={8}
            onPress={onOpenSleepDetails}
            className="flex-row items-center gap-1 self-start py-1 active:opacity-70"
          >
            <Text className="text-sm font-semibold">Sleep details</Text>
            <Ionicons name="chevron-forward" size={14} color={palette.metricSleep} />
          </Pressable>
        ) : null}
      </View>

      <SegmentedControl testID="heatmap-view" options={VIEW_OPTIONS} value={view} onChange={setView} />

      {view === 'month' ? (
        <View testID="activity-pager" onLayout={(e) => setPagerWidth(e.nativeEvent.layout.width)}>
          <ScrollView
            ref={pagerRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToOffsets={[0, sleepOffset]}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={onPagerSettle}
            contentContainerStyle={{ gap: PAGE_GAP }}
          >
            <View testID="activity-page-steps-content" className="gap-4" style={{ width: pageWidth }}>
              {stepsCard}
              {stepsStatsRow}
            </View>
            <View testID="activity-page-sleep-content" className="gap-4" style={{ width: pageWidth }}>
              {sleepSection}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View className="gap-4">
          <Text testID="heatmap-title" className="text-base font-semibold">
            {view === 'year' ? 'Last 12 months' : `${today.slice(0, 4)} year to date`}
          </Text>
          {stepsCard}
          {stepsStatsRow}
          {sleepSection}
        </View>
      )}

      <Sheet testID="day-sheet" visible={selection !== null} onClose={() => setSelection(null)}>
        {selection?.metric === 'steps' ? (
          <DayDetail
            date={selection.date}
            steps={steps.get(selection.date) ?? null}
            goal={STEPS_SPEC.goal}
            average={stepStats.average}
            sleepLink={nights ? { night: nights.get(selection.date) ?? null, onPress: () => crossTo('sleep', selection.date) } : undefined}
          />
        ) : selection ? (
          <NightDetail
            date={selection.date}
            night={nights?.get(selection.date) ?? null}
            goal={SLEEP_SPEC.goal}
            average={sleepStats?.averageMinutes ?? null}
            stepsLink={{ steps: steps.get(selection.date) ?? null, onPress: () => crossTo('steps', selection.date) }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
