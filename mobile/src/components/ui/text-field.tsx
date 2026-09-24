import React from 'react';
import { TextInput, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from './text';
import { COLORS } from '../../theme';

export interface TextFieldProps {
  label: string;
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
}

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
        placeholderTextColor={colors.muted}
        className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
      />
    </View>
  );
}
