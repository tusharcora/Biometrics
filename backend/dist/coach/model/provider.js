"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptedProvider = exports.UnconfiguredProvider = exports.ProviderNotConfiguredError = void 0;
class ProviderNotConfiguredError extends Error {
    constructor() {
        super('No coach model provider is configured');
        this.name = 'ProviderNotConfiguredError';
    }
}
exports.ProviderNotConfiguredError = ProviderNotConfiguredError;
class UnconfiguredProvider {
    id = 'unconfigured';
    async generate() {
        throw new ProviderNotConfiguredError();
    }
}
exports.UnconfiguredProvider = UnconfiguredProvider;
/**
 * Deterministic provider for tests and the eval harness: returns its script in
 * order, records every request, and fails loudly if the script runs out (a
 * test asserting "no further model call" relies on that).
 */
class ScriptedProvider {
    script;
    id = 'scripted';
    requests = [];
    cursor = 0;
    constructor(script) {
        this.script = script;
    }
    get callCount() {
        return this.requests.length;
    }
    async generate(request) {
        this.requests.push(request);
        const step = this.script[this.cursor++];
        if (step === undefined)
            throw new Error('ScriptedProvider: script exhausted');
        return typeof step === 'function' ? step(request) : step;
    }
}
exports.ScriptedProvider = ScriptedProvider;
//# sourceMappingURL=provider.js.map