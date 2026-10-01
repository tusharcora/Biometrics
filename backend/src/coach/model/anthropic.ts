// backend/src/coach/model/anthropic.ts
// The hosted coach model: Claude, through the official Anthropic SDK (spec
// 2026-09-30 section 3). Opt-in per user, behind COACH_HOSTED_ENABLED and a
// separate HOSTED consent; the local model stays the default.
//
// Request shape (claude-opus-5-5):
// - no `thinking` field: thinking is always on for this model, and sending
//   {type:'disabled'} or a budget_tokens value is a 400. `output_config.effort`
//   is the control; 'low' keeps a coach answer quick and cheap.
// - no temperature/top_p/top_k (non-default sampling parameters are rejected).
// - server-side refusal fallback on: `fallbacks: 'default'` under the
//   `server-side-fallback-2026-07-01` beta, on the BETA messages endpoint. A
//   classifier decline is re-run on Anthropic's recommended fallback model in
//   the same call; only a refusal of the whole chain reaches us, as
//   stop_reason 'refusal', and is thrown as HostedRefusalError so the caller can
//   answer locally instead.
// - max_tokens 2000: thinking counts toward it, so it is sized well above the
//   ~300-500 token answer.
//
// Only the system prompt (persona + fact sheet) and the windowed conversation
// are ever sent; no user id, email or name has a path into a request.

import Anthropic from '@anthropic-ai/sdk';
import type {
  CoachModelMessage,
  CoachModelProvider,
  CoachModelRequest,
  CoachModelResponse,
  CoachStreamRequest,
} from './provider';

export const DEFAULT_HOSTED_MODEL = 'claude-opus-5-5';
export const HOSTED_MAX_TOKENS = 2000;
export const HOSTED_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The hosted model (and any fallback model) declined the request. */
export class HostedRefusalError extends Error {
  constructor() {
    super('The hosted model declined the request');
    this.name = 'HostedRefusalError';
  }
}

export class HostedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostedConfigError';
  }
}

export interface AnthropicProviderOptions {
  /** The SDK client, or the slice of it this provider uses. Injected in tests. */
  client: Pick<Anthropic, 'beta'>;
  model?: string | undefined;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * The Messages API wants a non-empty text per turn and a user turn first. The
 * history window can start on an assistant reply, and an interrupted reply can
 * be stored empty, so both are dropped here rather than sent as a 400.
 */
export function toAnthropicMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.content.trim().length === 0) continue;
    if (out.length === 0 && m.role !== 'user') continue;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

/** The legacy tool-loop transcript as plain text turns: the hosted model is never given tools. */
function legacyMessages(messages: readonly CoachModelMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    switch (m.role) {
      case 'user':
      case 'assistant':
        out.push({ role: m.role, content: m.content });
        break;
      case 'system':
        out.push({ role: 'user', content: `[system notice] ${m.content}` });
        break;
      case 'tool':
        out.push({ role: 'user', content: `[${m.name} result] ${m.content}` });
        break;
      case 'assistant_tool_calls':
        break;
    }
  }
  return toAnthropicMessages(out);
}

export class AnthropicProvider implements CoachModelProvider {
  readonly id: string;
  private readonly client: Pick<Anthropic, 'beta'>;
  private readonly model: string;

  constructor(options: AnthropicProviderOptions) {
    this.client = options.client;
    this.model = options.model?.trim() || DEFAULT_HOSTED_MODEL;
    this.id = `anthropic:${this.model}`;
  }

  private params(system: string, messages: ChatMessage[]) {
    return {
      model: this.model,
      max_tokens: HOSTED_MAX_TOKENS,
      system,
      messages,
      output_config: { effort: 'low' as const },
      betas: [HOSTED_FALLBACK_BETA],
      fallbacks: 'default' as const,
    };
  }

  async *stream(request: CoachStreamRequest): AsyncIterable<string> {
    const stream = this.client.beta.messages.stream(
      this.params(request.system, toAnthropicMessages(request.messages)),
      request.signal ? { signal: request.signal } : undefined,
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new HostedRefusalError();
  }

  async generate(request: CoachModelRequest): Promise<CoachModelResponse> {
    const message = await this.client.beta.messages.create(
      { ...this.params(request.system, legacyMessages(request.messages)), stream: false },
      { signal: request.signal },
    );
    if (message.stop_reason === 'refusal') throw new HostedRefusalError();
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { type: 'text', text };
  }
}

/** Builds the provider from ANTHROPIC_API_KEY / COACH_HOSTED_MODEL. Throws HostedConfigError without a key. */
export function anthropicProviderFromEnv(): AnthropicProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new HostedConfigError('ANTHROPIC_API_KEY is required for the hosted coach engine');
  return new AnthropicProvider({
    // One retry: the answer budget (COACH_HOSTED_BUDGET_MS) bounds the whole call anyway.
    client: new Anthropic({ apiKey, maxRetries: 1 }),
    model: process.env.COACH_HOSTED_MODEL?.trim() || undefined,
  });
}
