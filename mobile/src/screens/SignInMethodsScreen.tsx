import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { authClient } from '../auth/authClient';
import { unwrap, messageFor } from '../auth/authErrors';
import { useGoogleIdToken } from '../auth/useGoogleIdToken';
import { Text } from '../components/ui/text';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

const LABELS: Record<string, string> = { apple: 'Apple', google: 'Google', credential: 'Email and password' };
const LINKABLE = ['apple', 'google'] as const;

export function SignInMethodsScreen() {
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await unwrap<LinkedAccount[]>(authClient.listAccounts()));
    } catch (err) {
      setError(messageFor(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await load();
      } catch (err) {
        setError(messageFor(err));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const google = useGoogleIdToken(
    useCallback((idToken: string) => void act(() => unwrap(authClient.linkSocial({ provider: 'google', idToken: { token: idToken } }))), [act]),
  );

  async function linkApple() {
    let token: string | null;
    try {
      token = (await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] })).identityToken;
    } catch {
      return; // Sheet closed.
    }
    if (token) {
      const identityToken = token;
      await act(() => unwrap(authClient.linkSocial({ provider: 'apple', idToken: { token: identityToken } })));
    }
  }

  const linked = new Set(accounts?.map((a) => a.providerId));
  const onlyOne = (accounts?.length ?? 0) <= 1;

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Text className="text-sm text-muted-foreground">
        You can sign in with any of these. Linking only works for an account that uses the same email.
      </Text>
      {accounts?.map((account) => (
        <Card key={account.id} testID={`method-${account.providerId}`} className="flex-row items-center justify-between">
          <Text className="text-base font-medium">{LABELS[account.providerId] ?? account.providerId}</Text>
          <Button
            testID={`unlink-${account.providerId}-button`}
            variant="ghost"
            disabled={busy || onlyOne}
            // /unlink-account matches `accountId` against the account row's own id.
            onPress={() => act(() => unwrap(authClient.unlinkAccount({ accountId: account.id })))}
          >
            Unlink
          </Button>
        </Card>
      ))}
      {onlyOne && accounts ? <Text className="text-xs text-muted-foreground">You need at least one way to sign in.</Text> : null}
      <View className="gap-2">
        {accounts && LINKABLE.filter((p) => !linked.has(p)).map((provider) => (
          <Button
            key={provider}
            testID={`link-${provider}-button`}
            disabled={busy || (provider === 'google' && !google.ready)}
            onPress={() => (provider === 'apple' ? linkApple() : google.prompt())}
          >
            {`Link ${LABELS[provider]}`}
          </Button>
        ))}
      </View>
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
    </ScrollView>
  );
}
