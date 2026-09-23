import {
  OllamaConfigError,
  OllamaHttpError,
  OllamaProvider,
  isLoopbackUrl,
  ollamaProviderFromEnv,
  stripThinking,
  toOllamaMessages,
} from '../../src/coach/model/ollama';
import type { CoachModelRequest } from '../../src/coach/model/provider';
import {
  getCoachBudgets,
  getCoachProvider,
  resetCoachProviderFromEnv,
  setCoachProvider,
} from '../../src/coach/config';

function fakeFetch(body: unknown, status = 200) {
  return jest.fn(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as jest.Mock & typeof fetch;
}

function request(overrides: Partial<CoachModelRequest> = {}): CoachModelRequest {
  return {
    tier: 'fast',
    system: 'You are the coach.',
    messages: [{ role: 'user', content: 'How did I sleep?' }],
    tools: [{ name: 'getDailyScore', description: 'Scores for a date', parameters: { type: 'object', properties: {} } }],
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('toOllamaMessages', () => {
  it('leads with the system prompt and maps every message role', () => {
    const out = toOllamaMessages('SYS', [
      { role: 'user', content: 'hi' },
      { role: 'assistant_tool_calls', calls: [{ id: 'c1', name: 'getDailyScore', args: { date: '2026-09-22' } }] },
      { role: 'tool', toolCallId: 'c1', name: 'getDailyScore', content: '{"score":80}' },
      { role: 'assistant', content: 'You scored {{getDailyScore.score}}.' },
      { role: 'system', content: 'Use only references.' },
    ]);

    expect(out).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'getDailyScore', arguments: { date: '2026-09-22' } } }] },
      { role: 'tool', tool_name: 'getDailyScore', content: '{"score":80}' },
      { role: 'assistant', content: 'You scored {{getDailyScore.score}}.' },
      // Qwen-family templates only accept a leading system message.
      { role: 'user', content: '[system notice] Use only references.' },
    ]);
  });
});

describe('stripThinking', () => {
  it('removes complete and truncated reasoning blocks', () => {
    expect(stripThinking('<think>plan</think>\nHello')).toBe('Hello');
    expect(stripThinking('Hi <think>cut off by the token limit')).toBe('Hi');
    expect(stripThinking('Plain')).toBe('Plain');
  });
});

describe('isLoopbackUrl', () => {
  it('accepts only loopback hosts', () => {
    expect(isLoopbackUrl('http://localhost:11434')).toBe(true);
    expect(isLoopbackUrl('http://127.0.0.1:11434')).toBe(true);
    expect(isLoopbackUrl('http://[::1]:11434')).toBe(true);
    expect(isLoopbackUrl('http://192.168.1.20:11434')).toBe(false);
    expect(isLoopbackUrl('https://ollama.example.com')).toBe(false);
    expect(isLoopbackUrl('not a url')).toBe(false);
  });
});

