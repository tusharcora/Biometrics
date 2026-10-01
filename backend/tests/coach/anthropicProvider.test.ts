// backend/tests/coach/anthropicProvider.test.ts
import Anthropic from '@anthropic-ai/sdk';
import {
  AnthropicProvider,
  DEFAULT_HOSTED_MODEL,
  HOSTED_FALLBACK_BETA,
  HOSTED_MAX_TOKENS,
  HostedConfigError,
  HostedRefusalError,
  anthropicProviderFromEnv,
  toAnthropicMessages,
} from '../../src/coach/model/anthropic';
import type { CoachModelRequest, CoachStreamRequest } from '../../src/coach/model/provider';

// The real SDK is never called: the constructor is auto-mocked (so the env
// factory can be checked), and every provider under test gets a fake client.
jest.mock('@anthropic-ai/sdk');

type Event = { type: string; delta?: { type: string; text?: string }; content_block?: { type: string } };

/**
 * A fake of the slice of the SDK the provider uses: beta.messages.stream / create.
 * Like the SDK's stream, it fails with an abort error once the request signal
 * fires, and records when its iterator is closed early (the SDK aborts the HTTP
 * request on iterator.return()).
 */
function fakeClient(opts: { events?: Event[]; stopReason?: string; failWith?: Error; content?: unknown[] } = {}) {
  const cancelled = { value: false };
  const stream = jest.fn((_body: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
    const events = opts.events ?? [];
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next(): Promise<IteratorResult<Event>> {
            if (opts.failWith) throw opts.failWith;
            if (options?.signal?.aborted) throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' });
            return i < events.length ? { value: events[i++]!, done: false } : { value: undefined, done: true };
          },
          async return(): Promise<IteratorResult<Event>> {
            cancelled.value = true;
            return { value: undefined, done: true };
          },
        };
      },
      finalMessage: async () => ({ stop_reason: opts.stopReason ?? 'end_turn', content: [] }),
    };
  });
  const create = jest.fn(async (_body: Record<string, unknown>, _options?: { signal?: AbortSignal }) => {
    if (opts.failWith) throw opts.failWith;
    return { stop_reason: opts.stopReason ?? 'end_turn', content: opts.content ?? [] };
  });
  return { client: { beta: { messages: { stream, create } } } as unknown as Anthropic, stream, create, cancelled };
}

const textDelta = (text: string): Event => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
/** A server-side fallback boundary: the model before it declined, the next one takes over. */
const fallbackStart: Event = { type: 'content_block_start', content_block: { type: 'fallback' } };

function streamRequest(overrides: Partial<CoachStreamRequest> = {}): CoachStreamRequest {
  return {
    system: 'You are Hoot.',
    messages: [{ role: 'user', content: 'How did I sleep?' }],
    maxTokens: 600,
    ...overrides,
  };
}

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of it) out.push(chunk);
  return out;
}

