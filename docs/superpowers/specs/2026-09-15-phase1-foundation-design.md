# Phase 1: Foundation — Design

## Context

This is the first phase of a Whoop/Bezel-style biometrics app. The
long-term product turns wearable data into actionable guidance
(recovery/readiness scoring), correlates it with self-logged habits,
and surfaces insights — but none of that is useful without a reliable
pipe from the wearable to the user's phone first. Phase 1 builds that
pipe, for multiple users, as the foundation the later phases build on.

**Product phases (this doc covers Phase 1 only):**
1. **Foundation** (this doc) — accounts, Fitbit connection, data sync,
   minimal dashboard.
2. **Daily guidance** — recovery/readiness score and recommendation.
3. **Habit tracking** — user-logged behaviors (caffeine, alcohol,
   workouts, sleep timing).
4. **Correlation & insights** — surface patterns between habits and
   biometric trends.

## Goals

- A user can create an account and sign in.
- A user can connect their Fitbit account via OAuth.
- The backend keeps that user's biometric data (HRV, resting heart
  rate, sleep, steps) in sync automatically, without polling waste.
- The mobile app displays the user's synced data.
- The system supports multiple independent users (this is being built
  toward a public product, not a single-user tool).

## Non-Goals

- No recovery/readiness scoring, habit logging, or correlation
  analysis — Phases 2–4.
- No wearables other than Fitbit — later integrations (Oura, Garmin,
  Apple HealthKit) are separate future work, not designed here.
- No monetization/billing.

## Architecture

**Components:**

- **Mobile app** — React Native + Expo, targeting iOS and Android from
  one codebase.
- **Backend API** — Node.js/TypeScript, deployed as a persistent
  container on AWS ECS Fargate (not Lambda — Fitbit webhook receipt
  and background token-refresh jobs need to run reliably without
  cold-start latency or execution-time limits).
- **Database** — AWS RDS Postgres, in the same AWS account/VPC as the
  ECS service for simple networking and IAM-based access control.

**Why these choices:**

- Node/TypeScript backend shares a language with the React Native
  client (shared types for API payloads) and suits the
  integration-heavy nature of this phase (OAuth token lifecycle,
  webhook handling, rate-limit backoff) better than a data-science
  stack that isn't needed until Phase 4, or a managed BaaS that would
  fight the custom OAuth/webhook logic this phase requires.
- Managed Postgres over self-hosted for backup/scaling without ops
  overhead, while staying relational (users, devices, biometric
  records are naturally relational, with time-series extensions
  available later if biometric volume demands it).

## Data Model (high level)

- **User** — id, email, auth provider (Apple/Google), created_at.
- **FitbitConnection** — user_id, encrypted access token, encrypted
  refresh token, token_expires_at, fitbit_user_id, webhook
  subscription id, status (`connected` / `disconnected`).
- **BiometricRecord** — user_id, metric type (HRV, resting_hr, sleep,
  steps), value, recorded_at, synced_at.

Tokens are encrypted at rest (not just relying on DB access control),
since they grant access to a third party's health data API.

## Data Flow

1. **Sign-in:** user authenticates via Sign in with Apple or Google →
   backend verifies the provider token and issues a session JWT.
2. **Connect Fitbit:** user taps "Connect Fitbit" in the app → app
   opens Fitbit's OAuth consent screen → Fitbit redirects back with an
   auth code → backend exchanges it for access/refresh tokens, stores
   them encrypted, and registers a Fitbit webhook subscription for
   that user's account.
3. **Ongoing sync:** Fitbit pushes a webhook notification when new
   data is available → backend verifies the webhook signature →
   backend fetches the new data via Fitbit's API → backend writes it
   to `BiometricRecord`.
4. **Token refresh:** a scheduled job checks for tokens nearing
   expiry (Fitbit access tokens last ~8 hours) and refreshes them
   proactively, before they're needed by an incoming webhook.
5. **Viewing data:** the mobile app calls `GET /me/biometrics` to
   fetch the current user's synced records and renders them on a
   minimal dashboard.

## Error Handling

- **Webhook signature verification failure:** reject and log; do not
  process the payload. This is a security boundary, not a retry case.
- **Fitbit API rate limit (429):** back off and retry via a queue
  rather than dropping the sync attempt. Rate limits are per-user, so
  one user's backoff must not block others.
- **Token refresh failure (revoked/expired refresh token):** mark the
  `FitbitConnection` as `disconnected` and surface a "reconnect your
  Fitbit" prompt in the app, rather than silently failing sync.
- **Webhook delivery gaps:** since sync relies entirely on webhooks in
  this phase, a missed webhook (e.g. transient backend downtime) means
  that data gap is only closed on the next webhook trigger or manual
  reconnect — there is no polling fallback in Phase 1. This is an
  accepted risk for this phase, revisit if it proves too lossy in
  practice.

## Testing

- **Backend:** unit tests for OAuth token exchange/refresh and webhook
  signature verification; integration tests against a mocked Fitbit
  API (auth, data fetch, webhook payloads).
- **Mobile:** component tests for the sign-in, connect-Fitbit, and
  dashboard screens.
- **Manual/device testing:** iOS-specific behavior verified via
  `vphone-cli` (Lakr233/vphone-cli) for emulated device testing ahead
  of/alongside physical device testing.

## Open Questions / Risks

- No polling fallback means sync reliability depends entirely on
  Fitbit's webhook delivery guarantees — worth monitoring in practice
  and revisiting if data gaps become a problem.
- Fitbit API rate limits are per-user (150 requests/hour/user), which
  is generous for individual sync but worth confirming doesn't become
  a bottleneck as the backend fetches data across many users
  concurrently after a mass webhook burst (e.g. many users' devices
  syncing around the same time of day).
