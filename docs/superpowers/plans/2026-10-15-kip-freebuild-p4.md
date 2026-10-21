# KIP Free-build P4 (visits, gifts, challenges and share) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KIP's room becomes social: buddies who opted in can visit each other's rooms and cheer them (a cheer pays
both people 2 coins, inside the 5 paid cheers a day), send each other spare pieces as gifts, enter a weekly theme
challenge that their own buddy circle judges (an entry pays 30 coins once, the most-cheered room wins a glowing
trophy), and anyone can make a share card of their room. This plan ships **P4** of the free-build spec: §10.1–§10.5,
the P4 rows of §12 and §13, the challenge pieces and trophies of release 6, the cheer coins and the first-week cheer row
that P2 left for P4, and §16's P4 tests.

**Architecture:**
- **Backend** (Tasks 1–7):
  - one migration, `20261018120000_social_rooms`: `User.shareRoom`, `RoomCheer`, `Gift`, `ChallengeEntry`,
    `ChallengeCheer`; deletion follows the controller ruling (a gift **from** a deleted user still delivers, `SetNull`;
    a gift **to** a deleted user drops, `Cascade`);
  - `buddies/sharing.ts` gains the sixth key `room` with its own consent (no health-consent version);
  - `coins/ledger.ts` gains the **two-user sorted lock** (`lockUsers`) and an in-transaction writer (`writeEarnsTx`),
    so a cheer pays both sides in one transaction that can never deadlock;
  - `cosmetics/catalogue.ts` gains release 6 (four theme pieces, four trophies), challenge tags and the `prize` unlock;
    `challenges/themes.ts` is the server-side calendar;
  - `room/visit.ts` (visits and room cheers), `room/gifts.ts` (gifts), `challenges/*` (entries, entry cheers,
    judging) and their router `room/socialRoutes.ts`.
