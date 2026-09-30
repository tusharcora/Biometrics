# Biometrics

A Whoop/Bezel-style personal health app. Wearable data (steps, resting heart rate, sleep, HRV) is synced from a Fitbit through the **Google Health API** into a Node backend. The backend turns it into daily **Recovery** and **Sleep** scores, finds **habit ↔ biometric patterns**, and serves an **AI coach** that runs on a **local LLM (Ollama)**, so health data never leaves the machine. A React Native (Expo) app presents all of it.

🎬 **[Watch the demo](docs/media/redesign-demo.mp4)** (64 s): Home, Score detail, Metrics against your usual range, Forecast, Patterns, Coach, Activity and Profile in dark mode, then again in light. (Recorded before the companion characters replaced the orb.)

<table>
  <tr>
    <td><img src="docs/media/home-dark.jpg" width="190" alt="Home: Recovery hero ring, Sleep and Ask Coach tiles, Tomorrow forecast"></td>
    <td><img src="docs/media/hrv-dark.jpg" width="190" alt="HRV detail drawn against the usual range"></td>
    <td><img src="docs/media/forecast-dark.jpg" width="190" alt="Tomorrow's forecast with what-if levers"></td>
    <td><img src="docs/media/coach-dark.jpg" width="190" alt="AI Coach with starter questions"></td>
  </tr>
  <tr>
    <td><img src="docs/media/profile-dark.jpg" width="190" alt="Profile as grouped rows"></td>
    <td><img src="docs/media/home-light.jpg" width="190" alt="Home in light mode"></td>
    <td><img src="docs/media/profile-light.jpg" width="190" alt="Profile in light mode"></td>
    <td></td>
  </tr>
</table>

<sub>(These screens predate the companion characters.)</sub>

<table>
  <tr>
    <td><img src="docs/media/character-hoot.jpg" width="190" alt="Hoot: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-pip.jpg" width="190" alt="Pip: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-mochi.jpg" width="190" alt="Mochi: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-nimbus.jpg" width="190" alt="Nimbus: idle, thinking, answering and resting"></td>
  </tr>
  <tr>
    <td><img src="docs/media/character-ember.jpg" width="190" alt="Ember: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-beep.jpg" width="190" alt="Beep: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-doze.jpg" width="190" alt="Doze: idle, thinking, answering and resting"></td>
    <td><img src="docs/media/character-beat.jpg" width="190" alt="Beat: idle, thinking, answering and resting"></td>
  </tr>
</table>

