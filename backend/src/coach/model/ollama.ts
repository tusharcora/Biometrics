// A coach model provider backed by a local Ollama server (POST /api/chat).
//
// Why local: the spec's section 5 gate exists because a hosted provider sends
// health data off the machine. A model served by Ollama on this host keeps every
// request (tool results + the user's message) on the loopback interface, so by
// default this provider refuses any OLLAMA_URL that is not loopback. Pointing it
// at a self-hosted server elsewhere is an explicit, separate decision
// (OLLAMA_ALLOW_REMOTE=true).
//
// Adapter notes (from the local-model spike, docs/superpowers/notes/local-model-coach-plan.md):
// - The interface allows a `system` message mid-conversation (the orchestrator's
//   corrective retry). Qwen-family chat templates only accept a LEADING system
//   message, so a later one is sent as a user message prefixed "[system notice]".
// - Ollama returns tool calls without ids, so ids are minted here; the
//   orchestrator only uses them to pair a call with its result.
// - Reasoning models may inline <think>...</think> even with `think: false`;
//   that text is stripped so it can never reach the user.

import type {
  CoachModelMessage,
  CoachModelProvider,
  CoachModelRequest,
  CoachModelResponse,
  CoachTier,
} from './provider';

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
export class OllamaHttpError extends Error {
  constructor(readonly status: number) {
    super(`Ollama request failed with ${status}`);
    this.name = 'OllamaHttpError';
  }
}

export class OllamaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaConfigError';
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return LOOPBACK_HOSTS.has(host) || /^127\./.test(host);
  } catch {
    return false;
  }
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { function: { name: string; arguments: unknown } }[];
  tool_name?: string;
}

export function toOllamaMessages(system: string, messages: CoachModelMessage[]): OllamaMessage[] {
  const out: OllamaMessage[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    switch (m.role) {
      case 'user':
      case 'assistant':
        out.push({ role: m.role, content: m.content });
        break;
      case 'system':
        out.push({ role: 'user', content: `[system notice] ${m.content}` });
        break;
      case 'assistant_tool_calls':
        out.push({
          role: 'assistant',
          content: '',
          tool_calls: m.calls.map((c) => ({ function: { name: c.name, arguments: c.args ?? {} } })),
        });
        break;
      case 'tool':
        out.push({ role: 'tool', tool_name: m.name, content: m.content });
        break;
    }
  }
  return out;
}

export function stripThinking(text: string): string {
  // A complete block, then any unterminated one the output budget cut off.
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

// Ollama normally sends arguments as an object; some templates send a JSON string.
function parseArguments(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // left for the tool validator to reject as invalid_arguments
  }
}

export class OllamaProvider implements CoachModelProvider {
  readonly id: string;
  private readonly fetchImpl: typeof fetch;
  private callCounter = 0;

  constructor(private readonly options: OllamaProviderOptions) {
    if (!options.model) throw new OllamaConfigError('OLLAMA_MODEL is required when COACH_PROVIDER=ollama');
    if (!options.allowRemote && !isLoopbackUrl(options.baseUrl)) {
      throw new OllamaConfigError(
        'OLLAMA_URL is not a loopback address; set OLLAMA_ALLOW_REMOTE=true only for a self-hosted server you control',
      );
    }
    this.id = `ollama:${options.fastModel ? `${options.fastModel}+` : ''}${options.model}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  modelFor(tier: CoachTier): string {
    return tier === 'fast' && this.options.fastModel ? this.options.fastModel : this.options.model;
  }

  async generate(request: CoachModelRequest): Promise<CoachModelResponse> {
    const body = {
      model: this.modelFor(request.tier),
      stream: false,
      think: this.options.think ?? false,
      keep_alive: this.options.keepAlive ?? '60m',
      options: {
        temperature: this.options.temperature ?? 0.3,
        num_ctx: this.options.numCtx ?? 8192,
        num_predict: this.options.numPredict ?? 400,
      },
      messages: toOllamaMessages(request.system, request.messages),
      tools: request.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    };

    // An abort (the turn's latency budget expiring) rejects this fetch, which
    // cancels the HTTP request; Ollama stops generating when the client leaves.
    const res = await this.fetchImpl(`${this.options.baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    if (!res.ok) throw new OllamaHttpError(res.status);

    const json = (await res.json()) as { message?: { content?: unknown; tool_calls?: unknown } };
    const message = json.message ?? {};
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (calls.length > 0) {
      return {
        type: 'tool_calls',
        calls: calls.map((c: { function?: { name?: unknown; arguments?: unknown } }) => ({
          id: `ollama-${++this.callCounter}`,
          name: String(c.function?.name ?? ''),
          args: parseArguments(c.function?.arguments),
        })),
      };
    }
    return { type: 'text', text: stripThinking(String(message.content ?? '')) };
  }
}

function envNumber(name: string, min = Number.MIN_VALUE): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) throw new OllamaConfigError(`${name} is not a valid value: ${raw}`);
  return n;
}

/** Builds the provider from OLLAMA_* environment variables. Throws OllamaConfigError on a bad configuration. */
export function ollamaProviderFromEnv(): OllamaProvider {
  const flag = (name: string) => ['true', '1'].includes(process.env[name]?.trim().toLowerCase() ?? '');
  return new OllamaProvider({
    baseUrl: process.env.OLLAMA_URL?.trim() || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL?.trim() ?? '',
    fastModel: process.env.OLLAMA_FAST_MODEL?.trim() || undefined,
    think: flag('OLLAMA_THINK'),
    temperature: envNumber('OLLAMA_TEMPERATURE', 0),
    numCtx: envNumber('OLLAMA_NUM_CTX'),
    keepAlive: process.env.OLLAMA_KEEP_ALIVE?.trim() || undefined,
    allowRemote: flag('OLLAMA_ALLOW_REMOTE'),
  });
}
