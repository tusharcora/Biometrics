export type Verbosity = 'terse' | 'normal' | 'detailed';
export type Proactivity = 'reactive-only' | 'daily-checkin' | 'threshold-triggered';
export interface CoachPersona {
    id: string;
    name: string;
    /** Free-text style guidance, injected into the system prompt through the escaping template. */
    tone: string;
    verbosity: Verbosity;
    proactivity: Proactivity;
    /** Always includes REQUIRED_DISALLOWED_TOPICS; the prompt builder re-adds them if a config ever omits them. */
    disallowedTopics: string[];
}
export interface PersonaSet {
    version: string;
    defaultPersonaId: string;
    personas: CoachPersona[];
}
export declare const REQUIRED_DISALLOWED_TOPICS: readonly ["medical diagnosis", "medication dosing"];
export declare const v1Personas: PersonaSet;
//# sourceMappingURL=v1.d.ts.map