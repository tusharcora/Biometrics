import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { acceptCoachConsent, fetchCoachStatus, StaleConsentVersionError, type CoachStatusDTO } from '../api/coach';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { SettingsGroup, SettingsRow } from '../components/ui/settings-list';
import { Kip } from '../components/kip/Kip';
import { useMyKipColour } from '../lib/kip/myKip';
import { KIP_COPY } from '../lib/kipCopy';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { navigateToCoachEntry } from '../navigation/coachNavigation';

type ConsentRoute = RouteProp<RootStackParamList, 'CoachConsent'>;

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; coach: CoachStatusDTO };

// The dedicated opt-in for KIP coaching (spec 5). It states what leaves the
// device using the server's own words, and needs a deliberate "I agree" press:
// there is no pre-ticked box and nothing is sent by merely opening the screen.
// Declining is a complete, first-class outcome -- the rest of the app never
// depends on the coach. In review mode (Settings → KIP, KIP Coach §7.5) a
// consented user reads the same text with nothing to agree to.
export function CoachConsentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ConsentRoute>();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const prefill = route?.params?.prefill;
  // Opened from Settings → KIP → "What is sent when you ask something" (spec §7.5).
  const review = route?.params?.review === true;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the server has rejected our version: the text on screen is then
  // the new one, and the user has to agree to it afresh.
  const [textChanged, setTextChanged] = useState(false);
  const mine = useMyKipColour();

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const coach = await fetchCoachStatus();
      setState({ status: 'ready', coach });
      return coach;
    } catch {
      setState({ status: 'error' });
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const alreadyConsented = state.status === 'ready' && state.coach.enabled && state.coach.consented;
  // In review mode a consented user stays here to read what is sent.
  const reviewing = review && alreadyConsented;
  useEffect(() => {
    // The server is authoritative: if it already counts the current version as
    // accepted there is nothing to ask.
    if (alreadyConsented && !review) navigateToCoachEntry(navigation, 'Coach', prefill);
  }, [alreadyConsented, review, navigation, prefill]);

  async function agree(version: string) {
    setSubmitting(true);
    setError(null);
    try {
      await acceptCoachConsent(version);
      navigateToCoachEntry(navigation, 'Coach', prefill);
    } catch (e) {
      if (e instanceof StaleConsentVersionError) {
        setTextChanged(true);
        await load();
      } else {
        setError('We could not save your choice. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' || (alreadyConsented && !reviewing)) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View testID="coach-consent-loading" className="gap-5 px-5 pt-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Kip testID="coach-consent-kip" colour={mine} pose="wave" mood="curious" scale={3} />
          <Text className="text-center text-muted-foreground">Something went wrong loading this screen.</Text>
          <Button testID="coach-consent-retry" variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { coach } = state;

  if (!coach.enabled) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View testID="coach-consent-unavailable" className="flex-1 items-center justify-center gap-4 px-8">
          <Kip testID="coach-consent-kip" colour={mine} pose="wave" mood="curious" scale={3} />
          <Text className="text-center text-muted-foreground">{KIP_COPY.unavailable}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ gap: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <View testID={reviewing ? 'coach-consent-review' : undefined} className="items-start gap-4">
          <Kip testID="coach-consent-kip" colour={mine} pose="wave" mood="curious" scale={3} />
          {reviewing ? null : (
            <Text className="text-display" accessibilityRole="header">
              {KIP_COPY.consentHeadingFull}
            </Text>
          )}
        </View>

        {textChanged ? (
          <View testID="coach-consent-updated-note" className="flex-row items-start gap-2.5 rounded-tile border border-coach/25 bg-coach/10 px-4 py-3">
            <Ionicons name="refresh-outline" size={16} color={colors.coach} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-body">
              This has changed since you last looked. Please read it again before you decide.
            </Text>
          </View>
        ) : null}

        <Card className="gap-3 p-5">
          <Text className="text-body">{coach.consent.summary}</Text>
        </Card>

        <SettingsGroup label={KIP_COPY.whatIsSent}>
          {coach.consent.dataItems.map((item) => (
            <SettingsRow key={item} title={item} icon="arrow-up-circle-outline" tint={colors.coach} />
          ))}
        </SettingsGroup>

        {reviewing ? null : (
          <>
            <View className="flex-row items-start gap-2.5 px-1">
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
              <Text testID="coach-consent-decline-note" className="flex-1 text-caption text-muted-foreground">
                {KIP_COPY.consentDeclineNote}
              </Text>
            </View>

            {error ? (
              <Text testID="coach-consent-error" className="text-caption text-destructive">
                {error}
              </Text>
            ) : null}

            <View className="gap-2">
              <Button testID="coach-consent-agree" size="lg" disabled={submitting} onPress={() => void agree(coach.consent.version)}>
                I agree
              </Button>
              <Button testID="coach-consent-decline" variant="outline" size="lg" disabled={submitting} onPress={() => navigation.goBack()}>
                Not now
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
