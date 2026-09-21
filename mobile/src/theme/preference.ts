import * as SecureStore from 'expo-secure-store';
import { colorScheme } from 'nativewind';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'themePreference';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

// Restores the persisted choice into NativeWind's color scheme at app start.
// Call once, before the first render that reads colors.
export async function restoreThemePreference(): Promise<ThemePreference> {
  const stored = await SecureStore.getItemAsync(STORAGE_KEY);
  const preference = isThemePreference(stored) ? stored : 'dark';
  colorScheme.set(preference);
  return preference;
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  colorScheme.set(preference);
  await SecureStore.setItemAsync(STORAGE_KEY, preference);
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  // Cycle: system -> light -> dark -> system, so the icon always has a
  // single, discoverable next state to tap toward.
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}