describe('toAnthropicMessages', () => {
  it('drops empty turns and any assistant turn before the first user turn', () => {
    expect(
      toAnthropicMessages([
        { role: 'assistant', content: 'Earlier reply cut by the history window.' },
        { role: 'user', content: '   ' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: '' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'How did I sleep?' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'How did I sleep?' },
    ]);
  });
});

describe('AnthropicProvider.stream', () => {
  it('sends the Opus 5.5 request shape: low effort, server-side fallback, no thinking or sampling params', async () => {
    const { client, stream } = fakeClient({ events: [textDelta('Hi.')] });
    const provider = new AnthropicProvider({ client });
    const signal = new AbortController().signal;

    await collect(provider.stream(streamRequest({ signal })));

    expect(stream).toHaveBeenCalledTimes(1);
    const [body, options] = stream.mock.calls[0]!;
    expect(body).toEqual({
      model: DEFAULT_HOSTED_MODEL,
      max_tokens: HOSTED_MAX_TOKENS,
      system: 'You are Hoot.',
      messages: [{ role: 'user', content: 'How did I sleep?' }],
      output_config: { effort: 'low' },
      betas: [HOSTED_FALLBACK_BETA],
      fallbacks: 'default',
    });
    expect(DEFAULT_HOSTED_MODEL).toBe('claude-opus-5-5');
    expect(HOSTED_FALLBACK_BETA).toBe('server-side-fallback-2026-07-01');
    expect(HOSTED_MAX_TOKENS).toBe(2000);
    expect(body).not.toHaveProperty('thinking');
    expect(body).not.toHaveProperty('temperature');
    expect(options).toEqual({ signal });
  });

  it('uses the configured model', async () => {
    const { client, stream } = fakeClient({ events: [] });
    await collect(new AnthropicProvider({ client, model: 'claude-sonnet-5-5' }).stream(streamRequest()));
    expect(stream.mock.calls[0]![0]).toMatchObject({ model: 'claude-sonnet-5-5' });
  });

  it('yields only text deltas, in order', async () => {
    const { client } = fakeClient({
      events: [
        { type: 'message_start' },
        { type: 'content_block_start', content_block: { type: 'text' } },
        { type: 'content_block_delta', delta: { type: 'thinking_delta' } },
        textDelta('Your recovery '),
        textDelta('is 26.'),
        { type: 'content_block_stop' },
        { type: 'message_stop' },
      ],
    });
    expect(await collect(new AnthropicProvider({ client }).stream(streamRequest()))).toEqual(['Your recovery ', 'is 26.']);
  });

  it('throws HostedRefusalError when the whole fallback chain refused', async () => {
    const { client } = fakeClient({ events: [], stopReason: 'refusal' });
    await expect(collect(new AnthropicProvider({ client }).stream(streamRequest()))).rejects.toBeInstanceOf(HostedRefusalError);
  });

  it('throws HostedRefusalError after text was already yielded when the chain refused', async () => {
    const { client } = fakeClient({ events: [textDelta('Your recovery ')], stopReason: 'refusal' });
    const seen: string[] = [];
    const run = async () => {
      for await (const chunk of new AnthropicProvider({ client }).stream(streamRequest())) seen.push(chunk);
    };
    await expect(run()).rejects.toBeInstanceOf(HostedRefusalError);
    expect(seen).toEqual(['Your recovery ']);
  });

  it('streams the fallback model normally when the switch came before any text', async () => {
    const { client } = fakeClient({
      events: [{ type: 'message_start' }, fallbackStart, { type: 'content_block_stop' }, textDelta('Recovery is 26.')],
    });
    expect(await collect(new AnthropicProvider({ client }).stream(streamRequest()))).toEqual(['Recovery is 26.']);
  });

  it('stops with HostedRefusalError on a mid-reply model switch, never appending the second answer', async () => {
    const { client, cancelled } = fakeClient({
      events: [textDelta('Your recovery '), fallbackStart, { type: 'content_block_stop' }, textDelta('Recovery is 26.')],
    });
    const seen: string[] = [];
    const run = async () => {
      for await (const chunk of new AnthropicProvider({ client }).stream(streamRequest())) seen.push(chunk);
    };
    await expect(run()).rejects.toBeInstanceOf(HostedRefusalError);
    expect(seen).toEqual(['Your recovery ']);
    expect(cancelled.value).toBe(true);
  });

  it('cancels the SDK stream when the caller stops iterating', async () => {
    const { client, cancelled } = fakeClient({ events: [textDelta('One. '), textDelta('Two.')] });
    const iterator = new AnthropicProvider({ client }).stream(streamRequest())[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 'One. ', done: false });
    await iterator.return?.();
    expect(cancelled.value).toBe(true);
  });

  it('stops with the abort error when the request signal fires', async () => {
    const controller = new AbortController();
    const { client } = fakeClient({ events: [textDelta('One. '), textDelta('Two.')] });
    const seen: string[] = [];
    const run = async () => {
      for await (const chunk of new AnthropicProvider({ client }).stream(streamRequest({ signal: controller.signal }))) {
        seen.push(chunk);
        controller.abort();
      }
    };
    await expect(run()).rejects.toMatchObject({ name: 'APIUserAbortError' });
    expect(seen).toEqual(['One. ']);
  });

  it('passes an SDK error through unchanged', async () => {
    const failure = Object.assign(new Error('overloaded'), { name: 'InternalServerError' });
    const { client } = fakeClient({ failWith: failure });
    await expect(collect(new AnthropicProvider({ client }).stream(streamRequest()))).rejects.toBe(failure);
  });

  it('omits the request options when there is no signal', async () => {
    const { client, stream } = fakeClient({ events: [] });
    await collect(new AnthropicProvider({ client }).stream(streamRequest()));
    expect(stream.mock.calls[0]![1]).toBeUndefined();
  });
});

