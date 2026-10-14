import React, { useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { listCoachMemory, revokeCoachConsent } from '../api/coach';
import { useCoachStatusContext } from '../lib/coachStatus/CoachStatusProvider';
import { kipColourName } from '../lib/kip/kipColour';
import { useMyKip } from '../lib/kip/myKip';
import { KIP_COPY } from '../lib/kipCopy';
import { spokenLine } from '../lib/kipStage';
import { DEFAULT_THINKING_TEXT, THINKING_TEXT_NAMES } from '../lib/thinkingText';
import { useCoachStatus } from '../lib/useCoachStatus';
import { ScreenNavigationContext } from '../lib/useScreenFocused';
import { AiEngineRow } from './ai-engine-row';
import { Kip } from './kip/Kip';
import { Button } from './ui/button';
import { SettingsGroup, SettingsRow } from './ui/settings-list';
import { Text } from './ui/text';

// Settings → KIP (spec 2026-10-14 KIP Coach §7.5): your KIP, how the chat shows KIP working, memory and privacy,
// and turning coaching off. Replaces "Your coach" and "AI Coach". There is no answer-style row (dropped by the owner).
// Your KIP and While KIP thinks show whether or not coaching is on: KIP is also the app's look.
export function KipSettingsSection() {
  // Context rather than useNavigation(): Settings also renders outside a navigator, and under test stubs of
  // @react-navigation/native that have no NavigationContext.
  const navigation = useContext(ScreenNavigationContext);
  const go = (name: string, params?: object) => (params === undefined ? navigation?.navigate?.(name) : navigation?.navigate?.(name, params));
  const { colour: colour, worn: myWorn } = useMyKip();
  const thinking = useCoachStatusContext()?.thinkingText ?? DEFAULT_THINKING_TEXT;
  const { status, setStatus } = useCoachStatus(navigation ?? undefined);
  const consented = !!status?.enabled && status.consented;
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read again each time Settings comes back into focus: a delete on the memory page changes the count. Only the
  // newest read lands, and none after unmount or a consent change.
  useEffect(() => {
    if (!consented) return undefined;
    let live = true;
    let latest = 0;
    const read = () => {
      const mine = ++latest;
      listCoachMemory()
        .then((items) => {
          if (live && mine === latest) setMemoryCount(items.length);
        })
        .catch(() => {
          if (live && mine === latest) setMemoryCount(null);
        });
    };
    read();
    const offFocus = navigation?.addListener?.('focus', read);
    return () => {
      live = false;
      offFocus?.();
    };
  }, [consented, navigation]);

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

  const yourKip = KIP_COPY.yourKipSubtitle(kipColourName(colour));
  const memorySubtitle = memoryCount === null ? undefined : KIP_COPY.memorySubtitle(memoryCount);
  const footer = !status?.enabled ? undefined : consented ? KIP_COPY.onFooter : KIP_COPY.offFooter;
  return (
    <View testID="kip-settings" className="gap-6">
      <SettingsGroup label={KIP_COPY.settingsGroup} footer={footer}>
        <SettingsRow
          testID="kip-your-kip"
          leading={<Kip testID="kip-your-kip-art" colour={colour} worn={myWorn} pose="wave" mood="idle" scale={2} />}
          title={KIP_COPY.settingsGroup}
          subtitle={yourKip}
          subtitleAccessibilityLabel={spokenLine(yourKip)}
          trailing={
            <Button testID="kip-change-colour" variant="outline" size="sm" onPress={() => go('ProfileSection', { section: 'kipColour' })}>
              {KIP_COPY.changeColour}
            </Button>
          }
        />
        <SettingsRow
          testID="kip-thinking-text"
          icon="chatbubble-ellipses-outline"
          title={KIP_COPY.whileKipThinks}
          subtitle={KIP_COPY.whileKipThinksSubtitle}
          value={THINKING_TEXT_NAMES[thinking].name}
          onPress={() => go('ThinkingText')}
        />
        {status?.enabled && !consented ? (
          <SettingsRow testID="coach-setup-button" icon="sparkles-outline" title={KIP_COPY.setUp} onPress={() => go('CoachConsent')} />
        ) : null}
        {consented ? (
          <SettingsRow
            testID="kip-memory-row"
            icon="bulb-outline"
            title={KIP_COPY.memoryTitle}
            subtitle={memorySubtitle}
            accessibilityLabel={memorySubtitle ? spokenLine(`${KIP_COPY.memoryTitle} · ${memorySubtitle}`) : undefined}
            onPress={() => go('CoachMemory')}
          />
        ) : null}
        {consented ? (
          // CoachConsent in review mode: what is sent, without "I agree" or a hop to the chat.
          <SettingsRow
            testID="kip-what-is-sent"
            icon="shield-checkmark-outline"
            title={KIP_COPY.whatIsSent}
            onPress={() => go('CoachConsent', { review: true })}
          />
        ) : null}
      </SettingsGroup>
      {consented && status ? (
        <>
          <AiEngineRow status={status} onChange={setStatus} onChooseHosted={() => go('HostedConsent')} />
          <Button testID="coach-revoke-button" variant="destructive" className="border border-destructive/40" disabled={busy} onPress={() => void revoke()}>
            {KIP_COPY.turnOff}
          </Button>
          {revokeError ? (
            <Text testID="coach-revoke-error" className="-mt-4 px-4 text-caption text-destructive">
              {KIP_COPY.turnOffError}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
