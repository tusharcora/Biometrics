# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Two independent npm projects (no root `package.json`, no workspace tooling) — always `cd` into one before running commands:

- `backend/` — Express 5 + TypeScript API, Prisma/Postgres, BullMQ/Redis sync worker.
- `mobile/` — Expo (React Native) app styled with NativeWind (Tailwind).
- `docs/superpowers/{specs,plans}/` — design specs and implementation plans. Read the relevant spec before changing a feature; the 2026-09-20 specs (stat engine, habits correlation, AI coach) describe **planned, not yet built** work.

## Commands

Backend (`cd backend`):

```bash
npm run build                      # tsc -> dist/ (tests/ and scripts/ are excluded from tsconfig)
npm test                           # jest (ts-jest)
npx jest tests/sync/worker.test.ts # single test file
npx jest -t "name pattern"         # single test by name
npx prisma migrate deploy          # apply migrations
npx ts-node scripts/registerHealthSubscriber.ts   # one-time ops script, not part of the app
```

There is no dev-server or lint script; the server entrypoint is `src/server.ts` (`node dist/server.js` after build).

Backend tests hit a **real Postgres** (and real Redis for tests that import `sync/queue`/`sync/worker`, which open an `ioredis` connection at import time). Start the test DB with `docker compose -f docker-compose.test.yml up -d` (Postgres 16 on host port **5434**, db `biometrics_test`), then export `DATABASE_URL` **and** `TEST_DATABASE_URL` pointing at it — `tests/setupTestDb.ts` runs `prisma migrate deploy` against `TEST_DATABASE_URL`, while the app's Prisma client reads `DATABASE_URL`, so both must be set to the same DB. Tests set their own JWT/encryption/Google env vars in `beforeAll`. Google HTTP calls are mocked with `nock` or `jest.mock`; `jose` is mapped to `__mocks__/jose.js` in `jest.config.js`.

Mobile (`cd mobile`):

```bash
npm test                                   # jest-expo
npx jest __tests__/screens/DashboardScreen.test.tsx   # single file
npm start | npm run ios | npm run android  # expo start / expo run:*
npx tsc --noEmit                           # typecheck (no script defined)
```

Env vars: copy `backend/.env.example` and `mobile/.env.example`. `TOKEN_ENCRYPTION_KEY` must be 32 raw bytes, base64-encoded.

## Architecture

**Data flow:** mobile signs in (Apple/Google ID token → `/auth/*` → app-issued JWT access + rotating single-use refresh tokens) → user connects Google Health via OAuth → backend stores encrypted tokens, registers a per-user Google Health webhook subscription, and enqueues a 30-day backfill → Google webhooks (`POST /webhooks/health`, verified by a bearer secret in `health/webhookVerify.ts`) enqueue `fetch` jobs → `sync/worker.ts` pulls metrics from `health.googleapis.com/v4` and upserts `BiometricRecord` rows → mobile reads `/me/biometrics` and `/me/connection`.

Backend module map (`backend/src/`): `auth/` (Apple/Google verification, JWT + refresh rotation, `requireAuth`), `health/` (Google Health OAuth, REST client, webhook + subscription management, service-account auth), `sync/` (BullMQ queue, worker, token refresh), `biometrics/` and `users/` (repositories + routes), `crypto/tokenCipher.ts` (AES-256-GCM for stored Google tokens).

Non-obvious design constraints — preserve these when editing:

- **One BullMQ queue (`health-sync`) carries three job types**: `fetch`, `backfill`, and the `tokenRefreshSweep`. The sweep is a repeatable job scheduler (not `setInterval`) so multiple backend instances don't race on the same **single-use** Google refresh token. `server.ts` starts the HTTP server and the worker in the same process.
- **Token 401 handling** (`sync/worker.ts` `JobTokenSession`): a 401 gets exactly one in-line refresh per job before the connection is marked `DISCONNECTED` and its Google subscription deleted. Refresh tokens are only issued on the initial OAuth exchange, so the callback hard-fails if none is returned.
- **OAuth callback is unauthenticated by design** (`/health/callback`): the system browser can't send the JWT, so `/health/authorize` mints a Redis-stored, single-use state token (consumed atomically with `GETDEL`) bound to the user. The callback cleans up stale Google subscriptions (Google allows one per subscriber/user) *before* registering a new one and rolls back orphans on failure.
- **Date semantics in `health/client.ts`:** date ranges are half-open `[start, end)`, so a single-day fetch is `[date, date+1)`. `STEPS`/`RESTING_HR` come from `dailyRollUp` (civil-date keyed, max 14-day window per call, chunked); `SLEEP`/`HRV` come from `dataPoints.list` (UTC instants truncated to UTC midnight). `BiometricRecord` is unique on `(userId, metricType, recordedAt)` so syncs are idempotent upserts.
- **Identity is keyed on `(authProvider, providerUserId)`, not email** — Apple and Google accounts with the same email are deliberately separate users.
- `GET /health-check` is the liveness route (the `/health/*` prefix belongs to the Google Health router). `app.ts` captures `req.rawBody` in the JSON parser's `verify` hook.
- The Dockerfile runs `prisma migrate deploy` before starting, and deliberately does not copy `prisma.config.ts` (it imports `dotenv`, which isn't a declared dependency).

Mobile (`mobile/src/`): `App.tsx` wraps `ThemeProvider` → `AuthProvider` → `RootNavigator`. `RootNavigator` asks `/me/connection` to pick the initial route (Dashboard if CONNECTED, else ConnectHealth). `api/client.ts` `apiFetch` attaches the SecureStore token and, on 401, refreshes once — concurrent 401s share one in-flight refresh promise because refresh tokens are single-use. Deterministic (non-AI) headline text lives in `lib/metricInsights.ts`; per-metric label/format/color/goal config is in `theme.ts`. Theming has two parallel sources that must stay in sync: CSS variables in `global.css` (consumed via `tailwind.config.js` for NativeWind classes) and the `COLORS` object in `theme.ts` (used for React Navigation theme, SVG, and inline styles). Dark mode is a manual toggle (`theme/ThemeProvider.tsx`, `theme/preference.ts`). `plugins/with-ios-scene-delegate.js` is an Expo config plugin that adopts the iOS UIScene lifecycle for new iOS SDKs — see its header comment before touching it.

Mobile tests rely on `jest-setup.js` (mocks `react-native-worklets`, sets up Reanimated) and the `react-native-worklets/jest/resolver` in `jest.config.js`.
