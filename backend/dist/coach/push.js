"use strict";
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
// Two senders exist: the no-op default, and ExpoPushSender, selected with
// PUSH_PROVIDER=expo (config.ts). The Expo sender re-checks every title and body
// against the fixed table before it builds a request, so even a future caller
// that bypassed sendGenericPush() could not put other text on the wire.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpoPushSender = exports.EXPO_PUSH_CHUNK_SIZE = exports.EXPO_PUSH_URL = exports.NoopPushSender = exports.GENERIC_PUSH_PAYLOADS = void 0;
exports.genericPushPayload = genericPushPayload;
exports.sendGenericPush = sendGenericPush;
exports.isExpoPushToken = isExpoPushToken;
exports.maskPushToken = maskPushToken;
const client_1 = require("../db/client");
exports.GENERIC_PUSH_PAYLOADS = Object.freeze({
    weekly_digest: Object.freeze({ title: 'Your weekly recap is ready', body: 'Open the app to read it.' }),
    insight: Object.freeze({ title: 'You have a new insight', body: 'Open the app to see it.' }),
});
function genericPushPayload(kind) {
    // Own-property lookup: an unknown kind is a bug, never a fallthrough to some other text.
    if (!Object.prototype.hasOwnProperty.call(exports.GENERIC_PUSH_PAYLOADS, kind))
        throw new Error('unknown_push_kind');
    const fixed = exports.GENERIC_PUSH_PAYLOADS[kind];
    return { kind, title: fixed.title, body: fixed.body };
}
/** The only sender that ships: delivers nothing. */
class NoopPushSender {
    async send() { }
}
exports.NoopPushSender = NoopPushSender;
/**
 * Sends the generic notification for `kind` to every registered device of the
 * user. Returns how many devices it was handed to (0 when the user has none, in
 * which case the sender is not called at all).
 */
async function sendGenericPush(sender, userId, kind) {
    const rows = await client_1.prisma.pushToken.findMany({ where: { userId }, select: { token: true, platform: true } });
    if (rows.length === 0)
        return 0;
    await sender.send(rows.map((r) => ({ token: r.token, platform: r.platform })), genericPushPayload(kind));
    return rows.length;
}
exports.EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
exports.EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_REQUEST_TIMEOUT_MS = 15_000;
const EXPO_TOKEN_SHAPE = /^Expo(?:nent)?PushToken\[[^\]\s]+\]$/;
/** True for `ExponentPushToken[...]` and `ExpoPushToken[...]`. */
function isExpoPushToken(token) {
    return EXPO_TOKEN_SHAPE.test(token);
}
/** For logs: keeps the wrapper and the first four characters, e.g. `ExponentPushToken[abcd…]`. A token is a device credential. */
function maskPushToken(token) {
    const m = /^(Expo(?:nent)?PushToken)\[([^\]]*)\]?$/.exec(token);
    if (m)
        return `${m[1]}[${m[2].slice(0, 4)}…]`;
    return `${token.slice(0, 4)}…`;
}
/** Throws unless title and body are exactly the fixed strings for the payload's kind. */
function assertGenericPayload(payload) {
    if (!Object.prototype.hasOwnProperty.call(exports.GENERIC_PUSH_PAYLOADS, payload?.kind))
        throw new Error('push_text_not_generic');
    const fixed = exports.GENERIC_PUSH_PAYLOADS[payload.kind];
    if (payload.title !== fixed.title || payload.body !== fixed.body)
        throw new Error('push_text_not_generic');
}
/** Logs the event and masked tokens only: never a full token, the access token, a provider message or any health data. */
function logPush(event, fields) {
    console.error(JSON.stringify({ event, ...fields }));
}
/**
 * Delivers the generic push through the Expo push service. A failed request is
 * logged and skipped (never thrown), so one bad chunk neither loses the other
 * chunks' results nor fails the digest job. The only throw is the refusal of
 * non-generic text, which is a programming error.
 */
class ExpoPushSender {
    fetchFn;
    constructor(options = {}) {
        this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init));
    }
    async send(targets, payload) {
        assertGenericPayload(payload);
        for (let i = 0; i < targets.length; i += exports.EXPO_PUSH_CHUNK_SIZE) {
            await this.sendChunk(targets.slice(i, i + exports.EXPO_PUSH_CHUNK_SIZE), payload);
        }
    }
    async sendChunk(chunk, payload) {
        const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
        const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
        if (accessToken)
            headers.Authorization = `Bearer ${accessToken}`;
        const messages = chunk.map((t) => ({
            to: t.token,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            data: { kind: payload.kind },
        }));
        let tickets;
        try {
            const res = await this.fetchFn(exports.EXPO_PUSH_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(messages),
                signal: AbortSignal.timeout(EXPO_REQUEST_TIMEOUT_MS),
            });
            if (!res.ok) {
                logPush('coach.push_chunk_failed', { status: res.status, size: chunk.length });
                return;
            }
            const body = (await res.json());
            if (!body || !Array.isArray(body.data) || body.data.length !== chunk.length) {
                logPush('coach.push_chunk_failed', { reason: 'unexpected_response', size: chunk.length });
                return;
            }
            tickets = body.data;
        }
        catch (err) {
            // The error class only: a fetch error message can echo request values.
            logPush('coach.push_chunk_failed', { error: err instanceof Error ? err.name : 'unknown', size: chunk.length });
            return;
        }
        const dead = [];
        tickets.forEach((ticket, i) => {
            if (ticket?.status !== 'error')
                return;
            const token = chunk[i].token;
            const code = typeof ticket.details?.error === 'string' ? ticket.details.error : 'unknown';
            if (code === 'DeviceNotRegistered')
                dead.push(token);
            else
                logPush('coach.push_ticket_error', { error: code, token: maskPushToken(token) });
        });
        if (dead.length > 0) {
            try {
                await client_1.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
                logPush('coach.push_token_removed', { count: dead.length, tokens: dead.map(maskPushToken) });
            }
            catch (err) {
                logPush('coach.push_token_cleanup_failed', { error: err instanceof Error ? err.name : 'unknown', count: dead.length });
            }
        }
    }
}
exports.ExpoPushSender = ExpoPushSender;
//# sourceMappingURL=push.js.map