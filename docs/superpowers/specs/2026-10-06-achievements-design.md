# Achievements (badges) — design

Growth sub-project after B (Recap). Status: approved in brainstorming with the owner on 2026-10-05; revised
2026-10-06 after a spec review (owner decisions on late check-ins and goal changes).
Visual reference: canvas https://claude.ai/artifact/G41SNEnLjSbhhPjAnzyXMZ (badge catalogue, Profile, badge detail,
unlock celebration, recap placement).

## 1. Goal

Reward healthy habits kept over time with badges that level up, shown on the profile, celebrated in the app when
earned, and shown in the weekly / monthly recap of the period they were earned in.

Success: a person sees their progress toward the next level, gets one celebratory moment per new level, and the
recap for the week/month they earned it lists it. Levels never disappear.

Owner decisions:
- Badges reward **healthy habits over time** (streaks, consistency, monthly milestones) — not app exploration.
  Two monthly families (Best recovery week, Steadiest month) are personal-best milestones; that is intended — the
  owner chose to turn the recap milestones into badges.
- **Levels**, five per family: I Bronze · II Silver · III Gold · IV Diamond · V Coach (the user's coach colour).
  Coach is deliberately long-term (100 nights, 180 days, 24 months).
- **Start fresh:** only days/months from each user's start date count; history before it awards nothing.
- **Unlock moment:** in-app full-screen celebration (next app open) + shown in that period's recap. **No push.**
- **Late check-ins:** only check-ins made on their own local day count toward the check-in streak.
- **Goal changes:** a streak restarts only when its goal gets easier (sleep goal lowered; bedtime goal moved by more
  than 30 min, or a first bedtime goal set more than 30 min from the usual bedtime). Otherwise each night is judged
  against the goal in effect that night.
- Approach A: awarded server-side once, stored, never revoked.

## 2. Catalogue

| Family (`family` key) | Kind | A day / month counts when… | I | II | III | IV Diamond | V Coach |
|---|---|---|---|---|---|---|---|
| Sleep goal streak (`SLEEP_GOAL`) | streak | the night's total sleep (the SLEEP daily rollup — Recap's definition) ≥ the sleep goal in effect for that night | 3 | 7 | 14 | 30 | 100 nights |
| Steady bedtime (`STEADY_BEDTIME`) | streak | fell asleep within ±30 min of the bedtime goal in effect that night; with no goal, of the median bedtime of the previous 14 nights that have sleep data (may include nights before the start date; needs ≥ 7) | 3 | 7 | 14 | 30 | 100 nights |
| Step goal streak (`STEP_GOAL`) | streak | a finished local day with steps ≥ `STEPS_GOAL` (10,000, `backend/src/coach/tools/metrics.ts`) | 3 | 7 | 14 | 30 | 100 days |
| Daily check-in (`CHECK_IN`) | streak | a `HabitCheckIn` exists for that local day **and was created on that same local day** | 7 | 14 | 30 | 60 | 180 days |
| Best recovery week (`BEST_RECOVERY_WEEK`) | monthly | that month's recap has the `bestRecoveryWeek` milestone | 1 | 3 | 6 | 12 | 24 months |
| Every day logged (`EVERY_DAY_LOGGED`) | monthly | that month's recap has the `everyDayLogged` milestone | 1 | 3 | 6 | 12 | 24 months |
| Steadiest month (`STEADIEST_MONTH`) | monthly | that month's recap has the `steadiestMonth` milestone | 1 | 2 | 4 | 6 | 12 months |

Monthly milestone rules are unchanged from the Recap spec (`backend/src/recap/stats.ts` `milestonesOf`).

**Levels are awarded from the best value**, not the current one: the evaluator walks every qualifying run since the
family's start date and awards each level whose threshold any run reached, so a streak that happened and ended inside
a single catch-up sync still earns its levels. A higher level needs a single run of that length (not cumulative).
Levels are **never revoked**.

## 3. Data

