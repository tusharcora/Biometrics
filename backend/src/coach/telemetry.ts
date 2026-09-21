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

export type CoachEventName =
  | 'coach.tool_call'
  | 'coach.guardrail_reject'
  | 'coach.latency_budget_exceeded'
  | 'coach.turn_fallback'
  | 'coach.safety_classifier'
  | 'coach.memory_proposed'
  | 'coach.memory_rejected'
  | 'coach.memory_resolved'
  | 'coach.digest_generated'
  | 'coach.digest_skipped'
  | 'coach.digest_failed'
  | 'coach.push_sent'
  | 'coach.push_failed'
  | 'coach.retention_run'
  | 'coach.user_data_deleted';

export type CoachEventAttributes = Record<string, string | number | boolean>;

export interface CoachEvent {
  name: CoachEventName;
  userId: string;
  personaId: string;
  attributes: CoachEventAttributes;
}

export interface CoachTelemetry {
  emit(event: CoachEvent): void;
}

const FORBIDDEN_KEYS = /^(text|message|content|body|prompt|reply|result|args|value|memory|digest|title)$/i;

export class LoggerCoachTelemetry implements CoachTelemetry {
  constructor(private readonly log: (line: string) => void = (line) => console.info(line)) {}

  emit(event: CoachEvent): void {
    const attributes: CoachEventAttributes = {};
    for (const [k, v] of Object.entries(event.attributes)) {
      if (!FORBIDDEN_KEYS.test(k)) attributes[k] = v;
    }
    this.log(JSON.stringify({ event: event.name, userId: event.userId, personaId: event.personaId, ...attributes }));
  }
}

export class NoopCoachTelemetry implements CoachTelemetry {
  emit(): void {}
}
