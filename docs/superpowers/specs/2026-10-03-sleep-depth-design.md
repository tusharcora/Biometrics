# Sleep depth: design

**Date:** 2026-10-03
**Branch:** `feature/sleep-depth`, stacked on `worktree-pixel-coaches` (PR #47). Rebase onto `main` once #47 merges.
**Status:** approved in conversation, awaiting written-spec review.
**Mockups:** growth canvas https://claude.ai/artifact/JHqksi4S4DpFXNiFJho97e, row "8 · Sleep window" (screens 8, 8a, 8c, 8d; 8b was skipped). Picks and notes: https://claude.ai/artifact/3sPCoqZWwFCjF6muR9rCs1.

## Context: the growth roadmap

The owner picked 35 of 36 growth mockups. They are split into sub-projects, each with its own spec, plan and build:

| # | Sub-project | Screens |
|---|---|---|
| **A** | **Sleep depth (this spec)** | 8, 8a, 8c, 8d |
| B | Recap and sharing | 1, 1a–1d |
| C | Social foundation and buddies | 2, 2a–2d |
| D | Invites and outfits | 3, 3a–3d |
| E | Group challenges | 9, 9a–9d |
| F | Apple Health | 7, 7a–7d |
| Later | Widgets, coach growth, morning briefing (briefing time is fully user-set, default 09:00) | 4, 4b, 5, 5b, 6, 6b |

## Goal

Give sleep its own screen with four things:
- **A sleep window chart:** a bar from bedtime to wake for each night.
- **A consistency score:** how regular bedtime and wake time are.
- **A one-night detail screen:** with Google Health's sleep stages (deep, light, REM, awake) plus time in bed, time awake, time to fall asleep and time after waking. This is the owner's note on 8c.
- **A bedtime goal:** with a wind-down reminder scheduled on the phone.

### Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| Stage source | Google Health `sleep` dataPoints. The live check (2026-10-03) confirmed the fields below. |
| Placement | A **new dedicated Sleep screen**, opened from the Home sleep card. The Activity tab keeps its calendar. |
| Reminder | **A local notification scheduled on the phone.** No server job, works with the coach off. |
| Sleep goal | The existing sleep goal (minutes asleep, default 480) stays. Bedtime and wake goals are added beside it. |
| Stage history | Stored for every synced night, including the existing year-long backfill. |

## Non-goals

- Changing the Sleep score or any scoring input. Stages are display data only in this sub-project.
- The month calendar with sleep windows (8b, skipped).
- Server-sent sleep reminders, or reminders that adapt to last night.
- Apple Health stages (sub-project F).
- Sharing any sleep data (B, C).

## 1. What Google returns (live check, 2026-10-03)

`GET https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints`, the same endpoint as today. Each dataPoint has these fields (values are strings unless noted):

```
sleep.interval            { startTime, startUtcOffset, endTime, endUtcOffset }   // already read
sleep.type                "STAGES" (other values exist for devices without stage tracking; store as-is)
sleep.stages[]            { startTime, startUtcOffset, endTime, endUtcOffset, type, createTime, updateTime }
                          type ∈ AWAKE | LIGHT | DEEP | REM
sleep.metadata            { stagesStatus: string, processed: boolean, mainSleep: boolean }
sleep.summary             { minutesInSleepPeriod, minutesAfterWakeUp, minutesToFallAsleep,
                            minutesAsleep (already read), minutesAwake,
                            stagesSummary[]: { type, minutes, count } }
sleep.shortAwakenings[]   { startTime, startUtcOffset, endTime, endUtcOffset, type }   // not used in this spec
```

Numbers arrive as numeric strings, like the existing `minutesAsleep` parsing. A missing or unparseable field is stored as `null` and never invents a value. An unknown stage `type` is skipped, never coerced.

## 2. Data (backend)

### Schema

```prisma
enum SleepStageType { AWAKE LIGHT DEEP REM }

model SleepStage {
  id        String         @id @default(uuid())
  sessionId String
  session   SleepSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  type      SleepStageType
  startTime DateTime
  endTime   DateTime
  @@index([sessionId, startTime])
}
```

`SleepSession` gains these fields, all nullable:
- **Google's night summary:** `sleepType String?`, `mainSleep Boolean?`, `minutesInSleepPeriod Float?`, `minutesAwake Float?`, `minutesToFallAsleep Float?`, `minutesAfterWakeUp Float?`
- **Minutes per stage:** `deepMinutes Float?`, `lightMinutes Float?`, `remMinutes Float?`, `awakeMinutes Float?` (from `stagesSummary`)
- **The relation:** `stages SleepStage[]`

`User` gains `bedtimeGoal String?` and `wakeGoal String?` (local `"HH:MM"`, null = not set). `HealthConnection` gains `sleepStagesBackfilledAt DateTime?`.

One migration, `20261003120000_sleep_stages`, adds all of this. Every new field is nullable, so old rows and old app builds are unaffected.

### Sync

- `fetchSleepSessions` (`backend/src/health/client.ts`) parses the fields in §1 into `SleepSessionPoint` (new optional fields plus `stages: {type, start, end}[]`).
- `upsertSleepSessionsTouched` (`backend/src/biometrics/repository.ts`) stores the summary fields. In the same transaction, it replaces the session's `SleepStage` rows: delete them, then insert. A resync of a night therefore never duplicates stages.
- The SLEEP rollup and scoring are unchanged, because `minutesAsleep` is unchanged.
- **Stage backfill:**
  - A new job, `backfillSleepStages`, re-fetches the same window as `backfillSleepHistory`, once per connection where `sleepStagesBackfilledAt` is null.
  - It is queued at startup and on connect, the same way as the sleep history backfill.
  - It writes through the same upsert and then sets the marker.
  - It must not trigger rescoring when no `minutesAsleep` changed.

### Endpoints

All require auth. All dates are the night-END civil date, as today.

- **`GET /me/sleep`** (existing). Each night gains `minutesAwake: number|null`, `stageMinutes: {deep, light, rem, awake}|null` and `hasStages: boolean`. The response gains `stagesBackfillPending: boolean`: true while the user's connection has `sleepStagesBackfilledAt` null. The values come from the night's main session: `mainSleep` true, else the longest interval, as today. Every existing field is unchanged.
- **`GET /me/sleep/night/:date`.** 404 `{error:'not_found'}` if the date has no session. Response:
  ```ts
  {
    date, bedtime, wakeTime,                       // "HH:MM" local, main session
    minutesAsleep, minutesInBed,                   // minutesInSleepPeriod ?? interval length
    minutesAwake, minutesToFallAsleep, minutesAfterWakeUp,   // number|null
    hasStages,
    stages: { type: 'AWAKE'|'LIGHT'|'DEEP'|'REM', start: string, end: string }[],  // ISO, main session, ordered
    stageTotals: { deep: {minutes, count}, light: {...}, rem: {...}, awake: {...} } | null,
    naps: { start, end, minutesAsleep }[],         // non-main sessions ending that date
    sleepScore: number|null,
    usualMinutesAsleep: number|null                // 30-night average before this date
  }
  ```
- **`GET /me/sleep/consistency?days=7|30`** (anything else → 400). Uses the main session per night (`mainSleep` true, else largest `minutesAsleep`, matching scoring) and times in minutes from local noon, so after-midnight bedtimes sort correctly. Response:
  ```ts
  {
    days, nights,                                  // nights with a main session in the window
    score: number|null,                            // null when nights < 4 (7d) or < 15 (30d)
    bedtimeSpreadMinutes: number|null, wakeSpreadMinutes: number|null,   // standard deviation
    averageBedtime: string|null, averageWake: string|null,              // "HH:MM"
    drift: { date, bedtimeOffsetMinutes }[]        // vs averageBedtime, one per night with data
  }
  ```
  `score` reuses the scoring engine's circadian consistency formula (`backend/src/scoring/features.ts` `circadianConsistencyOn`: `100·max(0, 1 − std / maxStdMinutes)`), applied to bedtime and to wake time and averaged. The shared maths is extracted into one helper, so both callers use the same definition.
- **`GET /me/sleep/goal`** → `{ sleepGoalMinutes, bedtimeGoal: string|null, wakeGoal: string|null }`.
- **`PUT /me/sleep/goal`** takes the same shape, partial: any subset of the three fields.
  - `sleepGoalMinutes` is an integer from 240 to 720.
  - `bedtimeGoal` and `wakeGoal` match `^([01]\d|2[0-3]):[0-5]\d$`, or are null.
  - Anything invalid → 400 `{error:'invalid_goal'}`; a missing user → 404.
  - It returns the saved goal.

## 3. Screens (mobile)

Colours follow the existing sleep purple (`#9333EA` and the `sleepHeat1..4` ramp in `theme.ts`). Stage colours are new tokens:

| Stage | Token |
|---|---|
| Deep | `sleepDeep` (darkest purple) |
| REM | `sleepRem` (mid) |
| Light | `sleepLight` (light purple) |
| Awake | `sleepAwake` (orange `#FB923C`) |

Each token has light and dark mode values, and a contrast test checks them.

### Sleep screen (new, `screens/SleepScreen.tsx`, route `Sleep`)

- **Entry points:**
  - The Home sleep card opens it. Before this change the card opened `ScoreDetail` for SLEEP; the Sleep screen's score header now links there with "Why this score".
  - The Activity tab's Sleep page header gets a "Sleep details" link.
- **Layout, top to bottom:**
  1. **Score header:** today's Sleep score with "Why this score" → `ScoreDetail`.
  2. **Range toggle:** Week or Two weeks.
  3. **Window chart (8):** one bar per night from bedtime to wake, on a 21:00–09:00 axis. The axis extends to fit bars outside it. Dashed lines mark the average bedtime and wake time, and a faint band shows the goal window when one is set. Missing nights are gaps. Tapping a bar opens that night.
  4. **Consistency card (8a):** a score ring, bedtime and wake spread (±minutes), and a 7-night drift strip with nights more than 30 minutes off highlighted in orange. It ends with a one-line comment in the coach's voice.
     - The comment is chosen from fixed templates per band (steady / drifting / irregular) and includes the coach's name. It is never generated, so it can't state a number that wasn't checked.
     - With too few nights the card reads "Not enough nights yet. [n] more to go."
  5. **Last night:** time asleep, a mini stage strip, and "See the whole night".
  6. **Bedtime goal row:** the goal times (or "Set a bedtime goal") and the reminder state.
- Each section loads and fails on its own, with its own retry.
- While `stagesBackfillPending` is true, the screen shows what it has plus a "Reading older nights…" line.

### One night in detail (8c, `screens/SleepNightScreen.tsx`, route `SleepNight { date }`)

- **Header:** the date and time asleep.
- **Stage strip:** the night's timeline in stage colours, with bedtime and wake at the ends.
- **Stage breakdown:** deep, light, REM and awake, each with minutes, percentage of time asleep (awake as a percentage of time in bed) and count.
- **Night numbers:** time in bed, time awake, time to fall asleep, time after waking, Sleep score, and the difference from your usual night.
- Naps are listed under the night numbers.
- **Ask button:** "Ask {coach} about this night" opens the Coach chat with "How was my sleep on {date}?" in the input box, not sent.
- **No stages** (`hasStages` false): the strip and breakdown are replaced by today's asleep/in-bed share bar.
- The existing Activity night sheet (`components/activity-sheets.tsx` `NightDetail`) gains an "Open full night" link to this screen.

### Bedtime goal (8d, `screens/BedtimeGoalScreen.tsx`, route `BedtimeGoal`)

- **Times:** bedtime and wake time, each with −/+ buttons in 15-minute steps. A live line underneath reads "That's {h}h {m}m in bed. Your goal is {goal} asleep.", in orange when the window is shorter than the goal.
- **Sleep goal:** a stepper in 15-minute steps from 4h to 12h. The Activity heat map stops hard-coding 480 and reads this goal.
- **Saving:** Save PUTs the goal. On failure the screen goes back to the saved values and shows "Your goal couldn't be saved. Check your connection and try again."
- **Wind-down reminder:**
  - An on/off switch and a lead time of 15, 30, 45 or 60 minutes.
  - A preview of the notification: "{Coach}: Wind-down time. Bed in {lead} min."
  - Turning it on is when the app first asks for notification permission. If permission is declined, the switch turns back off and shows "Notifications are off for Biometrics. Turn them on in Settings." with a link to the app's Settings page.
  - It needs a bedtime goal; without one the switch is disabled and says "Set a bedtime first".

### Wind-down scheduling (`lib/windDown.ts`)

- Reminder settings (enabled, lead minutes) stay on the device, in SecureStore, like the character cache.
- **Scheduling:** `expo-notifications` `scheduleNotificationAsync` with a daily trigger at bedtime minus the lead time, in device local time. The returned identifier is stored.
- **Rescheduling:** the reminder is cancelled and scheduled again whenever bedtime, lead time or the switch changes, and on each app return to the foreground, which also covers time-zone changes and the OS dropping it. Only one reminder ever exists.
- **On sign-out:** the reminder is cancelled and its settings are cleared.

## 4. Testing

- **Backend:**
  - Parsing a dataPoint with stages and without stages, using synthetic values in the live shape from §1.
  - Unknown stage types and numeric strings that don't parse.
  - The upsert replaces stages on resync.
  - The stage backfill sets its marker and does not rescore.
  - `GET /me/sleep` additions.
  - The night endpoint: main session versus naps, no stages, and 404.
  - Consistency: an after-midnight bedtime, too few nights, and the 7 and 30 day windows.
  - Goal GET and PUT, including invalid bodies.
- **Mobile:**
  - The window chart's pure layout maths: scale, axis extension, gaps, and the average and goal lines.
  - Each screen in loading, error, empty, no-stages and too-few-nights states.
  - Goal save and rollback.
  - Scheduling, rescheduling, cancelling on off and sign-out, and declined permission (notifications mocked).
  - The Home card now opens the Sleep screen.
  - Stage colour contrast in both themes.
- **Simulator:** with the owner's real account: the Sleep screen, a night with stages, the goal, and a reminder fired by setting bedtime a few minutes ahead.

## 5. Rollout and risk

- **Order:** backend first. The new fields are additive, so old app builds ignore them.
- **Backfill load:** the stage backfill re-fetches up to a year of sleep per connection once. That's the same volume as the existing history backfill, paginated.
- **Unverified:** the live check covered three recent nights on one device, all `STAGES`. Older devices may send another `sleep.type` with a different stage set; those stages are skipped and the night falls back to no stages. The spec relies on the summary fields, never on `sleep.type` values.
- **Home card:** the Home sleep card's destination changes, from score detail to the Sleep screen. Score detail is still one tap away.
