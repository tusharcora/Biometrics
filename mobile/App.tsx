import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { setBaseUrl } from './src/api/client';

setBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000');

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
