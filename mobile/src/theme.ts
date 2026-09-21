export type MetricType = 'STEPS' | 'RESTING_HR' | 'SLEEP' | 'HRV';

interface MetricConfig {
  label: string;
  format: (value: number) => string;
  icon: string;
  color: { light: string; dark: string };
  // When present, a ring for this metric fills to value/goal -- a real,
  // commonly-understood target, not a fabricated score. Metrics without a
  // universal goal (resting heart rate, HRV) omit this and render as a solid
  // decorative ring instead of a percentage fill.
  goal?: number;
  goalLabel?: string;
}

// Google Health's own units per metric (see backend/src/health/client.ts):
// STEPS is a raw count, RESTING_HR is bpm, SLEEP is minutes asleep, HRV is
// milliseconds -- each formatted here into what a person reads at a glance.
export const METRIC_CONFIG: Record<MetricType, MetricConfig> = {
  STEPS: {
    label: 'Steps',
    format: (v) => Math.round(v).toLocaleString(),
    icon: 'footsteps-outline',
    color: { light: 'rgb(249, 115, 22)', dark: 'rgb(251, 146, 60)' },
    goal: 10000,
    goalLabel: '10,000 steps',
  },
  RESTING_HR: {
    label: 'Resting Heart Rate',
    format: (v) => `${Math.round(v)} bpm`,
    icon: 'heart-outline',
    color: { light: 'rgb(244, 63, 94)', dark: 'rgb(251, 113, 133)' },
  },
  SLEEP: {
    label: 'Sleep',
    format: (v) => {
      const hours = Math.floor(v / 60);
      const minutes = Math.round(v % 60);
      return `${hours}h ${minutes}m`;
    },
    icon: 'moon-outline',
    color: { light: 'rgb(99, 102, 241)', dark: 'rgb(129, 140, 248)' },
    goal: 480,
    goalLabel: '8h goal',
  },
  HRV: {
    label: 'HRV',
    format: (v) => `${v.toFixed(1)} ms`,
    icon: 'pulse-outline',
    color: { light: 'rgb(20, 184, 166)', dark: 'rgb(45, 212, 191)' },
  },
};

export const METRIC_ORDER: MetricType[] = ['STEPS', 'RESTING_HR', 'SLEEP', 'HRV'];

// Mirrors the CSS custom properties in global.css. React Navigation's native
// header isn't part of the NativeWind-styled tree, so it needs real color
// values rather than className tokens -- these must be kept numerically in
// sync with global.css by hand.
export const COLORS = {
  light: {
    background: 'rgb(250, 250, 249)',
    foreground: 'rgb(28, 25, 23)',
    border: 'rgb(231, 229, 228)',
    muted: 'rgb(120, 113, 108)',
    accent: 'rgb(0, 176, 185)',
    // 4-band "is this number good" scale for Recovery/Sleep scores, separate
    // from the per-metric colours above ("which metric is this").
    scoreExcellent: 'rgb(22, 163, 74)',
    scoreGood: 'rgb(101, 163, 13)',
    scoreFair: 'rgb(217, 119, 6)',
    scorePoor: 'rgb(220, 38, 38)',
    surfaceRaised: 'rgb(255, 255, 255)',
    hairline: 'rgb(231, 229, 228)',
    bar: 'rgb(24, 24, 27)',
    barIcon: 'rgb(212, 212, 216)',
    barActive: 'rgb(250, 250, 249)',
    barIconActive: 'rgb(24, 24, 27)',
    heatEmpty: 'rgb(245, 245, 244)',
    heat0: 'rgb(231, 229, 228)',
    heat1: 'rgb(254, 215, 170)',
    heat2: 'rgb(253, 186, 116)',
    heat3: 'rgb(251, 146, 60)',
    heat4: 'rgb(234, 88, 12)',
  },
  dark: {
    background: 'rgb(12, 12, 13)',
    foreground: 'rgb(245, 245, 244)',
    border: 'rgb(39, 39, 42)',
    muted: 'rgb(161, 161, 170)',
    accent: 'rgb(45, 197, 200)',
    scoreExcellent: 'rgb(74, 222, 128)',
    scoreGood: 'rgb(163, 230, 53)',
    scoreFair: 'rgb(251, 191, 36)',
    scorePoor: 'rgb(248, 113, 113)',
    surfaceRaised: 'rgb(32, 32, 36)',
    hairline: 'rgb(58, 58, 64)',
    bar: 'rgb(28, 28, 31)',
    barIcon: 'rgb(212, 212, 216)',
    barActive: 'rgb(250, 250, 249)',
    barIconActive: 'rgb(12, 12, 13)',
    heatEmpty: 'rgb(20, 20, 23)',
    heat0: 'rgb(39, 39, 42)',
    heat1: 'rgb(124, 45, 18)',
    heat2: 'rgb(194, 65, 12)',
    heat3: 'rgb(234, 88, 12)',
    heat4: 'rgb(251, 146, 60)',
  },
};

// Duration/easing constants for score-transition animations, so no component
// inlines its own. Easings are cubic-bezier control points (not Reanimated
// functions) so this file stays free of native imports; consumers wrap them
// with Easing.bezier(...MOTION.easing.x).
export const MOTION = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 600,
    reveal: 400,
  },
  easing: {
    standard: [0.4, 0, 0.2, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
  },
  // Spring configs shared by every pressable and sliding indicator, so no
  // component inlines its own numbers.
  spring: {
    press: { damping: 15, stiffness: 300 },
    settle: { damping: 20, stiffness: 200 },
  },
  // A pressed control settles at `scale`; with reduced motion it only dims to
  // `reducedOpacity` instead of changing size.
  press: { scale: 0.96, reducedOpacity: 0.7 },
  // Delay between consecutive staggered entrances, in ms.
  stagger: 70,
};
