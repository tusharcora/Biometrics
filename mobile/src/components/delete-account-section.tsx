import React, { useRef, useState } from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { ApiError, deleteAccount } from '../api/client';
import { useOptionalAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';
import { Text } from './ui/text';
import { Card } from './ui/card';
import { Button } from './ui/button';

const CONFIRM_WORD = 'DELETE';

// "Delete account" block at the bottom of Settings (App Store requires an
// in-app way to delete an account). Tapping the entry opens an inline
// confirmation; the destructive button stays disabled until the user types the
// word exactly. On success the server has already killed the tokens, so the
// session is cleared locally instead of calling the sign-out endpoint.
export function DeleteAccountSection() {
  const auth = useOptionalAuth();
  const { colorScheme: scheme } = useColorScheme();
  const colors = scheme === 'dark' ? COLORS.dark : COLORS.light;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State alone cannot stop a double-tap: two presses can arrive before React
  // re-renders the button as disabled.
  const inFlight = useRef(false);

  const confirmed = typed === CONFIRM_WORD;

  function close() {
    if (inFlight.current) return;
    setOpen(false);
    setTyped('');
    setError(null);
  }

  async function confirmDelete() {
    if (!confirmed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `The server could not delete your account (error ${e.status}). Nothing was deleted; please try again.`
          : 'Could not reach the server. Check your connection and try again. Nothing was deleted.',
      );
      inFlight.current = false;
      setBusy(false);
      return;
    }
    // The account is gone. Leave the busy state on: signing out unmounts this
    // screen, and nothing here should be tappable in the meantime.
    await auth?.clearSession();
  }

  if (!open) {
    return (
      <Card testID="delete-account-section" className="mt-6 gap-2 border-destructive/40">
        <View className="flex-row items-center gap-2">
          <Ionicons name="trash-outline" size={18} color={colors.scorePoor} />
          <Text className="text-base font-semibold">Delete account</Text>
        </View>
        <Text className="text-sm text-muted-foreground">Permanently delete your account and all the data stored for it.</Text>
        <Button testID="delete-account-open" variant="destructive" onPress={() => setOpen(true)}>
          Delete account…
        </Button>
      </Card>
    );
  }

  return (
    <Card testID="delete-account-section" className="mt-6 gap-3 border-destructive/40">
      <View className="flex-row items-center gap-2">
        <Ionicons name="warning-outline" size={18} color={colors.scorePoor} />
        <Text className="text-base font-semibold text-destructive">Delete your account?</Text>
      </View>
      <Text testID="delete-account-warning" className="text-sm text-muted-foreground">
        This permanently deletes your synced health data, scores, habit logs, coach data and memory, and your Google
        Health connection. This cannot be undone.
      </Text>
      <Text className="text-sm">
        Type <Text className="font-semibold">{CONFIRM_WORD}</Text> to confirm.
      </Text>
      <TextInput
        testID="delete-account-input"
        value={typed}
        onChangeText={setTyped}
        editable={!busy}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ color: colors.foreground }}
        className="rounded-xl border border-border bg-card px-4 py-3"
      />
      {error ? (
        <Text testID="delete-account-error" className="text-sm text-destructive">
          {error}
        </Text>
      ) : null}
      {busy ? (
        <View testID="delete-account-progress" className="flex-row items-center justify-center gap-2">
          <ActivityIndicator color={colors.muted} />
          <Text className="text-sm text-muted-foreground">Deleting your account…</Text>
        </View>
      ) : null}
      <Button
        testID="delete-account-confirm"
        variant="destructive"
        className={confirmed && !busy ? 'border border-destructive' : 'border border-destructive opacity-40'}
        disabled={!confirmed || busy}
        onPress={() => void confirmDelete()}
      >
        Permanently delete my account
      </Button>
      <Button testID="delete-account-cancel" variant="ghost" disabled={busy} onPress={close}>
        Cancel
      </Button>
    </Card>
  );
}
