export type CoachEventName = 'coach.tool_call' | 'coach.guardrail_reject' | 'coach.latency_budget_exceeded' | 'coach.turn_fallback' | 'coach.safety_classifier' | 'coach.memory_proposed' | 'coach.memory_rejected' | 'coach.memory_resolved' | 'coach.digest_generated' | 'coach.digest_skipped' | 'coach.digest_failed' | 'coach.push_sent' | 'coach.push_failed' | 'coach.retention_run' | 'coach.user_data_deleted';
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
export declare class LoggerCoachTelemetry implements CoachTelemetry {
    private readonly log;
    constructor(log?: (line: string) => void);
    emit(event: CoachEvent): void;
}
export declare class NoopCoachTelemetry implements CoachTelemetry {
    emit(): void;
}
//# sourceMappingURL=telemetry.d.ts.map