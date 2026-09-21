// Push notifications for the coach (spec section 6).
//
// PUSH CONTENT IS GENERIC. The title and body are fixed strings chosen from the
// small server-side table below by a KIND. They are never model-generated and
// never contain a score, factor, habit name or any number, because push text is
// visible on the lock screen and passes through the OS push provider (APNs/FCM),
// a third party this design does not want holding health data. The digest
// itself is fetched in-app after the user opens it.
//
// Structurally, nothing here can carry other text: sendGenericPush() takes a
// kind (a closed union), not a string, and builds the payload by looking that
// kind up. There is no parameter through which model output or a health value
// could be interpolated. Any future proactive nudge (threshold-triggered or
// daily check-in) must go through this same function.
//
// No real push provider ships: only the PushSender interface and a no-op
// implementation. A real APNs/FCM sender is wired in later, behind the same gate
// as the model provider.

import { prisma } from '../db/client';

export type PushKind = 'weekly_digest' | 'insight';

export interface GenericPushPayload {
  kind: PushKind;
  title: string;
  body: string;
}

export const GENERIC_PUSH_PAYLOADS: Readonly<Record<PushKind, Readonly<{ title: string; body: string }>>> = Object.freeze({
  weekly_digest: Object.freeze({ title: 'Your weekly recap is ready', body: 'Open the app to read it.' }),
  insight: Object.freeze({ title: 'You have a new insight', body: 'Open the app to see it.' }),
});

export function genericPushPayload(kind: PushKind): GenericPushPayload {
  // Own-property lookup: an unknown kind is a bug, never a fallthrough to some other text.
  if (!Object.prototype.hasOwnProperty.call(GENERIC_PUSH_PAYLOADS, kind)) throw new Error('unknown_push_kind');
  const fixed = GENERIC_PUSH_PAYLOADS[kind];
  return { kind, title: fixed.title, body: fixed.body };
}

export interface PushTarget {
  token: string;
  platform: 'ios' | 'android';
}

export interface PushSender {
  send(targets: PushTarget[], payload: GenericPushPayload): Promise<void>;
}

/** The only sender that ships: delivers nothing. */
export class NoopPushSender implements PushSender {
  async send(): Promise<void> {}
}

/**
 * Sends the generic notification for `kind` to every registered device of the
 * user. Returns how many devices it was handed to (0 when the user has none, in
 * which case the sender is not called at all).
 */
export async function sendGenericPush(sender: PushSender, userId: string, kind: PushKind): Promise<number> {
  const rows = await prisma.pushToken.findMany({ where: { userId }, select: { token: true, platform: true } });
  if (rows.length === 0) return 0;
  await sender.send(
    rows.map((r) => ({ token: r.token, platform: r.platform })),
    genericPushPayload(kind),
  );
  return rows.length;
}
