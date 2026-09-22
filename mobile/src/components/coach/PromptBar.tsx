import React, { useState } from 'react';
import { TextInput, View, type NativeSyntheticEvent, type TextInputContentSizeChangeEventData } from 'react-native';
import { useColorScheme } from 'nativewind';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import { Text } from '../ui/text';
import { PressableScale } from '../ui/pressable-scale';
import { COLORS, MOTION } from '../../theme';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

export interface PromptCommand {
  key: string;
  label: string;
  /** What the field is replaced with when the command is picked. */
  prompt: string;
}

export interface PromptBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** A turn is in flight: the field locks and the glyph becomes a stop square. */
  busy: boolean;
  commands?: PromptCommand[];
  placeholder?: string;
}

/** Openers worth one tap. Kept here so the screen does not carry copy. */
export const COACH_COMMANDS: PromptCommand[] = [
  { key: 'recovery', label: 'Why is my recovery down?', prompt: 'Why is my recovery score lower today?' },
  { key: 'sleep', label: 'How did I sleep?', prompt: 'How did I sleep last night, and what stood out?' },
  { key: 'patterns', label: 'What affects me most?', prompt: 'Which of my habits affect my scores the most?' },
];

// The two glyphs the send control morphs between. Same length, read pairwise as
// (x, y), so they interpolate point for point: an arrow pointing up at rest, a
// stop square while a turn runs. Taken from the reference component so the
// motion matches rather than approximates it.
export const ARROW_POINTS = [12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11];
export const SQUARE_POINTS = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];

const LINE_HEIGHT = 22;
const MAX_ROWS = 5;

/**
 * The slash-command query being typed, or null when no menu should show.
 *
 * Only a slash in the very first column counts, and only until the first
 * space: after that the user is writing a message, and a menu parked over the
 * transcript would be in the way for the rest of the sentence.
 */
export function parseSlashQuery(value: string): string | null {
  if (!value.startsWith('/')) return null;
  const rest = value.slice(1);
  if (/\s/.test(rest)) return null;
  return rest.toLowerCase();
}

/** Commands whose key starts with `query`. An empty query matches everything. */
export function matchCommands(commands: PromptCommand[], query: string): PromptCommand[] {
  if (query === '') return commands;
  return commands.filter((c) => c.key.startsWith(query));
}

/** Field height for the measured content: at least one row, at most `maxRows`. */
export function clampRows(contentHeight: number, lineHeight: number, maxRows: number): number {
  const rows = Math.max(1, Math.min(maxRows, Math.ceil(contentHeight / lineHeight) || 1));
  return rows * lineHeight;
}

/** The glyph part-way between the arrow (0) and the stop square (1). */
export function glyphPoints(t: number): number[] {
  return ARROW_POINTS.map((from, i) => from + (SQUARE_POINTS[i]! - from) * t);
}

/**
 * How the send control paints. It is filled and near-white whenever it means
 * something -- a message ready to send, or a turn to watch -- and recedes into
 * the bar when there is nothing to do, which is what makes the bar read as one
 * surface rather than a field plus a button.
 */
export function sendColors(
  active: boolean,
  colors: { barActive: string; background: string; hairline: string; muted: string },
): { background: string; glyph: string } {
  return active
    ? { background: colors.barActive, glyph: colors.background }
    : { background: colors.hairline, glyph: colors.muted };
}

export function PromptBar({
  value,
  onChangeText,
  onSend,
  busy,
  commands = COACH_COMMANDS,
  placeholder = 'Ask anything',
}: PromptBarProps) {
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const reduced = useReducedMotion();

  const [height, setHeight] = useState(LINE_HEIGHT);

  const canSend = value.trim().length > 0 && !busy;
  const query = parseSlashQuery(value);
  const matches = query === null ? [] : matchCommands(commands, query);
  const menuOpen = matches.length > 0;
  const send = sendColors(canSend || busy, colors);

  // 0 = arrow, 1 = stop square. Reduced motion snaps rather than morphs.
  const morph = useSharedValue(busy ? 1 : 0);
  morph.value = reduced ? (busy ? 1 : 0) : withTiming(busy ? 1 : 0, { duration: MOTION.duration.fast });

  const glyphProps = useAnimatedProps(() => {
    const pts = ARROW_POINTS.map((from, i) => from + (SQUARE_POINTS[i]! - from) * morph.value);
    let out = '';
    for (let i = 0; i < pts.length; i += 2) out += `${pts[i]},${pts[i + 1]} `;
    return { points: out.trim() };
  });

  return (
    <View className="gap-2">
      {menuOpen ? (
        <View
          testID="coach-command-menu"
          style={{ backgroundColor: colors.surfaceRaised }}
          className="overflow-hidden rounded-2xl"
        >
          {matches.map((command) => (
            <PressableScale
              key={command.key}
              testID={`coach-command-${command.key}`}
              accessibilityRole="button"
              accessibilityLabel={command.label}
              onPress={() => onChangeText(command.prompt)}
              className="px-4 py-3 active:opacity-70"
            >
              <Text className="text-sm font-semibold">/{command.key}</Text>
              <Text className="text-xs text-muted-foreground">{command.label}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {/* One filled surface holding the field and its toolbar, as in the
          reference: no outline, the controls live inside the bar. */}
      <View style={{ backgroundColor: colors.surfaceRaised }} className="rounded-2xl px-4 pb-3 pt-3">
        <TextInput
          testID="coach-input"
          value={value}
          onChangeText={onChangeText}
          onContentSizeChange={(e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) =>
            setHeight(clampRows(e.nativeEvent.contentSize.height, LINE_HEIGHT, MAX_ROWS))
          }
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          editable={!busy}
          style={{ color: colors.foreground, height, lineHeight: LINE_HEIGHT, textAlignVertical: 'top' }}
        />

        <View className="mt-2 flex-row items-center">
          {/* The reference's leading "+" slot. Here it opens the commands,
              which is the one affordance in that cluster this app can back. */}
          <PressableScale
            testID="coach-commands-button"
            accessibilityRole="button"
            accessibilityLabel="Prompt shortcuts"
            disabled={busy}
            onPress={() => onChangeText('/')}
            className="h-8 w-8 items-center justify-center rounded-lg active:opacity-70"
          >
            <Text style={{ color: colors.muted }} className="text-xl leading-none">
              /
            </Text>
          </PressableScale>

          <View className="flex-1" />

          <PressableScale
            testID="coach-send-button"
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Working' : 'Send'}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={() => {
              if (canSend) onSend();
            }}
            style={{ backgroundColor: send.background }}
            className="h-9 w-9 items-center justify-center rounded-xl"
          >
            <View testID="coach-send-glyph" accessibilityLabel={busy ? 'Working' : 'Send'}>
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <AnimatedPolygon animatedProps={glyphProps} fill={send.glyph} />
              </Svg>
            </View>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
