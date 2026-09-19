import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemePreference } from '../../theme/ThemeProvider';

const ICON_BY_PREFERENCE = {
  system: 'phone-portrait-outline',
  light: 'sunny-outline',
  dark: 'moon-outline',
} as const;

export function ThemeToggle({ color }: { color: string }) {
  const { preference, cyclePreference } = useThemePreference();

  return (
    <Pressable testID="theme-toggle-button" onPress={cyclePreference} hitSlop={8} className="active:opacity-70">
      <Ionicons name={ICON_BY_PREFERENCE[preference]} size={20} color={color} />
    </Pressable>
  );
}
