import React from 'react';
import { View, type TextStyle } from 'react-native';
import { Text } from '../../ui/text';
import { CHARACTERS } from '../../characters/registry';
import type { CharacterId } from '../../characters/types';
import { pixelFont, useCoachVoice, useElapsed } from './shared';
import type { ThinkingStyleProps } from './types';

// The box is the same in light and dark mode, like a game's text window.
export const DIALOG_INK = '#E5E7EB';
const DIALOG_FILL = '#0F1020';
const DIALOG_GAP = '#0B0C0F';
const LINE_MS = 2600;
const TYPE_MS = 55;

/** The text inside the box: pixel font, light ink. */
export function dialogTextStyle(): TextStyle {
  return { fontFamily: pixelFont(), fontSize: 12, lineHeight: 18, color: DIALOG_INK };
}

/**
 * I's RPG box: a 3 pt light border on a dark fill, a dark gap and a 2 pt
 * accent ring outside it, and the coach's name on a tab over the top edge.
 * The thinking lines type into it, and then the answer (ReplyFrame).
 */
export function DialogBox({ characterId, children, footer, testID }: { characterId: CharacterId; children: React.ReactNode; footer?: React.ReactNode; testID?: string }) {
  const { name, accent } = useCoachVoice(characterId);
  return (
    <View testID={testID} style={{ marginTop: 12, marginBottom: 2, borderWidth: 2, borderColor: accent, borderRadius: 8, padding: 3, backgroundColor: DIALOG_GAP }}>
      <View style={{ borderWidth: 3, borderColor: DIALOG_INK, borderRadius: 4, backgroundColor: DIALOG_FILL, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, minHeight: 62 }}>
        <View style={{ position: 'absolute', top: -13, left: 10, backgroundColor: accent, borderRadius: 2, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Text testID="thinking-dialog-tab" style={{ fontFamily: pixelFont(), fontSize: 11, color: DIALOG_GAP }}>
            {name}
          </Text>
        </View>
        {children}
        {footer}
      </View>
    </View>
  );
}

// I: the personality lines type out inside the box at 55 ms a letter, a ▼
// hopping in the corner. Frozen, the whole first line shows.
export function Dialog({ characterId, paused }: ThinkingStyleProps) {
  const { accent } = useCoachVoice(characterId);
  const elapsed = useElapsed(paused);
  const lines = CHARACTERS[characterId].thinkingLines;
  const full = `${lines[Math.floor(elapsed / LINE_MS) % lines.length]}…`;
  const shown = paused ? full : full.slice(0, Math.floor((elapsed % LINE_MS) / TYPE_MS));
  const hop = Math.floor(elapsed / 300) % 2 === 1;
  return (
    <DialogBox
      characterId={characterId}
      footer={
        <Text style={{ position: 'absolute', right: 8, bottom: 4, fontSize: 10, color: accent, transform: [{ translateY: hop ? 2 : 0 }] }}>▼</Text>
      }
    >
      <Text style={dialogTextStyle()}>{shown}</Text>
    </DialogBox>
  );
}
