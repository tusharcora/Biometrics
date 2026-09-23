"use strict";
// Stage 5 -- Explainability. Pure. The contributions are literally the addends
// of Stage 4's weighted sum (weight x direction x z), so this stage costs
// nothing to compute; what it adds is `points`, each factor's share of the
// distance the score sits from neutral, so the UI can say "HRV +8.2 pts".
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEUTRAL_SCORE = void 0;
exports.explainFactors = explainFactors;
/** The score a day with no signal (all z = 0) lands on. */
exports.NEUTRAL_SCORE = 50;
/**
 * points_i = contribution_i / sum(contribution) * (score - 50), so the points
 * sum exactly to score - 50. Sorted by contribution magnitude, largest first
 * (excluded factors, at 0, land last).
 */
function explainFactors(result) {
    const total = result.factors.reduce((sum, f) => sum + f.contribution, 0);
    const delta = result.score === null ? 0 : result.score - exports.NEUTRAL_SCORE;
    return result.factors
        .map((f) => ({ ...f, points: total === 0 || f.excluded ? 0 : (f.contribution / total) * delta }))
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}
//# sourceMappingURL=explain.js.map