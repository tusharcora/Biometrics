import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSync } from '../sync/SyncProvider';
import { formatLastSynced } from '../sync/formatLastSynced';
import { Button } from './ui/button';

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Under the "Today" title: whether the data is current, and a tap to sync now.
// A quiet link: muted (or destructive) text rather than the link's foreground.
export function SyncStatusLine() {
  const { state, lastSyncedAt, connection, syncNow } = useSync();
  const navigation = useNavigation<any>();
  const now = useMinuteClock();

  if (connection === 'DISCONNECTED') {
    return (
      <Button
        testID="sync-status-line"
        variant="link"
        size="xs"
        accessibilityLabel="Google Health is disconnected. Reconnect."
        onPress={() => navigation.navigate('ConnectHealth')}
        className="self-start"
        textClassName="text-destructive"
      >
        Google Health disconnected · Reconnect
      </Button>
    );
  }
  if (connection !== 'CONNECTED' || state === 'unknown') return null;

  if (state === 'syncing') {
    return (
      <Button
        testID="sync-status-line"
        variant="link"
        size="xs"
        accessibilityLabel="Syncing with Google Health"
        loading
        className="self-start"
        textClassName="text-muted-foreground no-underline"
      >
        Syncing with Google Health…
      </Button>
    );
  }

  const text =
    state === 'failed'
      ? "Couldn't sync · Tap to retry"
      : lastSyncedAt
        ? formatLastSynced(lastSyncedAt, now)
        : 'Not synced yet · Tap to sync';
  return (
    <Button
      testID="sync-status-line"
      variant="link"
      size="xs"
      accessibilityLabel={`${text}. Double tap to sync now.`}
      onPress={() => void syncNow('manual')}
      className="self-start"
      textClassName={state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}
    >
      {text}
    </Button>
  );
}
