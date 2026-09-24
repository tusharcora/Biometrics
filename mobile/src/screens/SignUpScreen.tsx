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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const MIN_PASSWORD_LENGTH = 8;

export function SignUpScreen({ navigation }: Props) {
  const { signUpWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      await signUpWithEmail({ name, email, password });
      // Shown whether or not the address already had an account: the server
      // answers both the same way, and so does the app.
      setSentTo(email.trim());
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="flex-grow justify-center gap-6 p-8">
          <Text className="text-2xl font-bold">Check your inbox</Text>
          <Text className="text-base text-muted-foreground">
            We sent a link to {sentTo}. Open it on this phone to confirm your email, then sign in.
          </Text>
          <Button testID="back-to-sign-in" onPress={() => navigation.popTo('SignIn')}>
            Back to sign in
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 p-8" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold">Create an account</Text>
        <TextField label="Name" testID="name-input" value={name} onChangeText={setName} autoComplete="name" />
        <TextField label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        <TextField label="Password" testID="password-input" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button testID="sign-up-button" onPress={submit} disabled={busy || !name.trim() || !email.trim() || !password}>
          Create account
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