- **Mobile** (Tasks 4, 8–12):
  - `api/rooms.ts`; the room switch in Profile with its own consent sheet;
  - `BuddyRoom` (a read-only visit drawn with `NEUTRAL_LIVING`, the fallback sky and the visitor's clock), cheers,
    "Pieces you don't have";
  - gifts: `GiftSend`, the gift boxes on the KIP page's room card, the room's cheers sheet;
  - `RoomChallenge` (brief, entry, the circle's entries and cheers, results) and the drawer's theme tab with its
    checklist;
  - `ShareRoom`, the 1080-px share card through `lib/recapCapture.ts`.
- **Verification** (Task 13): full suites, the final review, the DB backup, the run-folder sync (one migration, no
  native module, so no iOS rebuild), the dev backend with `COINS_LAUNCHED_AT`, and the simulator check.

**Tech Stack:**
- Backend: Express 5, Prisma 6 / Postgres, Jest with supertest, ts-node for scripts. **One migration.**
- Mobile: Expo 57 / React Native 0.86 / React 19.2 with NativeWind, React Navigation 7 (native stack),
  `@shopify/react-native-skia` 2.6.2 (`makeImageFromView`), `expo-sharing`, `expo-media-library/legacy`,
  `expo-crypto` (request ids). **No new dependency and no native module.** Jest 30 with React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-kip-freebuild-design.md` (binding; this plan implements its **P4** row of
§14: §10.1–§10.5, §2.1's `tags` and release 6, §2.2's gift and prize grants, §6.2's cheer and entry rows, §11.2's cheer
row, the P4 rows of §12 and §13, the telemetry lines `gift.sent` and `challenge.entered`, and §16's P4 tests; the
controller rulings of §0 on opt-in visits, entry snapshots and gifts with deleted accounts).
- Built base: P3 on `feature/kip-freebuild-p3` 3e6e6c5 (draft PR #69), on P2 (#68), P1 (#67) and Specs A and B
  (`feature/kip-room`). This plan builds against that real code; where the spec and the code differ, a ruling below
  says which way.
- Binding ledgers: `.superpowers/sdd/2026-10-15-kip-freebuild-p{1,2,3}/progress.md`. Every `Ruling:` line in them binds
  P4 unless a ruling below supersedes it (Task 0 copies them into P4's ledger).
- Visual sources in `docs/design/freebuild/project/`: `C3.dc.html` (weekly theme challenge: brief, build, results),
  `C4.dc.html` (visit and gift), `F8.dc.html` (show off: visits, the share card), generator `docs/design/freebuild/gen/c3.py`
  (the Harvest lantern, the Golden acorn, "Warm pieces · 2 of 3").
- Out of this plan: push notifications for cheers, gifts or coins, public rankings, typed notes, anything on the
  frozen Campfire (spec §17).

## Global Constraints

- **Branch:** `feature/kip-freebuild-p4`, in the worktree
  `/Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab`, cut from P3's head 3e6e6c5; this plan's
  commit sits on top.
  - Never `cd` to another repo root, never switch branches, never push to main, never force-push, never bare
    `git stash`.
- **Commits:** plain conventional messages with `git commit -m "…"`: **no `Co-Authored-By` trailer and no mention of
  Claude, Cursor or AI** (owner rule; it applies to every subagent). A PR body carries no attribution footer either.
- **Subagents** run on model **opus**.
- **Every task keeps both full suites green at its commit.** Run the touched tests while working. Before the commit,
  run the full mobile suite, both typechecks and, for a task that touches `backend/`, the full backend suite. Task 4
  regenerates `mobile/src/lib/room/catalogue.json` and `mobile/src/lib/room/iso/geometry.ts`, so it runs both.
- **Mobile commands**, from `mobile/`:
  - `export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH`
  - Tests: `node node_modules/.bin/jest --forceExit <paths>`. With no paths it runs the full suite.
  - Typecheck: `node node_modules/.bin/tsc --noEmit --types jest,node --pretty false | grep -c "error TS"`. The
    baseline is **10** (P3 ledger, Task 14); Task 0 measures it again on 3e6e6c5. No task may add an error.
- **Backend commands**, from `backend/`. Never run two backend test runs at once, never point tests at the dev
  `biometrics` DB, and never print a database URL.
  - Tests go only through `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh <paths>` (Task 0 copies it).
  - A suite that fails or SIGSEGVs under full-suite load is rerun alone before it is treated as real (P2 ledger: the
    "Can't reach database server" failures are environmental).
  - Typecheck: `node node_modules/.bin/tsc --noEmit -p .` must report **0** errors.
  - After a schema change: `DATABASE_URL=postgresql://x@localhost/x npx prisma generate`, and
    `bash .superpowers/sdd/2026-10-15-kip-freebuild-p4/schema-drift.sh` must print `no drift` once the migration is in.
  - Scripts run with `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/<name>.ts`; the catalogue
    export is `scripts/export-cosmetics.ts`.
- **Owner-accepted defaults and controller rulings (spec §0), verbatim:**
  - "**Room visits are opt-in:** a new switch in the existing buddy sharing set, **off by default**, with its own
    one-line consent ("Buddies see your room, including its size."), not the health-sharing consent (§10.1)."
  - "**Entering a challenge** is the opt-in for that entry's snapshot being shown to buddies (§10.4)."
  - "**Challenge judging:** the most cheers in your own circle, ties all win, no ranking under 3 entries, results on the
    first read after Monday 08:00 UTC (§10.4)."
  - "**Coin amounts and prices** are C8's as written (… cheer 2, entry 30, cap 60 …)": cheer **2**, challenge entry
    **30** (uncapped, once a week), daily cap **60**, **5 paid cheers a day**, given and received together.
  - "**Gifts and deleted accounts:** a gift sent before the gifter deletes their account is still delivered (the piece
    comes from the catalogue, not the gifter's data). Unopened gifts **to** a deleted user are dropped (§10.3)."
  - Earn-only: nothing is ever sold for real money, there are no ads and no shipping timers. **Gifts are pieces the
    gifter owns, never bought with money; coins are never gifted.**
- **Buttons:** use shadcn-style `<Button>` only (`mobile/src/components/ui/button.tsx`): `rounded-lg`, never pills, at
  least 44 pt (`h-[44px]`, `min-h-[44px]` or `size-[44px]`). Tabs, tags and chips are `Button`s or `rounded-lg` views.
  This plan adds **no** raw `Pressable` with a button role, so `__tests__/conventions/buttons.test.ts` gets no new
  entry. The room switch is React Native's `Switch`, as the five sharing switches are.
- **Type:** A4 type tokens only (`text-score`, `text-number`, `text-display`, `text-heading`, `text-headline`,
  `text-body`, `text-caption`, `text-fine`, `text-page-title`, `text-label`). Pixel labels use `font-pixel text-label`.
  No inline `fontSize` / `fontFamily`, no arbitrary `text-[..px]`. Tabular numbers use the `tabular-nums` class.
- **Copy:**
  - All room, visit, gift, challenge and share-card copy goes in `ROOM_COPY` (`mobile/src/lib/room/roomCopy.ts`) under
    `visit`, `gifts`, `challenge` and `share`; the sharing switch's title, hint and consent line and the new error
    lines go in the existing social copy file `mobile/src/lib/buddyCopy.ts` (P2 ruling 10, ruling 19 below).
  - Spoken labels contain no "·" (U+00B7), no "−" (U+2212), no "×" and no Roman numerals.
  - The product name is **KIP** in capitals; `__tests__/conventions/kipCopy.test.ts` stays green.
  - No currency symbol, no price in money, no "get more coins" or ad copy (P2's `earnOnly` guard stays green). Visit,
    gift and challenge copy never gives health advice: Task 11's guard scans `ROOM_COPY.visit`, `.gifts` and
    `.challenge` for a sentence that opens with a health verb (P3 ruling 18's list) and for health words (sleep hours,
    steps, scores). "Use 3 or more warm pieces" is a count of pieces, not advice (as P3 ruling 18 kept "Needs 40 more").
- **Privacy and logging (spec §0, §12):**
  - Logs carry event names and counts only: never a user id together with item ids, layouts, coins or counts. P4 adds
    exactly two lines, `{ event: 'gift.sent' }` and `{ event: 'challenge.entered' }`, with no other field; the
    ledger's existing `coins.earned { kind, count }` covers cheers and entries. The pre-existing lines that carry a
    `userId` (`achievements.awarded`, `social.step_goal_failed`) are not touched and **no new line carries one**.
  - Health values never appear in logs, and **nothing health-linked appears on a visit, an entry or the share card**:
    no `living`, no health band, no badge, no tier name, no balance, no counts. A visitor sees the room's layout, its
    size and KIP's colour and outfit only. Tasks 5 and 7 assert the absence of `living`, `tier`, `counts`, `balance`,
    `badges` and every health number in their bodies.
  - Nothing cosmetic reaches the coach or the model: `backend/tests/room/noCoachImport.test.ts` already fails on a
    `src/coach/` import of `cosmetics/`, `room/`, `coins/` or `challenges/`; it stays green.
- **Consent:** the room switch is part of the existing buddy-sharing set (`/me/buddies/sharing`), stored in
  `User.shareRoom`, **off by default**, turned on through its own one-line confirm sheet, and never gated on or reset
  by `BUDDY_SHARING_CONSENT_VERSION`.
- **Account deletion:** every new user-owned model goes in `USER_OWNED_MODELS` (`backend/src/users/deletion.ts`) and
  `tests/users/ownedData.ts`; P4's only one is `ChallengeEntry`. The two-sided tables `RoomCheer`, `Gift` and
  `ChallengeCheer` go in `SOCIAL_MODELS` / `SOCIAL_USER_COLUMNS` (`backend/src/buddies/models.ts`), with `Gift.fromId`
  in `SET_NULL_COLUMNS` and every other role column `Cascade`.
- **Dates and times:** civil dates only through the existing helpers (`localCivilDateOrUtc`, `todayFor`,
  `civilDateToUtcMidnight`, `localMidnightInstant`, `shiftDate`, `isoWeekKey`); never `new Date('YYYY-MM-DD')` in
  the app. Backend constants use a full ISO instant with `Z`.
- **Frozen files:** `mobile/src/components/social/CampScene.tsx` and `CampBanner.tsx` stay frozen
  (OVERRIDE-P13), and the Campfire gets no visit entry point. Task 13 checks `git diff 3e6e6c5 -- <both>` is empty.
- **Screen readers (house patterns):** a change is announced with `AccessibilityInfo.announceForAccessibility` on iOS
  only, with a polite `accessibilityLiveRegion` for Android; a sheet or a modal route takes focus with
  `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref))` on its title when it opens, and an RN sheet hides
  what is behind it on Android with `importantForAccessibility="no-hide-descendants"` (iOS: `accessibilityViewIsModal`),
  as `CoinShopScreen.tsx` and `PieceCardScreen.tsx` do. A room drawn on a visit, an entry or the share card is one
  image with one label.
- **Shared test fixtures** live in `mobile/jest-mocks/` and `backend/tests/**/helpers.ts`, never as `__tests__` files.
- **Skia in Jest:** `@shopify/react-native-skia` is mocked by `mobile/jest-mocks/skia.js`; `RoomView` has the stand-in
  `jest-mocks/RoomView.js`. No test loads the real Skia module.

## Plan rulings (made while writing the plan)

1. **Release 6 and its date.** `SHIPPED_RELEASES = {1, 3, 4, 5, 6}`; the eight challenge pieces are `release: 6`;
   `RELEASE_LAUNCHED_AT[6]` is `2026-10-26T00:00:00.000Z` (a Monday, ISO week 2026-W44). OWNER NOTE: set to the real
   ship date at merge, as P1–P3's dates are.
2. **The challenge pieces.** Four **theme pieces**, coin shop only (`'C'`), 80 coins each, sold only in their theme's
   weeks (ruling 4): `lamp.harvest` "Harvest lantern" (glows), `plant.ivy` "Trailing ivy", `lamp.moon` "Moon lamp"
   (glows), `item.organiser` "Desk organiser". Four **trophies**, a new unlock kind `{ kind: 'prize' }` (catalogue
   code `'P'`), never sold, never granted by a rule, only by a `prize:{weekId}` grant, each glowing at night:
   `corner.acorn` "Golden acorn", `corner.can` "Golden watering can", `corner.owl` "Silver owl", `item.goldpen`
   "Golden pen pot". All eight are front-on billboards (P1 ruling 3), 1 × 1, `facings: 1`, on the floor or a surface.
3. **Challenge tags** are derived in the catalogue, not typed per piece: `warm` (a fixed list: the pumpkin, the candle,
   the amber and salt lamps, the welcome lantern, the floor lamp, the red rug, the mug, the Harvest lantern and the
   Golden acorn), `plant` (every `plant` slot item), `glow` (every `emissive` item), `desk` (every `desk_item` slot
   item). `'funny'` stays as P1 left it. A piece counts toward a brief once per placement.
4. **The calendar** (`backend/src/challenges/themes.ts`): four themes, one a week, rotating from **2026-W44** by whole
   weeks (the shop's `weekSet` arithmetic, exported as `weekNumber`): W44 Cosy autumn (`warm` ≥ 3, Harvest lantern,
   Golden acorn), W45 Green thumb (`plant` ≥ 4, Trailing ivy, Golden watering can), W46 Night owl (`glow` ≥ 3, Moon lamp,
   Silver owl), W47 Tidy desk (`desk` ≥ 3, Desk organiser, Golden pen pot), then again. Before W44 there is no
   challenge. A theme piece carries `shop: 'theme'` (a new variant beside `'always'` and `{ week }`): offered only in a
   week whose theme names it.
5. **The week and its close.** `weekId` is the entrant's local ISO week (`isoWeekKey` of `todayFor`'s date). An entry
   closes at the entrant's **Sunday 20:00 local**, computed as `localMidnightInstant(next Monday, tz) − 4 h` (exact in
   every zone whose clocks do not change between Sunday 20:00 and Monday 00:00, which is every zone's current rule).
   Results of a week are read from **Monday 08:00 UTC** of the following ISO week (`resultsAt`).
6. **The circle, frozen at the close.** `ChallengeEntry.circle` (a JSON array of user ids) holds the entrant's current
   buddies, rewritten at entry, at every room save and at every `GET /me/challenge` while the entry is open; the last
   write before the close stands. Judging counts the entries of that week by the entrant and the circle ids. The
   entrant **wins** iff that set holds **at least 3** entries and the entrant's cheers are **≥** every other's (ties all
   win). Judging is lazy and once per entry (`ChallengeEntry.judgedAt`), run by `GET /me/challenge` and
   `GET /me/cosmetics` after `resultsAt` (never failing the read); a win writes `ItemGrant +1 prize:{weekId}` (unique).
7. **The entry is the room.** `ChallengeEntry.snapshot` is `{ layout, size: { n, m } }`: the stored layout as every
   read shows it (`readLayout`) at entry, then the saved layout at every `PUT /me/cosmetics` while open (inside the
   save's transaction). The **+30** (`challenge:{weekId}`, uncapped) is paid after the commit the first time a snapshot
   meets the brief while open, then `paidAt` is set. A pay that fails is retried by the next save or entry read (the
   key makes it idempotent).
8. **Visits.** `GET /me/buddies/:buddyId/room` answers **404 `{ error: 'not_found' }`** for a malformed id, oneself,
   not buddies, a block either way, or visits off: one body for every reason. The body is
   `{ name, layout, size, kipColour, kipWorn, cheersThisWeek, cheeredToday }` (spec §12 plus `name`, the buddy's
   display name, which a buddy already sees). `cheersThisWeek` counts room cheers whose day lies in the owner's local
   ISO week. `BuddyWeekDTO` gains `roomOpen: boolean` (the owner's switch, nothing else), so the profile shows **Visit
   room** only when it would open.
9. **Room cheers** need an open visit (you cheer what you see). One transaction: both users' room locks in id order
   (`lockUsers`), the visit re-check, the `RoomCheer` insert (`P2002` → 409 `already_cheered`) and both earns
   (`cheer:{cheerId}:given` for the giver, `cheer:{cheerId}:got` for the owner, kinds `cheer_given` / `cheer_got`,
   each `capDay` that person's local date). `{ paid }` is the giver's own row being above 0. Room cheers never touch
   Spec B's `buddy_cheers` counter.
10. **Entry cheers** (`POST /me/challenge/entries/:userId/cheer`): the target must be a current buddy with no block
    either way and an entry in **the target's** current week; never your own (404 `not_found`). After the target's
    close: 409 `challenge_closed`. A second cheer: 409 `already_cheered`. Pays like a room cheer, keyed
    `ccheer:{weekId}:{fromId}:{toId}:{given|got}`.
11. **Gifts.** `Gift.id` **is** the app's `requestId` (a UUID), so a retry is the same gift: the same sender and piece
    answer 201 again with the current counts; another sender or piece is 400 `invalid_body`. Only a placeable piece
    (`iso`) may be sent; `note` is one of `'desk' | 'cosy' | 'thought'` (the app's fixed lines). Under the sender's
    room lock: buddies, no block either way, at most 3 gifts sent in the sender's local day (429 `gift_limit`), and a
    **spare**: `owned ≥ 2` and `owned − placed ≥ 1` with `placed` counted on the **stored raw layout** (`parseLayout`,
    not the read trim), else 403 `not_spare`. It writes the `Gift` and `ItemGrant −1 gift_out:{giftId}`; logs
    `{ event: 'gift.sent' }`. `POST /me/gifts/:id/open` writes `ItemGrant +1 gift_in:{giftId}` once and answers
    `{ counts }`; a returned or unknown gift is 404 `gift_gone`.
12. **Returns.** `unpair` and `block` (`buddies/relations.ts`) return every unopened, unreturned gift between the two
    inside their own transactions (`returnedAt`, `ItemGrant +1 gift_back:{giftId}` to the living sender). Account
    deletion never returns: its cascade drops gifts **to** the deleted user and nulls `fromId` on gifts **from** them.
13. **No push for gifts** (spec §17). "A muted sender's gift arrives without a notice": `GET /me/gifts` marks a gift
    `quiet: true` when the recipient muted its sender, and the KIP page shows its box but no "A gift arrived" line.
14. **Gift boxes** are drawn on the KIP page's room card as an overlay: up to 3 small pixel boxes on free front-row
    tiles (`giftTiles`), each a ghost `Button` (44 pt) labelled "Open the gift from {name}" ("Open a gift" for a deleted
    sender). They are not placements and never enter the layout or the room picture. More than 3 unopened: the line
    reads "{n} gifts"; opening one shows the next.
15. **The shop and gifts (P2 note).** `forSale` sells a rule piece only once its **unlock row** exists (it was earned),
    never because a gift or a prize gave a count; starters and shop pieces are unchanged. A gift can't take your own
    count of a piece below 1 (ruling 11), so a piece you earned stays for sale.
16. **Expand keeps hidden pieces (P3 note).** Ruling 11 keeps `placed ≤ owned` on the stored layout, so a gift never
    hides a piece. As a backstop, `expandRoom` now writes back the **raw** stored layout minus the pieces the new window
    covers (judged on the raw layout's shipped pieces), so a piece hidden only by the read trim is kept, not dropped;
    `stored` still counts only the pieces the user could see.
17. **The two-user lock** (spec §6.3): `ledger.ts` exports `lockUsers(tx, ids)` (distinct ids, sorted, `lockRoom` each)
    and `writeEarnsTx(tx, userId, events, now)` (the existing writer, made public, with `checkEarn`);
    `applyCoinEvents` keeps its behaviour and now logs through one `logEarned` helper both paths share.
18. **The cheer-row undercount gate** (spec §13, Spec B Task 3 minor): `loadUnlockFacts` pages the sticker scan
    `CHEER_SCAN_ROWS` at a time until 15 cheers are counted or the rows run out.
19. **Copy homes.** Visit, gift, challenge and share strings: `ROOM_COPY.visit`, `.gifts`, `.challenge`, `.share`. The
    room switch (`SHARE_TITLES.room`, `SHARE_HINTS.room`, `ROOM_VISIT_CONSENT`) and the new error lines: `buddyCopy.ts`.
20. **The room switch in Profile** is its own group, "Your room", under "Shared with buddies": one `Switch`
    ("Buddies can visit my room"). Turning it on opens `RoomVisitConsentSheet` (the spec's one line, **Turn on** and
    **Not now**); tapping Turn on saves `{ room: true }`. Turning it off never asks. The five health switches and their
    versioned consent are untouched. Profile's Buddies card stays "sharing n of 5" over the health keys and adds
    " · room open" when the switch is on.
21. **Entry points to a visit:** the buddy's week (`BuddyWeek`, "Visit room" when `roomOpen`) and the chat thread's
    header avatar (their KIP), which becomes a ghost `Button` "Visit {name}'s room"; a closed room answers the visit
    screen's neutral "This room isn't open for visits." Nothing on the Campfire.
22. **The challenge's entry points:** a "Room challenge" outline `Button` on the KIP page's room card while a theme is
    live, opening the `RoomChallenge` route (brief, entry, the circle's entries with cheers, last week's results); and,
    while you have an open entry, the editor drawer's theme tab (named for the theme, "Autumn") with its checklist
    ("Warm pieces · 2 of 3").
23. **The share card** opens from the editor drawer's header ("Share", next to "Coin shop" and "Room sizes"), the
    `ShareRoom` route. It shows the **saved** room (not an unsaved draft), "KIP's room", "8 × 8 · 31 pieces" plus
    " · Cosy autumn week" while a theme is live, the first word of your buddy display name only when **Show my first
    name** is on (default off; hidden when you have no name), and KIP waving when **KIP waves** is on (default on).
24. **Neutral drawing** for a visit, an entry and the share card: `RoomView` with no `living` (P3's `NEUTRAL_LIVING`),
    weather `'fallback'`, `night = isNightTime(new Date())` (the visitor's clock, `lib/home/scene.ts`), the monitor
    `'lines'`, no `live`, no `kipWalks`, no piece actions. The visit's KIP waves with "HI THERE!" in its bubble.
25. **Error codes** added to `BUDDY_ERROR_STATUS`: `already_cheered` 409, `not_spare` 403, `gift_limit` 429, `gift_gone`
    404, `challenge_closed` 409, `no_challenge` 404, `invalid_body` 400; the app adds a line for each in `buddyCopy.ts`.
26. **One migration, no native module.** `20261018120000_social_rooms`. Task 13 syncs and migrates the run folder but
    does **not** prebuild or rebuild iOS (`ios-build.sh` is copied for parity only).
27. **"Pieces you don't have"** on a visit are the placed items whose count in your own cosmetics is 0, in catalogue
    order, at most 12; tapping one shows its name and its price ("80 coins in the coin shop") or the catalogue's
    generic rule (`unlockLine`), a trophy "A weekly challenge trophy". Never "they earned …".
28. **Results** (`GET /me/challenge`'s `results`) are last week's for **your** circle: `ranked` (≥ 3 entries), the
    winners' names, every entry's name and cheer count, and `you: { entered, won }`. "{name}'s room won · The acorn
    glows on her floor at night" becomes the neutral "{name}'s room won · The trophy glows on their floor at night".
29. **Body caps.** Every P4 `POST` takes the 32 KB route parser (`saveBodyParser`, P2 ruling 26).
30. **The first-week cheer row** needs no new code: `readFirstWeek` already ticks `cheer` on a `cheer_given` event
    (P2 ruling 24); Task 5 pins it with a room cheer.

## Review Focus

1. **Two buddies cheer each other's rooms at the same instant.** Expected: both requests succeed, each user gets one
   `cheer_given` and one `cheer_got` row (+2 each while under 5 paid a day), no deadlock and no lock timeout. Pinned in
   Task 3 (`lockUsers` two transactions in opposite order) and Task 5 (two concurrent cheers through the routes).
2. **A gift sent while a room save that places the last spare copy is in flight.** Expected: exactly one wins: either
   the save lands and the gift is 403 `not_spare`, or the gift lands and the save is 403 `not_owned`; never a stored
   layout that places more copies than are owned. Pinned in Task 6 (`Promise.all` of a save and a gift on a count of 2
   with one placed).
3. **An entrant in Pacific/Auckland and one in America/Los_Angeles in the same ISO week.** Expected: each entry closes at
   its own Sunday 20:00 local; a cheer after Auckland's close is 409 `challenge_closed` for the Auckland entry but lands
   on the Los Angeles one; results appear only from Monday 08:00 UTC. Pinned in Task 7 (the two-zone close test).
4. **The gifter deletes their account before the gift is opened; the recipient deletes theirs with gifts waiting.**
   Expected: the first gift is still listed ("A gift", no name) and opens into the recipient's inventory; the second
   recipient's unopened gifts are gone and the senders get nothing back. Pinned in Task 1 (deletion) and Task 6 (open
   after the sender is gone).
5. **A buddy with visits off, or who blocked you, or who unpaired.** Expected: the visit, the room cheer and the gift
   paths give nothing away: the visit is the same 404 for each, no room data and no size is ever returned, and an
   unopened gift between the two goes back to its sender on the block or unpair. Pinned in Task 5 (the uniform 404) and
   Task 6 (returns).

## File Structure

**Backend (create):** `prisma/migrations/20261018120000_social_rooms/migration.sql`; `src/challenges/themes.ts`,
`src/challenges/week.ts`, `src/challenges/entries.ts`, `src/challenges/judge.ts`; `src/room/visit.ts`,
`src/room/gifts.ts`, `src/room/socialRoutes.ts`; tests `tests/room/visit.test.ts`, `tests/room/gifts.test.ts`,
`tests/challenges/themes.test.ts`, `tests/challenges/entries.test.ts`, `tests/challenges/judge.test.ts`,
`tests/challenges/helpers.ts`, `tests/coins/pair.test.ts`, `tests/social/roomTables.test.ts`.

**Backend (modify):** `prisma/schema.prisma`, `src/app.ts`, `src/buddies/{sharing,view,relations,errors,models}.ts`,
`src/coins/{ledger,shop,shopWeeks}.ts`, `src/cosmetics/{catalogue,facts,loadout,rules}.ts`, `src/room/expand.ts`,
`src/users/deletion.ts`; tests `tests/buddies/{sharing,deletion,week}.test.ts`, `tests/users/ownedData.ts`,
`tests/coins/shop.test.ts`, `tests/cosmetics/{catalogue,grant,export}.test.ts`, `tests/cosmetics/everShipped.json`,
`tests/room/expand.test.ts`.

**Mobile (create):** `src/api/rooms.ts`; `src/lib/room/visit.ts`, `src/lib/room/gifts.ts`, `src/lib/room/giftsStore.ts`,
`src/lib/room/challenge.ts`, `src/lib/room/shareCard.ts`; `src/lib/room/items/challenge.ts`;
`src/components/buddies/RoomVisitConsentSheet.tsx`, `src/components/room/RoomGiftBoxes.tsx`,
`src/components/room/NeutralRoom.tsx`; `src/screens/{BuddyRoomScreen,GiftSendScreen,RoomCheersScreen,RoomChallengeScreen,ShareRoomScreen}.tsx`;
tests `__tests__/lib/{roomVisit,roomGifts,roomChallenge,shareCard,challengePieces}.test.ts`,
`__tests__/screens/{BuddyRoomScreen,GiftSendScreen,RoomCheersScreen,RoomChallengeScreen,ShareRoomScreen}.test.tsx`,
`__tests__/components/{RoomVisitSwitch,RoomGiftBoxes}.test.tsx`.

**Mobile (modify):** `src/api/buddies.ts`, `src/lib/buddyCopy.ts`, `src/lib/profileHub.ts`, `src/lib/profileCopy.ts`,
`src/lib/recapCapture.ts`, `src/lib/useRecapExport.ts`, `src/lib/room/{catalogue.json,catalogue.ts,roomCopy.ts,art.ts,cosmeticsStore.ts}`,
`src/lib/room/iso/geometry.ts` (generated), `src/lib/room/edit/{editor,drawer}.ts`, `src/components/buddies/BuddiesProfileSection.tsx`,
`src/components/coach/RoomCard.tsx`, `src/components/edit/InventoryDrawer.tsx`, `src/screens/{BuddyWeekScreen,ChatThreadScreen,DecorateRoomScreen}.tsx`,
`src/navigation/{RootNavigator,navigationRef}.ts(x)`, `jest-mocks/cosmeticsFixture.ts`, and the tests named in each task.

---

### Task 0: Workspace (controller; no code)

- [ ] **Step 1:** Create the workspace with
  `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-15-kip-freebuild-p4.md`,
  so that `.superpowers/sdd/2026-10-15-kip-freebuild-p4/` exists. Copy `common-context.md`,
  `implementer-instructions.md` and `reviewer-instructions.md` from `.superpowers/sdd/2026-10-15-kip-freebuild-p3/`,
  then edit the branch (`feature/kip-freebuild-p4`), the plan name (`2026-10-15-kip-freebuild-p4.md`), the base note
  (P3 at 3e6e6c5 is the built base; only the free-build spec's P4 row is in scope) and every workspace path
  (`2026-10-15-kip-freebuild-p3` → `2026-10-15-kip-freebuild-p4`). The feature paragraph of `common-context.md`
  becomes:
  ```text
  **Feature:** KIP's free-build room, phase P4 only: room visits behind their own opt-in switch (off by default),
  room cheers that pay both people, gifts of spare pieces, weekly theme challenges judged in each entrant's own buddy
  circle with trophies (release 6), and the share card. P3 (feature/kip-freebuild-p3 at 3e6e6c5: effects, the living
  room, KIP walking) is the built base on this branch; only the free-build spec's P4 row is in scope. CampScene.tsx and
  CampBanner.tsx stay FROZEN. Nothing health-linked appears on a visit, an entry or the share card; nothing cosmetic
  reaches the coach or the model; logs never carry a user id with items, layouts, coins or counts.
  ```
- [ ] **Step 2:** Copy `backend-jest.sh`, `backup-db.sh`, `schema-drift.sh`, `sync-run.sh`, `metro-local.sh`,
  `start-backend.sh`, `start-backend-coins.sh`, `convert-test-db.sh`, `pg-conns.sh`, `pg-waits.sh`, `setup.sh` and
  `ios-build.sh` from `.superpowers/sdd/2026-10-15-kip-freebuild-p3/` into the new folder, then:
  - `backup-db.sh`: the dump name becomes `biometrics-before-kip-freebuild-p4-2026-10-15.dump` (the backup is named
    **before-kip-freebuild-p4**).
  - `sync-run.sh`: the header comment names `feature/kip-freebuild-p4`; the backend block (the conversion before
    `prisma migrate deploy`, P2 ruling 25 and PF-F2) is unchanged. P4 has one migration, so the deploy applies
    `20261018120000_social_rooms` and the conversion answers `converted: 0`.
  - `metro-local.sh`: the screenshot folder becomes `.superpowers/sdd/2026-10-15-kip-freebuild-p4/shots`.
  - `start-backend-coins.sh` keeps `COINS_LAUNCHED_AT=2026-10-01T00:00:00.000Z` (so cheers and the entry pay coins in
    the simulator check before the real coins launch) and also exports `CHALLENGE_NOW=2026-10-28T12:00:00.000Z` (a
    Wednesday of 2026-W44, so the challenge routes run a theme week before the real first one; Task 7's
    `challengeClock` reads it; dev only).
  - `ios-build.sh` is kept for parity only, with its comment changed to
    `# Not run in P4: no native module was added (plan ruling 26). Kept so a later phase can reuse it.` and its log
    files renamed `/tmp/kip-p4-*.log`.
  - `mkdir -p .superpowers/sdd/2026-10-15-kip-freebuild-p4/shots`.
- [ ] **Step 3:** Set up and measure: `cd backend && DATABASE_URL=postgresql://x@localhost/x npx prisma generate`,
  then confirm `node node_modules/.bin/tsc --noEmit -p .` reports 0. Run the mobile typecheck, save the error lines to
  `.superpowers/sdd/2026-10-15-kip-freebuild-p4/tsc-baseline.txt`, and confirm the count is 10.
- [ ] **Step 4:** Write the ledger (`progress.md`), with a `ledger-init.sh` in the workspace modelled on P3's:
  - copy every `Ruling:` line of the P1, P2 and P3 ledgers under "Inherited from P1 / P2 / P3 (binding)", and P2's plan
    rulings 1–38 and P3's plan rulings 1–25 by reference, marking P2 Task 6's "P4 NOTE: forSale …" as "resolved by P4
    ruling 15", P2 Task 7's / P3's "P4 NOTE: expand rewrites the sanitised layout …" as "resolved by P4 ruling 16", and
    P2 plan ruling 24's cheer row as "ticks from P4 Task 5 (ruling 30)";
  - write this plan's 30 rulings as `Ruling: … — why — cost` lines;
  - record the order, subagent-driven: backend Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 strictly (shared schema, ledger,
    catalogue and routes); mobile Tasks 8 → 9 → 10 → 11 → 12 strictly after 7 (they share `api/rooms.ts`, `ROOM_COPY`,
    `RoomCard` and the navigator); Task 13 last (controller).

---
### Task 1: Backend: the migration (`User.shareRoom`, `RoomCheer`, `Gift`, `ChallengeEntry`, `ChallengeCheer`) and account deletion

Spec §10.1 (`User.shareRoom`), §10.2 (`RoomCheer`), §10.3 (`Gift`, `from` `SetNull`, `to` `Cascade`), §10.4
(`ChallengeEntry`, `ChallengeCheer`), §12 "Account deletion", §0's gifts-and-deleted-accounts ruling. Rulings 6, 7, 26.

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/users/deletion.ts`, `backend/src/buddies/models.ts`
- Create: `backend/prisma/migrations/20261018120000_social_rooms/migration.sql`
- Modify (tests): `backend/tests/users/ownedData.ts`, `backend/tests/buddies/deletion.test.ts`
- Create (test): `backend/tests/social/roomTables.test.ts`

**Interfaces:**
- Consumes: P2's `USER_OWNED_MODELS`, `SOCIAL_MODELS`, `SOCIAL_USER_COLUMNS`, `SET_NULL_COLUMNS`, `deleteUserAccount`.
- Produces (Prisma client): `prisma.roomCheer` (`id`, `fromId`, `toId`, `localDate: Date @db.Date`, `createdAt`;
  unique `fromId_toId_localDate`), `prisma.gift` (`id`, `fromId: string | null`, `toId`, `itemId`, `note`,
  `createdAt`, `openedAt`, `returnedAt`), `prisma.challengeEntry` (`userId`, `weekId`, `snapshot: Json`,
  `circle: Json`, `paidAt`, `judgedAt`, `createdAt`, `updatedAt`; id `userId_weekId`), `prisma.challengeCheer`
  (`weekId`, `fromId`, `toId`, `createdAt`; id `weekId_fromId_toId`), `User.shareRoom: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/social/roomTables.test.ts`:

```ts
// P4's tables and account deletion (spec 2026-10-15 §10, §12; the controller ruling on gifts and deleted accounts).
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { deleteUserAccount } from '../../src/users/deletion';
import { buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const noop = { deleteSubscription: async () => {}, revokeToken: async () => {}, log: () => {} };
const day = new Date('2026-10-26T00:00:00.000Z');

it('visits are off by default for every account (spec §10.1)', async () => {
  const u = await buddyUser();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).shareRoom).toBe(false);
});

it('one room cheer per visitor, room and local day (spec §10.2)', async () => {
  const [a, b] = [await buddyUser(), await buddyUser()];
  await prisma.roomCheer.create({ data: { fromId: a.id, toId: b.id, localDate: day } });
  await expect(prisma.roomCheer.create({ data: { fromId: a.id, toId: b.id, localDate: day } })).rejects.toMatchObject({ code: 'P2002' });
  await prisma.roomCheer.create({ data: { fromId: b.id, toId: a.id, localDate: day } });
});

it('a deleted gifter\'s gift stays, with no sender; a deleted recipient\'s gifts go (controller ruling, §10.3; Review Focus 4)', async () => {
  const [giver, keeper, leaver] = [await buddyUser(), await buddyUser(), await buddyUser()];
  await pairUp(giver.id, keeper.id);
  await pairUp(keeper.id, leaver.id);
  const kept = await prisma.gift.create({ data: { id: randomUUID(), fromId: giver.id, toId: keeper.id, itemId: 'plant.fern', note: 'cosy' } });
  const dropped = await prisma.gift.create({ data: { id: randomUUID(), fromId: keeper.id, toId: leaver.id, itemId: 'plant.fern', note: 'desk' } });
  await deleteUserAccount(giver.id, noop);
  await deleteUserAccount(leaver.id, noop);
  expect(await prisma.gift.findUnique({ where: { id: kept.id } })).toMatchObject({ fromId: null, toId: keeper.id, openedAt: null });
  expect(await prisma.gift.findUnique({ where: { id: dropped.id } })).toBeNull();
  // Nothing is returned to the sender of a dropped gift (ruling 12): no gift_back row appears.
  expect(await prisma.itemGrant.count({ where: { userId: keeper.id, sourceKey: { startsWith: 'gift_back:' } } })).toBe(0);
});

it('entries and entry cheers go with their user (spec §12)', async () => {
  const [a, b] = [await buddyUser(), await buddyUser()];
  await prisma.challengeEntry.create({ data: { userId: a.id, weekId: '2026-W44', snapshot: {}, circle: [b.id] } });
  await prisma.challengeEntry.create({ data: { userId: b.id, weekId: '2026-W44', snapshot: {}, circle: [a.id] } });
  await prisma.challengeCheer.create({ data: { weekId: '2026-W44', fromId: b.id, toId: a.id } });
  await deleteUserAccount(a.id, noop);
  expect(await prisma.challengeEntry.count({ where: { userId: a.id } })).toBe(0);
  expect(await prisma.challengeCheer.count({ where: { OR: [{ fromId: a.id }, { toId: a.id }] } })).toBe(0);
  expect(await prisma.challengeEntry.count({ where: { userId: b.id } })).toBe(1);
});
```

In `backend/tests/users/ownedData.ts`, after the `itemGrant.create` line of `seedAllOwnedRows`, add:

```ts
  await prisma.challengeEntry.create({ data: { userId, weekId: '2026-W44', snapshot: {}, circle: [] } });
```

In `backend/tests/buddies/deletion.test.ts`'s `seedSocial(a, b)`, after the Social S3 loop and before `return`, add:

```ts
  // Free-build P4 tables (spec 2026-10-15 §10): room cheers, gifts both ways, entry cheers.
  for (const [me, other] of [[a, b], [b, a]] as const) {
    await prisma.roomCheer.create({ data: { fromId: me, toId: other, localDate: today } });
    await prisma.gift.create({ data: { id: randomUUID(), fromId: me, toId: other, itemId: 'plant.fern', note: 'cosy' } });
    await prisma.challengeCheer.create({ data: { weekId: '2026-W44', fromId: me, toId: other } });
  }
```

The file's existing "removes every social row that names them" test then covers the three tables (a `Gift` row
whose `fromId` was nulled no longer names the deleted user, so `rowsFor` counts 0 for it), and its schema guard checks
`Gift.fromId` is `SetNull` and every other new role column `Cascade`.

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/social/roomTables.test.ts tests/users tests/buddies/deletion.test.ts`
Expected: FAIL: TypeScript errors (`roomCheer`, `gift`, `challengeEntry`, `challengeCheer`, `shareRoom` do not exist).

- [ ] **Step 3: Write the schema, the migration and the deletion lists**

In `backend/prisma/schema.prisma`, `model User`: after `reportsAgainst` add the relation fields, and after
`shareStreaks` add the switch:

```prisma
  roomCheersSent        RoomCheer[]         @relation("RoomCheerFrom")
  roomCheersReceived    RoomCheer[]         @relation("RoomCheerTo")
  giftsSent             Gift[]              @relation("GiftFrom")
  giftsReceived         Gift[]              @relation("GiftTo")
  challengeEntries      ChallengeEntry[]
  challengeCheersSent   ChallengeCheer[]    @relation("ChallengeCheerFrom")
  challengeCheersGot    ChallengeCheer[]    @relation("ChallengeCheerTo")
```

```prisma
  /// Buddies can visit my room (spec 2026-10-15 §10.1): off by default, its own one-line consent, never gated on or
  /// reset by buddySharingConsentVersion.
  shareRoom                  Boolean   @default(false)
```

At the end of the file add:

```prisma
// ---- Free-build P4 (spec 2026-10-15 §10): visits, gifts, challenges ----

/// One cheer per visitor, room and the visitor's local day (§10.2). Two-sided: outside USER_OWNED_MODELS.
model RoomCheer {
  id        String   @id @default(uuid())
  fromId    String
  from      User     @relation("RoomCheerFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId      String
  to        User     @relation("RoomCheerTo", fields: [toId], references: [id], onDelete: Cascade)
  localDate DateTime @db.Date
  createdAt DateTime @default(now())

  @@unique([fromId, toId, localDate])
  @@index([toId, localDate])
}

/// A spare piece sent to a buddy (§10.3). id is the app's request id. A deleted sender's gift is still delivered
/// (fromId SetNull); a deleted recipient's gifts are dropped (toId Cascade).
model Gift {
  id         String    @id
  fromId     String?
  from       User?     @relation("GiftFrom", fields: [fromId], references: [id], onDelete: SetNull)
  toId       String
  to         User      @relation("GiftTo", fields: [toId], references: [id], onDelete: Cascade)
  itemId     String
  /// 'desk' | 'cosy' | 'thought': picked, never typed.
  note       String
  createdAt  DateTime  @default(now())
  openedAt   DateTime?
  returnedAt DateTime?

  @@index([toId, openedAt])
  @@index([fromId, createdAt])
}

/// A weekly theme challenge entry (§10.4): a snapshot of the room, the buddy circle frozen at the close, paid and
/// judged at most once.
model ChallengeEntry {
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// The entrant's local ISO week, '2026-W44'.
  weekId    String
  /// { layout, size: { n, m } }: what buddies see of the entry.
  snapshot  Json
  /// The entrant's buddies' ids, rewritten while the entry is open (P4 ruling 6).
  circle    Json      @default("[]")
  paidAt    DateTime?
  judgedAt  DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@id([userId, weekId])
  @@index([weekId])
}

/// One cheer per entry per buddy per week (§10.4). Two-sided: outside USER_OWNED_MODELS.
model ChallengeCheer {
  weekId    String
  fromId    String
  from      User     @relation("ChallengeCheerFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId      String
  to        User     @relation("ChallengeCheerTo", fields: [toId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([weekId, fromId, toId])
  @@index([toId, weekId])
}
```

Create `backend/prisma/migrations/20261018120000_social_rooms/migration.sql`:

```sql
-- Free-build P4 (spec 2026-10-15 §10): the room-visit switch, room cheers, gifts, challenge entries and entry cheers.
ALTER TABLE "User" ADD COLUMN "shareRoom" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RoomCheer" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomCheer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "fromId" TEXT,
    "toId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChallengeEntry" (
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "circle" JSONB NOT NULL DEFAULT '[]',
    "paidAt" TIMESTAMP(3),
    "judgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("userId","weekId")
);

CREATE TABLE "ChallengeCheer" (
    "weekId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeCheer_pkey" PRIMARY KEY ("weekId","fromId","toId")
);

CREATE UNIQUE INDEX "RoomCheer_fromId_toId_localDate_key" ON "RoomCheer"("fromId", "toId", "localDate");
CREATE INDEX "RoomCheer_toId_localDate_idx" ON "RoomCheer"("toId", "localDate");
CREATE INDEX "Gift_toId_openedAt_idx" ON "Gift"("toId", "openedAt");
CREATE INDEX "Gift_fromId_createdAt_idx" ON "Gift"("fromId", "createdAt");
CREATE INDEX "ChallengeEntry_weekId_idx" ON "ChallengeEntry"("weekId");
CREATE INDEX "ChallengeCheer_toId_weekId_idx" ON "ChallengeCheer"("toId", "weekId");

ALTER TABLE "RoomCheer" ADD CONSTRAINT "RoomCheer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomCheer" ADD CONSTRAINT "RoomCheer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeCheer" ADD CONSTRAINT "ChallengeCheer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeCheer" ADD CONSTRAINT "ChallengeCheer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

In `backend/src/users/deletion.ts`, `USER_OWNED_MODELS`: add `'ChallengeEntry',` after `'ItemGrant',`.

In `backend/src/buddies/models.ts`: append `'RoomCheer', 'Gift', 'ChallengeCheer'` to `SOCIAL_MODELS`; add to
`SOCIAL_USER_COLUMNS`:

```ts
  RoomCheer: ['fromId', 'toId'],
  Gift: ['fromId', 'toId'],
  ChallengeCheer: ['fromId', 'toId'],
```

and change `SET_NULL_COLUMNS` to
`new Set(['BuddyCode.usedById', 'HandleHold.previousOwnerId', 'Gift.fromId'])`, with the header comment's first line
extended to "(Buddies spec §3, Social tab S1, S2 and S3, free-build P4)".

Then, from `backend/`: `DATABASE_URL=postgresql://x@localhost/x npx prisma generate` and
`bash ../.superpowers/sdd/2026-10-15-kip-freebuild-p4/schema-drift.sh` (expected: `no drift`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/social/roomTables.test.ts tests/users tests/buddies/deletion.test.ts`
Expected: PASS (the `USER_OWNED_MODELS` coverage guard sees `ChallengeEntry`; the social-tables guard sees the three
two-sided tables, `Gift.fromId` as `SetNull`). Then the full backend suite and `tsc --noEmit -p .` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/users/deletion.ts backend/src/buddies/models.ts backend/tests/social/roomTables.test.ts backend/tests/users/ownedData.ts backend/tests/buddies/deletion.test.ts
git commit -m "feat(social): tables for room visits, cheers, gifts and weekly challenges"
```

---

### Task 2: Backend: the `room` sharing key (its own consent) and `roomOpen` on a buddy's week

Spec §10.1 (in code: `User.shareRoom`, `SHARE_COLUMNS`, `SHARING_SELECT`, `SharingRow`, the sixth `SHARE_KEYS` key,
`HEALTH_SHARE_KEYS`, `updateSharing`'s consent only for a health key, `effectiveSharing` passing `room` through,
`view.ts`'s `shares` filtering `room` out). Rulings 8, 20.

**Files:**
- Modify: `backend/src/buddies/sharing.ts`, `backend/src/buddies/view.ts`
- Modify (tests): `backend/tests/buddies/sharing.test.ts`, `backend/tests/buddies/week.test.ts`

**Interfaces:**
- Consumes: Task 1's `User.shareRoom`.
- Produces: `SHARE_KEYS = ['recovery', 'sleepScore', 'hoursSlept', 'steps', 'streaks', 'room']`,
  `HEALTH_SHARE_KEYS` (the first five), `type HealthShareKey`, `ShareKey` including `'room'`,
  `SHARE_COLUMNS.room = 'shareRoom'`, `SHARING_SELECT.shareRoom`, `SharingRow.shareRoom`,
  `roomOpen(row: { shareRoom: boolean }): boolean`, `BuddyWeekDTO.roomOpen: boolean`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/buddies/sharing.test.ts`: change `ALL_OFF` to
`{ recovery: false, sleepScore: false, hoursSlept: false, steps: false, streaks: false, room: false }`, add
`shareRoom: false,` to `row()`'s object, change the first test's first expectation to
`{ recovery: true, sleepScore: true, hoursSlept: true, steps: true, streaks: true, room: false }`, and add:

```ts
describe('the room switch (spec 2026-10-15 §10.1, controller ruling)', () => {
  it('passes through as stored, whatever the health consent', () => {
    expect(effectiveSharing(row({ shareRoom: true, buddySharingConsentVersion: null })).room).toBe(true);
    expect(effectiveSharing(row({ shareRoom: true }), BUDDY_SHARING_CONSENT_VERSION + 1)).toMatchObject({ room: true, steps: false });
    expect(parseSharingPatch({ room: true })).toEqual({ room: true });
  });

  it('turns on without the health consent and survives a consent-version bump; off never asks', async () => {
    const user = await buddyUser();
    const headers = await authHeaderFor(user.id);
    const agent = await api();
    const on = await agent.put('/me/buddies/sharing').set(headers).send({ room: true });
    expect([on.status, on.body]).toEqual([200, { consentVersion: BUDDY_SHARING_CONSENT_VERSION, consented: false, ...ALL_OFF, room: true }]);
    // A bump looks like an older stored version: the health switches read off, the room stays open.
    await prisma.user.update({ where: { id: user.id }, data: { buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION - 1 } });
    expect((await agent.get('/me/buddies/sharing').set(headers)).body.room).toBe(true);
    // Mixing a health key into the patch still needs the health consent, and writes nothing.
    const mixed = await agent.put('/me/buddies/sharing').set(headers).send({ room: false, steps: true });
    expect([mixed.status, mixed.body]).toEqual([409, { error: 'consent_required' }]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).shareRoom).toBe(true);
    const off = await agent.put('/me/buddies/sharing').set(headers).send({ room: false });
    expect(off.body.room).toBe(false);
  });
});
```

In `backend/tests/buddies/week.test.ts` add (importing `BUDDY_SHARING_CONSENT_VERSION` from
`../../src/buddies/sharing`, `buildBuddyWeek` from `../../src/buddies/view`, `buddyUser` and `pairUp` from
`./helpers` where the file does not already):

```ts
it('lists health shares only, and says whether the room is open (spec §10.1, ruling 8)', async () => {
  const [me, them] = [await buddyUser(), await buddyUser()];
  await pairUp(me.id, them.id);
  await prisma.user.update({ where: { id: them.id }, data: { shareRoom: true, shareSteps: true, buddySharingConsentVersion: BUDDY_SHARING_CONSENT_VERSION } });
  const week = await buildBuddyWeek(me.id, them.id, new Date());
  expect(week.shares).toEqual(['steps']);
  expect(week.roomOpen).toBe(true);
  await prisma.user.update({ where: { id: them.id }, data: { shareRoom: false } });
  expect((await buildBuddyWeek(me.id, them.id, new Date())).roomOpen).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/buddies/sharing.test.ts tests/buddies/week.test.ts`
Expected: FAIL (`room` is not a key; `roomOpen` is undefined).

- [ ] **Step 3: Implement**

In `backend/src/buddies/sharing.ts`, change the header comment's first sentence to "What a buddy may see beyond mood
and coach (spec 2026-10-06 buddies §1, §4; free-build 2026-10-15 §10.1): five health switches under a versioned
consent, and the room switch with its own one-line consent." and replace the keys, columns, select, row and effective
sharing with:

```ts
export const HEALTH_SHARE_KEYS = ['recovery', 'sleepScore', 'hoursSlept', 'steps', 'streaks'] as const;
export type HealthShareKey = (typeof HEALTH_SHARE_KEYS)[number];
/** The five health switches and `room` (spec 2026-10-15 §10.1): buddies can visit my room. */
export const SHARE_KEYS = [...HEALTH_SHARE_KEYS, 'room'] as const;
export type ShareKey = (typeof SHARE_KEYS)[number];
export type Sharing = Record<ShareKey, boolean>;

export const SHARE_COLUMNS = {
  recovery: 'shareRecovery',
  sleepScore: 'shareSleepScore',
  hoursSlept: 'shareHoursSlept',
  steps: 'shareSteps',
  streaks: 'shareStreaks',
  room: 'shareRoom',
} as const satisfies Record<ShareKey, string>;

export const SHARING_SELECT = {
  shareRecovery: true,
  shareSleepScore: true,
  shareHoursSlept: true,
  shareSteps: true,
  shareStreaks: true,
  shareRoom: true,
  buddySharingConsentVersion: true,
} as const;

export interface SharingRow {
  shareRecovery: boolean;
  shareSleepScore: boolean;
  shareHoursSlept: boolean;
  shareSteps: boolean;
  shareStreaks: boolean;
  shareRoom: boolean;
  buddySharingConsentVersion: number | null;
}

/** The health switches need the CURRENT consent version; the room switch is its own consent (spec §10.1). */
export function effectiveSharing(row: SharingRow, version: number = BUDDY_SHARING_CONSENT_VERSION): Sharing {
  const consented = row.buddySharingConsentVersion === version;
  const health = Object.fromEntries(HEALTH_SHARE_KEYS.map((key) => [key, consented && row[SHARE_COLUMNS[key]]]));
  return { ...health, room: row.shareRoom } as Sharing;
}

/** The room is open to buddies' visits (spec §10.1): the stored switch, never the health consent. */
export const roomOpen = (row: { shareRoom: boolean }): boolean => row.shareRoom;
```

and in `updateSharing` replace the `enabling` line with:

```ts
  // Only a health switch turned on needs the health consent (spec 2026-10-15 §10.1): `{ room: true }` alone does not.
  const enabling = HEALTH_SHARE_KEYS.some((key) => patch[key] === true);
```

In `backend/src/buddies/view.ts`: import `HEALTH_SHARE_KEYS` and `roomOpen` from `./sharing` (and drop
`SHARE_KEYS`), add to `BuddyWeekDTO`:

```ts
  /** The buddy opened their room to visits (spec 2026-10-15 §10.1): the profile's Visit button (P4 ruling 8). */
  roomOpen: boolean;
```

and in `buildBuddyWeek` set `shares: HEALTH_SHARE_KEYS.filter((key) => sharing[key]),` (the room has its own entry
point, not a line among the shared numbers) and add `roomOpen: roomOpen(buddy),` to the `week` object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/buddies tests/social tests/chats`
Expected: PASS (`circle.ts`, `chats/cards.ts` and `badges.ts` read `steps` and `streaks` only, unchanged). Then the full
backend suite and `tsc` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/buddies/sharing.ts backend/src/buddies/view.ts backend/tests/buddies/sharing.test.ts backend/tests/buddies/week.test.ts
git commit -m "feat(buddies): a room-visit switch with its own consent, off by default"
```

---

### Task 3: Backend: the two-user cheer lock, the paged cheer scan, and the shop's earned rule

Spec §6.3 (two-person events take both locks in sorted user-id order), §13 (the cheer scan's 90-row bound), §6.5 (a
rule piece is never sold before it is earned). Rulings 15, 17, 18.

**Files:**
- Modify: `backend/src/coins/ledger.ts`, `backend/src/cosmetics/facts.ts`, `backend/src/coins/shop.ts`
- Create (test): `backend/tests/coins/pair.test.ts`
- Modify (tests): `backend/tests/cosmetics/grant.test.ts`, `backend/tests/coins/shop.test.ts`

**Interfaces:**
- Consumes: P2's `lockRoom`, `writeEarns` (private), `checkEarn`, `CoinEarn`, `CoinWritten`, `COIN_TX_OPTIONS`,
  `EARN_AMOUNTS`.
- Produces: `lockUsers(tx, ids: readonly string[]): Promise<void>`;
  `writeEarnsTx(tx, userId, events: readonly CoinEarn[], now): Promise<CoinWritten[]>` (checks every earn, writes, takes
  no lock); `logEarned(written: readonly CoinWritten[]): void`;
  `cheerEarns(key: string, capDay: string, side: 'given' | 'got'): CoinEarn`;
  `loadCheerTimes(userId, timezone): Promise<Date[]>` (facts.ts);
  `forSale(itemId, week, earned: ReadonlySet<string>, items?)`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/pair.test.ts`:

```ts
// Two-person cheers (spec 2026-10-15 §6.3): both users' locks in sorted id order in one transaction.
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { COIN_TX_OPTIONS, cheerEarns, lockUsers, writeEarnsTx } from '../../src/coins/ledger';
import { balance, coinUser, rowsOf } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const DAY = '2026-10-26';
const pay = (giver: string, owner: string, key: string) =>
  prisma.$transaction(async (tx) => {
    await lockUsers(tx, [giver, owner]);
    await writeEarnsTx(tx, giver, [cheerEarns(key, DAY, 'given')], new Date());
    await writeEarnsTx(tx, owner, [cheerEarns(key, DAY, 'got')], new Date());
  }, COIN_TX_OPTIONS);

it('a cheer pays both sides 2 coins under the given and got kinds', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  await pay(a.id, b.id, 'cheer:x1');
  expect((await rowsOf(a.id)).map((r) => [r.kind, r.sourceKey, r.amount])).toEqual([['cheer_given', 'cheer:x1:given', 2]]);
  expect((await rowsOf(b.id)).map((r) => [r.kind, r.sourceKey, r.amount])).toEqual([['cheer_got', 'cheer:x1:got', 2]]);
});

it('two people cheering each other at once never deadlock (Review Focus 1)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  await Promise.all([pay(a.id, b.id, 'cheer:ab'), pay(b.id, a.id, 'cheer:ba')]);
  expect([await balance(a.id), await balance(b.id)]).toEqual([4, 4]);
});

it('the sixth paid cheer of a day, given and received together, writes 0 (spec §6.2)', async () => {
  const [a, b] = [(await coinUser()).user, (await coinUser()).user];
  for (let k = 0; k < 6; k++) await pay(a.id, b.id, `cheer:n${k}`);
  expect((await rowsOf(a.id)).map((r) => r.amount)).toEqual([2, 2, 2, 2, 2, 0]);
});

it('lockUsers takes each distinct id once (a self-pair never waits on itself)', async () => {
  const { user } = await coinUser();
  await prisma.$transaction(async (tx) => { await lockUsers(tx, [user.id, user.id]); });
});
```

In `backend/tests/cosmetics/grant.test.ts` add (importing `loadCheerTimes` from `../../src/cosmetics/facts` and
`buddyUser` from `../buddies/helpers` if missing):

```ts
it('pages past 90 sticker rows until 15 cheers are found (spec §13, Spec B Task 3 minor; ruling 18)', async () => {
  const me = await buddyUser();
  const friends = await Promise.all(Array.from({ length: 16 }, () => buddyUser()));
  const start = Date.UTC(2026, 9, 1, 12);
  // 95 stickers to ONE buddy on one day count once; then one each to 15 more buddies the next day.
  await prisma.sticker.createMany({ data: Array.from({ length: 95 }, (_, k) => ({ fromUserId: me.id, toUserId: friends[0]!.id, kind: 'CHEER' as const, sentAt: new Date(start + k * 1000) })) });
  await prisma.sticker.createMany({ data: friends.slice(1).map((f, k) => ({ fromUserId: me.id, toUserId: f.id, kind: 'CHEER' as const, sentAt: new Date(start + 86_400_000 + k * 1000) })) });
  expect(await loadCheerTimes(me.id, 'UTC')).toHaveLength(15);
});
```

In `backend/tests/coins/shop.test.ts` replace lines 48–52 with:

```ts
    const none: ReadonlySet<string> = new Set();
    expect(forSale('plant.monstera', W, none)).toBeNull();
    expect(forSale('plant.monstera', W, new Set(['plant.monstera']))).toEqual({ itemId: 'plant.monstera', price: 140 });
    expect(forSale('item.radio', W, none)).toEqual({ itemId: 'item.radio', price: 150 });
    expect(forSale('plant.fern', W, none)).toEqual({ itemId: 'plant.fern', price: 40 });
    expect(forSale('desk.monitor', W, none)).toBeNull();
```

and add, inside the purchases `describe` (importing `randomUUID` from `crypto` and `fund` from `./helpers` if
missing):

```ts
  it('a rule piece received as a gift is still not for sale until it is earned (P2 note, ruling 15)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 500);
    await prisma.itemGrant.create({ data: { userId: user.id, itemId: 'plant.monstera', qty: 1, sourceKey: 'gift_in:t3' } });
    const res = await (await api()).post('/me/shop/purchases').set(headers).send({ requestId: randomUUID(), itemId: 'plant.monstera' });
    expect([res.status, res.body]).toEqual([400, { error: 'not_for_sale' }]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/coins/pair.test.ts tests/cosmetics/grant.test.ts tests/coins/shop.test.ts`
Expected: FAIL (`lockUsers`, `writeEarnsTx`, `cheerEarns`, `loadCheerTimes` do not exist; `forSale` takes counts).

- [ ] **Step 3: Implement**

In `backend/src/coins/ledger.ts`: import `EARN_AMOUNTS` beside `DAILY_CAP` from `./amounts`; rename the private
`writeEarns` to `writeEarnsTx`, export it, and make it check its own earns (its body is otherwise unchanged):

```ts
/** Writes the earns this user has not been paid for yet, inside the caller's transaction, which already holds the
 * user's room lock (lockRoom or lockUsers). Throws on a malformed earn. Answers what it wrote. */
export async function writeEarnsTx(tx: Prisma.TransactionClient, userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  events.forEach(checkEarn);
  // Two earns with one key in a batch: the last one is kept (a key is paid once, whichever amount it carries).
  const unique = [...new Map(events.map((e) => [e.sourceKey, e])).values()];
  // … the rest of the old writeEarns body, line for line …
}
```

and add:

```ts
/**
 * Both (or all) users' room locks in one transaction, in sorted user-id order (spec §6.3): two people cheering each
 * other at once wait for each other instead of deadlocking. Each distinct id once.
 */
export async function lockUsers(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort()) await lockRoom(tx, id);
}

/** One side of a two-person cheer (spec §6.2, §10.2): 2 coins, capped on that person's own civil day. */
export function cheerEarns(key: string, capDay: string, side: 'given' | 'got'): CoinEarn {
  return { kind: side === 'given' ? 'cheer_given' : 'cheer_got', sourceKey: `${key}:${side}`, amount: EARN_AMOUNTS.cheer, capDay };
}

/** The one earn log: kinds and counts only, never a user id, a key or an amount. */
export function logEarned(written: readonly CoinWritten[]): void {
  const counts = new Map<string, number>();
  for (const w of written) counts.set(w.kind, (counts.get(w.kind) ?? 0) + 1);
  for (const [kind, count] of counts) console.info(JSON.stringify({ event: 'coins.earned', kind, count }));
}
```

`applyCoinEvents` becomes:

```ts
export async function applyCoinEvents(userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  if (!events.length) return [];
  events.forEach(checkEarn);
  const written = await prisma.$transaction(async (tx) => {
    await lockRoom(tx, userId);
    return writeEarnsTx(tx, userId, events, now);
  }, COIN_TX_OPTIONS);
  logEarned(written);
  return written;
}
```

Extend the file's header comment with: "Two-person events (a cheer) take both users' locks in sorted id order
(lockUsers) and write each side with writeEarnsTx in the caller's transaction (P4 ruling 17)."

In `backend/src/cosmetics/facts.ts` add the paged scan and use it in `loadUnlockFacts` (drop the bounded
`prisma.sticker.findMany` from its `Promise.all` and set `cheersAt: await loadCheerTimes(userId, user?.timezone ?? 'UTC')`):

```ts
/**
 * Cheers, paged (spec 2026-10-15 §13; Spec B Task 3 minor, P4 ruling 18): CHEER_SCAN_ROWS rows at a time, oldest
 * first, until 15 cheers are counted or the rows run out, so a burst of stickers to one buddy never hides later ones.
 */
export async function loadCheerTimes(userId: string, timezone: string): Promise<Date[]> {
  const rows: Array<{ toUserId: string; sentAt: Date }> = [];
  let cursor: string | null = null;
  for (;;) {
    const page: Array<{ id: string; toUserId: string; sentAt: Date }> = await prisma.sticker.findMany({
      where: { fromUserId: userId },
      orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
      take: CHEER_SCAN_ROWS,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, toUserId: true, sentAt: true },
    });
    rows.push(...page);
    const times = cheerTimes(rows, timezone);
    if (times.length >= MAX_CHEERS_COUNTED || page.length < CHEER_SCAN_ROWS) return times;
    cursor = page[page.length - 1]!.id;
  }
}
```

and change `CHEER_SCAN_ROWS`'s comment to "One page of the cheer scan (P4 ruling 18 pages it): 15 buddy-days × at most
6 stickers each."

In `backend/src/coins/shop.ts`:

```ts
/** A shop piece and a starter are for anyone; a rule piece only once its unlock row exists, never because a gift or a
 * prize gave a copy (spec §6.5; P4 ruling 15 resolves P2's note). */
export function forSale(itemId: string, week: string, earned: ReadonlySet<string>, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer | null {
  const offer = offeredIn(week, items).find((o) => o.itemId === itemId);
  const item = items.find((i) => i.id === itemId);
  if (!offer || !item) return null;
  const anyone = item.unlock.kind === 'shop' || item.unlock.kind === 'starter';
  return anyone || earned.has(itemId) ? offer : null;
}
```

and in `buyPiece` replace the in-transaction `Promise.all([cosmeticUnlock…, grantTotals(tx, userId)])` and the
`forSale` call with:

```ts
    const rows = await tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } });
    const offer = forSale(parsed.itemId, week, new Set(rows.map((r) => r.itemId)));
```

(the post-transaction counts read is unchanged).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/coins tests/cosmetics`
Expected: PASS. Then the full backend suite and `tsc` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/coins/ledger.ts backend/src/cosmetics/facts.ts backend/src/coins/shop.ts backend/tests/coins/pair.test.ts backend/tests/cosmetics/grant.test.ts backend/tests/coins/shop.test.ts
git commit -m "feat(coins): pay both sides of a cheer under sorted locks; page the cheer scan; sell rule pieces only once earned"
```

---

### Task 4: Catalogue release 6: challenge tags, the `prize` unlock, the theme calendar, the eight challenge pieces and their art

Spec §2.1 (`tags` for challenge briefs; release 6 for P4's challenge pieces), §4 (P4's art batch: the challenge pieces
and trophies), §6.4 (the week's theme piece, 80, that week only), §10.4 (the server-side calendar, the first four
themes, the trophy that glows at night). Rulings 1–4.

**Files:**
- Create: `backend/src/challenges/themes.ts`, `backend/tests/challenges/themes.test.ts`
- Modify: `backend/src/cosmetics/catalogue.ts`, `backend/src/cosmetics/rules.ts`, `backend/src/coins/shop.ts`,
  `backend/src/coins/shopWeeks.ts`
- Modify (tests): `backend/tests/cosmetics/catalogue.test.ts`, `backend/tests/cosmetics/everShipped.json`,
  `backend/tests/coins/shop.test.ts`
- Modify (generated, by `scripts/export-cosmetics.ts`): `mobile/src/lib/room/catalogue.json`,
  `mobile/src/lib/room/iso/geometry.ts` (unchanged content; regenerated with the export)
- Create (mobile): `mobile/src/lib/room/items/challenge.ts`, `mobile/__tests__/lib/challengePieces.test.ts`
- Modify (mobile): `mobile/src/lib/room/catalogue.ts`, `mobile/src/lib/room/art.ts`, `mobile/src/lib/room/roomCopy.ts`

**Interfaces:**
- Consumes: P2's `PRICES`, `ISO_OVERRIDES`, `ruleOf`, `withFlags`, `offeredIn`, `weekSet`'s week arithmetic; P1's
  `registerItems`, `registerIcons`, `standingPiece`, `standing`, `sprite`, `spriteRows`, `darkenHex`, `rgbOf`, `glow`;
  P1's billboard registration in `iso/pieces/stand.ts` (every catalogue item of a billboard slot with front-on art
  stands in the iso room).
- Produces:
  - backend catalogue: `CosmeticRelease = 1 | 2 | 3 | 4 | 5 | 6`, `ShippedRelease = 1 | 3 | 4 | 5 | 6`,
    `RELEASE_LAUNCHED_AT[6]`, `UnlockRule` gains `{ kind: 'prize' }` (code `'P'`), `CosmeticItem.shop?: 'always' |
    'theme' | { week: string }`, `CHALLENGE_TAGS = ['warm', 'plant', 'glow', 'desk'] as const`, `type ChallengeTag`,
    `tagsOf(item): string[]`, `THEME_PIECES`, `TROPHIES` (`ReadonlySet<string>`);
  - `challenges/themes.ts`: `type ThemeId = 'cosyAutumn' | 'greenThumb' | 'nightOwl' | 'tidyDesk'`,
    `interface Theme { id: ThemeId; rule: { tag: ChallengeTag; atLeast: number }; themePiece: string; trophy: string }`,
    `THEMES: readonly Theme[]`, `CHALLENGES_START_WEEK = '2026-W44'`, `themeFor(weekId: string): Theme | null`,
    `briefCount(layout: RoomLayout, tag: ChallengeTag): number`, `meetsBrief(layout, theme): boolean`;
  - `shopWeeks.ts`: `weekNumber(week: string): number | null` (whole weeks since the epoch's Monday);
  - mobile: `UnlockRule` gains `{ kind: 'prize' }`; `CatalogueItem.shop` gains `'theme'`; `ITEM_NAMES` for the eight;
    `unlockLine({ kind: 'prize' })` = "A weekly challenge trophy".

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/challenges/themes.test.ts`:

```ts
// The weekly theme calendar (spec 2026-10-15 §10.4; P4 rulings 3-4).
import { CHALLENGES_START_WEEK, THEMES, briefCount, meetsBrief, themeFor } from '../../src/challenges/themes';
import { cosmeticItem, shippedItem, tagsOf } from '../../src/cosmetics/catalogue';
import { forSale, offeredIn } from '../../src/coins/shop';
import { weekNumber } from '../../src/coins/shopWeeks';
import { piece, withPieces } from '../room/helpers';

it('starts at 2026-W44 and rotates the four themes week by week, across a year end', () => {
  expect(themeFor('2026-W43')).toBeNull();
  expect(['2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W48'].map((w) => themeFor(w)?.id))
    .toEqual(['cosyAutumn', 'greenThumb', 'nightOwl', 'tidyDesk', 'cosyAutumn']);
  // 2026 has 53 ISO weeks: W53 and 2027-W01 are consecutive themes.
  const order = THEMES.map((t) => t.id);
  const at = (w: string) => order.indexOf(themeFor(w)!.id);
  expect((at('2027-W01') - at('2026-W53') + 4) % 4).toBe(1);
  expect(themeFor('garbage')).toBeNull();
  expect(weekNumber(CHALLENGES_START_WEEK)! + 1).toBe(weekNumber('2026-W45'));
});

it('every theme piece and trophy is a shipped release-6 placeable piece; trophies are prizes, theme pieces cost 80', () => {
  for (const t of THEMES) {
    expect([t.id, shippedItem(t.themePiece)?.release, shippedItem(t.themePiece)?.price, shippedItem(t.themePiece)?.shop]).toEqual([t.id, 6, 80, 'theme']);
    expect([t.id, shippedItem(t.trophy)?.release, shippedItem(t.trophy)?.unlock, shippedItem(t.trophy)?.price]).toEqual([t.id, 6, { kind: 'prize' }, undefined]);
    expect(shippedItem(t.trophy)?.emissive).toBe(true); // glows at night (§10.4)
    expect(tagsOf(cosmeticItem(t.themePiece)!)).toContain(t.rule.tag);
  }
});

it('a theme piece is in the shop only in its own theme\'s weeks (spec §6.4)', () => {
  expect(offeredIn('2026-W44').map((o) => o.itemId)).toContain('lamp.harvest');
  expect(offeredIn('2026-W45').map((o) => o.itemId)).not.toContain('lamp.harvest');
  expect(offeredIn('2026-W48').map((o) => o.itemId)).toContain('lamp.harvest');
  expect(forSale('lamp.harvest', '2026-W44', new Set())).toEqual({ itemId: 'lamp.harvest', price: 80 });
  expect(forSale('corner.acorn', '2026-W44', new Set(['corner.acorn']))).toBeNull(); // a trophy is never sold
});

it('counts brief pieces once per placement and judges the rule', () => {
  const cosy = themeFor('2026-W44')!;
  const room = withPieces(piece('p1', 'corner.pumpkin', { x: 6, y: 6 }), piece('p2', 'corner.pumpkin', { x: 5, y: 6 }), piece('p3', 'corner.gnome', { x: 4, y: 6 }));
  // The starter room's amber desk lamp and mug are warm too.
  expect(briefCount(room, 'warm')).toBe(4);
  expect(meetsBrief(room, cosy)).toBe(true);
  expect(briefCount(withPieces(), 'glow')).toBeGreaterThanOrEqual(1); // the amber lamp glows
});
```

(`withPieces` adds pieces to the starter layout; check `tests/room/helpers.ts` and keep the tiles free of the
starter's desk, rug and fern, as its other users do.)

In `backend/tests/cosmetics/catalogue.test.ts`: change the shipped-releases test to expect `[1, 3, 4, 5, 6]` and a
launch date for release 6 (`2026-10-26T00:00:00.000Z`), and add:

```ts
it('derives the challenge tags (P4 ruling 3) and never grants a prize by a rule', () => {
  const tags = (id: string) => tagsOf(cosmeticItem(id)!);
  expect(tags('corner.pumpkin')).toContain('warm');
  expect(tags('plant.fern')).toEqual(expect.arrayContaining(['plant']));
  expect(tags('lamp.amber')).toEqual(expect.arrayContaining(['warm', 'glow']));
  expect(tags('item.mug')).toEqual(expect.arrayContaining(['warm', 'desk']));
  expect(tags('shelf.luckycat')).toEqual(['funny']);
  expect(ruleOf('P')).toEqual({ kind: 'prize' });
  const facts = { levels: [{ family: 'SLEEP_GOAL' as const, level: 5 as const, at: new Date() }], recapsReadAt: [], cheersAt: [] };
  expect(metAt({ kind: 'prize' }, facts, new Map())).toBeNull();
});
```

(import `tagsOf`, `ruleOf` from the catalogue and `metAt` from `../../src/cosmetics/rules`.)

Append the eight ids to `backend/tests/cosmetics/everShipped.json`'s array: `"lamp.harvest"`, `"plant.ivy"`,
`"lamp.moon"`, `"item.organiser"`, `"corner.acorn"`, `"corner.can"`, `"corner.owl"`, `"item.goldpen"`.

Create `mobile/__tests__/lib/challengePieces.test.ts`:

```ts
// Release 6's challenge pieces and trophies (spec 2026-10-15 §4, §10.4; P4 rulings 1-2).
import '../../src/lib/room/iso';
import { catalogueItem } from '../../src/lib/room/catalogue';
import { iconRectsFor } from '../../src/lib/room/icons';
import { isoArtOf } from '../../src/lib/room/iso/art';
import { ITEM_NAMES, unlockLine } from '../../src/lib/room/roomCopy';

const PIECES = ['lamp.harvest', 'plant.ivy', 'lamp.moon', 'item.organiser', 'corner.acorn', 'corner.can', 'corner.owl', 'item.goldpen'];

it('every challenge piece ships with a name, an icon and iso art', () => {
  for (const id of PIECES) {
    expect([id, catalogueItem(id)?.release]).toEqual([id, 6]);
    expect([id, typeof ITEM_NAMES[id]]).toEqual([id, 'string']);
    expect([id, iconRectsFor(id, 'coral').length > 0]).toEqual([id, true]);
    expect([id, !!isoArtOf(id)]).toEqual([id, true]);
  }
});

it('trophies glow and read as a challenge trophy, never as a shop piece', () => {
  for (const id of ['corner.acorn', 'corner.can', 'corner.owl', 'item.goldpen']) {
    expect(catalogueItem(id)?.emissive).toBe(true);
    expect(unlockLine(catalogueItem(id)!.unlock)).toBe('A weekly challenge trophy');
  }
  expect(catalogueItem('lamp.harvest')?.shop).toBe('theme');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/challenges/themes.test.ts tests/cosmetics/catalogue.test.ts`
and, from `mobile/`, `node node_modules/.bin/jest --forceExit __tests__/lib/challengePieces.test.ts`.
Expected: FAIL (no `challenges/themes`, no release 6, no pieces).

- [ ] **Step 3: Implement the backend**

In `backend/src/coins/shopWeeks.ts`, export the week arithmetic and use it in `weekSet`:

```ts
/** Whole weeks from the Monday of 1970's first ISO week to this ISO week's Monday; null for a malformed week. */
export function weekNumber(week: string): number | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  return m ? Math.floor(mondayDay(Number(m[1]), Number(m[2])) / 7) : null;
}
```

and in `weekSet` replace the two lines computing `m` and `n` with `const n = weekNumber(week) ?? 0;`.

In `backend/src/cosmetics/catalogue.ts`:
- `export type CosmeticRelease = 1 | 2 | 3 | 4 | 5 | 6;`, `SHIPPED_RELEASES` gains `6`,
  `export type ShippedRelease = 1 | 3 | 4 | 5 | 6;`, `RELEASE_LAUNCHED_AT` gains
  `6: new Date('2026-10-26T00:00:00.000Z'),` and its comment "OWNER NOTE (P4 plan ruling 1): release 6's date is set
  at merge.";
- `UnlockRule` gains `| { kind: 'prize' }`; `ruleOf` gains `if (code === 'P') return { kind: 'prize' };` (its doc:
  "'P' a weekly challenge trophy, granted only as a prize");
- `CosmeticItem.shop` becomes `shop?: 'always' | 'theme' | { week: string };` with the doc "'always'; 'theme': only in
  the weeks whose challenge theme names it (P4 ruling 4); or only in that ISO week", and `tags`'s doc becomes "'funny'
  (the drawer's Funny tab) and the challenge tags (P4 ruling 3)";
- after `LIVING_PIECES` add:

```ts
// Free-build P4's challenge pieces (spec 2026-10-15 §10.4, C3): each theme's piece (coin shop, its weeks only) and its
// trophy (a prize for the most-cheered room in your circle, glowing at night). P4 ruling 2.
const CHALLENGE_PIECES: readonly Row[] = [
  ['lamp.harvest', 'lamp', 'C', 'G', 6],
  ['plant.ivy', 'plant', 'C', '', 6],
  ['lamp.moon', 'lamp', 'C', 'G', 6],
  ['item.organiser', 'desk_item', 'C', '', 6],
  ['corner.acorn', 'corner', 'P', 'G', 6],
  ['corner.can', 'corner', 'P', 'G', 6],
  ['corner.owl', 'corner', 'P', 'G', 6],
  ['item.goldpen', 'desk_item', 'P', 'G', 6],
];
export const THEME_PIECES: ReadonlySet<string> = new Set(['lamp.harvest', 'plant.ivy', 'lamp.moon', 'item.organiser']);
export const TROPHIES: ReadonlySet<string> = new Set(['corner.acorn', 'corner.can', 'corner.owl', 'item.goldpen']);

export const CHALLENGE_TAGS = ['warm', 'plant', 'glow', 'desk'] as const;
export type ChallengeTag = (typeof CHALLENGE_TAGS)[number];
/** The warm pieces (C3's "warm pieces": pumpkins, candles, lanterns, lamps), a fixed list (P4 ruling 3). */
const WARM: ReadonlySet<string> = new Set([
  'corner.pumpkin', 'item.candle', 'lamp.amber', 'lamp.salt', 'lamp.welcome', 'corner.floorlamp', 'rug.red', 'item.mug',
  'lamp.harvest', 'corner.acorn',
]);

/** An item's tags: 'funny' and the challenge tags, derived from its slot and flags (P4 ruling 3). */
export function tagsOf(item: Pick<CosmeticItem, 'id' | 'slot' | 'emissive'>): string[] {
  const tags: string[] = [];
  if (FUNNY.has(item.id)) tags.push('funny');
  if (WARM.has(item.id)) tags.push('warm');
  if (item.slot === 'plant') tags.push('plant');
  if (item.emissive) tags.push('glow');
  if (item.slot === 'desk_item') tags.push('desk');
  return tags;
}
```

- `PRICES` gains `'lamp.harvest': 80, 'plant.ivy': 80, 'lamp.moon': 80, 'item.organiser': 80,`;
- `ISO_OVERRIDES` gains (the two theme lamps also stand on the floor; the others take their slot's default):

```ts
  // The theme lamps stand on the floor or a surface, like the welcome lantern (P4 ruling 2).
  'lamp.harvest': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'lamp.moon': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
```

- `build()` reads `[...BASE, ...FREEBUILD, ...SHOP_PIECES, ...LIVING_PIECES, ...CHALLENGE_PIECES]`, and its last loop
  sets the tags and the shop variant:

```ts
    const tags = tagsOf(item);
    items.set(id, {
      ...item,
      ...(iso ? { iso: effect ? { ...iso, effect } : iso } : {}),
      ...(tags.length ? { tags } : {}),
      ...(price !== undefined ? { price, shop: THEME_PIECES.has(id) ? ('theme' as const) : ('always' as const) } : {}),
    });
```

  (move the `FUNNY` constant above `tagsOf` if the compiler needs it declared first).

In `backend/src/cosmetics/rules.ts`: `metAt` gains `case 'prize':` beside `'starter'` and `'shop'` (returns null);
`sourceOf` gains `case 'prize': return 'prize';` with the comment "Never a grant source: a trophy is an ItemGrant
'prize:{weekId}' (P4 ruling 6)."

Create `backend/src/challenges/themes.ts`:

```ts
// The weekly theme challenge's calendar (spec 2026-10-15 §10.4, C3), server-side: four themes, one a week by the
// user's local ISO week, rotating from 2026-W44 (P4 ruling 4). Each has a rule over the challenge tags (§2.1), the
// week's theme piece (80 coins, in the shop only in its weeks) and the trophy (the most-cheered room in your circle).
// The words (titles, briefs) are the app's (ROOM_COPY.challenge.themes); the server sends the theme's id.
import type { ChallengeTag } from '../cosmetics/catalogue';
import { shippedItem, tagsOf } from '../cosmetics/catalogue';
import { weekNumber } from '../coins/shopWeeks';
import type { RoomLayout } from '../room/geometry';

export type ThemeId = 'cosyAutumn' | 'greenThumb' | 'nightOwl' | 'tidyDesk';
export interface Theme { id: ThemeId; rule: { tag: ChallengeTag; atLeast: number }; themePiece: string; trophy: string }

export const THEMES: readonly Theme[] = [
  { id: 'cosyAutumn', rule: { tag: 'warm', atLeast: 3 }, themePiece: 'lamp.harvest', trophy: 'corner.acorn' },
  { id: 'greenThumb', rule: { tag: 'plant', atLeast: 4 }, themePiece: 'plant.ivy', trophy: 'corner.can' },
  { id: 'nightOwl', rule: { tag: 'glow', atLeast: 3 }, themePiece: 'lamp.moon', trophy: 'corner.owl' },
  { id: 'tidyDesk', rule: { tag: 'desk', atLeast: 3 }, themePiece: 'item.organiser', trophy: 'item.goldpen' },
];
/** OWNER NOTE (P4 ruling 4): the first challenge week; set with release 6's date at merge. */
export const CHALLENGES_START_WEEK = '2026-W44';

/** The theme of an ISO week, or null before the first challenge week or for a malformed week. */
export function themeFor(weekId: string): Theme | null {
  const n = weekNumber(weekId);
  const start = weekNumber(CHALLENGES_START_WEEK)!;
  if (n === null || n < start) return null;
  return THEMES[(n - start) % THEMES.length]!;
}

/** How many placements in the layout carry the tag (once per placement). */
export function briefCount(layout: RoomLayout, tag: ChallengeTag): number {
  return layout.pieces.filter((p) => {
    const item = shippedItem(p.item);
    return !!item && tagsOf(item).includes(tag);
  }).length;
}

export const meetsBrief = (layout: RoomLayout, theme: Theme): boolean => briefCount(layout, theme.rule.tag) >= theme.rule.atLeast;
```

In `backend/src/coins/shop.ts`, import `themeFor` and change `offeredIn`'s filter to:

```ts
    .filter((i) => isShipped(i) && !!i.iso && i.price !== undefined && (
      i.shop === 'always'
      || (i.shop === 'theme' && themeFor(week)?.themePiece === i.id)
      || (typeof i.shop === 'object' && i.shop.week === week)))
```

From `backend/`, regenerate the app's copy:
`node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`.

- [ ] **Step 4: Implement the app's side**

In `mobile/src/lib/room/catalogue.ts`: `UnlockRule` gains `| { kind: 'prize' }`; `CatalogueItem.shop` becomes
`shop?: 'always' | 'theme' | { week: string };`.

In `mobile/src/lib/room/roomCopy.ts`: `ITEM_NAMES` gains, after the P3 line,

```ts
  // Free-build P4's challenge pieces and trophies (spec 2026-10-15 §10.4, C3).
  'lamp.harvest': 'Harvest lantern', 'plant.ivy': 'Trailing ivy', 'lamp.moon': 'Moon lamp', 'item.organiser': 'Desk organiser',
  'corner.acorn': 'Golden acorn', 'corner.can': 'Golden watering can', 'corner.owl': 'Silver owl', 'item.goldpen': 'Golden pen pot',
```

and `unlockLine` gains `case 'prize': return 'A weekly challenge trophy';` (P3's `card.ts` already treats any rule
other than `'shop'` as "how it was earned", so the piece card reads the trophy line).

Create `mobile/src/lib/room/items/challenge.ts`:

```ts
// Free-build P4's challenge pieces (spec 2026-10-15 §10.4, C3; docs/design/freebuild/gen/c3.py): each theme's piece and
// its trophy. Front-on sprites: the iso room stands them as billboards (iso/pieces/stand.ts), on the floor or a
// surface. The two theme lamps and every trophy glow: unlit in the base (the night veil darkens it), lit with a halo
// in the glow layer, as the candle is.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, type Rects } from '../paint';
import type { RoomSlot } from '../catalogue';
import { darkenHex, rgbOf, sprite, spriteRows, standing, standingPiece } from './shared';

const HARVEST = spriteRows([
  '...k...',
  '..kkk..',
  '.kyyyk.',
  '.kyYyk.',
  '.kyyyk.',
  '..kkk..',
  '.kkkkk.',
], { k: '#57534E', y: '#F59E0B', Y: '#FEF3C7' });
const MOON = spriteRows([
  '..mmm..',
  '.mmMmm.',
  'mmMMmmm',
  'mmmmmmm',
  '.mmmmm.',
  '...s...',
  '..sss..',
], { m: '#E0E7FF', M: '#FFFFFF', s: '#475569' });
const IVY = spriteRows([
  '.g..g..',
  'gGg.gG.',
  '.gGgGg.',
  '..gGg..',
  '.ttttt.',
  '.ttttt.',
  '..ttt..',
], { g: '#15803D', G: '#4ADE80', t: '#B45309' });
const ORGANISER = spriteRows([
  '.p.r.b.',
  '.p.r.b.',
  'ooooooo',
  'oOoOoOo',
  'ooooooo',
], { p: '#F472B6', r: '#F87171', b: '#60A5FA', o: '#334155', O: '#475569' });
const ACORN = spriteRows([
  '...g...',
  '.bbbbb.',
  'bBbBbBb',
  '.yyyyy.',
  '.yYyyy.',
  '..yyy..',
  '...y...',
], { g: '#713F12', b: '#A16207', B: '#CA8A04', y: '#FACC15', Y: '#FEF08A' });
const CAN = spriteRows([
  '.......y',
  '.yyyy.y.',
  'yYyyyyy.',
  'yYyyyy..',
  'yyyyyy..',
  '.yyyy...',
], { y: '#FACC15', Y: '#FEF08A' });
const OWL = spriteRows([
  '.s...s.',
  '.sssss.',
  'swSsSws',
  'sssssss',
  '.sSsSs.',
  '.sssss.',
  '..o.o..',
], { s: '#CBD5E1', S: '#F1F5F9', w: '#0F172A', o: '#F59E0B' });
const PEN = spriteRows([
  '.k.k.',
  '.k.k.',
  'yyyyy',
  'yYyyy',
  'yyyyy',
], { k: '#1F2937', y: '#FACC15', Y: '#FEF08A' });

/** A glowing billboard: the sprite unlit (darkened) in the base, lit with a halo in the glow layer. */
function glowing(id: string, slot: RoomSlot, rows: readonly SpriteRect[], footY: number, halo: string): ItemArt {
  const unlit: readonly SpriteRect[] = rows.map(([x, y, w, h, c]) => [x, y, w, h, darkenHex(c, 0.55)] as const);
  return {
    id, slot, emissive: true,
    draw: ({ ramp, night }) => {
      const r: Rects = [];
      standing(r, unlit, 0, 0, footY, ramp);
      const emissive: Rects = [];
      sprite(emissive, rows, 0, 0, ramp);
      glow(emissive, 3.5, footY / 2, night ? 9 : 5, night ? 7 : 4, rgbOf(halo), night ? 0.12 : 0.05);
      return { base: r, emissive };
    },
  };
}

registerItems([
  glowing('lamp.harvest', 'lamp', HARVEST, 7, '#FDE68A'),
  standingPiece('plant.ivy', 'plant', IVY, 0, 0, 7),
  glowing('lamp.moon', 'lamp', MOON, 7, '#E0E7FF'),
  standingPiece('item.organiser', 'desk_item', ORGANISER, 0, 0, 5),
  glowing('corner.acorn', 'corner', ACORN, 7, '#FDE047'),
  glowing('corner.can', 'corner', CAN, 6, '#FDE047'),
  glowing('corner.owl', 'corner', OWL, 7, '#E2E8F0'),
  glowing('item.goldpen', 'desk_item', PEN, 5, '#FDE047'),
]);
registerIcons({
  'lamp.harvest': HARVEST, 'plant.ivy': IVY, 'lamp.moon': MOON, 'item.organiser': ORGANISER,
  'corner.acorn': ACORN, 'corner.can': CAN, 'corner.owl': OWL, 'item.goldpen': PEN,
});
```

In `mobile/src/lib/room/art.ts` add `import './items/challenge';` after `import './items/living';`.

If `mobile/__tests__/lib/roomSets.test.ts`' "every catalogue id has art and an icon" or `isoPieces.test.ts`' per-slot
depth tables name ids explicitly, add the eight there the way P2 added the shop pieces (P2 Task 2), and run
`node scripts/room-art-size.mjs` (under 300 KB).

- [ ] **Step 5: Run the tests to verify they pass**

Run the backend suite in full (`backend-jest.sh`, no path; `tests/cosmetics/export.test.ts` and `tests/room/copy.test.ts`
confirm the regenerated files) and `tsc` (0); from `mobile/`, the full suite and the typecheck (10).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/challenges/themes.ts backend/src/cosmetics backend/src/coins/shop.ts backend/src/coins/shopWeeks.ts backend/tests/challenges/themes.test.ts backend/tests/cosmetics backend/tests/coins/shop.test.ts mobile/src/lib/room mobile/__tests__/lib
git commit -m "feat(room): release 6: challenge tags, the theme calendar, four theme pieces and four trophies"
```

---

### Task 5: Backend: visits and room cheers (`GET /me/buddies/:buddyId/room`, its cheer, `GET /me/room/cheers`)

Spec §10.1 (who may visit; what a buddy sees; never a tier, badge, balance, counts or anything health-linked), §10.2
(one cheer per room per visitor's day; pays both, inside the 5 paid a day), §12's three P4 rows, §11.2's cheer row.
Rulings 8, 9, 25, 29, 30.

**Files:**
- Create: `backend/src/room/visit.ts`, `backend/src/room/socialRoutes.ts`, `backend/tests/room/visit.test.ts`,
  `backend/tests/challenges/helpers.ts`
- Modify: `backend/src/app.ts`, `backend/src/buddies/errors.ts`

**Interfaces:**
- Consumes: Task 2's `roomOpen`; Task 3's `lockUsers`, `writeEarnsTx`, `cheerEarns`, `logEarned`; P2's
  `countsOf`, `grantTotals`, `readLayout`, `toTier`, `starterLayout`; P1's `tierSize`; buddies' `findPair`,
  `isBlockedEitherWay`, `PERSON_SELECT`, `toPerson`, `buddyRoute`, `BuddyError`, `UUID_RE`; `localCivilDateOrUtc`,
  `civilDateToUtcMidnight`, `shiftDate`, `COIN_TX_OPTIONS`, `saveBodyParser`.
- Produces:
  - `visit.ts`: `interface RoomVisitDTO { name: string; layout: RoomLayout; size: { n: number; m: number };
    kipColour: string; kipWorn: KipWornDTO; cheersThisWeek: number; cheeredToday: boolean }`;
    `canVisit(viewerId, ownerId, db?): Promise<boolean>`; `visitTarget(raw: string, viewerId): string` (throws
    `not_found`); `readOwnedLayout(db, userId): Promise<{ layout: RoomLayout; tier: Tier }>`;
    `weekDays(today: string): [string, string]` (Monday, Sunday of the ISO week); `readVisit(viewerId, ownerId, now)`;
    `cheerRoom(viewerId, ownerId, now): Promise<{ paid: boolean }>`;
    `listRoomCheers(userId, now): Promise<{ count: number; cheers: Array<{ name: string; day: string }> }>`;
  - `socialRoutes.ts`: `socialRoomRouter` (P4's routes; Tasks 6 and 7 add theirs to it) and `SOCIAL_ROOM_POSTS` (the
    `POST` paths `app.ts` gives the 32 KB parser);
  - errors: `already_cheered` 409, `not_spare` 403, `gift_limit` 429, `gift_gone` 404, `challenge_closed` 409,
    `no_challenge` 404, `invalid_body` 400;
  - test helpers (`tests/challenges/helpers.ts`): `pairedPair()`, `openRoom(userId)`, `headersOf(userId)`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/challenges/helpers.ts`:

```ts
import { prisma } from '../../src/db/client';
import { authHeaderFor } from '../helpers/auth';
import { buddyUser, pairUp } from '../buddies/helpers';

/** Two buddies, both with a handle and the mood notice, each in the given zone. */
export async function pairedPair(zones: [string, string] = ['UTC', 'UTC']) {
  const a = await buddyUser({ timezone: zones[0] });
  const b = await buddyUser({ timezone: zones[1] });
  await pairUp(a.id, b.id);
  return { a, b, ha: await authHeaderFor(a.id), hb: await authHeaderFor(b.id) };
}

/** The owner turns "Buddies can visit my room" on (spec §10.1). */
export async function openRoom(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { shareRoom: true } });
}
```

Create `backend/tests/room/visit.test.ts`:

```ts
// Visits and room cheers (spec 2026-10-15 §10.1, §10.2, §12; P4 rulings 8, 9, 30).
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { coinsConfig } from '../../src/coins/sources';
import { api, buddyUser } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';
import { openRoom, pairedPair } from '../challenges/helpers';
import { rowsOf } from '../coins/helpers';

const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2026-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const room = async (h: Record<string, string>, id: string) => (await api()).get(`/me/buddies/${id}/room`).set(h);
const cheer = async (h: Record<string, string>, id: string) => (await api()).post(`/me/buddies/${id}/room/cheer`).set(h).send({});

describe('GET /me/buddies/:buddyId/room (spec §10.1, §12)', () => {
  it('shows an open room: the layout, its size, KIP, the week\'s cheers; nothing else, private no-store', async () => {
    const { a, b, ha } = await pairedPair();
    await openRoom(b.id);
    await prisma.cosmeticLoadout.create({ data: { userId: b.id, layout: (await import('../../src/room/convert')).starterLayout() as never, worn: { head: 'out.beanie', face: null, neck: null, ears: null }, tier: 2, version: 1 } });
    await prisma.biometricRecord.create({ data: { userId: b.id, metricType: 'STEPS', value: 4200, recordedAt: new Date() } });
    const res = await room(ha, b.id);
    expect([res.status, res.headers['cache-control']]).toEqual([200, 'private, no-store']);
    expect(Object.keys(res.body).sort()).toEqual(['cheeredToday', 'cheersThisWeek', 'kipColour', 'kipWorn', 'layout', 'name', 'size']);
    expect(res.body).toMatchObject({ name: 'Sam', size: { n: 8, m: 8 }, cheersThisWeek: 0, cheeredToday: false, kipWorn: { head: 'out.beanie' } });
    // Size only: never the tier, a badge, counts, a balance or a living state (spec §10.1).
    expect(JSON.stringify(res.body)).not.toMatch(/tier|living|plantStage|petEnergy|awards|balance|counts|4200/);
    expect(a.id).not.toBe(b.id);
  });

  it('is one 404 for visits off, a block either way, not buddies, oneself and a bad id (ruling 8; Review Focus 5)', async () => {
    const { a, b, ha } = await pairedPair();
    const stranger = await buddyUser();
    await openRoom(stranger.id);
    const closed = await room(ha, b.id);
    await openRoom(b.id);
    await prisma.buddyBlock.create({ data: { blockerId: b.id, blockedId: a.id } });
    const blocked = await room(ha, b.id);
    const notBuddies = await room(ha, stranger.id);
    const self = await room(ha, a.id);
    const bad = await room(ha, 'not-a-uuid');
    for (const r of [closed, blocked, notBuddies, self, bad]) expect([r.status, r.body]).toEqual([404, { error: 'not_found' }]);
  });
});

describe('POST /me/buddies/:buddyId/room/cheer (spec §10.2)', () => {
  it('pays both people 2 coins once a day, counts for the week, and ticks the first-week cheer row (ruling 30)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await openRoom(b.id);
    const first = await cheer(ha, b.id);
    expect([first.status, first.body]).toEqual([200, { paid: true }]);
    const again = await cheer(ha, b.id);
    expect([again.status, again.body]).toEqual([409, { error: 'already_cheered' }]);
    expect((await rowsOf(a.id)).map((r) => [r.kind, r.amount])).toEqual([['cheer_given', 2]]);
    expect((await rowsOf(b.id)).map((r) => [r.kind, r.amount])).toEqual([['cheer_got', 2]]);
    expect((await room(ha, b.id)).body).toMatchObject({ cheersThisWeek: 1, cheeredToday: true });
    await prisma.roomFirstWeek.create({ data: { userId: a.id, startedOn: new Date(new Date().toISOString().slice(0, 10)) } });
    const week = await (await api()).get('/me/firstweek').set(ha);
    expect(week.body.tasks.find((t: { key: string }) => t.key === 'cheer')).toMatchObject({ done: true });
    // The owner sees who cheered (spec §10.2).
    const mine = await (await api()).get('/me/room/cheers').set(hb);
    expect(mine.body).toEqual({ count: 1, cheers: [{ name: 'Sam', day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }] });
  });

  it('two buddies cheering each other\'s rooms at once both land (Review Focus 1)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await openRoom(a.id);
    await openRoom(b.id);
    const [x, y] = await Promise.all([cheer(ha, b.id), cheer(hb, a.id)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect((await rowsOf(a.id)).map((r) => r.kind).sort()).toEqual(['cheer_given', 'cheer_got']);
  });

  it('past five paid cheers a day the cheer still counts but pays 0 (spec §10.2)', async () => {
    const { a, ha } = await pairedPair();
    const owners = await Promise.all(Array.from({ length: 6 }, () => buddyUser()));
    for (const o of owners) {
      const [lo, hi] = a.id < o.id ? [a.id, o.id] : [o.id, a.id];
      await prisma.buddyPair.create({ data: { userAId: lo, userBId: hi } });
      await openRoom(o.id);
    }
    const paid = [];
    for (const o of owners) paid.push((await cheer(ha, o.id)).body.paid);
    expect(paid).toEqual([true, true, true, true, true, false]);
    expect(await prisma.roomCheer.count({ where: { fromId: a.id } })).toBe(6);
  });

  it('a closed room can\'t be cheered: the same 404', async () => {
    const { b, ha } = await pairedPair();
    const res = await cheer(ha, b.id);
    expect([res.status, res.body]).toEqual([404, { error: 'not_found' }]);
    expect(await authHeaderFor(b.id)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/room/visit.test.ts`
Expected: FAIL (404 from Express for unknown routes; `already_cheered` unknown).

- [ ] **Step 3: Implement**

In `backend/src/buddies/errors.ts` add to `BUDDY_ERROR_STATUS`:

```ts
  // Free-build P4 (spec 2026-10-15 §10, §12; P4 ruling 25).
  already_cheered: 409,
  not_spare: 403,
  gift_limit: 429,
  gift_gone: 404,
  challenge_closed: 409,
  no_challenge: 404,
  invalid_body: 400,
```

Create `backend/src/room/visit.ts`:

```ts
// Visiting a buddy's room and cheering it (spec 2026-10-15 §10.1, §10.2). Who: buddies only, neither has blocked the
// other, and only while the owner's "Buddies can visit my room" is on; every other case is the same 404 (P4 ruling 8).
// What: the layout as the owner's own reads show it, the room's size (never its tier, how it was earned, a badge, a
// balance, counts or anything health-linked), KIP's colour and outfit, and the week's cheer count. A cheer pays both
// people inside one transaction under both room locks in id order (§6.3, ruling 9). Nothing here is logged with an id.
import type { Prisma } from '@prisma/client';
import { civilDateToUtcMidnight, localCivilDateOrUtc, utcMidnightToCivilDate } from '../biometrics/civilDate';
import { COIN_TX_OPTIONS, cheerEarns, lockUsers, logEarned, writeEarnsTx, type CoinWritten } from '../coins/ledger';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE, isUniqueViolation } from '../buddies/errors';
import { findPair, isBlockedEitherWay } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { roomOpen } from '../buddies/sharing';
import type { KipWornDTO } from '../cosmetics/worn';
import { shiftDate } from '../scoring/dates';
import { starterLayout } from './convert';
import { tierSize, type RoomLayout, type Tier } from './geometry';
import { countsOf, grantTotals, readLayout, toTier } from './layout';

type Db = Prisma.TransactionClient | typeof prisma;

export interface RoomVisitDTO {
  name: string;
  layout: RoomLayout;
  size: { n: number; m: number };
  kipColour: string;
  kipWorn: KipWornDTO;
  cheersThisWeek: number;
  cheeredToday: boolean;
}

const NOT_FOUND = () => new BuddyError('not_found');

/** A room id from a path: malformed or one's own is the uniform 404 (never not_buddies, which would say why). */
export function visitTarget(raw: string, viewerId: string): string {
  if (!UUID_RE.test(raw) || raw === viewerId) throw NOT_FOUND();
  return raw;
}

/** Buddies, no block either way, and the owner's room open (spec §10.1). */
export async function canVisit(viewerId: string, ownerId: string, db: Db = prisma): Promise<boolean> {
  const [pair, blocked, owner] = await Promise.all([
    findPair(viewerId, ownerId, db),
    isBlockedEitherWay(viewerId, ownerId, db),
    db.user.findUnique({ where: { id: ownerId }, select: { shareRoom: true } }),
  ]);
  return !!pair && !blocked && !!owner && roomOpen(owner);
}

/** The room as its owner's reads show it (P1 ruling 23's trim), or the starter room with no row. */
export async function readOwnedLayout(db: Db, userId: string): Promise<{ layout: RoomLayout; tier: Tier }> {
  const [rows, grants, row] = await Promise.all([
    db.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
    grantTotals(db, userId),
    db.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, tier: true } }),
  ]);
  const layout = (row ? readLayout(row.layout, countsOf(rows, grants)) : null) ?? starterLayout();
  return { layout, tier: toTier(row?.tier) };
}

/** The Monday and the Sunday of a civil date's ISO week. */
export function weekDays(today: string): [string, string] {
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday 0 … Sunday 6
  const monday = shiftDate(today, -weekday);
  return [monday, shiftDate(monday, 6)];
}

async function cheersInWeek(db: Db, ownerId: string, ownerTz: string, now: Date): Promise<number> {
  const [from, to] = weekDays(localCivilDateOrUtc(now, ownerTz));
  return db.roomCheer.count({ where: { toId: ownerId, localDate: { gte: civilDateToUtcMidnight(from), lte: civilDateToUtcMidnight(to) } } });
}

export async function readVisit(viewerId: string, ownerId: string, now: Date): Promise<RoomVisitDTO> {
  if (!(await canVisit(viewerId, ownerId))) throw NOT_FOUND();
  const [owner, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { ...PERSON_SELECT, timezone: true } }),
    prisma.user.findUnique({ where: { id: viewerId }, select: { timezone: true } }),
  ]);
  if (!owner || !viewer) throw NOT_FOUND();
  const person = toPerson(owner);
  const { layout, tier } = await readOwnedLayout(prisma, ownerId);
  const today = localCivilDateOrUtc(now, viewer.timezone);
  const [cheersThisWeek, mine] = await Promise.all([
    cheersInWeek(prisma, ownerId, owner.timezone, now),
    prisma.roomCheer.findUnique({ where: { fromId_toId_localDate: { fromId: viewerId, toId: ownerId, localDate: civilDateToUtcMidnight(today) } }, select: { id: true } }),
  ]);
  return { name: person.displayName, layout, size: tierSize(tier), kipColour: person.kipColour, kipWorn: person.kipWorn, cheersThisWeek, cheeredToday: !!mine };
}

/** One cheer per room per visitor's day, paying both people (spec §10.2, ruling 9). */
export async function cheerRoom(viewerId: string, ownerId: string, now: Date): Promise<{ paid: boolean }> {
  let written: CoinWritten[] = [];
  let paid = false;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, [viewerId, ownerId]);
      if (!(await canVisit(viewerId, ownerId, tx))) throw NOT_FOUND();
      const zones = await tx.user.findMany({ where: { id: { in: [viewerId, ownerId] } }, select: { id: true, timezone: true } });
      const tzOf = (id: string) => zones.find((z) => z.id === id)?.timezone ?? 'UTC';
      const giverDay = localCivilDateOrUtc(now, tzOf(viewerId));
      const ownerDay = localCivilDateOrUtc(now, tzOf(ownerId));
      const row = await tx.roomCheer.create({ data: { fromId: viewerId, toId: ownerId, localDate: civilDateToUtcMidnight(giverDay), createdAt: now }, select: { id: true } });
      const key = `cheer:${row.id}`;
      const given = await writeEarnsTx(tx, viewerId, [cheerEarns(key, giverDay, 'given')], now);
      const got = await writeEarnsTx(tx, ownerId, [cheerEarns(key, ownerDay, 'got')], now);
      written = [...given, ...got];
      paid = given.some((w) => w.amount > 0);
    }, COIN_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) throw new BuddyError('already_cheered');
    throw err;
  }
  logEarned(written);
  return { paid };
}

/** This week's cheers on my room, with the cheering buddies' names (spec §10.2: the owner sees who cheered). */
export async function listRoomCheers(userId: string, now: Date): Promise<{ count: number; cheers: Array<{ name: string; day: string }> }> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const [from, to] = weekDays(localCivilDateOrUtc(now, me?.timezone ?? 'UTC'));
  const rows = await prisma.roomCheer.findMany({
    where: { toId: userId, localDate: { gte: civilDateToUtcMidnight(from), lte: civilDateToUtcMidnight(to) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: { localDate: true, from: { select: { displayName: true, handle: true } } },
  });
  return { count: rows.length, cheers: rows.map((r) => ({ name: r.from.displayName ?? r.from.handle ?? '', day: utcMidnightToCivilDate(r.localDate) })) };
}
```

Create `backend/src/room/socialRoutes.ts`:

```ts
// KIP's room among buddies (spec 2026-10-15 §12 P4): visits and room cheers here; gifts (Task 6) and the weekly
// challenge (Task 7) join this router. All need a session, answer private no-store, and use the buddy error bodies.
// Every POST takes the 32 KB route parser (P2 ruling 26, P4 ruling 29).
import { Router, type Response } from 'express';
import { requireAuth } from '../auth/middleware';
import { buddyRoute } from '../buddies/errors';
import { noStore } from '../lib/noStore';
import { cheerRoom, listRoomCheers, readVisit, visitTarget } from './visit';

export const socialRoomRouter = Router();
/** The POST paths app.ts gives the 32 KB parser (Tasks 6 and 7 add theirs). */
export const SOCIAL_ROOM_POSTS: string[] = ['/me/buddies/:buddyId/room/cheer'];

const json = (res: Response, body: unknown, status = 200) => {
  noStore(res);
  res.status(status).json(body);
};

socialRoomRouter.get('/me/buddies/:buddyId/room', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await readVisit(req.userId!, visitTarget(String(req.params.buddyId), req.userId!), new Date()));
}));

socialRoomRouter.post('/me/buddies/:buddyId/room/cheer', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await cheerRoom(req.userId!, visitTarget(String(req.params.buddyId), req.userId!), new Date()));
}));

socialRoomRouter.get('/me/room/cheers', requireAuth, buddyRoute(async (req, res) => {
  json(res, await listRoomCheers(req.userId!, new Date()));
}));
```

(`noStore` is set before the handler can throw, so a `BuddyError` body is private no-store too.)

In `backend/src/app.ts`: import `{ SOCIAL_ROOM_POSTS, socialRoomRouter } from './room/socialRoutes'`; after the P2
`app.post([...], saveBodyParser)` line add `app.post(SOCIAL_ROOM_POSTS, saveBodyParser);` with the comment "// P4's
posts take the same 32 KB parser (P4 ruling 29)."; and after `app.use(coinsRouter);` add
`app.use(socialRoomRouter);`. `buddiesRouter`'s `/me/buddies/:buddyId` matches one path segment only, so
`/me/buddies/:buddyId/room` reaches this router.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/room/visit.test.ts tests/coins tests/buddies`
Expected: PASS. Then the full backend suite and `tsc` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/room/visit.ts backend/src/room/socialRoutes.ts backend/src/app.ts backend/src/buddies/errors.ts backend/tests/room/visit.test.ts backend/tests/challenges/helpers.ts
git commit -m "feat(room): visit a buddy's open room and cheer it, paying both people"
```

---

### Task 6: Backend: gifts (send a spare, list, open), returns on block or unpair, and expand keeping hidden pieces

Spec §10.3 (only spares; picked notes; the sender's count drops at once; a box on their floor; opening adds a NEW copy;
3 a day; buddies only; blocks both ways; returned on block or unpair, never because of a deletion; the sender's lock
and the re-check against the stored layout), §2.2 (`ItemGrant` keys `gift_out`, `gift_in`, `gift_back`; the save and
gift-send race), §12's gift rows and `gift.sent`. Rulings 11, 12, 13, 16. P2/P3's note on expand.

**Files:**
- Create: `backend/src/room/gifts.ts`, `backend/tests/room/gifts.test.ts`
- Modify: `backend/src/room/socialRoutes.ts`, `backend/src/buddies/relations.ts`, `backend/src/room/expand.ts`
- Modify (test): `backend/tests/room/expand.test.ts`

**Interfaces:**
- Consumes: Task 5's `socialRoomRouter`, `SOCIAL_ROOM_POSTS`; P1's `lockRoom`, `parseLayout`, `placedCounts`,
  `starterLayout`; P2's `countsOf`, `grantTotals`, `coveredBy`, `readLayout`, `geometryDeps`, `shippedItem`; buddies'
  `findPair`, `isBlockedEitherWay`, `BuddyError`, `UUID_RE`, `isUuid`, `localCivilDateOrUtc`.
- Produces: `GIFT_NOTES = ['desk', 'cosy', 'thought'] as const`, `type GiftNote`, `GIFTS_PER_DAY = 3`,
  `parseGift(body): { requestId: string; itemId: string; note: GiftNote } | null`,
  `sendGift(senderId, rawTo: string, body, now): Promise<{ id: string; counts: Record<string, number> }>`,
  `interface GiftDTO { id: string; itemId: string; note: GiftNote; from: { name: string } | null; quiet: boolean; at: string }`,
  `listGifts(userId): Promise<{ gifts: GiftDTO[] }>`,
  `openGift(userId, giftId, now): Promise<{ counts: Record<string, number> }>`,
  `returnGiftsTx(tx, a, b, now): Promise<number>`; routes `POST /me/buddies/:buddyId/gifts` (201),
  `GET /me/gifts`, `POST /me/gifts/:id/open`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/room/gifts.test.ts`:

```ts
// Gifts of spare pieces (spec 2026-10-15 §10.3, §2.2, §12; P4 rulings 11-13, 16).
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { deleteUserAccount } from '../../src/users/deletion';
import { api } from '../buddies/helpers';
import { pairedPair } from '../challenges/helpers';
import { piece, withPieces } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const noop = { deleteSubscription: async () => {}, revokeToken: async () => {}, log: () => {} };
/** One more fern for a user (a bought copy), so the starter fern has a spare. */
const extraFern = (userId: string) => prisma.itemGrant.create({ data: { userId, itemId: 'plant.fern', qty: 1, sourceKey: `buy:${randomUUID()}` } });
const send = async (h: Record<string, string>, to: string, body: object) => (await api()).post(`/me/buddies/${to}/gifts`).set(h).send(body);
const gift = (over: object = {}) => ({ requestId: randomUUID(), itemId: 'plant.fern', note: 'cosy', ...over });

describe('POST /me/buddies/:buddyId/gifts', () => {
  it('sends a spare: the sender\'s count drops at once; a retry is the same gift (ruling 11)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    const res = await send(ha, b.id, body);
    expect([res.status, res.body]).toEqual([201, { id: body.requestId, counts: expect.objectContaining({ 'plant.fern': 1 }) }]);
    const again = await send(ha, b.id, body);
    expect([again.status, again.body.id]).toEqual([201, body.requestId]);
    expect(await prisma.itemGrant.count({ where: { userId: a.id, sourceKey: `gift_out:${body.requestId}` } })).toBe(1);
    const other = await send(ha, b.id, { ...body, itemId: 'plant.cactus' });
    expect([other.status, other.body]).toEqual([400, { error: 'invalid_body' }]);
    expect(quiet.mock.calls.map(([line]) => line)).toContain(JSON.stringify({ event: 'gift.sent' }));
  });

  it('only a spare: the last copy, or a copy that is placed, is 403 not_spare', async () => {
    const { b, ha } = await pairedPair();
    const res = await send(ha, b.id, gift()); // one fern, placed in the starter room
    expect([res.status, res.body]).toEqual([403, { error: 'not_spare' }]);
    const style = await send(ha, b.id, gift({ itemId: 'wall.plain' }));
    expect([style.status, style.body]).toEqual([400, { error: 'invalid_body' }]);
    const typed = await send(ha, b.id, gift({ note: 'hello there' }));
    expect([typed.status, typed.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('three a day, buddies only, blocks both ways (spec §10.3)', async () => {
    const { a, b, ha } = await pairedPair();
    await prisma.itemGrant.create({ data: { userId: a.id, itemId: 'plant.fern', qty: 4, sourceKey: `buy:${randomUUID()}` } });
    for (let k = 0; k < 3; k++) expect((await send(ha, b.id, gift())).status).toBe(201);
    const fourth = await send(ha, b.id, gift());
    expect([fourth.status, fourth.body]).toEqual([429, { error: 'gift_limit' }]);
    await prisma.buddyBlock.create({ data: { blockerId: b.id, blockedId: a.id } });
    expect((await send(ha, b.id, gift())).body).toEqual({ error: 'not_buddies' });
  });

  it('a gift racing a save that places the last spare: exactly one wins (spec §2.2; Review Focus 2)', async () => {
    const { a, b, ha } = await pairedPair();
    await extraFern(a.id);
    const layout = withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 }));
    const [saved, sent] = await Promise.all([
      (await api()).put('/me/cosmetics').set(ha).send({ layout, worn: { ...EMPTY_WORN }, version: 0 }),
      send(ha, b.id, gift()),
    ]);
    expect([saved.status, sent.status].sort()).toEqual([200, 403].sort());
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: a.id } });
    const owned = 2 + (await prisma.itemGrant.aggregate({ where: { userId: a.id, sourceKey: { startsWith: 'gift_out:' } }, _sum: { qty: true } }))._sum.qty!;
    const placed = row ? (row.layout as { pieces: Array<{ item: string }> }).pieces.filter((p) => p.item === 'plant.fern').length : 1;
    expect(placed).toBeLessThanOrEqual(owned);
  });
});

describe('GET /me/gifts and POST /me/gifts/:id/open', () => {
  it('lists unopened gifts with the sender\'s name and quiet for a muted sender; opening adds a NEW copy once', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift({ note: 'desk' });
    await send(ha, b.id, body);
    await prisma.buddyMute.create({ data: { muterId: b.id, mutedId: a.id } });
    const list = await (await api()).get('/me/gifts').set(hb);
    expect([list.headers['cache-control'], list.body]).toEqual(['private, no-store', { gifts: [{ id: body.requestId, itemId: 'plant.fern', note: 'desk', from: { name: 'Sam' }, quiet: true, at: expect.any(String) }] }]);
    const opened = await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
    expect([opened.status, opened.body.counts['plant.fern']]).toEqual([200, 2]);
    const twice = await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({});
    expect([twice.status, twice.body.counts['plant.fern']]).toEqual([200, 2]);
    // NEW in the recipient's cosmetics until seen (P2 ruling 7: an unseen positive grant is fresh).
    const cos = await (await api()).get('/me/cosmetics').set(hb);
    expect(cos.body.fresh).toContainEqual({ itemId: 'plant.fern', source: 'gift_in' });
    expect((await (await api()).get('/me/gifts').set(hb)).body).toEqual({ gifts: [] });
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(ha).send({})).body).toEqual({ error: 'gift_gone' });
  });

  it('a gift from a since-deleted gifter is still delivered, named nobody (controller ruling; Review Focus 4)', async () => {
    const { a, b, ha, hb } = await pairedPair();
    await extraFern(a.id);
    const body = gift();
    await send(ha, b.id, body);
    await deleteUserAccount(a.id, noop);
    expect((await (await api()).get('/me/gifts').set(hb)).body.gifts[0]).toMatchObject({ id: body.requestId, from: null, quiet: false });
    expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).status).toBe(200);
  });

  it('an unopened gift goes back to its sender on a block or an unpair, never twice (ruling 12; Review Focus 5)', async () => {
    for (const end of ['unpair', 'block'] as const) {
      const { a, b, ha, hb } = await pairedPair();
      await extraFern(a.id);
      const body = gift();
      await send(ha, b.id, body);
      if (end === 'unpair') await (await api()).delete(`/me/buddies/${a.id}`).set(hb);
      else await (await api()).post(`/me/buddies/${a.id}/block`).set(hb).send({});
      expect(await prisma.gift.findUnique({ where: { id: body.requestId } })).toMatchObject({ returnedAt: expect.any(Date), openedAt: null });
      expect(await prisma.itemGrant.count({ where: { userId: a.id, sourceKey: `gift_back:${body.requestId}` } })).toBe(1);
      expect((await (await api()).post(`/me/gifts/${body.requestId}/open`).set(hb).send({})).body).toEqual({ error: 'gift_gone' });
    }
  });
});
```

In `backend/tests/room/expand.test.ts` add (use the file's own gate helpers; it already grows rooms with coins and a
CHECK_IN level-II achievement):

```ts
it('keeps a piece the read trim hides for its count, instead of dropping it (P2/P3 note; ruling 16)', async () => {
  const { user, headers } = await readyToGrow(); // the file's helper: 600 coins and the CHECK_IN II badge
  const layout = withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 }));
  // Two ferns placed, one owned (the starter): the read hides p1, the stored row keeps it.
  await prisma.cosmeticLoadout.create({ data: { userId: user.id, layout: layout as never, worn: { ...EMPTY_WORN }, version: 1 } });
  const res = await (await api()).post('/me/room/expand').set(headers).send({ requestId: randomUUID(), toTier: 2 });
  expect([res.status, res.body.stored]).toEqual([200, 0]);
  const row = await prisma.cosmeticLoadout.findUniqueOrThrow({ where: { userId: user.id } });
  expect((row.layout as { pieces: Array<{ id: string }> }).pieces.map((p) => p.id)).toContain('p1');
  expect(res.body.layout.pieces.map((p: { id: string }) => p.id)).not.toContain('p1');
});
```

(If the file has no `readyToGrow`, write it from the file's existing setup lines: a `coinUser`, `fund(user.id, 600)`
and `prisma.achievement.create({ data: { userId, family: 'CHECK_IN', level: 2, value: 14, earnedOn, weekStart, monthStart } })`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/room/gifts.test.ts tests/room/expand.test.ts`
Expected: FAIL (no gift routes; expand drops `p1`).

- [ ] **Step 3: Implement**

Create `backend/src/room/gifts.ts`:

```ts
// Gifts of spare pieces (spec 2026-10-15 §10.3). Only a spare: a placeable piece you own at least twice with at least
// one copy not placed in your stored room; you always keep one of everything. Coins are never gifted, and nothing is
// bought for a gift. The note is picked from a fixed list, never typed. Sending runs under the sender's room lock (the
// one every save takes, §2.2) and re-checks the spare against the stored layout as written, not as the read trims it
// (P4 ruling 11), so a save and a gift can never both use the last spare. 3 a day in the sender's local day; buddies
// only; blocks both ways. A gift is returned to its sender on a block or an unpair (returnGiftsTx), never because an
// account was deleted (the cascade drops gifts to the deleted user; gifts from them keep coming, fromId null). Logs
// the event name only.
import type { Prisma } from '@prisma/client';
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { shippedItem } from '../cosmetics/catalogue';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE } from '../buddies/errors';
import { findPair, isBlockedEitherWay } from '../buddies/pairs';
import { isUuid } from '../lib/uuid';
import { COIN_TX_OPTIONS } from '../coins/ledger';
import { starterLayout } from './convert';
import { parseLayout, placedCounts } from './geometry';
import { countsOf, grantTotals } from './layout';
import { lockRoom } from './lock';

export const GIFT_NOTES = ['desk', 'cosy', 'thought'] as const;
export type GiftNote = (typeof GIFT_NOTES)[number];
export const GIFTS_PER_DAY = 3;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export interface GiftDTO { id: string; itemId: string; note: GiftNote; from: { name: string } | null; quiet: boolean; at: string }

/** Exactly `{ requestId: <uuid>, itemId, note }` with a known note, or null. */
export function parseGift(body: unknown): { requestId: string; itemId: string; note: GiftNote } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'itemId,note,requestId') return null;
  if (!isUuid(b.requestId) || typeof b.itemId !== 'string' || b.itemId.length > 64) return null;
  if (!(GIFT_NOTES as readonly unknown[]).includes(b.note)) return null;
  return { requestId: b.requestId, itemId: b.itemId, note: b.note as GiftNote };
}

