// The model is abstracted behind CoachModelProvider (spec section 2).
//
// NO LLM provider has been cleared against the spec's data-handling gate
// (section 5: no-training, bounded retention, tool-result coverage, plus
// Google's downstream-sharing terms), so this repo ships exactly two
// implementations and no vendor SDK: UnconfiguredProvider (always throws, so
// every turn takes the server-composed fallback) and ScriptedProvider (a
// deterministic test/eval double). There is one provider slot and no failover:
// a fallback provider would have to clear the same bar, and until one does the
// plain fallback message is the degraded mode.
//
// Data minimization: only tool-result fields and the user's message (plus the
// windowed conversation) are ever placed in a request. Tokens and full history
// have no path into it.

import type { CoachToolSchema } from '../tools';

export type CoachTier = 'fast' | 'synthesis';

export interface ToolCallRequest {
  id: string;
  name: string;
  args: unknown;
}

export type CoachModelMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'system'; content: string }
  | { role: 'assistant_tool_calls'; calls: ToolCallRequest[] }
  /** `content` is the JSON-serialized tool result, exactly the fields the tool returned. */
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface CoachModelRequest {
  tier: CoachTier;
  system: string;
  messages: CoachModelMessage[];
  tools: CoachToolSchema[];
  /** Aborted when the turn's latency budget expires; a real provider should cancel the in-flight call. */
  signal: AbortSignal;
}

export type CoachModelResponse =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; calls: ToolCallRequest[] };

/**
 * One streamed answer (spec 2026-09-30, section 2.3): the answer pipeline makes
 * exactly one call per attempt, with no tools. `system` carries the persona,
 * the fact sheet and the output contract; `messages` is the recent
 * conversation, clean text only.
 */
export interface CoachStreamRequest {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  /** Aborted on the answer budget or when the client stops; a real provider cancels the in-flight call. */
  signal?: AbortSignal;
}

export interface CoachModelProvider {
  /** Stable id for telemetry. */
  readonly id: string;
  /** The tool-loop call; kept for the weekly digest and the old orchestrator until phase 5. */
  generate(request: CoachModelRequest): Promise<CoachModelResponse>;
  /** Text deltas of one answer, in order. Throws on a transport or model failure. */
  stream(request: CoachStreamRequest): AsyncIterable<string>;
  /** Optional: load the model ahead of the first question. Must never throw. */
  warm?(): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super('No coach model provider is configured');
    this.name = 'ProviderNotConfiguredError';
  }
}

export class UnconfiguredProvider implements CoachModelProvider {
  readonly id = 'unconfigured';
  async generate(): Promise<CoachModelResponse> {
    throw new ProviderNotConfiguredError();
  }
  async *stream(): AsyncIterable<string> {
    throw new ProviderNotConfiguredError();
  }
}

export type ScriptStep =
  | CoachModelResponse
  /** A function step can inspect the request, advance a fake clock, or return a never-settling promise. */
  | ((request: CoachModelRequest) => CoachModelResponse | Promise<CoachModelResponse>);

/**
 * Deterministic provider for tests and the eval harness: returns its script in
 * order, records every request, and fails loudly if the script runs out (a
 * test asserting "no further model call" relies on that).
 */
export class ScriptedProvider implements CoachModelProvider {
  readonly id = 'scripted';
  readonly requests: CoachModelRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: ScriptStep[]) {}

  get callCount(): number {
    return this.requests.length;
  }

  async generate(request: CoachModelRequest): Promise<CoachModelResponse> {
    this.requests.push(request);
    const step = this.script[this.cursor++];
    if (step === undefined) throw new Error('ScriptedProvider: script exhausted');
    return typeof step === 'function' ? step(request) : step;
  }

  async *stream(): AsyncIterable<string> {
    throw new Error('ScriptedProvider does not stream; use ScriptedStreamProvider');
  }
}

export type StreamStep =
  /** The whole reply as one chunk. */
  | string
  /** The reply as these chunks, in order. */
  | string[]
  /** Fails before any text. */
  | Error
  /** Streams these chunks, then fails (a dropped connection). */
  | { chunks: string[]; error: Error }
  /** Full control: inspect the request, wait on the signal, advance a fake clock. */
  | ((request: CoachStreamRequest) => AsyncIterable<string>);

/**
 * Deterministic streaming provider for tests: one script step per stream()
 * call, every request recorded, and a loud failure when the script runs out.
 */
export class ScriptedStreamProvider implements CoachModelProvider {
  readonly id = 'scripted-stream';
  readonly requests: CoachStreamRequest[] = [];
  private cursor = 0;

  constructor(private readonly script: StreamStep[]) {}

  get callCount(): number {
    return this.requests.length;
  }

  async generate(): Promise<CoachModelResponse> {
    throw new Error('ScriptedStreamProvider does not generate');
  }

  async *stream(request: CoachStreamRequest): AsyncIterable<string> {
    this.requests.push(request);
    const step = this.script[this.cursor++];
    if (step === undefined) throw new Error('ScriptedStreamProvider: script exhausted');
    if (typeof step === 'function') {
      yield* step(request);
      return;
    }
    if (step instanceof Error) throw step;
    if (typeof step === 'string') {
      yield step;
      return;
    }
    if (Array.isArray(step)) {
      yield* step;
      return;
    }
    yield* step.chunks;
    throw step.error;
  }
}
