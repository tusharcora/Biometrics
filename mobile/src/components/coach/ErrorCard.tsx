import React from 'react';
import { View } from 'react-native';
import type { CoachTurnError } from '../../lib/useCoachConversation';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

export const ERROR_COPY: Record<CoachTurnError['kind'], string> = {
  unavailable: "I couldn't answer that just now.",
  timeout: 'That took too long. Nothing was lost; you can try again.',
  interrupted: 'The answer stopped part-way. You can try again.',
  // 409 turn_in_progress: the previous answer is still being written.
  busy: "I'm still finishing your last answer. Give it a moment, then try again.",
  // 429 without a Retry-After; with one, errorCopy says when.
  rate_limited: "You've sent a lot of messages in a short time. Try again a little later.",
};

const RATE_LIMITED_LEAD = "You've sent a lot of messages in a short time.";

function waitWords(seconds: number): string {
  if (seconds < 45) return 'under a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes <= 1) return 'about a minute';
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} hours`;
}

export function errorCopy(error: CoachTurnError): string {
  if (error.kind === 'rate_limited' && error.retryAfterSeconds !== undefined) {
    return `${RATE_LIMITED_LEAD} Try again in ${waitWords(error.retryAfterSeconds)}.`;
  }
  return ERROR_COPY[error.kind];
}

// A turn that did not finish (spec 6): muted and distinct from an answer, so
// it is never read as the coach's reply, with Retry when retrying can help.
export function ErrorCard({ error, onRetry }: { error: CoachTurnError; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" className="gap-1 rounded-tile border border-dashed border-border px-3.5 py-3">
      <Text testID="coach-error" className="text-sm text-muted-foreground">
        {errorCopy(error)}
      </Text>
      {error.retryable ? (
        <Button
          testID="coach-retry-button"
          accessibilityRole="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] self-start px-0"
          onPress={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </View>
  );
}
