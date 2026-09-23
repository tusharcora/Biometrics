"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isoWeekKey = isoWeekKey;
exports.runHabitCorrelations = runHabitCorrelations;
const client_1 = require("../db/client");
const analysis_1 = require("./analysis");
const lifecycle_1 = require("./lifecycle");
/** ISO-8601 week key ("2026-W38"): one run per user per week. */
function isoWeekKey(date) {
    // Thursday of this week decides which ISO year the week belongs to.
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
const keyOf = (habitType, factor, lagDays) => `${habitType}|${factor}|${lagDays}`;
function statColumns(h) {
    return {
        r: h.r,
        pValue: h.pValue,
        qValue: h.qValue,
        effectSizePercent: h.effectSizePercent,
        comparisonPercent: h.comparisonPercent,
        sampleSize: h.sampleSize,
        direction: h.direction,
        series: h.series,
    };
}
/**
 * The weekly run for one user: test every (habit, factor, lag), then apply the
 * persistence rule to the stored rows. Nothing is surfaced by this function;
 * a pass only advances a row toward CONFIRMED.
 *
 * Idempotent per `runKey` (the ISO week by default): every row this run writes
 * is stamped with the key, and a later run finding that stamp does nothing.
 * Without that, a BullMQ retry or a doubled schedule would count one week as
 * two consecutive passes and confirm a pattern on a single week's evidence.
 * All writes go in one transaction, so a crash cannot leave a half-applied run
 * that the stamp would then wrongly treat as complete.
 */
async function runHabitCorrelations(userId, { now = new Date(), runKey = isoWeekKey(now) } = {}) {
    const existing = await client_1.prisma.habitCorrelation.findMany({ where: { userId } });
    if (existing.some((row) => row.lastRunKey === runKey))
        return { skipped: true, tested: 0, passed: 0 };
    const { hypotheses } = await (0, analysis_1.analyzeUser)(userId, now);
    const byKey = new Map(hypotheses.map((h) => [keyOf(h.habitType, h.factor, h.lagDays), h]));
    const rowKeys = new Set(existing.map((r) => keyOf(r.habitType, r.factor, r.lagDays)));
    const writes = [];
    for (const row of existing) {
        const hypothesis = byKey.get(keyOf(row.habitType, row.factor, row.lagDays));
        // Untested this run (gate not met, no data) counts as a miss, not as "no information".
        const next = (0, lifecycle_1.nextLifecycleState)({ status: row.status, consecutivePasses: row.consecutivePasses, consecutiveMisses: row.consecutiveMisses }, hypothesis?.passes ?? false);
        // updateMany, not update, so the run key can sit in the WHERE clause: the
        // read-then-check above is not atomic, and two runs racing for the same
        // week (a BullMQ retry, a doubled schedule) both passed it. Whichever
        // commits first stamps runKey; the other matches nothing and advances no
        // counter, instead of turning one week into two consecutive passes.
        writes.push(client_1.prisma.habitCorrelation.updateMany({
            where: { id: row.id, lastRunKey: { not: runKey } },
            data: { ...next, lastEvaluatedAt: now, lastRunKey: runKey, ...(hypothesis ? statColumns(hypothesis) : {}) },
        }));
    }
    for (const h of hypotheses) {
        if (!h.passes || rowKeys.has(keyOf(h.habitType, h.factor, h.lagDays)))
            continue;
        const first = (0, lifecycle_1.nextLifecycleState)(null, true);
        writes.push(client_1.prisma.habitCorrelation.create({
            data: {
                userId,
                habitType: h.habitType,
                factor: h.factor,
                lagDays: h.lagDays,
                ...first,
                lastEvaluatedAt: now,
                lastRunKey: runKey,
                ...statColumns(h),
            },
        }));
    }
    if (writes.length > 0) {
        try {
            await client_1.prisma.$transaction(writes);
        }
        catch (err) {
            // The (userId, habitType, factor, lagDays) unique constraint is the same
            // guard for the create path: a concurrent run that got there first owns
            // the row, and this run has nothing to add.
            if (err?.code !== 'P2002')
                throw err;
            return { skipped: true, tested: 0, passed: 0 };
        }
    }
    return { skipped: false, tested: hypotheses.length, passed: hypotheses.filter((h) => h.passes).length };
}
//# sourceMappingURL=job.js.map