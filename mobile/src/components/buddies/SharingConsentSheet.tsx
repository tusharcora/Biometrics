import React from 'react';
import { View } from 'react-native';
import { SHARING_CONSENT_LINES } from '../../lib/buddyCopy';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { Text } from '../ui/text';

export interface SharingConsentSheetProps {
  visible: boolean;
  /** While the consent is being saved: both buttons are disabled. */
  busy?: boolean;
  onAgree: () => void;
  onClose: () => void;
}

// The one-time, versioned sharing consent (spec 2026-10-06 buddies §4): shown on the first switch
// turned on, and again after the consent version is bumped. Closing it agrees to nothing.
export function SharingConsentSheet({ visible, busy = false, onAgree, onClose }: SharingConsentSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sharing-consent-sheet">
      <View testID="sharing-consent" className="gap-3 p-4">
        <Text className="font-display text-display-sm">Share with buddies?</Text>
        {SHARING_CONSENT_LINES.map((line) => (
          <Text key={line} className="text-sm text-muted-foreground">{line}</Text>
        ))}
        <Button testID="sharing-consent-agree" disabled={busy} onPress={onAgree}>I agree</Button>
        <Button testID="sharing-consent-cancel" variant="ghost" disabled={busy} onPress={onClose}>Not now</Button>
      </View>
    </Sheet>
  );
}