async function countsFor(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<Record<string, number>> {
  const [rows, grants] = await Promise.all([db.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }), grantTotals(db, userId)]);
  return countsOf(rows, grants);
}

export async function sendGift(senderId: string, rawTo: string, body: unknown, now: Date): Promise<{ id: string; counts: Record<string, number> }> {
  if (!UUID_RE.test(rawTo) || rawTo === senderId) throw new BuddyError('not_buddies');
  const parsed = parseGift(body);
  if (!parsed || !shippedItem(parsed.itemId)?.iso) throw new BuddyError('invalid_body');
  const toId = rawTo;
  const sent = await prisma.$transaction(async (tx) => {
    await lockRoom(tx, senderId);
    const before = await tx.gift.findUnique({ where: { id: parsed.requestId }, select: { fromId: true, toId: true, itemId: true } });
    if (before) {
      // A request id names one gift (ruling 11): its retry answers again; reused for another gift it is a bad body.
      if (before.fromId === senderId && before.toId === toId && before.itemId === parsed.itemId) return false;
      throw new BuddyError('invalid_body');
    }
    if (!(await findPair(senderId, toId, tx)) || (await isBlockedEitherWay(senderId, toId, tx))) throw new BuddyError('not_buddies');
    const me = await tx.user.findUniqueOrThrow({ where: { id: senderId }, select: { timezone: true } });
    const today = localCivilDateOrUtc(now, me.timezone);
    const recent = await tx.gift.findMany({ where: { fromId: senderId, createdAt: { gt: new Date(now.getTime() - TWO_DAYS_MS) } }, select: { createdAt: true } });
    if (recent.filter((g) => localCivilDateOrUtc(g.createdAt, me.timezone) === today).length >= GIFTS_PER_DAY) throw new BuddyError('gift_limit');
    const counts = await countsFor(tx, senderId);
    const row = await tx.cosmeticLoadout.findUnique({ where: { userId: senderId }, select: { layout: true } });
    // The stored layout as written (ruling 11): a copy the read trim hides is still placed here.
    const stored = (row ? parseLayout(row.layout) : null) ?? starterLayout();
    const owned = counts[parsed.itemId] ?? 0;
    const placed = placedCounts(stored)[parsed.itemId] ?? 0;
    if (owned < 2 || owned - placed < 1) throw new BuddyError('not_spare');
    await tx.gift.create({ data: { id: parsed.requestId, fromId: senderId, toId, itemId: parsed.itemId, note: parsed.note, createdAt: now } });
    await tx.itemGrant.create({ data: { userId: senderId, itemId: parsed.itemId, qty: -1, sourceKey: `gift_out:${parsed.requestId}`, seenAt: now } });
    return true;
  }, COIN_TX_OPTIONS);
  if (sent) console.info(JSON.stringify({ event: 'gift.sent' }));
  return { id: parsed.requestId, counts: await countsFor(prisma, senderId) };
}

