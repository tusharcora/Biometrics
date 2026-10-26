import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { messageFor } from '../auth/authErrors';
import { MIN_PASSWORD_LENGTH } from '../auth/passwordPolicy';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { Text } from '../components/ui/text';
import { PageTitle } from '../components/ui/page-title';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { Kip } from '../components/kip/Kip';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

// A lighter take on Sign in's hero: a small coral KIP (signed-out screens have
// no colour of your own yet), a pixel page title and one muted line above the form.
function AuthHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(450)} className="items-center gap-3">
      <Kip testID="auth-kip" colour="coral" pose="wave" mood="idle" scale={3} />
      <PageTitle className="text-center">{title}</PageTitle>
      <Text className="text-center text-body text-muted-foreground">{children}</Text>
    </Animated.View>
  );
}

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
        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-8">
          <AuthHeader title="Check your inbox">
            We sent a link to {sentTo}. Open it on this phone to confirm your email, then sign in.
          </AuthHeader>
          <Button testID="back-to-sign-in" size="lg" className="w-full" onPress={() => navigation.popTo('SignIn')}>
            Back to sign in
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-8" keyboardShouldPersistTaps="handled">
        <AuthHeader title="Create an account">We'll email you a link to confirm it's you.</AuthHeader>
        <View className="gap-3">
          <TextField label="Name" testID="name-input" value={name} onChangeText={setName} autoComplete="name" />
          <TextField label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <TextField label="Password" testID="password-input" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
          {error ? <Text className="text-caption text-destructive">{error}</Text> : null}
          <Button
            testID="sign-up-button"
            size="lg"
            className="mt-2 w-full"
            onPress={submit}
            disabled={busy || !name.trim() || !email.trim() || !password}
          >
            Create account
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
