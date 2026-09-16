# Google Health API Migration — Design

## Context

Phase 1 ("Foundation") was built and shipped against Fitbit's Web API
(`docs/superpowers/specs/2026-09-15-phase1-foundation-design.md`). During
manual device verification (Task 19 of that phase's implementation plan),
it became clear the user's actual target is the **Google Health API**
(`health.googleapis.com`) — Google's own next-generation successor to the
Fitbit Web API, unifying Fitbit, Pixel Watch, and other third-party
devices behind one API surface.

This spec replaces Phase 1's Fitbit integration with Google Health API.
It does not change anything about auth, sessions, the mobile app's
screens, or the overall architecture shape (OAuth connect → encrypted
token storage → webhook-driven sync worker → biometrics API) — those all
carry over. What changes is which third-party API the connect/sync layer
talks to, and the naming that currently says "Fitbit" throughout that
layer.

## Decisions Made (confirmed directly with the user — not open for
reconsideration in this spec)

- **Full replacement, not dual-provider.** Google Health API replaces
  Fitbit's Web API entirely. There is no "pick a provider" step for the
  user, and no Fitbit code path remains after this migration.
- **Full rename, not a field-repurpose.** `fitbit/` (backend module),
  `FitbitConnection` (Prisma model), `FITBIT_*` (env vars), and all
  Fitbit-specific naming become generic `health`/`HealthConnection`/
  `GOOGLE_HEALTH_*` naming. The code should describe what it does, not
  carry the name of a provider it no longer talks to.
- **Connecting Google Health stays a separate step from signing in**,
  even for a user who signed in with Google. Sign-in (proving identity,
  already built, unaffected by this spec) and connecting a health data
  source (granting data-access scopes) remain two distinct OAuth flows,
  mirroring the existing connect-flow pattern. This also means a user who
  signed in with Apple can still connect Google Health.

## Goals

- Replace every Fitbit-specific piece of the sync pipeline (OAuth,
  webhook subscription, metric fetching) with the equivalent Google
  Health API integration, preserving the existing guarantees from the
  Phase 1 spec: encryption at rest, webhook-only sync (no polling
  fallback), gap-scoped reconnect backfill, `BiometricRecord` never
  deleted on disconnect, queue-only external API calls.
- Rename the codebase's Fitbit-specific identifiers to generic
  health-provider naming.
- Support the same four metrics: HRV, resting heart rate, sleep, steps.

## Non-Goals

- No dual-provider support (Fitbit is fully removed, not kept as a
  fallback).
- No changes to sign-in, sessions, the mobile app's screen structure, or
  the biometrics API's external shape (`GET /me/biometrics`,
  `GET /me/connection` keep their existing request/response contracts —
  only what populates them changes).
- No support for other Google Health API capabilities beyond the four
  existing metrics (e.g. nutrition, exercise sessions, paired-device
  management) — out of scope for this migration, same as Phase 1's own
  metric scope.

## Architecture

Unchanged from Phase 1's shape: Express backend, Prisma/Postgres,
BullMQ/Redis sync worker, React Native/Expo mobile app. The only
architectural change is internal to the connect/sync layer:

- **OAuth**: Google's standard OAuth 2.0 endpoints
  (`accounts.google.com/o/oauth2/v2/auth` for authorization,
  `oauth2.googleapis.com/token` for code exchange and refresh) replace
  Fitbit's `fitbit.com`/`api.fitbit.com` OAuth endpoints. Credentials
  come from a Google Cloud Console project instead of a Fitbit developer
  app.
- **Identity**: Google Health API identifies a user via a `healthUserId`
  string (via a `GET .../identity` call), replacing Fitbit's 6-character
  user ID. `HealthConnection.healthUserId` replaces
  `FitbitConnection.fitbitUserId`.
- **Data fetch**: one unified endpoint pattern,
  `GET /v4/users/{healthUserId}/dataTypes/{dataType}/dataPoints`,
  replaces Fitbit's four differently-shaped per-metric endpoints. This
  likely *simplifies* the metric-fetching client relative to Phase 1's
  `fitbit/client.ts`, which needed a per-metric-type switch statement to
  handle four different response shapes.
