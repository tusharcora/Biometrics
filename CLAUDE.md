# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Two independent npm projects (no root `package.json`, no workspace tooling) — always `cd` into one before running commands:

- `backend/` — Express 5 + TypeScript API, Prisma/Postgres, BullMQ/Redis workers.
- `mobile/` — Expo (React Native) app styled with NativeWind (Tailwind).
- `docs/superpowers/{specs,plans}/` — design specs and plans. Read the relevant spec before changing a feature. The stat-engine, habits-correlation and ai-coach specs are **implemented**; each ends with an "Implementation Status" / decisions section that records where the code deviates from the original text. `specs/archive/` holds a superseded combined spec.

Local `main` can lag `origin/main` — check `git log origin/main` before assuming what exists.

## Commands

Backend (`cd backend`):

```bash
npm run build                      # tsc -> dist/ (tests/, scripts/, evals/ are excluded from tsconfig)
npm test                           # jest (ts-jest), runs serially (maxWorkers: 1), 20s timeout
npx jest tests/sync/worker.test.ts # single test file
npx jest -t "name pattern"         # single test by name
npx prisma migrate deploy          # apply migrations
npm run eval:coach                 # coach eval harness (evals/coach, own tsconfig.evals.json)
npx ts-node scripts/registerHealthSubscriber.ts   # one-time ops script, not part of the app
```

There is no dev-server or lint script; the entrypoint is `src/server.ts` (`node dist/server.js` after build).

Backend tests hit a **real Postgres** (and real Redis for tests that import `sync/queue`/`sync/worker`, which open an `ioredis` connection at import time). Start the test DB with `docker compose -f docker-compose.test.yml up -d` (Postgres 16 on host port **5434**, db `biometrics_test`), then export `DATABASE_URL` **and** `TEST_DATABASE_URL` pointing at it — `tests/setupTestDb.ts` runs `prisma migrate deploy` against `TEST_DATABASE_URL`, while the app's Prisma client reads `DATABASE_URL`, so both must be set to the same DB. Suites seed and delete real rows, which is why jest is serial. Google HTTP calls are mocked with `nock` or `jest.mock`; `jose` is mapped to `__mocks__/jose.js`.

Mobile (`cd mobile`):

```bash
npm test                                   # jest-expo
npx jest __tests__/screens/DashboardScreen.test.tsx   # single file
npm start | npm run ios | npm run android  # expo start / expo run:*
npx tsc --noEmit                           # typecheck (no script defined)
```

Env vars: copy `backend/.env.example` and `mobile/.env.example`. `TOKEN_ENCRYPTION_KEY` must be 32 raw bytes, base64-encoded.

## Architecture

