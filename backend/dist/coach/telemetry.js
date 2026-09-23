"use strict";
// Coach observability (spec "Cross-cutting: observability"). Correctness
// monitoring, not performance: a spike in coach.guardrail_reject split by
// reason is the signal that a prompt or persona change started producing
// unwrapped numbers or bad field references.
//
// DEVIATION: the spec describes OpenTelemetry spans. OpenTelemetry is not a
// dependency of this repo, so events go through this small pluggable
// interface and the default sink is a structured logger. An OTel sink can
// implement CoachTelemetry later without touching the orchestrator.
//
// Events carry ids, counts and reasons ONLY. The attribute type is restricted
// to primitives and no call site is given message text or tool results, so a
// sink cannot leak them; the default sink additionally never logs a key named
// like text.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopCoachTelemetry = exports.LoggerCoachTelemetry = void 0;
const FORBIDDEN_KEYS = /^(text|message|content|body|prompt|reply|result|args|value|memory|digest|title|categories|category)$/i;
class LoggerCoachTelemetry {
    log;
    constructor(log = (line) => console.info(line)) {
        this.log = log;
    }
    emit(event) {
        const attributes = {};
        for (const [k, v] of Object.entries(event.attributes)) {
            if (!FORBIDDEN_KEYS.test(k))
                attributes[k] = v;
        }
        this.log(JSON.stringify({ event: event.name, userId: event.userId, personaId: event.personaId, ...attributes }));
    }
}
exports.LoggerCoachTelemetry = LoggerCoachTelemetry;
class NoopCoachTelemetry {
    emit() { }
}
exports.NoopCoachTelemetry = NoopCoachTelemetry;
//# sourceMappingURL=telemetry.js.map