"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeScoreChange = describeScoreChange;
exports.compareScores = compareScores;
exports.getDailyScore = getDailyScore;
exports.findMostRecentScoreDate = findMostRecentScoreDate;
const civilDate_1 = require("../../biometrics/civilDate");
const client_1 = require("../../db/client");
const dto_1 = require("../../scoring/dto");
const dates_1 = require("../../scoring/dates");
/** Pure: a score delta as a phrase; null when there is nothing to compare. */
function describeScoreChange(delta) {
    if (delta === null)
        return null;
    if (delta === 0)
        return 'unchanged from yesterday';
    const size = Math.abs(delta);
    return `${size} point${size === 1 ? '' : 's'} ${delta > 0 ? 'higher' : 'lower'} than yesterday`;
}
const round1 = (n) => Math.round(n * 10) / 10;
/** Pure: the signed difference and its direction from two already-rounded scores. */
function compareScores(today, yesterday) {
    if (today === null || yesterday === null)
        return { delta: null, direction: null };
    const delta = round1(today - yesterday);
    // A delta that rounds to zero is "unchanged": never report "higher by 0".
    return { delta, direction: delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged' };
}
async function getDailyScore(userId, date) {
    const day = (0, civilDate_1.civilDateToUtcMidnight)(date);
    const yesterday = (0, civilDate_1.civilDateToUtcMidnight)((0, dates_1.shiftDate)(date, -1));
    const rows = await client_1.prisma.dailyScore.findMany({ where: { userId, date: { in: [day, yesterday] } } });
    const rowFor = (d, type) => rows.find((r) => r.date.getTime() === d.getTime() && r.type === type);
    const scoreOf = (row) => row ? (0, dto_1.toDailyScoreDTO)(row, []).score : null;
    const recovery = rowFor(day, 'RECOVERY');
    const sleep = rowFor(day, 'SLEEP');
    const recoveryScore = scoreOf(recovery);
    const sleepScore = scoreOf(sleep);
    const rec = compareScores(recoveryScore, scoreOf(rowFor(yesterday, 'RECOVERY')));
    const slp = compareScores(sleepScore, scoreOf(rowFor(yesterday, 'SLEEP')));
    const factors = [];
    for (const row of [recovery, sleep]) {
        if (!row)
            continue;
        for (const f of (0, dto_1.toDailyScoreDTO)(row, []).factors) {
            factors.push({
                type: row.type,
                factor: f.factor,
                label: f.label,
                z: f.z,
                contribution: f.contribution,
                points: f.points,
                imputed: f.imputed,
                excluded: f.excluded,
            });
        }
    }
    // Object.fromEntries, not a literal: the keys come from the factor rows that
    // actually exist for this day.
    const factorsByKey = Object.fromEntries(factors.map((f) => [f.factor, f]));
    return {
        date,
        recoveryScore,
        sleepScore,
        factors,
        factorsByKey,
        confidence: (recovery ?? sleep)?.confidenceLevel ?? null,
        deltaFromYesterday: rec.delta,
        direction: rec.direction,
        sleepDeltaFromYesterday: slp.delta,
        sleepDirection: slp.direction,
        changeDisplay: describeScoreChange(rec.delta),
        sleepChangeDisplay: describeScoreChange(slp.delta),
    };
}
/** The newest civil date on or before `onOrBefore` that has an actual (non-cold-start) Recovery score. */
async function findMostRecentScoreDate(userId, onOrBefore) {
    const row = await client_1.prisma.dailyScore.findFirst({
        where: { userId, type: 'RECOVERY', score: { not: null }, date: { lte: (0, civilDate_1.civilDateToUtcMidnight)(onOrBefore) } },
        orderBy: { date: 'desc' },
        select: { date: true },
    });
    return row ? row.date.toISOString().slice(0, 10) : null;
}
//# sourceMappingURL=dailyScore.js.map