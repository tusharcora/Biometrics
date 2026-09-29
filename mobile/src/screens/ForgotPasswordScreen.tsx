import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { messageFor } from '../auth/authErrors';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { StillOrb } from '../components/ui/still-orb';

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
      <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-8" keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(450)} className="items-center gap-3">
          <StillOrb size={56} />
          <Text className="text-center font-display text-display-lg">Reset your password</Text>
          {sent ? (
            <Text testID="reset-sent" className="text-center text-base text-muted-foreground">
              If an account uses {email.trim()}, we sent it a link. Open it on this phone.
            </Text>
          ) : (
            <Text className="text-center text-base text-muted-foreground">Enter your email and we'll send you a link to choose a new one.</Text>
          )}
        </Animated.View>
        {sent ? (
          <Button className="w-full py-4" onPress={() => navigation.popTo('SignIn')}>
            Back to sign in
          </Button>
        ) : (
          <View className="gap-3">
            <TextField label="Email" testID="email-input" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
            {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
            <Button testID="send-reset-button" className="mt-2 w-full py-4" onPress={submit} disabled={busy || !email.trim()}>
              Send reset link
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
