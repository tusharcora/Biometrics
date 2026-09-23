export type AuthProvider = 'APPLE' | 'GOOGLE';
export type BiometricMetricType = 'HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS';
export interface SessionTokens {
    accessToken: string;
    refreshToken: string;
}
export interface HealthMetricPoint {
    recordedAt: Date;
    value: number;
}
export interface SleepSessionPoint {
    startTime: Date;
    endTime: Date;
    minutesAsleep: number;
    startUtcOffsetSeconds?: number | null;
    endUtcOffsetSeconds?: number | null;
}
//# sourceMappingURL=types.d.ts.map