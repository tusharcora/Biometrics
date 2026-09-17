import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Text } from '../components/ui/text';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { METRIC_CONFIG, METRIC_ORDER, type MetricType } from '../theme';

interface BiometricRecord {
  id: string;
  metricType: MetricType;
  value: number;
  recordedAt: string;
}

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

function latestByMetric(records: BiometricRecord[]): Partial<Record<MetricType, BiometricRecord>> {
  const latest: Partial<Record<MetricType, BiometricRecord>> = {};
  for (const record of records) {
    const current = latest[record.metricType];
    if (!current || new Date(record.recordedAt) > new Date(current.recordedAt)) {
      latest[record.metricType] = record;
    }
  }
  return latest;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const [records, setRecords] = useState<BiometricRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    apiFetch<BiometricRecord[]>('/me/biometrics')
      .then(setRecords)
      .catch(() => setError('Something went wrong loading your data.'));
  }, []);

  useEffect(() => {
    // A disconnected Google Health is why the data stops updating, so say so
    // rather than leaving the user staring at silently stale numbers.
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => setConnectionStatus(res?.status ?? null))
      .catch(() => setConnectionStatus(null));
  }, []);

  const latest = useMemo(() => latestByMetric(records ?? []), [records]);

  // Rendered on every branch so signing out is always reachable.
  const signOutButton = (
    <Button testID="sign-out-button" variant="ghost" size="sm" onPress={() => signOut()}>
      Sign Out
    </Button>
  );

  if (connectionStatus === 'DISCONNECTED') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-xl font-semibold">Reconnect your Google Health</Text>
          <Text className="text-center text-muted-foreground">
            Your Google Health is disconnected, so your data has stopped updating.
          </Text>
          <Button testID="reconnect-health-button" onPress={() => navigation.navigate('ConnectHealth')}>
            Reconnect Google Health
          </Button>
          {signOutButton}
        </View>
      </SafeAreaView>
    );
  }

  if (error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">{error}</Text>
          {signOutButton}
        </View>
      </SafeAreaView>
    );
  }

  if (records === null) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="gap-3 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      </SafeAreaView>
    );
  }

  if (records.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Text className="text-center text-muted-foreground">
            No data yet — check back after your Google Health syncs.
          </Text>
          {signOutButton}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold">Today</Text>
              {signOutButton}
            </View>
            <View className="flex-row flex-wrap gap-3">
              {METRIC_ORDER.map((type) => {
                const record = latest[type];
                if (!record) return null;
                const config = METRIC_CONFIG[type];
                return (
                  <Card key={type} className="w-[47%] grow">
                    <CardHeader>
                      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {config.label}
                      </Text>
                    </CardHeader>
                    <CardContent>
                      <Text className="text-2xl font-bold" style={{ fontVariant: ['tabular-nums'] }}>
                        {config.format(record.value)}
                      </Text>
                    </CardContent>
                  </Card>
                );
              })}
            </View>
            <Text className="text-sm font-semibold text-muted-foreground">History</Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = METRIC_CONFIG[item.metricType];
          return (
            <View className="flex-row items-center justify-between border-b border-border py-3">
              <Text className="font-medium">{config?.label ?? item.metricType}</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{config ? config.format(item.value) : item.value}</Text>
              <Text className="text-muted-foreground">{new Date(item.recordedAt).toDateString()}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
});
