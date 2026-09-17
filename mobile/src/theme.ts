export type MetricType = 'STEPS' | 'RESTING_HR' | 'SLEEP' | 'HRV';

interface MetricConfig {
  label: string;
  format: (value: number) => string;
}

// Google Health's own units per metric (see backend/src/health/client.ts):
// STEPS is a raw count, RESTING_HR is bpm, SLEEP is minutes asleep, HRV is
// milliseconds -- each formatted here into what a person reads at a glance.
export const METRIC_CONFIG: Record<MetricType, MetricConfig> = {
  STEPS: {
    label: 'Steps',
    format: (v) => Math.round(v).toLocaleString(),
  },
  RESTING_HR: {
    label: 'Resting Heart Rate',
    format: (v) => `${Math.round(v)} bpm`,
  },
  SLEEP: {
    label: 'Sleep',
    format: (v) => {
      const hours = Math.floor(v / 60);
      const minutes = Math.round(v % 60);
      return `${hours}h ${minutes}m`;
    },
  },
  HRV: {
    label: 'HRV',
    format: (v) => `${v.toFixed(1)} ms`,
  },
};

export const METRIC_ORDER: MetricType[] = ['STEPS', 'RESTING_HR', 'SLEEP', 'HRV'];
