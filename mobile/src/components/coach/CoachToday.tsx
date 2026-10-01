import React from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { TodaySummaryDTO } from '../../api/coach';
import { barColorKey, barQuestion, spanQuestion } from '../../lib/coachToday';
import { COLORS } from '../../theme';
import { Skeleton } from '../ui/skeleton';
import { Text } from '../ui/text';
import { TodayBar } from './TodayBar';

export const TODAY_FOOTNOTE = 'Comparisons against your own readings, not medical advice.';
export const TODAY_EMPTY = "Once your first night syncs, I'll sum up your day here.";

interface CoachTodayProps {
  // null: not loaded (yet), or the request failed.
  summary: TodaySummaryDTO | null;
  loading: boolean;
  // Sends a question to the coach, as if typed.
  onAsk: (question: string) => void;
}

// The Coach page's picture of today (spec 1.2): the character's headline
// sentence with tappable metric words, then four "today vs usual" bars, then
// the one footnote on the page. Skeleton bars while the first load runs; a
// short promise before any data exists; nothing if the summary failed.
export function CoachToday({ summary, loading, onAsk }: CoachTodayProps) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  if (!summary) {
    if (!loading) return null;
    return (
      <View testID="coach-today-loading" className="gap-3">
        <Skeleton className="h-6 w-11/12" />
        <Skeleton className="h-6 w-2/3" />
        <View className="mt-1 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-2 w-full rounded-full" />
          ))}
        </View>
      </View>
    );
  }

  if (!summary.hasData) {
    return (
      <Text testID="coach-today-empty" className="font-display text-display-sm text-muted-foreground">
        {TODAY_EMPTY}
      </Text>
    );
  }

  const { sentence, bars } = summary;

  return (
    <View testID="coach-today" className="gap-3">
      {sentence ? (
        <Text testID="coach-today-sentence" className="font-display text-display-sm">
          {sentence.spans.map((span, index) => {
            if (!span.metric) return <Text key={index} className="font-display text-display-sm">{span.text}</Text>;
            const metric = span.metric;
            const bar = bars.find((b) => b.metric === metric);
            const tinted = bar && (bar.status === 'below' || bar.status === 'above');
            return (
              <Text
                key={index}
                testID={`today-span-${metric}`}
                accessibilityRole="button"
                accessibilityHint="Asks your coach about it"
                onPress={() => onAsk(spanQuestion(metric, bars))}
                className="font-display text-display-sm"
                style={{
                  textDecorationLine: 'underline',
                  textDecorationStyle: 'dotted',
                  color: tinted ? colors[barColorKey(bar)] : colors.foreground,
                }}
              >
                {span.text}
              </Text>
            );
          })}
        </Text>
      ) : null}
      {bars.length > 0 ? (
        <View testID="coach-today-bars" className="gap-1.5">
          {bars.map((bar) => (
            <TodayBar key={bar.metric} bar={bar} onPress={(b) => onAsk(barQuestion(b))} />
          ))}
        </View>
      ) : null}
      <Text testID="coach-today-footnote" className="text-xs text-muted-foreground">
        {TODAY_FOOTNOTE}
      </Text>
    </View>
  );
}
