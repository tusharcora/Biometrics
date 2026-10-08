import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { buddyErrorCode } from '../../api/buddies';
import { fileReport, type ReportReason, type ReportTargetType } from '../../api/chats';
import { buddyErrorMessage } from '../../lib/buddyCopy';
import { REPORT_REASONS } from '../../lib/chatCopy';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { Text } from '../ui/text';

// Report a message, a Chats note or a camp note (spec §9): pick a reason (one tap files it); the other person is never
// told; then "Also block {name}" is offered. Used by the thread, the inbox's notes row and the Campfire's "Who's here".
// Stacked full-width buttons at lg (plan ruling P4).
export function ReportSheet({ target, name, onClose, onBlock }: {
  target: { type: ReportTargetType; id: string } | null;
  name: string;
  onClose: () => void;
  onBlock: () => void;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const key = target ? `${target.type}:${target.id}` : null;
  useEffect(() => {
    setDone(false);
    setError(null);
  }, [key]);

  const report = async (reason: ReportReason) => {
    if (!target || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await fileReport(target.type, target.id, reason);
      setDone(true);
    } catch (e) {
      setError(buddyErrorMessage(buddyErrorCode(e)));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const what = target?.type === 'message' ? 'message' : target?.type === 'camp_note' ? 'camp note' : 'note';
  return (
    <Sheet visible={target !== null} onClose={onClose} testID="report-sheet">
      {done ? (
        <View className="gap-3 pb-2">
          <Text testID="report-done" className="text-xl font-bold">Thanks for telling us.</Text>
          <Text className="text-sm text-muted-foreground">{`${name} won't be told you reported this.`}</Text>
          <Button testID="report-block" variant="destructive" size="lg" className="w-full" onPress={onBlock}>{`Also block ${name}`}</Button>
          <Button testID="report-close" variant="outline" size="lg" className="w-full" onPress={onClose}>Done</Button>
        </View>
      ) : (
        <View className="gap-3 pb-2">
          <View className="gap-1">
            <Text className="text-xl font-bold">{`Report ${what}`}</Text>
            <Text className="text-sm text-muted-foreground">{`${name} won't be told. Why are you reporting this?`}</Text>
          </View>
          {REPORT_REASONS.map((r) => (
            <Button key={r.reason} testID={`report-${r.reason}`} variant="outline" size="lg" className="w-full" disabled={busy} onPress={() => void report(r.reason)}>
              {r.label}
            </Button>
          ))}
          {error ? <Text testID="report-error" className="text-sm text-destructive">{error}</Text> : null}
        </View>
      )}
    </Sheet>
  );
}
