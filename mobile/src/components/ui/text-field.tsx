import React from 'react';
import { TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from './text';
import { COLORS, FONTS } from '../../theme';

export interface TextFieldProps {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
}

const TEXT_CONTENT_TYPE = {
  email: 'username',
  password: 'password',
  'new-password': 'newPassword',
  name: 'name',
  none: 'none',
} as const;

export function TextField({ label, testID, value, onChangeText, secure, keyboardType = 'default', autoComplete }: TextFieldProps) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  return (
    <View className="gap-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' || secure ? 'none' : 'words'}
        autoCorrect={false}
        autoComplete={autoComplete}
        // iOS AutoFill (and the Passwords app) key off textContentType, not
        // autoComplete, to offer a saved login above the keyboard.
        textContentType={TEXT_CONTENT_TYPE[autoComplete ?? 'none']}
        placeholderTextColor={colors.muted}
        style={{ fontFamily: FONTS.sans }}
        className="rounded-tile border border-border bg-card px-4 py-3 text-base text-foreground"
      />
    </View>
  );
}
