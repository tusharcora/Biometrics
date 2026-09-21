import { computeComposite, logistic } from '../../src/scoring/composite';
import { v1Config } from '../../src/scoring/configs/v1';
import type { FactorInput } from '../../src/scoring/types';

const cfg = v1Config;

type Zs = { HRV: number | null; RHR: number | null; SLEEP_DEBT: number | null };

function inputs(z: Zs, over: Partial<Record<keyof Zs, Partial<FactorInput>>> = {}): FactorInput[] {
  return (['HRV', 'RHR', 'SLEEP_DEBT'] as const).map((factor) => ({
    factor,
    z: z[factor],
    imputed: false,
    excluded: z[factor] === null,
    ...over[factor],
  }));
}

describe('Stage 4: logistic squashing', () => {
  it('maps a zero weighted sum to 50 (a textbook normal day)', () => {
    expect(logistic(0, cfg.k)).toBe(50);
  });

  it('maps a favorable +2 sigma to 90 and an unfavorable -2 sigma to 10', () => {
    expect(logistic(2, cfg.k)).toBeCloseTo(90, 9);
    expect(logistic(-2, cfg.k)).toBeCloseTo(10, 9);
  });

  it('keeps k = ln(9)/2 in the versioned config rather than as a magic number', () => {
    expect(cfg.k).toBeCloseTo(Math.log(9) / 2, 12);
  });

  it('stays inside [0, 100] for extreme input', () => {
    expect(logistic(50, cfg.k)).toBeLessThanOrEqual(100);
    expect(logistic(-50, cfg.k)).toBeGreaterThanOrEqual(0);
  });
});

describe('Stage 4: computeComposite', () => {
  it('scores all-zero z at exactly 50', () => {
    const r = computeComposite(inputs({ HRV: 0, RHR: 0, SLEEP_DEBT: 0 }), cfg);
    expect(r.score).toBe(50);
  });

  it('scores +2 sigma of favorable deviation on every factor at ~90 (direction-corrected)', () => {
    // HRV up 2 sigma is good; RHR and sleep debt DOWN 2 sigma are good.
    const r = computeComposite(inputs({ HRV: 2, RHR: -2, SLEEP_DEBT: -2 }), cfg);
    expect(r.score).toBeCloseTo(90, 9);
  });

  it('counts a high RHR z and a high sleep-debt z against the score, and a high HRV z for it', () => {
    expect(computeComposite(inputs({ HRV: 1, RHR: 0, SLEEP_DEBT: 0 }), cfg).score!).toBeGreaterThan(50);
    expect(computeComposite(inputs({ HRV: 0, RHR: 1, SLEEP_DEBT: 0 }), cfg).score!).toBeLessThan(50);
    expect(computeComposite(inputs({ HRV: 0, RHR: 0, SLEEP_DEBT: 1 }), cfg).score!).toBeLessThan(50);
  });

  it('uses weights HRV 0.45 / RHR 0.35 / sleep debt 0.20 when nothing is excluded', () => {
    const r = computeComposite(inputs({ HRV: 1, RHR: 1, SLEEP_DEBT: 1 }), cfg);
    const byFactor = Object.fromEntries(r.factors.map((f) => [f.factor, f]));
    expect(byFactor.HRV!.weight).toBeCloseTo(0.45, 12);
    expect(byFactor.RHR!.weight).toBeCloseTo(0.35, 12);
    expect(byFactor.SLEEP_DEBT!.weight).toBeCloseTo(0.2, 12);
    expect(byFactor.HRV!.contribution).toBeCloseTo(0.45, 12);
    expect(byFactor.RHR!.contribution).toBeCloseTo(-0.35, 12);
    expect(byFactor.SLEEP_DEBT!.contribution).toBeCloseTo(-0.2, 12);
  });

  it('renormalizes the remaining weights to sum to 1 when HRV is cold-starting (0.35/0.55, 0.20/0.55)', () => {
    const r = computeComposite(inputs({ HRV: null, RHR: 1, SLEEP_DEBT: 1 }), cfg);
    const byFactor = Object.fromEntries(r.factors.map((f) => [f.factor, f]));
    expect(byFactor.HRV!.weight).toBe(0);
    expect(byFactor.HRV!.excluded).toBe(true);
    expect(byFactor.RHR!.weight).toBeCloseTo(0.35 / 0.55, 12);
    expect(byFactor.SLEEP_DEBT!.weight).toBeCloseTo(0.2 / 0.55, 12);
    expect(r.factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 12);
  });

  it('does not understate the composite when a factor is excluded (the sum stays weighted to 1)', () => {
    // Unfavorable +1 sigma on both remaining factors: with HRV excluded the weights renormalize
    // to 1, so the weighted sum is -1 -- not -0.55 as an un-renormalized sum would give.
    const r = computeComposite(inputs({ HRV: null, RHR: 1, SLEEP_DEBT: 1 }), cfg);
    expect(r.score).toBeCloseTo(logistic(-1, cfg.k), 9);
  });

  it('returns a null score and LOW confidence when every factor is excluded', () => {
    const r = computeComposite(inputs({ HRV: null, RHR: null, SLEEP_DEBT: null }), cfg);
    expect(r.score).toBeNull();
    expect(r.confidenceLevel).toBe('LOW');
    expect(r.factors.every((f) => f.excluded && f.contribution === 0)).toBe(true);
  });
});

describe('Stage 4: confidence', () => {
  it('is HIGH when every input is observed and no factor is excluded', () => {
    expect(computeComposite(inputs({ HRV: 0.3, RHR: -0.2, SLEEP_DEBT: 0.1 }), cfg).confidenceLevel).toBe('HIGH');
  });

  it('drops one level when any input was imputed', () => {
    const r = computeComposite(inputs({ HRV: 0, RHR: -0.2, SLEEP_DEBT: 0.1 }, { HRV: { imputed: true } }), cfg);
    expect(r.confidenceLevel).toBe('MEDIUM');
  });

  it('drops one level for imputation no matter how many inputs were imputed', () => {
    const r = computeComposite(
      inputs({ HRV: 0, RHR: 0, SLEEP_DEBT: 0.1 }, { HRV: { imputed: true }, RHR: { imputed: true } }),
      cfg,
    );
    expect(r.confidenceLevel).toBe('MEDIUM');
  });

  it('drops one level when a factor was excluded and the weights renormalized', () => {
    expect(computeComposite(inputs({ HRV: null, RHR: 0.1, SLEEP_DEBT: 0.1 }), cfg).confidenceLevel).toBe('MEDIUM');
  });

  it('is LOW when imputation and renormalization stack, or when two factors are excluded', () => {
    const stacked = computeComposite(inputs({ HRV: null, RHR: 0, SLEEP_DEBT: 0.1 }, { RHR: { imputed: true } }), cfg);
    expect(stacked.confidenceLevel).toBe('LOW');
    expect(computeComposite(inputs({ HRV: null, RHR: null, SLEEP_DEBT: 0.1 }), cfg).confidenceLevel).toBe('LOW');
  });
});