/** Unopened gifts to me, oldest first. `quiet`: I muted the sender, so the app shows the box but no line (ruling 13). */
export async function listGifts(userId: string): Promise<{ gifts: GiftDTO[] }> {
  const rows = await prisma.gift.findMany({
    where: { toId: userId, openedAt: null, returnedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fromId: true, itemId: true, note: true, createdAt: true, from: { select: { displayName: true, handle: true } } },
  });
  const senders = [...new Set(rows.flatMap((r) => (r.fromId ? [r.fromId] : [])))];
  const mutes = senders.length ? await prisma.buddyMute.findMany({ where: { muterId: userId, mutedId: { in: senders } }, select: { mutedId: true } }) : [];
  const muted = new Set(mutes.map((m) => m.mutedId));
  return {
    gifts: rows.map((r) => ({
      id: r.id, itemId: r.itemId, note: r.note as GiftNote,
      from: r.from ? { name: r.from.displayName ?? r.from.handle ?? '' } : null,
      quiet: !!r.fromId && muted.has(r.fromId),
      at: r.createdAt.toISOString(),
    })),
  };
}

/** Opens a gift once: the piece joins my inventory, NEW until seen. An opened gift answers again; a returned one or
 * another person's is gone. */
export async function openGift(userId: string, giftId: string, now: Date): Promise<{ counts: Record<string, number> }> {
  if (!UUID_RE.test(giftId)) throw new BuddyError('gift_gone');
  await prisma.$transaction(async (tx) => {
    await lockRoom(tx, userId);
    const gift = await tx.gift.findUnique({ where: { id: giftId }, select: { toId: true, itemId: true, returnedAt: true } });
    if (!gift || gift.toId !== userId || gift.returnedAt) throw new BuddyError('gift_gone');
    const opened = await tx.gift.updateMany({ where: { id: giftId, openedAt: null, returnedAt: null }, data: { openedAt: now } });
    if (opened.count === 1) await tx.itemGrant.create({ data: { userId, itemId: gift.itemId, qty: 1, sourceKey: `gift_in:${giftId}` } });
  }, COIN_TX_OPTIONS);
  return { counts: await countsFor(prisma, userId) };
}

/**
 * Inside unpair's or block's transaction (ruling 12): every unopened gift between the two goes back to its sender, each
 * once (the conditional update decides, so an open landing at the same moment wins or loses cleanly). Answers how many.
 */
export async function returnGiftsTx(tx: Prisma.TransactionClient, a: string, b: string, now: Date): Promise<number> {
  const open = await tx.gift.findMany({
    where: { openedAt: null, returnedAt: null, OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
    select: { id: true, fromId: true, itemId: true },
  });
  let back = 0;
  for (const g of open) {
    const done = await tx.gift.updateMany({ where: { id: g.id, openedAt: null, returnedAt: null }, data: { returnedAt: now } });
    if (done.count === 1 && g.fromId) {
      await tx.itemGrant.createMany({ data: [{ userId: g.fromId, itemId: g.itemId, qty: 1, sourceKey: `gift_back:${g.id}` }], skipDuplicates: true });
      back++;
    }
  }
  return back;
}
```

In `backend/src/room/socialRoutes.ts` add (and import `listGifts`, `openGift`, `sendGift` from `./gifts`):

```ts
SOCIAL_ROOM_POSTS.push('/me/buddies/:buddyId/gifts', '/me/gifts/:id/open');

socialRoomRouter.post('/me/buddies/:buddyId/gifts', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await sendGift(req.userId!, String(req.params.buddyId), req.body, new Date()), 201);
}));

socialRoomRouter.get('/me/gifts', requireAuth, buddyRoute(async (req, res) => {
  json(res, await listGifts(req.userId!));
}));

socialRoomRouter.post('/me/gifts/:id/open', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await openGift(req.userId!, String(req.params.id), new Date()));
}));
```

(`SOCIAL_ROOM_POSTS` is read by `app.ts` when it builds the app, after every route module has loaded, so the pushes
are in place; a test in Step 1's file already sends a 32 KB-capped POST through it.)

In `backend/src/buddies/relations.ts`, import `returnGiftsTx` from `../room/gifts` and:
- in `unpair`, after `if (removed.count === 0) return;` add `await returnGiftsTx(tx, userId, buddyId, now);`;
- in `blockTx`, after the `buddyPair.deleteMany` line add `await returnGiftsTx(tx, blockerId, blockedId, now);`;
and add to the header comment: "Free-build P4: unpair and block also return every unopened gift between the two to its
sender (spec 2026-10-15 §10.3); an account deletion's cascade never does."

In `backend/src/room/expand.ts`, import `shippedItem` from `../cosmetics/catalogue` and `parseLayout` from
`./geometry`, and replace the three lines from `const layout = row ? readLayout(…)` to the `const next = …` line with:

```ts
    // Ruling 16 (the P2/P3 note): the room is written back as STORED, minus what the new window covers, so a piece the
    // read trim only hides for its count is kept; `stored` counts only the pieces the user could see.
    const raw = row ? parseLayout(row.layout) : starterLayout();
    if (!raw) throw new StoredLayoutError();
    const visible = (row ? readLayout(row.layout, countsOf(rows, grants)) : null) ?? raw;
    const gone = coveredBy({ ...raw, pieces: raw.pieces.filter((p) => !!shippedItem(p.item)?.iso) }, parsed.toTier, geometryDeps);
    const next = { ...raw, pieces: raw.pieces.filter((p) => !gone.has(p.id)) } as unknown as Prisma.InputJsonValue;
```

and make the transaction answer `{ stored: visible.pieces.filter((p) => gone.has(p.id)).length, grew: true }`. Update
the function's doc comment's last sentence to "The covered pieces are judged on the stored layout; the count the card
shows is of the pieces every read showed (ruling 16)."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/room tests/buddies tests/coins`
Expected: PASS (the existing expand tests, including the loft window's stored pieces, still pass). Then the full
backend suite and `tsc` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/room/gifts.ts backend/src/room/socialRoutes.ts backend/src/buddies/relations.ts backend/src/room/expand.ts backend/tests/room/gifts.test.ts backend/tests/room/expand.test.ts
git commit -m "feat(room): send spare pieces as gifts, open them, return them on block or unpair"
```

---

### Task 7: Backend: weekly challenges (entry and its snapshot, entry cheers, results, the trophy)

Spec §10.4 (the week from Monday to the entrant's Sunday 20:00; the brief; entering is the opt-in for the snapshot;
the entry is the room, copied on every save while open; +30 once at the first moment the entry meets the brief; one
cheer per entry per buddy per week, never your own, only before the entrant's close; results after Monday 08:00 UTC
in your own circle frozen at your close, at least 3 entries, ties win; the trophy once; entries seen only by buddies),
§12's challenge rows and `challenge.entered`, §6.2 (entry 30, uncapped; entry cheers keyed `ccheer:…`). Rulings 4–7,
10, 28.

**Files:**
- Create: `backend/src/challenges/week.ts`, `backend/src/challenges/entries.ts`, `backend/src/challenges/judge.ts`,
  `backend/tests/challenges/entries.test.ts`, `backend/tests/challenges/judge.test.ts`
- Modify: `backend/src/room/socialRoutes.ts`, `backend/src/cosmetics/loadout.ts`

**Interfaces:**
- Consumes: Task 4's `themeFor`, `meetsBrief`, `briefCount`, `Theme`, `weekNumber`; Task 5's `readOwnedLayout`,
  `socialRoomRouter`, `SOCIAL_ROOM_POSTS`, `json` pattern; Task 3's `lockUsers`, `writeEarnsTx`, `cheerEarns`,
  `logEarned`, `applyCoinEvents`; `buddyIdsOf` (`social/circle.ts`), `findPair`, `isBlockedEitherWay`,
  `PERSON_SELECT`, `toPerson`, `isoWeekKey`, `localMidnightInstant`, `localCivilDateOrUtc`, `civilDateToUtcMidnight`,
  `shiftDate`, `EARN_AMOUNTS`, `lockRoom`, `tierSize`.
- Produces:
  - `week.ts`: `challengeClock: { now: () => Date }` (tests move it, as `coinsConfig` is moved);
    `weekOf(now: Date, tz: string): string`; `mondayOf(weekId: string): string`;
    `closesAt(weekId: string, tz: string): Date`; `resultsAt(weekId: string): Date`;
    `previousWeek(weekId: string): string`;
  - `entries.ts`: `interface Snapshot { layout: RoomLayout; size: { n: number; m: number } }`;
    `interface EntryDTO { userId: string; name: string; kipColour: string; kipWorn: KipWornDTO; snapshot: Snapshot;
    cheers: number; cheeredByMe: boolean; mine: boolean }`;
    `interface ChallengeDTO { week: string; theme: { id: ThemeId; tag: ChallengeTag; atLeast: number; themePiece: string; trophy: string } | null;
    closesAt: string | null; open: boolean; entry: { count: number; meets: boolean; paid: boolean } | null;
    entries: EntryDTO[]; results: ResultsDTO | null }`;
    `enterChallenge(userId, now): Promise<ChallengeDTO>`; `readChallenge(userId, now): Promise<ChallengeDTO>`;
    `cheerEntry(viewerId, rawTarget: string, now): Promise<{ paid: boolean }>`;
    `snapshotOnSaveTx(tx, userId, layout, tier, now): Promise<{ weekId: string; theme: Theme } | null>`;
    `payEntryIfMet(userId, weekId, layout, theme, now): Promise<void>` (never throws);
  - `judge.ts`: `judgeCircle(counts: ReadonlyMap<string, number>): { ranked: boolean; winners: string[] }`;
    `settleChallenges(userId, now): Promise<number>`; `settleChallengesSafely(userId, now): Promise<void>`;
    `interface ResultsDTO { week: string; themeId: ThemeId | null; ranked: boolean; winners: string[];
    entries: Array<{ name: string; cheers: number; mine: boolean }>; you: { entered: boolean; won: boolean } }`;
    `readResults(userId, now): Promise<ResultsDTO | null>`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/challenges/entries.test.ts`:

```ts
// Weekly theme challenges (spec 2026-10-15 §10.4, §12; P4 rulings 4-7, 10).
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { challengeClock, closesAt, resultsAt, weekOf } from '../../src/challenges/week';
import { cheerEntry, enterChallenge, readChallenge } from '../../src/challenges/entries';
import { api, buddyUser, pairUp } from '../buddies/helpers';
import { authHeaderFor } from '../helpers/auth';
import { piece, withPieces } from '../room/helpers';
import { rowsOf } from '../coins/helpers';
import { openRoom, pairedPair } from './helpers';

const CLOCK = challengeClock.now;
beforeAll(() => migrateTestDb());
afterAll(async () => {
  challengeClock.now = CLOCK;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const WED = new Date('2026-10-28T12:00:00.000Z'); // 2026-W44, Cosy autumn
const warm = withPieces(piece('p1', 'corner.pumpkin', { x: 6, y: 6 }), piece('p2', 'corner.pumpkin', { x: 5, y: 6 }));
const save = async (userId: string, layout: unknown, version: number) =>
  (await api()).put('/me/cosmetics').set(await authHeaderFor(userId)).send({ layout, worn: { ...EMPTY_WORN }, version });
const buyPumpkins = (userId: string) => prisma.itemGrant.create({ data: { userId, itemId: 'corner.pumpkin', qty: 2, sourceKey: `buy:pk-${userId}` } });

it('weeks close at each entrant\'s own Sunday 20:00; results from Monday 08:00 UTC (ruling 5; Review Focus 3)', () => {
  expect(weekOf(WED, 'Pacific/Auckland')).toBe('2026-W44');
  expect(closesAt('2026-W44', 'Pacific/Auckland').toISOString()).toBe('2026-11-01T07:00:00.000Z');
  // 1 November 2026 is also the day Los Angeles leaves daylight time: 20:00 PST is 04:00 UTC on the Monday.
  expect(closesAt('2026-W44', 'America/Los_Angeles').toISOString()).toBe('2026-11-02T04:00:00.000Z');
  expect(resultsAt('2026-W44').toISOString()).toBe('2026-11-02T08:00:00.000Z');
});

it('no challenge before the first theme week: 404 no_challenge', async () => {
  const u = await buddyUser();
  await expect(enterChallenge(u.id, new Date('2026-10-20T12:00:00.000Z'))).rejects.toMatchObject({ code: 'no_challenge' });
});

it('entering snapshots the room; +30 pays once, at entry when it meets the brief (spec §10.4)', async () => {
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await prisma.cosmeticLoadout.create({ data: { userId: u.id, layout: warm as never, worn: { ...EMPTY_WORN }, version: 1 } });
  const dto = await enterChallenge(u.id, WED);
  expect(dto).toMatchObject({ week: '2026-W44', theme: { id: 'cosyAutumn', tag: 'warm', atLeast: 3 }, open: true, entry: { meets: true, paid: true } });
  await enterChallenge(u.id, WED);
  expect((await rowsOf(u.id)).filter((r) => r.kind === 'challenge').map((r) => [r.sourceKey, r.amount])).toEqual([['challenge:2026-W44', 30]]);
  expect(quiet.mock.calls.map(([l]) => l)).toContain(JSON.stringify({ event: 'challenge.entered' }));
});

it('a later save that brings the entry up to the brief pays then; a save after the close changes nothing', async () => {
  challengeClock.now = () => WED;
  const u = await buddyUser();
  await buyPumpkins(u.id);
  await enterChallenge(u.id, WED); // the starter room: the amber lamp and the mug, 2 warm pieces
  expect((await readChallenge(u.id, WED)).entry).toEqual({ count: 2, meets: false, paid: false });
  expect((await save(u.id, warm, 0)).status).toBe(200);
  const entry = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
  expect((entry.snapshot as { layout: { pieces: unknown[] } }).layout.pieces).toHaveLength(warm.pieces.length);
  expect(entry.paidAt).not.toBeNull();
  challengeClock.now = () => new Date('2026-11-01T21:00:00.000Z'); // after UTC's Sunday 20:00
  expect((await save(u.id, withPieces(), 1)).status).toBe(200);
  const after = await prisma.challengeEntry.findUniqueOrThrow({ where: { userId_weekId: { userId: u.id, weekId: '2026-W44' } } });
  expect((after.snapshot as { layout: { pieces: unknown[] } }).layout.pieces).toHaveLength(warm.pieces.length);
  challengeClock.now = CLOCK;
});

it('buddies see an entry even with visits off; the visit stays closed (controller ruling, §10.4)', async () => {
  const { a, b, ha } = await pairedPair();
  await enterChallenge(b.id, WED);
  const seen = await readChallenge(a.id, WED);
  expect(seen.entries.map((e) => [e.userId, e.mine, e.cheers])).toEqual([[b.id, false, 0]]);
  expect(Object.keys(seen.entries[0]!.snapshot).sort()).toEqual(['layout', 'size']);
  expect(JSON.stringify(seen)).not.toMatch(/tier|living|balance|counts|badges/);
  expect((await (await api()).get(`/me/buddies/${b.id}/room`).set(ha)).status).toBe(404);
});

it('entry cheers: buddies only, never your own, once, only before the entrant\'s own close (ruling 10; Review Focus 3)', async () => {
  const nz = await buddyUser({ timezone: 'Pacific/Auckland' });
  const la = await buddyUser({ timezone: 'America/Los_Angeles' });
  const fan = await buddyUser();
  await pairUp(fan.id, nz.id);
  await pairUp(fan.id, la.id);
  await enterChallenge(nz.id, WED);
  await enterChallenge(la.id, WED);
  await expect(cheerEntry(nz.id, nz.id, WED)).rejects.toMatchObject({ code: 'not_found' });
  await expect(cheerEntry(nz.id, la.id, WED)).rejects.toMatchObject({ code: 'not_found' }); // not buddies
  expect(await cheerEntry(fan.id, nz.id, WED)).toEqual({ paid: true });
  await expect(cheerEntry(fan.id, nz.id, WED)).rejects.toMatchObject({ code: 'already_cheered' });
  const sunday = new Date('2026-11-01T10:00:00.000Z'); // after Auckland's close, before Los Angeles'
  await expect(cheerEntry(fan.id, la.id, new Date('2026-11-02T05:00:00.000Z'))).rejects.toMatchObject({ code: 'challenge_closed' });
  expect(await cheerEntry(fan.id, la.id, sunday)).toEqual({ paid: true });
  expect((await rowsOf(nz.id)).filter((r) => r.kind === 'cheer_got').map((r) => r.sourceKey)).toEqual([`ccheer:2026-W44:${fan.id}:${nz.id}:got`]);
});

it('the routes answer private no-store and refuse an unknown entrant with the uniform 404', async () => {
  challengeClock.now = () => WED;
  const { a, b, ha } = await pairedPair();
  await openRoom(b.id);
  const get = await (await api()).get('/me/challenge').set(ha);
  expect([get.status, get.headers['cache-control'], get.body.theme?.id]).toEqual([200, 'private, no-store', 'cosyAutumn']);
  const entered = await (await api()).post('/me/challenge/entry').set(ha).send({});
  expect([entered.status, entered.body.entry?.paid]).toEqual([200, false]);
  const cheer = await (await api()).post(`/me/challenge/entries/${b.id}/cheer`).set(ha).send({});
  expect([cheer.status, cheer.body]).toEqual([404, { error: 'not_found' }]); // b has no entry
  expect(a.id).not.toBe(b.id);
  challengeClock.now = CLOCK;
});
```

Create `backend/tests/challenges/judge.test.ts`:

```ts
// Results in your own circle (spec 2026-10-15 §10.4; P4 rulings 6, 28).
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { judgeCircle, readResults, settleChallenges } from '../../src/challenges/judge';
import { buddyUser, pairUp } from '../buddies/helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const W = '2026-W44';
const BEFORE = new Date('2026-11-02T07:59:00.000Z');
const AFTER = new Date('2026-11-02T08:00:00.000Z');

async function circleOf(n: number) {
  const users = await Promise.all(Array.from({ length: n }, () => buddyUser()));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) await pairUp(users[i]!.id, users[j]!.id);
  for (const u of users) {
    await prisma.challengeEntry.create({ data: { userId: u.id, weekId: W, snapshot: {}, circle: users.filter((o) => o.id !== u.id).map((o) => o.id) } });
  }
  return users;
}
const cheers = (weekId: string, to: string, from: string[]) =>
  prisma.challengeCheer.createMany({ data: from.map((f) => ({ weekId, fromId: f, toId: to })) });

it('the most cheers win, ties all win, no ranking under 3 entries', () => {
  expect(judgeCircle(new Map([['a', 2], ['b', 2], ['c', 1]]))).toEqual({ ranked: true, winners: ['a', 'b'] });
  expect(judgeCircle(new Map([['a', 3], ['b', 0]]))).toEqual({ ranked: false, winners: [] });
  expect(judgeCircle(new Map([['a', 0], ['b', 0], ['c', 0]]))).toEqual({ ranked: true, winners: ['a', 'b', 'c'] });
});

it('grants the trophy once, only from Monday 08:00 UTC, to every tied winner', async () => {
  const [a, b, c] = await circleOf(3);
  await cheers(W, a!.id, [b!.id, c!.id]);
  await cheers(W, b!.id, [a!.id, c!.id]);
  await cheers(W, c!.id, [a!.id]);
  expect(await settleChallenges(a!.id, BEFORE)).toBe(0);
  expect(await readResults(a!.id, BEFORE)).toBeNull();
  for (const u of [a!, b!, c!]) await settleChallenges(u.id, AFTER);
  await settleChallenges(a!.id, AFTER);
  const prizes = await prisma.itemGrant.findMany({ where: { sourceKey: `prize:${W}`, userId: { in: [a!.id, b!.id, c!.id] } }, select: { userId: true, itemId: true } });
  expect(prizes.map((p) => [p.userId, p.itemId]).sort()).toEqual([[a!.id, 'corner.acorn'], [b!.id, 'corner.acorn']].sort());
  const res = await readResults(a!.id, AFTER);
  expect(res).toMatchObject({ week: W, themeId: 'cosyAutumn', ranked: true, you: { entered: true, won: true } });
  expect(res!.entries.map((e) => e.cheers).sort()).toEqual([1, 2, 2]);
  expect(res!.winners).toHaveLength(2);
});

it('under 3 entries nobody is ranked and nobody gets the trophy (C3\'s risk)', async () => {
  const [a, b] = await circleOf(2);
  await cheers(W, a!.id, [b!.id]);
  await settleChallenges(a!.id, AFTER);
  expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(0);
  expect(await readResults(a!.id, AFTER)).toMatchObject({ ranked: false, winners: [], you: { entered: true, won: false } });
});

it('the circle is the one frozen on the entry: a buddy paired after the close is not in it', async () => {
  const [a, b, c] = await circleOf(3);
  const late = await buddyUser();
  await pairUp(a!.id, late.id);
  await prisma.challengeEntry.create({ data: { userId: late.id, weekId: W, snapshot: {}, circle: [a!.id] } });
  await cheers(W, late.id, [a!.id, b!.id, c!.id]);
  await settleChallenges(a!.id, AFTER);
  expect(await prisma.itemGrant.count({ where: { userId: a!.id, sourceKey: `prize:${W}` } })).toBe(1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/challenges`
Expected: FAIL (no `challenges/week`, `entries`, `judge`).

- [ ] **Step 3: Implement**

Create `backend/src/challenges/week.ts`:

```ts
// A challenge's week (spec 2026-10-15 §10.4; P4 ruling 5): the entrant's local ISO week, closing at their own Sunday
// 20:00, with results from Monday 08:00 UTC, when every zone's Sunday 20:00 has passed. Civil dates only through the
// helpers.
import { civilDateToUtcMidnight, localCivilDateOrUtc, localMidnightInstant } from '../biometrics/civilDate';
import { isoWeekKey } from '../habits/job';
import { weekNumber } from '../coins/shopWeeks';
import { shiftDate } from '../scoring/dates';

const HOUR_MS = 60 * 60 * 1000;
/** The routes' clock; tests move it, as coinsConfig.launchedAt is moved. OWNER NOTE: a dev server may pin it with
 * CHALLENGE_NOW (an ISO instant) so the simulator check can run a challenge week early; production leaves it unset. */
const pinned = process.env.CHALLENGE_NOW ? new Date(process.env.CHALLENGE_NOW) : null;
export const challengeClock: { now: () => Date } = {
  now: () => (pinned && !Number.isNaN(pinned.getTime()) ? new Date(pinned) : new Date()),
};

export function weekOf(now: Date, tz: string): string {
  return isoWeekKey(civilDateToUtcMidnight(localCivilDateOrUtc(now, tz)));
}

/** The Monday ('YYYY-MM-DD') of an ISO week: day numbers of Mondays are 4 mod 7 (1970-01-05 is day 4). */
export function mondayOf(weekId: string): string {
  const n = weekNumber(weekId);
  if (n === null) throw new Error('challenges: a malformed week');
  return new Date((n * 7 + 4) * 86_400_000).toISOString().slice(0, 10);
}

/** Sunday 20:00 in the zone: four hours before the next Monday begins there (exact unless the clocks change in those
 * four hours, which no zone's current rule does). */
export function closesAt(weekId: string, tz: string): Date {
  return new Date(localMidnightInstant(shiftDate(mondayOf(weekId), 7), tz).getTime() - 4 * HOUR_MS);
}

export function resultsAt(weekId: string): Date {
  return new Date(civilDateToUtcMidnight(shiftDate(mondayOf(weekId), 7)).getTime() + 8 * HOUR_MS);
}

export function previousWeek(weekId: string): string {
  return isoWeekKey(civilDateToUtcMidnight(shiftDate(mondayOf(weekId), -7)));
}
```

Create `backend/src/challenges/judge.ts`:

```ts
// Results (spec 2026-10-15 §10.4, accepted default): on the first read after Monday 08:00 UTC, you win iff your entry
// has the most cheers (ties included) in YOUR circle, you plus the buddies who entered, frozen at your close
// (ChallengeEntry.circle, ruling 6), and only with at least 3 entries. A winner gets the week's trophy once
// (ItemGrant prize:{weekId}). Each entry is judged once (judgedAt). There is no public ranking: results list your circle
// only. Nothing is logged.
import { prisma } from '../db/client';
import { themeFor, type ThemeId } from './themes';
import { previousWeek, resultsAt, weekOf } from './week';
import { buddyIdsOf } from '../social/circle';

export const MIN_RANKED = 3;

export function judgeCircle(counts: ReadonlyMap<string, number>): { ranked: boolean; winners: string[] } {
  if (counts.size < MIN_RANKED) return { ranked: false, winners: [] };
  const top = Math.max(...counts.values());
  return { ranked: true, winners: [...counts].filter(([, n]) => n === top).map(([id]) => id).sort() };
}

const idsOf = (json: unknown): string[] => (Array.isArray(json) ? json.filter((v): v is string => typeof v === 'string') : []);

/** Cheers per entrant of the week among the given ids (only those who entered). */
async function circleCounts(weekId: string, ids: readonly string[]): Promise<Map<string, number>> {
  const entered = await prisma.challengeEntry.findMany({ where: { weekId, userId: { in: [...ids] } }, select: { userId: true } });
  const got = await prisma.challengeCheer.groupBy({ by: ['toId'], where: { weekId, toId: { in: entered.map((e) => e.userId) } }, _count: { _all: true } });
  const counts = new Map(entered.map((e) => [e.userId, 0]));
  for (const g of got) counts.set(g.toId, g._count._all);
  return counts;
}

/** Judges this user's closed, unjudged entries (from Monday 08:00 UTC); answers how many were judged. */
export async function settleChallenges(userId: string, now: Date): Promise<number> {
  const open = await prisma.challengeEntry.findMany({ where: { userId, judgedAt: null }, select: { weekId: true, circle: true } });
  let judged = 0;
  for (const e of open) {
    if (now < resultsAt(e.weekId)) continue;
    const { winners } = judgeCircle(await circleCounts(e.weekId, [userId, ...idsOf(e.circle)]));
    const trophy = themeFor(e.weekId)?.trophy;
    if (trophy && winners.includes(userId)) {
      await prisma.itemGrant.createMany({ data: [{ userId, itemId: trophy, qty: 1, sourceKey: `prize:${e.weekId}` }], skipDuplicates: true });
    }
    await prisma.challengeEntry.updateMany({ where: { userId, weekId: e.weekId, judgedAt: null }, data: { judgedAt: now } });
    judged++;
  }
  return judged;
}

/** Never fails the read that triggers it (GET /me/challenge, GET /me/cosmetics); the next read tries again. */
export async function settleChallengesSafely(userId: string, now: Date): Promise<void> {
  try {
    await settleChallenges(userId, now);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'challenge.judge_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}

export interface ResultsDTO {
  week: string;
  themeId: ThemeId | null;
  ranked: boolean;
  winners: string[];
  entries: Array<{ name: string; cheers: number; mine: boolean }>;
  you: { entered: boolean; won: boolean };
}

/** Last week's results in your circle (your frozen circle if you entered, else your current buddies), or null before
 * Monday 08:00 UTC or when nobody in it entered. Names only, never ids (ruling 28). */
export async function readResults(userId: string, now: Date): Promise<ResultsDTO | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const week = previousWeek(weekOf(now, me?.timezone ?? 'UTC'));
  if (now < resultsAt(week)) return null;
  const mine = await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId: week } }, select: { circle: true } });
  const counts = await circleCounts(week, [userId, ...(mine ? idsOf(mine.circle) : await buddyIdsOf(userId))]);
  if (!counts.size) return null;
  const people = await prisma.user.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true, displayName: true, handle: true } });
  const name = (id: string) => { const p = people.find((u) => u.id === id); return p?.displayName ?? p?.handle ?? ''; };
  const { ranked, winners } = judgeCircle(counts);
  return {
    week, themeId: themeFor(week)?.id ?? null, ranked,
    winners: winners.map(name),
    entries: [...counts].sort((x, y) => y[1] - x[1]).map(([id, n]) => ({ name: name(id), cheers: n, mine: id === userId })),
    you: { entered: !!mine, won: winners.includes(userId) },
  };
}
```

(The new `challenge.judge_failed` warning carries the error class only, the same shape as `coins.earn_failed`; it is
an error report, not telemetry, and has no id.)

Create `backend/src/challenges/entries.ts`:

```ts
// Entering the weekly theme challenge (spec 2026-10-15 §10.4). Entering is the opt-in for the entry's snapshot (a
// controller ruling): buddies who open the challenge see it whether or not the room is open to visits. The entry is
// the room: every save while the entry is open copies the saved layout in (snapshotOnSaveTx, inside the save's
// transaction), and the +30 pays once, the first time the entry meets the brief while open (ruling 7). Entry cheers
// follow the room-cheer coin rules, keyed per week, entrant and cheerer (ruling 10). Logs the entry's event name only.
import type { Prisma } from '@prisma/client';
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { EARN_AMOUNTS } from '../coins/amounts';
import { COIN_TX_OPTIONS, applyCoinEvents, cheerEarns, lockUsers, logEarned, writeEarnsTx, type CoinWritten } from '../coins/ledger';
import type { ChallengeTag } from '../cosmetics/catalogue';
import type { KipWornDTO } from '../cosmetics/worn';
import { prisma } from '../db/client';
import { BuddyError, UUID_RE, isUniqueViolation } from '../buddies/errors';
import { findPair, isBlockedEitherWay } from '../buddies/pairs';
import { PERSON_SELECT, toPerson } from '../buddies/people';
import { tierSize, type RoomLayout, type Tier } from '../room/geometry';
import { lockRoom } from '../room/lock';
import { readOwnedLayout } from '../room/visit';
import { buddyIdsOf } from '../social/circle';
import { readResults, settleChallengesSafely, type ResultsDTO } from './judge';
import { briefCount, meetsBrief, themeFor, type Theme, type ThemeId } from './themes';
import { closesAt, weekOf } from './week';

export interface Snapshot { layout: RoomLayout; size: { n: number; m: number } }
export interface EntryDTO { userId: string; name: string; kipColour: string; kipWorn: KipWornDTO; snapshot: Snapshot; cheers: number; cheeredByMe: boolean; mine: boolean }
export interface ChallengeDTO {
  week: string;
  theme: { id: ThemeId; tag: ChallengeTag; atLeast: number; themePiece: string; trophy: string } | null;
  closesAt: string | null;
  open: boolean;
  entry: { count: number; meets: boolean; paid: boolean } | null;
  entries: EntryDTO[];
  results: ResultsDTO | null;
}

const snapshotOf = (layout: RoomLayout, tier: Tier): Snapshot => ({ layout, size: tierSize(tier) });
const tzOf = async (db: Prisma.TransactionClient | typeof prisma, userId: string) =>
  (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone ?? 'UTC';

/** Pays the entry's +30 once if the layout meets the brief, then marks the entry paid. Never throws: the next save or
 * entry read tries again (the key makes it idempotent). */
export async function payEntryIfMet(userId: string, weekId: string, layout: RoomLayout, theme: Theme, now: Date): Promise<void> {
  if (!meetsBrief(layout, theme)) return;
  try {
    await applyCoinEvents(userId, [{ kind: 'challenge', sourceKey: `challenge:${weekId}`, amount: EARN_AMOUNTS.challenge, capDay: null }], now);
    await prisma.challengeEntry.updateMany({ where: { userId, weekId, paidAt: null }, data: { paidAt: now } });
  } catch (err) {
    console.warn(JSON.stringify({ event: 'coins.earn_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}

/** Inside PUT /me/cosmetics' transaction: an open entry this week takes the saved layout and the current circle.
 * Answers what the caller pays after the commit, or null. */
export async function snapshotOnSaveTx(tx: Prisma.TransactionClient, userId: string, layout: RoomLayout, tier: Tier, now: Date): Promise<{ weekId: string; theme: Theme } | null> {
  const tz = await tzOf(tx, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  if (!theme || now >= closesAt(weekId, tz)) return null;
  const circle = await buddyIdsOf(userId);
  const done = await tx.challengeEntry.updateMany({
    where: { userId, weekId },
    data: { snapshot: snapshotOf(layout, tier) as unknown as Prisma.InputJsonValue, circle },
  });
  return done.count ? { weekId, theme } : null;
}

export async function enterChallenge(userId: string, now: Date): Promise<ChallengeDTO> {
  const tz = await tzOf(prisma, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  if (!theme) throw new BuddyError('no_challenge');
  if (now >= closesAt(weekId, tz)) throw new BuddyError('challenge_closed');
  const circle = await buddyIdsOf(userId);
  const { layout, created } = await prisma.$transaction(async (tx) => {
    // The room lock: a save landing at the same moment is either in the snapshot or after it, never half.
    await lockRoom(tx, userId);
    const room = await readOwnedLayout(tx, userId);
    const snapshot = snapshotOf(room.layout, room.tier) as unknown as Prisma.InputJsonValue;
    const made = await tx.challengeEntry.createMany({ data: [{ userId, weekId, snapshot, circle }], skipDuplicates: true });
    return { layout: room.layout, created: made.count === 1 };
  }, COIN_TX_OPTIONS);
  if (created) console.info(JSON.stringify({ event: 'challenge.entered' }));
  await payEntryIfMet(userId, weekId, layout, theme, now);
  return readChallenge(userId, now);
}

export async function readChallenge(userId: string, now: Date): Promise<ChallengeDTO> {
  await settleChallengesSafely(userId, now);
  const tz = await tzOf(prisma, userId);
  const weekId = weekOf(now, tz);
  const theme = themeFor(weekId);
  const close = theme ? closesAt(weekId, tz) : null;
  const open = !!close && now < close;
  const buddies = await buddyIdsOf(userId);
  const mineRow = await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId, weekId } }, select: { snapshot: true, paidAt: true } });
  // The circle is frozen at the close (ruling 6): rewritten on each read while open.
  if (mineRow && open) await prisma.challengeEntry.updateMany({ where: { userId, weekId }, data: { circle: buddies } });
  const blocks = await prisma.buddyBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
  const blocked = new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
  const visible = [userId, ...buddies.filter((id) => !blocked.has(id))];
  const rows = theme ? await prisma.challengeEntry.findMany({ where: { weekId, userId: { in: visible } }, select: { userId: true, snapshot: true } }) : [];
  const [people, got, mineCheers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: PERSON_SELECT }),
    prisma.challengeCheer.groupBy({ by: ['toId'], where: { weekId, toId: { in: rows.map((r) => r.userId) } }, _count: { _all: true } }),
    prisma.challengeCheer.findMany({ where: { weekId, fromId: userId }, select: { toId: true } }),
  ]);
  const cheered = new Set(mineCheers.map((c) => c.toId));
  const entries = rows.flatMap((r): EntryDTO[] => {
    const p = people.find((u) => u.id === r.userId);
    if (!p) return [];
    const person = toPerson(p);
    return [{
      userId: r.userId, name: person.displayName, kipColour: person.kipColour, kipWorn: person.kipWorn,
      snapshot: r.snapshot as unknown as Snapshot,
      cheers: got.find((g) => g.toId === r.userId)?._count._all ?? 0,
      cheeredByMe: cheered.has(r.userId), mine: r.userId === userId,
    }];
  }).filter((e) => !e.mine).sort((x, y) => y.cheers - x.cheers || x.name.localeCompare(y.name));
  const mineLayout = mineRow ? (mineRow.snapshot as unknown as Snapshot).layout : null;
  return {
    week: weekId,
    theme: theme ? { id: theme.id, tag: theme.rule.tag, atLeast: theme.rule.atLeast, themePiece: theme.themePiece, trophy: theme.trophy } : null,
    closesAt: close ? close.toISOString() : null,
    open,
    entry: mineLayout && theme ? { count: briefCount(mineLayout, theme.rule.tag), meets: meetsBrief(mineLayout, theme), paid: !!mineRow!.paidAt } : null,
    entries,
    results: await readResults(userId, now),
  };
}

/** One cheer per entry per buddy per week, before the entrant's own close, paying both like a room cheer. */
export async function cheerEntry(viewerId: string, rawTarget: string, now: Date): Promise<{ paid: boolean }> {
  if (!UUID_RE.test(rawTarget) || rawTarget === viewerId) throw new BuddyError('not_found');
  const toId = rawTarget;
  if (!(await findPair(viewerId, toId)) || (await isBlockedEitherWay(viewerId, toId))) throw new BuddyError('not_found');
  const [viewerTz, ownerTz] = await Promise.all([tzOf(prisma, viewerId), tzOf(prisma, toId)]);
  const weekId = weekOf(now, ownerTz);
  if (!themeFor(weekId) || !(await prisma.challengeEntry.findUnique({ where: { userId_weekId: { userId: toId, weekId } }, select: { weekId: true } }))) {
    throw new BuddyError('not_found');
  }
  if (now >= closesAt(weekId, ownerTz)) throw new BuddyError('challenge_closed');
  let written: CoinWritten[] = [];
  let paid = false;
  try {
    await prisma.$transaction(async (tx) => {
      await lockUsers(tx, [viewerId, toId]);
      await tx.challengeCheer.create({ data: { weekId, fromId: viewerId, toId, createdAt: now } });
      const key = `ccheer:${weekId}:${viewerId}:${toId}`;
      const given = await writeEarnsTx(tx, viewerId, [cheerEarns(key, localCivilDateOrUtc(now, viewerTz), 'given')], now);
      const got = await writeEarnsTx(tx, toId, [cheerEarns(key, localCivilDateOrUtc(now, ownerTz), 'got')], now);
      written = [...given, ...got];
      paid = given.some((w) => w.amount > 0);
    }, COIN_TX_OPTIONS);
  } catch (err) {
    if (isUniqueViolation(err)) throw new BuddyError('already_cheered');
    throw err;
  }
  logEarned(written);
  return { paid };
}
```

In `backend/src/room/socialRoutes.ts` add (importing `challengeClock` from `../challenges/week` and `cheerEntry`,
`enterChallenge`, `readChallenge` from `../challenges/entries`):

```ts
SOCIAL_ROOM_POSTS.push('/me/challenge/entry', '/me/challenge/entries/:userId/cheer');

socialRoomRouter.get('/me/challenge', requireAuth, buddyRoute(async (req, res) => {
  json(res, await readChallenge(req.userId!, challengeClock.now()));
}));

socialRoomRouter.post('/me/challenge/entry', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await enterChallenge(req.userId!, challengeClock.now()));
}));

socialRoomRouter.post('/me/challenge/entries/:userId/cheer', requireAuth, buddyRoute(async (req, res) => {
  noStore(res);
  json(res, await cheerEntry(req.userId!, String(req.params.userId), challengeClock.now()));
}));
```

In `backend/src/cosmetics/loadout.ts`:
- import `settleChallengesSafely` from `../challenges/judge`, `payEntryIfMet` and `snapshotOnSaveTx` from
  `../challenges/entries`, and `challengeClock` from `../challenges/week`;
- in `readCosmetics`, after `if (opts.grant ?? true) await grantCosmeticsSafely(userId, now);` add
  `if (opts.grant ?? true) await settleChallengesSafely(userId, now);` (a trophy won lands with the room read, ruling 6);
- in `saveCosmetics`, declare `let entryPay: { weekId: string; theme: Theme } | null = null;` beside `placedFirst`,
  inside the transaction after the `firstPlacedAt` block and before `return null;` add
  `entryPay = await snapshotOnSaveTx(tx, userId, parsed.layout, tier, challengeClock.now());`, and after the
  `placedFirst` earn add `if (entryPay) await payEntryIfMet(userId, entryPay.weekId, parsed.layout, entryPay.theme, challengeClock.now());`
  (import `type Theme` from `../challenges/themes`). The save's own `now` stays for its other writes; the challenge
  uses the clock tests can move.

`buddyIdsOf` reads through the global client inside `snapshotOnSaveTx`: a pair row is never locked by a save, so the
read cannot wait on the transaction.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.superpowers/sdd/2026-10-15-kip-freebuild-p4/backend-jest.sh tests/challenges tests/room tests/cosmetics tests/coins`
Expected: PASS. Then the full backend suite, `tsc` (0), and `tests/room/noCoachImport.test.ts` (no coach import of
`challenges/`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/challenges backend/src/room/socialRoutes.ts backend/src/cosmetics/loadout.ts backend/tests/challenges
git commit -m "feat(challenges): weekly theme entries, entry cheers, circle results and trophies"
```

---

### Task 8: Mobile: the rooms API, the room switch in Profile with its own consent, and the profile line

Spec §10.1 (the app's `ShareKey` and `SHARE_KEYS` gain `room`, with its label in the sharing settings copy; the app
also gets `HEALTH_SHARE_KEYS`, and `profileHub.ts`'s count stays "n of 5" over the health keys, adding "· room open";
the one-line confirm sheet with **Turn on** and **Not now**), §12's P4 rows (the app's API). Rulings 19, 20, 25.

