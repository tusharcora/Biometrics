import type { CoachToolSchema } from '../tools';
export type CoachTier = 'fast' | 'synthesis';
export interface ToolCallRequest {
    id: string;
    name: string;
    args: unknown;
}
export type CoachModelMessage = {
    role: 'user';
    content: string;
} | {
    role: 'assistant';
    content: string;
} | {
    role: 'system';
    content: string;
} | {
    role: 'assistant_tool_calls';
    calls: ToolCallRequest[];
}
/** `content` is the JSON-serialized tool result, exactly the fields the tool returned. */
 | {
    role: 'tool';
    toolCallId: string;
    name: string;
    content: string;
};
export interface CoachModelRequest {
    tier: CoachTier;
    system: string;
    messages: CoachModelMessage[];
    tools: CoachToolSchema[];
    /** Aborted when the turn's latency budget expires; a real provider should cancel the in-flight call. */
    signal: AbortSignal;
}
export type CoachModelResponse = {
    type: 'text';
    text: string;
} | {
    type: 'tool_calls';
    calls: ToolCallRequest[];
};
export interface CoachModelProvider {
    /** Stable id for telemetry. */
    readonly id: string;
    generate(request: CoachModelRequest): Promise<CoachModelResponse>;
}
export declare class ProviderNotConfiguredError extends Error {
    constructor();
}
export declare class UnconfiguredProvider implements CoachModelProvider {
    readonly id = "unconfigured";
    generate(): Promise<CoachModelResponse>;
}
export type ScriptStep = CoachModelResponse
/** A function step can inspect the request, advance a fake clock, or return a never-settling promise. */
 | ((request: CoachModelRequest) => CoachModelResponse | Promise<CoachModelResponse>);
/**
 * Deterministic provider for tests and the eval harness: returns its script in
 * order, records every request, and fails loudly if the script runs out (a
 * test asserting "no further model call" relies on that).
 */
export declare class ScriptedProvider implements CoachModelProvider {
    private readonly script;
    readonly id = "scripted";
    readonly requests: CoachModelRequest[];
    private cursor;
    constructor(script: ScriptStep[]);
    get callCount(): number;
    generate(request: CoachModelRequest): Promise<CoachModelResponse>;
}
//# sourceMappingURL=provider.d.ts.map