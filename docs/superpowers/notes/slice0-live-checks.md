# Slice 0 live checks

Slice 0 of the Stat Engine (`docs/superpowers/specs/2026-09-20-stat-engine-design.md`) ships
with three things that can only be settled against a real, connected Google Health account.
The backend code is written to hold either way (sessions are stored whole; the rollup key is
one function of `User.timezone`), but these must be run and recorded before Slice 1 builds
scores on top, and before the exit criteria are declared met.

## How to run the probe

Read-only: no DB writes, no Google state changes. It uses the stored access token as-is and
does not refresh it.

1. Make sure the test account is connected and has at least ~2 weeks of sleep, including
   ideally a nap or a split night.
2. Make sure `User.timezone` is the account's real zone (have the mobile client call
   `PUT /me/timezone`, or check the row). With the `UTC` default the "local" columns just
   repeat the UTC ones and check 1 cannot be answered.
3. If the stored token may be stale, let the token-refresh sweep run or open the app first
   (the probe prints a clear message on a 401).
4. From `backend/`, with `DATABASE_URL` and `TOKEN_ENCRYPTION_KEY` set for the environment
   that holds the account:

   ```
   npx ts-node scripts/probeSleepShape.ts <userId> --days 30
   ```

Output has three sections: every session (start, end, minutesAsleep, in-bed minutes, ratio,
local vs UTC end date, flags), sessions per local day, and civil-date basis hints (how often
Google's HRV / RESTING_HR / STEPS dates coincide with the session end date under each
candidate basis).

Save the raw output alongside this note (or paste it into the section below) so the result is
reproducible.

## Check 1: Google civil-date timezone basis

Question: are the civil dates in `dailyRollUp` (`civilStartTime`, STEPS/RESTING_HR) and
`daily-heart-rate-variability` (`.date`) computed in the user's local calendar, the device's,
or UTC?

Read from probe section 3. If "end date, user tz" has the highest HRV fit and HRV/RHR/STEPS
sit on the wake-up day, the local-end-date key is correct. If "end date, UTC" fits best, the
civil dates are UTC-based and SLEEP must be keyed with UTC, not `User.timezone` (a one-line
change in `civilDate.localCivilDate` callers; sessions and rollups are re-derivable).

Record:
- account timezone, window, number of nights
- fit counts for each of the four candidate bases
- verdict: local / UTC / other, and the evidence
- exit criterion (a): for a sample of days D, do HRV, RHR and the SLEEP rollup refer to the
  same night? (list 3 to 5 example days)

## Check 2: Sleep interval semantics

Question: is `endTime - startTime` time-in-bed (so `minutesAsleep / in-bed` is a sleep
efficiency), or something else?

Read from probe section 1 (`inBed`, `asleep/inBed`, `ASLEEP>INBED` flag). If `minutesAsleep`
is never above the interval and the ratio clusters around 0.85 to 0.95, the interval is
time-in-bed and `sleepEfficiency` (Slice 1.5) is meaningful. If `minutesAsleep` exceeds the
interval, or the ratio is near 1.0 for everything, the interval is not usable as time-in-bed.

Record:
- min / median / max of `asleep/inBed`
- any session where `minutesAsleep > inBed`
- verdict: interval is / is not time-in-bed

## Check 3: Multi-session nights

Question: how is a night with more than one `Sleep` object (nap, device-reported split
session) represented?

Read from probe section 2 (sessions per local day and the per-session layout of multi-session
days). Look for: naps as separate short objects on the same local day; one night split into
adjacent objects around a brief waking; or a single object regardless.

Record:
- histogram of sessions per local day
- for each multi-session day: start/end/minutesAsleep of each and whether they are a nap, a
  split night, or something else
- exit criterion (c): does the rollup for such a day equal the sum, and does it match what
  the Fitbit / Google Health app shows for that day?
- verdict: whether summing all sessions is the right daily total (the current design), or
  whether some sessions should be excluded

## Related open items from Slice 0

- Confirm how far back the existing backfill (30 days, `BACKFILL_WINDOW_DAYS`) reaches for
  this account, i.e. whether it covers 14 nights (bounds the circadian-consistency cold
  start).
- Whether Google exposes a dedicated resting-heart-rate data type (unchanged from the spec;
  not covered by the probe).
- Exit criterion (b) (re-running any fetch job in any window shape leaves totals unchanged)
  is covered by automated tests against mocked Google responses; re-confirm once against the
  real account by running the wipe-and-resync twice (`scripts/resyncSleep.ts --apply --user
  <id>`, dry run first) and diffing the SLEEP rows.

## Results

_To be filled in after running the probe._
