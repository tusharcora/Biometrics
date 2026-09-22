import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, onSessionExpired } from '../api/client';
import { disablePush } from '../lib/pushRegistration';
import { clearTimezoneState } from '../lib/timezone';

interface Session {
  accessToken: string;
}

interface AuthContextValue {
  session: Session | null;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Drops the stored tokens and the in-memory session without touching the server. */
  clearSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function storeSession(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  await SecureStore.setItemAsync('accessToken', tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
}

const PUSH_UNREGISTER_TIMEOUT_MS = 2000;

async function unregisterPushBestEffort(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      disablePush(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, PUSH_UNREGISTER_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Signing out matters more than tidying up the push token.
  } finally {
    clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then((token) => {
      if (token) setSession({ accessToken: token });
    });
  }, []);

  // The API client clears the stored tokens when the server rejects the
  // refresh token; mirror that here so the navigator returns to sign-in.
  useEffect(() => onSessionExpired(() => setSession(null)), []);

  async function signInWithApple(identityToken: string) {
    // skipAuth: there is no session yet, and a 401 here means "bad identity
    // token", not "expired session" — retrying it through the refresh path
    // would turn a normal failed sign-in into a bogus "session expired".
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/apple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken }),
      skipAuth: true,
    });
    await storeSession(tokens);
    setSession({ accessToken: tokens.accessToken });
  }

  async function signInWithGoogle(idToken: string) {
    const tokens = await apiFetch<{ accessToken: string; refreshToken: string }>('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      skipAuth: true,
    });
    await storeSession(tokens);
    setSession({ accessToken: tokens.accessToken });
  }

  async function signOut() {
    // Best effort, and before the tokens go: the unregister call needs the
    // session. It is capped so a slow network can never hold up signing out.
    await unregisterPushBestEffort();
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    await apiFetch('/auth/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }).catch(() => undefined);
    await clearSession();
  }

  // Local-only sign-out, for when the server has already ended the session
  // (account deletion): calling the sign-out endpoint would be rejected. A
  // keychain failure must not keep the user signed in, so the in-memory
  // session goes either way.
  async function clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      // Device-global, so it would otherwise carry into the next account that
      // signs in here and suppress that account's own time zone sync.
      clearTimezoneState(),
    ]).catch(() => undefined);
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, signInWithApple, signInWithGoogle, signOut, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Like useAuth, but returns undefined outside an AuthProvider instead of
 * throwing -- for leaf components (Settings) that must still render in
 * isolation.
 */
export function useOptionalAuth(): AuthContextValue | undefined {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
