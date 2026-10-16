import React, { useEffect } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { Text } from '../ui/text';
import type { EditorState } from '../../lib/room/edit/editor';
import { nudgeAnnouncement, outcomeText } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// The editor's notice lines (spec 2026-10-15 §5.3, ruling UI-OUTCOMES): a save that refreshed or failed, a refused
// action's reason, what Apply set left out. A save's notice is a polite live region for Android, and the save
// announces it on iOS each time it fails. An outcome (a reason, a set applied) is announced on both platforms, once per
// outcome (ruling T14-FIX), so it is no live region: the same refusal twice ("Effects 3 of 3", pressed again) is said
// twice, and never twice over.
// While Move is on, a move's result (where it went, or why not) takes the outcome's place here, pinned under the room
// (ruling T14-FIX). The screen announces it on both platforms once per press, so that line is no live region: the
// same refusal twice is still said twice, and never said twice over.
export function EditNotices({ state }: { state: EditorState }) {
  const moved = state.nudging ? nudgeAnnouncement(state) : null;
  const said = moved ? null : outcomeText(state);
  useEffect(() => {
    if (said) AccessibilityInfo.announceForAccessibility(said.text);
  }, [state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state.notice && !said && !moved) return null;
  return (
    <View className="gap-1 px-4 pt-2">
      {state.notice ? (
        <Text testID="edit-notice" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">
          {state.notice === 'refreshed' ? ROOM_COPY.refreshed : ROOM_COPY.saveFailed}
        </Text>
      ) : null}
      {moved ? (
        <Text testID="edit-nudge-status" className={state.outcome?.ok ? 'text-caption text-muted-foreground' : 'text-caption text-destructive'}>
          {moved}
        </Text>
      ) : null}
      {said ? (
        <Text
          testID={said.kind === 'reason' ? 'edit-reason' : 'edit-applied'}
          className={said.kind === 'reason' ? 'text-caption text-destructive' : 'text-caption text-muted-foreground'}
        >
          {said.text}
        </Text>
      ) : null}
    </View>
  );
}
