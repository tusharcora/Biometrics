import React, { useContext } from 'react';
import { Pressable } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useOptionalAuth } from '../auth/AuthContext';
import { Card } from './ui/card';
import { Text } from './ui/text';

// Settings -> Account. Uses the navigation context rather than useNavigation()
// because Settings is also rendered without a navigator (see SettingsScreen),
// and the optional auth hook for the same reason. Sign out lives here now that
// Home no longer carries it in its header.
export function AccountSection() {
  const navigation = useContext(NavigationContext);
  const auth = useOptionalAuth();
  return (
    <Card className="gap-3">
      <Pressable testID="sign-in-methods-row" onPress={() => navigation?.navigate('SignInMethods' as never)} className="active:opacity-70">
        <Text className="text-base font-medium">Sign-in methods</Text>
        <Text className="text-xs text-muted-foreground">Apple, Google, email and password</Text>
      </Pressable>
      <Pressable testID="devices-row" onPress={() => navigation?.navigate('Devices' as never)} className="active:opacity-70">
        <Text className="text-base font-medium">Devices</Text>
        <Text className="text-xs text-muted-foreground">Where you are signed in</Text>
      </Pressable>
      {auth ? (
        <Pressable testID="sign-out-button" accessibilityRole="button" onPress={() => auth.signOut()} className="active:opacity-70">
          <Text className="text-base font-medium">Sign out</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
