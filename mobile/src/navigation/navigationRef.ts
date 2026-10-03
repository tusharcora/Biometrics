import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './RootNavigator';

// The signed-in NavigationContainer's ref, for navigating from outside a screen
// (a tapped notification). The signed-out stack has its own container and never
// gets this ref, so isReady() is only true while the signed-in app is mounted.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
