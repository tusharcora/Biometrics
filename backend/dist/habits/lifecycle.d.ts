export type HabitCorrelationStatus = 'CANDIDATE' | 'CONFIRMED' | 'RETIRED';
export declare const PASSES_TO_CONFIRM = 2;
export declare const MISSES_TO_RETIRE = 2;
export interface LifecycleState {
    status: HabitCorrelationStatus;
    consecutivePasses: number;
    consecutiveMisses: number;
}
/** State after one weekly run. `passed` = survived BH at q<0.10 and |r|>0.3 in that run. */
export declare function nextLifecycleState(prev: LifecycleState | null, passed: boolean): LifecycleState | null;
//# sourceMappingURL=lifecycle.d.ts.map