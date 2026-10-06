import React, { useState } from 'react';
import { View } from 'react-native';
import { buddyErrorCode, saveIdentity, type BuddyIdentity } from '../../api/buddies';
import { buddyErrorMessage } from '../../lib/buddyCopy';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';

// The @handle and display name (spec 2026-10-06 buddies §2). The server validates and normalises
// (one leading @, lowercase); this form shows its reason when it refuses.
export function HandleSetupForm({ identity, mode, onSaved }: { identity: BuddyIdentity; mode: 'setup' | 'edit'; onSaved: (next: BuddyIdentity) => void }) {
  const [handle, setHandle] = useState(identity.handle ?? '');
  const [name, setName] = useState(identity.displayName ?? identity.displayNamePrefill);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const patch: { handle?: string; displayName?: string } = {};
    if (mode === 'setup' || handle !== identity.handle) patch.handle = handle;
    if (mode === 'setup' || name !== identity.displayName) patch.displayName = name;
    if (Object.keys(patch).length === 0) {
      onSaved(identity);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await saveIdentity(patch));
    } catch (e) {
      setError(buddyErrorMessage(buddyErrorCode(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID="handle-setup" className="gap-4">
      <Text className="font-display text-display">{mode === 'setup' ? 'Pick your buddy name' : 'Your buddy name'}</Text>
      <Text className="text-sm text-muted-foreground">Friends find you by your exact @handle. Your email is never shown.</Text>
      <TextField label="Handle" testID="handle-input" value={handle} onChangeText={setHandle} autoCapitalize="none" />
      <TextField label="Display name" testID="display-name-input" value={name} onChangeText={setName} />
      {error ? <Text testID="handle-setup-error" className="text-sm text-destructive">{error}</Text> : null}
      <Button testID="handle-setup-save" disabled={busy || !handle.trim() || !name.trim()} onPress={() => void save()}>
        {mode === 'setup' ? 'Continue' : 'Save'}
      </Button>
    </View>
  );
}
