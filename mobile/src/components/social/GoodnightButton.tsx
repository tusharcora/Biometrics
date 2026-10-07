// "Say goodnight" (spec 2026-10-07 social §6.1), on the Campfire page and under the evening timeline. Once said:
// "Goodnight said" (", on time" when it was), with Undo until the server's `undoUntil` — the button disappears by
// itself when it passes. `onChanged` re-reads whatever shows the goodnight. A refusal shows the server's reason in words.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { buddyErrorCode } from '../../api/buddies';
import { sayGoodnight, undoGoodnight, type Goodnight } from '../../api/social';
import { buddyErrorMessage } from '../../lib/buddyCopy';
import { goodnightSaidLine } from '../../lib/socialCopy';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

export function GoodnightButton({ goodnight, onChanged, testID = 'goodnight' }: { goodnight: Goodnight | null; onChanged: () => void; testID?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Bumped when the undo window closes, only to re-render; the check below reads the clock itself, so a goodnight
  // that arrives after mount (said, or refreshed) is never judged against a stale time.
  const [, setTick] = useState(0);
  // `busy` disables the button only after a re-render; a double tap in one frame sends once.
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The server's deadline (capped at the next 06:00), never computed from `at`; an unreadable one offers no Undo.
  const parsed = goodnight ? Date.parse(goodnight.undoUntil) : NaN;
  const undoUntil = Number.isNaN(parsed) ? 0 : parsed;
  // Re-render when the undo window closes, so Undo goes away by itself.
  useEffect(() => {
    const left = undoUntil - Date.now();
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setTick((t) => t + 1), left + 1);
    return () => clearTimeout(timer);
  }, [undoUntil]);

  async function run(action: () => Promise<unknown>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      if (mounted.current) setMessage(buddyErrorMessage(buddyErrorCode(e)));
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View className="gap-2">
      {goodnight ? (
        <View className="flex-row items-center justify-between gap-2">
          <Text testID={`${testID}-said`} className="text-sm font-semibold">{goodnightSaidLine(goodnight)}</Text>
          {undoUntil > Date.now() ? (
            <Button testID={`${testID}-undo`} variant="secondary" size="sm" disabled={busy} onPress={() => void run(undoGoodnight)}>Undo</Button>
          ) : null}
        </View>
      ) : (
        <Button testID={`${testID}-say`} disabled={busy} onPress={() => void run(sayGoodnight)}>Say goodnight</Button>
      )}
      {message ? <Text testID={`${testID}-message`} className="text-sm text-destructive">{message}</Text> : null}
    </View>
  );
}
