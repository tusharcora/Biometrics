import React, { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { Text } from '../ui/text';
import type { EditorState } from '../../lib/room/edit/editor';
import { nudgeAnnouncement, outcomeText } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// The editor's notice lines (spec 2026-10-15 §5.3, ruling UI-OUTCOMES): a save that refreshed or failed, a refused
// action's reason, what Apply set left out. Each is a polite live region for Android; iOS has none, so every new
// outcome is announced as it happens (a save's own notices are announced by the save, each time it fails). While
// Move is on, the nudge pad's line says what a move did (spec §5.7), so it is not said twice here.
export function EditNotices({ state }: { state: EditorState }) {
  const padSays = state.nudging && nudgeAnnouncement(state) !== null;
  const said = padSays ? null : outcomeText(state);
  useEffect(() => {
    if (said && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(said.text);
  }, [state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state.notice && !said) return null;
  return (
    <View className="gap-1 px-4 pt-2">
      {state.notice ? (
        <Text testID="edit-notice" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">
          {state.notice === 'refreshed' ? ROOM_COPY.refreshed : ROOM_COPY.saveFailed}
        </Text>
      ) : null}
      {said ? (
        <Text
          testID={said.kind === 'reason' ? 'edit-reason' : 'edit-applied'}
          accessibilityLiveRegion="polite"
          className={said.kind === 'reason' ? 'text-caption text-destructive' : 'text-caption text-muted-foreground'}
        >
          {said.text}
        </Text>
      ) : null}
    </View>
  );
}