**Pipeline:** mobile signs in (Apple/Google ID token → `/auth/*` → app JWT + rotating single-use refresh tokens) → user connects Google Health via OAuth → backend stores encrypted tokens, registers a per-user webhook subscription, enqueues a 30-day backfill (`BACKFILL_WINDOW_DAYS` in `health/routes.ts`) → Google webhooks (`POST /webhooks/health`, bearer-secret verified) enqueue `fetch` jobs → `sync/worker.ts` pulls STEPS / RESTING_HR / SLEEP / HRV from `health.googleapis.com/v4` into `BiometricRecord` (SLEEP also stores whole `SleepSession` rows; the per-day SLEEP record is a **derived rollup** bucketed by the user's IANA `User.timezone`) → a debounced `computeDailyScore` job (plus a 03:30 nightly `scoreSweep`) turns them into `DailyScore` rows → weekly job computes habit/biometric correlations → mobile reads `/me/biometrics`, `/me/scores`, `/me/habits/*`, `/me/coach/*`.

Backend modules (`backend/src/`): `auth/`, `health/` (Google Health OAuth, REST client, webhook + subscription mgmt), `sync/` (queue, worker, token refresh), `biometrics/` (repository, civil-date/timezone helpers), `users/` (timezone), `scoring/` (pure pipeline: clean → baseline → features → composite → explain; versioned configs in `scoring/configs/`; `backtest.ts` replays the same function under another config), `habits/` (logs, check-ins, correlation engine + weekly sweep), `coach/` (below), `crypto/tokenCipher.ts` (AES-256-GCM).

**All background work rides the single `health-sync` BullMQ queue** (`sync/queue.ts`) and worker; job names (`fetch`, `backfill`, `tokenRefreshSweep`, `computeDailyScore`, `scoreSweep`, habit/coach jobs) are dispatched in `sync/worker.ts`. Recurring jobs are repeatable schedulers, not `setInterval`, so multiple instances don't duplicate them (notably the token sweep, which would otherwise race on **single-use** Google refresh tokens). `server.ts` starts workers only after `listenOrExit` (`listen.ts`) confirms the port bound.

**AI coach** (`coach/`): orchestrator = crisis classifier → server pre-fetch of today's score → bounded tool-calling model loop → post-response numeric **grounding** guardrail (reject, regenerate once, else server-composed fallback) → reply, under a 12s budget. Replies are buffered whole, never streamed. Model access is behind `CoachModelProvider`; **only `UnconfiguredProvider` (always falls back) and a test `ScriptedProvider` exist — no LLM vendor is wired**, and `COACH_ENABLED` defaults false, in which case `/me/coach/status` says `enabled:false`, every other coach route 404s, and the mobile UI hides coach entry points. Consent is versioned and enforced server-side (409 on stale version).

Non-obvious constraints — preserve when editing:

- **Token 401 handling** (`sync/worker.ts` `JobTokenSession`): one in-line refresh per job before the connection is marked `DISCONNECTED` and its subscription deleted. Google issues a refresh token only on the initial OAuth exchange, so the callback hard-fails without one.
- **OAuth callback is unauthenticated by design** (`/health/callback`): `/health/authorize` mints a Redis single-use state token (consumed atomically with `GETDEL`) bound to the user. The callback deletes stale Google subscriptions (one allowed per subscriber/user) *before* registering a new one and rolls back orphans on failure.
- **Date semantics** (`health/client.ts`, `sync/window.ts`): ranges are half-open `[start, end)`; an empty window must be skipped, not sent (Google 400s). `STEPS`/`RESTING_HR` use `dailyRollUp` (civil-date keyed, ≤14-day windows, chunked); `SLEEP`/`HRV` use `dataPoints.list`. `BiometricRecord` is unique on `(userId, metricType, recordedAt)` → syncs are idempotent upserts.
- **Identity is keyed on `(authProvider, providerUserId)`, not email** — same-email Apple and Google accounts are deliberately separate users.
- `GET /health-check` is liveness (`/health/*` belongs to the Google Health router). `app.ts` captures `req.rawBody`.
- Dockerfile runs `prisma migrate deploy` before serving and deliberately doesn't copy `prisma.config.ts` (it imports undeclared `dotenv`).

**Mobile** (`mobile/src/`): `App.tsx` → `ThemeProvider` → `AuthProvider` → `RootNavigator`, a single native stack (Dashboard, MetricDetail, ScoreDetail, Patterns, Settings, Coach, CoachConsent, CoachMemory, ConnectHealth). `RootNavigator` asks `/me/connection` for the initial route. `api/client.ts` `apiFetch` attaches the SecureStore token and refreshes once on 401 — concurrent 401s share one in-flight refresh promise because refresh tokens are single-use; an unrecoverable refresh signs the user out. API modules per domain: `api/{scores,habits,coach}.ts`. Theming has two sources that must stay in sync: CSS variables in `global.css` (NativeWind classes via `tailwind.config.js`) and `COLORS`/`METRIC_CONFIG`/`MOTION` in `theme.ts` (navigation theme, SVG, inline styles). Dark mode is a manual toggle (`theme/ThemeProvider.tsx`). Score UI is deterministic display of server-computed scores (`lib/scoreInsights.ts`, `lib/scoreMotion.ts`, `components/ui/score-ring.tsx`); there is no client-side scoring. `plugins/with-ios-scene-delegate.js` adopts the iOS UIScene lifecycle for new iOS SDKs — read its header comment before touching it. Jest setup is `jest-setup.js` (mocks `react-native-worklets`, sets up Reanimated) plus the worklets resolver in `jest.config.js`.
