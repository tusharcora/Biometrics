import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { StickerKind } from '../../api/buddies';
import { COLORS } from '../../theme';
import { Text } from '../ui/text';

export function StickerButton({ kind, label, icon, disabled, onPress }: {
  kind: StickerKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  return (
    <Pressable
      testID={`sticker-${kind}`}
      accessibilityRole="button"
      accessibilityLabel={`Send a ${label}`}
      disabled={disabled}
      onPress={onPress}
      className="flex-1 items-center gap-1 rounded-card border border-border bg-card py-3 active:opacity-70"
    >
      <Ionicons name={icon} size={26} color={colors.accent} />
      <Text className="text-xs">{label}</Text>
    </Pressable>
  );
}
