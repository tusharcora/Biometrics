import React, { memo } from 'react';
import { View } from 'react-native';
import type { AnswerCardDTO, CoachMessageSource } from '../../api/coach';
import type { CoachChatMessage } from '../../lib/useCoachConversation';
import { followUpsFor } from '../../lib/coachAnswers';
import { Text } from '../ui/text';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ChatBubble } from '../ui/chat-bubble';
import { MemoryProposalChips } from '../memory-proposal-chips';
import { AnswerCard } from './AnswerCard';
import { FollowUpChips } from './FollowUpChips';

interface CoachMessageRowProps {
  message: CoachChatMessage;
  // Only the latest finished, non-safety answer shows follow-ups.
  showFollowUps: boolean;
  // The question that answer replies to: a chip repeating it is dropped.
  lastQuestion?: string;
  // An answer is streaming: the safety override and follow-ups wait. The
  // screen passes it only to rows that use it, so the rest skip re-rendering.
  busy: boolean;
  // Stable callbacks (useCallback), so typing in the composer re-renders no row.
  onAsk: (question: string) => boolean;
  onOverrideSafety: (originalMessage: string) => void;
  onOpenSource: (card: AnswerCardDTO) => void;
}

// One message on the Coach page: a question, or an answer with its card,
// "Stopped" marker, on-device note, memory chips and follow-ups (spec 1.3).
export const CoachMessageRow = memo(function CoachMessageRow({
  message,
  showFollowUps,
  lastQuestion,
  busy,
  onAsk,
  onOverrideSafety,
  onOpenSource,
}: CoachMessageRowProps) {
  if (message.role === 'user') {
    return (
      <View className="gap-1">
        {message.failed ? (
          <Text testID={`coach-message-failed-${message.id}`} className="self-end text-xs text-destructive">
            Not sent
          </Text>
        ) : null}
        <ChatBubble role="user" text={message.text} />
      </View>
    );
  }
  // The empty answer being waited on shows as the thinking line instead.
  if (message.state === 'streaming' && !message.text && !message.safety) return null;
  const { card, safety } = message;
  return (
    <View className="gap-2">
      {message.text ? (
        <ChatBubble role="assistant" text={message.text} source={message.source as CoachMessageSource} animate={false}>
          {safety ? (
            <View className="gap-3">
              <Card testID="coach-safety-resources" className="gap-1 border-accent/40 bg-accent/10">
                <Text className="text-sm font-semibold">Support is available</Text>
                {safety.resources.map((resource) => (
                  <Text key={resource} className="text-sm">
                    {resource}
                  </Text>
                ))}
              </Card>
              {!safety.overridden ? (
                <Button testID="coach-safety-override" variant="ghost" size="sm" disabled={busy} onPress={() => onOverrideSafety(safety.originalMessage)}>
                  {"That's not why I'm asking"}
                </Button>
              ) : null}
            </View>
          ) : null}
        </ChatBubble>
      ) : null}
      {card ? <AnswerCard card={card} onOpenSource={() => onOpenSource(card)} /> : null}
      {message.state === 'stopped' ? (
        <Text testID={`coach-stopped-${message.id}`} className="text-xs text-muted-foreground">
          Stopped
        </Text>
      ) : null}
      {message.answeredLocally ? (
        <Text testID={`coach-local-note-${message.id}`} className="text-xs text-muted-foreground">
          Answered by the on-device model
        </Text>
      ) : null}
      {message.memoryProposals ? <MemoryProposalChips proposals={message.memoryProposals} /> : null}
      {showFollowUps ? <FollowUpChips questions={followUpsFor(card, lastQuestion)} onAsk={onAsk} disabled={busy} /> : null}
    </View>
  );
});
