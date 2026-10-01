import React from 'react';
import { Pressable, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import type { AnswerCardDTO, AnswerCardItemDTO } from '../../api/coach';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';

const RANK_BAR_MAX = 70;

// Stretches the small source line's touch area to 44pt (16pt line + 2 × 14).
const SOURCE_HIT_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

type Palette = (typeof COLORS)['light'];

function statusColor(item: AnswerCardItemDTO, colors: Palette): string {
  if (item.status === 'below') return colors.statusBelow;
  if (item.status === 'above') return colors.statusAbove;
  return colors.foreground;
}

function statusTextColor(item: AnswerCardItemDTO, colors: Palette): string {
  if (item.status === 'below') return colors.statusBelowText;
  if (item.status === 'above') return colors.statusAboveText;
  return colors.foreground;
}

// The words follow the number, not the (goodness) status: a resting HR above
// its usual is "above usual" even though the server marks it below.
function comparison(item: AnswerCardItemDTO): string | null {
  if (!item.status) return null;
  // R41: the server's signed difference ("−25m vs usual"); cards stored before it fall back to words.
  if (item.deltaDisplay) return `${item.deltaDisplay} vs usual`;
  if (item.status === 'near' || item.usual === undefined || item.value === item.usual) return 'on par';
  return item.value < item.usual ? 'below usual' : 'above usual';
}

const plural = (n: string, unit: string) => `${n} ${unit}${n === '1' ? '' : 's'}`;

// "−25m" -> "25 minutes below usual", "+1h 5m" -> "1 hour 5 minutes above usual",
// "+4 bpm" -> "4 beats per minute above usual": abbreviations a screen reader would misread.
function spokenDelta(delta: string): string {
  const below = /^[−-]/.test(delta);
  const size = delta
    .replace(/^[−+-]\s*/, '')
    .replace(/\b(\d+)h\b/g, (_, n: string) => plural(n, 'hour'))
    .replace(/\b(\d+)m\b/g, (_, n: string) => plural(n, 'minute'))
    .replace(/\bbpm\b/g, 'beats per minute')
    .replace(/\bms\b/g, 'milliseconds')
    .replace(/%/g, ' percent');
  return `${size} ${below ? 'below' : 'above'} usual`;
}

function spokenComparison(item: AnswerCardItemDTO): string | null {
  if (item.status && item.deltaDisplay) return spokenDelta(item.deltaDisplay);
  return comparison(item);
}

function Tile({ item, colors }: { item: AnswerCardItemDTO; colors: Palette }) {
  const words = comparison(item);
  const spoken = spokenComparison(item);
  // Small text, so the text-safe status colours (R40: rose/teal-700 in light
  // mode); the words still carry the status for anyone who can't see colour.
  const valueColor = statusTextColor(item, colors);
  return (
    <View
      testID={`answer-tile-${item.factId}`}
      accessible
      accessibilityLabel={`${item.label} ${item.display}${spoken ? `, ${spoken}` : ''}`}
      className="min-w-[30%] flex-1 rounded-tile bg-muted px-2.5 py-2"
    >
      <Text testID={`answer-tile-value-${item.factId}`} className="text-base font-bold" style={{ color: valueColor }}>
        {item.display}
      </Text>
      <Text className="text-xs text-muted-foreground">{words ? `${item.label} · ${words}` : item.label}</Text>
    </View>
  );
}

function RankedRow({ item, rank, largest, colors }: { item: AnswerCardItemDTO; rank: number; largest: number; colors: Palette }) {
  const width = largest > 0 ? (Math.abs(item.value) / largest) * RANK_BAR_MAX : 0;
  const color = item.status ? statusColor(item, colors) : item.value < 0 ? colors.statusBelow : colors.statusAbove;
  return (
    <View
      testID={`answer-rank-${rank}`}
      accessible
      accessibilityLabel={`${rank}. ${item.label}, ${item.display}`}
      className={`flex-row items-center gap-2 py-1.5 ${rank > 1 ? 'border-t border-border' : ''}`}
    >
      <Text className="w-4 text-sm text-muted-foreground">{rank}</Text>
      <Text className="shrink text-sm">{item.label}</Text>
      <View testID={`answer-rank-bar-${rank}`} className="h-1.5 rounded-full" style={{ width, backgroundColor: color }} />
      <Text className="ml-auto text-xs text-muted-foreground" numberOfLines={1}>
        {item.display}
      </Text>
    </View>
  );
}

// The card under a data answer (spec 1.3): a headline, then 1-4 number tiles
// or a ranked list, an optional "Try:" tip and the source line, which opens
// the screen holding the underlying data (the caller resolves it with
// cardDestination).
export function AnswerCard({ card, onOpenSource }: { card: AnswerCardDTO; onOpenSource?: () => void }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const colors = dark ? COLORS.dark : COLORS.light;
  const largest = Math.max(0, ...(card.ranked ?? []).map((i) => Math.abs(i.value)));
  const tip = card.tip ? (/^try:/i.test(card.tip.trim()) ? card.tip.trim() : `Try: ${card.tip.trim()}`) : null;

  return (
    <View testID="answer-card" className="gap-2 rounded-card border border-border bg-card p-3.5">
      <Text className="text-base font-semibold">{card.headline}</Text>
      {card.tiles ? (
        <View className="flex-row flex-wrap gap-1.5">
          {card.tiles.map((item) => (
            <Tile key={item.factId} item={item} colors={colors} />
          ))}
        </View>
      ) : null}
      {card.ranked ? (
        <View>
          {card.ranked.map((item, index) => (
            <RankedRow key={item.factId} item={item} rank={index + 1} largest={largest} colors={colors} />
          ))}
        </View>
      ) : null}
      {tip ? (
        <View testID="answer-tip" className="rounded-tile px-3 py-2" style={{ backgroundColor: colors.tip }}>
          <Text className="text-sm" style={{ color: colors.tipForeground }}>
            {tip}
          </Text>
        </View>
      ) : null}
      {card.source ? (
        onOpenSource ? (
          <Pressable
            testID="answer-source"
            accessibilityRole="link"
            accessibilityLabel={card.source}
            accessibilityHint="Opens the data behind this answer"
            onPress={onOpenSource}
            hitSlop={SOURCE_HIT_SLOP}
            className="self-start active:opacity-70"
          >
            <Text className="text-xs text-muted-foreground">{`${card.source} ›`}</Text>
          </Pressable>
        ) : (
          <Text testID="answer-source" className="text-xs text-muted-foreground">
            {card.source}
          </Text>
        )
      ) : null}
    </View>
  );
}
