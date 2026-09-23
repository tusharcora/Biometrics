export type PushKind = 'weekly_digest' | 'insight';
export interface GenericPushPayload {
    kind: PushKind;
    title: string;
    body: string;
}
export declare const GENERIC_PUSH_PAYLOADS: Readonly<Record<PushKind, Readonly<{
    title: string;
    body: string;
}>>>;
export declare function genericPushPayload(kind: PushKind): GenericPushPayload;
export interface PushTarget {
    token: string;
    platform: 'ios' | 'android';
}
export interface PushSender {
    send(targets: PushTarget[], payload: GenericPushPayload): Promise<void>;
}
/** The only sender that ships: delivers nothing. */
export declare class NoopPushSender implements PushSender {
    send(): Promise<void>;
}
/**
 * Sends the generic notification for `kind` to every registered device of the
 * user. Returns how many devices it was handed to (0 when the user has none, in
 * which case the sender is not called at all).
 */
export declare function sendGenericPush(sender: PushSender, userId: string, kind: PushKind): Promise<number>;
export declare const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export declare const EXPO_PUSH_CHUNK_SIZE = 100;
/** True for `ExponentPushToken[...]` and `ExpoPushToken[...]`. */
export declare function isExpoPushToken(token: string): boolean;
/** For logs: keeps the wrapper and the first four characters, e.g. `ExponentPushToken[abcd…]`. A token is a device credential. */
export declare function maskPushToken(token: string): string;
export interface ExpoPushSenderOptions {
    /** Test seam; defaults to the global fetch. */
    fetchFn?: typeof fetch;
}
/**
 * Delivers the generic push through the Expo push service. A failed request is
 * logged and skipped (never thrown), so one bad chunk neither loses the other
 * chunks' results nor fails the digest job. The only throw is the refusal of
 * non-generic text, which is a programming error.
 */
export declare class ExpoPushSender implements PushSender {
    private readonly fetchFn;
    constructor(options?: ExpoPushSenderOptions);
    send(targets: PushTarget[], payload: GenericPushPayload): Promise<void>;
    private sendChunk;
}
//# sourceMappingURL=push.d.ts.map