📋 **[Migration status report](https://claude.ai/artifact/FuYPXc1v8PM4WSqJdtn2kY)**: what shipped in the Fitbit → Google Health API migration, the 8 real bugs only live device testing found, and what's left before a public launch.

---

## Contents

1. [System at a glance](#1-system-at-a-glance)
2. [End-to-end data flow](#2-end-to-end-data-flow)
3. [Repository layout](#3-repository-layout)
4. [Backend architecture](#4-backend-architecture)
5. [Data model](#5-data-model)
6. [Scoring engine (Recovery & Sleep)](#6-scoring-engine-recovery--sleep)
7. [Habits & correlation engine](#7-habits--correlation-engine)
8. [AI coach](#8-ai-coach)
9. [Models used](#9-models-used)
10. [Mobile app](#10-mobile-app)
11. [Technology stack](#11-technology-stack)
12. [External providers & services](#12-external-providers--services)
13. [Security & privacy](#13-security--privacy)
14. [Configuration](#14-configuration)
15. [Running locally](#15-running-locally)
16. [Testing & evaluation](#16-testing--evaluation)
17. [Operations scripts](#17-operations-scripts)
18. [Status & known limitations](#18-status--known-limitations)
19. [Design docs](#19-design-docs)

---

## 1. System at a glance

```mermaid
flowchart LR
  subgraph Device["iPhone (Expo / React Native)"]
    App["Mobile app<br/>Home · Activity · Coach · Metrics · Profile"]
  end

  subgraph Google["Google"]
    GSI["Google Sign-In"]
    GOA["OAuth 2.0"]
    GHA["Health API v4<br/>steps · sleep · HRV · RHR"]
    GWH["Health webhooks"]
  end
  Apple["Sign in with Apple"]
  Expo["Expo push service"]

  subgraph Server["Backend (Node / Express 5)"]
    API["REST API<br/>/auth /health /me/*"]
    W["BullMQ worker<br/>queue: health-sync"]
    SE["Stat engine<br/>scores · baselines"]
    HC["Habit correlation<br/>engine"]
    CO["Coach orchestrator<br/>+ grounding guardrails"]
  end

  PG[("PostgreSQL<br/>Prisma")]
  RD[("Redis")]
  OL["Ollama (local)<br/>qwen3.6:35b"]

  App -- "REST + session cookie" --> API
  App -. "ID token" .-> GSI
  App -. "identity token" .-> Apple
  App -- "OAuth consent (browser)" --> GOA
  GOA -- "callback + code" --> API
  GWH -- "POST /webhooks/health" --> API
  API --> RD
  RD --> W
  W -- "fetch / backfill" --> GHA
  W --> SE --> PG
  W --> HC --> PG
  API --> PG
  CO -- "/api/chat (loopback)" --> OL
  API --> CO
  W -- "weekly digest push" --> Expo --> App
```

| Layer | What it is |
|---|---|
| **Mobile** | Expo SDK 57 / React Native 0.86 / React 19 app with a dark-first design, a floating tab bar and eight selectable animated companion characters (Skia driven by Reanimated). Needs a development build; Expo Go is not supported. |
| **API** | Express 5 + TypeScript, [Better Auth](https://better-auth.com) sessions, Prisma 6 on PostgreSQL. |
| **Background work** | A single BullMQ queue (`health-sync`) on Redis runs every sync, scoring, habit, coach-digest and retention job, with repeatable schedules. |
| **Analytics** | A pure, versioned **stat engine** (per-user EWMA baselines → z-scores → logistic composite) and a **habit correlation engine** (de-seasonalised Pearson r with effective-n correction and Benjamini–Hochberg FDR). |
| **AI coach** | A tool-using LLM orchestrator whose replies may only contain numbers the server fetched (a `{{tool.path}}` grounding guardrail). It runs on a local Ollama model; no hosted LLM provider is used. |

## 2. End-to-end data flow

1. **Sign in.** Auth is **Better Auth**, mounted at `/auth/*`. The app signs in with an Apple identity token or a Google ID token (Better Auth's social ID-token sign-in verifies it), or with **email + password**: new accounts must confirm their email before the first sign-in, and "Forgot password" sends a reset link. Each sign-in method is an `Account` row on one `User`. A new method whose **verified** email matches a verified user is linked to that user; an unverified sign-up never attaches to an existing account. A successful sign-in creates a database-backed **30-day sliding session** (`Session` table, extended at most once a day while in use). The session cookie is kept in `expo-secure-store` and sent on every request.
2. **Connect Google Health.** `GET /health/authorize` mints a single-use OAuth `state` (Redis, 10-minute TTL) and returns the consent URL, which the app opens in the system browser. Google redirects to `GET /health/callback`, and the backend:
   - exchanges the code for tokens, encrypting both with **AES-256-GCM** before storing them;
   - resolves the user's `healthUserId`;
   - registers a **per-user webhook subscription** with a GCP service account;
   - enqueues a 30-day `backfill` of all four metrics and a 365-day **steps-history** backfill for the heat map;
   - deep-links back to the app with `biometrics://health/callback?status=connected`.
3. **Ongoing sync.** Google POSTs change notifications to `/webhooks/health`, verified with a constant-time `Authorization` comparison. Each notified interval becomes a `fetch` job, and the worker pulls just that day from `health.googleapis.com/v4`. Every job gets one in-line token refresh on a 401; a second 401 marks the connection `DISCONNECTED`. A repeatable **token-refresh sweep** (every 10 min) keeps access tokens fresh.
4. **Storage.** Each metric is stored as one `BiometricRecord` per civil day. Sleep is kept as whole `SleepSession` rows, and the daily SLEEP value is a derived rollup keyed by the local date of each session's end. The rollup is recomputed under a per-user Postgres advisory lock.
5. **Scoring.** New HRV, resting-HR or sleep data triggers a debounced (5-minute) `computeDailyScore`. The stat engine cleans outliers, builds baselines, computes features and z-scores, and writes Recovery and Sleep scores with a per-factor explanation and a confidence level. A nightly sweep at 03:30 back-fills anything missed or scored by an older algorithm version.
6. **Habits.** You log alcohol, caffeine, workouts or custom habits, or check in "nothing today". Every Monday at 05:00 the correlation engine tests each habit against next-day biometric factors and promotes patterns that pass two weeks running.
7. **Coach.** `POST /me/coach/message` runs one turn:
   - a crisis classifier screens the message first;
   - the server pre-fetches today's scores;
   - the model may call read-only tools (history, habits, goals, memory proposals);
   - the reply is validated so that every number is a resolved `{{tool.path}}` reference;
   - a failed reply is regenerated once, then falls back to a server-composed sentence.

   A weekly digest job writes a recap and sends a generic push notification.
8. **App.** Home shows the score cards and habit log. Activity shows the steps heat map. Metrics shows per-metric trend cards and Patterns. Coach is the chat with your companion character. Profile holds settings.

## 3. Repository layout

```
backend/                 Express API, BullMQ worker, stat engine, habit engine, AI coach
  src/
    auth/                Better Auth config (Apple, Google, email + password, sessions), requireAuth
    email/               verification / reset emails (Resend, or the console in development)
    health/              Google Health OAuth, API client, webhooks, service-account subscriptions
    sync/                BullMQ queue + worker, backfills, token-refresh sweep
    biometrics/          record storage, sleep rollups, civil-date/timezone helpers, /me/activity
    scoring/             stat engine (clean → features → baseline → composite → explain), configs v1–v3
    habits/              habit logging, observed-day rules, correlation stats, lifecycle
    coach/               orchestrator, guardrails, tools, personas, memory, digest, push, retention
      model/             provider interface: Unconfigured, Scripted (tests), Ollama
    users/               timezone, goals, account deletion
    crypto/              AES-256-GCM token cipher
  prisma/                schema.prisma + 13 migrations
  evals/coach/           coach eval harness (scripted + real local model)
  scripts/               ops scripts (backtest, resync, subscriber registration, …)
  tests/                 71 Jest suites against a real Postgres + Redis
mobile/                  Expo (React Native) app
  src/
    screens/             Dashboard, Activity, Metrics, Coach, Settings, ScoreDetail, MetricDetail, Patterns, …
    navigation/          root stack + bottom tabs + custom FloatingTabBar
    characters/          CharacterProvider (current character, coach status, recovery band), moods
    components/          companion characters (Skia), heat map, prompt bar, habit log, digest card, ui/ primitives
    api/                 fetch client that sends the session cookie; typed endpoints
    lib/                 pure logic: heatmap layout, metric trends, score insights, timezone, push
    theme/, theme.ts     dark-first tokens (mirrors global.css), metric config, motion tokens
  plugins/               iOS scene-delegate config plugin (iOS 27 SDK)
  __tests__/             77 Jest test files (jest-expo + Testing Library)
docs/superpowers/        design specs, implementation plans, research notes
```

## 4. Backend architecture

### Process model
`src/server.ts` binds the HTTP port first. Only after `listen` succeeds does it start the BullMQ worker, register the schedulers and install the graceful-shutdown handler. That handler drains HTTP → worker → queue → Redis → Prisma within 15 s. A second backend started on a taken port exits instead of running a second set of workers.

### REST API
Every `/me/*` route requires a valid Better Auth session (`requireAuth` looks it up in the database). Sessions are deleted with their user, so a deleted account's session stops working immediately. Coach routes additionally return 404 `coach_disabled` unless `COACH_ENABLED` is set.

| Module | Routes |
|---|---|
| auth | Better Auth under `/auth/*`: `sign-in/social` (Apple / Google ID token), `sign-up/email`, `sign-in/email`, `verify-email`, `request-password-reset`, `reset-password`, `link-social`, `unlink-account`, `list-accounts`, `list-sessions`, `revoke-session`, `sign-out`, … |
| health | `GET /health/authorize`, `GET /health/callback`, `GET/POST /webhooks/health` |
| biometrics | `GET /me/biometrics`, `GET /me/activity?from&to` (daily steps, ≤ 400 days), `GET /me/connection` |
| scoring | `GET /me/scores?days&type`, `GET /me/scores/:date?type` (with baselines, previous day, score bands) |
| habits | `GET /me/habits/config`, `POST /me/habits/types`, `POST/GET /me/habits/logs`, `DELETE /me/habits/logs/:id`, `POST /me/habits/check-ins`, `GET /me/habits/status`, `GET /me/habits/patterns` |
| users | `PUT /me/timezone` (re-buckets sleep and re-scores), `DELETE /me` (body `{"confirm":"DELETE"}`; revokes Google access, deletes everything) |
| coach | `GET /me/coach/status`, `POST/DELETE /me/coach/consent`, `PUT /me/coach/persona`, `POST /me/coach/message`, `GET /me/coach/conversations/latest`, `GET /me/coach/conversations/:id`, `GET/PATCH/DELETE /me/coach/memory[/:id]`, `GET /me/coach/digests/latest`, `POST/DELETE /me/push-token` |
| infra | `GET /health-check` |

### Background jobs (queue `health-sync`, worker concurrency 5)

| Job | Trigger | Does |
|---|---|---|
| `fetch` | webhook notification | fetches one day of one metric (sleep window widened ±1 day) and requests re-scores |
| `backfill` | connect / reconnect | all four metrics over 30 days, or since the last sync |
| `backfillStepsHistory` | connect, plus a server-start sweep for anyone still missing it | 365 days of steps for the heat map; sets `stepsHistoryBackfilledAt` |
| `tokenRefreshSweep` | every 10 min, plus once at startup | refreshes tokens expiring within 1 h; a failure disconnects |
| `computeDailyScore` | debounced 5 min per user/day | runs the stat engine for one day |
| `scoreSweep` | daily 03:30 | 90-day look-back for missing or stale scores |
| `habitCorrelationSweep` → `runHabitCorrelations` | Mondays 05:00 | one idempotent correlation run per user per ISO week |
| `coachWeeklyDigest` | Mondays 08:00 | weekly recap and a generic push (only when the coach is enabled) |
| `coachRetentionSweep` | daily 04:15 | deletes coach transcripts older than 90 days |

### Google Health API usage (`health.googleapis.com/v4`)
| Metric | Endpoint |
|---|---|
| Steps | `dataTypes/steps/dataPoints:dailyRollUp` (1-day windows, chunked into 14-day requests) |
| Resting HR | `dataTypes/daily-resting-heart-rate/dataPoints` |
| HRV | `dataTypes/daily-heart-rate-variability/dataPoints` |
| Sleep | `dataTypes/sleep/dataPoints` filtered on `sleep.interval.end_time` (session start/end with UTC offsets, minutes asleep) |
| Identity | `users/me/identity` → `healthUserId` |
| Webhooks | `projects/{number}/subscribers/biometrics-subscriber/subscriptions` (service-account token) |

The scopes are `googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly` and `googlehealth.sleep.readonly`. List calls follow `nextPageToken`, and windows are half-open `[start, end)`, with empty windows skipped because Google answers them with a 400.

## 5. Data model

PostgreSQL via Prisma (`backend/prisma/schema.prisma`).

| Model | Purpose |
|---|---|
| `User` | name, unique `email` + `emailVerified`, IANA `timezone`, `sleepGoalMinutes` (480), coach persona |
| `Session` | Better Auth sessions: 30-day sliding expiry, device user agent / IP (for Profile → Devices) |
| `Account` | one row per sign-in method (`apple`, `google`, or `credential` with the password hash) |
| `Verification` | single-use email-verification and password-reset tokens |
| `HealthConnection` | 1:1 Google Health link: encrypted tokens, webhook subscription id, status, `lastSyncedAt`, `stepsHistoryBackfilledAt` |
| `BiometricRecord` | one value per (user, metric, civil day at UTC midnight); SLEEP rows are a derived rollup |
| `SleepSession` | raw sleep sessions with their own UTC offsets (the source of the SLEEP rollup) |
| `BaselineSnapshot`, `UserDailyFeatures`, `ScoreInputFlag` | stat-engine intermediates: EWMA/MAD baselines, per-day features and z-scores, outlier verdicts |
| `DailyScore` | per (user, date, RECOVERY/SLEEP): score (null during cold start), confidence, factor breakdown, `algorithmVersion` |
| `HabitType`, `HabitLog`, `HabitCheckIn` | custom habit types, logs (stored with a 04:00-boundary "habit day"), "everything is logged" markers |
| `HabitCorrelation` | per (habit, factor, lag) test results and lifecycle state (CANDIDATE → CONFIRMED → RETIRED) |
| `CoachConsent`, `CoachConversation`, `CoachMessage`, `CoachMemory`, `CoachDigest`, `PushToken` | coach consent versions, transcripts (with reply source and guardrail events), user-confirmed memories, weekly digests, push tokens |

**Dates.** Every daily metric is keyed by the user's *civil date*. Google already keys steps, resting HR and HRV that way. Sleep is attributed to the local date of the session's end, using the session's own UTC offset when present and otherwise the user's timezone. Changing timezone rebuilds every sleep rollup and re-scores the affected days.

## 6. Scoring engine (Recovery & Sleep)

`backend/src/scoring/` is five pure, versioned stages composed by `scoreDay`:

1. **Clean.** HRV and resting-HR values more than 5 MADs from the trailing 90-day median are flagged as outliers once there are at least 14 prior points. Gaps are imputed from the metric's own EWMA and marked as imputed.
2. **Features.** 14-night rolling sleep debt against the user's goal, sleep efficiency, and bedtime consistency (noon-anchored onset spread). Acute:chronic load from steps is stored but excluded from the composite.
3. **Baseline.** Each metric gets a personal EWMA (N = 30) and spread = 1.4826 × MAD. Until there are 14 clean days (cold start) a factor is **excluded**, never replaced by a population default. Each factor becomes a z-score, and v3 clamps it to [−3, 3].
4. **Composite.** `score = 100 / (1 + e^(−k·Σ wᵢ·dᵢ·zᵢ))` with `k = ln 9 / 2`, so an average day scores 50 and +2σ scores 90. Weights are renormalised over the factors available.
   - **Recovery:** HRV 0.45 (+), resting HR 0.35 (−), sleep debt 0.20 (−).
   - **Sleep:** duration 0.50, efficiency 0.30, circadian consistency 0.20.
5. **Explain.** Each factor's share of the score's distance from 50 becomes the "what moved it" breakdown. Confidence starts at HIGH and drops one level for imputed inputs and for excluded factors.

Configs are immutable (`configs/v1`–`v3`, `LIVE_VERSION = 'v3'`). Changing the live version re-scores history through the nightly sweep. Score bands: Excellent ≥ 75, Good ≥ 55, Fair ≥ 40, otherwise Poor. `scripts/backtest.ts` replays history through two configs as a regression check.

## 7. Habits & correlation engine

- **Habit types:** built-in `ALCOHOL` (≥ 2 drinks), `CAFFEINE` (≥ 3 cups) and `WORKOUT` (≥ 20 min), plus user-defined types. A day only counts if something was logged (a 0 counts as a real "none") or the user checked in.
- **Weekly test:** each habit against next-day HRV, resting HR, sleep duration, sleep efficiency and circadian consistency, at lags of 1–3 days over a 120-day window. Each side needs at least 8 exposed and 8 unexposed days.
- **Statistics** (`habits/stats.ts`, dependency-free):
  - weekday de-seasonalisation of both series;
  - Pearson r;
  - lag-1 autocorrelation with a Pyper–Peterman effective-n correction;
  - Student-t p-values (Lanczos log-gamma + regularised incomplete beta);
  - a **Benjamini–Hochberg** correction across every test in the run.
- **A test passes** when q < 0.10 and |r| > 0.30.
- **Lifecycle:** 2 consecutive weekly passes → CONFIRMED; 2 misses → RETIRED. Only confirmed patterns reach the app or the coach.

## 8. AI coach

`backend/src/coach/`. It's disabled unless `COACH_ENABLED=true`, and it requires the user's versioned consent.

```mermaid
flowchart TD
  M[User message] --> C{Crisis classifier}
  C -- match --> S[Fixed safety reply + crisis resources]
  C -- no --> P[Preamble: server fetches today's scores]
  P --> T{Tier router}
  T -- recap/summary --> SY[synthesis tier]
  T -- else --> FA[fast tier]
  SY & FA --> L[Model loop ≤ 8 calls<br/>read-only tools executed server-side]
  L --> G{Grounding guardrail<br/>every number = resolved tool.path ref}
  G -- pass --> R[Reply + disclaimer]
  G -- fail --> RG[Regenerate once] --> G2{pass?}
  G2 -- yes --> R
  G2 -- no --> F[Server-composed fallback]
  L -- latency budget exceeded --> F
```

- **Tools** (read-only): `getDailyScore`, `getScoreHistory` (≤ 90 days), `getHabitCorrelations` (confirmed only), `getUserGoals`. There is also `proposeMemory`, which only *proposes* a memory (training goal, schedule or preference, ≤ 140 characters). A health-fact classifier rejects health facts disguised as preferences. The user's next message implicitly confirms or dismisses the proposal.
- **Grounding:** the model writes `{{getDailyScore.recoveryScore}}`-style references. The server resolves them and rejects any reply containing a digit outside a resolved reference or a small exempt set (list markers, clock times, dates, ordinals). This stops the model from making up health numbers.
- **Budgets:** fast tier 12 s and synthesis tier 60 s by default. Both can be overridden (`COACH_FAST_BUDGET_MS` / `COACH_SYNTHESIS_BUDGET_MS`); a local model needs more time.
- **Safety:** crisis messages (self-harm, medication, acute symptoms) never reach the model; they get fixed resources (988, Crisis Text Line, findahelpline.com, 911). Every reply ends with "This is a comparison against your own recent readings, not a medical assessment." The coach speaks as one of eight **characters** (personas v2: `hoot`, `pip`, `mochi`, `nimbus`, `ember`, `beep`, `doze`, `beat`; Hoot is the default). They share the same data, tools, grounding and safety rules and all prohibit diagnosis and medication dosing; only the voice and the coaching focus differ. Every character is `threshold-triggered`, so everyone gets the weekly recap. The retired styles map `encouraging → pip`, `direct → hoot`, `clinical → beep`.
- **Other features:** one in-flight turn per user and 15 turns per 5 minutes (turn guard); weekly digest with the same grounding rules; push notifications with fixed text only (no numbers), sent via Expo when `PUSH_PROVIDER=expo`; 90-day transcript retention; telemetry that drops message text.
- **Model providers** (`coach/model/`): `UnconfiguredProvider` (the default; every turn gets the fallback reply), `ScriptedProvider` (tests and evals) and **`OllamaProvider`** (`COACH_PROVIDER=ollama`). The Ollama provider refuses non-loopback URLs unless `OLLAMA_ALLOW_REMOTE=true`, strips `<think>` blocks, and adapts mid-conversation system messages for Qwen chat templates. No vendor LLM SDK is a dependency.

## 9. Models used

### Language model (coach)
| Role | Model | Where it runs |
|---|---|---|
| Coach chat, tool use and weekly digest | **`qwen3.6:35b`** (Qwen 3.6, mixture-of-experts with ~3B active parameters, Q4_K_M, 22 GB) | local **Ollama** (`http://localhost:11434`) |

The model was chosen with `npm run eval:coach:local`: the 34 coach eval fixtures run through the real orchestrator on an M1 Pro (32 GB).

| Model | Model replies | First-try guardrail rejects | Tool use | Median / p90 latency |
|---|---|---|---|---|
| **`qwen3.6:35b`** | **33/34** | **3** | correct | **3.1 s / 5.0 s** |
| `qwen3.8:27b` | 32/34 | 5 | correct | 30 s / 72 s |
| `qwen2.5-7b-instruct-abliterated` | 11/34 | 34 | calls tools | 14 s |
| Qwen3 4B uncensored (`flux2-klein` tag) | 34/34 | 11 | never | 3.4 s |

Details, remaining weaknesses and the original spike: `docs/superpowers/notes/local-model-coach-plan.md`. Pin the exact tag and re-run the eval before changing models.

### Statistical models (no ML training)
- **Recovery and Sleep scores:** personal EWMA baselines with robust (MAD) spread, z-scores and a weighted logistic composite (§6).
- **Outlier detection:** a robust MAD rule against the 90-day median.
- **Habit patterns:** de-seasonalised Pearson correlation with an autocorrelation-corrected effective n, Student-t tests and Benjamini–Hochberg FDR control (§7).

No model is trained on user data.

## 10. Mobile app

- **Navigation:** a native stack (`RootNavigator`) wraps the bottom **tabs**: Home · Activity · **Coach** (the centre character) · Metrics · Profile. Detail screens push over the tabs: MetricDetail, ScoreDetail, Patterns, ConnectHealth, CoachConsent, CoachMemory, and the MeetYourCoach modal. Signed-out users see SignIn.
- **Screens:**
  - **Home:** today's **Recovery** as a large hero ring (band-coloured, with a glow) and a one-line verdict naming the factor that moved it most. Below it, Sleep and Ask Coach tiles, Tomorrow's forecast, the habit check-in, the coach's weekly recap and a two-column metrics grid.
  - **Score detail:** the same hero, the confidence and band, the full explanation, the factor bars ("what moved it"), cold-start progress and the baselines used. A floating glass button asks the coach about it.
  - **Metrics / Metric detail:** every metric is drawn against its **usual range**: the middle 80% of the person's own last 30 days, shown once there are at least 7 readings. The line stays neutral and only readings outside the band take the metric's colour. The detail view adds 7D / 30D / 90D windows and drag-to-scrub with a haptic tick.
  - **Forecast:** tomorrow's likely Recovery range, what-if levers and the forecast's track record.
  - **Patterns:** habit → metric effects, each leading with its effect size, with the sample size and caveats.
  - **Activity:** a steps heat map with Month (calendar), Year and YTD views. Levels are relative to the 10,000-step goal, and no-data cells are drawn distinctly. Tapping a day opens a glass sheet with its details. The view also shows range stats: total, average, active days, goal streak and best day.
  - **Coach:** the chat, with your character as its face (header, empty state, thinking while a reply is worked on, a happy beat when it arrives), one-tap starter questions, slash commands, memory cards and a pill prompt bar.
  - **Meet your coach:** a pager of the eight characters (name, one-liner, greeting) that opens on the first Coach-tab visit when the coach is enabled; Skip picks Hoot. Reopened from Profile to switch.
  - **Profile:** iOS grouped rows for Google Health and sync, time zone, account (sign-in methods, devices, sign out), your coach, coach memory, notifications and account deletion.
  - **Sign-in / onboarding:** Apple, Google and email sign-in; sign up and password reset; Connect Google Health with the read-only data it will use.
- **Design system** (`global.css` ⇄ `src/theme.ts` ⇄ `tailwind.config.js`, kept in step by `__tests__/theme/tokens.test.ts`):
  - **Colour:** one cool-neutral ramp for dark (the default) and light, stepped surfaces instead of shadows, one accent per metric, and an indigo for the coach.
  - **Type:** Geist for the UI and tabular numerals, and Instrument Serif for editorial lines (loaded with `expo-font`). A named scale covers `text-eyebrow`, `text-numeral*` and `text-display*`. `components/ui/text.tsx` maps font weights to Geist's faces.
  - **Components:** `components/ui/`: `Card`, `SectionLabel`, `SettingsGroup`/`SettingsRow`, `RangeChart`, `ScoreRing`, `Glow`, `GlassSurface`, `Button`, and the Reanimated 4 motion kit (`PressableScale`, `Reveal`, `Sheet`, `SegmentedControl`, `CountUp`), all respecting reduce-motion.
  - **Chrome:** real iOS 26 **Liquid Glass** (`expo-glass-effect`) on the floating tab bar, sheets and floating buttons. It falls back to the system blur (`expo-blur`) on older iOS and to an opaque surface under Reduce Transparency. Content surfaces stay opaque.
  - **Companion characters** (`components/characters/`): Hoot, Pip, Mochi, Nimbus, Ember, Beep, Doze and Beat, drawn with **Skia** in a 100×100 space and animated by Reanimated shared values on the UI thread (no React re-render per frame). Each has four moods, cross-faded over 250 ms: **idle**, **thinking** (a message is sending), **answering** (a reply arrived in the last 2.5 s) and **resting** (today's Recovery is poor). `Character` takes a size, mood and `mini` (head-only, the default at 40 px and below). The tab bar's character always idles; elsewhere characters pause off screen, and Reduce Motion holds each mood's still pose. The choice is saved on the server (`PUT /me/coach/persona`) and cached in SecureStore for a fast cold start; signed out, it's always Hoot.

    | Character | Voice | Focus |
    |---|---|---|
    | Hoot (default) | calm, wise, curious | patterns across weeks |
    | Pip | upbeat cheerleader | habits, streaks, one small next step |
    | Mochi | soft and gentle | stress, recovery, rest without guilt |
    | Nimbus | breezy, forecast framing | what kind of day to plan |
    | Ember | energetic, motivating | training load, strain, performance |
    | Beep | precise, numbers first | raw metrics against your usual range |
    | Doze | slow, cosy | sleep and wind-down |
    | Beat | warm, heart-centred | resting heart rate, HRV, cardio health |
- **Networking:** `apiFetch` sends the Better Auth session cookie from SecureStore. Sessions slide on the server, so there is no refresh step: a 401 signs the user out (unless they already signed in again); network errors don't. The coach request has its own timeout (`EXPO_PUBLIC_COACH_TIMEOUT_MS`).
- **iOS:** the config plugin `plugins/with-ios-scene-delegate.js` adds the UIScene lifecycle the iOS 27 SDK requires. Push (`expo-notifications`) is only added at prebuild with `EXPO_PUSH=1`, because the `aps-environment` entitlement needs a paid Apple team.

## 11. Technology stack

| Area | Technology |
|---|---|
| Language | TypeScript everywhere (strict; backend also uses `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`) |
| Backend runtime | Node.js 24+ (Docker `node:24-slim`), Express 5 |
| Database | PostgreSQL 16 via **Prisma 6** (migrations committed) |
| Queue / cache | **Redis** + **BullMQ 6** (ioredis) |
| Auth | **Better Auth** (+ `@better-auth/expo`): Apple / Google ID-token sign-in, email + password, DB-backed sessions; `google-auth-library` for the service account |
| Crypto | Node `crypto`: AES-256-GCM for stored OAuth tokens; Better Auth handles password hashing and session tokens |
| LLM runtime | **Ollama** (local HTTP `/api/chat`), no LLM SDK |
| Mobile | **Expo SDK 57**, React Native 0.86, React 19, React Navigation 7 (native-stack, bottom-tabs) |
| Mobile UI | NativeWind 4 + Tailwind 3, Reanimated 4 + worklets, **@shopify/react-native-skia** (companion characters), react-native-svg, Ionicons; **expo-glass-effect** + **expo-blur** (Liquid Glass with fallback), expo-haptics; fonts **Geist** and **Instrument Serif** via `@expo-google-fonts` |
| Mobile platform | better-auth client + `@better-auth/expo` (session in expo-secure-store), expo-auth-session + web-browser (OAuth), expo-apple-authentication, expo-notifications |
| Testing | Jest 30: ts-jest + Supertest + nock (backend, real Postgres/Redis); jest-expo + Testing Library (mobile) |
| Packaging | Dockerfile for the backend (runs `prisma migrate deploy` on start, health-check probe) |

## 12. External providers & services

| Provider | Used for |
|---|---|
| **Google Health API** | steps, sleep sessions, daily HRV, daily resting HR, identity, per-user webhook subscriptions |
| **Google OAuth 2.0** | user consent and token exchange, refresh and revocation for the Health scopes |
| **Google Sign-In** | app sign-in (ID token verified by Better Auth) |
| **Google Cloud service account** | managing webhook subscriptions only (`cloud-platform` scope); never mixed with user tokens |
| **Sign in with Apple** | app sign-in (identity token verified by Better Auth against Apple's JWKS) |
| **Resend** | verification and password-reset emails (optional in development, where links are printed to the console) |
| **Expo Push Service** | generic weekly-digest notifications (optional; `PUSH_PROVIDER=expo`) |
| **Ollama** (self-hosted, local) | the coach's LLM (`qwen3.6:35b`) |
| **PostgreSQL**, **Redis** | self-hosted persistence and job queue |

No hosted LLM, analytics or crash-reporting service is used.

## 13. Security & privacy

- **Health data stays local for the AI.** The coach only talks to a loopback Ollama unless explicitly overridden. Only tool results and the user's message are sent to the model, never tokens or full history.
- **Token handling:** Google tokens are AES-256-GCM encrypted at rest. Sessions are database-backed and revocable per device; a password reset revokes every session. Session freshness is disabled (`session.freshAge: 0`, an owner decision) because freshness counts from session creation and would lock long-lived sessions out of Devices and unlinking; removing the last sign-in method and linking a different email stay blocked server-side. The OAuth `state` is single-use and short-lived. Webhooks use a constant-time secret comparison.
- **Least exposure:** the API returns only the fields screens use, and the coach's telemetry drops message text. Push notifications carry fixed text only, never health numbers.
- **User control:** the coach requires versioned consent, and memories can be viewed, edited and deleted. `DELETE /me` revokes Google access and deletes all data in one transaction. Coach transcripts expire after 90 days.

## 14. Configuration

Templates: `backend/.env.example`, `mobile/.env.example`.

**Backend (required):** `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (the API's public URL, used in email links), `TOKEN_ENCRYPTION_KEY` (base64 of 32 bytes), `GOOGLE_HEALTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`, `GOOGLE_HEALTH_WEBHOOK_SECRET`, `GOOGLE_CLOUD_PROJECT_NUMBER`, `GOOGLE_APPLICATION_CREDENTIALS` (service-account key path), `GOOGLE_CLIENT_ID` (Sign-In), `APPLE_BUNDLE_ID`, `PORT` (default 3000).

**Backend (optional):** `GOOGLE_IOS_CLIENT_ID` (a second Google client id whose ID tokens are accepted).

**Email:** `EMAIL_FROM` and `RESEND_API_KEY`. Without both, development prints verification and reset emails to the backend log instead of sending them; production refuses to boot without them.

**AI coach (local model):**
```env
COACH_ENABLED=true
COACH_PROVIDER=ollama
OLLAMA_MODEL=qwen3.6:35b          # pin the exact tag
COACH_FAST_BUDGET_MS=30000
# optional: OLLAMA_URL, OLLAMA_FAST_MODEL, OLLAMA_THINK, OLLAMA_TEMPERATURE,
#           OLLAMA_NUM_CTX, OLLAMA_KEEP_ALIVE, OLLAMA_ALLOW_REMOTE, COACH_SYNTHESIS_BUDGET_MS
```

**Push (optional):** `PUSH_PROVIDER=expo`, `EXPO_ACCESS_TOKEN`.

**Mobile:** `EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:3000`), `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_COACH_TIMEOUT_MS` (keep it above the fast budget, e.g. `35000`), `EXPO_PUBLIC_CHARACTER_GALLERY=1` (dev character gallery: every character in every mood, plus the mini variants), and `EXPO_PUBLIC_DEV_SIGN_IN_EMAIL` / `EXPO_PUBLIC_DEV_SIGN_IN_PASSWORD` (dev builds only: a one-tap "Sign in as … (dev)" button for a local test account). Build-time: `EXPO_PUSH=1` to include push.

## 15. Running locally

Prerequisites: Node 24 (the backend requires it; run `nvm use`), PostgreSQL, Redis, Xcode with an iOS simulator, and for the coach [Ollama](https://ollama.com) with the model pulled.

```bash
# 1. Coach model (optional, ~22 GB)
ollama pull qwen3.6:35b

# 2. Backend
cd backend
cp .env.example .env          # fill in secrets
npm install
npx prisma migrate deploy
npm run build
node --env-file=.env dist/server.js      # API on :3000; worker + schedulers start after bind
# In development, verification and password-reset links are printed in the backend log as `[email] to=…`;
# open them on the simulator with `xcrun simctl openurl booted '<link>'`.

# 3. Mobile (Skia is native, so this needs a development build; Expo Go won't work)
cd ../mobile
cp .env.example .env
npm install
npx expo run:ios              # first time / after native changes
npx expo start --dev-client   # afterwards: JS-only changes
```

The redesign added native modules (`expo-glass-effect`, `expo-blur`), so an existing development build must be rebuilt once (`npx expo run:ios`) before it can load the current JavaScript.

**A demo account** with 90 days of synthetic history, scored by the real pipelines:

```bash
cd backend
DEMO_USER_PASSWORD='<choose one>' npx ts-node scripts/seedDemoUser.ts --email demo@example.com
# Forgot it later? Reset the password without reseeding (local only):
NEW_PASSWORD='<new one>' TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/setUserPassword.ts --email demo@example.com
```

Put the same email and password in `mobile/.env` as `EXPO_PUBLIC_DEV_SIGN_IN_EMAIL` / `EXPO_PUBLIC_DEV_SIGN_IN_PASSWORD` (then restart Metro) to get a one-tap dev sign-in button. It never appears in a release build.

The provider is built on the coach's first use, which logs `coach.provider_configured` with `ollama:qwen3.6:35b`. A bad Ollama configuration logs `coach.provider_config_invalid` instead, and the coach then answers with its fallback reply.

### Upgrading an existing database (Better Auth migrations)

`20260927120000_better_auth` moves existing users onto Better Auth's tables, and `20260928120000_normalize_user_email` lower-cases and trims their emails (Better Auth looks emails up in lower case). The second one refuses to run if two users share an email that differs only by case.

Rehearse on a copy of the dev database first:

```bash
createdb biometrics_rehearsal && pg_dump biometrics | psql biometrics_rehearsal
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/biometrics_rehearsal npx prisma migrate deploy
```

If a migration fails, fix the data it reports (for example, merge or delete the duplicate user), mark it rolled back with `npx prisma migrate resolve --rolled-back <migration_name>` (`20260927120000_better_auth` or `20260928120000_normalize_user_email`), then re-run `npx prisma migrate deploy`. Prisma does not wrap a migration in a transaction, so one that fails partway can leave some of its changes behind: take a `pg_dump` backup before deploying so you can restore it instead.

### Mobile sign-in

The app signs in with Apple, Google, or email + password (new accounts confirm their email before first sign-in; "Forgot password" sends a reset link). Once signed in, **Profile → Account → Sign-in methods** links or unlinks methods on the account, **Profile → Account → Devices** lists signed-in devices and signs them out, and **Profile → Account → Sign out** signs out.

Linking a new method from **Profile → Sign-in methods** is Apple / Google only.

Email links open the app through deep links: `biometrics://verified` opens sign-in with an "Email confirmed" banner (it does not sign you in automatically) and `biometrics://reset-password?token=…` (set a new password). iOS dev builds need the `biometrics` URL scheme, which is already set in `mobile/app.json`; rebuild the native project after pulling if the scheme or native modules changed.


## 16. Testing & evaluation

```bash
# Backend: uses a real Postgres + Redis; point DATABASE_URL/TEST_DATABASE_URL at a *_test database
cd backend && npm test        # 71 suites, ~1,300 tests (serial: maxWorkers 1)
docker compose -f docker-compose.test.yml up -d   # optional Postgres 16 on :5434

# Mobile
cd mobile && npm test         # 102 test files, ~970 tests

# Coach evals
cd backend && npm run eval:coach          # scripted provider, no network (also run in Jest)
OLLAMA_MODEL=qwen3.6:35b npm run eval:coach:local   # real local model; *_test DB only
```

Backend Jest runs may not exit on their own because of an open Redis handle; use `--forceExit` if needed. There is no CI in the repository; run both suites before merging.

## 17. Operations scripts

`backend/scripts/`:
- `registerHealthSubscriber.ts`: one-time Google webhook subscriber registration.
- `resyncSleep.ts`, `resyncRestingHr.ts`: re-fetch a metric's window (dry-run by default).
- `rescoreUser.ts`: recompute a user's scores inline.
- `backtest.ts`: compare scoring configs over history.
- `probeSleepShape.ts`: inspect raw Google sleep payloads.
- `purgeTestFixtures.ts`: clean test users.
- `seedDemoUser.ts`: create (or recreate) the demo account with 90 days of synthetic history, run through the real scoring and habit pipelines.
- `setUserPassword.ts`: set a new password on an existing local account without touching its data (refuses in production).

## 18. Status & known limitations

- **Public launch needs Google's CASA review.** All three Health scopes are Restricted. Until the app is verified it's limited to about 100 allowlisted test users, and refresh tokens expire after 7 days while the OAuth app is in Testing.
- **Live webhook delivery hasn't been observed yet.** The backfill path is proven against a real account.
- **Step history is limited to what Google holds.** The heat map requests a full year; the test account returned about 5 months.
- **The coach is a prototype.** The local model is fast and well grounded, but it can still word deltas awkwardly or guess from missing data (see the local-model note). The guardrails prevent made-up numbers, not every weak inference.
- **Push is built end-to-end but hasn't been delivered to a real device.** It needs a paid Apple team and an EAS build.
- **The redesign's device card (spec §5) is not built yet.**
- **Coach replies are plain text.** The mockups' inline data cards and follow-up chips need the backend to return structured replies.

## 19. Design docs

`docs/superpowers/`:

| Doc | Topic |
|---|---|
| `specs/2026-09-15-phase1-foundation-design.md` | original foundation: accounts, OAuth connect, webhook sync, dashboard |
| `specs/2026-09-16-google-health-migration-design.md` | Fitbit → Google Health API, live-verified API facts, CASA risk |
| `specs/2026-09-20-stat-engine-design.md` | Recovery and Sleep score pipeline |
| `specs/2026-09-20-habits-correlation-design.md` | habit logging and correlation engine |
| `specs/2026-09-20-ai-coach-design.md` | AI coach: tools, guardrails, safety, memory, digest |
| `specs/2026-09-21-app-redesign-design.md` | dark-first redesign, tab bar, orbs (since replaced), heat map, coach chat |
| `specs/2026-09-29-companion-characters-design.md` | companion characters: eight selectable coaches, moods, Meet your coach |
| `plans/*` | task-by-task implementation plans |
| `notes/slice0-live-checks.md` | live Google Health probe results |
| `notes/local-model-coach-plan.md` | local LLM evaluation and the model choice |
