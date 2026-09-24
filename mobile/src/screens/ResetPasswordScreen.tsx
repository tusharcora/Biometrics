import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { messageFor } from '../auth/authErrors';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { MIN_PASSWORD_LENGTH } from './SignUpScreen';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

const EXPIRED = 'This link has expired. Ask for a new one.';

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { resetPassword } = useAuth();
  const token = route.params?.token;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : EXPIRED);

  async function submit() {
    if (!token) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      navigation.navigate('SignIn', undefined);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 p-8" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold">Choose a new password</Text>
        {token ? (
          <>
            <TextField label="New password" testID="password-input" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
            <Button testID="reset-password-button" onPress={submit} disabled={busy || !password}>
              Save password
            </Button>
          </>
        ) : null}
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        {error === EXPIRED ? (
          <Button variant="ghost" onPress={() => navigation.navigate('ForgotPassword')}>
            Send a new link
          </Button>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
