export declare function lnGamma(x: number): number;
/** Regularized incomplete beta I_x(a, b), for a, b > 0 and x in [0, 1]. */
export declare function regularizedIncompleteBeta(x: number, a: number, b: number): number;
/** Two-sided p-value P(|T| >= |t|) for a Student-t with `df` (real-valued, > 0) degrees of freedom. */
export declare function studentTTwoSidedP(t: number, df: number): number;
/** Pearson r; 0 for fewer than 2 points or a constant series (undefined r is "no evidence", never NaN). */
export declare function pearson(x: number[], y: number[]): number;
/**
 * Subtracts each value's own weekday mean (weekday = 0..6). Weekly rhythm
 * shared by a habit and a biometric (weekend drinking, weekend sleep debt)
 * would otherwise read as correlation whether or not a relationship exists.
 */
export declare function deseasonalize(values: number[], weekdays: number[]): number[];
/**
 * Sample lag-1 autocorrelation. `dayNumbers` (strictly increasing) says which
 * observations are calendar neighbours: an observation series with gaps (a
 * dropped imputed day, an unobserved habit day) must not treat the two sides
 * of a gap as consecutive. Both numerator and denominator are averaged over
 * their own term counts so a gappy series is not shrunk toward 0.
 */
export declare function lag1Autocorrelation(values: number[], dayNumbers?: number[]): number;
/** Smallest effective sample size the test will use; keeps df >= 1 and the t statistic finite. */
export declare const MIN_EFFECTIVE_N = 3;
/**
 * Pyper & Peterman (1998): n_eff = n (1 - rho_h rho_f) / (1 + rho_h rho_f),
 * floored at 3 (two strongly positively autocorrelated series can drive it to
 * ~0 or below). Capped at n as well: a negative rho product would inflate it
 * past n, which is the anti-conservative direction, and this engine has no
 * reason to credit that.
 */
export declare function effectiveSampleSize(n: number, rhoHabit: number, rhoFactor: number): number;
/**
 * Two-sided p for a correlation `r` given an effective sample size:
 * t = r sqrt(df / (1 - r^2)) on df degrees of freedom. The p-value is
 * continuous, so unlike a permutation test it has no floor tied to how many
 * days of data exist.
 *
 * `seasonalParams` is how many parameters were estimated FROM THIS DATA before
 * the correlation was taken -- the weekday means deseasonalize() subtracts.
 * Fitting them and then testing the residuals as if they were raw observations
 * is the classic way to get p-values that are too small: the residuals are
 * closer together than the data was, so r looks more reliable than it is. The
 * standard correction for correlating residuals after removing p regressors is
 * df = n - 2 - p.
 *
 * df is floored at 1 so a short, heavily-adjusted series degrades to a weak,
 * honest test rather than a non-finite one.
 */
export declare function correlationPValue(r: number, nEff: number, seasonalParams?: number): number;
/**
 * Degrees of freedom deseasonalize() consumes: one mean per weekday actually
 * present, minus the one the overall mean already accounts for. A series
 * spanning a full week costs 6; three distinct weekdays cost 2.
 */
export declare function seasonalParamsFor(weekdays: number[]): number;
/**
 * Benjamini-Hochberg adjusted p-values ("q-values"), in the input order: a
 * hypothesis is rejected at FDR level q exactly when its adjusted value < q.
 * Adjusted_i = min over k >= rank(i) of p_(k) m / k, capped at 1.
 */
export declare function benjaminiHochberg(pValues: number[]): number[];
//# sourceMappingURL=stats.d.ts.map