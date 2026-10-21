import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, View, findNodeHandle, type Text as RNText } from 'react-native';
import { ROOM_SWITCH } from '../../lib/buddyCopy';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { Text } from '../ui/text';

const TARGET = 'h-[44px]';

// The room switch's own one-line consent (spec 2026-10-15 §10.1, P4 ruling 20): tapping Turn on is the consent.
// Never the health-sharing consent, and never reset by its version. Closing agrees to nothing. The sheet is a Modal,
// its own window to a screen reader on both platforms, and its title takes the focus when it opens (house pattern).
export function RoomVisitConsentSheet({ visible, busy = false, onTurnOn, onClose }: { visible: boolean; busy?: boolean; onTurnOn: () => void; onClose: () => void }) {
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    if (!visible) return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} testID="room-consent-sheet">
      <View className="gap-3 p-4">
        <Text ref={titleRef} testID="room-consent-title" accessibilityRole="header" className="text-heading">{ROOM_SWITCH.consentTitle}</Text>
        <Text testID="room-consent-line" className="text-body text-muted-foreground">{ROOM_SWITCH.consent}</Text>
        <Button testID="room-consent-on" className={TARGET} disabled={busy} onPress={onTurnOn}>{ROOM_SWITCH.turnOn}</Button>
        <Button testID="room-consent-cancel" variant="outline" className={TARGET} disabled={busy} onPress={onClose}>{ROOM_SWITCH.notNow}</Button>
      </View>
    </Sheet>
  );
}
