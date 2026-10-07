import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { buddyErrorCode, createCode, fetchCode, redeemCode, sendBuddyRequest, type BuddyIdentity } from '../api/buddies';
import { IdentityGate } from '../components/buddies/IdentityGate';
import { MoodNoticeSheet } from '../components/buddies/MoodNoticeSheet';
import { useMoodNoticeGate } from '../components/buddies/useMoodNoticeGate';
import { Character } from '../components/characters/Character';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Text } from '../components/ui/text';
import { TextField } from '../components/ui/text-field';
import { buddyErrorMessage, expiresIn, shareMessage } from '../lib/buddyCopy';
import { refreshBuddies } from '../lib/buddiesStore';

type Nav = { replace: (name: string, params?: object) => void };
type Code = { code: string; expiresAt: string };

// Pair up (spec 2026-10-06 buddies §7, design 2b): your code (create / share / countdown), enter a
// code, or ask by exact @handle. Every pairing action waits for the one-time mood notice.
export function PairUpScreen() {
  const navigation = useNavigation() as unknown as Nav;
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <IdentityGate>{(identity) => <PairUpBody identity={identity} navigation={navigation} />}</IdentityGate>
    </SafeAreaView>
  );
}

function PairUpBody({ identity, navigation }: { identity: BuddyIdentity; navigation: Nav }) {
  const gate = useMoodNoticeGate(identity.moodNoticeSeen);
  const [code, setCode] = useState<Code | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [entered, setEntered] = useState('');
  const [handle, setHandle] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // `busy` disables the buttons only after a re-render; a double tap in one frame calls the API once.
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    fetchCode().then((c) => live && setCode(c)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const active = code && Date.parse(code.expiresAt) > now ? code : null;

  function act(fn: () => Promise<void>) {
    gate.run(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setMessage(null);
      void (async () => {
        try {
          await fn();
        } catch (e) {
          // The server's code only: a refused code never says why (a block reads as code_invalid).
          setMessage({ text: buddyErrorMessage(buddyErrorCode(e)), error: true });
        } finally {
          inFlight.current = false;
          setBusy(false);
        }
      })();
    });
  }

  const shareCode = () =>
    act(async () => {
      const current = active ?? (await createCode());
      setCode(current);
      setNow(Date.now());
      await Share.share({ message: shareMessage(current.code) });
    });
  const pair = () =>
    act(async () => {
      const { buddyId } = await redeemCode(entered);
      void refreshBuddies();
      navigation.replace('BuddyWeek', { buddyId });
    });
  const request = () =>
    act(async () => {
      await sendBuddyRequest(handle);
      // The same words whatever became of it: the sender is never told more (spec §4). A mutual ask
      // may pair at once; the refresh shows it in the list.
      setMessage({ text: `Request sent to @${handle.trim().replace(/^@/, '').toLowerCase()}.`, error: false });
      setHandle('');
      void refreshBuddies();
    });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <View className="items-center gap-2">
        <Character mood="idle" size={72} />
        <Text className="font-display text-display">Pair up with a friend</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Buddies always see your coach's mood. Your numbers stay private unless you share them in Profile.
        </Text>
      </View>

      <Card className="gap-3 p-4">
        <Text className="text-sm text-muted-foreground">Your buddy code</Text>
        {active ? (
          <>
            <Text testID="pair-code" className="text-3xl font-semibold tracking-widest">{active.code}</Text>
            <Text testID="pair-code-expiry" className="text-xs text-muted-foreground">{expiresIn(active.expiresAt, now)}</Text>
          </>
        ) : null}
        <Button testID="pair-share-or-create" disabled={busy} onPress={shareCode}>Share my code</Button>
      </Card>

      <Card className="gap-3 p-4">
        <TextField label="Enter a friend's code" testID="pair-code-input" value={entered} onChangeText={setEntered} autoCapitalize="characters" />
        <Button testID="pair-redeem" variant="secondary" disabled={busy || !entered.trim()} onPress={pair}>Pair up</Button>
      </Card>

      <Card className="gap-3 p-4">
        <TextField label="Or ask by @handle" testID="pair-handle-input" value={handle} onChangeText={setHandle} autoCapitalize="none" />
        <Button testID="pair-request" variant="secondary" disabled={busy || !handle.trim()} onPress={request}>Send request</Button>
      </Card>

      {message ? (
        <Text testID="pair-message" className={message.error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{message.text}</Text>
      ) : null}
      <MoodNoticeSheet {...gate.sheet} />
    </ScrollView>
  );
}
