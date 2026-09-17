import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../auth/AuthContext';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';

export function SignInScreen() {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      signInWithGoogle(response.authentication.idToken);
    }
  }, [response]);

  async function handleAppleSignIn() {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (credential.identityToken) {
      await signInWithApple(credential.identityToken);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center gap-12 p-8">
        <View className="gap-2">
          <Text className="text-4xl font-bold tracking-tight">Biometrics</Text>
          <Text className="text-base text-muted-foreground">Your health data, unified.</Text>
        </View>
        <View className="gap-3">
          <Button testID="apple-sign-in-button" className="w-full bg-foreground" onPress={handleAppleSignIn}>
            <Text className="text-base font-semibold text-background">Sign in with Apple</Text>
          </Button>
          <Button
            testID="google-sign-in-button"
            className="w-full border border-border bg-card"
            onPress={() => promptAsync()}
          >
            <Text className="text-base font-semibold">Sign in with Google</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
