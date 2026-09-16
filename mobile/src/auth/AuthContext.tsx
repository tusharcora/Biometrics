import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../api/client';

interface Session {
  accessToken: string;
}

interface AuthContextValue {
  session: Session | null;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function storeSession(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  await SecureStore.setItemAsync('accessToken', tokens.accessToken);
  await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('accessToken').then((token) => {
      if (token) setSession({ accessToken: token });
    });
  }, []);

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
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    await apiFetch('/auth/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    }).catch(() => undefined);
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, signInWithApple, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
