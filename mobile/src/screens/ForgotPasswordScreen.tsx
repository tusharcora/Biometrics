import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { messageFor } from '../auth/authErrors';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 p-8" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold">Reset your password</Text>
        {sent ? (
          <>
            <Text testID="reset-sent" className="text-base text-muted-foreground">
              If an account uses {email.trim()}, we sent it a link. Open it on this phone.
            </Text>
            <Button onPress={() => navigation.navigate('SignIn', undefined)}>Back to sign in</Button>
          </>
        ) : (
          <>
            <TextField label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <Button testID="send-reset-button" onPress={submit} disabled={busy || !email.trim()}>
              Send reset link
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