- New table `Achievement`: `id` uuid, `userId` (cascade delete; add to `USER_OWNED_MODELS`; NOT part of coach-data
  deletion), `family` enum `AchievementFamily`, `level` int 1..5, `value` int (the threshold reached),
  `earnedOn` `@db.Date` (local date the run first reached the threshold; for monthly: the month's last day),
  `weekStart` `@db.Date` (Monday of earnedOn), `monthStart` `@db.Date` (1st of earnedOn's month), `createdAt`,
  `celebratedAt` nullable. `@@unique([userId, family, level])`, index `(userId, celebratedAt)`.
- `User.achievementsSince` `@db.Date`, nullable. **Single definition:** set on the user's first evaluation to that
  user's local date at that moment, and never changed. For existing users the first evaluation happens right after
  the deploy (so it is the launch date); for new users it is their first sync / app load. Null = not started.
- New table `GoalChange`: `id`, `userId` (cascade), `kind` enum (`SLEEP_MINUTES` | `BEDTIME`), `value` (minutes, or
  "HH:MM" for bedtime; null = bedtime goal cleared), `effectiveOn` `@db.Date` (local date of the change),
  `resetsStreak` boolean, `createdAt`. Written by the existing settings endpoints whenever the sleep goal or bedtime
  goal changes:
  - sleep goal: `resetsStreak = newMinutes < oldMinutes`;
  - bedtime goal: `resetsStreak` = moved by > 30 min (circular minutes), or set for the first time > 30 min from the
    current usual bedtime (median of the previous 14 nights with data; no usual bedtime → true), or cleared.
  The goal in effect for a night = the latest change with `effectiveOn ≤` the night's date; before any change, the
  user's goal at the start date (backfilled into one `GoalChange` row per kind on first evaluation).
- No progress table: runs and month counts are computed on demand from existing data (SLEEP and STEPS rollups,
  `SleepSession` main-session starts, `HabitCheckIn`, `Recap.stats.milestones`), from the family's start date.

## 4. Rules in detail

- **Dates.** Sleep families use each night's local wake date (the date of its SLEEP rollup, as Recap and sleep depth
  do). Steps and check-ins use the user's local calendar day (`User.timezone`). A check-in's own day =
  `createdAt` converted to the user's local date.
- **Family start date** = max(`achievementsSince`, the latest `GoalChange.effectiveOn` with `resetsStreak` for that
  family's kind). Steps and check-in use `achievementsSince`. Monthly families count only months whose 1st is
  ≥ `achievementsSince`.
- **Paused vs broken.** A run is consecutive qualifying dates. A date with no data for the family breaks a run only if
  a later date has data, or the date is more than 2 days before today (local); otherwise the latest run is paused
  (late sync never costs a streak). `current` = the latest run if it is unbroken, else 0.
- **Today.** Steps: today never counts until it is over. Check-in: today counts as soon as a same-day check-in exists.
  Sleep families: a night counts once its rollup has arrived.
- **Steady bedtime**: bedtime = the main session's start (the noon-anchored main session, as Recap's bedtime) in local
  time, compared as minutes on a circle around midnight. Nights without a goal and with < 7 prior nights of data
  neither count nor break.
- **Monthly count** = number of BUILT month recaps with `periodStart ≥ achievementsSince` whose stored milestones
  contain the family's key. A rebuild that gains a milestone awards then; a rebuild that loses one revokes nothing.

## 5. Evaluation (backend)

- `evaluateAchievements(userId, now, families)` computes each family's runs (or month count) since its start date and
  inserts every level whose threshold the best run reached and that isn't stored (`createMany`, `skipDuplicates`),
  with `earnedOn` = the date that run first reached the threshold. Idempotent; safe to run twice or concurrently
  (the unique key decides).
- Triggers (on the existing `health-sync` queue, low priority, jobId deduped per user per local hour):
  - after every sync `fetch` job for a user (any metric, so steps-only users are covered) → streak families;
  - after a check-in is saved → `CHECK_IN`;
  - after a MONTH recap is built or rebuilt (`runRecapJob`) → monthly families;
  - `GET /me/achievements` also evaluates inline first (bounded: at most once per user per 10 minutes) so the app is
    never behind the data.
- The first evaluation for a user sets `achievementsSince` and backfills the starting `GoalChange` rows.
- Logs: event names with ids, family and level only — never health values.
- The recap fact sheet stops emitting the old streak-milestone note (`coach/answer/facts.ts`), so the AI line never
  mentions a milestone the app doesn't show. Other recap facts are unchanged; AI text never mentions badges.

## 6. API and app

- `GET /me/achievements` → `{ since, families: [{ family, kind, level (0..5), thresholds[5], levels: [{ level,
  value, earnedOn }], current, best, nextThreshold | null }], uncelebrated: [{ id, family, level, value, earnedOn }] }`.
  `best` = the longest run (or month count) since the family's start.
- `POST /me/achievements/celebrated { ids: string[] }` → sets `celebratedAt` on the caller's rows (unknown ids ignored).
- Mobile:
  - **Profile** (SettingsScreen, between the header and Health data): Badges card — 7 badges at their highest level
    (locked grey when 0), "BADGES · n OF 35", "Next up: <family> <next level> · current / threshold" progress bar for
    the family closest to its next level, "See all". Hidden on 404 (old backend).
  - **Badges screen** ("See all"): the catalogue grid with each family's level; tapping opens **Badge detail**: big
    badge, current + best, ladder of the 5 levels (earned date / "N more" / locked).
  - **Unlock celebration**: on app start and foreground, if `uncelebrated` is non-empty, a full-screen modal per
    family's highest new level (highest first): badge, coach sprite, level name + value, fixed coach line ("<n> more
    <unit> for <next level>" or "Top level!"), Share (existing pipeline, a 1080 px badge card) and "Nice!". Closing
    marks that family's new levels celebrated (lower levels of the same family too). Reduce motion: no confetti.
  - **Weekly recap**: story frame 3 gets a "Badges this week" card listing levels with `earnedOn` in the recap week
    (hidden when none). Read at view time: a level dated into a week after that recap was opened appears the next
    time it's viewed (badges are only ever added). The share image includes the card when present.
  - **Month recap screen**: keeps the milestone tiles, now the 3 monthly families (the old 5-night streak tile is
    dropped — Sleep goal streak covers it). Each tile shows whether that month hit the milestone; for months on or
    after `achievementsSince` it also shows progress toward the family's next level ("2 of 3 months for Silver") and
    a "Level up" mark when a level was earned in that month. Below the tiles, "Badges earned in <Month>" lists any
    streak-family levels earned that month (hidden when none). Months before `achievementsSince` (including
    backfilled ones) show their milestone tiles as before, without badge progress.
  - Badge visuals per the canvas: pixel octagon, 12×12 glyph per family (moon, clock, sneaker, check, heart,
    calendar, sparkle), tier colours Bronze #D08A4E, Silver #CBD5E1, Gold #FACC15, Diamond #67E8F9, Coach = the
    user's coach accent; 5 level pips.

## 7. Edge cases

- New user / no data / Google disconnected: nothing awarded; all badges locked with a next-up hint.
- Several levels at once (catch-up sync): all stored with their own `earnedOn`; one celebration per family.
- A finished streak delivered late: awarded from the best run (§2), dated when it was reached.
- Coach-data deletion leaves achievements and goal changes untouched; account deletion removes both.
- Old app versions: unaffected (new endpoints only). New app vs old backend: 404 → badge UI hidden, month tiles as before.
- Reinstall / new device: celebration state is server-side, so nothing re-celebrates.

## 8. Testing

- Backend unit: each family's run calculator (qualifying days; gaps → paused vs broken; the 2-day rule; best vs
  current; earnedOn per threshold; goal history judging each night by its own goal; reset only on easing; steady
  bedtime median incl. pre-start nights and the ≥ 7 rule; same-day check-ins only; start-date cut-off); thresholds
  table; monthly counts from recap milestones (rebuild gain/loss); fact sheet no longer emits the streak note.
- Backend integration: evaluator idempotence and concurrency; triggers (sync fetch incl. steps-only, check-in, month
  recap) enqueue and dedupe; GET evaluates inline with the 10-min bound; endpoints (shape, own rows only,
  celebrated); GoalChange rows written by the settings endpoints; migration; account-deletion cascade.
- Mobile: Profile card (locked / levels / next-up / 404 hidden), Badges + detail screens, celebration queue order and
  marking, weekly story card (with/without), month tiles (progress, level-up mark, pre-start months), 404 fallback.
- Dev-only seed script awarding sample levels to the demo account (dev DB only) for the simulator pass.

## 9. Out of scope

Push notifications for badges, badges for app exploration, social sharing of profiles (sub-project C), backfilling
history, editing or hiding badges.
