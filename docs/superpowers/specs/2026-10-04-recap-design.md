# Recap — design (growth sub-project B)

Date: 2026-10-04. Branch `feature/recap`, stacked on `feature/sleep-depth` (PR #48).
Source: the owner's picks on the growth canvas (https://claude.ai/artifact/JHqksi4S4DpFXNiFJho97e):
1 shareable recap card, 1a weekly story, 1b year in pixels, 1c build your recap, 1d your month in the app.

## Purpose

Growth. A user turns their week, month or year into a good-looking image in their coach's voice and shares it;
the image carries the app's name so friends can find the app. Success: a user can open a recap, choose what to
include, and save or share an image in a few taps, and every number on it is true.

## Decisions (owner)

| Question | Decision |
|---|---|
| Coach quote | Written by the coach AI, number-checked, template fallback |
| Link on images | App name only for now (no URL) |
| Scope | All five screens in this sub-project |
| Ready notifications | Push on the 1st (month) and Monday (week), with a "Recap ready" setting |
| Approach | A — recaps prepared ahead on the server, rendered and shared on the phone |

Out of scope: buddies / other people (sub-project C), a public link or landing page, server-rendered images,
editing the coach's line.

## 1. What a recap contains

**Periods.** Week = Monday–Sunday in the user's time zone. Month = calendar month. A recap is built once its
period has ended. A night belongs to the civil date it ends on (as everywhere else in the app).

**Numbers** (each omitted, never zero-filled, when its own data is missing):

| Key | Definition |
|---|---|
| `nightsWithData` | Nights in the period with a SLEEP rollup |
| `avgSleepMinutes` | Mean SLEEP rollup minutes over those nights, rounded |
| `nightsOnGoal` | Nights with SLEEP rollup ≥ the goal snapshot |
| `longestOnGoalStreak` | Most consecutive civil dates on goal inside the period (a missing night breaks it) |
| `bestNight` | `{date, minutesAsleep}`: highest SLEEP DailyScore; ties → longer sleep; no scores → longest sleep |
| `bestRecovery` | `{date, score}`: highest RECOVERY DailyScore (rounded) |
| `avgRecovery` | Mean RECOVERY score, rounded |
| `steps` | `{total, dailyAverage}` from STEPS records on days with data |
| `earlierBedtimes` | `{nights, of}`: nights whose main-session bedtime (pickMainSession, noon-anchored minutes) was earlier than the previous period's average bedtime; omitted for the first period |
| `bedtimeSpreadMinutes` | Population std of noon-anchored bedtimes (the regularity spread maths), rounded; needs ≥ 4 nights |
| `weekStrip` (week only) | 7 entries Mon→Sun: `{date, minutesAsleep|null, onGoal|null, recovery|null}` |
| `comparison` | vs the previous period of the same kind: `avgSleepDelta`, `bedtimeSpreadDelta`, `avgRecoveryDelta`, each present only when both periods have that number |
| `milestones` (month only) | See below |

**Monthly milestones** (fixed rules, only those achieved):
- `streak` — "N nights on goal in a row" when `longestOnGoalStreak` ≥ 5.
- `bestRecoveryWeek` — the Monday-start week (inside the month, ≥ 4 days of RECOVERY) with the highest mean
  recovery, shown only when it beats the previous month's best week by ≥ 1 point.
- `everyDayLogged` — every civil date of the month has a SLEEP rollup.
- `steadiestMonth` — `bedtimeSpreadMinutes` is the lowest of all stored MONTH recaps, with ≥ 3 earlier ones.

**Goal snapshot.** The user's sleep goal at build time is stored on the recap (`sleepGoalMinutes`) and used for
every on-goal number; it never changes afterwards.

**Year in pixels** is not stored: the app draws it from `GET /me/sleep` for the calendar year (one square per
night: on goal / short / no data, using the current goal) with "N nights on goal".

**Eligibility.** WEEK needs `nightsWithData` ≥ 3; MONTH needs ≥ 7. Below that: no recap, no push.

## 2. Building, writing and announcing

**Schedule.** A recap sweep runs hourly on the existing `health-sync` repeatable-job machinery. For each user,
in their own time zone, it builds the WEEK recap for last week once their local time is Monday ≥ 08:00, and the
MONTH recap for last month once it is the 1st ≥ 08:00, if not already built. One BullMQ job per (user, kind,
periodStart), job id `recap-<userId>-<kind>-<periodStart>` (dedupes). One user's failure never blocks others.

**Storage.** New Prisma model `Recap`: `id`, `userId` (cascade on user delete), `kind` (`WEEK|MONTH`),
`periodStart` (civil date string), `periodEnd`, `stats` (JSON, section 1), `sleepGoalMinutes`, `line` (text),
`lineSource` (`AI|TEMPLATE`), `personaId`, `builtAt`, `openedAt` (null until first opened), `pushedAt`.
Unique `(userId, kind, periodStart)`. Migration additive only.

**Coach line (AI).**
- A new `recap` fact sheet in `coach/answer/facts.ts` holding exactly the section-1 numbers as facts (streak,
  nights on goal, earlier-bedtime counts included), so the existing `validateSentence` can check them.
- Prompt: 1–2 sentences, ≤ 30 words, in the user's persona (name, tone, focus, verbosity) with the existing
  disallowed-topics list; no medical claims; second person; may only use numbers from the sheet.
- Engine: the user's selected coach engine, the same way the daily one-liner chooses (`summaryEngineDeps`).
- Check: every sentence through `validateSentence`; any failure rejects the draft; one retry with the
  regeneration note; then a template line. 60 s budget per recap.
- Template lines: a small fixed set per situation (nights on goal, streak, earlier bedtimes, steadier, a
  generic fallback), filled with checked numbers and the coach name, also passed through the validator.
- Coach disabled, no current coach consent (local or hosted as applicable), or persona `reactive-only` → no AI
  call, template line.

**Ready push.** After storing, send through the existing push channel: "{Coach}: Your week is ready" /
"{Coach}: Your {Month} recap is ready", data `{kind:'recap', recapId}`; tapping opens that recap. New user
setting `recapPushEnabled` (default true) in notification settings; the global notification setting still
wins. Push failures are logged and never fail the recap. `pushedAt` prevents a second push.

**Late data.** If a night inside the period syncs within 3 days after the period ends and the recap's
`openedAt` is null, the recap is rebuilt once (line regenerated); once opened it never changes.

**Endpoints.**
- `GET /me/recaps?kind=WEEK|MONTH&limit=` → newest first (summary fields).
- `GET /me/recaps/:id` → full recap; sets `openedAt` on first read. Another user's id → 404.
- `PUT /me/settings/notifications` (or the existing settings route) gains `recapPushEnabled`.

## 3. Screens, the image and sharing

**Entry points.** A "Your recaps" row on the Sleep screen opens a new **Recaps** screen (latest MONTH, latest
WEEK, older ones, and Year in pixels). On the 1st / Mondays, Home shows a dismissible "Your {Month} recap is
ready" card until that recap is opened. The push opens the recap directly.

**Screens.**
1. **Month in the app (1d)** — "{Month} with {Coach}", the line, milestones achieved, "Compared with last month"
   (avg sleep, bedtime spread, avg recovery with ± arrows; only present comparisons), "Make a shareable recap".
2. **Monthly card (1)** — "MY {MONTH}", pixel coach + name, the quote, up to four stats (avg sleep, longest
   streak, best recovery, steps), app name.
3. **Weekly story (1a)** — 9:16: "How {Coach} saw my week", Mon–Sun strip coloured by on goal, best night, the
   quote, app name.
4. **Year in pixels (1b)** — square grid, one cell per night of the calendar year (on goal / short / no data),
   "{N} nights on goal", app name; shareable.
5. **Build your recap (1c)** — format (monthly card 1:1, weekly story 9:16, year in pixels 1:1), include
   switches (each available stat, the quote, the coach character), live preview, "Only you see this until you
   share", **Save image** (Photos; asks permission first time) and **Share** (system share sheet). Switches for
   missing stats are hidden; choices persist per format (SecureStore/AsyncStorage convenience).

**Look.** App fonts (Geist, Instrument Serif), the user's pixel coach, app colours incl. the new stage colours
(year pixels: on goal `sleepDeep`, short a muted track). Share images always render in the dark theme;
1080×1080 for cards, 1080×1920 for stories. In-app screens follow light/dark.

**Image.** The preview view is captured with Skia (`makeImageFromView`) to PNG, written to a cache file, then
saved with `expo-media-library` or shared with `expo-sharing` (new native modules → one iOS rebuild).

**Privacy.** Nothing leaves the phone until Save/Share. Images never include name or email, and only the
numbers left switched on.

## 4. Errors and edge cases

- Thin data → no recap/push; per-stat omission; builder hides missing stats.
- First period → no comparison, no earlier-bedtimes fact (so the coach can't mention them).
- Time zones → each user's own zone decides when a period has ended; nights keyed by their own end date.
- Coach failures (down, slow, invalid twice, disabled, no consent) → template line; recap always built.
- Photos permission denied → Save explains how to allow it in Settings; Share still works. Capture failure →
  a short retry message.
- Account deletion → recaps removed with the user.

## 5. Testing

Backend (Jest, test DB): each number definition on hand-built periods (thin data, streak across a gap, first
period, goal snapshot), milestone rules, eligibility, dedupe on rerun, late-data rebuild only while unopened,
line paths (AI accepted, invalid → retry → template, coach off/no consent → no AI call), push sent/skipped and
`recapPushEnabled`, endpoints incl. 404 for another user's recap, cascade on user delete.
Mobile (Jest/RNTL): each screen from a stored recap, builder switches change the preview, year-pixel colouring
and count, Save permission-denied path, Share called with the captured file, push tap opens the recap, Home
ready card shows and dismisses.
Simulator/device: build a WEEK and MONTH recap for the owner, check push, each screen, both share formats and a
saved image; light and dark in-app.

## 6. Rollout and risk

Additive migration. New native modules need a rebuild of the dev client. The hosted coach costs one call per
eligible user per week/month. Risk: the AI line could repeat numbers in a misleading direction ("higher" vs
"lower" isn't checked by the validator) — the prompt states each comparison's direction explicitly and the
template set covers comparisons.
