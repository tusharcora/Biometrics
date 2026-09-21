import './global.css';
import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { applyDefaultThemeSync } from './src/theme/preference';
import { ThemedStatusBar } from './src/components/themed-status-bar';
import { OrbGalleryScreen } from './src/screens/dev/OrbGalleryScreen';
import { setBaseUrl } from './src/api/client';

applyDefaultThemeSync();
setBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000');

export default function App() {
  // Dev-only escape hatch for looking at every orb state: EXPO_PUBLIC_ORB_GALLERY=1
  if (__DEV__ && process.env.EXPO_PUBLIC_ORB_GALLERY === '1') {
    return <OrbGalleryScreen />;
  }

  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