- **Webhooks**: a two-level subscription model —
  a project-level "subscriber" (the webhook receiver URL, registered
  once, analogous to Fitbit's single app-wide webhook config) plus
  per-user "subscriptions" (created on connect, deleted on disconnect) —
  replaces Fitbit's single-level per-user subscription. This is one
  extra one-time setup step (registering the subscriber) beyond what
  Phase 1 built.

## Data Model Changes

Prisma schema renames (new migration, not a fresh `User`/session-related
change — those tables are untouched):

- `FitbitConnection` → `HealthConnection`
- `FitbitConnection.fitbitUserId` → `HealthConnection.healthUserId`
- `FitbitConnectionStatus` enum: unchanged values (`CONNECTED`/
  `DISCONNECTED`), renamed type if needed for consistency.
- `encryptedAccessToken`/`encryptedRefreshToken`/`tokenExpiresAt`/
  `webhookSubscriptionId`/`status`/`lastSyncedAt`: unchanged shape,
  carried over as-is (these are provider-agnostic).
- `BiometricRecord`: unchanged. Metric types (`HRV`/`RESTING_HR`/`SLEEP`/
  `STEPS`) unchanged — same four metrics, different upstream source.

## Data Flow

1. **Connect**: `GET /health/authorize` (renamed from
   `/fitbit/authorize`) stays behind session auth, keeps the existing
   Redis-backed single-use state-token mechanism (built and hardened
   during Phase 1's final review — this part needs no changes). Redirects
   to Google's OAuth consent screen with Health API scopes instead of
   Fitbit's authorize URL.
2. **Callback**: `GET /health/callback` (renamed from
   `/fitbit/callback`) keeps the existing state-token verification
   (unauthenticated, resolves identity from the consumed state token —
   this logic is provider-agnostic and carries over unchanged). Exchanges
   the code via Google's token endpoint instead of Fitbit's, resolves
   `healthUserId` via the identity endpoint, registers the per-user
   webhook subscription (against the pre-registered project-level
   subscriber) before writing the connection as `CONNECTED` — same
   ordering fix from Phase 1's final review, still required here since
   the same failure mode applies.
3. **Backfill**: unchanged shape (30-day window on first connect,
   gap-scoped on reconnect) — only the underlying fetch calls change to
   hit the new unified data-points endpoint per metric type.
4. **Ongoing sync**: webhook notification → sync worker fetches the
   specific data type/date via the new unified endpoint → same
   `upsertBiometricRecords` write path (unchanged).
5. **Token refresh**: same distributed-safe BullMQ repeatable job from
   Phase 1's final review, now calling Google's token-refresh endpoint
   instead of Fitbit's.
6. **Disconnect**: delete the per-user subscription, mark
   `HealthConnection.status = DISCONNECTED` — same as Phase 1, plus the
   narrowed catch behavior from the final review (only an actual token
   refresh failure disconnects, not an unrelated DB-write failure).

## Verification Needed Before Detailed Task Planning

The following facts are **not confirmed** from documentation alone and
must be resolved via hands-on exploration against a real Google Cloud
Console project before the implementation plan can specify exact code:

- Exact OAuth scope string(s) required for read access to heart rate,
  resting heart rate, sleep, and HRV data types (only one example scope,
  for exercise, was found in Google's codelab).
- Exact `dataType` identifier strings for HRV, resting heart rate, sleep,
  and steps (the reference confirms these data types exist as a category
  but not their literal string identifiers).
- Query parameter names and date/time format for the `dataPoints` list
  endpoint (Fitbit used `YYYY-MM-DD` path segments; Google's API likely
  uses RFC3339 timestamps as query parameters, given the endpoint shape,
  but this is unconfirmed).
- The `healthUserId` resolution pattern — whether there's a "me"-style
  shorthand (Fitbit used `-` as a wildcard for "the authenticated user")
  or whether the identity endpoint must always be called explicitly.
- The webhook payload schema (what a notification actually contains) and
  its verification/authentication mechanism (Fitbit used an HMAC-SHA1
  signature header; Google Cloud push subscriptions commonly use a
  bearer JWT or OIDC token instead — this is a materially different
  verification mechanism and needs confirming before webhookVerify-
  equivalent code can be written correctly).
- Confirmation that Google Cloud Console access to this API is actually
  available for the user's project (the user has confirmed they can get
  access, but the concrete setup steps — enabling the API, configuring
  the OAuth consent screen, generating credentials — haven't been walked
  through yet).

**This spec deliberately does not guess at these facts.** The
implementation plan's first task will be a hands-on exploration step
(Cloud Console setup + a handful of real API calls) to pin down every
item above with evidence, before any other task is written in detail —
the same lesson Phase 1's final review surfaced when a guessed webhook
collection-type mapping needed a late fix.

## Error Handling

Unchanged from Phase 1's hardened behavior (all carried over as
provider-agnostic patterns): split try/catch for auth-failure vs.
internal-failure responses, subscription-registration-before-CONNECTED-
write ordering, narrowed disconnect-on-refresh-failure-only catch,
in-flight refresh coalescing on the mobile client, `skipAuth` on
non-retryable auth endpoints, distributed-safe token refresh via BullMQ
repeatable job.

## Testing

Same testing shape as Phase 1: unit tests for OAuth token exchange/
refresh and webhook verification (once the real verification mechanism
is confirmed), integration tests against a mocked Google Health API
(via `nock`, same tooling already in place), mobile component tests
unchanged in shape (only the screen names/copy referencing "Fitbit"
need updating to generic "connect your health data" language).

## Open Questions / Risks

- Whether the Google Health API's rate limits and subscription quotas
  differ meaningfully from Fitbit's in ways that affect the sync worker's
  concurrency settings (currently 5, tuned for Fitbit's documented
  limits) — worth revisiting once real usage patterns are known, not
  blocking for initial migration.
