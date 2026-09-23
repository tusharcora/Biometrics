import type { SparklineSeries } from './engine';
export interface ConfirmedCorrelation {
    habitType: string;
    exposureThreshold: number;
    exposureUnit: string;
    factor: string;
    lagDays: number;
    effectSizePercent: number;
    comparisonPercent: number;
    sampleSize: number;
    direction: 'higher' | 'lower';
}
export interface ConfirmedCorrelationWithSeries extends ConfirmedCorrelation {
    series: SparklineSeries;
}
export declare function listConfirmedWithSeries(userId: string): Promise<ConfirmedCorrelationWithSeries[]>;
/**
 * The structured output of the correlation engine (spec section 2): the lag,
 * threshold and unit, effect size and sample size a sentence needs are values
 * here, never free text. The future AI-coach tool wraps exactly this function,
 * so the coach cites these numbers instead of recomputing or paraphrasing them.
 * CONFIRMED rows only.
 */
export declare function getConfirmedCorrelations(userId: string): Promise<ConfirmedCorrelation[]>;
//# sourceMappingURL=correlations.d.ts.map