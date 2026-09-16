import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { apiFetch } from '../api/client';

const REDIRECT_URI = 'biometrics://health/callback';

export function ConnectHealthScreen() {
  const navigation = useNavigation<any>();

  async function handleConnect() {
    // /health/authorize is authenticated and returns the Google Health URL as JSON
    // (apiFetch attaches the token). We cannot point the system browser at it
    // directly, because a browser navigation carries no Authorization header.
    const { url } = await apiFetch<{ url: string }>('/health/authorize');
    const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
    if (result.type === 'success' && result.url.includes('status=connected')) {
      navigation.navigate('Dashboard');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your Google Health</Text>
      <Pressable testID="connect-health-button" style={styles.button} onPress={handleConnect}>
        <Text style={styles.buttonText}>Connect Google Health</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  button: { backgroundColor: '#00b0b9', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});
