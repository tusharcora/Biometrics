import React, { createContext, useContext, ReactNode } from 'react';
import { authClient } from './authClient';
import { unwrap } from './authErrors';
import { disablePush } from '../lib/pushRegistration';
import { clearTimezoneState } from '../lib/timezone';

export const VERIFIED_URL = 'biometrics://verified';
export const RESET_URL = 'biometrics://reset-password';

interface Session {
  userId: string;
  email: string;
}

type AppleName = { givenName?: string | null; familyName?: string | null } | null | undefined;

interface AuthContextValue {
  session: Session | null;
  isPending: boolean;
  signInWithApple: (identityToken: string, fullName?: AppleName) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (input: { name: string; email: string; password: string }) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Drops the local session without push unregistration (after account deletion). */
  clearSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

// Emails are compared case-sensitively by the server; normalise once here.
const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Clears the stored cookie (inside authClient.signOut, before its request is
// sent, so it clears even when the server call fails) and the device-global
// time zone state, which would otherwise carry into the next account.
async function dropLocalSession(): Promise<void> {
  await authClient.signOut().catch(() => undefined);
  await clearTimezoneState().catch(() => undefined);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const session: Session | null = data ? { userId: data.user.id, email: data.user.email } : null;

  const value: AuthContextValue = {
    session,
    isPending,
    async signInWithApple(identityToken, fullName) {
      const firstName = fullName?.givenName ?? undefined;
      const lastName = fullName?.familyName ?? undefined;
      const user = firstName || lastName ? { user: { name: { firstName, lastName } } } : {};
      await unwrap(authClient.signIn.social({ provider: 'apple', idToken: { token: identityToken, ...user } }));
    },
    async signInWithGoogle(idToken) {
      await unwrap(authClient.signIn.social({ provider: 'google', idToken: { token: idToken } }));
    },
    async signInWithEmail(email, password) {
      await unwrap(authClient.signIn.email({ email: normalizeEmail(email), password }));
    },
    async signUpWithEmail({ name, email, password }) {
      await unwrap(authClient.signUp.email({ name: name.trim(), email: normalizeEmail(email), password, callbackURL: VERIFIED_URL }));
    },
    async resendVerification(email) {
      await unwrap(authClient.sendVerificationEmail({ email: normalizeEmail(email), callbackURL: VERIFIED_URL }));
    },
    async requestPasswordReset(email) {
      await unwrap(authClient.requestPasswordReset({ email: normalizeEmail(email), redirectTo: RESET_URL }));
    },
    async resetPassword(token, newPassword) {
      await unwrap(authClient.resetPassword({ token, newPassword }));
    },
    async signOut() {
      // Before the session goes: the push unregister call needs it.
      await unregisterPushBestEffort();
      await dropLocalSession();
    },
    clearSession: dropLocalSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Like useAuth, but undefined outside an AuthProvider (for components rendered in isolation). */
export function useOptionalAuth(): AuthContextValue | undefined {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
