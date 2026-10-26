import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { KIP_COPY } from '../../lib/kipCopy';

// The thread's card for the states with no chat (spec 2026-10-14 KIP Coach §3.4): consent (two buttons), offline and
// unavailable (no button: there is no outbox and no offline cache of past chats).
export function KipStateCard({ kind, onReview, onNotNow }: { kind: 'consent' | 'offline' | 'unavailable'; onReview?: () => void; onNotNow?: () => void }) {
  if (kind === 'consent') {
    return (
      <View testID="kip-consent" className="gap-3 rounded-tile border border-border bg-card p-4">
        <Text accessibilityRole="header" className="text-heading">{KIP_COPY.consentHeading}</Text>
        <Text className="text-body text-muted-foreground">{KIP_COPY.consentBody}</Text>
        <View className="flex-row gap-2">
          <Button testID="coach-review-consent-button" className="flex-1" onPress={onReview}>{KIP_COPY.consentReview}</Button>
          <Button testID="kip-consent-not-now" variant="outline" className="flex-1" onPress={onNotNow}>{KIP_COPY.consentNotNow}</Button>
        </View>
      </View>
    );
  }
  return (
    <View testID={`kip-${kind}`} accessibilityRole={kind === 'offline' ? 'alert' : undefined} className="rounded-tile border border-dashed border-border px-3.5 py-3">
      <Text className="text-body text-muted-foreground">{kind === 'offline' ? KIP_COPY.offline : KIP_COPY.unavailable}</Text>
    </View>
  );
}
