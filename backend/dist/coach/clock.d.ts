export interface TimerHandle {
    cancel(): void;
}
export interface CoachClock {
    now(): number;
    setTimer(fn: () => void, ms: number): TimerHandle;
}
export declare const systemClock: CoachClock;
//# sourceMappingURL=clock.d.ts.map