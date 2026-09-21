import * as fs from 'fs';
import * as path from 'path';
import { COLORS, MOTION } from '../../src/theme';

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
