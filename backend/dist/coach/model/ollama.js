"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = exports.OllamaConfigError = exports.OllamaHttpError = void 0;
exports.isLoopbackUrl = isLoopbackUrl;
exports.toOllamaMessages = toOllamaMessages;
exports.stripThinking = stripThinking;
exports.ollamaProviderFromEnv = ollamaProviderFromEnv;
/** A non-2xx answer from Ollama (e.g. 404 for a model that is not pulled). The body is never echoed: it can contain request text. */
class OllamaHttpError extends Error {
    status;
    constructor(status) {
        super(`Ollama request failed with ${status}`);
        this.status = status;
        this.name = 'OllamaHttpError';
    }
}
exports.OllamaHttpError = OllamaHttpError;
class OllamaConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'OllamaConfigError';
    }
}
exports.OllamaConfigError = OllamaConfigError;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
function isLoopbackUrl(url) {
    try {
        const host = new URL(url).hostname;
        return LOOPBACK_HOSTS.has(host) || /^127\./.test(host);
    }
    catch {
        return false;
    }
}
function toOllamaMessages(system, messages) {
    const out = [{ role: 'system', content: system }];
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
function stripThinking(text) {
    // A complete block, then any unterminated one the output budget cut off.
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim();
}
// Ollama normally sends arguments as an object; some templates send a JSON string.
function parseArguments(raw) {
    if (typeof raw !== 'string')
        return raw ?? {};
    try {
        return JSON.parse(raw);
    }
    catch {
        return raw; // left for the tool validator to reject as invalid_arguments
    }
}
class OllamaProvider {
    options;
    id;
    fetchImpl;
    callCounter = 0;
    constructor(options) {
        this.options = options;
        if (!options.model)
            throw new OllamaConfigError('OLLAMA_MODEL is required when COACH_PROVIDER=ollama');
        if (!options.allowRemote && !isLoopbackUrl(options.baseUrl)) {
            throw new OllamaConfigError('OLLAMA_URL is not a loopback address; set OLLAMA_ALLOW_REMOTE=true only for a self-hosted server you control');
        }
        this.id = `ollama:${options.fastModel ? `${options.fastModel}+` : ''}${options.model}`;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    modelFor(tier) {
        return tier === 'fast' && this.options.fastModel ? this.options.fastModel : this.options.model;
    }
    async generate(request) {
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
        if (!res.ok)
            throw new OllamaHttpError(res.status);
        const json = (await res.json());
        const message = json.message ?? {};
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        if (calls.length > 0) {
            return {
                type: 'tool_calls',
                calls: calls.map((c) => ({
                    id: `ollama-${++this.callCounter}`,
                    name: String(c.function?.name ?? ''),
                    args: parseArguments(c.function?.arguments),
                })),
            };
        }
        return { type: 'text', text: stripThinking(String(message.content ?? '')) };
    }
}
exports.OllamaProvider = OllamaProvider;
function envNumber(name, min = Number.MIN_VALUE) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min)
        throw new OllamaConfigError(`${name} is not a valid value: ${raw}`);
    return n;
}
/** Builds the provider from OLLAMA_* environment variables. Throws OllamaConfigError on a bad configuration. */
function ollamaProviderFromEnv() {
    const flag = (name) => ['true', '1'].includes(process.env[name]?.trim().toLowerCase() ?? '');
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
//# sourceMappingURL=ollama.js.map