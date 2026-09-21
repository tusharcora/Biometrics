import React from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text } from './text';
import { StreamingText } from './streaming-text';
import type { CoachMessageSource } from '../../api/coach';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  // Recorded for callers; a 'fallback' reply is deliberately styled exactly
  // like a model reply (it is a normal answer to the user).
  source?: CoachMessageSource;
  // Fade a newly arrived assistant reply in; history renders instantly.
  animate?: boolean;
  // Content beneath the text, e.g. the safety resources block.
  children?: React.ReactNode;
}

// One coach-conversation message. User bubbles sit right on the accent colour,
// assistant bubbles sit left on a card. Assistant text goes through
// StreamingText (a single fade, not a typing effect).
export function ChatBubble({ role, text, animate = true, children }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <View className={cn('w-full', isUser ? 'items-end' : 'items-start')}>
      <View
        testID={`chat-bubble-${role}`}
        className={cn(
          'max-w-[85%] gap-3 rounded-2xl px-4 py-3',
          isUser ? 'bg-accent' : 'border border-border bg-card',
        )}
      >
        {isUser ? (
          <Text className="text-base text-accent-foreground">{text}</Text>
        ) : (
          <StreamingText text={text} animate={animate} className="text-base" />
        )}
        {children}
      </View>
    </View>
  );
}
