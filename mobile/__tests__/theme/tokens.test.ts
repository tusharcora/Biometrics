import * as fs from 'fs';
import * as path from 'path';
import { COLORS, FONTS, METRIC_CONFIG, METRIC_ORDER, MOTION, type MetricType } from '../../src/theme';

const SCORE_KEYS = ['scoreExcellent', 'scoreGood', 'scoreFair', 'scorePoor'] as const;
const CSS_NAMES: Record<(typeof SCORE_KEYS)[number], string> = {
  scoreExcellent: 'score-excellent',
  scoreGood: 'score-good',
  scoreFair: 'score-fair',
  scorePoor: 'score-poor',
};

const css = fs.readFileSync(path.join(__dirname, '../../global.css'), 'utf8');
const [lightCss, darkCss] = css.split('@media (prefers-color-scheme: dark)');

function cssColor(block: string, name: string): string | null {
  const match = block.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
  return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : null;
}

// theme.ts and global.css are kept in sync by hand (spec 4) -- this is the
// safety net for that hand-syncing.
describe('score colour tokens', () => {
  it.each(SCORE_KEYS)('%s exists in both COLORS.light and COLORS.dark', (key) => {
    expect(COLORS.light[key]).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(COLORS.dark[key]).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it.each(SCORE_KEYS)('%s is numerically identical in theme.ts and global.css (light and dark)', (key) => {
    expect(cssColor(lightCss, CSS_NAMES[key])).toBe(COLORS.light[key]);
    expect(cssColor(darkCss, CSS_NAMES[key])).toBe(COLORS.dark[key]);
  });

  it.each(SCORE_KEYS)('%s has a tailwind colour entry backed by its CSS variable', (key) => {
    const config = require('../../tailwind.config.js');
    const name = CSS_NAMES[key];
    expect(config.theme.extend.colors[name]).toBe(`rgb(var(--color-${name}) / <alpha-value>)`);
  });
});

describe('design tokens (new semantic colors)', () => {
  const tailwind = require('../../tailwind.config.js');
  const [lightBlock, darkBlock] = css.split('@media (prefers-color-scheme: dark)') as [string, string];

  function readVar(block: string, name: string): string {
    const match = block.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
    if (!match) throw new Error(`--color-${name} not found`);
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }

  // CSS variable name -> COLORS key. Only the tokens added by the redesign.
  const NEW_TOKENS: Array<[string, string]> = [
    ['surface-raised', 'surfaceRaised'],
    ['hairline', 'hairline'],
    ['bar', 'bar'],
    ['bar-icon', 'barIcon'],
    ['bar-active', 'barActive'],
    ['bar-icon-active', 'barIconActive'],
    ['heat-empty', 'heatEmpty'],
    ['heat-0', 'heat0'],
    ['heat-1', 'heat1'],
    ['heat-2', 'heat2'],
    ['heat-3', 'heat3'],
    ['heat-4', 'heat4'],
    ['sleep-heat-1', 'sleepHeat1'],
    ['sleep-heat-2', 'sleepHeat2'],
    ['sleep-heat-3', 'sleepHeat3'],
    ['sleep-heat-4', 'sleepHeat4'],
    // Sleep depth: the four stage colours of the hypnogram and stage bars.
    ['sleep-deep', 'sleepDeep'],
    ['sleep-rem', 'sleepRem'],
    ['sleep-light', 'sleepLight'],
    ['sleep-awake', 'sleepAwake'],
    ['metric-steps', 'metricSteps'],
    ['metric-heart', 'metricHeart'],
    ['metric-sleep', 'metricSleep'],
    ['metric-hrv', 'metricHrv'],
    ['coach', 'coach'],
    ['background', 'background'],
    ['foreground', 'foreground'],
    ['border', 'border'],
    ['muted-foreground', 'muted'],
    ['accent', 'accent'],
    ['card', 'card'],
    // Coach redesign: today-vs-usual status, bar track and tick, answer-card tip.
    ['status-below', 'statusBelow'],
    ['status-near', 'statusNear'],
    ['status-above', 'statusAbove'],
    ['status-below-text', 'statusBelowText'],
    ['status-above-text', 'statusAboveText'],
    ['today-usual', 'todayUsual'],
    ['today-track', 'todayTrack'],
    ['today-tick', 'todayTick'],
    ['tip', 'tip'],
    ['tip-foreground', 'tipForeground'],
  ];

  it.each(NEW_TOKENS)('--color-%s is identical in global.css and COLORS.%s (light and dark)', (cssName, key) => {
    expect((COLORS.light as Record<string, string>)[key]).toBe(readVar(lightBlock, cssName));
    expect((COLORS.dark as Record<string, string>)[key]).toBe(readVar(darkBlock, cssName));
  });

  // R36: light teal-600 was 2.95:1 as a fill on the track; teal-700 clears 3:1.
  it('uses teal-700 for the light status-above', () => {
    expect(readVar(lightBlock, 'status-above')).toBe('rgb(15, 118, 110)');
    expect(COLORS.light.statusAbove).toBe('rgb(15, 118, 110)');
  });

  // R40: small numbers coloured by status must be readable (WCAG AA 4.5:1) on
  // every surface they sit on: the page, a card, and a muted tile.
  function contrast(a: string, b: string): number {
    const lum = (rgb: string) => {
      const [r, g, b2] = rgb.match(/\d+/g)!.map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  }

  // today-usual only appears in the today bars (page or card, never a tile).
  it.each([
    ['status-below-text', 'light', ['background', 'card', 'muted']],
    ['status-above-text', 'light', ['background', 'card', 'muted']],
    ['today-usual', 'light', ['background', 'card']],
    ['status-below-text', 'dark', ['background', 'card', 'muted']],
    ['status-above-text', 'dark', ['background', 'card', 'muted']],
    ['today-usual', 'dark', ['background', 'card']],
  ] as const)('--color-%s is text-safe (>= 4.5:1) on %s surfaces', (name, theme, surfaces) => {
    const block = theme === 'light' ? lightBlock : darkBlock;
    for (const surface of surfaces) {
      expect(contrast(readVar(block, name), readVar(block, surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Stage colours are graphical marks (hypnogram blocks, stage bars), so they
  // need WCAG 1.4.11's 3:1 against the page they are drawn on.
  it.each([
    ['sleep-deep', 'light'],
    ['sleep-rem', 'light'],
    ['sleep-light', 'light'],
    ['sleep-awake', 'light'],
    ['sleep-deep', 'dark'],
    ['sleep-rem', 'dark'],
    ['sleep-light', 'dark'],
    ['sleep-awake', 'dark'],
  ] as const)('--color-%s reaches 3:1 against the %s background', (name, theme) => {
    const block = theme === 'light' ? lightBlock : darkBlock;
    expect(contrast(readVar(block, name), readVar(block, 'background'))).toBeGreaterThanOrEqual(3);
  });

  it.each(NEW_TOKENS)('--color-%s is registered with Tailwind', (cssName) => {
    const tailwindStr = require('fs').readFileSync(require('path').join(__dirname, '../../tailwind.config.js'), 'utf8');
    expect(tailwindStr).toContain(`var(--color-${cssName})`);
  });
});

describe('metric colours', () => {
  const METRIC_TOKEN: Record<MetricType, keyof typeof COLORS.light> = {
    STEPS: 'metricSteps',
    RESTING_HR: 'metricHeart',
    SLEEP: 'metricSleep',
    HRV: 'metricHrv',
  };

  it.each(METRIC_ORDER)('%s uses the same colour in METRIC_CONFIG and the metric token', (type) => {
    expect(METRIC_CONFIG[type].color.light).toBe(COLORS.light[METRIC_TOKEN[type]]);
    expect(METRIC_CONFIG[type].color.dark).toBe(COLORS.dark[METRIC_TOKEN[type]]);
  });
});

describe('type tokens', () => {
  const tailwind = require('../../tailwind.config.js');

  it('registers the sans and display families under the names App.tsx loads', () => {
    expect(tailwind.theme.extend.fontFamily.sans).toEqual([FONTS.sans]);
    expect(tailwind.theme.extend.fontFamily.display).toEqual([FONTS.display]);
  });

  it('loads every family in FONTS in App.tsx', () => {
    const app = fs.readFileSync(path.join(__dirname, '../../App.tsx'), 'utf8');
    for (const family of Object.values(FONTS)) {
      expect(app).toContain(`  ${family},`);
    }
  });
});

describe('MOTION tokens', () => {
  it('exposes ordered fast < normal < slow durations', () => {
    expect(MOTION.duration.fast).toBeLessThan(MOTION.duration.normal);
    expect(MOTION.duration.normal).toBeLessThan(MOTION.duration.slow);
  });

  it('exposes standard and decelerate easings as cubic-bezier control points', () => {
    expect(MOTION.easing.standard).toHaveLength(4);
    expect(MOTION.easing.decelerate).toHaveLength(4);
  });
});
