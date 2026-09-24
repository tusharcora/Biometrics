import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { useGoogleIdToken } from '../auth/useGoogleIdToken';
import { AuthError, messageFor } from '../auth/authErrors';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation, route }: Props) {
  const { signInWithApple, signInWithGoogle, signInWithEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [notice, setNotice] = useState<string | null>(route.params?.verified ? 'Email confirmed. Sign in to continue.' : null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      await action();
    } catch (err) {
      setError(messageFor(err));
      setUnverified(err instanceof AuthError && err.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      setBusy(false);
    }
  }, []);

  const google = useGoogleIdToken(useCallback((idToken: string) => void run(() => signInWithGoogle(idToken)), [run, signInWithGoogle]));

  async function handleApple() {
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
    } catch {
      return; // The user closed the Apple sheet.
    }
    if (credential.identityToken) {
      const token = credential.identityToken;
      await run(() => signInWithApple(token, credential.fullName));
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-grow justify-center gap-10 p-8" keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(450)} className="gap-2">
          <Text className="text-4xl font-bold tracking-tight">Biometrics</Text>
          <Text className="text-base text-muted-foreground">Your health data, unified.</Text>
        </Animated.View>
        {notice ? <Text className="text-sm text-foreground">{notice}</Text> : null}
        <Animated.View entering={FadeInDown.delay(120).duration(450)} className="gap-3">
          <Button testID="apple-sign-in-button" className="w-full bg-foreground" onPress={handleApple} disabled={busy}>
            <Text className="text-base font-semibold text-background">Sign in with Apple</Text>
          </Button>
          <Button testID="google-sign-in-button" className="w-full border border-border bg-card" onPress={() => google.prompt()} disabled={busy || !google.ready}>
            <Text className="text-base font-semibold">Sign in with Google</Text>
          </Button>
        </Animated.View>
        <View className="gap-3">
          <TextField label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <TextField label="Password" testID="password-input" value={password} onChangeText={setPassword} secure autoComplete="password" />
          {error ? <Text testID="sign-in-error" className="text-sm text-destructive">{error}</Text> : null}
          {unverified ? (
            <Button
              testID="resend-verification-button"
              variant="ghost"
              onPress={() => run(async () => { await resendVerification(email); setNotice('We sent you a new link.'); })}
            >
              Resend confirmation email
            </Button>
          ) : null}
          <Button testID="email-sign-in-button" className="w-full" onPress={() => run(() => signInWithEmail(email, password))} disabled={busy || !email || !password}>
            Sign in
          </Button>
          <Button testID="forgot-password-link" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')}>
            Forgot password?
          </Button>
          <Button testID="create-account-link" variant="ghost" onPress={() => navigation.navigate('SignUp')}>
            Create an account
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