**Files:**
- Create: `mobile/src/api/rooms.ts`, `mobile/src/components/buddies/RoomVisitConsentSheet.tsx`
- Modify: `mobile/src/api/buddies.ts`, `mobile/src/lib/buddyCopy.ts`, `mobile/src/lib/profileHub.ts`,
  `mobile/src/lib/profileCopy.ts`, `mobile/src/components/buddies/BuddiesProfileSection.tsx`
- Modify (tests): `mobile/__tests__/components/BuddiesProfileSection.test.tsx`, `mobile/__tests__/lib/passport.test.ts`

**Interfaces:**
- Consumes: Task 2's sharing body (`room` beside the five, absent from an older server); Tasks 5–7's routes.
- Produces:
  - `api/buddies.ts`: `type HealthShareKey`, `ShareKey = HealthShareKey | 'room'`, `HEALTH_SHARE_KEYS`,
    `SHARE_KEYS` (six), `SharingSettings = Record<HealthShareKey, boolean> & { room?: boolean; consentVersion: number; consented: boolean }`,
    `BuddyWeek.roomOpen?: boolean`;
  - `api/rooms.ts`: `RoomVisitDTO`, `fetchBuddyRoom(buddyId)`, `cheerBuddyRoom(buddyId)`, `RoomCheersDTO`,
    `fetchRoomCheers()`, `type GiftNote = 'desk' | 'cosy' | 'thought'`, `GIFT_NOTES`, `GiftDTO`,
    `sendGift(buddyId, requestId, itemId, note)`, `fetchGifts()`, `openGift(id)`, `ChallengeTag`, `ThemeId`,
    `ChallengeEntryDTO`, `ChallengeResultsDTO`, `ChallengeDTO`, `fetchChallenge()`, `enterChallenge()`,
    `cheerEntry(userId)`;
  - `buddyCopy.ts`: `SHARE_TITLES.room`, `SHARE_HINTS.room`, `ROOM_SWITCH` (`group`, `title`, `hint`, `footer`,
    `consentTitle`, `consent`, `turnOn`, `notNow`), seven new error lines;
  - `RoomVisitConsentSheet({ visible, busy, onTurnOn, onClose })`;
  - `PROFILE_COPY.status.buddies(handle, sharing, total, roomOpen?)`.

- [ ] **Step 1: Write the failing tests**

In `mobile/__tests__/components/BuddiesProfileSection.test.tsx`: change `OFF` to include `room: false`, and add:

```tsx
describe('the room switch (spec 2026-10-15 §10.1, ruling 20)', () => {
  it('is off by default and asks its own one-line consent; Turn on saves room alone, never the health consent', async () => {
    (saveSharing as jest.Mock).mockResolvedValue({ consentVersion: 1, consented: false, ...OFF, room: true });
    render(<BuddiesProfileSection onNavigate={jest.fn()} />);
    const toggle = await screen.findByTestId('share-toggle-room');
    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, 'valueChange', true);
    expect(screen.getByTestId('room-consent-line')).toHaveTextContent('Buddies see your room, including its size.');
    expect(saveSharing).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByTestId('room-consent-on')); });
    expect(saveSharing).toHaveBeenCalledWith({ room: true });
    expect(consentToSharing).not.toHaveBeenCalled();
    expect(screen.getByTestId('share-toggle-room').props.value).toBe(true);
  });

  it('Not now changes nothing; turning it off never asks', async () => {
    (fetchSharing as jest.Mock).mockResolvedValue({ consentVersion: 1, consented: false, ...OFF, room: true });
    (saveSharing as jest.Mock).mockResolvedValue({ consentVersion: 1, consented: false, ...OFF });
    render(<BuddiesProfileSection onNavigate={jest.fn()} />);
    const toggle = await screen.findByTestId('share-toggle-room');
    await act(async () => { fireEvent(toggle, 'valueChange', false); });
    expect(screen.queryByTestId('room-consent-line')).toBeNull();
    expect(saveSharing).toHaveBeenCalledWith({ room: false });
  });

  it('keeps the five health switches under the versioned consent, and hides the room row on an older server', async () => {
    (fetchSharing as jest.Mock).mockResolvedValue({ consentVersion: 1, consented: false, ...OFF, room: undefined });
    render(<BuddiesProfileSection onNavigate={jest.fn()} />);
    expect(await screen.findByTestId('share-toggle-steps')).toBeTruthy();
    expect(screen.queryByTestId('share-toggle-room')).toBeNull();
  });
});
```

In `mobile/__tests__/lib/passport.test.ts`, beside line 88, add:

```ts
    expect(S.buddies('tushar', 3, 5, true)).toBe('@tushar · sharing 3 of 5 · room open');
```

and, where the file tests `categoryCards` with sharing settings, add a case whose sharing has `room: true` and three
health keys on, expecting the buddies card's status `'@sam · sharing 3 of 5 · room open'` (use the file's own handle
and fixture names).

- [ ] **Step 2: Run them to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/components/BuddiesProfileSection.test.tsx __tests__/lib/passport.test.ts`
Expected: FAIL (no room switch; `buddies` takes three arguments).

- [ ] **Step 3: Implement**

In `mobile/src/api/buddies.ts` replace the two share lines with:

```ts
export type HealthShareKey = 'recovery' | 'sleepScore' | 'hoursSlept' | 'steps' | 'streaks';
/** The five health switches and `room`, "Buddies can visit my room" (spec 2026-10-15 §10.1). */
export type ShareKey = HealthShareKey | 'room';
export const HEALTH_SHARE_KEYS: readonly HealthShareKey[] = ['recovery', 'sleepScore', 'hoursSlept', 'steps', 'streaks'];
export const SHARE_KEYS: readonly ShareKey[] = [...HEALTH_SHARE_KEYS, 'room'];
```

change `SharingSettings` to
`Record<HealthShareKey, boolean> & { /** An older server sends none. */ room?: boolean; consentVersion: number; consented: boolean };`,
and add to `BuddyWeek`: `/** They opened their room to visits (P4 ruling 8); an older server sends none. */ roomOpen?: boolean;`.

Create `mobile/src/api/rooms.ts`:

```ts
import { apiFetch } from './client';
import { send } from './buddies';

// KIP's room among buddies (spec 2026-10-15 §12 P4): visits, room cheers, gifts and the weekly challenge. The server
// decides who may see what, every coin and every count; the app only shows them. Shapes mirror backend/src/room
// (visit.ts, gifts.ts) and backend/src/challenges (entries.ts, judge.ts).
const id = (s: string) => encodeURIComponent(s);

export interface RoomVisitDTO {
  name: string;
  layout: unknown;
  size: { n: number; m: number };
  kipColour: string;
  kipWorn: Record<string, string | null>;
  cheersThisWeek: number;
  cheeredToday: boolean;
}
export const fetchBuddyRoom = (buddyId: string) => apiFetch<RoomVisitDTO>(`/me/buddies/${id(buddyId)}/room`);
export const cheerBuddyRoom = (buddyId: string) => apiFetch<{ paid: boolean }>(`/me/buddies/${id(buddyId)}/room/cheer`, send('POST', {}));
export interface RoomCheersDTO { count: number; cheers: Array<{ name: string; day: string }> }
export const fetchRoomCheers = () => apiFetch<RoomCheersDTO>('/me/room/cheers');

export type GiftNote = 'desk' | 'cosy' | 'thought';
export const GIFT_NOTES: readonly GiftNote[] = ['desk', 'cosy', 'thought'];
export interface GiftDTO { id: string; itemId: string; note: GiftNote; from: { name: string } | null; quiet: boolean; at: string }
export const sendGift = (buddyId: string, requestId: string, itemId: string, note: GiftNote) =>
  apiFetch<{ id: string; counts: Record<string, number> }>(`/me/buddies/${id(buddyId)}/gifts`, send('POST', { requestId, itemId, note }));
export const fetchGifts = () => apiFetch<{ gifts: GiftDTO[] }>('/me/gifts');
export const openGift = (giftId: string) => apiFetch<{ counts: Record<string, number> }>(`/me/gifts/${id(giftId)}/open`, send('POST', {}));

export type ChallengeTag = 'warm' | 'plant' | 'glow' | 'desk';
export type ThemeId = 'cosyAutumn' | 'greenThumb' | 'nightOwl' | 'tidyDesk';
export interface ChallengeEntryDTO {
  userId: string;
  name: string;
  kipColour: string;
  kipWorn: Record<string, string | null>;
  snapshot: { layout: unknown; size: { n: number; m: number } };
  cheers: number;
  cheeredByMe: boolean;
  mine: boolean;
}
export interface ChallengeResultsDTO {
  week: string;
  themeId: ThemeId | null;
  ranked: boolean;
  winners: string[];
  entries: Array<{ name: string; cheers: number; mine: boolean }>;
  you: { entered: boolean; won: boolean };
}
export interface ChallengeDTO {
  week: string;
  theme: { id: ThemeId; tag: ChallengeTag; atLeast: number; themePiece: string; trophy: string } | null;
  closesAt: string | null;
  open: boolean;
  entry: { count: number; meets: boolean; paid: boolean } | null;
  entries: ChallengeEntryDTO[];
  results: ChallengeResultsDTO | null;
}
export const fetchChallenge = () => apiFetch<ChallengeDTO>('/me/challenge');
export const enterChallenge = () => apiFetch<ChallengeDTO>('/me/challenge/entry', send('POST', {}));
export const cheerEntry = (userId: string) => apiFetch<{ paid: boolean }>(`/me/challenge/entries/${id(userId)}/cheer`, send('POST', {}));
```

In `mobile/src/lib/buddyCopy.ts`: add `room: 'My room'` to `SHARE_TITLES`, `room: 'Buddies can visit your room'` to
`SHARE_HINTS`, `room: 'room'` to `SHARE_WORDS`, and:

```ts
/** "Buddies can visit my room" (spec 2026-10-15 §10.1): its own one-line consent, never the health one (ruling 20). */
export const ROOM_SWITCH = {
  group: 'Your room',
  title: 'Buddies can visit my room',
  hint: `They see ${KIP_NAME}'s room and its size, and can cheer it.`,
  footer: 'Off by default. Your numbers, coins and badges are never shown.',
  consentTitle: 'Open your room?',
  consent: 'Buddies see your room, including its size.',
  turnOn: 'Turn on',
  notNow: 'Not now',
} as const;
```

and seven lines in `ERRORS`:

```ts
  already_cheered: "You've already cheered this.",
  not_spare: 'Only a spare can be a gift: a piece you own twice, with one not placed.',
  gift_limit: "That's 3 gifts today. Try again tomorrow.",
  gift_gone: 'That gift is no longer there.',
  challenge_closed: "This week's room challenge has closed.",
  no_challenge: "There's no room challenge this week.",
  invalid_body: "Couldn't send that. Please try again.",
```

(If a test pins `ERRORS` to the backend's codes one for one, it now passes with these seven.)

Create `mobile/src/components/buddies/RoomVisitConsentSheet.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { ROOM_SWITCH } from '../../lib/buddyCopy';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { Text } from '../ui/text';

// The room switch's own one-line consent (spec 2026-10-15 §10.1, controller ruling): tapping Turn on is the consent.
// Never the health-sharing consent, and never reset by its version. Closing agrees to nothing.
export function RoomVisitConsentSheet({ visible, busy = false, onTurnOn, onClose }: { visible: boolean; busy?: boolean; onTurnOn: () => void; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="room-consent-sheet">
      <View className="gap-3 p-4">
        <Text accessibilityRole="header" className="text-heading">{ROOM_SWITCH.consentTitle}</Text>
        <Text testID="room-consent-line" className="text-body text-muted-foreground">{ROOM_SWITCH.consent}</Text>
        <Button testID="room-consent-on" size="lg" disabled={busy} onPress={onTurnOn}>{ROOM_SWITCH.turnOn}</Button>
        <Button testID="room-consent-cancel" variant="outline" size="lg" disabled={busy} onPress={onClose}>{ROOM_SWITCH.notNow}</Button>
      </View>
    </Sheet>
  );
}
```

In `mobile/src/components/buddies/BuddiesProfileSection.tsx`:
- import `HEALTH_SHARE_KEYS` and `type HealthShareKey` (in place of `SHARE_KEYS`), `ROOM_SWITCH`, and
  `RoomVisitConsentSheet`;
- `consentFor`, `pendingKey`, `askConsent`, `toggle` take `HealthShareKey`; `save(key: ShareKey, value)` keeps
  `ShareKey`; the switch list maps `HEALTH_SHARE_KEYS`;
- add the room state and toggle:

```tsx
  const [roomAsk, setRoomAsk] = useState(false);
  // The room switch is its own consent (ruling 20): on asks the one-line sheet; off never asks; never the health one.
  function toggleRoom(value: boolean) {
    if (!sharing || saving.current) return;
    if (value) setRoomAsk(true);
    else void save('room', false);
  }
```

- after the "Shared with buddies" group render:

```tsx
      {sharing && typeof sharing.room === 'boolean' ? (
        <SettingsGroup testID="room-visits" label={ROOM_SWITCH.group} footer={ROOM_SWITCH.footer}>
          <SettingsRow
            testID="share-row-room"
            title={ROOM_SWITCH.title}
            subtitle={ROOM_SWITCH.hint}
            trailing={
              <Switch
                testID="share-toggle-room"
                accessibilityLabel={ROOM_SWITCH.title}
                value={sharing.room}
                disabled={busy}
                onValueChange={toggleRoom}
                trackColor={{ true: colors.accent }}
              />
            }
          />
        </SettingsGroup>
      ) : null}
      <RoomVisitConsentSheet
        visible={roomAsk}
        busy={busy}
        onTurnOn={() => {
          setRoomAsk(false);
          void save('room', true);
        }}
        onClose={() => setRoomAsk(false)}
      />
```

and extend the component's header comment: "Below them, 'Your room': one switch, 'Buddies can visit my room', off by
default, with its own one-line consent sheet (spec 2026-10-15 §10.1)."

In `mobile/src/lib/profileCopy.ts` change `status.buddies` to:

```ts
    buddies: (handle: string | null, sharing: number, total: number, roomOpen = false) =>
      (handle ? `@${handle} · sharing ${sharing} of ${total}${roomOpen ? ' · room open' : ''}` : 'Set up your handle'),
```

In `mobile/src/lib/profileHub.ts` import `HEALTH_SHARE_KEYS` (in place of `SHARE_KEYS`) and change the buddies card to:

```ts
    const sharing = s ? HEALTH_SHARE_KEYS.filter((k) => s[k]).length : null;
    cards.push({ category: 'buddies', status: r.identity && sharing !== null ? S.buddies(r.identity.handle, sharing, HEALTH_SHARE_KEYS.length, s?.room === true) : null });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/components/BuddiesProfileSection.test.tsx __tests__/lib/passport.test.ts __tests__/screens/ProfileHub.test.tsx __tests__/screens/BuddyWeekScreen.test.tsx`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/api mobile/src/lib/buddyCopy.ts mobile/src/lib/profileHub.ts mobile/src/lib/profileCopy.ts mobile/src/components/buddies mobile/__tests__/components/BuddiesProfileSection.test.tsx mobile/__tests__/lib/passport.test.ts
git commit -m "feat(buddies): the room-visit switch in Profile with its own one-line consent"
```

---

### Task 9: Mobile: visiting a buddy's room (`BuddyRoom`), cheering it, and the pieces you don't have

Spec §10.1 (the view: "{first name}'s room", "8 × 8 · 44 pieces", their KIP saying "HI THERE!", "Just looking: you
can't move anything"; pan works, nothing can be selected; every health-linked effect drawn neutral, day or night by
the visitor's clock; "Pieces you don't have" with the price or the generic rule; entry points from a buddy's profile
and their KIP in Chats, none on the Campfire), §10.2 (Cheer {name}'s room; a visitor sees only the week's count).
Rulings 8, 9, 21, 24, 27.

**Files:**
- Create: `mobile/src/lib/room/visit.ts`, `mobile/src/components/room/NeutralRoom.tsx`,
  `mobile/src/screens/BuddyRoomScreen.tsx`, `mobile/__tests__/lib/roomVisit.test.ts`,
  `mobile/__tests__/screens/BuddyRoomScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts`, `mobile/src/screens/BuddyWeekScreen.tsx`,
  `mobile/src/screens/ChatThreadScreen.tsx`, `mobile/src/navigation/RootNavigator.tsx`
- Modify (tests): `mobile/__tests__/screens/BuddyWeekScreen.test.tsx`, `mobile/__tests__/screens/ChatThreadScreen.test.tsx`

**Interfaces:**
- Consumes: Task 8's `fetchBuddyRoom`, `cheerBuddyRoom`, `RoomVisitDTO`; P1's `readLayout`, `isoGrid`, `deskBoxes`,
  `isoCrop`, `clampAxis`, `RoomView`; P3's `NEUTRAL_LIVING` (by leaving `living` out); `isNightTime`
  (`lib/home/scene.ts`); `kipColourOf`, `kipWornOf`; `useCosmetics`; `ItemIcon`; `unlockLine`, `unlockSpoken`,
  `itemName`, `spokenName`, `coinCount`.
- Produces:
  - `lib/room/visit.ts`: `interface RoomVisit { name: string; layout: RoomLayout; tier: Tier; size: { n: number; m: number };
    colour: KipColour; worn: KipWorn; cheersThisWeek: number; cheeredToday: boolean }`; `readVisit(dto): RoomVisit`;
    `tierOfSize(size): Tier`; `MAX_MISSING = 12`; `missingPieces(layout, myCounts): ItemId[]`;
    `pieceInfo(id): { name: string; line: string; spoken: string }`; `visitLight(now: Date): { weather: 'fallback'; night: boolean }`;
    `panTo(offset, dx, dy, view, roomPt): { x: number; y: number }`;
  - `NeutralRoom({ layout, tier, colour, worn, pose, bubble, width, height, label, pannable?, testID })`;
  - `ROOM_COPY.visit` (`title`, `size`, `sizeSpoken`, `hi`, `looking`, `cheer`, `cheered`, `cheeredPaid`,
    `cheeredToday`, `cheersWeek`, `missing`, `price`, `priceSpoken`, `trophy`, `closed`, `failed`, `retry`, `open`,
    `openLabel`, `chatLabel`, `label`, `gift`);
  - route `BuddyRoom: { buddyId: string; name?: string }`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/roomVisit.test.ts`:

```ts
// The visit's pure parts (spec 2026-10-15 §10.1; P4 rulings 24, 27).
import { starterLayout } from '../../src/lib/room/layout';
import { MAX_MISSING, missingPieces, panTo, pieceInfo, readVisit, tierOfSize, visitLight } from '../../src/lib/room/visit';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const dto = (over = {}) => ({ name: 'Maya', layout: starterLayout(), size: { n: 8, m: 8 }, kipColour: 'lime', kipWorn: { head: 'out.beanie', face: null, neck: null, ears: null }, cheersThisWeek: 3, cheeredToday: false, ...over });

it('reads the body: a size, never a tier name; a broken layout reads as the starter room', () => {
  const v = readVisit(dto());
  expect([v.tier, v.size, v.colour, v.worn.head]).toEqual([2, { n: 8, m: 8 }, 'lime', 'out.beanie']);
  expect(readVisit(dto({ layout: { nope: 1 } })).layout).toEqual(starterLayout());
  expect([tierOfSize({ n: 7, m: 7 }), tierOfSize({ n: 9, m: 9 }), tierOfSize({ n: 3, m: 3 })]).toEqual([1, 3, 1]);
  expect(ROOM_COPY.visit.size(v.size, 44)).toBe('8 × 8 · 44 pieces');
  expect(ROOM_COPY.visit.sizeSpoken(v.size, 44)).toBe('8 by 8, 44 pieces');
});

it('lists the pieces you don\'t have, each once, at most 12, with a price or the generic rule (ruling 27)', () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces,
    { id: 'p1', item: 'plant.monstera', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p2', item: 'plant.monstera', layer: 'floor' as const, x: 5, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p3', item: 'corner.gnome', layer: 'floor' as const, x: 4, y: 6, facing: 'L' as const, mirror: false }] };
  expect(missingPieces(layout, STARTER_COUNTS)).toEqual(['plant.monstera', 'corner.gnome']);
  expect(missingPieces(layout, { ...STARTER_COUNTS, 'corner.gnome': 1 })).toEqual(['plant.monstera']);
  expect(MAX_MISSING).toBe(12);
  expect(pieceInfo('corner.gnome')).toEqual({ name: 'Gnome', line: '80 coins in the coin shop', spoken: '80 coins in the coin shop' });
  expect(pieceInfo('plant.monstera').line).toBe('Sleep goal · I');
  expect(pieceInfo('plant.monstera').spoken).not.toMatch(/·|\bI\b/);
  expect(pieceInfo('corner.acorn').line).toBe('A weekly challenge trophy');
  expect(JSON.stringify(pieceInfo('plant.monstera'))).not.toMatch(/earned/);
});

it('draws by the visitor\'s clock with the fallback sky; pans inside the room', () => {
  expect(visitLight(new Date(2026, 9, 26, 21, 0))).toEqual({ weather: 'fallback', night: true });
  expect(visitLight(new Date(2026, 9, 26, 10, 0))).toEqual({ weather: 'fallback', night: false });
  expect(panTo({ x: -40, y: 0 }, -500, 20, { width: 300, height: 260 }, { width: 392, height: 344 })).toEqual({ x: -92, y: 0 });
});
```

(The monstera's rule is `SG1`: "Sleep goal · I" is `unlockLine`'s visible form, read aloud as "Sleep goal, level 1".)

Create `mobile/__tests__/screens/BuddyRoomScreen.test.tsx`:

```tsx
import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { cheerBuddyRoom, fetchBuddyRoom } from '../../src/api/rooms';
import { ApiError } from '../../src/api/client';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { BuddyRoomScreen } from '../../src/screens/BuddyRoomScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/rooms', () => ({ fetchBuddyRoom: jest.fn(), cheerBuddyRoom: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: { buddyId: 'b1', name: 'Maya' } }) }));

