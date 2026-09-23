"use strict";
// Reading stored correlations. Only CONFIRMED rows are ever surfaced: a
// CANDIDATE is a single lucky-or-real week and showing it invites exactly the
// false-pattern risk the engine exists to prevent; a RETIRED row has stopped
// holding up.
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConfirmedWithSeries = listConfirmedWithSeries;
exports.getConfirmedCorrelations = getConfirmedCorrelations;
const client_1 = require("../db/client");
const habitTypes_1 = require("./habitTypes");
async function listConfirmedWithSeries(userId) {
    const [rows, types] = await Promise.all([
        client_1.prisma.habitCorrelation.findMany({
            where: { userId, status: 'CONFIRMED' },
            orderBy: [{ habitType: 'asc' }, { factor: 'asc' }, { lagDays: 'asc' }],
        }),
        (0, habitTypes_1.listHabitTypes)(userId),
    ]);
    const typeOf = new Map(types.map((t) => [t.type, t]));
    const out = [];
    for (const row of rows) {
        const type = typeOf.get(row.habitType);
        // A CONFIRMED row always carries the stats of the run that confirmed it;
        // the null checks only narrow the nullable columns.
        if (!type || row.effectSizePercent === null || row.comparisonPercent === null || !row.series)
            continue;
        out.push({
            habitType: row.habitType,
            exposureThreshold: type.exposureThreshold,
            exposureUnit: type.unit,
            factor: row.factor,
            lagDays: row.lagDays,
            effectSizePercent: row.effectSizePercent,
            comparisonPercent: row.comparisonPercent,
            sampleSize: row.sampleSize,
            direction: row.direction === 'lower' ? 'lower' : 'higher',
            series: row.series,
        });
    }
    return out;
}
/**
 * The structured output of the correlation engine (spec section 2): the lag,
 * threshold and unit, effect size and sample size a sentence needs are values
 * here, never free text. The future AI-coach tool wraps exactly this function,
 * so the coach cites these numbers instead of recomputing or paraphrasing them.
 * CONFIRMED rows only.
 */
async function getConfirmedCorrelations(userId) {
    const rows = await listConfirmedWithSeries(userId);
    return rows.map(({ series: _series, ...fields }) => fields);
}
//# sourceMappingURL=correlations.js.map