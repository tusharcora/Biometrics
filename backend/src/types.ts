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
