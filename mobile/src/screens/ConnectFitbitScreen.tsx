import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const REDIRECT_URI = 'biometrics://fitbit/callback';

export function ConnectFitbitScreen() {
  const navigation = useNavigation<any>();

  async function handleConnect() {
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_BASE_URL}/fitbit/authorize`,
      REDIRECT_URI,
    );
    if (result.type === 'success' && result.url.includes('status=connected')) {
      navigation.navigate('Dashboard');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your Fitbit</Text>
      <Pressable testID="connect-fitbit-button" style={styles.button} onPress={handleConnect}>
        <Text style={styles.buttonText}>Connect Fitbit</Text>
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
