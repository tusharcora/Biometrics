import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { useSync } from '../sync/SyncProvider';
import { formatLastSynced } from '../sync/formatLastSynced';
import { Text } from './ui/text';
import { COLORS } from '../theme';

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Under the "Today" title: whether the data is current, and a tap to sync now.
export function SyncStatusLine() {
  const { state, lastSyncedAt, connection, syncNow } = useSync();
  const navigation = useNavigation<any>();
  const now = useMinuteClock();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  if (connection === 'DISCONNECTED') {
    return (
      <Pressable
        testID="sync-status-line"
        accessibilityRole="button"
        accessibilityLabel="Google Health is disconnected. Reconnect."
        onPress={() => navigation.navigate('ConnectHealth')}
        className="active:opacity-60"
      >
        <Text className="text-xs text-destructive">Google Health disconnected · Reconnect</Text>
      </Pressable>
    );
  }
  if (connection !== 'CONNECTED' || state === 'unknown') return null;

  if (state === 'syncing') {
    return (
      <Pressable
        testID="sync-status-line"
        accessibilityRole="button"
        accessibilityLabel="Syncing with Google Health"
        disabled
        className="flex-row items-center gap-1.5"
      >
        <ActivityIndicator size="small" color={colors.muted} />
        <Text className="text-xs text-muted-foreground">Syncing with Google Health…</Text>
      </Pressable>
    );
  }

  const text =
    state === 'failed'
      ? "Couldn't sync · Tap to retry"
      : lastSyncedAt
        ? formatLastSynced(lastSyncedAt, now)
        : 'Not synced yet · Tap to sync';
  return (
    <Pressable
      testID="sync-status-line"
      accessibilityRole="button"
      accessibilityLabel={`${text}. Double tap to sync now.`}
      onPress={() => void syncNow('manual')}
      className="active:opacity-60"
    >
      <Text className={`text-xs ${state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{text}</Text>
    </Pressable>
  );
}
