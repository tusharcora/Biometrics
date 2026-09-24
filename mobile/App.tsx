import './global.css';
import React from 'react';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { applyDefaultThemeSync } from './src/theme/preference';
import { ThemedStatusBar } from './src/components/themed-status-bar';
import { OrbGalleryScreen } from './src/screens/dev/OrbGalleryScreen';
import { setBaseUrl } from './src/api/client';
import { API_BASE_URL } from './src/auth/authClient';

applyDefaultThemeSync();
setBaseUrl(API_BASE_URL);

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
