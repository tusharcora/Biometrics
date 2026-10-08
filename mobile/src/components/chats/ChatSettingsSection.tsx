import React, { useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { fetchChatSettings, saveChatSettings, type ChatSettings } from '../../api/chats';
import { useBuddies } from '../../lib/buddiesStore';
import { COLORS } from '../../theme';
import { SettingsGroup, SettingsRow } from '../ui/settings-list';
import { Text } from '../ui/text';

const FAILED = 'Your chat setting could not be saved. Please try again.';

// Profile → Chats (spec 2026-10-07 social §8.2, §8.4): Read receipts and Show activity status, on by default and
// reciprocal (off: you neither send nor see them). A switch shows what the server last confirmed. Hidden without
// buddies and on a server without chats (bare 404). A failed save says so under the group.
export function ChatSettingsSection() {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const buddies = useBuddies();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The in-flight guard; a ref so a second flip before the next render is still ignored.
  const inFlight = useRef(false);
  const available = buddies.status === 'ready';

  useEffect(() => {
    if (!available) return;
    let live = true;
    fetchChatSettings().then(
      (s) => {
        if (live) setSettings(s);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [available]);

  if (!available || !settings) return null;

  async function toggle(key: keyof ChatSettings, next: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      setSettings(await saveChatSettings({ [key]: next }));
    } catch {
      // Nothing changes: both switches still show the last saved settings.
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const row = (key: keyof ChatSettings, id: string, title: string, subtitle: string, icon: 'checkmark-done-outline' | 'radio-button-on-outline') => (
    <SettingsRow
      testID={`${id}-row`}
      icon={icon}
      tint={colors.accent}
      title={title}
      subtitle={subtitle}
      trailing={
        <Switch testID={`${id}-toggle`} accessibilityLabel={title} value={settings[key]} disabled={busy}
          onValueChange={(next) => void toggle(key, next)} trackColor={{ true: colors.accent }} />
      }
    />
  );

  return (
    <View testID="chat-settings" className="gap-2">
      <SettingsGroup label="Chats">
        {row('readReceipts', 'chat-read-receipts', 'Read receipts', "Show \"Seen\" when you've read a chat. Off, you won't see theirs either.", 'checkmark-done-outline')}
        {row('activityStatus', 'chat-activity', 'Show activity status', "Let buddies see when you were last active. Off, you won't see theirs either.", 'radio-button-on-outline')}
      </SettingsGroup>
      {failed ? <Text testID="chat-settings-message" className="px-4 text-sm text-destructive">{FAILED}</Text> : null}
    </View>
  );
}
