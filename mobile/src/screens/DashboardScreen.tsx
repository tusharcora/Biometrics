import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface BiometricRecord {
  id: string;
  metricType: string;
  value: number;
  recordedAt: string;
}

type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONNECTED';

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
    // A disconnected Fitbit is why the data stops updating, so say so rather
    // than leaving the user staring at silently stale numbers.
    apiFetch<{ status: ConnectionStatus }>('/me/connection')
      .then((res) => setConnectionStatus(res?.status ?? null))
      .catch(() => setConnectionStatus(null));
  }, []);

  // Rendered on every branch so signing out is always reachable.
  const signOutButton = (
    <Pressable testID="sign-out-button" style={styles.signOut} onPress={() => signOut()}>
      <Text style={styles.signOutText}>Sign Out</Text>
    </Pressable>
  );

  if (connectionStatus === 'DISCONNECTED') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Reconnect your Fitbit</Text>
        <Text style={styles.body}>
          Your Fitbit is disconnected, so your data has stopped updating.
        </Text>
        <Pressable
          testID="reconnect-fitbit-button"
          style={styles.button}
          onPress={() => navigation.navigate('ConnectFitbit')}
        >
          <Text style={styles.buttonText}>Reconnect Fitbit</Text>
        </Pressable>
        {signOutButton}
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.container}>
        <Text>{error}</Text>
        {signOutButton}
      </View>
    );
  }

  if (records === null) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <View style={styles.container}>
        <Text>No data yet — check back after your Fitbit syncs.</Text>
        {signOutButton}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.metric}>{item.metricType}</Text>
            <Text>{item.value}</Text>
            <Text style={styles.date}>{new Date(item.recordedAt).toDateString()}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>{signOutButton}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  footer: { padding: 16, alignItems: 'center' },
  signOut: { paddingVertical: 10, paddingHorizontal: 20 },
  signOutText: { color: '#c0392b', fontSize: 16 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  body: { textAlign: 'center', color: '#555' },
  button: { backgroundColor: '#00b0b9', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  metric: { fontWeight: '600' },
  date: { color: '#888' },
});