const BODY = { name: 'Maya', layout: starterLayout(), size: { n: 8, m: 8 }, kipColour: 'lime', kipWorn: { head: null, face: null, neck: null, ears: null }, cheersThisWeek: 3, cheeredToday: false };

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { await loadCosmetics(); });
});

async function open(body: object = BODY) {
  (fetchBuddyRoom as jest.Mock).mockResolvedValue(body);
  render(<BuddyRoomScreen />);
  await act(async () => undefined);
}

it('shows their room neutral: size only, their KIP waving, nothing selectable (spec §10.1, ruling 24)', async () => {
  await open();
  expect(screen.getByTestId('visit-title')).toHaveTextContent("Maya's room");
  expect(screen.getByTestId('visit-size')).toHaveTextContent('8 × 8 · 7 pieces');
  expect(screen.getByTestId('visit-size').props.accessibilityLabel).toBe('8 by 8, 7 pieces');
  const room = screen.getByTestId('visit-room');
  expect(room.props.living).toBeUndefined(); // NEUTRAL_LIVING: plants grown, the cat wandering, the shelf empty
  expect(room.props.room).toMatch(/^wave:idle:HI THERE!:lines:fallback:(day|night):lime:2:/);
  expect(room.props.accessibilityActions).toBeUndefined();
  expect(screen.getByText("Just looking: you can't move anything")).toBeTruthy();
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('3 cheers this week');
});

it('cheers once a day: the button turns into "Cheered today" and the count goes up (spec §10.2)', async () => {
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  (cheerBuddyRoom as jest.Mock).mockResolvedValue({ paid: true });
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(cheerBuddyRoom).toHaveBeenCalledWith('b1');
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent('Cheered today');
  expect(screen.getByTestId('visit-cheer').props.accessibilityState).toMatchObject({ disabled: true });
  expect(screen.getByTestId('visit-cheers')).toHaveTextContent('4 cheers this week');
  expect(screen.getByTestId('visit-note')).toHaveTextContent('Cheered! +2 coins');
  if (Platform.OS === 'ios') expect(say).toHaveBeenCalledWith('Cheered! Plus 2 coins');
  say.mockRestore();
});

it('a room already cheered today, or closed meanwhile, answers honestly', async () => {
  (cheerBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(409, 'already_cheered', 'already_cheered'));
  await open();
  await act(async () => { fireEvent.press(screen.getByTestId('visit-cheer')); });
  expect(screen.getByTestId('visit-cheer')).toHaveTextContent('Cheered today');
  (fetchBuddyRoom as jest.Mock).mockRejectedValue(new ApiError(404, 'not_found', 'not_found'));
  render(<BuddyRoomScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('visit-closed')).toHaveTextContent("This room isn't open for visits.");
});

it('lists the pieces you don\'t have; tapping one says how to get it, never what they earned (ruling 27)', async () => {
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'corner.gnome', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false }] };
  await open({ ...BODY, layout });
  fireEvent.press(screen.getByTestId('visit-missing-corner.gnome'));
  expect(screen.getByTestId('visit-missing-info')).toHaveTextContent('Gnome');
  expect(screen.getByTestId('visit-missing-info')).toHaveTextContent('80 coins in the coin shop');
});

it('opens Send a gift for this buddy', async () => {
  await open();
  fireEvent.press(screen.getByTestId('visit-gift'));
  expect(mockNav.navigate).toHaveBeenCalledWith('GiftSend', { buddyId: 'b1', name: 'Maya' });
});
```

In `mobile/__tests__/screens/BuddyWeekScreen.test.tsx` add (using the file's own week fixture and navigation mock):

```tsx
it('offers Visit room only when their room is open (ruling 21)', async () => {
  // the file's helper that renders the week with a fixture; add roomOpen to it
  await renderWeek({ roomOpen: true });
  fireEvent.press(screen.getByTestId('buddy-visit-room'));
  expect(mockNav.navigate).toHaveBeenCalledWith('BuddyRoom', { buddyId: expect.any(String), name: expect.any(String) });
  await renderWeek({ roomOpen: false });
  expect(screen.queryByTestId('buddy-visit-room')).toBeNull();
});
```

(If the file has no `renderWeek` helper, inline its existing `fetchBuddyWeek` mock with `roomOpen` set, as its other
tests do, and extend its navigation mock with `navigate: jest.fn()`.)

In `mobile/__tests__/screens/ChatThreadScreen.test.tsx` add a test that pressing `thread-visit-room` (the header's
avatar button, label "Visit {name}'s room") navigates to `'BuddyRoom'` with `{ buddyId, name }`, using the file's
existing loaded-thread setup.

- [ ] **Step 2: Run them to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomVisit.test.ts __tests__/screens/BuddyRoomScreen.test.tsx __tests__/screens/BuddyWeekScreen.test.tsx __tests__/screens/ChatThreadScreen.test.tsx`
Expected: FAIL (no `lib/room/visit`, no screen, no entry points).

- [ ] **Step 3: Implement**

Add to `ROOM_COPY` in `mobile/src/lib/room/roomCopy.ts` (after `firstWeek`):

```ts
  /** Visiting a buddy's room (spec 2026-10-15 §10.1, §10.2, C4). The size, never a tier name; never "they earned". */
  visit: {
    title: (name: string) => `${name}'s room`,
    size: (s: { n: number; m: number }, pieces: number) => `${s.n} × ${s.m} · ${pieces} pieces`,
    sizeSpoken: (s: { n: number; m: number }, pieces: number) => `${s.n} by ${s.m}, ${pieces} pieces`,
    hi: 'HI THERE!',
    looking: "Just looking: you can't move anything",
    label: (name: string) => `${name}'s room, with their KIP waving`,
    cheer: (name: string) => `Cheer ${name}'s room`,
    cheeredToday: 'Cheered today',
    cheered: 'Cheered!',
    cheeredPaid: 'Cheered! +2 coins',
    cheeredPaidSpoken: 'Cheered! Plus 2 coins',
    cheersWeek: (n: number) => `${n} ${n === 1 ? 'cheer' : 'cheers'} this week`,
    missing: "Pieces you don't have",
    price: (n: number) => `${coinCount(n)} coins in the coin shop`,
    trophy: 'A weekly challenge trophy',
    gift: 'Send a gift',
    closed: "This room isn't open for visits.",
    failed: "Couldn't open this room just now.",
    retry: 'Try again',
    open: 'Visit room',
    chatLabel: (name: string) => `Visit ${name}'s room`,
  },
```

Create `mobile/src/lib/room/visit.ts`:

```ts
// A visit to a buddy's room, the pure parts (spec 2026-10-15 §10.1; P4 rulings 24, 27): the body as the app draws it
// (a broken layout reads as the starter room), the room's tier from its size (the size is all the server sends),
// the pieces you don't have with how to get them (a price or the catalogue's generic rule, never "they earned"), the
// neutral light by the visitor's clock, and panning inside the room.
import type { RoomVisitDTO } from '../../api/rooms';
import { isNightTime } from '../home/scene';
import { kipColourOf } from '../kip/kipColour';
import type { KipColour } from '../kip/kipArt';
import { kipWornOf } from '../kip/wornArt';
import { CATALOGUE, catalogueItem } from './catalogue';
import { clampAxis } from './iso/crop';
import type { RoomLayout, Tier } from './iso/geometry';
import { readLayout } from './layout';
import type { ItemId, KipWorn } from './loadout';
import { ROOM_COPY, itemName, unlockLine, unlockSpoken } from './roomCopy';

export interface RoomVisit {
  name: string;
  layout: RoomLayout;
  tier: Tier;
  size: { n: number; m: number };
  colour: KipColour;
  worn: KipWorn;
  cheersThisWeek: number;
  cheeredToday: boolean;
}

export const tierOfSize = (s: { n: number; m: number }): Tier => (s.n === 9 ? 3 : s.n === 8 ? 2 : 1);

export function readVisit(dto: RoomVisitDTO): RoomVisit {
  const size = { n: Number(dto.size?.n) || 7, m: Number(dto.size?.m) || 7 };
  return {
    name: dto.name, layout: readLayout(dto.layout), tier: tierOfSize(size), size,
    colour: kipColourOf(dto.kipColour), worn: kipWornOf(dto.kipWorn),
    cheersThisWeek: Math.max(0, Number(dto.cheersThisWeek) || 0), cheeredToday: dto.cheeredToday === true,
  };
}

export const MAX_MISSING = 12;

/** Placed items you own none of, each once, in catalogue order, at most 12 (ruling 27). */
export function missingPieces(layout: RoomLayout, mine: Readonly<Record<ItemId, number>>): ItemId[] {
  const placed = new Set(layout.pieces.map((p) => p.item));
  return CATALOGUE.items.filter((i) => placed.has(i.id) && !((mine[i.id] ?? 0) > 0)).map((i) => i.id).slice(0, MAX_MISSING);
}

/** How to get a piece: the shop's price, or the catalogue's generic rule; a trophy is a challenge trophy. */
export function pieceInfo(id: ItemId): { name: string; line: string; spoken: string } {
  const item = catalogueItem(id);
  const name = itemName(id);
  if (!item) return { name, line: '', spoken: '' };
  if (item.unlock.kind === 'shop' && item.price !== undefined) {
    const line = ROOM_COPY.visit.price(item.price);
    return { name, line, spoken: line };
  }
  if (item.unlock.kind === 'prize') return { name, line: ROOM_COPY.visit.trophy, spoken: ROOM_COPY.visit.trophy };
  return { name, line: unlockLine(item.unlock), spoken: unlockSpoken(item.unlock) };
}

/** The neutral light (ruling 24): the fallback sky, day or night by the visitor's own clock. */
export function visitLight(now: Date): { weather: 'fallback'; night: boolean } {
  return { weather: 'fallback', night: isNightTime(now) };
}

/** A pan by (dx, dy) points from `offset`, clamped so the room's edges never show. */
export function panTo(offset: { x: number; y: number }, dx: number, dy: number, view: { width: number; height: number }, room: { width: number; height: number }): { x: number; y: number } {
  return { x: clampAxis(offset.x + dx, view.width, room.width), y: clampAxis(offset.y + dy, view.height, room.height) };
}
```

(`unlockSpoken` of a starter or shop rule falls back to `unlockLine`, so a "·" never reaches a label: the monstera's
`SG1` reads "Sleep goal, level 1".)

Create `mobile/src/components/room/NeutralRoom.tsx`:

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { RoomView } from './RoomView';
import type { KipColour, KipPose } from '../../lib/kip/kipArt';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { isoGrid } from '../../lib/room/iso/grid';
import type { KipWorn } from '../../lib/room/loadout';
import { panTo, visitLight } from '../../lib/room/visit';

const CELL_PT = 2;

// A room drawn for someone else's eyes (spec 2026-10-15 §10.1, §10.4, §10.5; P4 ruling 24): a visit, a challenge
// entry, the share card. No `living` (P3's NEUTRAL_LIVING: plants grown, the cat wandering, the trophy shelf empty),
// the fallback sky, day or night by this device's clock, no walking, no wandering, no piece actions: one image with one
// label. `pannable` lets one finger pan a room larger than the view (§10.1 "Pan works").
export function NeutralRoom({ layout, tier, colour, worn, pose, bubble, width, height, label, pannable = false, testID }: {
  layout: RoomLayout; tier: Tier; colour: KipColour; worn: KipWorn; pose: KipPose; bubble: string | null;
  width: number; height: number; label: string; pannable?: boolean; testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const light = useMemo(() => visitLight(new Date()), []);
  const g = isoGrid(tier);
  const roomPt = { width: g.W * CELL_PT, height: g.H * CELL_PT };
  const start = useMemo(() => isoCrop({ width, height, cellPt: CELL_PT, box: deskBoxes(g, layout).focus, room: g }), [width, height, tier, layout]);
  const [offset, setOffset] = useState(start);
  const from = useRef(start);
  const pan = Gesture.Pan()
    .enabled(pannable)
    .runOnJS(true)
    .onBegin(() => { from.current = offset; })
    .onUpdate((e) => setOffset(panTo(from.current, e.translationX, e.translationY, { width, height }, roomPt)));
  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0A0B0E', borderRadius: 8 }}>
        <RoomView
          testID={testID}
          layout={layout}
          tier={tier}
          weather={light.weather}
          night={light.night}
          colour={colour}
          worn={worn}
          pose={pose}
          mood="idle"
          screen="lines"
          crop={{ width, height }}
          cellPt={CELL_PT}
          offset={offset}
          bubble={bubble}
          reduceMotion={reduceMotion}
          accessibilityLabel={label}
        />
      </View>
    </GestureDetector>
  );
}
```

Create `mobile/src/screens/BuddyRoomScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, findNodeHandle, useWindowDimensions, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { cheerBuddyRoom, fetchBuddyRoom } from '../api/rooms';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import { useCosmetics } from '../lib/room/cosmeticsStore';
import { ROOM_COPY } from '../lib/room/roomCopy';
import { missingPieces, pieceInfo, readVisit, type RoomVisit } from '../lib/room/visit';

const V = ROOM_COPY.visit;
type State = { status: 'loading' } | { status: 'ready'; visit: RoomVisit } | { status: 'closed' } | { status: 'error' };

// A buddy's room (spec 2026-10-15 §10.1, §10.2, C4; P4 rulings 8, 24, 27): read-only, drawn neutral, the size only.
// Cheer once a day (both of you earn, inside the 5 paid cheers a day); the week's count; the pieces you don't have and
// how to get them; Send a gift. A 404 is the one closed answer for every reason (the server says nothing more). A
// screen reader lands on the title; a cheer is announced (iOS) and shown in a live line (Android).
export function BuddyRoomScreen() {
  const navigation = useNavigation<any>();
  const { buddyId, name: given } = (useRoute().params ?? {}) as { buddyId: string; name?: string };
  const { width } = useWindowDimensions();
  const mine = useCosmetics();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const inFlight = useRef(false);
  const titleRef = useRef<RNText>(null);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', visit: readVisit(await fetchBuddyRoom(buddyId)) });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 404 ? { status: 'closed' } : { status: 'error' });
    }
  }, [buddyId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [state.status]);

  async function cheer() {
    if (state.status !== 'ready' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNote(null);
    const cheered = (count: number) => setState((s) => (s.status === 'ready' ? { status: 'ready', visit: { ...s.visit, cheeredToday: true, cheersThisWeek: count } } : s));
    try {
      const { paid } = await cheerBuddyRoom(buddyId);
      cheered(state.visit.cheersThisWeek + 1);
      setNote(paid ? V.cheeredPaid : V.cheered);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(paid ? V.cheeredPaidSpoken : V.cheered);
    } catch (e) {
      const code = e instanceof ApiError ? e.code ?? null : null;
      if (code === 'already_cheered') cheered(state.visit.cheersThisWeek);
      else if (e instanceof ApiError && e.status === 404) setState({ status: 'closed' });
      else setNote(buddyErrorMessage(code));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <SafeAreaView className="flex-1 items-center justify-center bg-background"><ActivityIndicator testID="visit-loading" /></SafeAreaView>;
  if (state.status === 'closed' || state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text testID={state.status === 'closed' ? 'visit-closed' : 'visit-error'} className="text-center text-body text-muted-foreground">
          {state.status === 'closed' ? V.closed : V.failed}
        </Text>
        {state.status === 'error' ? <Button testID="visit-retry" variant="secondary" className="h-[44px]" onPress={() => void load()}>{V.retry}</Button> : null}
      </SafeAreaView>
    );
  }

  const v = state.visit;
  const name = v.name || given || '';
  const missing = missingPieces(v.layout, mine?.counts ?? {});
  const shown = info ? pieceInfo(info) : null;
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <PageTitle ref={titleRef} testID="visit-title" accessibilityRole="header">{V.title(name)}</PageTitle>
        <Text testID="visit-size" accessibilityLabel={V.sizeSpoken(v.size, v.layout.pieces.length)} className="text-caption text-muted-foreground tabular-nums">
          {V.size(v.size, v.layout.pieces.length)}
        </Text>
        <NeutralRoom
          testID="visit-room"
          layout={v.layout}
          tier={v.tier}
          colour={v.colour}
          worn={v.worn}
          pose="wave"
          bubble={V.hi}
          width={width - 32}
          height={260}
          label={V.label(name)}
          pannable
        />
        <Text className="text-caption text-muted-foreground">{V.looking}</Text>
        <Button testID="visit-cheer" className="h-[44px]" disabled={busy || v.cheeredToday} onPress={() => void cheer()}>
          {v.cheeredToday ? V.cheeredToday : V.cheer(name)}
        </Button>
        <Text testID="visit-cheers" className="text-caption text-muted-foreground tabular-nums">{V.cheersWeek(v.cheersThisWeek)}</Text>
        <Text testID="visit-note" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{note ?? ''}</Text>
        <Button testID="visit-gift" variant="outline" className="h-[44px]" onPress={() => navigation.navigate('GiftSend', { buddyId, name })}>{V.gift}</Button>
        {missing.length ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-heading">{V.missing}</Text>
            <View className="flex-row flex-wrap gap-2">
              {missing.map((id) => (
                <Button
                  key={id}
                  testID={`visit-missing-${id}`}
                  variant={info === id ? 'default' : 'outline'}
                  className="h-auto min-h-[64px] w-[72px] flex-col gap-1 rounded-lg p-1"
                  accessibilityLabel={`${pieceInfo(id).name}. ${pieceInfo(id).spoken}`}
                  onPress={() => setInfo(id)}
                >
                  <ItemIcon id={id} colour={v.colour} size={40} />
                </Button>
              ))}
            </View>
            {shown ? (
              <View testID="visit-missing-info" accessibilityLiveRegion="polite" className="gap-1 rounded-lg border border-border p-3">
                <Text className="text-body font-semibold">{shown.name}</Text>
                <Text className="text-caption text-muted-foreground">{shown.line}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

(If `PageTitle` does not forward a ref, wrap its text in a `Text` with the ref as `PieceCardScreen` does with its name;
the focus target only needs a host text node.)

In `mobile/src/navigation/RootNavigator.tsx`: import `BuddyRoomScreen`; add to `RootStackParamList`
`BuddyRoom: { buddyId: string; name?: string };` and after the `BuddyWeek` screen
`<Stack.Screen name="BuddyRoom" component={BuddyRoomScreen} getId={({ params }) => params?.buddyId} options={{ title: '' }} />`.

In `mobile/src/screens/BuddyWeekScreen.tsx`: type the navigation as
`useNavigation() as unknown as { goBack: () => void; navigate: (route: 'BuddyRoom', params: { buddyId: string; name: string }) => void }`,
import `ROOM_COPY`, and after the sticker block add:

```tsx
        {week.roomOpen ? (
          <Button testID="buddy-visit-room" variant="outline" className="h-[44px]" onPress={() => navigation.navigate('BuddyRoom', { buddyId, name: week.buddy.displayName })}>
            {ROOM_COPY.visit.open}
          </Button>
        ) : null}
```

In `mobile/src/screens/ChatThreadScreen.tsx`, wrap the header's `ChatAvatar` (their KIP) in a ghost icon `Button`
(ruling 21):

```tsx
          <Button
            testID="thread-visit-room"
            variant="ghost"
            size="icon-lg"
            className="size-[44px]"
            accessibilityLabel={ROOM_COPY.visit.chatLabel(name)}
            onPress={() => navigation.navigate('BuddyRoom', { buddyId, name })}
          >
            <ChatAvatar person={buddy} size={40} ring={ringUnseen} active={active === 'Active now'} testID="thread-avatar" />
          </Button>
```

(importing `ROOM_COPY`; the avatar keeps its testID, so the file's existing avatar tests still find it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomVisit.test.ts __tests__/screens/BuddyRoomScreen.test.tsx __tests__/screens/BuddyWeekScreen.test.tsx __tests__/screens/ChatThreadScreen.test.tsx __tests__/conventions`
Expected: PASS (no new raw pressable; A4 tokens only; "KIP" in capitals). Then the full mobile suite and the
typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/room/visit.ts mobile/src/lib/room/roomCopy.ts mobile/src/components/room/NeutralRoom.tsx mobile/src/screens/BuddyRoomScreen.tsx mobile/src/screens/BuddyWeekScreen.tsx mobile/src/screens/ChatThreadScreen.tsx mobile/src/navigation/RootNavigator.tsx mobile/__tests__
git commit -m "feat(room): visit a buddy's room, drawn neutral, and cheer it"
```

---

### Task 10: Mobile: gifts (send a spare, the boxes on your floor, opening them) and the cheers on your room

Spec §10.3 (pick from "From your spares" (×count); a note from a fixed list; **Send gift**; the sender's count drops at
once; a gift box on their floor, a virtual piece on a free front tile, not a placement; tapping it opens it into the
inventory with NEW; a muted sender's gift arrives without a notice; "A gift" for a deleted sender), §10.2 (the owner
sees who cheered in their own room's cheer sheet). Rulings 11, 13, 14.

**Files:**
- Create: `mobile/src/lib/room/gifts.ts`, `mobile/src/lib/room/giftsStore.ts`, `mobile/src/components/room/RoomGiftBoxes.tsx`,
  `mobile/src/screens/GiftSendScreen.tsx`, `mobile/src/screens/RoomCheersScreen.tsx`,
  `mobile/__tests__/lib/roomGifts.test.ts`, `mobile/__tests__/components/RoomGiftBoxes.test.tsx`,
  `mobile/__tests__/screens/GiftSendScreen.test.tsx`, `mobile/__tests__/screens/RoomCheersScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts`, `mobile/src/lib/room/cosmeticsStore.ts`,
  `mobile/src/components/coach/RoomCard.tsx`, `mobile/src/screens/CoachScreen.tsx`,
  `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/navigationRef.ts`
- Modify (test): `mobile/__tests__/screens/KipPage.test.tsx`

**Interfaces:**
- Consumes: Task 8's `sendGift`, `fetchGifts`, `openGift`, `fetchRoomCheers`, `GiftDTO`, `GIFT_NOTES`, `GiftNote`;
  P2's `newRequestId`, `isServerAnswer`, `applyPurchase`; P1's `isoGrid`, `projOf`, `deskBoxes`, `isoCrop`,
  `footOf`, `seatTile`, `exitTile`, `isoOf`, `placedCounts`, `CATALOGUE`, `ItemIcon`, `ROOM_FRAME_HEIGHT`.
- Produces:
  - `lib/room/gifts.ts`: `interface Spare { itemId: ItemId; spare: number }`;
    `spareTiles(counts, layout): Spare[]`; `MAX_BOXES = 3`; `giftTiles(layout, tier, count): Array<[number, number]>`;
    `giftPoint(tier, tile, offset, cellPt): { x: number; y: number }`;
  - `lib/room/giftsStore.ts`: `interface RoomSocial { gifts: GiftDTO[]; cheers: number }`, `loadRoomSocial()`,
    `openGiftNow(id): Promise<ItemId | null>`, `useRoomSocial(): RoomSocial`, `resetRoomSocial()`;
  - `cosmeticsStore.ts`: `applyGrant(itemId, counts, source: 'buy' | 'gift_in')` (P2's `applyPurchase(itemId, counts)`
    becomes `applyGrant(itemId, counts, 'buy')`), `applyCounts(counts)`;
  - `RoomGiftBoxes({ gifts, layout, tier, width, height, onOpen, busy })`;
  - `RoomCard` props `onOpenCheers?: () => void` and the gift and cheer lines;
  - `ROOM_COPY.gifts`; routes `GiftSend: { buddyId: string; name: string }` and `RoomCheers: undefined`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/roomGifts.test.ts`:

```ts
// Gifts, the pure parts (spec 2026-10-15 §10.3; P4 rulings 11, 14).
import { footOf } from '../../src/lib/room/iso/geometry';
import { isoOf } from '../../src/lib/room/catalogue';
import { MAX_BOXES, giftPoint, giftTiles, spareTiles } from '../../src/lib/room/gifts';
import { starterLayout } from '../../src/lib/room/layout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

it('a spare is a placeable piece owned twice with one not placed (ruling 11)', () => {
  const layout = starterLayout();
  expect(spareTiles(STARTER_COUNTS, layout)).toEqual([]);
  const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'plant.cactus': 2, 'wall.dots': 2 };
  // The fern: 3 owned, 1 placed → 2 spare; the cactus: 2 owned, 0 placed → 1 (you keep one); a wallpaper is no gift.
  expect(spareTiles(counts, layout)).toEqual([{ itemId: 'plant.fern', spare: 2 }, { itemId: 'plant.cactus', spare: 1 }]);
});

it('puts up to 3 boxes on free tiles of the front row, never on a piece, the chair or its exit tile (ruling 14)', () => {
  const layout = starterLayout();
  const tiles = giftTiles(layout, 1, 5);
  expect(tiles.length).toBeLessThanOrEqual(MAX_BOXES);
  expect(tiles.length).toBeGreaterThan(0);
  for (const [i, j] of tiles) {
    expect(j).toBe(6);
    for (const p of layout.pieces.filter((q) => q.layer === 'floor' && !isoOf(q.item)?.flat)) {
      const a = footOf(p, isoOf(p.item)!);
      expect([p.id, i >= a.x0 && i < a.x1 && j >= a.y0 && j < a.y1]).toEqual([p.id, false]);
    }
  }
  expect(giftTiles(layout, 1, 0)).toEqual([]);
  const [x, y] = [giftPoint(1, [0, 6], { x: 0, y: 0 }, 2).x, giftPoint(1, [0, 6], { x: 0, y: 0 }, 2).y];
  expect([Number.isInteger(x), Number.isInteger(y)]).toEqual([true, true]);
});
```

Create `mobile/__tests__/components/RoomGiftBoxes.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RoomGiftBoxes } from '../../src/components/room/RoomGiftBoxes';
import { starterLayout } from '../../src/lib/room/layout';

const gift = (id: string, from: string | null, quiet = false) => ({ id, itemId: 'plant.fern', note: 'cosy' as const, from: from ? { name: from } : null, quiet, at: '2026-10-26T10:00:00.000Z' });

it('draws one 44-pt box per gift, at most 3, each a button that says whose it is', () => {
  const onOpen = jest.fn();
  render(<RoomGiftBoxes gifts={[gift('g1', 'Maya'), gift('g2', null), gift('g3', 'Jo'), gift('g4', 'Al')]} layout={starterLayout()} tier={1} width={360} height={240} onOpen={onOpen} />);
  const boxes = screen.getAllByTestId(/^gift-box-/);
  expect(boxes).toHaveLength(3);
  expect(screen.getByTestId('gift-box-g1').props.accessibilityLabel).toBe('Open the gift from Maya');
  expect(screen.getByTestId('gift-box-g2').props.accessibilityLabel).toBe('Open a gift');
  fireEvent.press(screen.getByTestId('gift-box-g1'));
  expect(onOpen).toHaveBeenCalledWith('g1');
});
```

Create `mobile/__tests__/screens/GiftSendScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { sendGift } from '../../src/api/rooms';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { GiftSendScreen } from '../../src/screens/GiftSendScreen';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/rooms', () => ({ sendGift: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const mockNav = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: { buddyId: 'b1', name: 'Maya' } }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 } }));
  await act(async () => { await loadCosmetics(); });
});

it('lists the spares, picks a note, sends once with one request id, and the count drops at once (spec §10.3)', async () => {
  (sendGift as jest.Mock).mockResolvedValue({ id: 'x', counts: { ...STARTER_COUNTS, 'plant.fern': 1 } });
  render(<GiftSendScreen />);
  expect(screen.getByTestId('gift-title')).toHaveTextContent('Send Maya a gift');
  expect(screen.getByTestId('gift-spare-plant.fern').props.accessibilityLabel).toBe('Fern, 1 spare');
  expect(screen.getByTestId('gift-send').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  fireEvent.press(screen.getByTestId('gift-note-thought'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  expect(sendGift).toHaveBeenCalledWith('b1', expect.stringMatching(/^[0-9a-f-]{36}$/), 'plant.fern', 'thought');
  expect(getCosmetics()?.counts['plant.fern']).toBe(1);
  expect(screen.getByTestId('gift-notice')).toHaveTextContent('Sent the Fern to Maya.');
});

it('a lost answer keeps the same request id for the retry; a server answer drops it (P2 ruling 30)', async () => {
  (sendGift as jest.Mock).mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new ApiError(403, 'not_spare', 'not_spare'));
  render(<GiftSendScreen />);
  fireEvent.press(screen.getByTestId('gift-spare-plant.fern'));
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  await act(async () => { fireEvent.press(screen.getByTestId('gift-send')); });
  const [first, second] = (sendGift as jest.Mock).mock.calls.map((c) => c[1]);
  expect(first).toBe(second);
  expect(screen.getByTestId('gift-notice')).toHaveTextContent('Only a spare can be a gift');
});

it('with no spares says how a piece becomes one, and never mentions money', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { await loadCosmetics(); });
  render(<GiftSendScreen />);
  expect(screen.getByTestId('gift-none')).toHaveTextContent('No spares yet');
  expect(screen.queryByText(/\$|buy|price/i)).toBeNull();
});
```

Create `mobile/__tests__/screens/RoomCheersScreen.test.tsx`:

```tsx
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { fetchRoomCheers } from '../../src/api/rooms';
import { RoomCheersScreen } from '../../src/screens/RoomCheersScreen';

jest.mock('../../src/api/rooms', () => ({ fetchRoomCheers: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));

it('shows who cheered your room this week (spec §10.2)', async () => {
  (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 2, cheers: [{ name: 'Maya', day: '2026-10-27' }, { name: 'Jo', day: '2026-10-26' }] });
  render(<RoomCheersScreen />);
  await act(async () => undefined);
  expect(screen.getByTestId('cheers-title')).toHaveTextContent('Cheers on your room');
  expect(screen.getAllByTestId(/^cheer-row-/).map((r) => r.props.children)).toEqual(['Maya', 'Jo']);
});
```

In `mobile/__tests__/screens/KipPage.test.tsx` add (mock `../../src/api/rooms` with `fetchGifts`, `openGift` and
`fetchRoomCheers`, and render the KIP page with the file's own helper):

```tsx
describe('gifts and cheers on the room card (spec §10.2, §10.3; rulings 13, 14)', () => {
  it('shows each gift as a box, a line for a gift from someone you did not mute, and opens it into the inventory', async () => {
    (fetchRoomCheers as jest.Mock).mockResolvedValue({ count: 2, cheers: [] });
    (fetchGifts as jest.Mock).mockResolvedValue({ gifts: [
      { id: 'g1', itemId: 'plant.ivy', note: 'cosy', from: { name: 'Maya' }, quiet: false, at: '2026-10-26T10:00:00.000Z' },
      { id: 'g2', itemId: 'plant.fern', note: 'desk', from: { name: 'Jo' }, quiet: true, at: '2026-10-26T11:00:00.000Z' },
    ] });
    (openGift as jest.Mock).mockResolvedValue({ counts: { ...STARTER_COUNTS, 'plant.ivy': 1 } });
    await renderKipPage();
    expect(screen.getAllByTestId(/^gift-box-/)).toHaveLength(2);
    expect(screen.getByTestId('room-gift-line')).toHaveTextContent('A gift from Maya is on your floor');
    expect(screen.getByTestId('room-cheers')).toHaveTextContent('2 cheers this week');
    await act(async () => { fireEvent.press(screen.getByTestId('gift-box-g1')); });
    expect(openGift).toHaveBeenCalledWith('g1');
    expect(getCosmetics()?.fresh).toContainEqual({ itemId: 'plant.ivy', source: 'gift_in' });
    expect(screen.getByTestId('room-gift-line')).toHaveTextContent('Trailing ivy is in your inventory.');
    expect(screen.getAllByTestId(/^gift-box-/)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomGifts.test.ts __tests__/components/RoomGiftBoxes.test.tsx __tests__/screens/GiftSendScreen.test.tsx __tests__/screens/RoomCheersScreen.test.tsx __tests__/screens/KipPage.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

Add to `ROOM_COPY`:

```ts
  /** Gifts of spare pieces (spec 2026-10-15 §10.3, C4). Notes are picked, never typed; coins are never gifted. */
  gifts: {
    title: (name: string) => `Send ${name} a gift`,
    spares: 'From your spares',
    spare: (n: number) => `×${n}`,
    spareSpoken: (name: string, n: number) => `${name}, ${n} spare`,
    none: 'No spares yet. A piece you own twice, with one not placed, can be a gift.',
    noteLabel: 'Pick a note',
    notes: { desk: 'For your desk', cosy: 'Cosy!', thought: 'Thought of you' },
    send: 'Send gift',
    sent: (piece: string, name: string) => `Sent the ${piece} to ${name}.`,
    failed: "Couldn't send that just now.",
    box: (name: string | null) => (name ? `Open the gift from ${name}` : 'Open a gift'),
    arrived: (name: string | null) => (name ? `A gift from ${name} is on your floor` : 'A gift is on your floor'),
    many: (n: number) => `${n} gifts are on your floor`,
    opened: (piece: string) => `${piece} is in your inventory.`,
    cheersTitle: 'Cheers on your room',
    cheersNone: 'No cheers this week yet.',
    cheers: (n: number) => `${n} ${n === 1 ? 'cheer' : 'cheers'} this week`,
    cheersOpen: 'See who cheered your room',
  },
```

Create `mobile/src/lib/room/gifts.ts`:

```ts
// Gifts, the pure parts (spec 2026-10-15 §10.3; P4 rulings 11, 14): which pieces are spares (a placeable piece owned
// twice with one not placed; you always keep one), and where the gift boxes stand: free tiles of the front row (the
// row nearest you), never on a piece's footprint, KIP's chair or the tile in front of it. The boxes are not placements.
import { CATALOGUE, isoOf } from './catalogue';
import { exitTile, footOf, placedCounts, seatTile, type RoomLayout, type Tier } from './iso/geometry';
import { isoGrid, projOf } from './iso/grid';
import type { ItemId } from './loadout';

export interface Spare { itemId: ItemId; spare: number }

/** Spares in catalogue order: owned ≥ 2 and owned − placed ≥ 1; you keep one, so at most owned − 1. */
export function spareTiles(counts: Readonly<Record<ItemId, number>>, layout: RoomLayout): Spare[] {
  const placed = placedCounts(layout);
  return CATALOGUE.items.flatMap((i): Spare[] => {
    const owned = counts[i.id] ?? 0;
    const free = owned - (placed[i.id] ?? 0);
    return i.iso && owned >= 2 && free >= 1 ? [{ itemId: i.id, spare: Math.min(owned - 1, free) }] : [];
  });
}

export const MAX_BOXES = 3;

/** Up to min(count, 3) free tiles on the front row (j = m − 1), from the left wall along. */
export function giftTiles(layout: RoomLayout, tier: Tier, count: number): Array<[number, number]> {
  const { n, m } = isoGrid(tier);
  const taken = new Set<string>();
  for (const p of layout.pieces) {
    const iso = p.layer === 'floor' ? isoOf(p.item) : undefined;
    if (!iso || iso.flat) continue;
    const a = footOf(p, iso);
    for (let i = a.x0; i < a.x1; i++) for (let j = a.y0; j < a.y1; j++) taken.add(`${i},${j}`);
    for (const t of [seatTile(p, iso), exitTile(p, iso)]) if (t) taken.add(`${t[0]},${t[1]}`);
  }
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n && out.length < Math.min(count, MAX_BOXES); i++) if (!taken.has(`${i},${m - 1}`)) out.push([i, m - 1]);
  return out;
}

/** A box's centre in the view, in whole points: the tile's centre projected, at the room's offset. */
export function giftPoint(tier: Tier, tile: readonly [number, number], offset: { x: number; y: number }, cellPt: number): { x: number; y: number } {
  const [x, y] = projOf(isoGrid(tier))(tile[0] + 0.5, tile[1] + 0.5);
  return { x: Math.round(x * cellPt + offset.x), y: Math.round(y * cellPt + offset.y) };
}
```

In `mobile/src/lib/room/cosmeticsStore.ts` replace `applyPurchase` with:

```ts
/** A copy landed from the server, bought or a gift opened (spec §6.6, §10.3): the server's counts; the piece owned
 * and NEW until seen (ruling 7). */
export function applyGrant(itemId: ItemId, counts: Readonly<Record<string, number>>, source: 'buy' | 'gift_in'): void {
  // First: a read that started before the grant never brings the old count back.
  epoch++;
  if (!cosmetics) return;
  const owned = new Set(cosmetics.owned);
  owned.add(itemId);
  const fresh = cosmetics.fresh.some((f) => f.itemId === itemId) ? cosmetics.fresh : [...cosmetics.fresh, { itemId, source }];
  publish({ ...cosmetics, owned, counts: { ...counts }, fresh });
}
export const applyPurchase = (itemId: ItemId, counts: Readonly<Record<string, number>>): void => applyGrant(itemId, counts, 'buy');

/** The server's counts after a gift was sent (spec §10.3: the sender's count drops at once). */
export function applyCounts(counts: Readonly<Record<string, number>>): void {
  epoch++;
  if (!cosmetics) return;
  publish({ ...cosmetics, owned: new Set(Object.keys(counts).filter((id) => (counts[id] ?? 0) > 0)), counts: { ...counts } });
}
```

Create `mobile/src/lib/room/giftsStore.ts`:

```ts
// Gifts waiting on your floor and this week's cheers on your room (spec 2026-10-15 §10.2, §10.3), for the KIP page's
// room card. Read on focus; an older server (404) has neither. The epoch guard of the other room stores: an open moves
// it, so a read that started before an open never brings the opened gift back.
import { useSyncExternalStore } from 'react';
import { ApiError } from '../../api/client';
import { fetchGifts, fetchRoomCheers, openGift, type GiftDTO } from '../../api/rooms';
import { applyGrant } from './cosmeticsStore';
import type { ItemId } from './loadout';

