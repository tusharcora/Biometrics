import type { CoachModelMessage, CoachModelProvider, CoachModelRequest, CoachModelResponse, CoachTier } from './provider';
export interface OllamaProviderOptions {
    baseUrl: string;
    /** Model used for both tiers unless `fastModel` is set. */
    model: string;
    /** Optional smaller/faster model for the fast (interactive) tier. */
    fastModel?: string | undefined;
    think?: boolean | undefined;
    temperature?: number | undefined;
    numCtx?: number | undefined;
    numPredict?: number | undefined;
    /** How long Ollama keeps the model loaded between turns (e.g. "60m"). */
    keepAlive?: string | undefined;
    allowRemote?: boolean | undefined;
    fetchImpl?: typeof fetch | undefined;
}
/** A non-2xx answer from Ollama (e.g. 404 for a model that is not pulled). The body is never echoed: it can contain request text. */
export declare class OllamaHttpError extends Error {
    readonly status: number;
    constructor(status: number);
}
export declare class OllamaConfigError extends Error {
    constructor(message: string);
}
export declare function isLoopbackUrl(url: string): boolean;
interface OllamaMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: {
        function: {
            name: string;
            arguments: unknown;
        };
    }[];
    tool_name?: string;
}
export declare function toOllamaMessages(system: string, messages: CoachModelMessage[]): OllamaMessage[];
export declare function stripThinking(text: string): string;
export declare class OllamaProvider implements CoachModelProvider {
    private readonly options;
    readonly id: string;
    private readonly fetchImpl;
    private callCounter;
    constructor(options: OllamaProviderOptions);
    modelFor(tier: CoachTier): string;
    generate(request: CoachModelRequest): Promise<CoachModelResponse>;
}
/** Builds the provider from OLLAMA_* environment variables. Throws OllamaConfigError on a bad configuration. */
export declare function ollamaProviderFromEnv(): OllamaProvider;
export {};
//# sourceMappingURL=ollama.d.ts.map