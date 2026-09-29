import React, { useContext, useState } from 'react';
import { View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { revokeCoachConsent, setCoachPersona } from '../api/coach';
import { useCoachStatus } from '../lib/useCoachStatus';
import { COLORS } from '../theme';
import { Text } from './ui/text';
import { SettingsGroup, SettingsRow } from './ui/settings-list';
import { PushNotificationsRow } from './push-notifications-row';

// The AI Coach block on the Settings screen: persona picker and consent
// revocation. It renders nothing at all unless the server says the coach is
// enabled, so a disabled coach leaves no trace in the app.
export function CoachSettingsSection() {
  // Read the context directly (not useNavigation) so Settings still renders
  // outside a navigator.
  const navigation = useContext(NavigationContext);
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const { status, setStatus } = useCoachStatus(navigation ?? undefined);
  const [personaError, setPersonaError] = useState(false);
  const [revokeError, setRevokeError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!status || !status.enabled) return null;

  async function pickPersona(personaId: string) {
    if (!status || busy || personaId === status.personaId) return;
    const previous = status;
    setPersonaError(false);
    setBusy(true);
    // Optimistic, and put back if the server does not accept it.
    setStatus({ ...status, personaId });
    try {
      await setCoachPersona(personaId);
    } catch {
      setStatus(previous);
      setPersonaError(true);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!status || busy) return;
    setRevokeError(false);
    setBusy(true);
    try {
      await revokeCoachConsent();
      setStatus({ ...status, consented: false });
    } catch {
      setRevokeError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!status.consented) {
    return (
      <SettingsGroup testID="coach-settings" label="AI Coach" footer="The AI Coach is off. Nothing is shared with it, and the rest of the app works as normal.">
        <SettingsRow
          testID="coach-setup-button"
          icon="sparkles-outline"
          tint={colors.coach}
          title="Set up AI Coach"
          onPress={() => navigation?.navigate('CoachConsent' as never)}
        />
      </SettingsGroup>
    );
  }

  return (
    <View testID="coach-settings" className="gap-6">
      <SettingsGroup label="Coach style" footer={personaError ? undefined : 'How the coach talks to you.'}>
        {status.personas.map((persona) => {
          const selected = persona.id === status.personaId;
          return (
            <SettingsRow
              key={persona.id}
              testID={`persona-option-${persona.id}`}
              accessibilityRole="radio"
              selected={selected}
              title={persona.name}
              subtitle={`${persona.verbosity} · ${persona.proactivity}`}
              onPress={() => void pickPersona(persona.id)}
              trailing={selected ? <Ionicons name="checkmark" size={20} color={colors.coach} /> : <View />}
            />
          );
        })}
      </SettingsGroup>
      {personaError ? (
        <Text testID="persona-error" className="-mt-4 px-4 text-sm text-destructive">
          That style could not be saved.
        </Text>
      ) : null}

      <SettingsGroup label="AI Coach" footer="Turning it off stops sharing your data with the coach. You can turn it back on any time.">
        <SettingsRow
          testID="coach-memory-row"
          icon="bulb-outline"
          tint={colors.coach}
          title="Coach Memory"
          subtitle="See, edit or delete what the coach remembers"
          onPress={() => navigation?.navigate('CoachMemory' as never)}
        />
        <PushNotificationsRow />
        <SettingsRow
          testID="coach-revoke-button"
          icon="power-outline"
          destructive
          title="Turn off AI Coach"
          disabled={busy}
          onPress={() => void revoke()}
        />
      </SettingsGroup>
      {revokeError ? (
        <Text testID="coach-revoke-error" className="-mt-4 px-4 text-sm text-destructive">
          The AI Coach could not be turned off. Please try again.
        </Text>
      ) : null}
    </View>
  );
}
