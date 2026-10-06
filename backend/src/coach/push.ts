// Push notifications for the coach (spec section 6).
//
// PUSH CONTENT IS GENERIC. The title and body are fixed strings chosen from the
// small server-side table below by a KIND. They are never model-generated and
// never contain a score, factor, habit name or any number, because push text is
// visible on the lock screen and passes through the OS push provider (APNs/FCM),
// a third party this design does not want holding health data. The digest
// itself is fetched in-app after the user opens it.
//
// DATA IS ID-ONLY. A payload may carry `data` only as { kind: 'recap', recapId: <uuid> }: a
// fixed kind and an opaque id, never content (spec 2026-10-04 §2). The app fetches the recap
// itself after the tap. The Expo sender re-validates data against that allowlist exactly as it
// re-checks title and body.
//
// Structurally, nothing here can carry other text: sendGenericPush() takes a
// kind (a closed union), not a string, and builds the payload by looking that
// kind up. There is no parameter through which model output or a health value
// could be interpolated. Any future proactive nudge (threshold-triggered or
// daily check-in) must go through this same function, by way of
// sendCoachPush() (coachPush.ts), which also checks the coach flag and consent.
// The recap push (sendRecapPush below) builds its payload the same way.
//
// Two senders exist: the no-op default, and ExpoPushSender, selected with
// PUSH_PROVIDER=expo (config.ts). The Expo sender re-checks every title and body
// against the fixed table before it builds a request, so even a future caller
// that bypassed sendGenericPush() could not put other text on the wire.

import { prisma } from '../db/client';

export type PushKind = 'weekly_digest' | 'insight' | 'monthly_recap';

export interface RecapPushData {
  kind: 'recap';
  recapId: string;
}

export interface GenericPushPayload {
  kind: PushKind;
  title: string;
  body: string;
  /** Id-only, recap kinds only (isAllowedPushData). */
  data?: RecapPushData;
}

export const GENERIC_PUSH_PAYLOADS: Readonly<Record<PushKind, Readonly<{ title: string; body: string }>>> = Object.freeze({
  weekly_digest: Object.freeze({ title: 'Your weekly recap is ready', body: 'Open the app to read it.' }),
  insight: Object.freeze({ title: 'You have a new insight', body: 'Open the app to see it.' }),
  monthly_recap: Object.freeze({ title: 'Your monthly recap is ready', body: 'Open the app to see it.' }),
});

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The data allowlist: exactly the keys kind and recapId, kind 'recap', recapId a UUID. */
export function isAllowedPushData(data: unknown): data is RecapPushData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const keys = Object.keys(data).sort();
  if (keys.length !== 2 || keys[0] !== 'kind' || keys[1] !== 'recapId') return false;
  const d = data as Record<string, unknown>;
  return d.kind === 'recap' && typeof d.recapId === 'string' && UUID_RE.test(d.recapId);
}

export const RECAP_PUSH_KIND: Readonly<Record<'WEEK' | 'MONTH', PushKind>> = Object.freeze({ WEEK: 'weekly_digest', MONTH: 'monthly_recap' });
const RECAP_KINDS_WITH_DATA: ReadonlySet<PushKind> = new Set(['weekly_digest', 'monthly_recap']);

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

/**
 * The "recap ready" push (spec 2026-10-04 §2). App-level: it does not need the coach, only a
 * registered device and User.recapPushEnabled. Returns how many devices it was handed to.
 */
export async function sendRecapPush(sender: PushSender, userId: string, recapKind: 'WEEK' | 'MONTH', recapId: string): Promise<number> {
  if (!UUID_RE.test(recapId)) throw new Error('push_data_not_allowed');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { recapPushEnabled: true } });
  if (!user?.recapPushEnabled) return 0;
  const rows = await prisma.pushToken.findMany({ where: { userId }, select: { token: true, platform: true } });
  if (rows.length === 0) return 0;
  await sender.send(
    rows.map((r) => ({ token: r.token, platform: r.platform })),
    { ...genericPushPayload(RECAP_PUSH_KIND[recapKind]), data: { kind: 'recap', recapId } },
  );
  return rows.length;
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_REQUEST_TIMEOUT_MS = 15_000;

