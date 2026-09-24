import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { authClient } from '../auth/authClient';
import { unwrap, messageFor } from '../auth/authErrors';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface DeviceSession {
  id: string;
  token: string;
  userAgent?: string | null;
  updatedAt: string | Date;
}

export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/iPhone|Darwin|iOS/i.test(userAgent)) return 'iPhone';
  if (/Android|okhttp/i.test(userAgent)) return 'Android device';
  return 'Unknown device';
}

export function DevicesScreen() {
  const { data } = authClient.useSession();
  const currentToken = data?.session?.token;
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await unwrap<DeviceSession[]>(authClient.listSessions()));
    } catch (err) {
      setError(messageFor(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await load();
      } catch (err) {
        setError(messageFor(err));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const others = sessions?.filter((s) => s.token !== currentToken) ?? [];

  return (
    <ScrollView contentContainerClassName="gap-3 p-4">
      {sessions?.map((s) => (
        <Card key={s.id} testID={`device-${s.id}`} className="flex-row items-center justify-between">
          <View className="gap-1">
            <Text className="text-base font-medium">{describeDevice(s.userAgent)}</Text>
            <Text className="text-xs text-muted-foreground">Last active {new Date(s.updatedAt).toLocaleDateString()}</Text>
          </View>
          {s.token === currentToken ? (
            <Badge testID={`this-device-badge-${s.id}`} variant="accent">
              This device
            </Badge>
          ) : (
            <Button
              testID={`revoke-${s.id}`}
              variant="ghost"
              disabled={busy}
              // Better Auth revokes another device's session by its token.
              onPress={() => act(() => unwrap(authClient.revokeSession({ token: s.token })))}
            >
              Sign out
            </Button>
          )}
        </Card>
      ))}
      {others.length > 0 ? (
        <Button
          testID="revoke-others-button"
          variant="ghost"
          disabled={busy}
          onPress={() => act(() => unwrap(authClient.revokeOtherSessions()))}
        >
          Sign out all other devices
        </Button>
      ) : null}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </ScrollView>
  );
}
