import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';

// Short follow-up questions under the latest answer (spec 1.3). The caller
// passes followUpsFor(card, lastUserMessage); an empty list renders nothing.
// Tapping one sends it; they do nothing while an answer is still streaming.
// Button's hitSlop grows each 32pt chip to a 44pt target.
export function FollowUpChips({ questions, onAsk, disabled = false }: { questions: string[]; onAsk: (question: string) => void; disabled?: boolean }) {
  if (questions.length === 0) return null;
  return (
    <View testID="follow-up-chips" className="flex-row flex-wrap gap-2">
      {questions.map((question, index) => (
        <Button
          key={`${question}-${index}`}
          testID={`follow-up-${index}`}
          variant="outline"
          size="sm"
          accessibilityLabel={question}
          accessibilityHint="Asks your coach"
          disabled={disabled}
          onPress={() => onAsk(question)}
          className="max-w-full rounded-full"
        >
          {question}
        </Button>
      ))}
    </View>
  );
}