export interface RoomSocial { gifts: GiftDTO[]; cheers: number }
const EMPTY: RoomSocial = { gifts: [], cheers: 0 };
let state: RoomSocial = EMPTY;
let epoch = 0;
const listeners = new Set<() => void>();
const publish = (next: RoomSocial) => {
  state = next;
  listeners.forEach((l) => l());
};
const orNone = <T,>(read: Promise<T>, none: T): Promise<T> =>
  read.catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return none;
    throw e;
  });

export async function loadRoomSocial(): Promise<void> {
  const at = ++epoch;
  try {
    const [g, c] = await Promise.all([orNone(fetchGifts(), { gifts: [] }), orNone(fetchRoomCheers(), { count: 0, cheers: [] })]);
    if (at === epoch) publish({ gifts: g.gifts, cheers: c.count });
  } catch {
    // Keep what is shown; the next focus reads again.
  }
}

/** Opens a gift; answers its piece, or null when it was gone (the list is re-read). */
export async function openGiftNow(id: string): Promise<ItemId | null> {
  const gift = state.gifts.find((g) => g.id === id);
  epoch++;
  try {
    const { counts } = await openGift(id);
    publish({ ...state, gifts: state.gifts.filter((g) => g.id !== id) });
    if (gift) applyGrant(gift.itemId, counts, 'gift_in');
    return gift?.itemId ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'gift_gone') {
      publish({ ...state, gifts: state.gifts.filter((g) => g.id !== id) });
      void loadRoomSocial();
      return null;
    }
    throw e;
  }
}

export function resetRoomSocial(): void {
  epoch++;
  publish(EMPTY);
}

export function useRoomSocial(): RoomSocial {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => state);
}
```

(Call `resetRoomSocial()` wherever the app already calls `resetCosmetics()` and `resetCoins()` on sign-out.)

Create `mobile/src/components/room/RoomGiftBoxes.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { GiftDTO } from '../../api/rooms';
import { MAX_BOXES, giftPoint, giftTiles } from '../../lib/room/gifts';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { isoGrid } from '../../lib/room/iso/grid';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import { Button } from '../ui/button';

const CELL_PT = 2;
const BOX: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [1, 4, 10, 7, '#DC2626'], [1, 3, 10, 2, '#F87171'], [5, 3, 2, 8, '#FDE047'], [3, 1, 2, 2, '#FDE047'], [7, 1, 2, 2, '#FDE047'],
];

// Gift boxes on your floor (spec 2026-10-15 §10.3; P4 ruling 14): over the KIP page's room, on free front-row tiles,
// never placements and never in the room picture. Each is a 44-pt ghost Button that says whose gift it is. At most 3.
export function RoomGiftBoxes({ gifts, layout, tier, width, height, onOpen, busy = false }: {
  gifts: readonly GiftDTO[]; layout: RoomLayout; tier: Tier; width: number; height: number; onOpen: (id: string) => void; busy?: boolean;
}) {
  if (!gifts.length || width <= 0) return null;
  const g = isoGrid(tier);
  const offset = isoCrop({ width, height, cellPt: CELL_PT, box: deskBoxes(g, layout).focus, room: g });
  const tiles = giftTiles(layout, tier, Math.min(gifts.length, MAX_BOXES));
  return (
    <>
      {tiles.map((tile, k) => {
        const gift = gifts[k]!;
        const { x, y } = giftPoint(tier, tile, offset, CELL_PT);
        if (x < 0 || y < 0 || x > width || y > height) return null;
        return (
          <View key={gift.id} style={{ position: 'absolute', left: x - 22, top: y - 34 }}>
            <Button
              testID={`gift-box-${gift.id}`}
              variant="ghost"
              size="icon-lg"
              className="size-[44px]"
              disabled={busy}
              accessibilityLabel={ROOM_COPY.gifts.box(gift.from?.name ?? null)}
              onPress={() => onOpen(gift.id)}
            >
              <Svg width={24} height={24} viewBox="0 0 12 12">
                {BOX.map(([bx, by, w, h, fill], i) => <Rect key={i} x={bx} y={by} width={w} height={h} fill={fill} />)}
              </Svg>
            </Button>
          </View>
        );
      })}
    </>
  );
}
```

In `mobile/src/components/coach/RoomCard.tsx`:
- import `useRoomSocial`, `loadRoomSocial`, `openGiftNow`, `RoomGiftBoxes`, `itemName`, `AccessibilityInfo`,
  `Platform`; add the prop `onOpenCheers?: () => void` with the doc "The room's cheers this week (spec §10.2): who
  cheered.";
- read the store and refresh it on focus:

```tsx
  const social = useRoomSocial();
  const [giftLine, setGiftLine] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (focused) void loadRoomSocial();
  }, [focused]);
  // A muted sender's gift arrives without a notice (ruling 13): its box shows, its line does not.
  const loud = social.gifts.filter((g) => !g.quiet);
  const arrived = loud.length > 1 ? ROOM_COPY.gifts.many(social.gifts.length) : loud.length === 1 ? ROOM_COPY.gifts.arrived(loud[0]!.from?.name ?? null) : null;
  const openBox = async (id: string) => {
    if (opening) return;
    setOpening(true);
    try {
      const item = await openGiftNow(id);
      if (item) {
        const line = ROOM_COPY.gifts.opened(itemName(item));
        setGiftLine(line);
        if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(line);
      }
    } catch {
      setGiftLine(ROOM_COPY.gifts.failed);
    } finally {
      setOpening(false);
    }
  };
```

- inside the frame's room `View`, right after the `RoomView` element, add
  `<RoomGiftBoxes gifts={social.gifts} layout={layout} tier={tier} width={inner} height={ROOM_FRAME_HEIGHT} onOpen={(id) => void openBox(id)} busy={opening} />`;
- under the caption row add:

```tsx
      {giftLine ?? arrived ? (
        <Text testID="room-gift-line" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{giftLine ?? arrived}</Text>
      ) : null}
      {social.cheers > 0 && onOpenCheers ? (
        <Button testID="room-cheers" variant="outline" size="sm" className="h-[44px] self-start" accessibilityLabel={`${ROOM_COPY.gifts.cheers(social.cheers)}. ${ROOM_COPY.gifts.cheersOpen}`} onPress={onOpenCheers}>
          {ROOM_COPY.gifts.cheers(social.cheers)}
        </Button>
      ) : null}
```

In `mobile/src/screens/CoachScreen.tsx`, pass `onOpenCheers={() => navigation.navigate('RoomCheers')}` to `RoomCard`.

Create `mobile/src/screens/GiftSendScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { GIFT_NOTES, sendGift, type GiftNote } from '../api/rooms';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import { isServerAnswer, newRequestId } from '../lib/coins/actions';
import { useMyKip } from '../lib/kip/myKip';
import { applyCounts, useCosmetics } from '../lib/room/cosmeticsStore';
import { spareTiles } from '../lib/room/gifts';
import { ROOM_COPY, itemName, spokenName } from '../lib/room/roomCopy';

const G = ROOM_COPY.gifts;

