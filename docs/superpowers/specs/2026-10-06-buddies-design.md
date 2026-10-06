# Buddies (social foundation) — design

Growth sub-project C. Status: approved in brainstorming with the owner on 2026-10-06.
Design source: the growth canvas https://claude.ai/artifact/JHqksi4S4DpFXNiFJho97e — screens 2 (Buddy list),
2a (A buddy's week), 2b (Pair up), 2c (Nudge settings); all liked by the owner. Screen 2d (Crew) moves to E.

## 1. Goal

Let people pair up one-to-one as **buddies**, see each other's mood (and, by choice, a few numbers), and cheer each
other on with stickers — a private, low-pressure social layer that D (invites/outfits) and E (group challenges)
build on.

Success: two people can pair in under a minute (code or @handle), see exactly what the other chose to share and
nothing more, send stickers, and get notified — with silent controls (mute, unpair, block) and no way to learn
anything about someone who hasn't paired with you.

Owner decisions:
- **Scope:** one-to-one buddies. Crew (named groups + shared streak + feed) moves to E, which needs groups anyway.
- **Sharing:** once paired, buddies always see your **mood** and **coach**. Five numbers are separate switches, all
  **off** by default, one set for all buddies: **recovery score, sleep score, hours slept, steps, streaks & badges**.
  Turning the first one on asks for a one-time versioned consent.
- **Notifications:** push **with names** ("Sam sent you a Cheer"); data stays id-only; quiet hours + per-buddy mute.
- **Identity:** a unique **@handle** plus a **display name**; email never shown.
- **Pairing:** a **buddy code** (24 h, instant) or a **request to an exact @handle** (must be accepted). No search.
- **No buddy limit.** The buddy list pages; rate limits carry abuse protection.
- **Approach A:** the server builds each buddy's view on request from data it already has; nothing about a buddy is
  copied or stored for sharing.
- Defaults the owner accepted: silent unpair / mute / block; stickers only (no free text); buddy data never reaches
  the AI coach; Buddies lives on Home (row) and Profile (settings), no new tab.

## 2. Identity

- `User.handle` — unique, case-insensitive (stored lowercase), 3–20 chars `[a-z0-9_]`, not in a reserved list
  (admin, support, biometrics, help, official, team, root, system, null, undefined, me, you, buddy, buddies).
- `User.displayName` — 1–30 chars after trimming; control characters removed.
- Both are set the first time the user opens Buddies (a setup screen); display name prefilled from the sign-in
  provider's first name. Editable in Profile.
- Handle change: the old handle is held for 30 days (`HandleHold` row) so nobody else can claim it; requests to a
  held or unknown handle get the generic "not found".
- Until a handle is set, the user can't send/accept requests or create/redeem codes (they can still view settings).

## 3. Data

All new tables cascade on user deletion and are covered by the deletion guard. Two-sided tables (pair, request,
sticker, block, mute) reference both users with cascade on BOTH foreign keys; a dedicated test proves deleting
either side removes the row (the existing guard only checks single `userId` tables).

- `BuddyPair` — `id`, `userAId`, `userBId` (stored with `userAId < userBId`), `createdAt`;
  `@@unique([userAId, userBId])`.
- `BuddyRequest` — `id`, `fromUserId`, `toUserId`, `status` (PENDING | ACCEPTED | DECLINED | CANCELLED | EXPIRED),
  `createdAt`, `respondedAt`; at most one PENDING per ordered pair; PENDING requests expire after 14 days (treated as
  EXPIRED on read and swept lazily).
- `BuddyCode` — `code` (8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`), `ownerId`, `createdAt`, `expiresAt`
  (+24 h), `usedAt`, `usedById`; one active code per owner (creating a new one invalidates the old).
- `BuddyBlock` — `blockerId`, `blockedId`, `createdAt`; unique pair.
- `BuddyMute` — `userId`, `buddyId`, `createdAt`; unique pair; never visible to the muted person.
- `Sticker` — `id`, `fromUserId`, `toUserId`, `kind` (CHEER | HEART | REST_UP | STAR), `sentAt`, `seenAt`.
- `BuddyActivity` — the in-app Activity list: `id`, `userId` (recipient), `kind` (STICKER | REQUEST | PAIRED |
  BUDDY_BADGE), `actorId`, `refId` (sticker / request / achievement id), `createdAt`, `seenAt`.
- `User` gains: `handle`, `displayName`, `shareRecovery`, `shareSleepScore`, `shareHoursSlept`, `shareSteps`,
  `shareStreaks` (all false), `buddySharingConsentVersion` + `buddySharingConsentAt` (nullable),
  `notifyBuddyStickers`, `notifyBuddyBadges` (both true).
- `HandleHold` — `handle`, `releasedAt` (old handle held until releasedAt + 30 days).

## 4. Rules

- **Pairing by code:** redeeming a valid, unexpired, unused code that isn't your own pairs you at once (marks the
  code used). Invalid, expired, used, own, blocked-either-way → the same generic `code_invalid`.
- **Pairing by request:** `POST` to an exact handle. Unknown/held handle, the target blocked you, or you blocked
  them → the same generic `not_found`. Already buddies → success no-op. If the target already has a PENDING request
  to you, the two are paired in one step (crossed requests).
- **Accept / decline / cancel:** only the recipient accepts/declines; only the sender cancels; double-tap is a no-op.
- **Unpair:** either side, silent. Deletes the pair, stickers between the two, and both users' Activity items about
  each other; closes any pending requests between them.
- **Block:** unpairs (as above), cancels requests both ways, invalidates the blocked person's ability to pair or
  request; the blocked person is told nothing. Unblock is available in Profile.
- **Mute:** stops pushes from that buddy; Activity still records; the buddy can't tell.
- **Stickers:** only between buddies; at most **5 per buddy per day** (counted in the database, sender's local day);
  a sticker sent while the pair is removed is dropped.
- **Rate limits** (Redis, per user, every call timeout-bounded like the badge marker): code redemption **10 per
  hour**; new requests **50 per day**; outgoing PENDING requests **≤ 20** (database count). If Redis fails, code
  redemption and requests **fail closed** (`try_later`); the sticker limit doesn't need Redis.
- **No limit** on the number of buddies.
- **Privacy:** every buddy response is built from (viewer, buddy) and the buddy's current switches at request time.
  A number whose switch is off never appears in any response, mood line, notification or log. Buddy data is never
  sent to the AI coach; any coach bubble on buddy screens is fixed template text.

## 5. What a buddy sees

- **Mood:** from the buddy's latest RECOVERY `DailyScore` for their own local today, else yesterday; banded with the
  server's score bands (the config the app already uses): excellent/good → `good`, fair → `ok`, poor → `low`.
  No recovery score in the last 2 local days → `none` ("No data yet").
- **Mood line** — fixed templates, only from shared items: `good` "Well rested", `ok` "Doing okay", `low` "Running low
  today", `none` "No data yet"; plus, only when the switch is on, " · on a N-night streak" (streaks: the buddy's
  current Sleep goal streak from Achievements, shown when ≥ 3) and " · moved a lot yesterday" (steps: yesterday's steps
  ≥ `STEPS_GOAL`).
- **Buddy list** (`GET /me/buddies?cursor=`): 30 per page, ordered by latest activity between you (sticker, pairing)
  then pairing date; each row: display name, handle, coach id, mood, mood line, unseen-sticker flag. One batch query
  per page for moods/numbers.
- **A buddy's week** (`GET /me/buddies/:buddyId`): today's mood + mood line, 7 daily mood tiles, then one row per
  shared number with the daily values for those 7 days (recovery score, sleep score, hours slept, steps), the buddy's
  badge levels (Achievements) if streaks are shared, "Sam shares mood and sleep" summary, sticker buttons, and a menu
  (mute, unpair, block). 404 if not buddies.

## 6. Notifications

New push kinds in the closed push table (`coach/push.ts`), data id-only (`{kind, refId}` validated by allowlist):

| Kind | Text | Setting |
|---|---|---|
| `buddy_sticker` | "{name} sent you a {Sticker}" | `notifyBuddyStickers` |
| `buddy_request` | "@{handle} wants to be your buddy" | always |
| `buddy_paired` | "You and {name} are now buddies" | always |
| `buddy_badge` | "{name} reached {Badge level}" (e.g. "Sleep goal streak II") | `notifyBuddyBadges`, only if the sender shares streaks |

- `{name}` is the display name, length-capped and sanitised; pushes never contain health numbers.
- Muted buddy → no push. **Quiet hours** (recipient's bedtime goal → wake goal, else 22:00–07:00, recipient's zone,
  across midnight) → push skipped, not delayed.
- Every event also writes a `BuddyActivity` row; the Buddies screen shows an Activity list with an unseen dot.
- `buddy_badge` fires when Achievements awards a new level to a user who shares streaks: one push per buddy per level
  (deduped), hooked after the award insert.
- Tapping a push opens the relevant screen (buddy's week, requests, or Activity).

## 7. App

- **Home:** a Buddies row (up to 5 coach sprites with mood dots + "See all"); hidden until the user has a buddy or a
  pending request; tap → Buddies screen.
- **Buddies screen:** the paged list, pending requests (accept / decline), Activity, "Add a buddy" → Pair up.
- **Pair up:** your code (create / share via the system share sheet / expiry countdown), enter a code, or request by
  @handle; first-time setup of handle + display name if missing.
- **Buddy's week:** as §5, stickers, menu.
- **Profile:** handle + display name (edit), "Shared with buddies" switches (with the consent sheet on first enable),
  notification settings (stickers, buddy badges), blocked people (unblock).
- Old backend (404 on any buddies endpoint) → all buddy UI hidden.

## 8. Edge cases

- Buddy's local day for mood; viewer's zone for quiet hours.
- Buddy with no data → `none`, shared number rows empty.
- Concurrent code redemption: one wins (conditional update on `usedAt IS NULL`), the other gets `code_invalid`.
- Crossed requests resolved in one transaction; repeated accept is a no-op.
- Switch turned off → next request excludes it everywhere; no cached copies exist.
- Handle change → buddies see the new handle; old handle held 30 days.
- Account deletion → all social rows on both sides; coach-data deletion → social data untouched.
- Logs: ids and event names only.

## 9. Testing

- Backend unit: handle/name validation and reserved list; mood bands incl. `none`; mood-line templates never include
  an unshared item; buddy-view builder per switch; quiet hours across midnight; rate limiter + Redis failure (fail
  closed); code alphabet/expiry.
- Backend integration: code pairing, request pairing, crossed requests, decline/cancel/expiry, unpair, block/unblock,
  mute, identical generic errors for unknown/blocked/held, concurrency (double redeem, double accept), sticker daily
  limit, buddy list paging + ordering, buddy's week shape, push kinds sent / muted / quiet-hours skipped, buddy_badge
  dedupe, deletion cascade on both sides (dedicated test), coach-data deletion leaves social data.
- Mobile: handle setup, Pair up (code create/share/enter, request), Buddies screen (list paging, requests, Activity
  unseen dot), buddy's week (only shared rows), stickers, Profile switches + consent, notification settings,
  blocked list, Home row, push tap routing, 404 fallback.
- Dev-only seed script pairing the demo account with a second dev account and sending a sticker (refuses production
  and non-local databases, like the badge seed).

## 10. Out of scope

Crews and group challenges (E), invite links / QR / deep links / outfits (D), handle search or discovery, free-text
messages, per-buddy sharing settings, comments or reactions beyond the four stickers.
