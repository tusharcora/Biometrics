export type CrisisCategory = 'self_harm' | 'medication' | 'acute_symptom';
export interface CrisisVerdict {
    triggered: boolean;
    categories: CrisisCategory[];
}
export declare function classifyCrisis(message: string): CrisisVerdict;
export declare const CRISIS_RESOURCES: string[];
/** Fixed, never model-generated. Served for any classifier hit; contains no user or health data. */
export declare const SAFETY_REPLY: string;
//# sourceMappingURL=crisis.d.ts.map