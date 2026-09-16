import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { apiFetch } from '../api/client';

interface BiometricRecord {
  id: string;
  metricType: string;
  value: number;
  recordedAt: string;
}

export function DashboardScreen() {
  const [records, setRecords] = useState<BiometricRecord[] | null>(null);

  useEffect(() => {
    apiFetch<BiometricRecord[]>('/me/biometrics').then(setRecords);
  }, []);

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
      </View>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  metric: { fontWeight: '600' },
  date: { color: '#888' },
});
