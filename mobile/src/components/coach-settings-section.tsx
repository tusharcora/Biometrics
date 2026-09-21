import React, { useContext, useState } from 'react';
import { View, Pressable } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { revokeCoachConsent, setCoachPersona } from '../api/coach';
import { useCoachStatus } from '../lib/useCoachStatus';
import { COLORS } from '../theme';
import { Text } from './ui/text';
import { Card } from './ui/card';
import { Button } from './ui/button';

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
      <Card testID="coach-settings" className="gap-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          <Text className="text-base font-semibold">AI Coach</Text>
        </View>
        <Text className="text-sm text-muted-foreground">
          The AI Coach is off. Nothing is shared with it, and the rest of the app works as normal.
        </Text>
        <Button testID="coach-setup-button" variant="ghost" onPress={() => navigation?.navigate('CoachConsent' as never)}>
          Set up AI Coach
        </Button>
      </Card>
    );
  }

  return (
    <Card testID="coach-settings" className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
        <Text className="text-base font-semibold">AI Coach</Text>
      </View>

      <Text className="text-sm text-muted-foreground">Coach style</Text>
      <View className="gap-1">
        {status.personas.map((persona) => {
          const selected = persona.id === status.personaId;
          return (
            <Pressable
              key={persona.id}
              testID={`persona-option-${persona.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void pickPersona(persona.id)}
              className="flex-row items-center gap-3 py-2 active:opacity-70"
            >
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.accent : colors.muted} />
              <View className="flex-1">
                <Text className={selected ? 'font-semibold' : ''}>{persona.name}</Text>
                <Text className="text-xs text-muted-foreground">{`${persona.verbosity} · ${persona.proactivity}`}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {personaError ? (
        <Text testID="persona-error" className="text-sm text-destructive">
          That style could not be saved.
        </Text>
      ) : null}

      <Pressable
        testID="coach-memory-row"
        accessibilityRole="button"
        onPress={() => navigation?.navigate('CoachMemory' as never)}
        className="flex-row items-center gap-3 py-2 active:opacity-70"
      >
        <Ionicons name="bookmarks-outline" size={20} color={colors.muted} />
        <View className="flex-1">
          <Text className="font-medium">Coach Memory</Text>
          <Text className="text-xs text-muted-foreground">See, edit or delete what the coach remembers</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Button testID="coach-revoke-button" variant="destructive" disabled={busy} onPress={() => void revoke()}>
        Turn off AI Coach
      </Button>
      <Text className="text-xs text-muted-foreground">
        Stops sharing your data with the coach. You can turn it back on any time.
      </Text>
      {revokeError ? (
        <Text testID="coach-revoke-error" className="text-sm text-destructive">
          The AI Coach could not be turned off. Please try again.
        </Text>
      ) : null}
    </Card>
  );
}
