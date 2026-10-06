# Achievements (badges) — design

Growth sub-project after B (Recap). Status: approved in brainstorming with the owner on 2026-10-05.
Visual reference: canvas https://claude.ai/artifact/G41SNEnLjSbhhPjAnzyXMZ (badge catalogue, Profile, badge detail,
unlock celebration, recap placement).

## 1. Goal

Reward healthy habits kept over time with badges that level up, shown on the profile, celebrated in the app when
earned, and shown in the weekly / monthly recap of the period they were earned in.

Success: a person sees their progress toward the next level, gets one celebratory moment per new level, and the
recap for the week/month they earned it lists it. Levels never disappear.

Owner decisions:
- Badges reward **healthy habits over time** (streaks, consistency, monthly bests) — not app exploration or records.
- **Levels**, five per family: I Bronze · II Silver · III Gold · IV Diamond · V Coach (the user's coach colour).
- **Start fresh:** only days/months from launch (per user) count; history before it awards nothing.
- **Unlock moment:** in-app full-screen celebration (next app open) + shown in that period's recap. **No push.**
- The recap month screen's 4 milestones become badge families; the old 5-night streak milestone is folded into
  Sleep goal streak.
- Approach A: awarded server-side once, stored, never revoked.

## 2. Catalogue

| Family (`family` key) | Kind | A day / month counts when… | I | II | III | IV Diamond | V Coach |
|---|---|---|---|---|---|---|---|
| Sleep goal streak (`SLEEP_GOAL`) | streak | main sleep for that night ≥ the user's sleep goal | 3 | 7 | 14 | 30 | 100 nights |
| Steady bedtime (`STEADY_BEDTIME`) | streak | fell asleep within ±30 min of the bedtime goal; with no goal set, of the median of the previous 14 bedtimes (needs ≥ 7 of them) | 3 | 7 | 14 | 30 | 100 nights |
| Step goal streak (`STEP_GOAL`) | streak | a finished local day with steps ≥ 10,000 (the app's fixed step goal, `METRIC_CONFIG.STEPS.goal`) | 3 | 7 | 14 | 30 | 100 days |
| Daily check-in (`CHECK_IN`) | streak | a `HabitCheckIn` row exists for that local day ("Nothing today" counts) | 7 | 14 | 30 | 60 | 180 days |
| Best recovery week (`BEST_RECOVERY_WEEK`) | monthly | that month's recap has the `bestRecoveryWeek` milestone | 1 | 3 | 6 | 12 | 24 months |
| Every day logged (`EVERY_DAY_LOGGED`) | monthly | that month's recap has the `everyDayLogged` milestone | 1 | 3 | 6 | 12 | 24 months |
| Steadiest month (`STEADIEST_MONTH`) | monthly | that month's recap has the `steadiestMonth` milestone | 1 | 2 | 4 | 6 | 12 months |

Monthly milestone rules are unchanged from the Recap spec (`backend/src/recap/stats.ts` `milestonesOf`). The
`streak` milestone (5 on-goal nights) is removed from new month recaps' display; existing stored recaps keep their
JSON but the app no longer shows the milestone grid (see §6).

Levels: a level unlocks the first time the streak (or month count) reaches its threshold. Reaching a higher level
needs a streak of that length (not cumulative). Levels are **never revoked**.

## 3. Data

- New table `Achievement`: `id` uuid, `userId` (cascade delete; add to `USER_OWNED_MODELS`), `family` enum
  `AchievementFamily`, `level` int 1..5, `value` int (the streak length / month count that unlocked it),
  `earnedOn` `@db.Date` (local civil date the level was reached), `weekStart` `@db.Date` (Monday of earnedOn),
  `monthStart` `@db.Date` (1st of earnedOn's month), `createdAt`, `celebratedAt` nullable.
  `@@unique([userId, family, level])`, index on `(userId, celebratedAt)`.
- `User.achievementsSince` `@db.Date` — set at first evaluation to max(launch date, user's local creation date).
  Migration leaves it null; the evaluator fills it (null = not started yet → today's local date).
- `User.sleepGoalChangedOn` and `User.bedtimeGoalChangedOn` `@db.Date` nullable — set to the local date whenever
  the respective goal is changed through the existing settings endpoints.
- No progress table: current/best streaks and month counts are computed on demand from existing data
  (`SleepSession`/SLEEP rollups, STEPS rollups, `HabitCheckIn`, `Recap.stats.milestones`), looking back only to the
  family's start date (§4).

## 4. Rules in detail

- **Dates.** Sleep families use each night's local wake date (from the session's own UTC offset, as sleep depth
  does), so travel doesn't create gaps or double days. Steps and check-ins use the user's local calendar day
  (`User.timezone`), as Recap does.
- **Family start date** = max(`achievementsSince`, goal-changed date for that family: `sleepGoalChangedOn` for
  Sleep goal, `bedtimeGoalChangedOn` for Steady bedtime). Steps and check-in use `achievementsSince`. Monthly
  families count only months whose 1st is ≥ `achievementsSince`.
- **Paused vs broken.** A streak counts consecutive dates with a qualifying day, ending at the latest date that has
  data for that family. A date with no data breaks the streak only if a later date has data, or the date is more
  than 2 days before today (local). Otherwise the streak is paused (late sync never costs a streak).
- **Today.** Steps: today never counts until it is over. Check-in: today counts as soon as the check-in exists.
  Sleep families: a night counts once its wake date's data has arrived.
- **Sleep goal**: judged against the user's current `sleepGoalMinutes` (the family restarts at a goal change, so
  older nights are never re-judged against a different goal). Main sleep = the sleep-depth main session for that
  wake date.
- **Steady bedtime**: bedtime = main session start in local time, compared as minutes on a circle around midnight;
  goal from `User.bedtimeGoal` ("HH:MM"); without one, the median of the previous 14 qualifying bedtimes (needs
  ≥ 7; nights without enough history don't count and don't break).
- **Monthly count** = number of month recaps (BUILT, `periodStart ≥ achievementsSince`) whose stored milestones
  contain the family's key. A rebuild that gains a milestone awards then; a rebuild that loses one revokes nothing.

## 5. Evaluation (backend)

- `evaluateAchievements(userId, now, { families })` computes each requested family's current value and inserts
  every level whose threshold ≤ value that isn't stored (`createMany` with `skipDuplicates`), with `earnedOn` = the
  date the streak first reached that threshold (the streak's start + threshold − 1 days for streaks; the recap
  month's last day for monthly). Idempotent; safe to run twice.
- Triggers (all on the existing `health-sync` queue, low priority, jobId deduped per user per local date):
  - after a `COMPUTE_DAILY_SCORE_JOB` returns 'scored' → streak families;
  - after a habit check-in is saved (`HabitCheckIn` create) → `CHECK_IN` (inline evaluation is fine; it is cheap);
  - after a MONTH recap is built or rebuilt (`runRecapJob`) → monthly families.
- Logs: event names with ids, family and level only — never health values.

## 6. API and app

- `GET /me/achievements` → `{ since, families: [{ family, kind, level (0..5), thresholds[5], levels: [{ level,
  value, earnedOn }], current, best, nextThreshold | null }], uncelebrated: [{ id, family, level, value, earnedOn }] }`.
  `current` / `best` are streak lengths (or month counts); `best` is the longest streak since the family's start.
- `POST /me/achievements/celebrated { ids: string[] }` → sets `celebratedAt` (only the caller's rows; unknown ids
  ignored).
- Mobile:
  - **Profile** (SettingsScreen, between the header and Health data): Badges card — 7 badges at their highest level
    (locked grey when 0), "BADGES · n OF 35", "Next up: <family> <next level> · current / threshold" progress bar for
    the family closest to its next level, "See all".
  - **Badges screen** ("See all"): the full catalogue grid with each family's level; tapping opens **Badge
    detail**: big badge, current + best streak, ladder of the 5 levels (earned date / "N more" / locked).
  - **Unlock celebration**: on app start and on foreground, if `uncelebrated` is non-empty, show a full-screen modal
    per family's highest new level (highest first), with the badge, the coach sprite, level name + value, a short
    fixed coach line ("<n> more <unit> for <next level>" or "Top level!"), Share (existing share pipeline, a 1080 px
    badge card) and "Nice!". Closing marks that family's new levels celebrated (lower levels of the same family are
    marked at the same time). Reduce motion: no confetti animation.
  - **Recaps**: weekly story frame 3 gets a "Badges this week" card listing levels with `earnedOn` in the recap week
    (hidden when none); the month screen's milestone grid becomes "Badges earned in <Month>" (levels with `earnedOn`
    in the month; empty state: "No new badges this month" + the next-up hint). Both read `GET /me/achievements` at
    view time. Share images: the story frame includes the badges card when present. AI recap text never mentions
    badges (number validator untouched).
  - Badge visuals: pixel octagon badges per the canvas — 12×12 pixel glyph per family (moon, clock, sneaker, check,
    heart, calendar, sparkle), tier colours Bronze #D08A4E, Silver #CBD5E1, Gold #FACC15, Diamond #67E8F9, Coach =
    the user's coach accent; level pips (5).

## 7. Edge cases

- New user / no data / Google disconnected: nothing awarded; all badges locked with a next-up hint.
- Several levels at once (catch-up sync): all stored with their own `earnedOn`; one celebration per family.
- Coach-data deletion leaves achievements untouched; account deletion removes them.
- Old app versions: unaffected (new endpoints only). New app vs old backend: 404 → Badges card hidden.
- Reinstall / new device: celebration state is server-side, so nothing re-celebrates.

## 8. Testing

- Backend unit: each streak calculator (qualifying days, gaps → paused vs broken, 2-day rule, goal-change restart,
  travel across zones via session offsets, `achievementsSince` cut-off, earnedOn dates); thresholds table; monthly
  counts from recap milestones (rebuild gain/loss).
- Backend integration: evaluator idempotence (twice → same rows), triggers enqueue/dedupe, endpoints (shape,
  only own rows, celebrated), migration, account deletion cascade.
- Mobile: Profile card (locked/levels/next-up), Badges + detail screens, celebration queue order and marking,
  recap story card + month grid (with/without badges), 404 fallback.
- Dev-only seed script awarding sample levels to the demo account (dev DB only) for the simulator pass.

## 9. Out of scope

Push notifications for badges, badges for app exploration / personal records, social sharing of profiles (C),
backfilling history, editing or hiding badges.
