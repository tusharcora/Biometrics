import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { fetchIdentity, type BuddyIdentity } from '../api/buddies';
import { HandleSetupForm } from '../components/buddies/HandleSetupForm';
import { useToast } from '../components/ui/toast';
import { Text } from '../components/ui/text';
import { refreshBuddies } from '../lib/buddiesStore';

// Profile → Buddies → your buddy name: change the handle (the old one is held 30 days) or the name.
export function BuddyIdentityScreen() {
  const navigation = useNavigation() as unknown as { goBack: () => void };
  const toast = useToast();
  const [identity, setIdentity] = useState<BuddyIdentity | null | 'error'>(null);
  useEffect(() => {
    fetchIdentity().then(setIdentity).catch(() => setIdentity('error'));
  }, []);
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      {identity === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : identity === 'error' ? (
        <Text testID="buddy-identity-screen-error" className="p-6 text-muted-foreground">Couldn't load your buddy name.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <HandleSetupForm
            identity={identity}
            mode={identity.handle ? 'edit' : 'setup'}
            onSaved={() => {
              void refreshBuddies();
              toast.show('Saved', 'success');
              navigation.goBack();
            }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
