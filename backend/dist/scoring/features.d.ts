import type { ScoreConfig } from './configs/v1';
import type { DailyPoint, SleepSessionInput } from './types';
/**
 * sleepDebtRolling14d = sum of max(0, sleepGoalMinutes - minutesAsleep) over
 * the window ending on `date` (inclusive). Each night is floored at 0, so a long
 * night does not pay back another night's deficit: it is a rolling deficit, not
 * a net balance.
 *
 * A night with no record contributes 0: absence of data is not evidence of a
 * full-goal deficit. (The caller flags that day's factor as imputed instead, so
 * confidence reflects it.)
 */
export declare function sleepDebtRolling(sleep: DailyPoint[], date: string, goalMinutes: number, cfg: ScoreConfig): number;
/**
 * The daily sleep-debt series through `throughDate`, needed as the baseline
 * history for that factor. A day is emitted only when its whole window lies
 * inside the user's history (first recorded night + window - 1): earlier
 * windows are understated by construction and would drag the baseline low,
 * making every later day look like unusually high debt.
 */
export declare function buildSleepDebtSeries(sleep: DailyPoint[], throughDate: string, goalMinutes: number, cfg: ScoreConfig): DailyPoint[];
/** Percent deviation of `value` from its EWMA baseline. */
export declare function baselineDeviationPct(value: number, ewma: number): number;
/**
 * Steps-derived acute:chronic workload ratio (7-day mean / 28-day mean).
 * Computed and stored so the series exists to validate later, but deliberately
 * NOT part of the Recovery composite: a steps proxy is not a validated training
 * load, and a weighted term built on it would carry unvalidated input.
 */
export declare function acuteChronicLoadRatio(steps: DailyPoint[], date: string, cfg: ScoreConfig): number | null;
/**
 * Sessions grouped by the local civil date of their END instant: at the
 * record's own end UTC offset when it has one, else in `timeZone`. The same key
 * the SLEEP rollup uses, so "night D" is the night that produced day D's HRV and
 * RHR.
 */
export declare function groupSessionsByNight(sessions: SleepSessionInput[], timeZone: string): Map<string, SleepSessionInput[]>;
/**
 * sleepEfficiency = sum(minutesAsleep) / sum(time in bed) over one night's
 * sessions, as a 0..1 fraction.
 *
 * ASSUMPTION, not a confirmed fact: time in bed is DERIVED as
 * (endTime - startTime) of each session, not read from Sleep.summary.timeInBed
 * (unverified against the live API). Whether that interval really equals time
 * in bed for every session shape (a segment of a longer night, a device-split
 * night) is a pending Slice 0 live check; see
 * docs/superpowers/notes/slice0-live-checks.md. Until it is settled this value
 * is only as good as that assumption.
 *
 * Sessions with a zero or negative interval carry no time-in-bed information
 * and are ignored (in both sums); a night with none left has no efficiency
 * (null), never a division by zero. The ratio is capped at 1: an interval
 * shorter than minutesAsleep is a data inconsistency, not efficiency above 100%.
 */
export declare function sleepEfficiency(nightSessions: SleepSessionInput[]): number | null;
/** Daily sleepEfficiency through `throughDate`, one point per night that has a usable interval. */
export declare function buildSleepEfficiencySeries(sessions: SleepSessionInput[], timeZone: string, throughDate: string): DailyPoint[];
/**
 * One point per night: the onset (start instant) of that night's MAIN session,
 * in minutes since 12:00 local (read at the record's own start UTC offset when it
 * has one, else in `timeZone`). Main = the longest by minutesAsleep (a
 * confirmed field, unlike the derived interval), earliest start on a tie, so a
 * nap or a brief split session never stands in for the night's bedtime.
 * Noon-anchored so bedtimes either side of midnight are one contiguous run.
 */
export declare function mainSessionOnsets(sessions: SleepSessionInput[], timeZone: string): DailyPoint[];
/**
 * Bedtime consistency for the trailing window ending on `date`: the population
 * stddev of the nightly onsets, inverted and normalized to 0..100 as
 * 100 * max(0, 1 - stddev / cfg.circadian.maxStdMinutes). 100 is a metronome
 * bedtime, 0 is a spread of maxStdMinutes or more; higher is better.
 *
 * Null (cold start) until cfg.circadian.minHistoryNights nights of history
 * exist up to `date`, and null when the window itself holds fewer than
 * cfg.circadian.minWindowNights nights (a stddev of two points is noise).
 * Both need only stored SleepSession history, which the Slice 0 re-sync
 * provides, so a user with >= 14 retrievable nights is not held back by
 * "starting from today".
 */
export declare function circadianConsistencyOn(onsets: DailyPoint[], date: string, cfg: ScoreConfig): number | null;
/**
 * The daily circadian-consistency series through `throughDate`: the baseline
 * history for that factor. Starts on the night the history first reaches
 * cfg.circadian.minHistoryNights, so the baseline itself (which needs
 * cfg.minHistoryDays of these points) is excluded for ~27 nights, as with the
 * sleep-debt series.
 */
export declare function buildCircadianSeries(onsets: DailyPoint[], throughDate: string, cfg: ScoreConfig): DailyPoint[];
//# sourceMappingURL=features.d.ts.map