describe('AnthropicProvider.generate (legacy text-only path)', () => {
  const legacy = (overrides: Partial<CoachModelRequest> = {}): CoachModelRequest => ({
    tier: 'fast',
    system: 'SYS',
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant_tool_calls', calls: [{ id: 'c1', name: 'getDailyScore', args: {} }] },
      { role: 'tool', toolCallId: 'c1', name: 'getDailyScore', content: '{"recoveryScore":80}' },
      { role: 'system', content: 'Use only the numbers above.' },
    ],
    tools: [{ name: 'getDailyScore', description: 'd', parameters: {} }],
    signal: new AbortController().signal,
    ...overrides,
  });

  it('sends no tools and folds tool results and notices into user text', async () => {
    const { client, create } = fakeClient({ content: [{ type: 'thinking' }, { type: 'text', text: 'Recovery is 80.' }] });
    const res = await new AnthropicProvider({ client }).generate(legacy());

    expect(res).toEqual({ type: 'text', text: 'Recovery is 80.' });
    const [body] = create.mock.calls[0]!;
    expect(body).not.toHaveProperty('tools');
    expect(body).toMatchObject({ output_config: { effort: 'low' }, betas: [HOSTED_FALLBACK_BETA], fallbacks: 'default' });
    expect(body.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'user', content: '[getDailyScore result] {"recoveryScore":80}' },
      { role: 'user', content: '[system notice] Use only the numbers above.' },
    ]);
  });

  it('returns only the serving model text after a server-side fallback', async () => {
    const { client } = fakeClient({
      content: [{ type: 'text', text: 'Partial from the declining model' }, { type: 'fallback' }, { type: 'text', text: 'Recovery is 80.' }],
    });
    expect(await new AnthropicProvider({ client }).generate(legacy())).toEqual({ type: 'text', text: 'Recovery is 80.' });
  });

  it('throws HostedRefusalError on a refusal', async () => {
    const { client } = fakeClient({ stopReason: 'refusal' });
    await expect(new AnthropicProvider({ client }).generate(legacy())).rejects.toBeInstanceOf(HostedRefusalError);
  });
});

describe('anthropicProviderFromEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    (Anthropic as unknown as jest.Mock).mockClear();
  });

  it('refuses to build without ANTHROPIC_API_KEY', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => anthropicProviderFromEnv()).toThrow(HostedConfigError);
    process.env.ANTHROPIC_API_KEY = '   ';
    expect(() => anthropicProviderFromEnv()).toThrow(HostedConfigError);
  });

  it('builds the SDK client with the key and one retry, and reads COACH_HOSTED_MODEL', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.COACH_HOSTED_MODEL = ' claude-opus-5 ';
    const provider = anthropicProviderFromEnv();
    expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test', maxRetries: 1 });
    expect(provider.id).toBe('anthropic:claude-opus-5');
  });

  it('defaults the model to claude-opus-5-5', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    delete process.env.COACH_HOSTED_MODEL;
    expect(anthropicProviderFromEnv().id).toBe('anthropic:claude-opus-5-5');
  });
});
