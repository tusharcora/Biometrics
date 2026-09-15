export type AuthProvider = 'APPLE' | 'GOOGLE';
export type FitbitConnectionStatus = 'CONNECTED' | 'DISCONNECTED';
export type BiometricMetricType = 'HRV' | 'RESTING_HR' | 'SLEEP' | 'STEPS';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface FitbitTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  fitbitUserId: string;
}

export interface FitbitMetricPoint {
  recordedAt: Date;
  value: number;
}
