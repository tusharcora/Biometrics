import React from 'react';
import { View } from 'react-native';
import { PressableScale } from '../ui/pressable-scale';
import { Text } from '../ui/text';

// A 36pt chip plus 4pt of slop on each side gives a 44pt target; the 8pt gap
// keeps neighbouring chips' slop from overlapping.
const CHIP_HIT_SLOP = 4;

// Short follow-up questions under the latest answer (spec 1.3). The caller
// passes followUpsFor(card, lastUserMessage); an empty list renders nothing.
// Tapping one sends it; they do nothing while an answer is still streaming.
export function FollowUpChips({ questions, onAsk, disabled = false }: { questions: string[]; onAsk: (question: string) => void; disabled?: boolean }) {
  if (questions.length === 0) return null;
  return (
    <View testID="follow-up-chips" className="flex-row flex-wrap gap-2">
      {questions.map((question, index) => (
        <PressableScale
          key={`${question}-${index}`}
          testID={`follow-up-${index}`}
          accessibilityRole="button"
          accessibilityLabel={question}
          accessibilityHint="Asks your coach"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={CHIP_HIT_SLOP}
          onPress={() => onAsk(question)}
          className={`min-h-[36px] justify-center rounded-full border border-border px-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}
        >
          <Text className="text-sm">{question}</Text>
        </PressableScale>
      ))}
    </View>
  );
}