const EXPO_TOKEN_SHAPE = /^Expo(?:nent)?PushToken\[[^\]\s]+\]$/;

/** True for `ExponentPushToken[...]` and `ExpoPushToken[...]`. */
export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_SHAPE.test(token);
}

/** For logs: keeps the wrapper and the first four characters, e.g. `ExponentPushToken[abcd…]`. A token is a device credential. */
export function maskPushToken(token: string): string {
  const m = /^(Expo(?:nent)?PushToken)\[([^\]]*)\]?$/.exec(token);
  if (m) return `${m[1]}[${m[2]!.slice(0, 4)}…]`;
  return `${token.slice(0, 4)}…`;
}

/** Throws unless title and body are exactly the fixed strings for the payload's kind, and any data is allowlisted. */
function assertGenericPayload(payload: GenericPushPayload): void {
  if (!Object.prototype.hasOwnProperty.call(GENERIC_PUSH_PAYLOADS, payload?.kind)) throw new Error('push_text_not_generic');
  const fixed = GENERIC_PUSH_PAYLOADS[payload.kind];
  if (payload.title !== fixed.title || payload.body !== fixed.body) throw new Error('push_text_not_generic');
  if (payload.data !== undefined && (!isAllowedPushData(payload.data) || !RECAP_KINDS_WITH_DATA.has(payload.kind))) {
    throw new Error('push_data_not_allowed');
  }
}

/** Logs the event and masked tokens only: never a full token, the access token, a provider message or any health data. */
function logPush(event: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, ...fields }));
}

interface ExpoTicket {
  status?: unknown;
  details?: { error?: unknown } | null;
}

export interface ExpoPushSenderOptions {
  /** Test seam; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * Delivers the generic push through the Expo push service. A failed request is
 * logged and skipped (never thrown), so one bad chunk neither loses the other
 * chunks' results nor fails the digest job. The only throw is the refusal of
 * non-generic text or non-allowlisted data, which is a programming error.
 */
export class ExpoPushSender implements PushSender {
  private readonly fetchFn: typeof fetch;

  constructor(options: ExpoPushSenderOptions = {}) {
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
  }

  async send(targets: PushTarget[], payload: GenericPushPayload): Promise<void> {
    assertGenericPayload(payload);
    for (let i = 0; i < targets.length; i += EXPO_PUSH_CHUNK_SIZE) {
      await this.sendChunk(targets.slice(i, i + EXPO_PUSH_CHUNK_SIZE), payload);
    }
  }

  private async sendChunk(chunk: PushTarget[], payload: GenericPushPayload): Promise<void> {
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const messages = chunk.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      sound: 'default',
      // Rebuilt from the validated fields, never spread.
      data: payload.data ? { kind: payload.data.kind, recapId: payload.data.recapId } : { kind: payload.kind },
    }));

    let tickets: ExpoTicket[];
    try {
      const res = await this.fetchFn(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        logPush('coach.push_chunk_failed', { status: res.status, size: chunk.length });
        return;
      }
      const body = (await res.json()) as { data?: unknown } | null;
      if (!body || !Array.isArray(body.data) || body.data.length !== chunk.length) {
        logPush('coach.push_chunk_failed', { reason: 'unexpected_response', size: chunk.length });
        return;
      }
      tickets = body.data as ExpoTicket[];
    } catch (err) {
      // The error class only: a fetch error message can echo request values.
      logPush('coach.push_chunk_failed', { error: err instanceof Error ? err.name : 'unknown', size: chunk.length });
      return;
    }

    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.status !== 'error') return;
      const token = chunk[i]!.token;
      const code = typeof ticket.details?.error === 'string' ? ticket.details.error : 'unknown';
      if (code === 'DeviceNotRegistered') dead.push(token);
      else logPush('coach.push_ticket_error', { error: code, token: maskPushToken(token) });
    });
    if (dead.length > 0) {
      try {
        await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
        logPush('coach.push_token_removed', { count: dead.length, tokens: dead.map(maskPushToken) });
      } catch (err) {
        logPush('coach.push_token_cleanup_failed', { error: err instanceof Error ? err.name : 'unknown', count: dead.length });
      }
    }
  }
}
