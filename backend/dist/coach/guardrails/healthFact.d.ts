export type HealthFactCategory = 'condition' | 'mental_health' | 'injury' | 'symptom' | 'reproductive' | 'body_measure' | 'care_provider' | 'crisis_overlap';
export interface HealthFactVerdict {
    blocked: boolean;
    categories: HealthFactCategory[];
}
export declare function classifyHealthFact(value: string): HealthFactVerdict;
//# sourceMappingURL=healthFact.d.ts.map