// Send a spare (spec 2026-10-15 §10.3, C4; P4 ruling 11): pick from your spares, pick a note, Send gift. Never
// optimistic: the count drops when the server answers. One request id per gift, kept for a retry after a lost answer
// and dropped after any server answer (P2 ruling 30). Focus lands on the title; the result is announced.
export function GiftSendScreen() {
  const navigation = useNavigation<any>();
  const { buddyId, name } = (useRoute().params ?? {}) as { buddyId: string; name: string };
  const cosmetics = useCosmetics();
  const me = useMyKip();
  const [item, setItem] = useState<string | null>(null);
  const [note, setNote] = useState<GiftNote>('cosy');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const spares = cosmetics ? spareTiles(cosmetics.counts, cosmetics.layout) : [];

  async function send() {
    if (!item || busy) return;
    setBusy(true);
    setNotice(null);
    requestId.current ??= newRequestId();
    try {
      const { counts } = await sendGift(buddyId, requestId.current, item, note);
      requestId.current = null;
      applyCounts(counts);
      const line = G.sent(itemName(item), name);
      setNotice(line);
      setItem(null);
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(line);
    } catch (e) {
      if (isServerAnswer(e)) requestId.current = null;
      setNotice(e instanceof ApiError ? buddyErrorMessage(e.code ?? null) : G.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text ref={titleRef} testID="gift-title" accessibilityRole="header" className="text-heading">{G.title(name)}</Text>
        <Text className="text-caption text-muted-foreground">{G.spares}</Text>
        {spares.length ? (
          <View className="flex-row flex-wrap gap-2">
            {spares.map((s) => (
              <Button
                key={s.itemId}
                testID={`gift-spare-${s.itemId}`}
                variant={item === s.itemId ? 'default' : 'outline'}
                className="h-auto min-h-[64px] w-[72px] flex-col gap-1 rounded-lg p-1"
                accessibilityLabel={G.spareSpoken(spokenName(s.itemId), s.spare)}
                accessibilityState={{ selected: item === s.itemId }}
                onPress={() => setItem(s.itemId)}
              >
                <ItemIcon id={s.itemId} colour={me.colour} size={36} />
                <Text className="text-fine tabular-nums">{G.spare(s.spare)}</Text>
              </Button>
            ))}
          </View>
        ) : (
          <Text testID="gift-none" className="text-body text-muted-foreground">{G.none}</Text>
        )}
        <Text className="text-caption text-muted-foreground">{G.noteLabel}</Text>
        <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
          {GIFT_NOTES.map((n) => (
            <Button key={n} testID={`gift-note-${n}`} variant={note === n ? 'default' : 'outline'} className="h-[44px]" accessibilityRole="tab" accessibilityState={{ selected: note === n }} onPress={() => setNote(n)}>
              {G.notes[n]}
            </Button>
          ))}
        </View>
        <Button testID="gift-send" className="h-[44px]" disabled={!item || busy} onPress={() => void send()}>{G.send}</Button>
        <Text testID="gift-notice" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{notice ?? ''}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Create `mobile/src/screens/RoomCheersScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchRoomCheers, type RoomCheersDTO } from '../api/rooms';
import { Text } from '../components/ui/text';
import { ROOM_COPY } from '../lib/room/roomCopy';

// Who cheered your room this week (spec 2026-10-15 §10.2): your buddies' names, in your own sheet only.
export function RoomCheersScreen() {
  const [body, setBody] = useState<RoomCheersDTO | null>(null);
  const titleRef = useRef<RNText>(null);
  useEffect(() => {
    fetchRoomCheers().then(setBody).catch(() => setBody({ count: 0, cheers: [] }));
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text ref={titleRef} testID="cheers-title" accessibilityRole="header" className="text-heading">{ROOM_COPY.gifts.cheersTitle}</Text>
        {body && !body.cheers.length ? <Text className="text-body text-muted-foreground">{ROOM_COPY.gifts.cheersNone}</Text> : null}
        {body?.cheers.map((c, i) => <Text key={`${c.name}-${i}`} testID={`cheer-row-${i}`} className="text-body">{c.name}</Text>)}
      </ScrollView>
    </SafeAreaView>
  );
}
```

In `mobile/src/navigation/RootNavigator.tsx`: import both screens; add `GiftSend: { buddyId: string; name: string };`
and `RoomCheers: undefined;` to `RootStackParamList`; register
`<Stack.Screen name="GiftSend" component={GiftSendScreen} options={{ headerShown: false, presentation: 'modal' }} />`
and `<Stack.Screen name="RoomCheers" component={RoomCheersScreen} options={{ headerShown: false, presentation: 'modal' }} />`.
In `mobile/src/navigation/navigationRef.ts` add `'GiftSend'` and `'RoomCheers'` to `MODAL_ROUTES` (no room toast over
a modal).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomGifts.test.ts __tests__/components/RoomGiftBoxes.test.tsx __tests__/screens/GiftSendScreen.test.tsx __tests__/screens/RoomCheersScreen.test.tsx __tests__/screens/KipPage.test.tsx __tests__/screens/CoinShopScreen.test.tsx __tests__/conventions`
Expected: PASS (`CoinShopScreen` still lands a purchase through `applyPurchase`). Then the full mobile suite and the
typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/room mobile/src/components/room/RoomGiftBoxes.tsx mobile/src/components/coach/RoomCard.tsx mobile/src/screens/GiftSendScreen.tsx mobile/src/screens/RoomCheersScreen.tsx mobile/src/screens/CoachScreen.tsx mobile/src/navigation mobile/__tests__
git commit -m "feat(room): send spare pieces as gifts, open the boxes on your floor, see who cheered"
```

---

### Task 11: Mobile: the weekly theme challenge (`RoomChallenge`), the drawer's theme tab and checklist

Spec §10.4 (the brief: "Room challenge · Buddies only · 3 days left", the theme, the brief, "5 buddies in", "Ends
Sunday 20:00", the rewards; the entry sheet's consent line above **Start my entry**; "Your entry is a snapshot of your
room on Sunday. Build as usual until then."; the drawer's theme tab and "Warm pieces · 2 of 3"; buddies cheer entries;
results "{name}'s room won", the circle's cheer counts, "You entered"), §5.4 (a theme tab during a challenge). Rulings
4, 6, 7, 10, 22, 28.

**Files:**
- Create: `mobile/src/lib/room/challenge.ts`, `mobile/src/screens/RoomChallengeScreen.tsx`,
  `mobile/__tests__/lib/roomChallenge.test.ts`, `mobile/__tests__/screens/RoomChallengeScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts`, `mobile/src/lib/room/giftsStore.ts`, `mobile/src/lib/room/edit/editor.ts`,
  `mobile/src/lib/room/edit/drawer.ts`, `mobile/src/components/edit/InventoryDrawer.tsx`,
  `mobile/src/screens/DecorateRoomScreen.tsx`, `mobile/src/components/coach/RoomCard.tsx`,
  `mobile/src/screens/CoachScreen.tsx`, `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/navigationRef.ts`
- Modify (tests): `mobile/__tests__/lib/roomDrawer.test.ts` (or the file that tests `drawerTabs` and `pieceTiles`),
  `mobile/__tests__/screens/KipPage.test.tsx`

**Interfaces:**
- Consumes: Task 8's `fetchChallenge`, `enterChallenge`, `cheerEntry`, `ChallengeDTO`, `ThemeId`, `ChallengeTag`;
  Task 9's `NeutralRoom`, `tierOfSize`; Task 10's `giftsStore`; P1's `readLayout`, `catalogueItem`, `itemName`,
  `DrawerTab`, `editorReducer`, `drawerTabs`, `pieceTiles`.
- Produces:
  - `lib/room/challenge.ts`: `briefCount(layout, tag): number`; `checklist(layout, theme): { count: number; atLeast: number; met: boolean }`;
    `daysLeft(closesAt: string, now: Date): number`; `entryRoom(snapshot): { layout: RoomLayout; tier: Tier; size: { n: number; m: number } }`;
  - `ROOM_COPY.challenge` (with `themes[id]`: `title`, `brief`, `tab`, `tagName`);
  - editor: `interface EditorTheme { id: ThemeId; tag: ChallengeTag; atLeast: number }`, `EditorState.theme: EditorTheme | null`,
    action `{ type: 'theme'; theme: EditorTheme | null }`, `DrawerTab` gains `'theme'`;
    drawer: `drawerTabLabel(s, tab): string`, `themeChecklist(s): { line: string; spoken: string } | null`;
  - `RoomSocial.challenge: { live: boolean; themeId: ThemeId | null; entry: boolean } | null`;
  - `RoomCard` prop `onOpenChallenge?: () => void`; route `RoomChallenge: undefined`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/roomChallenge.test.ts`:

```ts
// The challenge, the pure parts and the copy guard (spec 2026-10-15 §10.4, §8.3's words; P4 rulings 4, 7).
import { briefCount, checklist, daysLeft, entryRoom } from '../../src/lib/room/challenge';
import { starterLayout } from '../../src/lib/room/layout';
import { ROOM_COPY } from '../../src/lib/room/roomCopy';

const pumpkin = (id: string, x: number) => ({ id, item: 'corner.pumpkin', layer: 'floor' as const, x, y: 6, facing: 'L' as const, mirror: false });

it('counts the theme\'s pieces in the room (the starter room has 2 warm ones: the amber lamp and the mug)', () => {
  const room = { ...starterLayout(), pieces: [...starterLayout().pieces, pumpkin('p1', 6)] };
  expect(briefCount(starterLayout(), 'warm')).toBe(2);
  expect(checklist(room, { tag: 'warm', atLeast: 3 })).toEqual({ count: 3, atLeast: 3, met: true });
  expect(ROOM_COPY.challenge.checklist('Warm pieces', 2, 3)).toBe('Warm pieces · 2 of 3');
  expect(ROOM_COPY.challenge.checklistSpoken('Warm pieces', 2, 3)).toBe('Warm pieces, 2 of 3');
});

it('days left to the entrant\'s close, never below 0', () => {
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-10-29T12:00:00.000Z'))).toBe(3);
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-11-01T19:00:00.000Z'))).toBe(0);
  expect(daysLeft('2026-11-01T20:00:00.000Z', new Date('2026-11-02T19:00:00.000Z'))).toBe(0);
  expect(ROOM_COPY.challenge.daysLeft(3)).toBe('3 days left');
  expect(ROOM_COPY.challenge.daysLeft(0)).toBe('Last day');
});

it('reads an entry snapshot as a room; a broken one is the starter room', () => {
  expect(entryRoom({ layout: starterLayout(), size: { n: 9, m: 9 } }).tier).toBe(3);
  expect(entryRoom({ layout: null, size: { n: 7, m: 7 } }).layout).toEqual(starterLayout());
});

it('visit, gift and challenge copy gives no health advice and names no health number (Global Constraints)', () => {
  const HEALTH_VERB = /(^|[.!?]\s+)(sleep|walk|drink|rest|exercise|go|get|hit|reach|eat)\b/i;
  const HEALTH_WORD = /\b(steps?|hours? of sleep|sleep score|recovery|bpm|hrv)\b/i;
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') strings.push(v);
    else if (typeof v === 'function') for (const args of [[0], [1, 3], ['Maya'], ['Maya', 2], ['Warm pieces', 2, 3], [{ n: 8, m: 8 }, 31]]) strings.push(String((v as (...a: unknown[]) => unknown)(...args)));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([ROOM_COPY.visit, ROOM_COPY.gifts, ROOM_COPY.challenge]);
  for (const s of strings) expect([s, HEALTH_VERB.test(s) || HEALTH_WORD.test(s)]).toEqual([s, false]);
});
```

Create `mobile/__tests__/screens/RoomChallengeScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { cheerEntry, enterChallenge, fetchChallenge } from '../../src/api/rooms';
import { starterLayout } from '../../src/lib/room/layout';
import { RoomChallengeScreen } from '../../src/screens/RoomChallengeScreen';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/rooms', () => ({ fetchChallenge: jest.fn(), enterChallenge: jest.fn(), cheerEntry: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

const THEME = { id: 'cosyAutumn', tag: 'warm', atLeast: 3, themePiece: 'lamp.harvest', trophy: 'corner.acorn' };
const ENTRY = { userId: 'b1', name: 'Maya', kipColour: 'lime', kipWorn: { head: null, face: null, neck: null, ears: null }, snapshot: { layout: starterLayout(), size: { n: 8, m: 8 } }, cheers: 2, cheeredByMe: false, mine: false };
const body = (over = {}) => ({ week: '2026-W44', theme: THEME, closesAt: new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString(), open: true, entry: null, entries: [ENTRY], results: null, ...over });

beforeEach(() => jest.clearAllMocks());
async function open(dto = body()) {
  (fetchChallenge as jest.Mock).mockResolvedValue(dto);
  render(<RoomChallengeScreen />);
  await act(async () => undefined);
}

it('shows the brief, the rewards, and the consent line above Start my entry (spec §10.4, controller ruling)', async () => {
  await open();
  expect(screen.getByTestId('challenge-title')).toHaveTextContent('Cosy autumn');
  expect(screen.getByTestId('challenge-brief')).toHaveTextContent('Use 3 or more warm pieces.');
  expect(screen.getByTestId('challenge-tags')).toHaveTextContent('1 buddy in');
  expect(screen.getByTestId('challenge-tags')).toHaveTextContent('3 days left');
  expect(screen.getByTestId('challenge-reward-piece')).toHaveTextContent('Harvest lantern');
  expect(screen.getByTestId('challenge-reward-trophy')).toHaveTextContent('Golden acorn');
  expect(screen.getByTestId('challenge-consent')).toHaveTextContent('Your buddies will see your entry: a snapshot of your room, including its size.');
  (enterChallenge as jest.Mock).mockResolvedValue(body({ entry: { count: 2, meets: false, paid: false } }));
  await act(async () => { fireEvent.press(screen.getByTestId('challenge-start')); });
  expect(enterChallenge).toHaveBeenCalled();
  expect(screen.getByTestId('challenge-checklist')).toHaveTextContent('Warm pieces · 2 of 3');
  expect(screen.getByTestId('challenge-checklist').props.accessibilityLabel).toBe('Warm pieces, 2 of 3');
  fireEvent.press(screen.getByTestId('challenge-build'));
  expect(mockNav.navigate).toHaveBeenCalledWith('DecorateRoom', { drawer: 'theme' });
});

it('draws buddies\' entries neutral and cheers one once (ruling 10, 24)', async () => {
  (cheerEntry as jest.Mock).mockResolvedValue({ paid: true });
  await open();
  const room = screen.getByTestId('entry-room-b1');
  expect(room.props.living).toBeUndefined();
  expect(room.props.room).toMatch(/:fallback:/);
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('2 cheers');
  await act(async () => { fireEvent.press(screen.getByTestId('entry-cheer-b1')); });
  expect(cheerEntry).toHaveBeenCalledWith('b1');
  expect(screen.getByTestId('entry-cheers-b1')).toHaveTextContent('3 cheers');
  expect(screen.getByTestId('entry-cheer-b1').props.accessibilityState).toMatchObject({ disabled: true });
});

it('shows last week\'s results in your circle, and the unranked case (ruling 28)', async () => {
  await open(body({ results: { week: '2026-W43', themeId: 'tidyDesk', ranked: true, winners: ['Maya'], entries: [{ name: 'Maya', cheers: 4, mine: false }, { name: 'You', cheers: 2, mine: true }], you: { entered: true, won: false } } }));
  expect(screen.getByTestId('results-won')).toHaveTextContent("Maya's room won");
  expect(screen.getByTestId('results-glow')).toHaveTextContent('The trophy glows on their floor at night');
  expect(screen.getByTestId('results-you')).toHaveTextContent('You entered');
  await open(body({ theme: null, entries: [], results: { week: '2026-W43', themeId: 'tidyDesk', ranked: false, winners: [], entries: [], you: { entered: true, won: false } } }));
  expect(screen.getAllByTestId('results-unranked')[0]).toHaveTextContent('no ranking');
  expect(screen.getAllByTestId('challenge-none')[0]).toHaveTextContent("There's no room challenge this week.");
});
```

In the drawer's test file (the one that already tests `drawerTabs` and `pieceTiles`) add:

```ts
it('adds the theme tab while you have an open entry, listing the owned pieces of its tag (spec §5.4, §10.4)', () => {
  const s0 = initEditor({ layout: starterLayout(), worn: { ...EMPTY_WORN }, tier: 1, counts: { ...STARTER_COUNTS, 'corner.pumpkin': 1 }, version: 1, newIds: [] });
  expect(drawerTabs(s0)).not.toContain('theme');
  const s = editorReducer(s0, { type: 'theme', theme: { id: 'cosyAutumn', tag: 'warm', atLeast: 3 } });
  expect(drawerTabs(s)).toEqual(['all', 'floor', 'wall', 'onTop', 'funny', 'effects', 'theme', 'room', 'kip', 'sets']);
  expect(drawerTabLabel(s, 'theme')).toBe('Autumn');
  expect(pieceTiles(s, 'theme').map((t) => t.item)).toEqual(expect.arrayContaining(['corner.pumpkin', 'lamp.amber', 'item.mug']));
  expect(pieceTiles(s, 'theme').map((t) => t.item)).not.toContain('plant.fern');
  expect(themeChecklist(s)).toEqual({ line: 'Warm pieces · 2 of 3', spoken: 'Warm pieces, 2 of 3' });
});
```

In `mobile/__tests__/screens/KipPage.test.tsx` add (with `fetchChallenge` in the file's `../../src/api/rooms` mock):

```tsx
it('offers the room challenge while a theme is live, and not otherwise (ruling 22)', async () => {
  (fetchChallenge as jest.Mock).mockResolvedValue({ week: '2026-W44', theme: { id: 'cosyAutumn', tag: 'warm', atLeast: 3, themePiece: 'lamp.harvest', trophy: 'corner.acorn' }, closesAt: '2099-01-01T00:00:00.000Z', open: true, entry: null, entries: [], results: null });
  await renderKipPage();
  fireEvent.press(screen.getByTestId('room-challenge'));
  expect(mockNav.navigate).toHaveBeenCalledWith('RoomChallenge');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomChallenge.test.ts __tests__/screens/RoomChallengeScreen.test.tsx __tests__/lib/roomDrawer.test.ts __tests__/screens/KipPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `ROOM_COPY`:

```ts
  /** The weekly theme challenge (spec 2026-10-15 §10.4, C3). The server sends a theme's id; its words live here. */
  challenge: {
    open: 'Room challenge',
    heading: 'Room challenge',
    buddiesOnly: 'Buddies only',
    themes: {
      cosyAutumn: { title: 'Cosy autumn', brief: 'Use 3 or more warm pieces.', tab: 'Autumn', tagName: 'Warm pieces' },
      greenThumb: { title: 'Green thumb', brief: 'Use 4 or more plants.', tab: 'Plants', tagName: 'Plants' },
      nightOwl: { title: 'Night owl', brief: 'Use 3 or more pieces that glow.', tab: 'Glow', tagName: 'Glowing pieces' },
      tidyDesk: { title: 'Tidy desk', brief: 'Use 3 or more desk pieces.', tab: 'Desk', tagName: 'Desk pieces' },
    },
    how: 'Buddies cheer the rooms they like; the most-cheered room in your circle wins on Sunday.',
    buddiesIn: (n: number) => `${n} ${n === 1 ? 'buddy' : 'buddies'} in`,
    daysLeft: (n: number) => (n <= 0 ? 'Last day' : `${n} ${n === 1 ? 'day' : 'days'} left`),
    ends: 'Ends Sunday 20:00',
    rewards: 'Rewards',
    enter: 'Enter: +30 coins, once',
    piece: (name: string) => `${name}: this week only, in the coin shop for 80`,
    trophy: (name: string) => `${name}: the trophy for the most-cheered room, glows at night`,
    consent: 'Your buddies will see your entry: a snapshot of your room, including its size.',
    start: 'Start my entry',
    snapshot: 'Your entry is a snapshot of your room on Sunday. Build as usual until then.',
    entered: 'You entered',
    paid: '+30 coins',
    paidSpoken: 'Plus 30 coins',
    checklist: (tagName: string, n: number, of: number) => `${tagName} · ${n} of ${of}`,
    checklistSpoken: (tagName: string, n: number, of: number) => `${tagName}, ${n} of ${of}`,
    build: 'Build it in the editor',
    entries: "Your buddies' entries",
    entryLabel: (name: string) => `${name}'s entry`,
    cheer: (name: string) => `Cheer ${name}'s entry`,
    cheers: (n: number) => `${n} ${n === 1 ? 'cheer' : 'cheers'}`,
    cheered: 'Cheered',
    closed: "This week's challenge has closed.",
    none: "There's no room challenge this week.",
    results: 'Last week',
    won: (name: string) => `${name}'s room won`,
    glow: 'The trophy glows on their floor at night',
    youWon: 'Your room won! The trophy is in your inventory.',
    unranked: 'Fewer than 3 entries: no ranking this week. Everyone who entered keeps the entry coins.',
    youEntered: 'You entered',
    failed: "Couldn't load the room challenge just now.",
    retry: 'Try again',
    close: 'Close',
  },
```

Create `mobile/src/lib/room/challenge.ts`:

```ts
// The weekly challenge, the pure parts (spec 2026-10-15 §10.4; P4 rulings 3, 7): how many of the theme's pieces a room
// holds (the catalogue's tags, once per placement), the brief's checklist, the days left to the entrant's own close,
// and an entry's snapshot as a room to draw neutral.
import type { ChallengeTag } from '../../api/rooms';
import { catalogueItem } from './catalogue';
import type { RoomLayout, Tier } from './iso/geometry';
import { readLayout } from './layout';
import { tierOfSize } from './visit';

const DAY_MS = 86_400_000;

export function briefCount(layout: RoomLayout, tag: ChallengeTag): number {
  return layout.pieces.filter((p) => !!catalogueItem(p.item)?.tags?.includes(tag)).length;
}

export function checklist(layout: RoomLayout, theme: { tag: ChallengeTag; atLeast: number }): { count: number; atLeast: number; met: boolean } {
  const count = briefCount(layout, theme.tag);
  return { count, atLeast: theme.atLeast, met: count >= theme.atLeast };
}

/** Whole days left before the close, never below 0 (the last day reads "Last day"). */
export function daysLeft(closesAt: string, now: Date): number {
  return Math.max(0, Math.floor((Date.parse(closesAt) - now.getTime()) / DAY_MS));
}

export function entryRoom(snapshot: { layout: unknown; size: { n: number; m: number } }): { layout: RoomLayout; tier: Tier; size: { n: number; m: number } } {
  return { layout: readLayout(snapshot.layout), tier: tierOfSize(snapshot.size), size: snapshot.size };
}
```

In `mobile/src/lib/room/edit/editor.ts`:
- `export type DrawerTab = 'all' | 'floor' | 'wall' | 'onTop' | 'funny' | 'effects' | 'theme' | 'new' | 'room' | 'kip' | 'sets';`
- add `export interface EditorTheme { id: ThemeId; tag: ChallengeTag; atLeast: number }` (types from `../../../api/rooms`),
  `theme: EditorTheme | null;` to `EditorState` with the doc "Your open challenge entry's theme (spec §10.4): the
  drawer's theme tab and checklist.", `theme: null,` in `initEditor`'s return, the action
  `| { type: 'theme'; theme: EditorTheme | null }` and the case

```ts
    case 'theme':
      // A theme that ends while its tab is open falls back to All.
      return { ...s, theme: a.theme, drawer: !a.theme && s.drawer === 'theme' ? 'all' : s.drawer };
```

In `mobile/src/lib/room/edit/drawer.ts`:
- `drawerTabs` returns
  `['all', 'floor', 'wall', 'onTop', 'funny', 'effects', ...(s.theme ? (['theme'] as const) : []), ...(s.newIds.length ? (['new'] as const) : []), 'room', 'kip', 'sets']`;
- `inTab` takes the state: `const inTab = (id: ItemId, tab: DrawerTab, s: EditorState) => …` with
  `case 'new': return s.newIds.includes(id);` and `case 'theme': return !!s.theme && !!catalogueItem(id)?.tags?.includes(s.theme.tag);`,
  and `pieceTiles` calls `inTab(i.id, tab, s)`;
- add:

```ts
/** A tab's label: the theme tab is named for the theme ("Autumn"). */
export function drawerTabLabel(s: EditorState, tab: DrawerTab): string {
  if (tab === 'theme') return s.theme ? ROOM_COPY.challenge.themes[s.theme.id].tab : '';
  return D.tabs[tab];
}

/** "Warm pieces · 2 of 3" over the theme tab (spec §10.4, C3), from the draft as it is now. */
export function themeChecklist(s: EditorState): { line: string; spoken: string } | null {
  if (!s.theme) return null;
  const c = checklist(s.draft.layout, s.theme);
  const name = ROOM_COPY.challenge.themes[s.theme.id].tagName;
  return { line: ROOM_COPY.challenge.checklist(name, c.count, c.atLeast), spoken: ROOM_COPY.challenge.checklistSpoken(name, c.count, c.atLeast) };
}
```

(import `checklist` from `../challenge`).

In `mobile/src/components/edit/InventoryDrawer.tsx`: import `drawerTabLabel` and `themeChecklist`; the tab label
`{D.tabs[tab]}` becomes `{drawerTabLabel(state, tab)}`; under the tabs' `ScrollView`, add

```tsx
      {state.drawer === 'theme' && themeChecklist(state) ? (
        <Text testID="drawer-checklist" accessibilityLabel={themeChecklist(state)!.spoken} className="px-4 text-caption tabular-nums text-muted-foreground">
          {themeChecklist(state)!.line}
        </Text>
      ) : null}
```

In `mobile/src/screens/DecorateRoomScreen.tsx`, after the reducer is set up, read the challenge once and hand the
editor its theme while you have an open entry (an older server, or a failure, leaves no theme):

```tsx
  useEffect(() => {
    let live = true;
    fetchChallenge()
      .then((c) => {
        if (live && c.theme && c.open && c.entry) dispatch({ type: 'theme', theme: { id: c.theme.id, tag: c.theme.tag, atLeast: c.theme.atLeast } });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
```

In `mobile/src/lib/room/giftsStore.ts`: `RoomSocial` gains
`challenge: { live: boolean; themeId: ThemeId | null; entry: boolean } | null` (`EMPTY` has `challenge: null`), and
`loadRoomSocial` reads `orNone(fetchChallenge(), null)` beside the other two and publishes
`challenge: c ? { live: !!c.theme && c.open, themeId: c.theme?.id ?? null, entry: !!c.entry } : null`.

In `mobile/src/components/coach/RoomCard.tsx` add the prop `onOpenChallenge?: () => void` ("The weekly room challenge
(spec §10.4), while a theme is live.") and, beside the cheers button:

```tsx
      {social.challenge?.live && onOpenChallenge ? (
        <Button testID="room-challenge" variant="outline" size="sm" className="h-[44px] self-start" onPress={onOpenChallenge}>
          {ROOM_COPY.challenge.open}
        </Button>
      ) : null}
```

and in `CoachScreen.tsx` pass `onOpenChallenge={() => navigation.navigate('RoomChallenge')}`.

Create `mobile/src/screens/RoomChallengeScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { cheerEntry, enterChallenge, fetchChallenge, type ChallengeDTO } from '../api/rooms';
import { ItemIcon } from '../components/room/ItemIcon';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Text } from '../components/ui/text';
import { buddyErrorMessage } from '../lib/buddyCopy';
import { kipColourOf } from '../lib/kip/kipColour';
import { kipWornOf } from '../lib/kip/wornArt';
import { useMyKip } from '../lib/kip/myKip';
import { daysLeft, entryRoom } from '../lib/room/challenge';
import { ROOM_COPY, itemName } from '../lib/room/roomCopy';

const C = ROOM_COPY.challenge;
type State = { status: 'loading' } | { status: 'ready'; dto: ChallengeDTO } | { status: 'error' };

// The weekly theme challenge (spec 2026-10-15 §10.4, C3; P4 rulings 6, 7, 10, 22, 28): the brief and its rewards; the
// consent line above Start my entry (entering is the opt-in for the snapshot); your entry's checklist and the way to
// the editor; your buddies' entries drawn neutral, each cheered once; last week's results in your circle. Focus lands
// on the title; a cheer and an entry are announced (iOS) and shown in a live line (Android).
export function RoomChallengeScreen() {
  const navigation = useNavigation<any>();
  const me = useMyKip();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const titleRef = useRef<RNText>(null);

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', dto: await fetchChallenge() });
    } catch {
      setState({ status: 'error' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [state.status]);

  const say = (line: string, spoken = line) => {
    setNote(line);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(spoken);
  };
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote(buddyErrorMessage(e instanceof ApiError ? e.code ?? null : null));
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <SafeAreaView className="flex-1 items-center justify-center bg-background"><ActivityIndicator testID="challenge-loading" /></SafeAreaView>;
  if (state.status === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text className="text-body text-muted-foreground">{C.failed}</Text>
        <Button testID="challenge-retry" variant="secondary" className="h-[44px]" onPress={() => void load()}>{C.retry}</Button>
      </SafeAreaView>
    );
  }
  const d = state.dto;
  const theme = d.theme ? C.themes[d.theme.id] : null;
  const update = (dto: ChallengeDTO) => setState({ status: 'ready', dto });
  const start = () => run(async () => {
    const dto = await enterChallenge();
    update(dto);
    say(dto.entry?.paid ? `${C.entered}. ${C.paid}` : C.entered, dto.entry?.paid ? `${C.entered}. ${C.paidSpoken}` : C.entered);
  });
  const cheer = (userId: string, name: string) => run(async () => {
    await cheerEntry(userId);
    update({ ...d, entries: d.entries.map((e) => (e.userId === userId ? { ...e, cheers: e.cheers + 1, cheeredByMe: true } : e)) });
    say(C.cheered, `${C.cheered} ${name}`);
  });
  // The checklist's count is the server's, over the entry's snapshot.
  const mine = !!d.entry;
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text accessibilityLabel={`${C.heading}, ${C.buddiesOnly}`} className="font-pixel text-label text-muted-foreground">{`${C.heading} · ${C.buddiesOnly}`}</Text>
        {d.theme && theme ? (
          <Card className="gap-2 p-4">
            <Text ref={titleRef} testID="challenge-title" accessibilityRole="header" className="font-pixel text-page-title">{theme.title}</Text>
            <Text testID="challenge-brief" className="text-body text-muted-foreground">{`${theme.brief} ${C.how}`}</Text>
            <Text testID="challenge-tags" accessibilityLabel={[C.buddiesIn(d.entries.length), d.closesAt ? C.daysLeft(daysLeft(d.closesAt, new Date())) : '', C.ends].filter(Boolean).join(', ')} className="text-caption tabular-nums">
              {[C.buddiesIn(d.entries.length), d.closesAt ? C.daysLeft(daysLeft(d.closesAt, new Date())) : '', C.ends].filter(Boolean).join(' · ')}
            </Text>
          </Card>
        ) : (
          <Text ref={titleRef} testID="challenge-none" accessibilityRole="header" className="text-body text-muted-foreground">{C.none}</Text>
        )}
        {d.theme ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-heading">{C.rewards}</Text>
            <Text className="text-body">{C.enter}</Text>
            <View testID="challenge-reward-piece" className="flex-row items-center gap-2">
              <ItemIcon id={d.theme.themePiece} colour={me.colour} size={36} />
              <Text className="shrink text-body">{C.piece(itemName(d.theme.themePiece))}</Text>
            </View>
            <View testID="challenge-reward-trophy" className="flex-row items-center gap-2">
              <ItemIcon id={d.theme.trophy} colour={me.colour} size={36} />
              <Text className="shrink text-body">{C.trophy(itemName(d.theme.trophy))}</Text>
            </View>
          </View>
        ) : null}
        {d.theme && d.open && !d.entry ? (
          <View className="gap-2">
            <Text testID="challenge-consent" className="text-caption text-muted-foreground">{C.consent}</Text>
            <Button testID="challenge-start" className="h-[44px]" disabled={busy} onPress={() => void start()}>{C.start}</Button>
            <Text className="text-caption text-muted-foreground">{C.snapshot}</Text>
          </View>
        ) : null}
        {d.theme && theme && mine ? (
          <Card className="gap-2 p-4">
            <Text accessibilityLabel={d.entry!.paid ? `${C.entered}, ${C.paidSpoken}` : C.entered} className="text-body font-semibold">{d.entry!.paid ? `${C.entered} · ${C.paid}` : C.entered}</Text>
            <Text testID="challenge-checklist" accessibilityLabel={C.checklistSpoken(theme.tagName, d.entry!.count, d.theme.atLeast)} className="text-caption tabular-nums">
              {C.checklist(theme.tagName, d.entry!.count, d.theme.atLeast)}
            </Text>
            {d.open ? <Button testID="challenge-build" variant="outline" className="h-[44px]" onPress={() => navigation.navigate('DecorateRoom', { drawer: 'theme' })}>{C.build}</Button> : <Text className="text-caption">{C.closed}</Text>}
          </Card>
        ) : null}
        {d.entries.length ? <Text accessibilityRole="header" className="text-heading">{C.entries}</Text> : null}
        {d.entries.map((e) => {
          const room = entryRoom(e.snapshot);
          return (
            <View key={e.userId} className="gap-2">
              <NeutralRoom testID={`entry-room-${e.userId}`} layout={room.layout} tier={room.tier} colour={kipColourOf(e.kipColour)} worn={kipWornOf(e.kipWorn)} pose="rest" bubble={null} width={280} height={180} label={C.entryLabel(e.name)} />
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-body font-semibold">{e.name}</Text>
                <Text testID={`entry-cheers-${e.userId}`} className="text-caption tabular-nums">{C.cheers(e.cheers)}</Text>
              </View>
              <Button testID={`entry-cheer-${e.userId}`} variant="outline" className="h-[44px]" disabled={busy || e.cheeredByMe || !d.open} onPress={() => void cheer(e.userId, e.name)}>
                {e.cheeredByMe ? C.cheered : C.cheer(e.name)}
              </Button>
            </View>
          );
        })}
        <Text testID="challenge-note" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{note ?? ''}</Text>
        {d.results ? (
          <Card className="gap-2 p-4">
            <Text accessibilityRole="header" className="text-heading">{C.results}</Text>
            {d.results.ranked ? (
              <>
                {d.results.you.won ? <Text testID="results-mine" className="text-body">{C.youWon}</Text> : null}
                {d.results.winners.map((w) => <Text key={w} testID="results-won" className="text-body font-semibold">{C.won(w)}</Text>)}
                <Text testID="results-glow" className="text-caption text-muted-foreground">{C.glow}</Text>
                {d.results.entries.map((r, i) => <Text key={`${r.name}-${i}`} accessibilityLabel={`${r.name}, ${C.cheers(r.cheers)}`} className="text-caption tabular-nums">{`${r.name} · ${C.cheers(r.cheers)}`}</Text>)}
              </>
            ) : (
              <Text testID="results-unranked" className="text-body">{C.unranked}</Text>
            )}
            {d.results.you.entered ? <Text testID="results-you" className="text-caption">{C.youEntered}</Text> : null}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

In `mobile/src/navigation/RootNavigator.tsx` add `RoomChallenge: undefined;` and
`<Stack.Screen name="RoomChallenge" component={RoomChallengeScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />`
(the screen's own Close button dismisses it, as `CoinShopScreen`'s does), and add `'RoomChallenge'` to `MODAL_ROUTES`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/roomChallenge.test.ts __tests__/screens/RoomChallengeScreen.test.tsx __tests__/lib/roomDrawer.test.ts __tests__/screens/KipPage.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/conventions`
Expected: PASS (`DecorateRoomScreen.test.tsx` mocks `../../src/api/rooms`' `fetchChallenge` to reject, so its tabs are
unchanged; add that mock if the file has none). Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(room): the weekly theme challenge: brief, entry, buddies' entries, cheers, results, and the theme tab"
```

---

### Task 12: Mobile: the share card (`ShareRoom`)

Spec §10.5 ("Share your room" from the editor's menu, "Makes an image; nothing is posted"; the room with health-linked
effects neutral, "KIP's room", "8 × 8 · 31 pieces · Cosy autumn week" (the size, not a level); **Show my first name**
off by default, **KIP waves** on by default; **Save image** and **Share…**; rendered off-screen 1080 px wide through
`lib/recapCapture.ts`; nothing leaves the phone until Save or Share; "The card shows the room only: no health numbers,
no streaks."). Rulings 23, 24.

**Files:**
- Create: `mobile/src/lib/room/shareCard.ts`, `mobile/src/screens/ShareRoomScreen.tsx`,
  `mobile/__tests__/lib/shareCard.test.ts`, `mobile/__tests__/screens/ShareRoomScreen.test.tsx`
- Modify: `mobile/src/lib/recapCapture.ts`, `mobile/src/lib/useRecapExport.ts`, `mobile/src/lib/room/roomCopy.ts`,
  `mobile/src/components/edit/InventoryDrawer.tsx`, `mobile/src/screens/DecorateRoomScreen.tsx`,
  `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/navigationRef.ts`
- Modify (test): `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9's `NeutralRoom`; Task 11's `useRoomSocial().challenge`; P1's `useMyRoom`, `useMyKip`; Spec's
  `captureToPng`, `saveImage`, `shareImage`, `useRecapExport`, `EXPORT_NOTICES`; `fetchIdentity` (`api/buddies.ts`).
- Produces: `SHARE_PIXELS = 1080`; `shareSize(pixelRatio): { width: number; height: number }`;
  `firstNameOf(displayName): string | null`;
  `shareLines({ size, pieces, themeTitle, name, showName }): { title: string; meta: string; metaSpoken: string; byline: string | null }`;
  `shareImage(uri, dialogTitle?)`; `useRecapExport({ dialogTitle }?)`; `ROOM_COPY.share`; `InventoryDrawer` prop
  `onOpenShare?: () => void`; route `ShareRoom: undefined`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/shareCard.test.ts`:

```ts
// The share card's words and size (spec 2026-10-15 §10.5; P4 ruling 23).
import { SHARE_PIXELS, firstNameOf, shareLines, shareSize } from '../../src/lib/room/shareCard';

it('is 1080 px wide on any screen', () => {
  expect(SHARE_PIXELS).toBe(1080);
  expect(shareSize(3)).toEqual({ width: 360, height: 450 });
  expect(shareSize(2).width * 2).toBe(1080);
});

it('says the size and pieces, the theme week while one is live, and the first name only when asked', () => {
  const base = { size: { n: 8, m: 8 }, pieces: 31, themeTitle: 'Cosy autumn', name: 'Maya Lee' };
  expect(shareLines({ ...base, showName: false })).toEqual({
    title: "KIP's room", meta: '8 × 8 · 31 pieces · Cosy autumn week', metaSpoken: '8 by 8, 31 pieces, Cosy autumn week', byline: null,
  });
  expect(shareLines({ ...base, showName: true }).byline).toBe("Maya's room");
  expect(shareLines({ ...base, themeTitle: null, showName: true, name: null }).meta).toBe('8 × 8 · 31 pieces');
  expect(shareLines({ ...base, themeTitle: null, showName: true, name: null }).byline).toBeNull();
  expect([firstNameOf('  Maya Lee '), firstNameOf(''), firstNameOf(null)]).toEqual(['Maya', null, null]);
});
```

Create `mobile/__tests__/screens/ShareRoomScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchIdentity } from '../../src/api/buddies';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { captureToPng, saveImage, shareImage } from '../../src/lib/recapCapture';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { ShareRoomScreen } from '../../src/screens/ShareRoomScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/lib/recapCapture', () => ({ captureToPng: jest.fn(async () => 'file:///card.png'), saveImage: jest.fn(async () => 'saved'), shareImage: jest.fn(async () => undefined) }));
jest.mock('../../src/api/buddies', () => ({ ...jest.requireActual('../../src/api/buddies'), fetchIdentity: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ tier: 2 }));
  (fetchIdentity as jest.Mock).mockResolvedValue({ handle: 'maya', displayName: 'Maya Lee', displayNamePrefill: '', moodNoticeSeen: true });
  await act(async () => { await loadCosmetics(); });
});

it('draws the saved room neutral, KIP waving, no name by default; nothing leaves the phone until a tap (spec §10.5)', async () => {
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  for (const id of ['share-preview', 'share-export']) {
    const room = screen.getByTestId(id);
    expect(room.props.living).toBeUndefined();
    expect(room.props.room).toMatch(/^wave:idle:none:lines:fallback:/);
  }
  expect(screen.getAllByText("KIP's room").length).toBeGreaterThan(0);
  expect(screen.getAllByText('8 × 8 · 7 pieces').length).toBeGreaterThan(0);
  expect(screen.queryByText("Maya's room")).toBeNull();
  expect(screen.getByText('The card shows the room only: no health numbers, no streaks.')).toBeTruthy();
  expect(screen.getByTestId('share-name').props.value).toBe(false);
  expect(screen.getByTestId('share-waves').props.value).toBe(true);
  expect(captureToPng).not.toHaveBeenCalled();
});

it('the switches change the card; Save and Share capture the 1080-px card', async () => {
  render(<ShareRoomScreen />);
  await act(async () => undefined);
  fireEvent(screen.getByTestId('share-name'), 'valueChange', true);
  fireEvent(screen.getByTestId('share-waves'), 'valueChange', false);
  expect(screen.getAllByText("Maya's room").length).toBeGreaterThan(0);
  expect(screen.getByTestId('share-export').props.room).toMatch(/^rest:/);
  await act(async () => { fireEvent.press(screen.getByTestId('share-save')); });
  expect(saveImage).toHaveBeenCalledWith('file:///card.png');
  await act(async () => { fireEvent.press(screen.getByTestId('share-share')); });
  expect(shareImage).toHaveBeenCalledWith('file:///card.png', 'Share your room');
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` add a test that `drawer-share` navigates to `'ShareRoom'`
(using the file's own render helper and navigation mock).

- [ ] **Step 2: Run them to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/shareCard.test.ts __tests__/screens/ShareRoomScreen.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `mobile/src/lib/recapCapture.ts` change `shareImage` to take the sheet's title (the recap keeps its own):

```ts
export async function shareImage(uri: string, dialogTitle = 'Share your recap'): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
}
```

and `captureToPng`'s file name prefix stays `recap-` (a cache file name is never shown). In
`mobile/src/lib/useRecapExport.ts` make the hook take `{ dialogTitle }: { dialogTitle?: string } = {}` and call
`shareImage(uri, dialogTitle)` (an undefined title keeps the default; the recap screens call it with no argument, so
they are unchanged).

Add to `ROOM_COPY`:

```ts
  /** The share card (spec 2026-10-15 §10.5, F8): the room only, drawn neutral; nothing posted. */
  share: {
    open: 'Share',
    heading: 'Share your room',
    note: 'Makes an image; nothing is posted',
    title: "KIP's room",
    meta: (s: { n: number; m: number }, pieces: number, theme: string | null) => `${s.n} × ${s.m} · ${pieces} pieces${theme ? ` · ${theme} week` : ''}`,
    metaSpoken: (s: { n: number; m: number }, pieces: number, theme: string | null) => `${s.n} by ${s.m}, ${pieces} pieces${theme ? `, ${theme} week` : ''}`,
    byline: (name: string) => `${name}'s room`,
    showName: 'Show my first name',
    waves: 'KIP waves',
    save: 'Save image',
    share: 'Share…',
    dialog: 'Share your room',
    footer: 'The card shows the room only: no health numbers, no streaks.',
    close: 'Close',
    label: "KIP's room, as the share card shows it",
  },
```

Create `mobile/src/lib/room/shareCard.ts`:

```ts
// The share card (spec 2026-10-15 §10.5; P4 ruling 23): 1080 px wide whatever the screen (the recap card's way), the
// size and pieces (never a level), the theme's week while one is live, and your first name only when you ask.
import { ROOM_COPY } from './roomCopy';

export const SHARE_PIXELS = 1080;
const ASPECT = 1.25;

export function shareSize(pixelRatio: number): { width: number; height: number } {
  const width = SHARE_PIXELS / pixelRatio;
  return { width, height: width * ASPECT };
}

export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = (displayName ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
}

export function shareLines(i: { size: { n: number; m: number }; pieces: number; themeTitle: string | null; name: string | null; showName: boolean }): { title: string; meta: string; metaSpoken: string; byline: string | null } {
  const S = ROOM_COPY.share;
  const first = i.showName ? firstNameOf(i.name) : null;
  return {
    title: S.title,
    meta: S.meta(i.size, i.pieces, i.themeTitle),
    metaSpoken: S.metaSpoken(i.size, i.pieces, i.themeTitle),
    byline: first ? S.byline(first) : null,
  };
}
```

Create `mobile/src/screens/ShareRoomScreen.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, PixelRatio, ScrollView, Switch, View, findNodeHandle, useWindowDimensions, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { fetchIdentity } from '../api/buddies';
import { NeutralRoom } from '../components/room/NeutralRoom';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { useMyKip } from '../lib/kip/myKip';
import { useMyRoom } from '../lib/room/cosmeticsStore';
import { tierSize } from '../lib/room/iso/geometry';
import { useRoomSocial } from '../lib/room/giftsStore';
import { ROOM_COPY } from '../lib/room/roomCopy';
import { shareLines, shareSize } from '../lib/room/shareCard';
import { EXPORT_NOTICES, useRecapExport } from '../lib/useRecapExport';

const S = ROOM_COPY.share;

function Card({ width, height, lines, children }: { width: number; height: number; lines: ReturnType<typeof shareLines>; children: React.ReactNode }) {
  return (
    <View style={{ width, height, backgroundColor: '#0A0B0E', padding: 16, gap: 8, borderRadius: 12 }}>
      <Text className="font-pixel text-page-title text-white">{lines.title}</Text>
      {children}
      <Text accessibilityLabel={lines.metaSpoken} className="text-caption tabular-nums text-white">{lines.meta}</Text>
      {lines.byline ? <Text className="text-caption text-white">{lines.byline}</Text> : null}
    </View>
  );
}

// The share card (spec 2026-10-15 §10.5, F8; P4 rulings 23, 24): your saved room drawn neutral (no living state, the
// fallback sky), "KIP's room", the size and pieces and the theme's week, your first name only when switched on, KIP
// waving unless switched off. The card is captured from an off-screen view 1080 px wide (lib/recapCapture.ts); nothing
// leaves the phone until Save image or Share…. Focus lands on the heading; the result line is a live region.
export function ShareRoomScreen() {
  const navigation = useNavigation<any>();
  const { layout, tier } = useMyRoom();
  const me = useMyKip();
  const social = useRoomSocial();
  const { width } = useWindowDimensions();
  const [name, setName] = useState<string | null>(null);
  const [showName, setShowName] = useState(false);
  const [waves, setWaves] = useState(true);
  const { exportRef, busy, notice, save, share } = useRecapExport({ dialogTitle: S.dialog });
  const headRef = useRef<RNText>(null);
  useEffect(() => {
    fetchIdentity().then((i) => setName(i.displayName)).catch(() => setName(null));
    const node = headRef.current ? findNodeHandle(headRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const themeId = social.challenge?.live ? social.challenge.themeId : null;
  const lines = shareLines({ size: tierSize(tier), pieces: layout.pieces.length, themeTitle: themeId ? ROOM_COPY.challenge.themes[themeId].title : null, name, showName });
  const room = (w: number, h: number, testID: string) => (
    <NeutralRoom testID={testID} layout={layout} tier={tier} colour={me.colour} worn={me.worn} pose={waves ? 'wave' : 'rest'} bubble={null} width={w} height={h} label={S.label} />
  );
  const out = shareSize(PixelRatio.get());
  const preview = Math.min(width - 32, 360);
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Button testID="share-close" variant="ghost" className="h-[44px] self-start" onPress={() => navigation.goBack()}>{S.close}</Button>
        <Text ref={headRef} accessibilityRole="header" className="text-heading">{S.heading}</Text>
        <Text className="text-caption text-muted-foreground">{S.note}</Text>
        <Card width={preview} height={preview * 1.25} lines={lines}>{room(preview - 32, preview * 1.25 - 120, 'share-preview')}</Card>
        <View className="flex-row items-center justify-between">
          <Text className="text-body">{S.showName}</Text>
          <Switch testID="share-name" accessibilityLabel={S.showName} value={showName} onValueChange={setShowName} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-body">{S.waves}</Text>
          <Switch testID="share-waves" accessibilityLabel={S.waves} value={waves} onValueChange={setWaves} />
        </View>
        <Button testID="share-save" className="h-[44px]" disabled={busy} onPress={() => void save()}>{S.save}</Button>
        <Button testID="share-share" variant="outline" className="h-[44px]" disabled={busy} onPress={() => void share()}>{S.share}</Button>
        <Text testID="share-notice" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{notice ? EXPORT_NOTICES[notice] : ''}</Text>
        <Text className="text-caption text-muted-foreground">{S.footer}</Text>
      </ScrollView>
      {/* The export view: off-screen, 1080 px wide, the only thing captured (the recap card's pattern). */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <View ref={exportRef} collapsable={false}>
          <Card width={out.width} height={out.height} lines={lines}>{room(out.width - 32, out.height - 120, 'share-export')}</Card>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

In `mobile/src/components/edit/InventoryDrawer.tsx` add the prop `onOpenShare?: () => void` and, before the shop
button, `{onOpenShare ? <Button testID="drawer-share" variant="outline" size="sm" className={TARGET} onPress={onOpenShare}>{ROOM_COPY.share.open}</Button> : null}`.
In `mobile/src/screens/DecorateRoomScreen.tsx` pass `onOpenShare={() => navigation.navigate('ShareRoom')}`. In
`RootNavigator.tsx` add `ShareRoom: undefined;` and
`<Stack.Screen name="ShareRoom" component={ShareRoomScreen} options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />`,
and add `'ShareRoom'` to `MODAL_ROUTES`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/shareCard.test.ts __tests__/screens/ShareRoomScreen.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/screens/RecapBuilderScreen.test.tsx __tests__/screens/RecapStoryScreen.test.tsx __tests__/conventions`
Expected: PASS (the recap screens share unchanged, with their own title). Then the full mobile suite and the
typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/recapCapture.ts mobile/src/lib/useRecapExport.ts mobile/src/lib/room/shareCard.ts mobile/src/lib/room/roomCopy.ts mobile/src/screens/ShareRoomScreen.tsx mobile/src/components/edit/InventoryDrawer.tsx mobile/src/screens/DecorateRoomScreen.tsx mobile/src/navigation mobile/__tests__
git commit -m "feat(room): a share card of your room, drawn neutral, saved or shared only on a tap"
```

---

### Task 13: Whole-branch verification, the final review, the run-folder sync and the simulator check (controller)

- [ ] **Step 1: Suites, typechecks and guards**
  - Full backend suite with `backend-jest.sh` (no path), then backend `tsc --noEmit -p .`. Expected: green, 0.
  - `schema-drift.sh`. Expected: `no drift` (the migration matches the schema).
  - Full mobile suite and the mobile typecheck. Expected: green, 10 (or the count recorded in the ledger).
  - `__tests__/conventions` alone: `buttons`, `typography`, `kipCopy`, `noCharacters`, `kipWorn`, `earnOnly` and
    `noRoomInCoach` pass; the buttons guard has no new entry.
  - `node scripts/room-art-size.mjs` (under 300 KB) and `ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf`;
    record both in the ledger.
  - From `backend/`, run `scripts/export-cosmetics.ts` and confirm `git status` shows no change to
    `mobile/src/lib/room/catalogue.json` or `mobile/src/lib/room/iso/geometry.ts`.
  - `git diff 3e6e6c5 -- mobile/src/components/social/CampScene.tsx mobile/src/components/social/CampBanner.tsx` is
    empty (OVERRIDE-P13), and `grep -rn "BuddyRoom\|room/visit" mobile/src/components/social mobile/src/screens/CampfireScreen.tsx`
    prints nothing (no visit entry on the Campfire).
  - Log lines: `git diff 3e6e6c5 -- backend/src | grep -E "^\+.*console\.(info|log|warn|error)"` shows only
    `gift.sent`, `challenge.entered`, `challenge.judge_failed` (error class only) and the moved `coins.earned` /
    `coins.earn_failed` lines, none with a `userId`, an item, a layout, an amount or a count beside an id.
  - `grep -rnE "from ['\"][^'\"]*/(coins|cosmetics|room|challenges)/" backend/src/coach` prints nothing.
  - `grep -rnE "living|plantStage|petEnergy|awards" backend/src/room/visit.ts backend/src/challenges backend/src/room/gifts.ts`
    prints nothing.
- [ ] **Step 2: The final review:** run the whole-branch review on opus with
  `review-package docs/superpowers/plans/2026-10-15-kip-freebuild-p4.md 3e6e6c5 HEAD`, then one fix wave. The
  reviewer checks, row by row:
  - §10.1 against `buddies/sharing.ts`, `room/visit.ts`, the Profile switch and `BuddyRoom` (off by default; its own
    consent; no health consent; survives a version bump; `shares` omits it; the uniform 404; size only, never a tier;
    neutral drawing; nothing selectable; the pieces you don't have never say "they earned");
  - §10.2 against `cheerRoom` and the ledger (one a day per visitor; both paid; 5 paid a day across given and received;
    0-coin rows past it; both locks in id order; the owner's sheet with names);
  - §10.3 against `room/gifts.ts`, `relations.ts` and the app (spares only; picked notes; 3 a day; buddies only, blocks
    both ways; returns on block and unpair only; the deleted-sender and deleted-recipient rulings; the shared lock and
    the raw-layout re-check; a muted sender's gift without a notice; the boxes not placements);
  - §10.4 against `challenges/*`, the save hook, the drawer and `RoomChallenge` (the calendar; each entrant's own close;
    entering as the opt-in; the snapshot on every save while open; +30 once; entry cheers before the entrant's close,
    never your own; results from Monday 08:00 UTC in the frozen circle, ≥ 3 entries, ties; the trophy once; buddies only);
  - §10.5 against `ShareRoom` (neutral; size not level; first name off by default; KIP waves on; 1080 px; nothing
    leaves the phone before a tap);
  - §12's P4 rows and §13's P4 rows (the cheer scan's paging; release 6's date), §11.2's cheer row, `USER_OWNED_MODELS`
    and the social-model lists, the privacy rules (logs, health, the coach), the frozen Campfire, the Button and type
    rules, the five Review Focus lines and every ruling of this plan and the P1–P3 ledgers.
- [ ] **Step 3: Sync to the run folder** (`~/dev/biometrics-run`, outside iCloud):
  1. Back up the dev DB with `bash .superpowers/sdd/2026-10-15-kip-freebuild-p4/backup-db.sh` (`pg_dump -Fc`, only when
     `DATABASE_URL` is local; never print the URL); the dump is `biometrics-before-kip-freebuild-p4-2026-10-15.dump`.
     Confirm its byte count is non-zero.
  2. `bash .superpowers/sdd/2026-10-15-kip-freebuild-p4/sync-run.sh`: rsyncs `backend/`, runs `npm install` and
     `npx prisma generate`, the conversion script (`converted: 0`), `npx prisma migrate deploy` (expected: applies
     `20261018120000_social_rooms`), `npm run build`; then syncs `mobile/` (excluding `node_modules`, `ios`, `android`
     and every `.env*`) and runs `npm install`.
  3. **No native rebuild**: P4 adds no native module (ruling 26), so the installed dev client is reused; `ios-build.sh`
     is not run.
  4. Restart the API on :3000 with the dev coins launch and the dev challenge clock:
     `bash .superpowers/sdd/2026-10-15-kip-freebuild-p4/start-backend-coins.sh` (`COINS_LAUNCHED_AT=2026-10-01T00:00:00.000Z`
     and `CHALLENGE_NOW=2026-10-28T12:00:00.000Z`, a Wednesday of 2026-W44, Cosy autumn, Task 0). Expected: the
     health check answers.
  5. Restart Metro on localhost: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p4/metro-local.sh`.
  6. For two fresh test accounts only (never the owner's own data), seed with a scratch script kept in the workspace
     and never committed, `.superpowers/sdd/2026-10-15-kip-freebuild-p4/seed-social.ts`, run from
     `~/dev/biometrics-run/backend` with ts-node: it looks both accounts up by email; pairs them (`createPair`); turns
     `shareRoom` on for one; and grants one a second `plant.fern` and two `corner.pumpkin` with `ItemGrant` rows
     (`sourceKey` `dev:seed:<item>`). It prints counts only. Nothing of this is committed.
- [ ] **Step 4: Simulator check, with screenshots** (`xcrun simctl io booted screenshot <file>` into
  `.superpowers/sdd/2026-10-15-kip-freebuild-p4/shots/`). With the two seeded accounts:
  - **Profile:** the "Your room" switch is off; turning it on shows "Buddies see your room, including its size." with
    Turn on and Not now; the Buddies card reads "· room open".
  - **A visit:** from the buddy's week, Visit room; "{name}'s room", "8 × 8 · n pieces", their KIP waving with "HI
    THERE!", the fallback sky, full-grown plants, the cat wandering, an empty trophy shelf; pan; nothing selects;
    Cheer: "Cheered! +2 coins", then "Cheered today"; the pieces you don't have and their lines. From a chat thread,
    the avatar opens the same room. A buddy with the switch off: "This room isn't open for visits."
  - **Gifts:** Send a gift: the spares, a note, Send gift; on the other phone the box on the front row of the KIP page's
    room, its line, open it: the piece is NEW in the drawer. Mute the sender and send another: the box, no line.
  - **The challenge:** the KIP page's Room challenge; the brief, the rewards, the consent line, Start my entry; the
    editor's Autumn tab with "Warm pieces · 2 of 3"; place a pumpkin, Done: +30 lands; the other account sees the entry
    and cheers it.
  - **The share card:** from the editor's drawer, Share; the switches; Save image (Photos permission), Share….
  - VoiceOver: the room switch's sheet, the visit's title focus, the gift boxes' labels, the challenge's checklist read
    without "·"; the largest text size on the visit and the challenge.
- [ ] **Step 5: Report to the owner** with the screenshots and the OWNER NOTES (ruling 1: release 6's date; ruling 4:
  the first challenge week and the rotation; ruling 2: the theme pieces' price 80 and the trophies' names; ruling 14:
  the gift boxes as an overlay; ruling 26: no native rebuild). Push the branch
  (`git push -u origin feature/kip-freebuild-p4`; never main, never force). Open a draft PR (base
  `feature/kip-freebuild-p3`) only when the owner asks, with no attribution footer.

---

## Self-review (2026-10-16, against the spec and the real code on `feature/kip-freebuild-p4` at 3e6e6c5)

**Spec coverage, P4 only:**

| Spec | Task |
| --- | --- |
| §0 controller rulings: opt-in visits with their own line; entering as the snapshot opt-in; gifts and deleted accounts; judging; cheer 2, entry 30, cap 60 | Global Constraints; 1, 2, 5, 6, 7, 8 |
| §2.1 `tags` for briefs; release 6 challenge pieces | 4 |
| §2.2 `ItemGrant` gift and prize keys; a count never below 1 except by your own gift; the save/gift race under one lock | 6, 7 |
| §4 P4's art batch (the challenge pieces and trophies) | 4 |
| §6.2 the cheer row (5 paid a day, given and received, each person's own day) and the entry row (uncapped, once a week) | 3, 5, 7 |
| §6.3 two-person events: both locks in sorted id order | 3 |
| §6.4 the week's theme piece, 80, that week only | 4 |
| §6.5 a rule piece never sold before it is earned (P2 note) | 3 |
| §10.1 visits: who, the switch and its consent, `HEALTH_SHARE_KEYS`, `shares` without `room`, "· room open", entry points, the view, what a buddy sees, neutral states, pieces you don't have | 2, 5, 8, 9 |
| §10.2 room cheers: once a day, both paid, the owner's sheet, separate from `buddy_cheers` | 3, 5, 9, 10 |
| §10.3 gifts: spares, notes, limits, blocks, returns, deleted accounts, the sender's lock, the box, NEW | 1, 6, 10 |
| §10.4 challenges: the calendar, the week and close, the brief, the opt-in, the snapshot, +30 once, the theme tab and checklist, entry cheers, results, the trophy, buddies only | 4, 7, 11 |
| §10.5 the share card | 12 |
| §11.2 the first-week cheer row ticks from P4 | 5 (pinned) |
| §12 P4 rows, every one; body caps; `gift.sent`, `challenge.entered`; account deletion; nothing cosmetic to the model | 5, 6, 7, 1, 13 |
| §13 P4 rows: the cheer scan's 90-row bound; OVERRIDE-P13 (no Campfire entry); FINAL-REQ (requests carry no room data) | 3, 9, 13 |
| §16 P4 tests (visits, cheers, gifts, challenges; the app's neutral visit and share card) | each task's Step 1 |
| P2 notes: forSale; expand over-count; the cheer row; P3 note: expand rewrites the sanitised layout | 3, 6, 5 |

**Where the spec cannot be followed literally, and the ruling taken:**
1. **"`challenges/themes.ts`, a list of weeks, each `{ weekId, title, brief, … }`"** (§10.4) against the owner's rule
   that all copy lives in `ROOM_COPY`: the server's calendar carries each theme's id, rule, piece and trophy; titles and
   briefs are the app's (ruling 4). The four themes rotate from 2026-W44 instead of ending after four weeks.
2. **"The first four themes"** need pieces: four theme pieces and four trophies are new release-6 pieces with a new
   `prize` unlock (rulings 1–2); C3's leaf pile is not made (the pumpkin and the candle already cover "warm").
3. **"`shop?: … | { week: string }`"** can't sell a rotating theme piece in each of its weeks: a third variant,
   `'theme'`, follows the calendar (ruling 4).
4. **"`tags: string[]` … `'warm', 'plant', 'glow'`"** typed per piece would drift: tags are derived from a warm list,
   the slot and the glow flag (ruling 3).
5. **"Circle frozen at your close"** with no job at each entrant's Sunday 20:00: the circle is rewritten while the entry
   is open and the last write stands (ruling 6).
6. **"Results computed on the first read after Monday 08:00 UTC"**: judging is lazy per entry, on the challenge read and
   the room read, once (`judgedAt`, ruling 6).
7. **Sunday 20:00 local** has no helper: four hours before the next Monday's local midnight (ruling 5).
8. **"`GET /me/buddies/:buddyId/room` → { layout, size, kipColour, kipWorn, … }"** has no name for "{first name}'s
   room": the body adds `name`; the week DTO adds `roomOpen` so Visit shows only when it opens (ruling 8).
9. **"A gift box on their floor (a virtual piece on a free front tile, not a placement)"**: drawn as an overlay of
   buttons on the room card, so it is never in the room picture or the layout (ruling 14).
10. **"A muted sender's gift arrives without a notice"** with no gift push (§17): no line on the KIP page (ruling 13).
11. **"`POST /me/buddies/:buddyId/gifts` `{ requestId, … }` → 201"** has no replay rule: the gift's id is the request id
    (ruling 11).
12. **"Share your room from the editor's menu"**: the editor has no menu; Share sits in the drawer's header beside the
    coin shop and Room sizes (ruling 23). The card shows the saved room, not an unsaved draft.
13. **"Where from: … their KIP in Chats"**: the chat thread's avatar is their KIP and becomes the button (ruling 21).
14. **"`room` … a sixth key in `SHARE_KEYS`"** alongside a consent that "does not need the health-sharing consent":
    `effectiveSharing` passes `room` through as stored and `updateSharing` asks consent only for a health key (Task 2).
15. **"The owner sees who cheered"** with `cheersThisWeek` keyed on the visitor's day: the week is the owner's local ISO
    week over the visitor-dated rows (ruling 8).
16. **"Pieces you don't have … the catalogue's generic rule ("Steady bedtime · II")"** read aloud: the spoken form is
    `unlockSpoken` ("…, level 2"), never "·" or a Roman numeral (Task 9).
17. **"Use 3 or more warm pieces"** (C3) against P3's advice guard ("more"): the brief counts pieces, not health; the
    P4 guard looks for health verbs and health words instead (Global Constraints, Task 11).

**Placeholder scan:** no "TBD" / "TODO" / "similar to". Every module, route, screen, store, copy string and test is
written out; where a task edits a file it keeps, the exact lines that change are named. Three edits are named by the
file's own existing helper (the expand test's gate setup, the KIP page and BuddyWeek render helpers, the drawer test
file), because those helpers already exist and the new tests sit beside the old ones.

**Type consistency:** these names are used identically across tasks:
- backend: `shareRoom`, `HEALTH_SHARE_KEYS`, `SHARE_KEYS`, `roomOpen`, `BuddyWeekDTO.roomOpen`; `lockUsers`,
  `writeEarnsTx`, `cheerEarns`, `logEarned`, `loadCheerTimes`, `forSale(itemId, week, earned)`; `CosmeticRelease`,
  `ShippedRelease`, `{ kind: 'prize' }`, `shop: 'theme'`, `CHALLENGE_TAGS`, `ChallengeTag`, `tagsOf`, `THEME_PIECES`,
  `TROPHIES`, `weekNumber`, `ThemeId`, `Theme`, `THEMES`, `CHALLENGES_START_WEEK`, `themeFor`, `briefCount`,
  `meetsBrief`; `RoomVisitDTO`, `visitTarget`, `canVisit`, `readOwnedLayout`, `weekDays`, `readVisit`, `cheerRoom`,
  `listRoomCheers`, `socialRoomRouter`, `SOCIAL_ROOM_POSTS`; `GIFT_NOTES`, `GiftNote`, `GIFTS_PER_DAY`, `parseGift`,
  `sendGift`, `GiftDTO`, `listGifts`, `openGift`, `returnGiftsTx`; `challengeClock`, `weekOf`, `mondayOf`, `closesAt`,
  `resultsAt`, `previousWeek`, `Snapshot`, `EntryDTO`, `ChallengeDTO`, `enterChallenge`, `readChallenge`, `cheerEntry`,
  `snapshotOnSaveTx`, `payEntryIfMet`, `judgeCircle`, `settleChallenges`, `settleChallengesSafely`, `ResultsDTO`,
  `readResults`; error codes `already_cheered`, `not_spare`, `gift_limit`, `gift_gone`, `challenge_closed`,
  `no_challenge`, `invalid_body`;
- mobile: `HealthShareKey`, `HEALTH_SHARE_KEYS`, `SHARE_KEYS`, `SharingSettings.room`, `BuddyWeek.roomOpen`;
  `api/rooms.ts`'s `fetchBuddyRoom`, `cheerBuddyRoom`, `fetchRoomCheers`, `GIFT_NOTES`, `sendGift`, `fetchGifts`,
  `openGift`, `fetchChallenge`, `enterChallenge`, `cheerEntry` and their DTOs; `ROOM_SWITCH`, `RoomVisitConsentSheet`;
  `RoomVisit`, `readVisit`, `tierOfSize`, `MAX_MISSING`, `missingPieces`, `pieceInfo`, `visitLight`, `panTo`,
  `NeutralRoom`; `Spare`, `spareTiles`, `MAX_BOXES`, `giftTiles`, `giftPoint`, `RoomSocial`, `loadRoomSocial`,
  `openGiftNow`, `useRoomSocial`, `resetRoomSocial`, `applyGrant`, `applyCounts`, `RoomGiftBoxes`; `briefCount`,
  `checklist`, `daysLeft`, `entryRoom`, `EditorTheme`, `EditorState.theme`, `DrawerTab 'theme'`, `drawerTabLabel`,
  `themeChecklist`; `SHARE_PIXELS`, `shareSize`, `firstNameOf`, `shareLines`; routes `BuddyRoom`, `GiftSend`,
  `RoomCheers`, `RoomChallenge`, `ShareRoom`; copy `ROOM_COPY.visit`, `.gifts`, `.challenge`, `.share`.

**Review Focus:** each of the five lines has its pinning test in the owning task (1: Tasks 3 and 5; 2: Task 6;
3: Task 7; 4: Tasks 1 and 6; 5: Tasks 5 and 6). Visits, gifts and the challenge are also checked by hand in Task 13.

**Deferred minors not folded in** (P4 does not touch their code): P2 Task 13's one-frame old pan and other-device
additions lost on rebase; P2 Task 11's offline wallet skeleton; P1 Task 2's `seatTile` reflecting on facing R; P1
Task 9's desk Another/Replace desk refusals; P1 final review M5 (plank spots on Flip, parked).