describe('OllamaProvider', () => {
  it('posts a non-streaming chat with tools, model settings and the abort signal', async () => {
    const fetchImpl = fakeFetch({ message: { role: 'assistant', content: 'Hello' } });
    const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434/', model: 'qwen3.8:27b', fetchImpl });
    const req = request();

    await provider.generate(req);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(init.signal).toBe(req.signal);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'qwen3.8:27b',
      stream: false,
      think: false,
      keep_alive: '60m',
      options: { temperature: 0.3, num_ctx: 8192, num_predict: 400 },
    });
    expect(body.tools).toEqual([
      { type: 'function', function: { name: 'getDailyScore', description: 'Scores for a date', parameters: { type: 'object', properties: {} } } },
    ]);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are the coach.' });
  });

  it('returns text with any reasoning stripped', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'm',
      fetchImpl: fakeFetch({ message: { content: '<think>hmm</think> You slept {{getDailyScore.sleep}}.' } }),
    });

    await expect(provider.generate(request())).resolves.toEqual({ type: 'text', text: 'You slept {{getDailyScore.sleep}}.' });
  });

  it('returns tool calls with minted ids, parsing string arguments', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'm',
      fetchImpl: fakeFetch({
        message: {
          content: '',
          tool_calls: [
            { function: { name: 'getDailyScore', arguments: { date: '2026-09-21' } } },
            { function: { name: 'getScoreHistory', arguments: '{"days":7}' } },
          ],
        },
      }),
    });

    const res = await provider.generate(request());

    expect(res).toEqual({
      type: 'tool_calls',
      calls: [
        { id: 'ollama-1', name: 'getDailyScore', args: { date: '2026-09-21' } },
        { id: 'ollama-2', name: 'getScoreHistory', args: { days: 7 } },
      ],
    });
  });

  it('uses the fast model for the fast tier only', async () => {
    const fetchImpl = fakeFetch({ message: { content: 'ok' } });
    const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'big', fastModel: 'small', fetchImpl });

    await provider.generate(request({ tier: 'fast' }));
    await provider.generate(request({ tier: 'synthesis' }));

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('small');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).model).toBe('big');
    expect(provider.id).toBe('ollama:small+big');
  });

  it('throws OllamaHttpError on a non-2xx answer (e.g. a model that is not pulled)', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'missing', fetchImpl: fakeFetch({ error: 'model not found' }, 404) });

    await expect(provider.generate(request())).rejects.toEqual(new OllamaHttpError(404));
  });

  it('propagates an abort from the turn budget', async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as unknown as typeof fetch;
    const provider = new OllamaProvider({ baseUrl: 'http://localhost:11434', model: 'm', fetchImpl });

    const pending = provider.generate(request({ signal: controller.signal }));
    controller.abort();

    await expect(pending).rejects.toThrow('aborted');
  });

  it('refuses a remote server unless explicitly allowed, and requires a model', () => {
    expect(() => new OllamaProvider({ baseUrl: 'http://10.0.0.5:11434', model: 'm' })).toThrow(OllamaConfigError);
    expect(() => new OllamaProvider({ baseUrl: 'http://10.0.0.5:11434', model: 'm', allowRemote: true })).not.toThrow();
    expect(() => new OllamaProvider({ baseUrl: 'http://localhost:11434', model: '' })).toThrow(OllamaConfigError);
  });
});

describe('coach provider selection', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    setCoachProvider(null);
    resetCoachProviderFromEnv();
    jest.restoreAllMocks();
  });

  it('is unconfigured unless COACH_PROVIDER=ollama', () => {
    delete process.env.COACH_PROVIDER;
    resetCoachProviderFromEnv();
    expect(getCoachProvider().id).toBe('unconfigured');
  });

  it('builds the Ollama provider from OLLAMA_* env', () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    process.env.COACH_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'qwen3.8:27b';
    process.env.OLLAMA_FAST_MODEL = 'granite4.1:8b';
    resetCoachProviderFromEnv();

    expect(getCoachProvider().id).toBe('ollama:granite4.1:8b+qwen3.8:27b');
  });

  it('degrades to unconfigured (and logs) on a bad Ollama configuration', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.COACH_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'm';
    process.env.OLLAMA_URL = 'http://203.0.113.9:11434';
    resetCoachProviderFromEnv();

    expect(getCoachProvider().id).toBe('unconfigured');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('coach.provider_config_invalid'));
  });

  it('lets an explicit override win over the environment', () => {
    process.env.COACH_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'm';
    const stub = { id: 'stub', generate: jest.fn() };
    setCoachProvider(stub);
    expect(getCoachProvider()).toBe(stub);
  });

  it('rejects a bad numeric setting', () => {
    process.env.OLLAMA_MODEL = 'm';
    process.env.OLLAMA_NUM_CTX = 'lots';
    expect(() => ollamaProviderFromEnv()).toThrow(OllamaConfigError);
  });

  it('reads latency budgets from env, ignoring junk', () => {
    delete process.env.COACH_FAST_BUDGET_MS;
    delete process.env.COACH_SYNTHESIS_BUDGET_MS;
    expect(getCoachBudgets()).toBeUndefined();

    process.env.COACH_FAST_BUDGET_MS = '90000';
    process.env.COACH_SYNTHESIS_BUDGET_MS = 'soon';
    expect(getCoachBudgets()).toEqual({ fast: 90000 });
  });
});
