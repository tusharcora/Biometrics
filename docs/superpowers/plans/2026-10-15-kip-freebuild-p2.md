# KIP Free-build P2 (coins, shop and expansion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KIP's room gets an economy that is earned only: KIP coins land from healthy days (sleep goal, step goal,
on-time check-in, the weekly recap) under a 60-a-day cap, a coin shop sells new pieces and extra copies, the room grows
from 7 × 7 to 8 × 8 and 9 × 9 behind two gates (coins and a badge level), and a first-week list welcomes everyone. This
plan ships **P2** of the free-build spec: the ledger, its sources and cap (§6), `ItemGrant` and purchases, the shop and
its six release-4 pieces, the wallet, coin history, coins landing on the KIP page, room sizes and the unlock moment
(§7), the first-week list (§11.2), the P2 rows of §12 and §13, and dropping Spec B's slot `room` column. Effects, the
living room and KIP walking (P3) and social (P4) are out.

**Architecture:**
- **Backend** (Tasks 1–8):
  - Task 1 drops `CosmeticLoadout.room` behind a guard migration; the conversion script reads and writes with raw SQL,
    so it runs before `prisma migrate deploy` and is a no-op once the column is gone;
  - `backend/src/cosmetics/catalogue.ts` gains `price`, `shop`, the `shop` unlock kind and release 4 (six shop
    pieces); the export carries prices and the tier gates to the app;
  - `backend/src/coins/` holds the ledger (`ledger.ts`: one locked transaction writes every coin, filter-then-trim to
    the daily cap, append-only), the sources (`sources.ts`: `earnCoins`, the hooks' entry point), the history and the
    routes, the shop (`shop.ts`, `shopWeeks.ts`) and the first-week list (`firstWeek.ts`);
  - `backend/src/room/expand.ts` grows the room under the same per-user lock, storing any wall piece the loft's window
    covers; `ItemGrant` counts join `countsOf`.
- **Mobile** (Tasks 2, 9–14): the six pieces' art; `api/coins.ts`, `lib/coins/coinsStore.ts` (Spec B's epoch and
  session guards) and `lib/coins/actions.ts` (purchase and grow, which update both stores); the wallet chip, the
  `CoinHistory`, `CoinShop` and `RoomSizes` routes, coins landing on the room card, the first-week card, the editor's
  rebase when the room grows, and the P1 carry (the editor's pan follows tier and size changes).
- **Verification** (Task 15): full suites, final review, DB backup, run-folder sync (conversion script, then
  `prisma migrate deploy`), the simulator check.

**Tech Stack:**
- Backend: Express 5, Prisma 6 / Postgres, Jest with supertest, ts-node for scripts.
- Mobile: Expo 57 / React Native 0.86 with NativeWind, React Navigation 7 (native stack), Reanimated 4,
  `react-native-gesture-handler` 2.32, `@shopify/react-native-skia` 2.6.2, `react-native-svg`, `expo-crypto` (already a
  dependency, for request ids). Nothing new is installed. Jest 30 with React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-kip-freebuild-design.md` (binding; this plan implements its **P2** row of
§14: §6, §7, §11.2, the P2 rows of §12 and §13, the P2 parts of §2.2 (`ItemGrant`), §2.4 (dropping `room`), §4 (the
P2 art batch), §5.2 (the wallet chip), §5.3 (See room sizes), §5.4 (Coin shop, the coins line), §11.1 (the welcome's
coins line) and §16's P2 tests).
- Built base: P1 on `feature/kip-freebuild` 7fccf46 (draft PR #67), which sits on Specs A and B
  (`feature/kip-room`). This plan builds against that real code; where the spec and the code differ, a ruling below
  says which way.
- Binding ledger: `.superpowers/sdd/2026-10-15-kip-freebuild-p1/progress.md`. Every `Ruling:` line there binds P2 too
  (Task 0 copies them into P2's ledger).
- Visual sources in `docs/design/freebuild/project/`: `F6.dc.html` (shop, coin history), `C1.dc.html` (coins land,
  the shop, the piece sheet), `C2.dc.html` and `F5.dc.html` (room sizes, the unlock moment), `C7.dc.html` (first-week
  list), `C8.dc.html` (the economy map). Sprites: `docs/design/freebuild/gen/front.py` `SPR`.
- Out of this plan: effects and effect slots, `living`, piece cards, the radio's sound, KIP walking (P3); visits,
  cheers, gifts, challenges, the share card (P4). The seams P2 leaves: cheer kinds and the 5-paid-a-day rule in the
  ledger, the `challenge` kind, `shop: { week }` pieces, `ItemGrant` source keys for gifts and prizes.

## Global Constraints

- **Branch:** `feature/kip-freebuild-p2`, in the worktree
  `/Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab`, cut from P1's head 7fccf46; this plan's
  commit sits on top.
  - Never `cd` to another repo root, never switch branches, never push to main, never force-push, never bare
    `git stash`.
- **Commits:** plain conventional messages with `git commit -m "…"`: **no `Co-Authored-By` trailer and no mention of
  Claude, Cursor or AI** (owner rule; it applies to every subagent). A PR body carries no attribution footer either.
- **Subagents** run on model **opus**.
- **Every task keeps both full suites green at its commit.** Run the touched tests while working. Before the commit,
  run the full mobile suite, both typechecks and, for a task that touches `backend/`, the full backend suite. Tasks 2
  and 7 regenerate `mobile/src/lib/room/catalogue.json`, so they run the full mobile suite too.
- **Mobile commands**, from `mobile/`:
  - `export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH`
  - Tests: `node node_modules/.bin/jest --forceExit <paths>`. With no paths it runs the full suite.
  - Typecheck: `node node_modules/.bin/tsc --noEmit --types jest,node --pretty false | grep -c "error TS"`. The
    baseline is **10** (P1 ledger, Task 16); Task 0 measures it again on 7fccf46. No task may add an error.
- **Backend commands**, from `backend/`. Never run two backend test runs at once, never point tests at the dev
  `biometrics` DB, and never print a database URL.
  - Tests go only through `.superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh <paths>` (Task 0 copies it).
  - A suite that fails or SIGSEGVs under full-suite load is rerun alone before it is treated as real.
  - Typecheck: `node node_modules/.bin/tsc --noEmit -p .` must report **0** errors. After a schema or migration
    change, run `DATABASE_URL=postgresql://x@localhost/x npx prisma generate` first.
  - Scripts run with `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/<name>.ts`.
- **Owner-accepted defaults (spec §0), verbatim:**
  - Coin amounts: sleep 20, steps 15, check-in 5, recap 10, cheer 2, challenge entry 30, with a cap of 60 per day.
  - Pieces cost 25–200 coins.
  - The 8×8 room costs 600 coins and the loft costs 1,500.
  - First-week bonuses are +10 and +25, both outside the daily cap.
  - Earn-only: nothing is ever sold for real money, there are no ads and no shipping timers. Coins never come from
    money.
- **Buttons:** use shadcn-style `<Button>` only (`mobile/src/components/ui/button.tsx`): `rounded-lg`, never pills, at
  least 44 pt. Chips, tags, tabs and the wallet are `Button`s or `rounded-lg` views. This plan adds **no** raw
  `Pressable` with a button role, so `__tests__/conventions/buttons.test.ts` gets no new entry.
- **Type:** A4 type tokens only (`text-score`, `text-number`, `text-display`, `text-heading`, `text-headline`,
  `text-body`, `text-caption`, `text-fine`, `text-page-title`, `text-label`). Pixel labels use `font-pixel text-label`.
  No inline `fontSize` / `fontFamily`, no arbitrary `text-[..px]`.
- **Copy:**
  - All copy goes in `ROOM_COPY` (`mobile/src/lib/room/roomCopy.ts`), coins and shop strings included (ruling 10).
  - Spoken labels contain no "·" (U+00B7), no "−" (U+2212) and no Roman numerals.
  - The product name is **KIP** in capitals; `__tests__/conventions/kipCopy.test.ts` stays green.
  - No currency symbol, no price in money, no "get more coins", "buy coins" or ad copy anywhere (Task 14's guard).
  - Room and coin copy never gives health advice and never shows a health value (no minutes, no steps).
- **Privacy and logging (spec §0, §12):**
  - Logs carry event names and counts only: never a user id together with item ids, coin balances, amounts, layouts
    or counts. The lines are `coins.earned { kind, count }`, `coins.spent { kind }`, `room.expanded { tier }`,
    `room.saved { pieces, tier }`, `room.converted { converted, skipped }` and the `*_failed { error }` lines (error
    class only).
  - Health values never appear in logs or in the ledger: a coin event is a kind, a key, an amount and a civil date.
  - Nothing cosmetic or coin-related reaches the coach or the model: `tests/room/noCoachImport.test.ts` already fails
    on any `src/coach/` import of `cosmetics/`, `room/`, `coins/` or `challenges/`.
  - Nobody sees anyone else's balance; no coin or room data is added to any buddy DTO.
- **Coins:**
  - Coin grants are idempotent per source event: every `CoinEvent` and `ItemGrant` has a unique `(userId, sourceKey)`,
    so retries, hooks racing each other and catch-ups never double-pay. Purchases and expansions are keyed by the app's
    `requestId`; a repeated `requestId` returns the first answer.
  - The ledger is append-only: nothing updates an amount or deletes a `CoinEvent` or `ItemGrant` row outside account
    deletion and the fixture purge (Task 3's guard). Only `seenAt` and the wallet's running balance change.
  - The balance can never go negative (a `CHECK` constraint plus the locked balance check).
- **Account deletion:** every new user-owned model (`CoinEvent`, `CoinWallet`, `ItemGrant`) goes into
  `USER_OWNED_MODELS` (`backend/src/users/deletion.ts`) and into `tests/users/ownedData.ts`, in the task that adds it.
- **Dates:** civil dates only through the existing helpers (`localCivilDateOrUtc`, `todayFor`, `habitDayForOrUtc`,
  `civilDateToUtcMidnight`, `shiftDate`, `isoWeekKey`); never `new Date('YYYY-MM-DD')` in the app. Backend constants
  use a full ISO instant with `Z`.
- **Frozen files:** `mobile/src/components/social/CampScene.tsx` and `CampBanner.tsx` stay frozen
  (OVERRIDE-P13). Task 15 checks `git diff 7fccf46 -- <both>` is empty.
- **Shared test fixtures** live in `mobile/jest-mocks/` and `backend/tests/**/helpers.ts`, never as `__tests__` files.
- **Skia in Jest:** `@shopify/react-native-skia` is mocked by `mobile/jest-mocks/skia.js`; `RoomView` has the stand-in
  `jest-mocks/RoomView.js`. No test loads the real Skia module.

## Plan rulings (made while writing the plan)

1. **Release 4 and the launch instant.** `SHIPPED_RELEASES = {1, 3, 4}`. The six shop pieces are `release: 4`.
   `RELEASE_LAUNCHED_AT[4]` and the coins launch (`coinsConfig.launchedAt`) are both `2026-10-20T00:00:00.000Z`.
   OWNER NOTE: both are set to the real ship date at merge, as P1's release dates are (P1 ruling 1). A dev server may
   move the coins launch with the `COINS_LAUNCHED_AT` environment variable (an ISO instant), so the simulator check
   can earn before the real date; production leaves it unset.
2. **The shop's own pieces** are `item.radio` (desk item, 150), `corner.gnome` (80), `corner.cone` (60),
   `corner.pumpkin` (30), `item.candle` (25, its flame glows) and `art.neonheart` (200, a glowing wall sign). They carry
   a new unlock kind `{ kind: 'shop' }` (catalogue code `C`): never granted by a rule, only bought. The spec's
   `art.neonheart` is a new id distinct from Spec B's `art.heart` (which is already named "Neon heart" and has a rule),
   so it is named "Neon heart sign" and drawn as a sign on a backboard.
3. **Which existing pieces are sold** (spec §6.5): every placeable starter piece as an extra copy (fern 40, cactus 40,
   mug 25, sticky notes 25, books 30, mini cactus 30, wall plank 30, amber desk lamp 60, slate rug 80, wall calendar 40)
   except the desks (a room has one desk) and the welcome lantern (C7's free gift); and the rule pieces the boards
   price: floor lamp 120, pet bed 140 (C1's "Cat bed"), monstera 140 and snake plant 100. B2's lava lamp (120), duck
   (40) and cat (180) are priced now and appear when release 2 ships. A rule piece is never sold before it is earned;
   trying answers `400 not_for_sale`, the one refusal-to-sell code §12 lists.
4. **Every P2 price is `shop: 'always'`.** The weekly set (`shopWeeks.ts`) is a featured bundle of always-on pieces
   that rotates every Monday over four sets by the user's local ISO week; it has no bundle price (each piece is bought
   on its own), and the card reads "this week", not "this week only", because the pieces stay in the shop. The
   `shop: { week }` filter is built and tested now; P4's theme pieces are the first to use it.
5. **One lock per user.** Coin writes, purchases and expansion take P1's `lockRoom` (the room's advisory lock), so an
   earn, a purchase, a grow and a room save never interleave, and no two locks can deadlock.
6. **Spends and 0-coin rows are written already seen.** Only a positive earn ever "lands" on the KIP page.
7. **`ItemGrant` gains `seenAt`.** A bought copy is "new" until seen: GET `/me/cosmetics` lists unseen grants in
   `fresh` with source `'buy'`, and `POST /me/cosmetics/seen` marks them. The room toasts already ignore `'buy'`
   (`announce.ts` toasts only `counter:` and `set:` sources).
8. **History, shop and sizes are routes**, not RN `Modal` sheets: `CoinHistory` (`presentation: 'modal'`, the
   native sheet), `CoinShop` and `RoomSizes` (`fullScreenModal`). An RN `Modal` presented over a native modal route is
   dropped on iOS (`navigationRef.ts`), and these open from the editor. The shop's piece sheet is a panel inside the
   shop screen.
9. **The wallet chip is a `<Button variant="outline" size="sm">`** (owner's Button-only rule) with the spec's label
   "{n} KIP coins. Open coin history", not a raw `Pressable` (spec §6.7): no conventions entry is added.
10. **All copy goes in `ROOM_COPY`** (owner rule) under `coins`, `shop`, `sizes` and `firstWeek`, not a new
    `coinCopy.ts` (spec §15).
11. **The "nothing is sold" copy guard changes:** P1's `roomCopy.test` forbids "coin", "buy" and "price" anywhere in
    `ROOM_COPY`. P2's guard forbids currency symbols, currency codes and real-money phrases instead (Task 10, and
    Task 14's earn-only test).
12. **Coins land in KIP's speech bubble** ("+20!") for 4 seconds, with a line under the room ("Sleep goal hit" or
    "Sleep goal hit and 2 more"). The bubble is the room's own, which never floats, so it is the same under Reduce
    Motion. Several unseen earns land once, as their total, and are all marked seen.
13. **P2's shop tabs are All, Floor, Wall and On top.** The Effects tab, "does something in the room" and a piece's
    effect line arrive with P3's `effect` field.
14. **Room sizes rows show pieces, not effect slots**, until P3 gives effect slots meaning.
15. **The locked-row overlay** (spec §11.2's dashed next-tier rows) is drawn on the Room sizes screen's preview of your
    room at the next size, not on the KIP page, whose crop centres on the desk and rarely reaches the front rows.
16. **The unlock moment's "NEW FLOOR" / "NEW WALL"** are pixel tags in a row under the grown room, not pinned to tiles;
    "MORE ROOM!" is KIP's speech bubble over the cheer pose.
17. **`POST /me/room/expand` also answers `stored`**, the number of wall pieces (with what stood on them) the new window
    sent to the inventory, for the unlock card's line. A replay answers `stored: 0`.
18. **Expansion evaluates the gate's badge family first** (`evaluateAchievements(userId, now, [family])`), so a level
    reached since the last badge load counts.
19. **The editor rebases when the room grows** (spec §7): a `rebased` action keeps the draft's own changes, drops the
    pieces the server stored and any draft wall piece the new window covers (with their children), takes the new tier,
    version and counts, and clears undo and redo.
20. **P2-CARRY (P1 ledger):** the editor's pan re-centres on the desk whenever the tier, the width or the height
    changes (a refresh, a grow, a rotation or split view).
21. **First week's day 1** (`RoomFirstWeek.startedOn`) is the user's local date of sign-up when they signed up at or
    after the coins launch, else their local date at the first earn or first-week read after it.
22. **"7 check-ins in a row"** is the run of on-time check-ins ending today, or yesterday while today's is still due
    (the CHECK_IN family's rule), reaching 7 while the list is open; the run may begin before day 1.
23. **The place bonus** pays once when `firstPlacedAt`'s local date is on or before day 7, which includes a P1
    placement made before coins existed (P1 ruling, spec §11.2's one exception to "no backpay"). The streak bonus pays
    only while the list is open.
24. **"Get a fern in the coin shop"** ticks on a bought `plant.fern` (`ItemGrant` with a `buy:` key). **"Cheer a
    buddy's room"** ticks on a `cheer_given` event, which only P4 writes: the row is shown in P2 and ticks from P4.
25. **Dropping `room` is its own migration** (`20261017120000_drop_slot_room`) whose first statement is the guard;
    `layout` becomes NOT NULL in it. The conversion script reads and writes with raw SQL so it runs with P2's client
    before the migration, and answers `converted: 0` once the column is gone. The deploy order (sync script) is: npm
    install, `prisma generate`, the conversion script, `prisma migrate deploy`, build. `slotsFromLayout` stays as the
    conversion's round-trip proof in tests; no DTO carries a slot room.
26. **Every P2 POST takes the 32 KB route parser** (`saveBodyParser`, P1 ruling 14), so an oversize body is the house
    `400 invalid_body`.
27. **The sleep source's goal** is `changeInEffect` over the SLEEP_MINUTES goal changes, else the stored goal, the
    badge's own marker per night; the badge's `familyStartDate` is not used, because it would drop nights after an
    easing change that still hit the goal in effect.
28. **Cheers in P2:** the ledger enforces 5 paid cheers a day across `cheer_given` and `cheer_got` (spec §6.2) and is
    tested with synthetic events, but no P2 source writes one; "How to earn" lists the four P2 sources only.
29. **History time labels** are device-local: "Today, 07:12", "Yesterday", or "Mon 12 Oct".
30. **Request ids** come from `expo-crypto`'s `randomUUID`, one per purchase or grow attempt, reused on a retry after
    a network failure and dropped after any server answer; `jest-setup.js` mocks `expo-crypto`.
31. **Deferred minor folded in (P1 Task 4):** read-time trimming drops "highest id first" with `p10` above `p9` (longer
    ids rank higher, then lexical), so the newest copies go first.
32. **The recap hook's WEEK guard** also guards the cosmetics grant (spec §13 "MONTH opens" minor): only a WEEK open
    runs either.
33. **The coins store has no version;** "ignore an older answer" (spec §12) is the epoch: every purchase, grow,
    mark-seen and sign-out moves it, so a read that started earlier is dropped.
34. **`GET /me/shop`** answers `{ week, set: { id, itemIds }, items: [{ itemId, price }] }`; the app derives locked,
    owned and where-it-goes from the catalogue and its counts.
35. **Coin history rows** carry `{ kind, amount, at, seen }` only (spec §12): labels are by kind ("Coin shop" for a
    purchase, "First-week bonus", "Your room grew"), and a 0-coin row reads "+0 · daily cap".
36. **The editor's counts follow the store** while it is open (`counts` action): a piece bought from the editor's
    shop appears in the drawer with NEW, and is marked seen, as opening the editor marks what it shows.
37. **The tier gates travel with the catalogue:** the export adds `tierGates` (price, badge family, level and that
    level's threshold), so the app's Room sizes screen and the server's gate share one source.
38. **Every wallet chip opens the coin history** (its label says so, §6.7); the history's Coin shop button is the way
    from the KIP page's wallet to the shop (§6.6 lists the wallet as a way in).

## Review Focus

1. **Two coin writers at once.** The sync worker's sleep hook and `GET /me/coins`' catch-up run for the same user in
   the same second (or a check-in route and its hook). Expected: each source key is paid once, the wallet equals the
   sum of the rows, and nothing errors. Pinned in Task 3 (five concurrent `applyCoinEvents` of one key) and Task 5 (a
   GET racing a direct `earnCoins`).
2. **A user far from UTC near midnight.** An Auckland user's night, step day, 01:30 check-in and recap open. Expected:
   the night pays on its wake date, the 01:30 check-in counts on the previous habit day, each event's cap day is its own
   civil date, and "Earned today" sums the local today. Pinned in Task 4 (an Auckland fixture) and Task 5 (`today`).
3. **A double tap on "Get for 150"**, or a retry after a dropped connection. Expected: one purchase, one copy, one
   −150; the retry answers the first result. Pinned in Task 6 (concurrent same `requestId`) and Task 11 (the button is
   loading until the answer; a network retry reuses the request id).
4. **Growing to the loft from the editor with unsaved changes**, a poster hanging where the new window goes. Expected:
   the poster goes to the inventory, the draft keeps every other change, the room re-centres, and Done saves at the new
   version. Pinned in Task 7 (stored wall pieces, version bump) and Task 13 (`rebased`, the pan, Done's version).
5. **At the daily cap.** 60 earned today, then a recap is read. Expected: a 0-coin row is written (its key used up),
   no "+10!" lands, history shows "+0 · daily cap", and tomorrow's sources pay again. Pinned in Task 3 (trim and the
   0 row, seen), Task 10 (the history line) and Task 12 (nothing lands for a 0 row).

## File Structure

**Backend (create):**
- `prisma/migrations/20261017120000_drop_slot_room/migration.sql`, `prisma/migrations/20261017130000_coins/migration.sql`.
- `src/coins/ledger.ts` (types, the cap, `applyCoinEvents`, `spendInTx`, `planCapped`), `src/coins/sources.ts`
  (`coinsConfig`, `planEarns`, `loadEarnInputs`, `earnCoins`, the hook), `src/coins/history.ts` (`readCoins`,
  `markCoinsSeen`, cursors), `src/coins/routes.ts`, `src/coins/shopWeeks.ts`, `src/coins/shop.ts`,
  `src/coins/firstWeek.ts`.
- `src/room/expand.ts`.
- Tests: `tests/coins/{helpers.ts,ledger.test.ts,sources.test.ts,routes.test.ts,hooks.test.ts,shop.test.ts,firstWeek.test.ts}`,
  `tests/room/expand.test.ts`.

**Backend (modify):** `prisma/schema.prisma`, `scripts/convert-room-layouts.ts`, `src/app.ts`,
`src/cosmetics/{catalogue,rules,loadout,routes,export}.ts`, `src/room/layout.ts`, `src/recap/routes.ts`,
`src/habits/routes.ts`, `src/sync/worker.ts`, `src/users/deletion.ts`, tests in `tests/room/`, `tests/cosmetics/`,
`tests/users/ownedData.ts`, `tests/sync/worker.test.ts`, `tests/cosmetics/{everShipped,grantsShipped}.json`.

**Mobile (create):**
- `src/api/coins.ts`; `src/lib/coins/{coinsStore,actions,history,shop,sizes,landing}.ts`;
- `src/lib/room/items/shop.ts` (the six pieces' front-on art and icons);
- `src/components/coins/{CoinGlyph,WalletChip,FirstWeekCard}.tsx`, `src/components/coins/useCoinsLanding.ts`;
- `src/screens/{CoinHistoryScreen,CoinShopScreen,RoomSizesScreen}.tsx`;
- tests: `__tests__/lib/{coinsStore,coinActions,coinHistory,coinShop,coinSizes,coinLanding,shopPieces}.test.ts(x)`,
  `__tests__/components/{WalletChip,FirstWeekCard}.test.tsx`,
  `__tests__/screens/{CoinHistoryScreen,CoinShopScreen,RoomSizesScreen}.test.tsx`,
  `__tests__/conventions/earnOnly.test.ts`.

**Mobile (modify):** `src/lib/room/{catalogue,catalogue.json,roomCopy,art,cosmeticsStore}.ts`,
`src/lib/room/edit/{editor,overlay}.ts`, `src/api/cosmetics.ts`, `src/components/edit/{EditRoom,InventoryDrawer,RoomFullCard}.tsx`,
`src/components/coach/{RoomCard,RoomWelcomeCard}.tsx`, `src/components/kip/MyKipScope.tsx`,
`src/screens/{DecorateRoomScreen,CoachScreen}.tsx`, `src/navigation/{RootNavigator,navigationRef}.ts(x)`,
`jest-setup.js`, `jest-mocks/coachScreenHarness.tsx`, and the tests named in each task.

---

### Task 0: Workspace (controller; no code)

- [ ] **Step 1:** Create the workspace with
  `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-15-kip-freebuild-p2.md`,
  so that `.superpowers/sdd/2026-10-15-kip-freebuild-p2/` exists. Copy `common-context.md`,
  `implementer-instructions.md` and `reviewer-instructions.md` from `.superpowers/sdd/2026-10-15-kip-freebuild-p1/`,
  then edit the branch (`feature/kip-freebuild-p2`), the plan name (`2026-10-15-kip-freebuild-p2.md`), the base note
  (P1 at 7fccf46 is the built base; only the free-build spec's P2 row is in scope) and every workspace path
  (`2026-10-15-kip-freebuild-p1` → `2026-10-15-kip-freebuild-p2`).
- [ ] **Step 2:** Copy `backend-jest.sh`, `backup-db.sh`, `schema-drift.sh`, `sync-run.sh` and `metro-local.sh` from
  `.superpowers/sdd/2026-10-15-kip-freebuild-p1/` into the new folder, then:
  - `backup-db.sh`: the dump name becomes `biometrics-before-kip-freebuild-p2-2026-10-15.dump`.
  - `sync-run.sh` (ruling 25): in the backend block the order becomes
    ```bash
    set -o pipefail
    npm install --no-audit --no-fund > /dev/null 2>&1
    npx prisma generate > /dev/null 2>&1
    node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts 2>&1 | tail -1
    npx prisma migrate deploy 2>&1 | grep -E -i "applied|migration|no pending|error" | grep -v -i "postgres://" | tail -5
    npx prisma generate > /dev/null 2>&1
    npm run build > /dev/null 2>&1 && echo "backend build ok"
    ```
    (the conversion runs before the migration that drops `room`; the second `generate` is harmless and keeps the
    client current), and the header comment names `feature/kip-freebuild-p2`.
  - `metro-local.sh`: the screenshot folder becomes `.superpowers/sdd/2026-10-15-kip-freebuild-p2/shots`.
  - Add `convert-test-db.sh`, which runs the conversion script against the **test** database (Task 1 uses it once
    before its migration):
    ```bash
    #!/bin/bash
    # Converts any Spec B row left in the TEST database before P2's drop migration runs there. Never echoes the URL.
    set -e
    export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH
    URL=$(grep -E '^TEST_DATABASE_URL=' "$HOME/dev/biometrics-run/backend/.env" | head -1 | cut -d= -f2- | tr -d '"')
    cd /Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab/backend
    DATABASE_URL="$URL" node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts 2>&1 | tail -1
    ```
- [ ] **Step 3:** Set up and measure: `cd backend && DATABASE_URL=postgresql://x@localhost/x npx prisma generate`,
  then confirm `node node_modules/.bin/tsc --noEmit -p .` reports 0. Run the mobile typecheck, save the error lines to
  `.superpowers/sdd/2026-10-15-kip-freebuild-p2/tsc-baseline.txt`, and confirm the count is 10.
- [ ] **Step 4:** Write the ledger (`progress.md`):
  - copy every `Ruling:` line of `.superpowers/sdd/2026-10-15-kip-freebuild-p1/progress.md` under a heading
    "Inherited from P1 (binding)";
  - write this plan's 38 rulings as `Ruling: … — why — cost` lines;
  - record the order, subagent-driven: backend Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 strictly (shared schema, ledger,
    `loadout.ts` and routes); mobile Task 9 after 8; Tasks 10 → 11 → 12 → 13 → 14 strictly after 9 (they share the
    store, `ROOM_COPY`, the navigator and the KIP page); Task 15 last.

---
### Task 1: Backend: drop Spec B's slot `room` (the guard migration, `layout` required, the raw-SQL conversion script)

Spec §2.4 ("P2 drops `room`": the conversion runs before `prisma migrate deploy`, the migration starts with a guard
that raises while any row still has a null layout), §12 (GET keeps `room` "until P2") and the P1 plan's self-review
item 8 (`room` stays NOT NULL until P2). Ruling 25.

**Files:**
- Create: `backend/prisma/migrations/20261017120000_drop_slot_room/migration.sql`
- Modify: `backend/prisma/schema.prisma` (`CosmeticLoadout`), `backend/src/cosmetics/loadout.ts`,
  `backend/scripts/convert-room-layouts.ts`, `mobile/src/api/cosmetics.ts`
- Modify (tests): `backend/tests/room/read.test.ts` (rewritten), `backend/tests/room/script.test.ts` (rewritten),
  `backend/tests/room/save.test.ts`, `backend/tests/cosmetics/routes.test.ts`, `backend/tests/cosmetics/people.test.ts`,
  `backend/tests/users/ownedData.ts`

**Interfaces:**
- Consumes: P1's `readLayout`, `countsOf`, `starterLayout`, `layoutFromSlots`, `readRoom`, `ownedFrom`, `parseLayout`.
- Produces:
  - `CosmeticsDTO` without `room`; `CosmeticLoadout.layout` is `Json` (required); `convertLoadout` is gone from
    `loadout.ts`;
  - `scripts/convert-room-layouts.ts`: `layoutForRow(room: unknown, unlocks: ReadonlyArray<{ itemId: string }>): RoomLayout`
    and `convertRoomLayouts(batch?: number): Promise<{ converted: number; skipped: number }>`;
  - `readRoom` and `ownedFrom` stay exported from `loadout.ts` (the script uses them); `slotsFromLayout` stays in
    `room/convert.ts` for the conversion tests only.

- [ ] **Step 1: Write the failing tests**

Replace `backend/tests/room/script.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { ownedFrom, readRoom } from '../../src/cosmetics/loadout';
import { layoutFromSlots } from '../../src/room/convert';
import { convertRoomLayouts, layoutForRow } from '../../scripts/convert-room-layouts';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('the drop migration dropped `room` and made `layout` required (spec §2.4)', async () => {
  const cols = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'CosmeticLoadout'`;
  expect(cols.find((c) => c.column_name === 'room')).toBeUndefined();
  expect(cols.find((c) => c.column_name === 'layout')!.is_nullable).toBe('NO');
});

it('the migration raises before it drops anything while a row still needs converting', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261017120000_drop_slot_room/migration.sql'), 'utf8');
  expect(sql.indexOf('RAISE EXCEPTION')).toBeGreaterThan(-1);
  expect(sql.indexOf('RAISE EXCEPTION')).toBeLessThan(sql.indexOf('DROP COLUMN'));
  expect(sql).toMatch(/"layout" IS NULL/);
});

it('converts nothing, and never fails, once the column is gone', async () => {
  expect(await convertRoomLayouts()).toEqual({ converted: 0, skipped: 0 });
});

it('converts a Spec B room from its sanitised slots, exactly as the lazy GET did in P1', () => {
  const room = { ...STARTER_ROOM, plant: 'plant.cactus', rug: 'rug.red' }; // the rug is not owned
  const layout = layoutForRow(room, []);
  expect(layout).toEqual(layoutFromSlots(readRoom(room, ownedFrom([]))));
  expect(layout.pieces.find((p) => p.id === 'rug')!.item).toBe('rug.slate');
  expect(layout.pieces.find((p) => p.id === 'plant')!.item).toBe('plant.cactus');
});
```

Replace `backend/tests/room/read.test.ts`:

```ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_IDS } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
import type { RoomLayout } from '../../src/room/geometry';
import { level } from '../cosmetics/helpers';
import { piece } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

async function me() {
  const user = await buddyUser();
  return { user, headers: await authHeaderFor(user.id) };
}
const get = async (headers: Record<string, string>) => (await (await api()).get('/me/cosmetics').set(headers)).body;
/** A stored loadout row with this layout. */
const stored = (userId: string, layout: RoomLayout, version = 4) =>
  prisma.cosmeticLoadout.create({ data: { userId, worn: { ...EMPTY_WORN }, layout: layout as unknown as Prisma.InputJsonValue, version } });

describe('GET /me/cosmetics (free-build)', () => {
  it('a new user: the starter layout, tier 1, a cap of 40, a count for each of the 19 starters, not welcomed, no slot room', async () => {
    const { headers } = await me();
    const body = await get(headers);
    expect([body.layout, body.tier, body.cap, body.version, body.welcomed]).toEqual([starterLayout(), 1, 40, 0, false]);
    expect(Object.keys(body.counts).sort()).toEqual([...STARTER_IDS].sort());
    expect(Object.values(body.counts).every((n) => n === 1)).toBe(true);
    expect(body).not.toHaveProperty('room'); // spec §2.4: dropped in P2
  });

  it('counts an unlocked item once per unlock row (grants defaults to 1)', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000));
    expect((await get(headers)).counts['rug.red']).toBe(1);
  });

  it('drops placements over the owned count at read, highest id first, children too, and keeps the stored row (spec §2.2)', async () => {
    const { user, headers } = await me();
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('st', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 1 })] };
    await stored(user.id, layout);
    expect((await get(headers)).layout).toEqual(starterLayout());
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect(row!.layout).toEqual(layout);
  });

  it('drops only the true excess: a child that leaves with its dropped parent frees its copy for another (ruling T4-CARRY)', async () => {
    const { user, headers } = await me();
    const kept = piece('st', 'item.sticky', { layer: 'onTop', parent: 'plank', spot: 1 });
    await stored(user.id, { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('a1', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 0 }), kept] });
    expect((await get(headers)).layout).toEqual({ ...starterLayout(), pieces: [...starterLayout().pieces, kept] });
  });

  it('drops unshipped placements and reads an unowned style as the starter style (ruling 23)', async () => {
    const { user, headers } = await me();
    await stored(user.id, { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' }, pieces: [...starterLayout().pieces, piece('x1', 'desk.dual', { x: 2, y: 4 })] }, 1);
    expect((await get(headers)).layout).toEqual(starterLayout());
  });

  it('says welcomed once RoomFirstWeek.welcomedAt is set, and that row never creates a loadout', async () => {
    const { user, headers } = await me();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, welcomedAt: new Date() } });
    const body = await get(headers);
    expect([body.welcomed, body.version]).toEqual([true, 0]);
    expect(await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } })).toBeNull();
  });
});
```

In `backend/tests/room/save.test.ts`:
- the first test's assertion becomes
  `expect([res.body.layout, res.body.worn.head, res.body.version, 'room' in res.body]).toEqual([layout, 'out.beanie', 1, false]);`
- delete the test "a Spec B row converted by the save: the room's own pieces are not a first placement, a new one is"
  (no Spec B row can exist any more), and drop `layoutFromSlots` from the `../../src/room/convert` import.

In `backend/tests/cosmetics/routes.test.ts`:
- delete the `room` helper and the `slotsFromLayout` import (keep `starterLayout`); the first GET test's expected body
  loses `room: slotsFromLayout(starterLayout()),`;
- add `import { Prisma } from '@prisma/client';` and replace the test "reads a stored slot naming an item the user no
  longer owns as the starter piece" with:

```ts
  it('reads a stored worn piece the user does not own as nothing worn', async () => {
    const { user, headers } = await me();
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, layout: starterLayout() as unknown as Prisma.InputJsonValue, worn: worn({ head: 'out.crown' }), version: 2 } });
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect([res.body.worn.head, res.body.version, res.body.layout]).toEqual([null, 2, starterLayout()]);
  });
```

In `backend/tests/cosmetics/people.test.ts` (add `import { Prisma } from '@prisma/client';` and
`import { starterLayout } from '../../src/room/convert';`, drop `STARTER_ROOM`), the loadout row becomes:

```ts
  const layout = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'rug' ? { ...p, item: 'rug.red' } : p)) };
  await prisma.cosmeticLoadout.create({ data: { userId: sam.id, layout: layout as unknown as Prisma.InputJsonValue, worn: { ...EMPTY_WORN, head: 'out.cap' }, version: 1 } });
```

In `backend/tests/users/ownedData.ts` (import `Prisma` from `@prisma/client` and `starterLayout` from
`../../src/room/convert`; drop `STARTER_ROOM` from the catalogue import), the loadout seed becomes:

```ts
  await prisma.cosmeticLoadout.create({ data: { userId, layout: starterLayout() as unknown as Prisma.InputJsonValue, worn: { ...EMPTY_WORN }, version: 1 } });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/room/script.test.ts tests/room/read.test.ts`
Expected: FAIL (`layoutForRow` is not exported; the `room` column is still there; `body.room` is still sent).

- [ ] **Step 3: The conversion script, `backend/scripts/convert-room-layouts.ts`**

```ts
/// <reference types="node" />
// Converts every Spec B slot room to an iso layout once (spec 2026-10-15 §2.4), with a conditional write (only while
// the row is unconverted at the version read, never bumping it). P2's deploy runs it BEFORE `prisma migrate deploy`,
// whose first statement refuses to drop `room` while a layout is still null. It reads and writes with raw SQL, so it
// runs with a client generated from a schema that no longer has `room`; once the column is gone it converts nothing.
// Logs counts only, never a user id or a layout.
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts
import { prisma } from '../src/db/client';
import { ownedFrom, readRoom } from '../src/cosmetics/loadout';
import { layoutFromSlots } from '../src/room/convert';
import type { RoomLayout } from '../src/room/geometry';

/** The layout a stored slot room converts to: from Spec B's sanitised room, never the raw JSON. */
export function layoutForRow(room: unknown, unlocks: ReadonlyArray<{ itemId: string }>): RoomLayout {
  return layoutFromSlots(readRoom(room, ownedFrom(unlocks)));
}

async function hasRoomColumn(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'CosmeticLoadout' AND column_name = 'room'
    ) AS present`;
  return rows[0]?.present === true;
}

export async function convertRoomLayouts(batch = 200): Promise<{ converted: number; skipped: number }> {
  let converted = 0;
  let skipped = 0;
  if (!(await hasRoomColumn())) return { converted, skipped };
  let after = '';
  for (;;) {
    const rows = await prisma.$queryRaw<Array<{ userId: string; room: unknown; version: number }>>`
      SELECT "userId", "room", "version" FROM "CosmeticLoadout"
      WHERE "layout" IS NULL AND "userId" > ${after} ORDER BY "userId" LIMIT ${batch}`;
    if (!rows.length) break;
    for (const row of rows) {
      const unlocks = await prisma.cosmeticUnlock.findMany({ where: { userId: row.userId }, select: { itemId: true } });
      const layout = JSON.stringify(layoutForRow(row.room, unlocks));
      const n = await prisma.$executeRaw`
        UPDATE "CosmeticLoadout" SET "layout" = ${layout}::jsonb
        WHERE "userId" = ${row.userId} AND "layout" IS NULL AND "version" = ${row.version}`;
      if (n === 1) converted++;
      else skipped++;
    }
    after = rows[rows.length - 1]!.userId;
  }
  return { converted, skipped };
}

if (require.main === module) {
  convertRoomLayouts()
    .then(async (r) => {
      console.log(JSON.stringify({ event: 'room.converted', ...r }));
      await prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(JSON.stringify({ event: 'room.convert_failed', error: err instanceof Error ? err.name : 'Error' }));
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [ ] **Step 4: Convert anything left in the test database, then the migration and the schema**

Run once, before the new migration exists: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/convert-test-db.sh`.
Expected: one `room.converted` line (any count); a second run says `"converted":0`.

Create `backend/prisma/migrations/20261017120000_drop_slot_room/migration.sql`:

```sql
-- KIP's free-build room, P2 (spec 2026-10-15 §2.4): Spec B's slot `room` is dropped. scripts/convert-room-layouts.ts
-- runs before this migration; the guard refuses to drop the column while any row still needs it.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "CosmeticLoadout" WHERE "layout" IS NULL) > 0 THEN
    RAISE EXCEPTION 'CosmeticLoadout rows still have no layout: run scripts/convert-room-layouts.ts first';
  END IF;
END $$;

ALTER TABLE "CosmeticLoadout" DROP COLUMN "room";
ALTER TABLE "CosmeticLoadout" ALTER COLUMN "layout" SET NOT NULL;
```

In `backend/prisma/schema.prisma`, `CosmeticLoadout` becomes:

```prisma
/// KIP's room and what KIP wears. No row means the starter layout and nothing worn.
model CosmeticLoadout {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// Record<WornSlot, itemId | null>
  worn      Json
  /// RoomLayout (spec 2026-10-15 §2.3). Spec B's slot `room` was converted and dropped in P2 (§2.4).
  layout    Json
  /// 1 starter 7×7, 2 bigger 8×8, 3 loft 9×9; written only by the expand route.
  tier      Int      @default(1)
  /// Optimistic concurrency: every save increments it.
  version   Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Then `DATABASE_URL=postgresql://x@localhost/x npx prisma generate`.

- [ ] **Step 5: `backend/src/cosmetics/loadout.ts`**

- Remove `room: Room;` and its comment from `CosmeticsDTO`, and the whole `convertLoadout` function.
- `readCosmetics` becomes:

```ts
export async function readCosmetics(userId: string, now: Date, opts: { grant?: boolean } = {}): Promise<CosmeticsDTO> {
  if (opts.grant ?? true) await grantCosmeticsSafely(userId, now);
  const [rows, loadout, facts, firstWeek] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: [{ unlockedAt: 'asc' }, { itemId: 'asc' }], select: { itemId: true, source: true, seenAt: true } }),
    prisma.cosmeticLoadout.findUnique({ where: { userId } }),
    loadUnlockFacts(userId),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { welcomedAt: true } }),
  ]);
  const owned = ownedFrom(rows);
  const counts = countsOf(rows);
  const layout = (loadout ? readLayout(loadout.layout, counts) : null) ?? starterLayout();
  const tier = toTier(loadout?.tier);
  return {
    catalogueVersion: COSMETICS_CATALOGUE_VERSION,
    owned: [...owned].sort(),
    fresh: rows.filter((r) => r.seenAt === null && owned.has(r.itemId)).map((r) => ({ itemId: r.itemId, source: r.source })),
    layout,
    tier,
    cap: capFor(tier),
    counts,
    worn: loadout ? readWorn(loadout.worn, owned) : { ...EMPTY_WORN },
    version: loadout?.version ?? 0,
    counters: countersOf(facts),
    welcomed: !!firstWeek?.welcomedAt,
  };
}
```

- In `saveCosmetics`, the row read selects `{ layout: true, version: true, tier: true }`, `data` loses its `room` line,
  and the first-placement comparison becomes:

```ts
      // "Placed a piece" (spec §11.1): an instance id the stored layout (or, with no row, the starter one) did not have.
      const before = new Set((row ? parseLayout(row.layout) ?? starterLayout() : starterLayout()).pieces.map((p) => p.id));
      if (parsed.layout.pieces.some((p) => !before.has(p.id))) {
```

- The imports drop `slotsFromLayout` and `layoutFromSlots` (keep `starterLayout`); `Prisma` stays (the save's
  `P2002` check uses it). The header comment's last sentence becomes "Spec B's slot room was converted and dropped in
  P2 (§2.4)."

In `mobile/src/api/cosmetics.ts`, delete the two lines `/** Spec B's slot room, derived by the server until P2; … */`
and `room?: Record<string, string | null>;`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/room tests/cosmetics tests/users`
Expected: PASS. Then `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/schema-drift.sh` prints `no drift`.

- [ ] **Step 7: Full suites, typechecks, commit**

Full backend suite (green), backend tsc (0), mobile typecheck (10) and the full mobile suite (green).

```bash
git add backend/prisma backend/src/cosmetics/loadout.ts backend/scripts/convert-room-layouts.ts backend/tests/room backend/tests/cosmetics/routes.test.ts backend/tests/cosmetics/people.test.ts backend/tests/users/ownedData.ts mobile/src/api/cosmetics.ts
git commit -m "feat(backend): drop the Spec B slot room behind a guard migration, make the layout required, and convert with raw SQL before the migration"
```

---

### Task 2: Catalogue release 4: prices, the shop unlock kind, and the six coin-shop pieces with their art

Spec §2.1 (`price`, `shop`; release 4 for P2's shop pieces), §4 (P2's art batch: `item.radio`, `corner.gnome`,
`corner.cone`, `corner.pumpkin`, `item.candle`, `art.neonheart`; existing rule pieces are not re-made), §6.4 (pieces
25–200), §6.5 (unlocks still grant free; coins buy shop pieces and extra copies) and §16's catalogue tests. Rulings
1–4.

**Files:**
- Modify: `backend/src/cosmetics/catalogue.ts`, `backend/src/cosmetics/rules.ts`
- Modify (tests): `backend/tests/cosmetics/catalogue.test.ts`, `backend/tests/cosmetics/rules.test.ts`,
  `backend/tests/cosmetics/everShipped.json`, `backend/tests/cosmetics/grantsShipped.json`
- Modify (generated): `mobile/src/lib/room/catalogue.json`
- Create (mobile): `mobile/src/lib/room/items/shop.ts`, `mobile/__tests__/lib/shopPieces.test.ts`
- Modify (mobile): `mobile/src/lib/room/catalogue.ts`, `mobile/src/lib/room/roomCopy.ts`, `mobile/src/lib/room/art.ts`,
  `mobile/src/lib/room/items/shared.ts` (`spriteRows`), `mobile/src/lib/room/iso/pieces/extras.ts` (uses it),
  `mobile/__tests__/lib/roomCatalogue.test.ts`, `mobile/__tests__/lib/isoPieces.test.ts`,
  `mobile/__tests__/lib/roomCopy.test.ts`

**Interfaces:**
- Consumes: P1's `COSMETIC_ITEMS`, `ISO_OVERRIDES`, `registerItems`, `registerIcons`, `standingPiece`, `standing`,
  `stand.ts`'s billboards and `wallArt.ts` (both register every catalogue item of their slots).
- Produces:
  - backend: `type CosmeticRelease = 1 | 2 | 3 | 4`, `type ShippedRelease = 1 | 3 | 4`, `SHIPPED_RELEASES` `{1, 3, 4}`,
    `RELEASE_LAUNCHED_AT[4]`; `UnlockRule` gains `{ kind: 'shop' }` (code `'C'`); `CosmeticItem.price?: number` and
    `.shop?: 'always' | { week: string }`; `PRICES`; `metAt` / `sourceOf` handle `'shop'` (never met; source `'shop'`);
  - mobile: `UnlockRule` gains `{ kind: 'shop' }`; `CatalogueItem.price?` / `.shop?`; `unlockLine({ kind: 'shop' })` is
    "From the coin shop"; `spriteRows(lines, pal): SpriteRect[]` in `items/shared.ts`; the six names in `ITEM_NAMES`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/cosmetics/catalogue.test.ts`:
- `const base = …` becomes `COSMETIC_ITEMS.filter((i) => !i.id.startsWith('set.') && i.release <= 2);` (release 3
  and 4 are free-build pieces, not the Cat boards').
- Replace the test "has a launch date for every shipped release, and ships releases 1 and 3 (spec §2.1 Releases)" with:

```ts
it('ships releases 1, 3 and 4, each with a launch date (spec §2.1 Releases, plan ruling 1)', () => {
  expect([...SHIPPED_RELEASES].sort()).toEqual([1, 3, 4]);
  for (const r of SHIPPED_RELEASES) expect(RELEASE_LAUNCHED_AT[r as 1 | 3 | 4]).toBeInstanceOf(Date);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 3).map((i) => i.id).sort()).toEqual(['lamp.welcome', 'shelf.plank']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 4).map((i) => i.id).sort())
    .toEqual(['art.neonheart', 'corner.cone', 'corner.gnome', 'corner.pumpkin', 'item.candle', 'item.radio']);
});

it('reads the coin-shop code: a shop piece is only ever bought (plan ruling 2)', () => {
  expect(ruleOf('C')).toEqual({ kind: 'shop' });
  for (const item of COSMETIC_ITEMS.filter((i) => i.release === 4)) {
    expect({ id: item.id, unlock: item.unlock, priced: typeof item.price, iso: !!item.iso }).toEqual({ id: item.id, unlock: { kind: 'shop' }, priced: 'number', iso: true });
  }
});

it('prices pieces 25 to 200 coins, always in the shop, never a desk or the welcome lantern (spec §6.4, §6.5, rulings 3-4)', () => {
  for (const item of COSMETIC_ITEMS.filter((i) => i.price !== undefined)) {
    expect({ id: item.id, ok: item.price! >= 25 && item.price! <= 200 && item.shop === 'always' && !!item.iso }).toEqual({ id: item.id, ok: true });
  }
  for (const id of ['desk.monitor', 'desk.notebook', 'desk.laptop', 'set.cottage.desk', 'lamp.welcome']) expect(cosmeticItem(id)!.price).toBeUndefined();
  const price = (id: string) => cosmeticItem(id)!.price;
  expect(['item.radio', 'corner.gnome', 'corner.cone', 'corner.pumpkin', 'item.candle', 'art.neonheart'].map(price)).toEqual([150, 80, 60, 30, 25, 200]);
  expect(['plant.fern', 'corner.floorlamp', 'pet.bed', 'plant.monstera', 'plant.snake'].map(price)).toEqual([40, 120, 140, 140, 100]);
  expect(['lamp.lava', 'item.duck', 'pet.cat'].map(price)).toEqual([120, 40, 180]); // B2: priced, shown when release 2 ships
});
```

In `backend/tests/cosmetics/rules.test.ts`, add:

```ts
it('never grants a coin-shop piece, whatever the facts (plan ruling 2)', () => {
  const every: UnlockFacts = {
    levels: ['SLEEP_GOAL', 'STEADY_BEDTIME', 'STEP_GOAL', 'CHECK_IN', 'BEST_RECOVERY_WEEK', 'EVERY_DAY_LOGGED', 'STEADIEST_MONTH']
      .map((family) => ({ family, level: 5, at: t('2026-10-16T08:00:00Z') })),
    recapsReadAt: Array.from({ length: 20 }, () => t('2026-10-16T09:00:00Z')),
    cheersAt: Array.from({ length: 20 }, () => t('2026-10-16T10:00:00Z')),
  };
  const planned = plan(every, { shipped: new Set([1, 3, 4]), launchedAt: { 1: t('2026-10-15T00:00:00Z'), 3: t('2026-10-16T00:00:00Z'), 4: t('2026-10-20T00:00:00Z') } });
  expect(planned.filter((p) => COSMETIC_ITEMS.find((i) => i.id === p.itemId)!.unlock.kind === 'shop')).toEqual([]);
  expect(metAt({ kind: 'shop' }, every, SETS)).toBeNull();
  expect(sourceOf({ kind: 'shop' })).toBe('shop');
});
```

Append to `backend/tests/cosmetics/everShipped.json` (before the closing `]`, keeping the array's format):
`"item.radio", "corner.gnome", "corner.cone", "corner.pumpkin", "item.candle", "art.neonheart"`. Add the same six
ids to `backend/tests/cosmetics/grantsShipped.json`, each with `1`.

In `mobile/__tests__/lib/roomCatalogue.test.ts`, the release test becomes:

```ts
it('holds releases 1, 3 and 4: 95 items and the Cottage set, every piece known', () => {
  expect([CATALOGUE.releases, CATALOGUE.items.length, CATALOGUE.sets.map((s) => s.id)]).toEqual([[1, 3, 4], 95, ['cottage']]);
  for (const item of CATALOGUE.items) expect([...ROOM_SLOTS, ...WORN_SLOTS]).toContain(item.slot);
  const cottage = catalogueSet('cottage')!;
  for (const id of [...Object.values(cottage.room), ...Object.values(cottage.worn)]) expect(catalogueItem(id!)).toBeDefined();
});
```

In `mobile/__tests__/lib/isoPieces.test.ts`, the count test becomes:

```ts
it('every shipped placeable piece has iso art, 62 in all: the 54 release-1 pieces, the 2 of release 3 and the 6 shop pieces (spec §4)', () => {
  expect(PLACEABLE).toHaveLength(62); // 54 release-1 placeables + shelf.plank + lamp.welcome + 6 release-4 pieces
  for (const item of PLACEABLE) expect({ id: item.id, art: !!isoArtOf(item.id) }).toEqual({ id: item.id, art: true });
});
```

In `mobile/__tests__/lib/roomCopy.test.ts`, add to the unlock-lines test:
`expect([unlockLine({ kind: 'shop' }), unlockSpoken({ kind: 'shop' })]).toEqual(['From the coin shop', 'From the coin shop']);`

Create `mobile/__tests__/lib/shopPieces.test.ts`:

```ts
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueItem } from '../../src/lib/room/catalogue';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { spriteRows } from '../../src/lib/room/items/shared';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import type { PlacementLayer } from '../../src/lib/room/iso/geometry';
import '../../src/lib/room/iso';

const SHOP = ['item.radio', 'corner.gnome', 'corner.cone', 'corner.pumpkin', 'item.candle', 'art.neonheart'];

it('ships the six coin-shop pieces in release 4, each priced, with front-on art, an icon and iso art (spec §4)', () => {
  expect(CATALOGUE.items.filter((i) => i.release === 4).map((i) => i.id).sort()).toEqual([...SHOP].sort());
  for (const id of SHOP) {
    expect({ id, art: !!itemArt(id), icon: (itemIcon(id)?.length ?? 0) > 0, iso: !!isoArtOf(id), price: typeof catalogueItem(id)!.price })
      .toEqual({ id, art: true, icon: true, iso: true, price: 'number' });
  }
});

it('stands each piece on every layer it allows, day and night, and hangs the sign on both walls', () => {
  clearPieceCache();
  for (const id of SHOP) {
    const layers: PlacementLayer[] = catalogueItem(id)!.iso!.layers.flatMap((l) => (l === 'wall' ? (['wallL', 'wallR'] as const) : [l]));
    for (const layer of layers) for (const ctx of [CTX_DAY, CTX_NIGHT]) {
      const l = pieceLayers(id, ctx, { layer, facing: 'L', mirror: false });
      expect({ id, layer, base: (l?.base?.length ?? 0) > 0 }).toEqual({ id, layer, base: true });
    }
  }
});

it('only the candle\'s flame and the sign\'s tube glow, and only in the glow layer', () => {
  for (const id of SHOP) {
    const l = itemArt(id)!.draw(CTX_NIGHT);
    expect({ id, glow: (l.emissive?.length ?? 0) > 0 }).toEqual({ id, glow: id === 'item.candle' || id === 'art.neonheart' });
  }
});

it('reads a sprite from rows of palette letters, one rect per run (gen/front.py `sprite`)', () => {
  expect(spriteRows(['.aa.b', 'c....'], { a: '#111111', b: '#222222', c: '#333333' }))
    .toEqual([[1, 0, 2, 1, '#111111'], [4, 0, 1, 1, '#222222'], [0, 1, 1, 1, '#333333']]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/cosmetics/catalogue.test.ts tests/cosmetics/rules.test.ts`
Expected: FAIL (`ruleOf('C')` throws; no release 4; no prices).
Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/shopPieces.test.ts __tests__/lib/roomCatalogue.test.ts`
Expected: FAIL (`spriteRows` is not exported; release 4 is not in `catalogue.json`).

- [ ] **Step 3: The backend catalogue**

In `backend/src/cosmetics/catalogue.ts`:

```ts
export type CosmeticRelease = 1 | 2 | 3 | 4;
/** Releases the app can draw. B2 (release 2) joins when its art ships; free-build P1's pieces are release 3, P2's shop
 * pieces release 4. */
export const SHIPPED_RELEASES: ReadonlySet<CosmeticRelease> = new Set<CosmeticRelease>([1, 3, 4]);
export type ShippedRelease = 1 | 3 | 4;
/** … (comment unchanged) OWNER NOTE (P2 plan ruling 1): release 4's date is set with the coins launch at merge. */
export const RELEASE_LAUNCHED_AT: Readonly<Record<ShippedRelease, Date>> = Object.freeze({
  1: new Date('2026-10-15T00:00:00.000Z'),
  3: new Date('2026-10-16T00:00:00.000Z'),
  4: new Date('2026-10-20T00:00:00.000Z'),
});
```

`UnlockRule` gains a member and `ruleOf` its code (first line of the function):

```ts
export type UnlockRule =
  | { kind: 'starter' }
  | { kind: 'shop' }
  | { kind: 'family'; family: AchievementFamily; level: Level }
  | { kind: 'anyFamily'; level: Level }
  | { kind: 'counter'; counter: CounterName; atLeast: number }
  | { kind: 'set'; set: SetId };

/** A Cat board unlock code: 'S' starter, 'C' the coin shop only, 'SB3' a family level, 'ANY4', 'RC8' recaps read, 'CB10' buddy cheers. */
export function ruleOf(code: string): UnlockRule {
  if (code === 'S') return { kind: 'starter' };
  if (code === 'C') return { kind: 'shop' };
  // … the rest unchanged
```

`CosmeticItem` gains (after `tags`):

```ts
  /** Coins (spec §6.4); absent = not in the shop. */
  price?: number;
  /** 'always', or only in that ISO week (P4's theme pieces); every P2 price is 'always' (plan ruling 4). */
  shop?: 'always' | { week: string };
```

After the `FREEBUILD` rows:

```ts
// Free-build P2's coin-shop pieces (spec 2026-10-15 §4: F6, C1): bought with coins, never unlocked by a rule.
const SHOP_PIECES: readonly Row[] = [
  ['item.radio', 'desk_item', 'C', '', 4],
  ['corner.gnome', 'corner', 'C', '', 4],
  ['corner.cone', 'corner', 'C', '', 4],
  ['corner.pumpkin', 'corner', 'C', '', 4],
  ['item.candle', 'desk_item', 'C', 'G', 4],
  ['art.neonheart', 'art', 'C', 'G', 4],
];

/**
 * Coin prices (spec §6.4: 25–200), all 'always' in P2 (plan rulings 2–4): the shop's own pieces, every placeable
 * starter as an extra copy (not the desks, one per room, and not the welcome lantern, C7's gift), and the rule pieces
 * the boards price, sold only once earned. B2's three are priced now and shown when release 2 ships.
 */
const PRICES: Readonly<Record<string, number>> = {
  'item.radio': 150, 'corner.gnome': 80, 'corner.cone': 60, 'corner.pumpkin': 30, 'item.candle': 25, 'art.neonheart': 200,
  'plant.fern': 40, 'plant.cactus': 40, 'item.mug': 25, 'item.sticky': 25, 'shelf.books': 30, 'shelf.minicactus': 30,
  'shelf.plank': 30, 'lamp.amber': 60, 'rug.slate': 80, 'art.calendar': 40,
  'corner.floorlamp': 120, 'pet.bed': 140, 'plant.monstera': 140, 'plant.snake': 100,
  'lamp.lava': 120, 'item.duck': 40, 'pet.cat': 180,
};
```

Add to `ISO_OVERRIDES` (the shop's small pieces stand on the floor or a surface; the sign hangs like art):

```ts
  'item.radio': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.gnome': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.cone': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'corner.pumpkin': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  'item.candle': { layers: ['onTop', 'floor'], foot: [1, 1], facings: 1 },
  'art.neonheart': { layers: ['wall'], wall: [3, 4], facings: 1 },
```

In `build()`, the first loop reads `[...BASE, ...FREEBUILD, ...SHOP_PIECES]`, and the last loop becomes:

```ts
  for (const [id, item] of items) {
    const iso = isoFor(item);
    const price = PRICES[id];
    items.set(id, {
      ...item,
      ...(iso ? { iso } : {}),
      ...(FUNNY.has(id) ? { tags: ['funny'] } : {}),
      ...(price !== undefined ? { price, shop: 'always' as const } : {}),
    });
  }
```

In `backend/src/cosmetics/rules.ts`, `metAt` gains `case 'shop': return null;` (next to `'starter'`) and `sourceOf`
gains `case 'shop': return 'shop';`. `planGrants` already skips a rule that is never met.

Regenerate the app's copy from `backend/`: `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`
(rewrites `mobile/src/lib/room/catalogue.json`; the geometry copy is unchanged).

- [ ] **Step 4: The app's catalogue types and copy**

In `mobile/src/lib/room/catalogue.ts`, `UnlockRule` gains `| { kind: 'shop' }` after `{ kind: 'starter' }`, and
`CatalogueItem` gains:

```ts
  /** Coins (spec §6.4); absent = not in the shop. */
  price?: number;
  shop?: 'always' | { week: string };
```

In `mobile/src/lib/room/roomCopy.ts`, add to `ITEM_NAMES` (after the pet line):

```ts
  // The coin shop's own pieces (spec 2026-10-15 §4, F6, C1).
  'item.radio': 'Old radio', 'corner.gnome': 'Gnome', 'corner.cone': 'Traffic cone', 'corner.pumpkin': 'Pumpkin',
  'item.candle': 'Candle', 'art.neonheart': 'Neon heart sign',
```

and in `unlockLine`'s switch, after `case 'starter'`: `case 'shop': return 'From the coin shop';`.

- [ ] **Step 5: The six pieces' art, `mobile/src/lib/room/items/shop.ts`**

First move `rows` from `mobile/src/lib/room/iso/pieces/extras.ts` into `mobile/src/lib/room/items/shared.ts` as an
export (its body unchanged):

```ts
/** A sprite from rows of palette letters ('.' is empty), one rect per run (gen/front.py `sprite`). */
export function spriteRows(lines: readonly string[], pal: Readonly<Record<string, string>>): SpriteRect[] {
  const out: SpriteRect[] = [];
  lines.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x]!;
      if (c === '.') { x++; continue; }
      let w = 1;
      while (row[x + w] === c) w++;
      out.push([x, y, w, 1, pal[c]!]);
      x += w;
    }
  });
  return out;
}
```

and in `extras.ts` delete the local `rows`, import `spriteRows` from `'../../items/shared'`, and call `spriteRows(…)`
in its two `registerIcons` entries.

Create `mobile/src/lib/room/items/shop.ts`:

```ts
// The coin shop's own pieces (spec 2026-10-15 §4: F6, C1), from the boards' sprites (docs/design/freebuild/gen/front.py
// SPR): the old radio, the gnome, the traffic cone, the pumpkin, the candle (its flame glows) and the neon heart sign
// (its tube glows). Front-on sprites only: the iso room stands the small ones as billboards (iso/pieces/stand.ts) and
// hangs the sign on a wall (iso/pieces/wallArt.ts), as it does every piece of their slots.
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { glow, type Rects } from '../paint';
import { darkenHex, rgbOf, sprite, spriteRows, standing, standingPiece } from './shared';

const RADIO = spriteRows([
  '...........k...',
  '..........k....',
  '.oooooooookooo.',
  'oOOOOOOOOOOOOOo',
  'oyyyyyyoo.dd.oo',
  'oyHyHyyoodddd.o',
  'oyyyyyyoo.dd..o',
  'oOOOOOOOOOOOOOo',
  '.ss.........ss.',
], { k: '#94A3B8', o: '#92400E', O: '#B45309', y: '#FDE68A', H: '#B45309', d: '#1F2937', s: '#3A2D23' });

const CONE = spriteRows([
  '...oo...',
  '...oo...',
  '..oOoo..',
  '..wwww..',
  '..wwww..',
  '.oooooo.',
  '.oOooooo',
  '.oooooo.',
  'cccccccc',
], { o: '#F97316', O: '#FDBA74', w: '#F1F5F9', c: '#C2410C' });

const GNOME = spriteRows([
  '...r...',
  '..rrr..',
  '..rrrr.',
  '.rrrrr.',
  '.ppppp.',
  '.wwwww.',
  '.wwwww.',
  '.bbbbb.',
  '.bbbbb.',
  '.k...k.',
], { r: '#DC2626', p: '#FCD9B6', w: '#F1F5F9', b: '#2563EB', k: '#1F2937' });

const PUMPKIN = spriteRows([
  '....g...',
  '...g....',
  '.oOoOoo.',
  'oOoOoOoo',
  'oOoOoOoo',
  'oOoOoOoo',
  '.oooooo.',
], { g: '#4D7C0F', o: '#EA580C', O: '#C2410C' });

const FLAME_COLOURS: ReadonlySet<string> = new Set(['#FDE68A', '#F59E0B']);
const CANDLE = spriteRows(['..y..', '..Y..', '.www.', '.www.', '.www.', 'kkkkk'], { y: '#FDE68A', Y: '#F59E0B', w: '#FEF3C7', k: '#78350F' });
const FLAME = CANDLE.filter((r) => FLAME_COLOURS.has(r[4]));
/** The flame unlit in the base (the night veil darkens it); lit, with its halo, in the glow layer. */
const CANDLE_BASE: readonly SpriteRect[] = CANDLE.map(([x, y, w, h, c]) => [x, y, w, h, FLAME_COLOURS.has(c) ? darkenHex(c, 0.55) : c] as const);

const candle: ItemArt = {
  id: 'item.candle', slot: 'desk_item', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, CANDLE_BASE, 0, 0, 6, ramp);
    const emissive: Rects = [];
    sprite(emissive, FLAME, 0, 0, ramp);
    glow(emissive, 2.5, 1, night ? 8 : 4, night ? 6 : 3, rgbOf('#FDE68A'), night ? 0.12 : 0.05);
    return { base: r, emissive };
  },
};

/** front.py's heart at 2 cells a pixel on a 14 × 12 backboard, with a one-row shadow under it. */
const HEART = spriteRows(['.p.p.', 'ppppp', 'ppppp', '.ppp.', '..p..'], { p: '#F472B6' })
  .map(([x, y, w, h, c]) => [2 + 2 * x, 1 + 2 * y, 2 * w, 2 * h, c] as const);
const BOARD: readonly SpriteRect[] = [[0, 0, 14, 12, '#1F2937'], [0, 0, 14, 1, '#334155'], [0, 12, 14, 1, 'rgba(0,0,0,0.25)']];

const sign: ItemArt = {
  id: 'art.neonheart', slot: 'art', emissive: true,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    sprite(r, BOARD, 0, 0, ramp);
    sprite(r, HEART.map(([x, y, w, h, c]) => [x, y, w, h, darkenHex(c, 0.55)] as const), 0, 0, ramp);
    const emissive: Rects = [];
    sprite(emissive, HEART, 0, 0, ramp);
    glow(emissive, 7, 6, night ? 14 : 9, night ? 11 : 7, '244,114,182', night ? 0.12 : 0.05);
    return { base: r, emissive };
  },
};

registerItems([
  standingPiece('item.radio', 'desk_item', RADIO, 0, 0, 9),
  standingPiece('corner.gnome', 'corner', GNOME, 0, 0, 10),
  standingPiece('corner.cone', 'corner', CONE, 0, 0, 9),
  standingPiece('corner.pumpkin', 'corner', PUMPKIN, 0, 0, 7),
  candle,
  sign,
]);
registerIcons({
  'item.radio': RADIO, 'corner.gnome': GNOME, 'corner.cone': CONE, 'corner.pumpkin': PUMPKIN, 'item.candle': CANDLE,
  'art.neonheart': [...BOARD.slice(0, 2), ...HEART],
});
```

In `mobile/src/lib/room/art.ts`, add `import './items/shop';` after `import './items/pet';`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/cosmetics`
Expected: PASS (the export test confirms `catalogue.json` is current).
Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/shopPieces.test.ts __tests__/lib/roomCatalogue.test.ts __tests__/lib/isoPieces.test.ts __tests__/lib/roomCopy.test.ts __tests__/lib/roomSets.test.ts`
Expected: PASS (`roomSets`' `checkSlotArt` now covers the six pieces' flags too).

- [ ] **Step 7: Full suites, typechecks, art size, commit**

Full backend suite (green), backend tsc (0), the full mobile suite (green), mobile typecheck (10), and
`node scripts/room-art-size.mjs` from `mobile/` (under 300 KB; record the number in the ledger).

```bash
git add backend/src/cosmetics/catalogue.ts backend/src/cosmetics/rules.ts backend/tests/cosmetics mobile/src/lib/room mobile/__tests__/lib/shopPieces.test.ts mobile/__tests__/lib/roomCatalogue.test.ts mobile/__tests__/lib/isoPieces.test.ts mobile/__tests__/lib/roomCopy.test.ts
git commit -m "feat(room): release 4 brings coin prices, the shop unlock kind and six coin-shop pieces with their art"
```

---

### Task 3: Backend: the coin ledger (`CoinEvent`, `CoinWallet`, `ItemGrant`), the daily cap, spends, deletion

Spec §6.1 (no loss, never negative), §6.2 (the cap of 60 per civil day; a trimmed earn takes what is left; nothing
left writes `amount: 0`, its key used up; 5 paid cheers a day), §6.3 (the models, `applyCoinEvents`: one locked
transaction, filter existing keys before trimming, trim by kind then key, `createManyAndReturn` + `skipDuplicates`,
the wallet; spends in the same locked transaction), §2.2 (`ItemGrant`; the never-removed guard), §12 (deletion,
telemetry) and §16's ledger tests. Rulings 5, 6, 7, 28.

**Files:**
- Create: `backend/prisma/migrations/20261017130000_coins/migration.sql`, `backend/src/coins/ledger.ts`,
  `backend/tests/coins/helpers.ts`, `backend/tests/coins/ledger.test.ts`
- Modify: `backend/prisma/schema.prisma` (three models and their `User` relations), `backend/src/users/deletion.ts`,
  `backend/tests/users/ownedData.ts`, `backend/tests/cosmetics/neverRemoved.test.ts`

**Interfaces:**
- Consumes: P1's `lockRoom(tx, userId)`; `civilDateToUtcMidnight`.
- Produces (`backend/src/coins/ledger.ts`):
  - `DAILY_CAP = 60`, `PAID_CHEERS_A_DAY = 5`, `CAPPED_KINDS`, `EARN_KINDS`, `type CappedKind`, `type EarnKind`,
    `type SpendKind = 'buy' | 'expand'`, `type CoinKind`, `isCapped(kind)`;
  - `interface CoinEarn { kind: EarnKind; sourceKey: string; amount: number; capDay: string | null }`,
    `interface CoinWritten { kind: EarnKind; amount: number }`, `type DayUse`;
  - `planCapped(fresh: readonly CoinEarn[], used: DayUse): CoinEarn[]` (pure);
  - `applyCoinEvents(userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]>` (only the rows
    this call wrote);
  - `type Spent = { ok: true; balance: number } | { ok: false; needed: number }`;
    `spendInTx(tx: Prisma.TransactionClient, userId: string, kind: SpendKind, sourceKey: string, price: number, now: Date): Promise<Spent>`;
  - `balanceOf(db, userId): Promise<number>`;
  - Prisma models `CoinEvent`, `CoinWallet`, `ItemGrant` (with `seenAt`), in `USER_OWNED_MODELS`;
  - test helpers `coinUser`, `earn`, `fund`, `rowsOf`, `balance` (`backend/tests/coins/helpers.ts`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/helpers.ts`:

```ts
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { applyCoinEvents, type CoinEarn, type EarnKind } from '../../src/coins/ledger';
import { authHeaderFor } from '../helpers/auth';
import { buddyUser } from '../buddies/helpers';

export async function coinUser(over: { timezone?: string } = {}) {
  const user = await buddyUser(over);
  return { user, headers: await authHeaderFor(user.id) };
}

export const earn = (kind: EarnKind, sourceKey: string, amount: number, capDay: string | null = null): CoinEarn =>
  ({ kind, sourceKey, amount, capDay });

/** Coins for a test that spends: an uncapped row with a key of its own. */
export async function fund(userId: string, coins: number): Promise<void> {
  await applyCoinEvents(userId, [earn('firstweek', `test:${randomUUID()}`, coins)], new Date());
}

export const rowsOf = (userId: string) => prisma.coinEvent.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { sourceKey: 'asc' }] });
export const balance = async (userId: string) => (await prisma.coinWallet.findUnique({ where: { userId } }))?.balance ?? 0;
```

Create `backend/tests/coins/ledger.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { applyCoinEvents, planCapped, spendInTx, type DayUse } from '../../src/coins/ledger';
import { balance, coinUser, earn, fund, rowsOf } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

const D = '2026-11-02';
/** A full day of P2 sources but one recap: 50 coins. */
const FIFTY = [earn('sleep_goal', `sleep_goal:${D}`, 20, D), earn('steps', `steps:${D}`, 15, D), earn('recap', 'recap:r1', 10, D), earn('checkin', `checkin:${D}`, 5, D)];

describe('planCapped (pure)', () => {
  it('trims capped kinds in (kind, key) order to what is left of the day, never below 0', () => {
    const used: DayUse = new Map([[D, { coins: 50, paidCheers: 0 }]]);
    const out = planCapped([earn('steps', 'steps:x', 15, D), earn('checkin', 'checkin:y', 5, D)], used);
    expect(out.map((e) => [e.kind, e.amount])).toEqual([['checkin', 5], ['steps', 5]]);
    expect(planCapped([earn('recap', 'recap:z', 10, D)], used)[0]!.amount).toBe(0);
  });

  it('leaves uncapped kinds alone and keeps each day apart', () => {
    const used: DayUse = new Map([[D, { coins: 60, paidCheers: 0 }]]);
    const out = planCapped([earn('firstweek', 'firstweek:place', 10), earn('sleep_goal', 'sleep_goal:2026-11-03', 20, '2026-11-03')], used);
    expect(out.map((e) => e.amount)).toEqual([10, 20]);
  });

  it('pays 5 cheers a day, given and received together, and writes the rest as 0 (spec §6.2, ruling 28)', () => {
    const cheers = Array.from({ length: 6 }, (_, k) => earn(k % 2 ? 'cheer_got' : 'cheer_given', `cheer:c${k}:${k % 2 ? 'got' : 'given'}`, 2, D));
    expect(planCapped(cheers, new Map()).map((e) => e.amount).sort()).toEqual([0, 2, 2, 2, 2, 2]);
  });
});

describe('applyCoinEvents (spec §6.3)', () => {
  it('pays each source key once, however many writers race (Review Focus 1)', async () => {
    const { user } = await coinUser();
    const e = earn('sleep_goal', `sleep_goal:${D}`, 20, D);
    const results = await Promise.all(Array.from({ length: 5 }, () => applyCoinEvents(user.id, [e], new Date())));
    expect(results.flat()).toEqual([{ kind: 'sleep_goal', amount: 20 }]);
    expect([(await rowsOf(user.id)).length, await balance(user.id)]).toEqual([1, 20]);
  });

  it('stops at 60 a day: an earn takes what is left, the next writes a 0 row, seen, its key used up (Review Focus 5)', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    const [a] = await applyCoinEvents(user.id, [earn('recap', 'recap:r2', 10, D)], new Date());
    const [b] = await applyCoinEvents(user.id, [earn('steps', 'steps:other', 15, D)], new Date());
    expect([a!.amount, b!.amount, await balance(user.id)]).toEqual([10, 0, 60]);
    const zero = (await rowsOf(user.id)).find((r) => r.sourceKey === 'steps:other')!;
    expect([zero.amount, zero.seenAt instanceof Date]).toEqual([0, true]);
    expect(await applyCoinEvents(user.id, [earn('steps', 'steps:other', 15, D)], new Date())).toEqual([]);
    expect((await applyCoinEvents(user.id, [earn('sleep_goal', 'sleep_goal:2026-11-03', 20, '2026-11-03')], new Date()))[0]!.amount).toBe(20);
  });

  it('trims part of an earn: 55 used leaves 5 of a 20', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, [...FIFTY.slice(0, 3), earn('recap', 'recap:r9', 10, D)], new Date()); // 55
    expect((await applyCoinEvents(user.id, [earn('checkin', 'checkin:late', 20, D)], new Date()))[0]!.amount).toBe(5);
  });

  it('drops replays before trimming: a replayed key never uses up the room a new one needs (spec §6.3)', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    expect(await applyCoinEvents(user.id, [FIFTY[0]!, earn('recap', 'recap:r3', 10, D)], new Date())).toEqual([{ kind: 'recap', amount: 10 }]);
  });

  it('pays uncapped kinds past the cap', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, [...FIFTY, earn('recap', 'recap:r4', 10, D)], new Date());
    await applyCoinEvents(user.id, [earn('firstweek', 'firstweek:streak7', 25)], new Date());
    expect(await balance(user.id)).toBe(85);
  });

  it('writes earns unseen and logs kinds and counts only, never the user or an amount', async () => {
    const { user } = await coinUser();
    await applyCoinEvents(user.id, FIFTY, new Date());
    expect((await rowsOf(user.id)).every((r) => r.seenAt === null)).toBe(true);
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('coins.earned'));
    expect(lines.map((l) => JSON.parse(l)).sort((x, y) => (x.kind < y.kind ? -1 : 1))).toEqual([
      { event: 'coins.earned', kind: 'checkin', count: 1 }, { event: 'coins.earned', kind: 'recap', count: 1 },
      { event: 'coins.earned', kind: 'sleep_goal', count: 1 }, { event: 'coins.earned', kind: 'steps', count: 1 },
    ]);
    expect(lines.join('')).not.toContain(user.id);
  });
});

describe('spendInTx and the wallet (spec §6.1, §6.3)', () => {
  it('spends only what is there, writes the spend seen under its request key, and never goes below 0', async () => {
    const { user } = await coinUser();
    await fund(user.id, 100);
    expect(await prisma.$transaction((tx) => spendInTx(tx, user.id, 'buy', 'buy:a', 150, new Date()))).toEqual({ ok: false, needed: 50 });
    expect(await prisma.$transaction((tx) => spendInTx(tx, user.id, 'buy', 'buy:b', 60, new Date()))).toEqual({ ok: true, balance: 40 });
    const row = (await rowsOf(user.id)).find((r) => r.sourceKey === 'buy:b')!;
    expect([row.kind, row.amount, row.capDay, row.seenAt instanceof Date]).toEqual(['buy', -60, null, true]);
    await expect(prisma.coinWallet.update({ where: { userId: user.id }, data: { balance: -1 } })).rejects.toThrow(); // CHECK
  });
});
```

In `backend/tests/cosmetics/neverRemoved.test.ts`, replace the first test and extend the second:

```ts
it('no source deletes a cosmetic unlock, a coin event or an item grant, by name or by SQL (spec §2.2, §6.3)', () => {
  const root = path.join(__dirname, '../..');
  const allowed = new Set([path.join(root, 'src/users/deletion.ts'), path.join(root, 'scripts/purgeTestFixtures.ts')]);
  const DELETE = /(cosmeticUnlock|coinEvent|itemGrant)\s*\.\s*delete(Many)?\s*\(|DELETE\s+FROM\s+"?(CosmeticUnlock|CoinEvent|ItemGrant)\b/i;
  const hits = [...files(path.join(root, 'src')), ...files(path.join(root, 'scripts'))]
    .filter((f) => !allowed.has(f) && DELETE.test(fs.readFileSync(f, 'utf8')));
  expect(hits).toEqual([]);
});

it('only the coin history updates a coin event (to mark it seen)', () => {
  const root = path.join(__dirname, '../..');
  const hits = files(path.join(root, 'src')).filter((f) => /coinEvent\s*\.\s*update(Many)?\s*\(/.test(fs.readFileSync(f, 'utf8')));
  expect(hits.map((f) => path.relative(root, f)).filter((f) => f !== 'src/coins/history.ts')).toEqual([]);
});

it('account deletion owns every room and coin table', () => {
  expect(USER_OWNED_MODELS).toEqual(expect.arrayContaining(['CosmeticUnlock', 'CosmeticLoadout', 'RoomFirstWeek', 'CoinEvent', 'CoinWallet', 'ItemGrant']));
});
```

In `backend/tests/users/ownedData.ts`, after the `roomFirstWeek` seed:

```ts
  await prisma.coinEvent.create({ data: { userId, kind: 'checkin', sourceKey: `checkin:${uniq}`, amount: 5, capDay: day } });
  await prisma.coinWallet.create({ data: { userId, balance: 5 } });
  await prisma.itemGrant.create({ data: { userId, itemId: 'plant.fern', qty: 1, sourceKey: `buy:${uniq}` } });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins/ledger.test.ts tests/cosmetics/neverRemoved.test.ts`
Expected: FAIL (no `coins/ledger.ts`; no coin models).

- [ ] **Step 3: The models and the migration**

In `backend/prisma/schema.prisma`, add to `User` after `roomFirstWeek`:

```prisma
  coinEvents            CoinEvent[]
  coinWallet            CoinWallet?
  itemGrants            ItemGrant[]
```

and after `RoomFirstWeek`:

```prisma
/// One coin event (spec 2026-10-15 §6.3): an earn (+), a 0-coin earn at the daily cap, or a spend (−). Append-only:
/// never updated except `seenAt`, never deleted outside account deletion and the fixture purge.
model CoinEvent {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// 'sleep_goal' | 'steps' | 'checkin' | 'recap' | 'cheer_given' | 'cheer_got' | 'challenge' | 'firstweek' | 'buy' | 'expand'
  kind      String
  /// The source record it pays for (or the app's request id for a spend), unique per user: a replay writes nothing.
  sourceKey String
  /// + earned, − spent, 0 when the daily cap had nothing left.
  amount    Int
  /// The civil day it counts against the cap; null for uncapped kinds and spends.
  capDay    DateTime? @db.Date
  createdAt DateTime  @default(now())
  seenAt    DateTime?

  @@unique([userId, sourceKey])
  @@index([userId, createdAt])
}

/// A user's coin balance, the running sum of their CoinEvent amounts (a CHECK constraint keeps it >= 0).
model CoinWallet {
  userId  String @id
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  balance Int    @default(0)
}

/// Copies of a piece beyond the starters and unlock rows (spec §2.2): +1 bought (P2); gifts and prizes come in P4.
model ItemGrant {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemId    String
  qty       Int
  /// 'buy:{requestId}' (P2); 'gift_out:', 'gift_in:', 'gift_back:' and 'prize:' come in P4.
  sourceKey String
  createdAt DateTime  @default(now())
  /// A bought copy is NEW until seen (plan ruling 7).
  seenAt    DateTime?

  @@unique([userId, sourceKey])
  @@index([userId, itemId])
}
```

Create `backend/prisma/migrations/20261017130000_coins/migration.sql`:

```sql
-- KIP coins (spec 2026-10-15 §6.3) and extra copies of pieces (§2.2).
CREATE TABLE "CoinEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "capDay" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "CoinEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinWallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoinWallet_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "CoinWallet_balance_nonnegative" CHECK ("balance" >= 0)
);

CREATE TABLE "ItemGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "ItemGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinEvent_userId_sourceKey_key" ON "CoinEvent"("userId", "sourceKey");
CREATE INDEX "CoinEvent_userId_createdAt_idx" ON "CoinEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "ItemGrant_userId_sourceKey_key" ON "ItemGrant"("userId", "sourceKey");
CREATE INDEX "ItemGrant_userId_itemId_idx" ON "ItemGrant"("userId", "itemId");

ALTER TABLE "CoinEvent" ADD CONSTRAINT "CoinEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemGrant" ADD CONSTRAINT "ItemGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Then `DATABASE_URL=postgresql://x@localhost/x npx prisma generate`. In `backend/src/users/deletion.ts`, add
`'CoinEvent', 'CoinWallet', 'ItemGrant',` to `USER_OWNED_MODELS` right after `'RoomFirstWeek',`.

- [ ] **Step 4: The ledger, `backend/src/coins/ledger.ts`**

```ts
// The KIP coin ledger (spec 2026-10-15 §6.3). One function writes every earned coin, under the user's one lock (plan
// ruling 5), append-only: it drops events whose source key is already written BEFORE trimming, so a replay never uses
// up cap room a new event needs; trims capped kinds in a fixed order (kind, then key) to what is left of their cap
// day's 60; writes a 0-coin row (already seen) when nothing is left, so the key is used up and the event still counts;
// pays at most 5 cheers a day, given and received together; and adds what it wrote to the wallet. Spends (buy,
// expand) run inside the caller's locked transaction. Logs kinds and counts only, never a user id, a key or an amount.
import type { Prisma } from '@prisma/client';
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { lockRoom } from '../room/lock';

export const DAILY_CAP = 60;
export const PAID_CHEERS_A_DAY = 5;
export const CAPPED_KINDS = ['sleep_goal', 'steps', 'checkin', 'recap', 'cheer_given', 'cheer_got'] as const;
export const EARN_KINDS = [...CAPPED_KINDS, 'challenge', 'firstweek'] as const;
export type CappedKind = (typeof CAPPED_KINDS)[number];
export type EarnKind = (typeof EARN_KINDS)[number];
export type SpendKind = 'buy' | 'expand';
export type CoinKind = EarnKind | SpendKind;

/** One earn. capDay is the source's own civil date ('YYYY-MM-DD') for a capped kind, null for an uncapped one. */
export interface CoinEarn { kind: EarnKind; sourceKey: string; amount: number; capDay: string | null }
export interface CoinWritten { kind: EarnKind; amount: number }
/** What each cap day has used: coins over the capped kinds, and the cheers that paid. */
export type DayUse = Map<string, { coins: number; paidCheers: number }>;

const CAPPED: ReadonlySet<string> = new Set(CAPPED_KINDS);
const CHEERS: ReadonlySet<string> = new Set(['cheer_given', 'cheer_got']);
export const isCapped = (kind: string): kind is CappedKind => CAPPED.has(kind);
const byKindThenKey = (a: CoinEarn, b: CoinEarn) =>
  (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0);

/** The amounts new earns get (pure). `used` is updated as they are planned. */
export function planCapped(fresh: readonly CoinEarn[], used: DayUse): CoinEarn[] {
  return [...fresh].sort(byKindThenKey).map((e) => {
    if (!isCapped(e.kind) || e.capDay === null) return e;
    const day = used.get(e.capDay) ?? { coins: 0, paidCheers: 0 };
    const cheer = CHEERS.has(e.kind);
    const left = Math.max(0, DAILY_CAP - day.coins);
    const amount = cheer && day.paidCheers >= PAID_CHEERS_A_DAY ? 0 : Math.max(0, Math.min(e.amount, left));
    used.set(e.capDay, { coins: day.coins + amount, paidCheers: day.paidCheers + (cheer && amount > 0 ? 1 : 0) });
    return { ...e, amount };
  });
}

async function writeEarns(tx: Prisma.TransactionClient, userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  const unique = [...new Map(events.map((e) => [e.sourceKey, e])).values()];
  const have = await tx.coinEvent.findMany({ where: { userId, sourceKey: { in: unique.map((e) => e.sourceKey) } }, select: { sourceKey: true } });
  const known = new Set(have.map((r) => r.sourceKey));
  const fresh = unique.filter((e) => !known.has(e.sourceKey));
  if (!fresh.length) return [];
  const days = [...new Set(fresh.filter((e) => isCapped(e.kind) && e.capDay !== null).map((e) => e.capDay!))];
  const used: DayUse = new Map();
  if (days.length) {
    const rows = await tx.coinEvent.findMany({
      where: { userId, kind: { in: [...CAPPED_KINDS] }, capDay: { in: days.map(civilDateToUtcMidnight) } },
      select: { kind: true, amount: true, capDay: true },
    });
    for (const r of rows) {
      const day = r.capDay!.toISOString().slice(0, 10);
      const u = used.get(day) ?? { coins: 0, paidCheers: 0 };
      used.set(day, { coins: u.coins + r.amount, paidCheers: u.paidCheers + (CHEERS.has(r.kind) && r.amount > 0 ? 1 : 0) });
    }
  }
  const created = await tx.coinEvent.createManyAndReturn({
    data: planCapped(fresh, used).map((e) => ({
      userId, kind: e.kind, sourceKey: e.sourceKey, amount: e.amount,
      capDay: e.capDay === null ? null : civilDateToUtcMidnight(e.capDay),
      // Nothing to land (plan ruling 6): a 0-coin row is seen from the start.
      seenAt: e.amount === 0 ? now : null,
    })),
    skipDuplicates: true,
    select: { kind: true, amount: true },
  });
  const total = created.reduce((n, r) => n + r.amount, 0);
  await tx.coinWallet.upsert({ where: { userId }, create: { userId, balance: total }, update: { balance: { increment: total } } });
  return created.map((r) => ({ kind: r.kind as EarnKind, amount: r.amount }));
}

/** Writes the earns this user has not been paid for yet; answers only what this call wrote. */
export async function applyCoinEvents(userId: string, events: readonly CoinEarn[], now: Date): Promise<CoinWritten[]> {
  if (!events.length) return [];
  const written = await prisma.$transaction(async (tx) => {
    await lockRoom(tx, userId);
    return writeEarns(tx, userId, events, now);
  });
  const counts = new Map<string, number>();
  for (const w of written) counts.set(w.kind, (counts.get(w.kind) ?? 0) + 1);
  for (const [kind, count] of counts) console.info(JSON.stringify({ event: 'coins.earned', kind, count }));
  return written;
}

export type Spent = { ok: true; balance: number } | { ok: false; needed: number };

/** A spend inside the caller's locked transaction: the balance first, then the row (seen) and the wallet. */
export async function spendInTx(tx: Prisma.TransactionClient, userId: string, kind: SpendKind, sourceKey: string, price: number, now: Date): Promise<Spent> {
  const have = await balanceOf(tx, userId);
  if (have < price) return { ok: false, needed: price - have };
  await tx.coinEvent.create({ data: { userId, kind, sourceKey, amount: -price, capDay: null, seenAt: now } });
  const wallet = await tx.coinWallet.update({ where: { userId }, data: { balance: { decrement: price } }, select: { balance: true } });
  return { ok: true, balance: wallet.balance };
}

export async function balanceOf(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<number> {
  return (await db.coinWallet.findUnique({ where: { userId }, select: { balance: true } }))?.balance ?? 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins tests/cosmetics/neverRemoved.test.ts tests/users`
Expected: PASS (the deletion tests now see a row in each new table and empty it). Then `schema-drift.sh`: `no drift`.

- [ ] **Step 6: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0).

```bash
git add backend/prisma backend/src/coins/ledger.ts backend/src/users/deletion.ts backend/tests/coins backend/tests/users/ownedData.ts backend/tests/cosmetics/neverRemoved.test.ts
git commit -m "feat(backend): an append-only coin ledger with a 60-a-day cap, five paid cheers a day, guarded spends and account deletion"
```

---

### Task 4: Backend: the earn sources (`earnCoins`): sleep goal, step goal, on-time check-in, weekly recap

Spec §6.2 (sources, amounts, keys and cap days; only measured data pays; no backpay before the user's local date of
`COINS_LAUNCHED_AT`; no health values in the ledger), §6.3 (`earnCoins` reads the last 8 civil days and the week's
recap; a failure is logged without values and never fails the triggering request) and §16 (the cap day per source in a
non-UTC zone; no backpay; a revised night keeps its coins). Rulings 1, 27.

**Files:**
- Create: `backend/src/coins/sources.ts`, `backend/tests/coins/sources.test.ts`

**Interfaces:**
- Consumes: Task 3's `applyCoinEvents`, `CoinEarn`; `loadRecapData` (`recap/data.ts`), `changeInEffect` and
  `goalChangesOf` (`achievements/goalHistory.ts`), `resolveSleepGoalMinutes`, `habitDayForOrUtc`,
  `localCivilDateOrUtc`, `civilDateToUtcMidnight`, `dateRange`, `shiftDate`.
- Produces (`backend/src/coins/sources.ts`):
  - `coinsConfig: { launchedAt: Date }` (OWNER NOTE: `2026-10-20T00:00:00.000Z`, or `COINS_LAUNCHED_AT` on a dev
    server; tests move it);
  - `EARN_AMOUNTS = { sleep_goal: 20, steps: 15, checkin: 5, recap: 10, cheer: 2, challenge: 30 }`, `LOOKBACK_DAYS = 8`;
  - `interface EarnInputs { launchDay: string; sleepGoalNights: readonly string[]; stepGoalDays: readonly string[]; onTimeCheckIns: readonly string[]; weekRecapOpens: ReadonlyArray<{ id: string; day: string }> }`;
  - `planEarns(inp: EarnInputs): CoinEarn[]` (pure);
  - `loadEarnInputs(userId: string, now: Date, launchedAt?: Date): Promise<EarnInputs | null>`;
  - `earnCoins(userId: string, now: Date, opts?: { launchedAt?: Date }): Promise<number>` (rows written);
  - `coinsHooks: { earn(userId: string, now: Date): Promise<unknown> }` and `earnCoinsSafely(userId, now): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/sources.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { coinsConfig, coinsHooks, earnCoins, earnCoinsSafely, loadEarnInputs, planEarns } from '../../src/coins/sources';
import { day, weekRecaps } from '../cosmetics/helpers';
import { balance, coinUser, rowsOf } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const LAUNCH = new Date('2026-10-01T00:00:00.000Z');
// 2026-11-11 09:30 in Auckland (NZDT, +13): today and the habit day are 2026-11-11; the 8 days run from 2026-11-04.
const NOW = new Date('2026-11-10T20:30:00.000Z');

/** An Auckland user's week: three nights in the window, one outside; a goal eased to 7 h on 2026-11-08. */
async function seededWeek() {
  const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
  const sleep = (d: string, minutes: number) => prisma.biometricRecord.create({ data: { userId: user.id, metricType: 'SLEEP', value: minutes, recordedAt: day(d) } });
  await sleep('2026-11-11', 480);
  await sleep('2026-11-10', 400); // below the 420 in effect
  await sleep('2026-11-09', 430); // at or above 420, below the stored 480: the goal in effect counts (ruling 27)
  await sleep('2026-11-03', 600); // before the 8 days
  await prisma.goalChange.create({ data: { userId: user.id, kind: 'SLEEP_MINUTES', sleepMinutes: 420, effectiveOn: day('2026-11-08'), resetsStreak: true } });
  await prisma.stepGoalEvent.create({ data: { authorId: user.id, localDate: day('2026-11-09') } });
  await prisma.stepGoalEvent.create({ data: { authorId: user.id, localDate: day('2026-11-02') } });
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day('2026-11-10'), onTime: true } });
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day('2026-11-09'), onTime: false } }); // late: never pays
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 60 * 60 * 1000)); // opened 08:30 local, 2026-11-11
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 60 * 60 * 1000), 'MONTH', 5); // a month: never pays
  await weekRecaps(user.id, 1, new Date(NOW.getTime() - 10 * 86_400_000), 'WEEK', 9); // opened 10 days ago
  return user;
}

it('plans each source with its key and its own civil date as the cap day, and nothing before the launch day (spec §6.2)', () => {
  const earns = planEarns({
    launchDay: '2026-11-10',
    sleepGoalNights: ['2026-11-09', '2026-11-11'], stepGoalDays: ['2026-11-10'], onTimeCheckIns: ['2026-11-10'],
    weekRecapOpens: [{ id: 'r1', day: '2026-11-11' }],
  });
  expect(earns).toEqual([
    { kind: 'sleep_goal', sourceKey: 'sleep_goal:2026-11-11', amount: 20, capDay: '2026-11-11' },
    { kind: 'steps', sourceKey: 'steps:2026-11-10', amount: 15, capDay: '2026-11-10' },
    { kind: 'checkin', sourceKey: 'checkin:2026-11-10', amount: 5, capDay: '2026-11-10' },
    { kind: 'recap', sourceKey: 'recap:r1', amount: 10, capDay: '2026-11-11' },
  ]);
});

it('reads the last 8 local days in the user\'s zone: goal nights by the goal in effect, step days, on-time check-ins, week recaps opened (Review Focus 2)', async () => {
  const user = await seededWeek();
  const recap = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'WEEK', openedAt: { gte: new Date(NOW.getTime() - 2 * 60 * 60 * 1000) } } });
  expect(await loadEarnInputs(user.id, NOW, LAUNCH)).toEqual({
    launchDay: '2026-10-01',
    sleepGoalNights: ['2026-11-09', '2026-11-11'],
    stepGoalDays: ['2026-11-09'],
    onTimeCheckIns: ['2026-11-10'],
    weekRecapOpens: [{ id: recap.id, day: '2026-11-11' }],
  });
});

it('pays every source once, keeps a revised night\'s coins, and stores no health value (spec §6.1, §6.2)', async () => {
  const user = await seededWeek();
  expect(await earnCoins(user.id, NOW, { launchedAt: LAUNCH })).toBe(5);
  expect(await balance(user.id)).toBe(70); // 20 + 20 + 15 + 5 + 10
  expect(await earnCoins(user.id, NOW, { launchedAt: LAUNCH })).toBe(0);
  await prisma.biometricRecord.updateMany({ where: { userId: user.id, metricType: 'SLEEP', recordedAt: day('2026-11-11') }, data: { value: 300 } });
  expect([await earnCoins(user.id, NOW, { launchedAt: LAUNCH }), await balance(user.id)]).toEqual([0, 70]);
  const rows = await rowsOf(user.id);
  expect(rows.map((r) => r.sourceKey).sort()).toEqual(expect.arrayContaining(['checkin:2026-11-10', 'sleep_goal:2026-11-09', 'sleep_goal:2026-11-11', 'steps:2026-11-09']));
  expect(JSON.stringify(rows)).not.toMatch(/480|430|"minutes"|"steps":/);
});

it('pays nothing dated before the user\'s local launch day, not even a 0 row (spec §6.2 no backpay)', async () => {
  const user = await seededWeek();
  // 2026-11-10 00:00 UTC is 13:00 on 2026-11-10 in Auckland: the launch day is 2026-11-10.
  await earnCoins(user.id, NOW, { launchedAt: new Date('2026-11-10T00:00:00.000Z') });
  const keys = (await rowsOf(user.id)).map((r) => r.sourceKey);
  expect(keys.some((k) => k.endsWith('2026-11-09'))).toBe(false);
  expect(await balance(user.id)).toBe(35); // the 11-11 night, the 11-10 check-in, the 11-11 recap
});

it('uses coinsConfig.launchedAt by default, and a failed earn is logged without values and never throws', async () => {
  const user = await seededWeek();
  const before = coinsConfig.launchedAt;
  coinsConfig.launchedAt = new Date('2030-01-01T00:00:00.000Z');
  try {
    expect(await earnCoins(user.id, NOW)).toBe(0);
  } finally {
    coinsConfig.launchedAt = before;
  }
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const spy = jest.spyOn(coinsHooks, 'earn').mockRejectedValue(new TypeError('boom'));
  await expect(earnCoinsSafely(user.id, NOW)).resolves.toBeUndefined();
  expect(warn.mock.calls.map((c) => JSON.parse(String(c[0])))).toEqual([{ event: 'coins.earn_failed', error: 'TypeError' }]);
  spy.mockRestore();
  warn.mockRestore();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins/sources.test.ts`
Expected: FAIL (no `coins/sources.ts`).

- [ ] **Step 3: `backend/src/coins/sources.ts`**

```ts
// KIP coins from healthy days (spec 2026-10-15 §6.2): each source, its amount, its key and its cap day, built from the
// records the app already keeps and written by the ledger. Only measured data pays (sleep and steps come from the
// health sync); the check-in is the one self-reported source. No backpay: a source dated before the user's local date
// of the coins launch writes nothing. An event stores a kind, a key, an amount and a civil date, never a health value.
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../biometrics/civilDate';
import { changeInEffect, goalChangesOf, type GoalChangeRow } from '../achievements/goalHistory';
import { prisma } from '../db/client';
import { habitDayForOrUtc } from '../habits/habitDay';
import { loadRecapData } from '../recap/data';
import { dateRange, shiftDate } from '../scoring/dates';
import { resolveSleepGoalMinutes } from '../users/goals';
import { applyCoinEvents, type CoinEarn } from './ledger';

/** OWNER NOTE (plan ruling 1): the instant P2 reaches users, set at merge. A dev server may move it with the
 * COINS_LAUNCHED_AT environment variable (an ISO instant); tests move it directly. */
const launchFromEnv = process.env.COINS_LAUNCHED_AT ? new Date(process.env.COINS_LAUNCHED_AT) : null;
export const coinsConfig: { launchedAt: Date } = {
  launchedAt: launchFromEnv && !Number.isNaN(launchFromEnv.getTime()) ? launchFromEnv : new Date('2026-10-20T00:00:00.000Z'),
};
/** C8's amounts, accepted at spec review (§0). Cheers and the challenge entry are written by P4. */
export const EARN_AMOUNTS = { sleep_goal: 20, steps: 15, checkin: 5, recap: 10, cheer: 2, challenge: 30 } as const;
/** Each run reads this many civil days back (spec §6.3), so a night synced late still pays. */
export const LOOKBACK_DAYS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const key = (d: Date) => d.toISOString().slice(0, 10);

export interface EarnInputs {
  /** The user's local civil date of the coins launch: nothing dated before it pays. */
  launchDay: string;
  /** Wake dates whose SLEEP rollup met the goal in effect that night. */
  sleepGoalNights: readonly string[];
  /** Local dates with a StepGoalEvent. */
  stepGoalDays: readonly string[];
  /** Habit days with an on-time check-in (the one the CHECK_IN badge counts). */
  onTimeCheckIns: readonly string[];
  /** WEEK recaps opened, with the open's local date. */
  weekRecapOpens: ReadonlyArray<{ id: string; day: string }>;
}

export function planEarns(inp: EarnInputs): CoinEarn[] {
  const paid = (d: string) => d >= inp.launchDay;
  return [
    ...inp.sleepGoalNights.filter(paid).map((d): CoinEarn => ({ kind: 'sleep_goal', sourceKey: `sleep_goal:${d}`, amount: EARN_AMOUNTS.sleep_goal, capDay: d })),
    ...inp.stepGoalDays.filter(paid).map((d): CoinEarn => ({ kind: 'steps', sourceKey: `steps:${d}`, amount: EARN_AMOUNTS.steps, capDay: d })),
    ...inp.onTimeCheckIns.filter(paid).map((d): CoinEarn => ({ kind: 'checkin', sourceKey: `checkin:${d}`, amount: EARN_AMOUNTS.checkin, capDay: d })),
    ...inp.weekRecapOpens.filter((r) => paid(r.day)).map((r): CoinEarn => ({ kind: 'recap', sourceKey: `recap:${r.id}`, amount: EARN_AMOUNTS.recap, capDay: r.day })),
  ];
}

/** The source records of the last LOOKBACK_DAYS local days; null for an unknown user. */
export async function loadEarnInputs(userId: string, now: Date, launchedAt: Date = coinsConfig.launchedAt): Promise<EarnInputs | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, sleepGoalMinutes: true } });
  if (!user) return null;
  const tz = user.timezone;
  const today = localCivilDateOrUtc(now, tz);
  const from = shiftDate(today, -(LOOKBACK_DAYS - 1));
  const habitFrom = shiftDate(habitDayForOrUtc(now, tz), -(LOOKBACK_DAYS - 1));
  const [data, changes, steps, checkIns, recaps] = await Promise.all([
    loadRecapData(userId, tz, from, today, { bedtimes: false }),
    prisma.goalChange.findMany({ where: { userId, kind: 'SLEEP_MINUTES' } }),
    prisma.stepGoalEvent.findMany({ where: { authorId: userId, localDate: { gte: civilDateToUtcMidnight(from) } }, select: { localDate: true } }),
    prisma.habitCheckIn.findMany({ where: { userId, onTime: true, habitDay: { gte: civilDateToUtcMidnight(habitFrom) } }, select: { habitDay: true } }),
    prisma.recap.findMany({
      where: { userId, kind: 'WEEK', openedAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS) } },
      select: { id: true, openedAt: true },
    }),
  ]);
  const rows: GoalChangeRow[] = changes.map((c) => ({
    kind: c.kind, sleepMinutes: c.sleepMinutes, bedtime: c.bedtime, effectiveOn: key(c.effectiveOn), resetsStreak: c.resetsStreak,
  }));
  const sleepChanges = goalChangesOf(rows, 'SLEEP_MINUTES');
  const stored = resolveSleepGoalMinutes(user.sleepGoalMinutes);
  // The SLEEP_GOAL badge's own marker per night (ruling 27): the goal in effect that night, else the stored goal.
  const sleepGoalNights = dateRange(from, today).filter((d) => {
    const minutes = data.get(d)?.sleepMinutes;
    return minutes !== undefined && minutes > 0 && minutes >= (changeInEffect(sleepChanges, d)?.sleepMinutes ?? stored);
  });
  return {
    launchDay: localCivilDateOrUtc(launchedAt, tz),
    sleepGoalNights,
    stepGoalDays: steps.map((s) => key(s.localDate)).sort(),
    onTimeCheckIns: checkIns.map((c) => key(c.habitDay)).sort(),
    weekRecapOpens: recaps.filter((r) => r.openedAt).map((r) => ({ id: r.id, day: localCivilDateOrUtc(r.openedAt!, tz) })),
  };
}

/** Pays every source of the last 8 days not paid yet (idempotent). Answers the number of rows written. */
export async function earnCoins(userId: string, now: Date, opts: { launchedAt?: Date } = {}): Promise<number> {
  const launchedAt = opts.launchedAt ?? coinsConfig.launchedAt;
  const inputs = await loadEarnInputs(userId, now, launchedAt);
  if (!inputs) return 0;
  return (await applyCoinEvents(userId, planEarns(inputs), now)).length;
}

/** The earn the hooks call; tests swap it to prove a failure never fails the request that triggered it. */
export const coinsHooks: { earn: (userId: string, now: Date) => Promise<unknown> } = {
  earn: (userId, now) => earnCoins(userId, now),
};

/** Never throws: a failed earn is logged with its error class only, and the next GET /me/coins catches up. */
export async function earnCoinsSafely(userId: string, now: Date): Promise<void> {
  try {
    await coinsHooks.earn(userId, now);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'coins.earn_failed', error: err instanceof Error ? err.name : 'Error' }));
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins`
Expected: PASS.

- [ ] **Step 5: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0).

```bash
git add backend/src/coins/sources.ts backend/tests/coins/sources.test.ts
git commit -m "feat(backend): earn coins from goal nights, step goals, on-time check-ins and weekly recaps, by each source's local date, with no backpay"
```

---

### Task 5: Backend: the coin routes (`GET /me/coins`, `POST /me/coins/seen`) and the earn hooks

Spec §6.3 (the hooks: the sync worker after SLEEP rollups, `recordStepGoal` when it returns true, the habit check-in
route, the recap-opened route; `GET /me/coins` as the catch-up; history in cursor pages of 30), §6.2 (only a WEEK
recap pays; "Earned today" sums today's cap day, today being `todayFor`'s civil date), §12 P2 (`GET /me/coins?cursor=`
→ `{ balance, today: { earned, cap }, events: [{ kind, amount, at, seen }], next }`; `POST /me/coins/seen { through }`
→ 204; private, no-store, 32 KB, `400 invalid_body`), §13 (the recap hook on MONTH opens) and §16. Rulings 26, 32,
35.

**Files:**
- Create: `backend/src/coins/history.ts`, `backend/src/coins/routes.ts`, `backend/tests/coins/routes.test.ts`,
  `backend/tests/coins/hooks.test.ts`
- Modify: `backend/src/app.ts`, `backend/src/habits/routes.ts`, `backend/src/recap/routes.ts`,
  `backend/src/sync/worker.ts`, `backend/tests/sync/worker.test.ts`

**Interfaces:**
- Consumes: Task 3's `CAPPED_KINDS`, `DAILY_CAP`, `balanceOf`, `CoinKind`, `applyCoinEvents`; Task 4's
  `earnCoinsSafely`, `coinsHooks`, `coinsConfig`, `earnCoins`; `todayFor` (`social/checkins.ts`); P1's
  `saveBodyParser`.
- Produces:
  - `backend/src/coins/history.ts`: `HISTORY_PAGE = 30`, `interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }`,
    `interface CoinsDTO { balance: number; today: { earned: number; cap: number }; events: CoinEventDTO[]; next: string | null }`,
    `encodeCursor(at: Date, id: string): string`, `decodeCursor(raw: string): { at: Date; id: string } | null`,
    `readCoins(userId, now, cursor?): Promise<CoinsDTO>`, `markCoinsSeen(userId, body, now): Promise<boolean>`;
  - `backend/src/coins/routes.ts`: `coinsRouter` with `GET /me/coins`, `POST /me/coins/seen` (Tasks 6 and 8 add to it);
  - `app.ts` mounts the 32 KB parser on `POST /me/coins/seen`, `/me/shop/purchases` and `/me/room/expand`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/routes.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { applyCoinEvents } from '../../src/coins/ledger';
import { coinsConfig } from '../../src/coins/sources';
import { weekRecaps } from '../cosmetics/helpers';
import { coinUser, earn } from './helpers';

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

const get = async (headers: Record<string, string>, query = '') => (await api()).get(`/me/coins${query}`).set(headers);
const seen = async (headers: Record<string, string>, body: unknown) => (await api()).post('/me/coins/seen').set(headers).send(body as object);

describe('GET /me/coins (spec §12)', () => {
  it('a new user: no coins, nothing earned today of 60, no events, private no-store', async () => {
    const { headers } = await coinUser();
    const res = await get(headers);
    expect([res.status, res.headers['cache-control'], res.body]).toEqual([200, 'private, no-store', { balance: 0, today: { earned: 0, cap: 60 }, events: [], next: null }]);
  });

  it('catches up first: a weekly recap read today lands as +10, unseen, in today\'s local total (Review Focus 2)', async () => {
    const { user, headers } = await coinUser({ timezone: 'Pacific/Auckland' });
    await weekRecaps(user.id, 1, new Date());
    expect((await get(headers)).body).toEqual({ balance: 10, today: { earned: 10, cap: 60 }, events: [{ kind: 'recap', amount: 10, at: expect.any(String), seen: false }], next: null });
  });

  it('pages newest first, 30 at a time, with an opaque cursor; a bad cursor is 400 invalid_body', async () => {
    const { user, headers } = await coinUser();
    for (let k = 0; k < 31; k++) await applyCoinEvents(user.id, [earn('firstweek', `test:${k}`, 1)], new Date());
    const first = (await get(headers)).body;
    expect([first.events.length, typeof first.next]).toEqual([30, 'string']);
    const second = (await get(headers, `?cursor=${encodeURIComponent(first.next)}`)).body;
    expect([second.events.length, second.next, second.balance]).toEqual([1, null, 31]);
    const ats = [...first.events, ...second.events].map((e: { at: string }) => e.at);
    expect([...ats].sort().reverse()).toEqual(ats);
    expect((await get(headers, '?cursor=%21%21')).body).toEqual({ error: 'invalid_body' });
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/coins')).status).toBe(401);
  });
});

describe('POST /me/coins/seen (spec §12)', () => {
  it('marks every event up to `through` seen, and refuses a bad body', async () => {
    const { user, headers } = await coinUser();
    await weekRecaps(user.id, 1, new Date());
    const at = (await get(headers)).body.events[0].at;
    expect((await seen(headers, { through: at })).status).toBe(204);
    expect((await get(headers)).body.events[0].seen).toBe(true);
    for (const bad of [{}, { through: 'yesterday' }, { through: at, more: 1 }, []]) {
      expect((await seen(headers, bad)).body).toEqual({ error: 'invalid_body' });
    }
  });

  it('caps its body at 32 KB with the house error (ruling 26)', async () => {
    const { headers } = await coinUser();
    const res = await (await api()).post('/me/coins/seen').set(headers).set('Content-Type', 'application/json')
      .send(JSON.stringify({ through: new Date().toISOString() }) + ' '.repeat(40 * 1024));
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });
});
```

Create `backend/tests/coins/hooks.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { cosmeticsHooks } from '../../src/cosmetics/unlock';
import { coinsConfig, coinsHooks, earnCoins } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { day, weekRecaps } from '../cosmetics/helpers';
import { balance, coinUser, rowsOf } from './helpers';

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

it('an on-time check-in pays its 5 coins at once (spec §6.3 hooks)', async () => {
  const { user, headers } = await coinUser();
  expect((await (await api()).post('/me/habits/check-ins').set(headers).send({})).status).toBe(201);
  expect((await rowsOf(user.id)).filter((r) => r.kind === 'checkin').map((r) => r.amount)).toEqual([5]);
});

it('a failing earn never fails the check-in', async () => {
  const { headers } = await coinUser();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const spy = jest.spyOn(coinsHooks, 'earn').mockRejectedValue(new Error('down'));
  try {
    expect((await (await api()).post('/me/habits/check-ins').set(headers).send({})).status).toBe(201);
  } finally {
    spy.mockRestore();
    warn.mockRestore();
  }
});

it('opening a WEEK recap pays 10 and runs the cosmetics grant; a MONTH open runs neither (spec §6.2, §13, ruling 32)', async () => {
  const { user, headers } = await coinUser();
  const grant = jest.spyOn(cosmeticsHooks, 'grant');
  try {
    await weekRecaps(user.id, 1, null);
    await weekRecaps(user.id, 1, null, 'MONTH', 3);
    const week = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'WEEK' } });
    const month = await prisma.recap.findFirstOrThrow({ where: { userId: user.id, kind: 'MONTH' } });
    expect((await (await api()).post(`/me/recaps/${month.id}/opened`).set(headers)).status).toBe(204);
    expect([grant.mock.calls.length, await balance(user.id)]).toEqual([0, 0]);
    expect((await (await api()).post(`/me/recaps/${week.id}/opened`).set(headers)).status).toBe(204);
    expect([grant.mock.calls.length, (await rowsOf(user.id)).map((r) => [r.kind, r.sourceKey, r.amount])]).toEqual([1, [['recap', `recap:${week.id}`, 10]]]);
  } finally {
    grant.mockRestore();
  }
});

it('a GET catch-up racing two direct earns pays the check-in once (Review Focus 1)', async () => {
  const { user, headers } = await coinUser();
  await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(habitDayFor(new Date(), 'UTC')), onTime: true } });
  await Promise.all([(await api()).get('/me/coins').set(headers), earnCoins(user.id, new Date()), earnCoins(user.id, new Date())]);
  expect([(await rowsOf(user.id)).filter((r) => r.kind === 'checkin').length, await balance(user.id)]).toEqual([1, 5]);
});
```

In `backend/tests/sync/worker.test.ts`, add the imports
`import { coinsHooks } from '../../src/coins/sources';` and `import { STEPS_GOAL } from '../../src/coach/tools/metrics';`,
and this block at the end of `describe('processSyncJob', …)`:

```ts
  describe('coins (free-build spec §6.3)', () => {
    it('asks for a catch-up after every SLEEP sync and backfill, and after a STEPS sync only when the goal was newly reached', async () => {
      const earn = jest.spyOn(coinsHooks, 'earn').mockResolvedValue(0);
      try {
        const user = await createConnectedUser();
        await processSyncJob({ name: 'fetch', data: { userId: user.id, metricType: 'SLEEP', date: '2026-09-02' } } as Job);
        expect(earn).toHaveBeenCalledTimes(1);
        const today = localCivilDate(new Date(), 'UTC');
        (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([{ recordedAt: new Date(`${today}T00:00:00Z`), value: STEPS_GOAL }]);
        const steps = { name: 'fetch', data: { userId: user.id, metricType: 'STEPS', date: today } } as Job;
        await processSyncJob(steps);
        expect(earn).toHaveBeenCalledTimes(2);
        await processSyncJob(steps); // already recorded today: no new goal, no new earn
        expect(earn).toHaveBeenCalledTimes(2);
        (healthClient.fetchMetricRange as jest.Mock).mockResolvedValue([]);
        await processSyncJob({ name: 'backfill', data: { userId: user.id, startDate: '2026-08-25', endDate: '2026-09-05' } } as Job);
        expect(earn).toHaveBeenCalledTimes(3);
        expect(earn.mock.calls.every(([id]) => id === user.id)).toBe(true);
      } finally {
        earn.mockRestore();
      }
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins/routes.test.ts tests/coins/hooks.test.ts tests/sync/worker.test.ts`
Expected: FAIL (404 on `/me/coins`; no hooks).

- [ ] **Step 3: `backend/src/coins/history.ts`**

```ts
// Coin history (spec 2026-10-15 §6.7, §12): the balance, today's capped total against the cap (today is the user's
// civil date, not the 04:00 habit boundary), and the events newest first in cursor pages of 30, each a kind, an amount,
// a time and whether it was seen (ruling 35). Marking seen is the only update a coin event ever gets.
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { todayFor } from '../social/checkins';
import { CAPPED_KINDS, DAILY_CAP, balanceOf, type CoinKind } from './ledger';

export const HISTORY_PAGE = 30;
export interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }
export interface CoinsDTO { balance: number; today: { earned: number; cap: number }; events: CoinEventDTO[]; next: string | null }

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): { at: Date; id: string } | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw)) return null;
  const [iso, id, extra] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (extra !== undefined || !iso || !id) return null;
  const at = new Date(iso);
  return !Number.isNaN(at.getTime()) && at.toISOString() === iso ? { at, id } : null;
}

export async function readCoins(userId: string, now: Date, cursor?: string): Promise<CoinsDTO> {
  const after = cursor ? decodeCursor(cursor) : null;
  const { today } = await todayFor(userId, now);
  const [balance, earned, rows] = await Promise.all([
    balanceOf(prisma, userId),
    prisma.coinEvent.aggregate({ where: { userId, kind: { in: [...CAPPED_KINDS] }, capDay: civilDateToUtcMidnight(today) }, _sum: { amount: true } }),
    prisma.coinEvent.findMany({
      where: { userId, ...(after ? { OR: [{ createdAt: { lt: after.at } }, { createdAt: after.at, id: { lt: after.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_PAGE + 1,
      select: { id: true, kind: true, amount: true, createdAt: true, seenAt: true },
    }),
  ]);
  const page = rows.slice(0, HISTORY_PAGE);
  const last = page[page.length - 1];
  return {
    balance,
    today: { earned: earned._sum.amount ?? 0, cap: DAILY_CAP },
    events: page.map((r) => ({ kind: r.kind as CoinKind, amount: r.amount, at: r.createdAt.toISOString(), seen: r.seenAt !== null })),
    next: rows.length > HISTORY_PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** `{ through }`, an ISO instant: every event up to it is seen. False for any other body. */
export async function markCoinsSeen(userId: string, body: unknown, now: Date): Promise<boolean> {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).join(',') !== 'through' || typeof b.through !== 'string') return false;
  const through = new Date(b.through);
  if (Number.isNaN(through.getTime()) || through.toISOString() !== b.through) return false;
  await prisma.coinEvent.updateMany({ where: { userId, seenAt: null, createdAt: { lte: through } }, data: { seenAt: now } });
  return true;
}
```

- [ ] **Step 4: `backend/src/coins/routes.ts` and the app**

```ts
// KIP coin endpoints (spec 2026-10-15 §12 P2): the wallet and its history and marking coins seen; Task 6 adds the shop
// and purchases, Task 8 the first-week list. All need a session and answer private, no-store; nothing is logged with
// the user's id.
import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../auth/middleware';
import { decodeCursor, markCoinsSeen, readCoins } from './history';
import { earnCoinsSafely } from './sources';

export const coinsRouter = Router();
export const noStore = (res: Response) => res.set('Cache-Control', 'private, no-store');

coinsRouter.get('/me/coins', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const cursor = req.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || !decodeCursor(cursor))) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const now = new Date();
  // The catch-up (spec §6.3): a missed hook pays on the next look. Later pages only read.
  if (cursor === undefined) await earnCoinsSafely(req.userId!, now);
  res.json(await readCoins(req.userId!, now, cursor));
});

coinsRouter.post('/me/coins/seen', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  if (!(await markCoinsSeen(req.userId!, req.body, new Date()))) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  res.status(204).end();
});
```

In `backend/src/app.ts`: `import { coinsRouter } from './coins/routes';`; under the existing
`app.put('/me/cosmetics', saveBodyParser);` add

```ts
  // P2's posts take the same 32 KB parser (plan ruling 26).
  app.post(['/me/coins/seen', '/me/shop/purchases', '/me/room/expand'], saveBodyParser);
```

and `app.use(coinsRouter);` after `app.use(cosmeticsRouter);`.

- [ ] **Step 5: The hooks**

`backend/src/habits/routes.ts` (import `earnCoinsSafely` from `'../coins/sources'`), after
`await clearAchievementsMarker(userId);`:

```ts
  // An on-time check-in pays at once (spec §6.3); a failure is logged and the next GET /me/coins catches up.
  await earnCoinsSafely(userId, new Date());
```

`backend/src/recap/routes.ts` (import `earnCoinsSafely`), the last two lines of the opened route become:

```ts
  // Only the open that set openedAt, and only a WEEK recap (spec §6.2, §13): it can raise the recaps-read counter and
  // it pays the weekly recap's coins. A MONTH open does neither (plan ruling 32).
  if (count === 1 && row.kind === 'WEEK') {
    const now = new Date();
    await grantCosmeticsSafely(req.userId!, now);
    await earnCoinsSafely(req.userId!, now);
  }
  res.status(204).end();
```

`backend/src/sync/worker.ts` (import `earnCoinsSafely` from `'../coins/sources'`). In `handleFetchJob`, the SLEEP
branch becomes

```ts
    if (data.metricType === 'SLEEP') {
      await requestScores(data.userId, await syncSleep(session, data.userId, data.date, end));
      // The rollups are stored: a goal night pays now (spec §6.3).
      await earnCoinsSafely(data.userId, new Date());
    } else {
```

and its STEPS block becomes

```ts
      if (data.metricType === 'STEPS') {
        // Social timeline event; a failure never fails the sync (logged with ids only). A goal newly reached pays.
        const reached = await recordStepGoal(data.userId, points, new Date()).catch((err: unknown) => {
          console.error(JSON.stringify({ event: 'social.step_goal_failed', userId: data.userId, error: err instanceof Error ? err.name : 'unknown' }));
          return false;
        });
        if (reached) await earnCoinsSafely(data.userId, new Date());
      }
```

In `syncWindow`, after the metric loop and before `await requestScores(userId, scoreDates);`:

```ts
    // Sleep and steps for the whole window are stored: one catch-up pays whatever they earned (spec §6.3).
    await earnCoinsSafely(userId, new Date());
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins tests/sync/worker.test.ts tests/recap/routes.test.ts tests/habits/routes.test.ts`
Expected: PASS.

- [ ] **Step 7: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0).

```bash
git add backend/src/coins backend/src/app.ts backend/src/habits/routes.ts backend/src/recap/routes.ts backend/src/sync/worker.ts backend/tests/coins backend/tests/sync/worker.test.ts
git commit -m "feat(backend): the coin wallet and history routes, and earn hooks on sleep syncs, step goals, check-ins and weekly recap opens"
```

---

### Task 6: Backend: counts with `ItemGrant`, the shop (`GET /me/shop`) and purchases (`POST /me/shop/purchases`)

Spec §2.2 (`owned = starter + unlock grants + ItemGrant sums`; the read-time backstop), §6.4–§6.6 (prices in the
catalogue; unlock rules still grant free; coins buy shop pieces, the week's pieces and extra copies; a rule piece is
never sold before it is earned; the weekly set by the user's local ISO week; purchases are never optimistic and land
with a NEW tag), §12 P2 (`GET /me/shop`; `POST /me/shop/purchases { requestId, itemId }` → 200 `{ balance, counts }`,
400 `not_for_sale`, 409 `not_enough_coins` with `{ needed }`, a repeated `requestId` returns the first answer) and
§16 (spends can't go negative; a repeated `requestId`). Rulings 2–5, 7, 31, 34.

**Files:**
- Create: `backend/src/coins/shopWeeks.ts`, `backend/src/coins/shop.ts`, `backend/tests/coins/shop.test.ts`
- Modify: `backend/src/room/layout.ts`, `backend/src/cosmetics/loadout.ts`, `backend/src/coins/routes.ts`,
  `backend/tests/room/read.test.ts`

**Interfaces:**
- Consumes: Task 3's `spendInTx`, `balanceOf`; Task 5's `coinsRouter`, `noStore`; P1's `lockRoom`; `isoWeekKey`
  (`habits/job.ts`), `todayFor`; Task 2's `price` / `shop` / `{ kind: 'shop' }`.
- Produces:
  - `backend/src/room/layout.ts`: `countsOf(rows, grants?: ReadonlyArray<{ itemId: string; qty: number }>)` and
    `grantTotals(db, userId): Promise<Array<{ itemId: string; qty: number }>>`; read-time trimming drops the newest
    copies first (ruling 31);
  - `backend/src/coins/shopWeeks.ts`: `interface ShopWeekSet { id: string; itemIds: readonly string[] }`,
    `SHOP_WEEKS`, `weekSet(week: string): ShopWeekSet`;
  - `backend/src/coins/shop.ts`: `interface ShopOffer { itemId: string; price: number }`,
    `interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: ShopOffer[] }`,
    `offeredIn(week, items?)`, `forSale(itemId, week, counts, items?)`, `shopWeek(userId, now)`,
    `readShop(userId, now)`, `parsePurchase(body)`, `type PurchaseResult`, `buyPiece(userId, body, now)`;
  - GET `/me/cosmetics`: `counts` include bought copies, `owned` is every item with a count, `fresh` adds unseen
    grants as `{ itemId, source: 'buy' }`; `POST /me/cosmetics/seen` marks grants seen too.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/shop.test.ts`:

```ts
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { COSMETIC_ITEMS, EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { forSale, offeredIn } from '../../src/coins/shop';
import { coinsConfig } from '../../src/coins/sources';
import { SHOP_WEEKS, weekSet } from '../../src/coins/shopWeeks';
import { isoWeekKey } from '../../src/habits/job';
import { todayFor } from '../../src/social/checkins';
import { day, level } from '../cosmetics/helpers';
import { piece, withPieces } from '../room/helpers';
import { coinUser, fund, rowsOf } from './helpers';

// Nothing earns in these tests (a first placement would pay its +10 once the real launch date has passed).
const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2100-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

const W = '2026-W44';
const buy = async (headers: Record<string, string>, itemId: string, requestId: string = randomUUID()) =>
  (await api()).post('/me/shop/purchases').set(headers).send({ requestId, itemId });
const cosmetics = async (headers: Record<string, string>) => (await (await api()).get('/me/cosmetics').set(headers)).body;

describe('the offer (spec §6.4–6.6)', () => {
  it('offers shipped, priced pieces every week, and a weekly piece only in its own week (ruling 4)', () => {
    const radio = COSMETIC_ITEMS.find((i) => i.id === 'item.radio')!;
    const items = [...COSMETIC_ITEMS, { ...radio, id: 'item.weekly', shop: { week: '2026-W43' } }];
    expect(offeredIn('2026-W43', items).map((o) => o.itemId)).toContain('item.weekly');
    expect(offeredIn(W, items).map((o) => o.itemId)).not.toContain('item.weekly');
    const ids = offeredIn(W).map((o) => o.itemId);
    expect(ids).toEqual(expect.arrayContaining(['item.radio', 'plant.fern', 'corner.floorlamp']));
    expect(ids.filter((id) => ['desk.monitor', 'lamp.welcome', 'lamp.lava'].includes(id))).toEqual([]);
  });

  it('sells a rule piece only once it is owned; shop and starter pieces always; never a desk (spec §6.5)', () => {
    expect(forSale('plant.monstera', W, {})).toBeNull();
    expect(forSale('plant.monstera', W, { 'plant.monstera': 1 })).toEqual({ itemId: 'plant.monstera', price: 140 });
    expect(forSale('item.radio', W, {})).toEqual({ itemId: 'item.radio', price: 150 });
    expect(forSale('plant.fern', W, { 'plant.fern': 1 })).toEqual({ itemId: 'plant.fern', price: 40 });
    expect(forSale('desk.monitor', W, { 'desk.monitor': 1 })).toBeNull();
  });

  it('turns the featured set every Monday over four sets of offered pieces', () => {
    expect(new Set(['2026-W43', '2026-W44', '2026-W45', '2026-W46'].map((w) => weekSet(w).id)).size).toBe(4);
    expect(weekSet('2026-W47')).toEqual(weekSet('2026-W43'));
    const offered = new Set(offeredIn(W).map((o) => o.itemId));
    for (const s of SHOP_WEEKS) for (const id of s.itemIds) expect({ id, offered: offered.has(id) }).toEqual({ id, offered: true });
  });
});

describe('GET /me/shop (spec §12)', () => {
  it('answers the user\'s local ISO week, its featured set and the offer, private no-store', async () => {
    const { user, headers } = await coinUser({ timezone: 'Pacific/Auckland' });
    const res = await (await api()).get('/me/shop').set(headers);
    const week = isoWeekKey(day((await todayFor(user.id, new Date())).today));
    expect([res.status, res.headers['cache-control'], res.body.week, res.body.set]).toEqual([200, 'private, no-store', week, { id: weekSet(week).id, itemIds: [...weekSet(week).itemIds] }]);
    expect(res.body.items).toEqual(expect.arrayContaining([{ itemId: 'item.radio', price: 150 }, { itemId: 'plant.fern', price: 40 }]));
  });
});

describe('POST /me/shop/purchases (spec §12)', () => {
  it('buys a copy: −150, already seen; +1 radio, owned, NEW in fresh until seen; the room can place it (ruling 7)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 200);
    const res = await buy(headers, 'item.radio');
    expect([res.status, res.headers['cache-control'], res.body.balance, res.body.counts['item.radio']]).toEqual([200, 'private, no-store', 50, 1]);
    const body = await cosmetics(headers);
    expect([body.counts['item.radio'], body.owned.includes('item.radio'), body.fresh]).toEqual([1, true, [{ itemId: 'item.radio', source: 'buy' }]]);
    const spend = (await rowsOf(user.id)).find((r) => r.kind === 'buy')!;
    expect([spend.amount, spend.capDay, spend.seenAt instanceof Date]).toEqual([-150, null, true]);
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'item.radio', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
    expect((await (await api()).post('/me/cosmetics/seen').set(headers).send({ itemIds: ['item.radio'] })).status).toBe(204);
    expect((await cosmetics(headers)).fresh).toEqual([]);
  });

  it('a starter\'s extra copy: after buying a fern, two ferns save', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 40);
    expect((await buy(headers, 'plant.fern')).body).toEqual({ balance: 0, counts: expect.objectContaining({ 'plant.fern': 2 }) });
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'plant.fern', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
  });

  it('a repeated or concurrent request id buys once and answers the first result (Review Focus 3)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 200);
    const id = randomUUID();
    const [a, b] = await Promise.all([buy(headers, 'item.radio', id), buy(headers, 'item.radio', id)]);
    const again = await buy(headers, 'item.radio', id);
    expect([a.status, b.status, again.status, a.body.balance, b.body.balance, again.body.balance]).toEqual([200, 200, 200, 50, 50, 50]);
    expect(await prisma.itemGrant.count({ where: { userId: user.id } })).toBe(1);
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'buy')).toHaveLength(1);
  });

  it('409 not_enough_coins with what is still needed, and nothing is written', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 100);
    const res = await buy(headers, 'item.radio');
    expect([res.status, res.body]).toEqual([409, { error: 'not_enough_coins', needed: 50 }]);
    expect(await prisma.itemGrant.count({ where: { userId: user.id } })).toBe(0);
  });

  it('400 not_for_sale for an unknown, unpriced or unshipped piece, or a rule piece not earned yet; sold once earned', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 1000);
    for (const id of ['item.nope', 'desk.monitor', 'lamp.lava', 'plant.monstera']) {
      expect([id, (await buy(headers, id)).body]).toEqual([id, { error: 'not_for_sale' }]);
    }
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000)); // the monstera's rule
    await cosmetics(headers); // the grant catches up
    expect((await buy(headers, 'plant.monstera')).body.counts['plant.monstera']).toBe(2);
  });

  it('400 invalid_body for a bad shape, and logs the spend\'s kind only', async () => {
    const { user, headers } = await coinUser();
    for (const body of [{ itemId: 'item.radio' }, { requestId: 'x', itemId: 'item.radio' }, { requestId: randomUUID(), itemId: 'item.radio', more: 1 }]) {
      expect((await (await api()).post('/me/shop/purchases').set(headers).send(body)).body).toEqual({ error: 'invalid_body' });
    }
    await fund(user.id, 30);
    await buy(headers, 'corner.pumpkin');
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('coins.spent'));
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'coins.spent', kind: 'buy' }]);
    expect(lines.join('')).not.toContain(user.id);
  });

  it('needs a session', async () => {
    expect((await (await api()).post('/me/shop/purchases').send({})).status).toBe(401);
    expect((await (await api()).get('/me/shop')).status).toBe(401);
  });
});
```

In `backend/tests/room/read.test.ts`, add to the `describe`:

```ts
  it('drops the newest copies first: p10 goes before p9 (ruling 31, P1 Task 4 minor)', async () => {
    const { user, headers } = await me();
    await stored(user.id, { ...starterLayout(), pieces: [...starterLayout().pieces, piece('p9', 'plant.cactus', { x: 6, y: 6 }), piece('p10', 'plant.cactus', { x: 5, y: 6 })] });
    const ids = (await get(headers)).layout.pieces.map((p: { id: string }) => p.id);
    expect([ids.includes('p9'), ids.includes('p10')]).toEqual([true, false]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins/shop.test.ts tests/room/read.test.ts`
Expected: FAIL (no shop modules or routes; `p9` is dropped before `p10`).

- [ ] **Step 3: Counts with grants, `backend/src/room/layout.ts`**

Add `import type { Prisma } from '@prisma/client';` and `import { prisma } from '../db/client';`, then:

```ts
/**
 * owned(item) = starter 1 + an unlock row's `grants ?? 1` + the item's ItemGrant sum (spec §2.2). Shipped items only;
 * an item whose count comes to 0 is left out.
 */
export function countsOf(rows: ReadonlyArray<{ itemId: string }>, grants: ReadonlyArray<{ itemId: string; qty: number }> = []): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of STARTER_IDS) counts[id] = 1;
  for (const { itemId } of rows) {
    const item = shippedItem(itemId);
    if (item && item.unlock.kind !== 'starter') counts[itemId] = (counts[itemId] ?? 0) + (item.grants ?? 1);
  }
  for (const { itemId, qty } of grants) {
    if (!shippedItem(itemId)) continue;
    const n = (counts[itemId] ?? 0) + qty;
    if (n > 0) counts[itemId] = n;
    else delete counts[itemId];
  }
  return counts;
}

/** Each item's ItemGrant sum for a user (bought copies in P2). */
export async function grantTotals(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<Array<{ itemId: string; qty: number }>> {
  const rows = await db.itemGrant.groupBy({ by: ['itemId'], where: { userId }, _sum: { qty: true } });
  return rows.map((r) => ({ itemId: r.itemId, qty: r._sum.qty ?? 0 }));
}
```

and in `trimOver`, the sort becomes `[...list].sort(newestFirst)` with, above the function:

```ts
/** The newest copies first (ruling 31): app ids are p1, p2, … so a longer id is newer (p10 after p9), then lexical. */
const newestFirst = (a: Placement, b: Placement) => b.id.length - a.id.length || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
```

- [ ] **Step 4: `backend/src/cosmetics/loadout.ts`**

Import `grantTotals` with `countsOf` from `'../room/layout'`. In `readCosmetics`:

```ts
  const [rows, loadout, facts, firstWeek, grants, newCopies] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: [{ unlockedAt: 'asc' }, { itemId: 'asc' }], select: { itemId: true, source: true, seenAt: true } }),
    prisma.cosmeticLoadout.findUnique({ where: { userId } }),
    loadUnlockFacts(userId),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { welcomedAt: true } }),
    grantTotals(prisma, userId),
    prisma.itemGrant.findMany({ where: { userId, seenAt: null, qty: { gt: 0 } }, orderBy: { createdAt: 'asc' }, select: { itemId: true, sourceKey: true } }),
  ]);
  const counts = countsOf(rows, grants);
  // Owned is a count now (spec §2.2): every item with one.
  const owned = new Set(Object.keys(counts));
```

and `fresh` becomes

```ts
    fresh: [
      ...rows.filter((r) => r.seenAt === null && owned.has(r.itemId)).map((r) => ({ itemId: r.itemId, source: r.source })),
      // A bought copy is NEW until seen (ruling 7): its source is the key's prefix, 'buy'.
      ...newCopies.filter((g) => owned.has(g.itemId)).map((g) => ({ itemId: g.itemId, source: g.sourceKey.split(':')[0]! })),
    ],
```

(`const owned = ownedFrom(rows);` and the old `const counts = countsOf(rows);` go; `ownedFrom` stays exported for the
conversion script.) In `saveCosmetics`, the transaction's reads become

```ts
      const [rows, row, grants] = await Promise.all([
        tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
        tx.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, version: true, tier: true } }),
        grantTotals(tx, userId),
      ]);
      tier = toTier(row?.tier);
      const bad = checkLayout(parsed.layout, parsed.worn, tier, countsOf(rows, grants));
```

and `markSeen` also marks bought copies:

```ts
  if (itemIds.length) {
    const ids = itemIds as string[];
    await prisma.cosmeticUnlock.updateMany({ where: { userId, itemId: { in: ids }, seenAt: null }, data: { seenAt: now } });
    await prisma.itemGrant.updateMany({ where: { userId, itemId: { in: ids }, seenAt: null }, data: { seenAt: now } });
  }
```

- [ ] **Step 5: The shop, `backend/src/coins/shopWeeks.ts` and `backend/src/coins/shop.ts`**

```ts
// The coin shop's featured set (spec 2026-10-15 §6.6, plan ruling 4): four sets of always-on pieces, one a week,
// turning every Monday by the user's local ISO week. No bundle price: each piece is bought on its own.
export interface ShopWeekSet { id: string; itemIds: readonly string[] }

export const SHOP_WEEKS: readonly ShopWeekSet[] = [
  { id: 'cosyAutumn', itemIds: ['corner.pumpkin', 'item.candle', 'lamp.amber', 'rug.slate', 'plant.fern'] },
  { id: 'greenCorner', itemIds: ['plant.fern', 'plant.cactus', 'plant.monstera', 'plant.snake', 'corner.gnome'] },
  { id: 'deskDay', itemIds: ['item.radio', 'item.mug', 'item.sticky', 'shelf.books', 'shelf.plank'] },
  { id: 'brightNight', itemIds: ['art.neonheart', 'corner.cone', 'item.candle', 'shelf.minicactus', 'corner.floorlamp'] },
];

/** '2026-W43' → that week's set: (ISO year × 53 + week) mod 4, so each Monday moves one set on. */
export function weekSet(week: string): ShopWeekSet {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  const n = m ? Number(m[1]) * 53 + Number(m[2]) : 0;
  return SHOP_WEEKS[n % SHOP_WEEKS.length]!;
}
```

```ts
// The coin shop (spec 2026-10-15 §6.4–6.6). A piece is for sale when it is shipped, priced and offered this week
// (always, or in its own ISO week), and, for a piece with an unlock rule, once you own it (§6.5: a rule piece is never
// sold before it is earned). A purchase runs under the user's one lock (plan ruling 5): the replay check, the sale
// check, the spend, then the +1 grant, all keyed by the app's request id, so a retry answers as the first did.
import { civilDateToUtcMidnight } from '../biometrics/civilDate';
import { COSMETIC_ITEMS, isShipped, type CosmeticItem } from '../cosmetics/catalogue';
import { prisma } from '../db/client';
import { isoWeekKey } from '../habits/job';
import { countsOf, grantTotals } from '../room/layout';
import { lockRoom } from '../room/lock';
import { todayFor } from '../social/checkins';
import { balanceOf, spendInTx } from './ledger';
import { weekSet } from './shopWeeks';

export interface ShopOffer { itemId: string; price: number }
export interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: ShopOffer[] }

export function offeredIn(week: string, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer[] {
  return items
    .filter((i) => isShipped(i) && !!i.iso && i.price !== undefined && (i.shop === 'always' || (typeof i.shop === 'object' && i.shop.week === week)))
    .map((i) => ({ itemId: i.id, price: i.price! }));
}

export function forSale(itemId: string, week: string, counts: Readonly<Record<string, number>>, items: readonly CosmeticItem[] = COSMETIC_ITEMS): ShopOffer | null {
  const offer = offeredIn(week, items).find((o) => o.itemId === itemId);
  const item = items.find((i) => i.id === itemId);
  if (!offer || !item) return null;
  const anyone = item.unlock.kind === 'shop' || item.unlock.kind === 'starter';
  return anyone || (counts[itemId] ?? 0) > 0 ? offer : null;
}

/** The user's local ISO week ('2026-W43'). */
export async function shopWeek(userId: string, now: Date): Promise<string> {
  const { today } = await todayFor(userId, now);
  return isoWeekKey(civilDateToUtcMidnight(today));
}

export async function readShop(userId: string, now: Date): Promise<ShopDTO> {
  const week = await shopWeek(userId, now);
  const items = offeredIn(week);
  const offered = new Set(items.map((i) => i.itemId));
  const set = weekSet(week);
  return { week, set: { id: set.id, itemIds: set.itemIds.filter((id) => offered.has(id)) }, items };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePurchase(body: unknown): { requestId: string; itemId: string } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'itemId,requestId') return null;
  if (typeof b.requestId !== 'string' || !UUID.test(b.requestId)) return null;
  if (typeof b.itemId !== 'string' || b.itemId.length === 0 || b.itemId.length > 64) return null;
  return { requestId: b.requestId, itemId: b.itemId };
}

type Refused =
  | { ok: false; status: 400; body: { error: 'invalid_body' | 'not_for_sale' } }
  | { ok: false; status: 409; body: { error: 'not_enough_coins'; needed: number } };
export type PurchaseResult = { ok: true; body: { balance: number; counts: Record<string, number> } } | Refused;

export async function buyPiece(userId: string, body: unknown, now: Date): Promise<PurchaseResult> {
  const parsed = parsePurchase(body);
  if (!parsed) return { ok: false, status: 400, body: { error: 'invalid_body' } };
  const sourceKey = `buy:${parsed.requestId}`;
  const week = await shopWeek(userId, now);
  const outcome = await prisma.$transaction(async (tx): Promise<'bought' | 'replay' | Refused> => {
    await lockRoom(tx, userId);
    // A retried request answers as the first did (spec §12).
    if (await tx.coinEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey } }, select: { id: true } })) return 'replay';
    const [rows, grants] = await Promise.all([tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }), grantTotals(tx, userId)]);
    const offer = forSale(parsed.itemId, week, countsOf(rows, grants));
    if (!offer) return { ok: false, status: 400, body: { error: 'not_for_sale' } };
    const paid = await spendInTx(tx, userId, 'buy', sourceKey, offer.price, now);
    if (!paid.ok) return { ok: false, status: 409, body: { error: 'not_enough_coins', needed: paid.needed } };
    await tx.itemGrant.create({ data: { userId, itemId: parsed.itemId, qty: 1, sourceKey } });
    return 'bought';
  });
  if (typeof outcome !== 'string') return outcome;
  if (outcome === 'bought') console.info(JSON.stringify({ event: 'coins.spent', kind: 'buy' }));
  const [rows, grants, balance] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
    grantTotals(prisma, userId),
    balanceOf(prisma, userId),
  ]);
  return { ok: true, body: { balance, counts: countsOf(rows, grants) } };
}
```

In `backend/src/coins/routes.ts` (import `buyPiece`, `readShop` from `'./shop'`):

```ts
coinsRouter.get('/me/shop', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  res.json(await readShop(req.userId!, new Date()));
});

coinsRouter.post('/me/shop/purchases', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const result = await buyPiece(req.userId!, req.body, new Date());
  if (!result.ok) {
    res.status(result.status).json(result.body);
    return;
  }
  res.json(result.body);
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins tests/room tests/cosmetics`
Expected: PASS.

- [ ] **Step 7: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0).

```bash
git add backend/src/coins backend/src/room/layout.ts backend/src/cosmetics/loadout.ts backend/tests/coins/shop.test.ts backend/tests/room/read.test.ts
git commit -m "feat(backend): the coin shop with a weekly featured set, keyed purchases of extra copies, and bought copies in counts and fresh"
```

---

### Task 7: Backend: growing the room (`POST /me/room/expand`) and the tier gates in the app's catalogue

Spec §7 (both gates always; the streak gate is CHECK_IN level II and the loft's SLEEP_GOAL level III, never
re-locking; one row each side, nothing moves; the loft's window stores the wall pieces it covers; expand upserts the
row with the starter layout if there was none and always increments `version`, a first row at version 1; it returns the
full cosmetics body; a tier never goes down), §12 P2 (`POST /me/room/expand { requestId, toTier }` → 200 with the full
`GET /me/cosmetics` body plus `balance`; 409 `gate` with `{ coinsNeeded, badgeNeeded }`; 409 `stale_tier`), §12
Concurrency (save, gift and grow share the lock) and §16 (expansion; first week and expand). Rulings 5, 17, 18, 37.

**Files:**
- Create: `backend/src/room/tiers.ts`, `backend/src/room/expand.ts`, `backend/tests/room/expand.test.ts`
- Modify: `backend/src/cosmetics/routes.ts`, `backend/src/cosmetics/export.ts`, `backend/tests/cosmetics/export.test.ts`
- Modify (generated): `mobile/src/lib/room/catalogue.json`
- Modify (mobile): `mobile/src/lib/room/catalogue.ts`, `mobile/__tests__/lib/roomCatalogue.test.ts`

**Interfaces:**
- Consumes: Task 3's `spendInTx`, `balanceOf`; P1's `lockRoom`, `checkPiece`, `parseLayout`, `geometryDeps`,
  `toTier`, `starterLayout`, `readCosmetics`; `evaluateAchievements(userId, now, families)`; `familyDef`.
- Produces:
  - `backend/src/room/tiers.ts`: `TIER_GATES: Readonly<Record<2 | 3, { price: number; family: AchievementFamily; level: number }>>`
    (`2: { price: 600, family: 'CHECK_IN', level: 2 }`, `3: { price: 1500, family: 'SLEEP_GOAL', level: 3 }`);
  - `backend/src/room/expand.ts`: `parseExpand(body)`, `coveredBy(layout, tier, deps): Set<string>`,
    `type ExpandFailure`, `type ExpandBody = CosmeticsDTO & { balance: number; stored: number }`,
    `expandRoom(userId, body, now): Promise<{ ok: true; body: ExpandBody } | { ok: false; failure: ExpandFailure }>`;
  - route `POST /me/room/expand`; log lines `coins.spent { kind: 'expand' }` and `room.expanded { tier }`;
  - the export's `tierGates: Record<'2' | '3', { price: number; family: string; level: number; threshold: number }>`
    and the app's `CATALOGUE.tierGates` of the same shape.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/room/expand.test.ts`:

```ts
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { coinsConfig } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { starterLayout } from '../../src/room/convert';
import { shiftDate } from '../../src/scoring/dates';
import { day, level } from '../cosmetics/helpers';
import { coinUser, fund, rowsOf } from '../coins/helpers';
import { piece } from './helpers';

// Nothing earns in these tests (a first placement would pay its +10 once the real launch date has passed).
const LAUNCH = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = new Date('2100-01-01T00:00:00.000Z');
});
afterAll(async () => {
  coinsConfig.launchedAt = LAUNCH;
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

const grow = async (headers: Record<string, string>, toTier: number, requestId: string = randomUUID()) =>
  (await api()).post('/me/room/expand').set(headers).send({ requestId, toTier });
const save = async (headers: Record<string, string>, layout: unknown, version: number) =>
  (await api()).put('/me/cosmetics').set(headers).send({ layout, worn: { ...EMPTY_WORN }, version });
const SOON = () => new Date(Date.now() - 1000);

describe('POST /me/room/expand (spec §7, §12)', () => {
  it('needs both gates: no coins and no badge, coins alone, a badge alone each answer 409 gate with what is missing', async () => {
    const a = await coinUser();
    expect([(await grow(a.headers, 2)).status, (await grow(a.headers, 2)).body]).toEqual([409, { error: 'gate', coinsNeeded: 600, badgeNeeded: true }]);
    await fund(a.user.id, 600);
    expect((await grow(a.headers, 2)).body).toEqual({ error: 'gate', coinsNeeded: 0, badgeNeeded: true });
    const b = await coinUser();
    await level(b.user.id, 'CHECK_IN', 2, SOON());
    expect((await grow(b.headers, 2)).body).toEqual({ error: 'gate', coinsNeeded: 600, badgeNeeded: false });
  });

  it('with both, grows to 8 × 8: spends 600 (seen), creates the row at version 1, answers the GET body with the balance and stored 0', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 650);
    await level(user.id, 'CHECK_IN', 2, SOON()); // a stored level; no check-in run at all: it never re-locks
    const res = await grow(headers, 2);
    expect([res.status, res.headers['cache-control'], res.body.tier, res.body.cap, res.body.version, res.body.balance, res.body.stored, res.body.layout])
      .toEqual([200, 'private, no-store', 2, 60, 1, 50, 0, starterLayout()]);
    expect(res.body).toEqual(expect.objectContaining({ counts: expect.any(Object), worn: { ...EMPTY_WORN }, welcomed: false }));
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'expand').map((r) => [r.amount, r.seenAt instanceof Date])).toEqual([[-600, true]]);
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('room.expanded'));
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'room.expanded', tier: 2 }]);
    expect(lines.join('')).not.toContain(user.id);
  });

  it('a repeated request id answers the grown room again without spending twice', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 650);
    await level(user.id, 'CHECK_IN', 2, SOON());
    const id = randomUUID();
    await grow(headers, 2, id);
    const again = await grow(headers, 2, id);
    expect([again.status, again.body.tier, again.body.balance, again.body.stored]).toEqual([200, 2, 50, 0]);
    expect((await rowsOf(user.id)).filter((r) => r.kind === 'expand')).toHaveLength(1);
  });

  it('409 stale_tier for anything but the next size; a save never changes the size', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 2100);
    await level(user.id, 'CHECK_IN', 2, SOON());
    await level(user.id, 'SLEEP_GOAL', 3, SOON());
    expect((await grow(headers, 3)).body).toEqual({ error: 'stale_tier' });
    expect((await grow(headers, 2)).status).toBe(200);
    expect((await grow(headers, 2)).body).toEqual({ error: 'stale_tier' });
    const put = await save(headers, starterLayout(), 1);
    expect([put.status, put.body.tier]).toEqual([200, 2]);
  });

  it('to the loft: stores the wall pieces the new window covers, with what stands on them, and bumps the version (Review Focus 4)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 2100);
    await level(user.id, 'CHECK_IN', 2, SOON());
    await level(user.id, 'SLEEP_GOAL', 3, SOON());
    expect((await grow(headers, 2)).body.version).toBe(1);
    // The plank (with its books) moved to right-wall half-tile 12, where the loft's window will be; the calendar at 0.
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces.map((p) => (p.id === 'plank' ? { ...p, x: 12 } : p)), piece('cal', 'art.calendar', { layer: 'wallR', x: 0, y: 9 })] };
    expect((await save(headers, layout, 1)).status).toBe(200);
    const res = await grow(headers, 3);
    expect([res.status, res.body.tier, res.body.cap, res.body.version, res.body.stored, res.body.balance]).toEqual([200, 3, 90, 3, 2, 0]);
    const ids = res.body.layout.pieces.map((p: { id: string }) => p.id);
    expect([ids.includes('plank'), ids.includes('shelf'), ids.includes('cal')]).toEqual([false, false, true]);
    expect([res.body.counts['shelf.plank'], res.body.counts['shelf.books']]).toEqual([1, 1]); // back in the inventory
  });

  it('evaluates the badge family first: a 14-day run reached since the last badge load opens the gate (ruling 18)', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 600);
    const today = habitDayFor(new Date(), 'UTC');
    await prisma.user.update({ where: { id: user.id }, data: { achievementsSince: day(shiftDate(today, -20)) } });
    for (let k = 1; k <= 14; k++) await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(shiftDate(today, -k)), onTime: true } });
    expect((await grow(headers, 2)).status).toBe(200);
  });

  it('a save and a grow at once never interleave: a save that lost the race answers 409 stale', async () => {
    const { user, headers } = await coinUser();
    await fund(user.id, 600);
    await level(user.id, 'CHECK_IN', 2, SOON());
    expect((await save(headers, starterLayout(), 0)).status).toBe(200);
    const [put, g] = await Promise.all([save(headers, starterLayout(), 1), grow(headers, 2)]);
    expect(g.status).toBe(200);
    expect([200, 409]).toContain(put.status);
    const row = (await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } }))!;
    expect([row.tier, row.version]).toEqual([2, put.status === 200 ? 3 : 2]);
  });

  it('400 invalid_body for a bad shape, and needs a session', async () => {
    const { headers } = await coinUser();
    for (const body of [{ toTier: 2 }, { requestId: 'x', toTier: 2 }, { requestId: randomUUID(), toTier: 4 }, { requestId: randomUUID(), toTier: 2, more: 1 }]) {
      expect((await (await api()).post('/me/room/expand').set(headers).send(body)).body).toEqual({ error: 'invalid_body' });
    }
    expect((await (await api()).post('/me/room/expand').send({})).status).toBe(401);
  });
});
```

In `backend/tests/cosmetics/export.test.ts`, add:

```ts
it('carries the tier gates with their badge thresholds (plan ruling 37)', () => {
  expect(exportCatalogue().tierGates).toEqual({
    2: { price: 600, family: 'CHECK_IN', level: 2, threshold: 14 },
    3: { price: 1500, family: 'SLEEP_GOAL', level: 3, threshold: 14 },
  });
});
```

In `mobile/__tests__/lib/roomCatalogue.test.ts`, add:

```ts
it('carries the room sizes\' gates from the server (plan ruling 37)', () => {
  expect(CATALOGUE.tierGates).toEqual({
    2: { price: 600, family: 'CHECK_IN', level: 2, threshold: 14 },
    3: { price: 1500, family: 'SLEEP_GOAL', level: 3, threshold: 14 },
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/room/expand.test.ts tests/cosmetics/export.test.ts`
Expected: FAIL (404 on the route; no `tierGates`).

- [ ] **Step 3: `backend/src/room/tiers.ts` and `backend/src/room/expand.ts`**

```ts
// The room sizes' gates (spec 2026-10-15 §7, C2, C8): coins AND a badge level, always both. A level is never revoked,
// so a broken streak after it costs nothing (C2's grace days). The export copies these to the app (ruling 37).
import type { AchievementFamily } from '@prisma/client';

export const TIER_GATES: Readonly<Record<2 | 3, { price: number; family: AchievementFamily; level: number }>> = {
  2: { price: 600, family: 'CHECK_IN', level: 2 },
  3: { price: 1500, family: 'SLEEP_GOAL', level: 3 },
};
```

```ts
// Growing KIP's room (spec 2026-10-15 §7, §12): one size at a time, both gates always, under the user's one lock (plan
// ruling 5), so a save, a purchase and a grow never interleave. A size adds a tile row on each side, so every piece
// keeps its tile; the loft's right-wall window may cover wall pieces an 8 × 8 room used, and those (with what stands on
// them) go to the inventory (§3.2). A first row is created at version 1, otherwise the version always bumps.
import { Prisma } from '@prisma/client';
import { evaluateAchievements } from '../achievements/evaluate';
import { balanceOf, spendInTx } from '../coins/ledger';
import { EMPTY_WORN } from '../cosmetics/catalogue';
import { readCosmetics, type CosmeticsDTO } from '../cosmetics/loadout';
import { prisma } from '../db/client';
import { starterLayout } from './convert';
import { checkPiece, parseLayout, type GeometryDeps, type RoomLayout, type Tier } from './geometry';
import { geometryDeps, toTier } from './layout';
import { lockRoom } from './lock';
import { TIER_GATES } from './tiers';

export type ExpandError = { error: 'invalid_body' } | { error: 'stale_tier' } | { error: 'gate'; coinsNeeded: number; badgeNeeded: boolean };
export interface ExpandFailure { status: 400 | 409; body: ExpandError }
/** The full GET /me/cosmetics body, the balance after, and how many pieces the new window sent to the inventory. */
export type ExpandBody = CosmeticsDTO & { balance: number; stored: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseExpand(body: unknown): { requestId: string; toTier: 2 | 3 } | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!b || Object.keys(b).sort().join(',') !== 'requestId,toTier') return null;
  if (typeof b.requestId !== 'string' || !UUID.test(b.requestId) || (b.toTier !== 2 && b.toTier !== 3)) return null;
  return { requestId: b.requestId, toTier: b.toTier };
}

/** The wall pieces a size's windows cover, and what stands on them (spec §7). */
export function coveredBy(layout: RoomLayout, tier: Tier, deps: GeometryDeps): Set<string> {
  const gone = new Set(layout.pieces
    .filter((p) => (p.layer === 'wallL' || p.layer === 'wallR') && checkPiece(layout, p, tier, deps)?.reason === 'window')
    .map((p) => p.id));
  for (const p of layout.pieces) if (p.layer === 'onTop' && p.parent && gone.has(p.parent)) gone.add(p.id);
  return gone;
}

export async function expandRoom(userId: string, body: unknown, now: Date): Promise<{ ok: true; body: ExpandBody } | { ok: false; failure: ExpandFailure }> {
  const parsed = parseExpand(body);
  if (!parsed) return { ok: false, failure: { status: 400, body: { error: 'invalid_body' } } };
  const gate = TIER_GATES[parsed.toTier];
  // A level reached since the last badge load counts (ruling 18). Idempotent; a failure leaves the stored levels.
  await evaluateAchievements(userId, now, [gate.family]).catch(() => null);
  const sourceKey = `expand:${parsed.requestId}`;
  const outcome = await prisma.$transaction(async (tx): Promise<{ stored: number; grew: boolean } | ExpandFailure> => {
    await lockRoom(tx, userId);
    // A retried request answers as the first did (spec §12); it sends nothing more to the inventory (ruling 17).
    if (await tx.coinEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey } }, select: { id: true } })) return { stored: 0, grew: false };
    const row = await tx.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, tier: true } });
    if (parsed.toTier !== toTier(row?.tier) + 1) return { status: 409, body: { error: 'stale_tier' } };
    const [have, badge] = await Promise.all([
      balanceOf(tx, userId),
      tx.achievement.findFirst({ where: { userId, family: gate.family, level: { gte: gate.level } }, select: { id: true } }),
    ]);
    if (have < gate.price || !badge) return { status: 409, body: { error: 'gate', coinsNeeded: Math.max(0, gate.price - have), badgeNeeded: !badge } };
    const paid = await spendInTx(tx, userId, 'expand', sourceKey, gate.price, now);
    if (!paid.ok) return { status: 409, body: { error: 'gate', coinsNeeded: paid.needed, badgeNeeded: false } };
    const layout = (row ? parseLayout(row.layout) : null) ?? starterLayout();
    const gone = coveredBy(layout, parsed.toTier, geometryDeps);
    const next = { ...layout, pieces: layout.pieces.filter((p) => !gone.has(p.id)) } as unknown as Prisma.InputJsonValue;
    if (row) await tx.cosmeticLoadout.update({ where: { userId }, data: { layout: next, tier: parsed.toTier, version: { increment: 1 } } });
    else await tx.cosmeticLoadout.create({ data: { userId, layout: next, worn: { ...EMPTY_WORN }, tier: parsed.toTier, version: 1 } });
    return { stored: gone.size, grew: true };
  });
  if ('status' in outcome) return { ok: false, failure: outcome };
  if (outcome.grew) {
    console.info(JSON.stringify({ event: 'coins.spent', kind: 'expand' }));
    console.info(JSON.stringify({ event: 'room.expanded', tier: parsed.toTier }));
  }
  const [dto, balance] = await Promise.all([readCosmetics(userId, now, { grant: false }), balanceOf(prisma, userId)]);
  return { ok: true, body: { ...dto, balance, stored: outcome.stored } };
}
```

In `backend/src/cosmetics/routes.ts` (import `expandRoom` from `'../room/expand'`; the header comment adds "and
POST /me/room/expand, growing the room (§7)"):

```ts
cosmeticsRouter.post('/me/room/expand', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const result = await expandRoom(req.userId!, req.body, new Date());
  if (!result.ok) {
    res.status(result.failure.status).json(result.failure.body);
    return;
  }
  res.json(result.body);
});
```

- [ ] **Step 4: The tier gates in the export and the app**

In `backend/src/cosmetics/export.ts` (import `familyDef` from `'../achievements/catalogue'` and `TIER_GATES` from
`'../room/tiers'`), `CatalogueExport` gains
`tierGates: Record<'2' | '3', { price: number; family: string; level: number; threshold: number }>;` and
`exportCatalogue` returns, after `sets`:

```ts
    // The room sizes' gates (ruling 37): one source for the server's check and the app's Room sizes screen.
    tierGates: {
      2: { ...TIER_GATES[2], threshold: familyDef(TIER_GATES[2].family).thresholds[TIER_GATES[2].level - 1]! },
      3: { ...TIER_GATES[3], threshold: familyDef(TIER_GATES[3].family).thresholds[TIER_GATES[3].level - 1]! },
    },
```

Regenerate from `backend/`: `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`.

In `mobile/src/lib/room/catalogue.ts`, the `CATALOGUE` cast gains
`tierGates: Record<'2' | '3', { price: number; family: AchievementFamilyName; level: number; threshold: number }>;`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/room tests/cosmetics`
Expected: PASS.
Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/roomCatalogue.test.ts`
Expected: PASS.

- [ ] **Step 6: Full suites, typechecks, commit**

Full backend suite (green), backend tsc (0), the full mobile suite (green), mobile typecheck (10).

```bash
git add backend/src/room/tiers.ts backend/src/room/expand.ts backend/src/cosmetics/routes.ts backend/src/cosmetics/export.ts backend/tests/room/expand.test.ts backend/tests/cosmetics/export.test.ts mobile/src/lib/room/catalogue.json mobile/src/lib/room/catalogue.ts mobile/__tests__/lib/roomCatalogue.test.ts
git commit -m "feat(room): grow the room behind both gates under the room lock, storing the wall pieces the loft window covers"
```

---

### Task 8: Backend: the first-week list (`GET /me/firstweek`), its two bonuses and P1's placement backfill

Spec §11.2 (seven rows from the day P2 reaches you or sign-up; only the two bonus rows pay extra, once ever, outside
the cap; the others tick when their normal earn's row exists, a 0-coin row included; "Next: 8 × 8 · 600 coins and a
14-day check-in streak"; after day 7 the card is gone and unfinished bonuses lapse quietly), the controller ruling
(§0: a P1 first placement pays the +10 when P2 arrives, the one exception to "no backpay"), §11.1 (`RoomFirstWeek`
never creates a loadout row), §12 P2 (`GET /me/firstweek` → the list, its ticks and day) and §16 (first week). Rulings
21–24.

**Files:**
- Create: `backend/src/coins/firstWeek.ts`, `backend/tests/coins/firstWeek.test.ts`
- Modify: `backend/src/coins/sources.ts` (`earnCoins` adds the bonuses), `backend/src/coins/routes.ts`,
  `backend/src/cosmetics/loadout.ts` (a first placement earns at once)

**Interfaces:**
- Consumes: Task 3's `CoinEarn`, `applyCoinEvents`; Task 4's `earnCoins`, `earnCoinsSafely`, `coinsConfig`; Task 7's
  `TIER_GATES`; `familyDef`; `habitDayForOrUtc`, `localCivilDateOrUtc`, `civilDateToUtcMidnight`, `shiftDate`,
  `daysBetween`.
- Produces (`backend/src/coins/firstWeek.ts`):
  - `FIRST_WEEK_DAYS = 7`, `FIRST_WEEK_BONUS = { place: 10, streak7: 25 }`, `FIRST_WEEK_TASKS`
    (`'checkin' | 'place' | 'sleep' | 'fern' | 'cheer' | 'recap' | 'streak7'`), `type FirstWeekTask`, `TASK_REWARDS`;
  - `lastDay(startedOn)`, `checkInRun(days: ReadonlySet<string>, habitToday: string): number`,
    `interface BonusFacts { startedOn: string; today: string; firstPlacedOn: string | null; run: number }`,
    `bonusEarns(f: BonusFacts): CoinEarn[]`;
  - `ensureStartedOn(userId, now, launchedAt): Promise<string | null>`, `firstWeekEarns(userId, now, launchedAt): Promise<CoinEarn[]>`;
  - `type FirstWeekDTO = { open: false } | { open: true; day: number; done: number; tasks: Array<{ key: FirstWeekTask; done: boolean; reward: number }>; next: { tier: 2; coins: number; streak: number } }`,
    `readFirstWeek(userId, now, launchedAt): Promise<FirstWeekDTO>`; route `GET /me/firstweek`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/coins/firstWeek.test.ts`:

```ts
import { randomUUID } from 'crypto';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { localCivilDateOrUtc } from '../../src/biometrics/civilDate';
import { EMPTY_WORN } from '../../src/cosmetics/catalogue';
import { bonusEarns, checkInRun, ensureStartedOn } from '../../src/coins/firstWeek';
import { applyCoinEvents } from '../../src/coins/ledger';
import { coinsConfig } from '../../src/coins/sources';
import { habitDayFor } from '../../src/habits/habitDay';
import { shiftDate } from '../../src/scoring/dates';
import { day } from '../cosmetics/helpers';
import { piece, withPieces } from '../room/helpers';
import { balance, coinUser, earn, fund, rowsOf } from './helpers';

const LAUNCH = new Date('2026-10-01T00:00:00.000Z');
const BEFORE = coinsConfig.launchedAt;
beforeAll(() => {
  migrateTestDb();
  coinsConfig.launchedAt = LAUNCH;
});
afterAll(async () => {
  coinsConfig.launchedAt = BEFORE;
  await prisma.$disconnect();
  await connection.quit();
});
let quiet: jest.SpyInstance;
beforeEach(() => { quiet = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => quiet.mockRestore());

const list = async (headers: Record<string, string>) => (await (await api()).get('/me/firstweek').set(headers)).body;
const done = (body: { tasks: Array<{ key: string; done: boolean }> }) => body.tasks.filter((t) => t.done).map((t) => t.key).sort();

describe('the bonuses (pure)', () => {
  it('counts the on-time run ending today, or yesterday while today is still due (ruling 22)', () => {
    const days = new Set(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect([checkInRun(days, '2026-11-08'), checkInRun(days, '2026-11-09'), checkInRun(days, '2026-11-10')]).toEqual([4, 4, 0]);
  });

  it('pays the place bonus for a placement up to day 7, a P1 one included; the streak bonus only while open (ruling 23)', () => {
    const base = { startedOn: '2026-11-01', today: '2026-11-04', run: 0 };
    const place = { kind: 'firstweek', sourceKey: 'firstweek:place', amount: 10, capDay: null };
    const streak = { kind: 'firstweek', sourceKey: 'firstweek:streak7', amount: 25, capDay: null };
    expect(bonusEarns({ ...base, firstPlacedOn: '2026-10-16' })).toEqual([place]);
    expect(bonusEarns({ ...base, today: '2026-11-12', firstPlacedOn: '2026-11-07' })).toEqual([place]);
    expect(bonusEarns({ ...base, firstPlacedOn: '2026-11-08' })).toEqual([]);
    expect(bonusEarns({ ...base, firstPlacedOn: null, run: 7 })).toEqual([streak]);
    expect(bonusEarns({ ...base, today: '2026-11-08', firstPlacedOn: null, run: 9 })).toEqual([]);
  });
});

describe('day 1 (ruling 21)', () => {
  it('is the sign-up date after the launch, the first look for an older account, set once, never before the launch, and never a loadout row', async () => {
    const fresh = await coinUser();
    expect(await ensureStartedOn(fresh.user.id, new Date(), LAUNCH)).toBe(localCivilDateOrUtc(fresh.user.createdAt, 'UTC'));
    const old = await coinUser();
    await prisma.user.update({ where: { id: old.user.id }, data: { createdAt: new Date('2026-09-01T00:00:00.000Z') } });
    const now = new Date();
    expect(await ensureStartedOn(old.user.id, now, LAUNCH)).toBe(localCivilDateOrUtc(now, 'UTC'));
    expect(await ensureStartedOn(old.user.id, new Date(now.getTime() + 3 * 86_400_000), LAUNCH)).toBe(localCivilDateOrUtc(now, 'UTC'));
    const early = await coinUser();
    expect(await ensureStartedOn(early.user.id, new Date('2026-09-15T00:00:00.000Z'), LAUNCH)).toBeNull();
    expect(await prisma.roomFirstWeek.findUnique({ where: { userId: early.user.id } })).toBeNull();
    expect(await prisma.cosmeticLoadout.findUnique({ where: { userId: fresh.user.id } })).toBeNull();
  });
});

describe('GET /me/firstweek (spec §11.2, §12)', () => {
  it('day 1: seven rows, nothing done, the next size teased, private no-store', async () => {
    const { headers } = await coinUser();
    const res = await (await api()).get('/me/firstweek').set(headers);
    expect([res.status, res.headers['cache-control'], res.body]).toEqual([200, 'private, no-store', {
      open: true, day: 1, done: 0,
      tasks: [
        { key: 'checkin', done: false, reward: 5 }, { key: 'place', done: false, reward: 10 }, { key: 'sleep', done: false, reward: 20 },
        { key: 'fern', done: false, reward: -40 }, { key: 'cheer', done: false, reward: 2 }, { key: 'recap', done: false, reward: 10 },
        { key: 'streak7', done: false, reward: 25 },
      ],
      next: { tier: 2, coins: 600, streak: 14 },
    }]);
  });

  it('a first placement made in P1, before coins, pays its +10 once when P2 arrives, outside a full cap (§0 ruling)', async () => {
    const { user, headers } = await coinUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, firstPlacedAt: new Date('2026-09-20T10:00:00.000Z') } });
    const today = localCivilDateOrUtc(new Date(), 'UTC');
    await applyCoinEvents(user.id, [
      earn('sleep_goal', `sleep_goal:${today}`, 20, today), earn('steps', `steps:${today}`, 15, today),
      earn('recap', 'recap:x', 10, today), earn('recap', 'recap:y', 10, today), earn('checkin', `checkin:${today}`, 5, today),
    ], new Date());
    expect(done(await list(headers))).toEqual(['checkin', 'place', 'recap', 'sleep']);
    expect(await balance(user.id)).toBe(70);
    await list(headers);
    expect((await rowsOf(user.id)).filter((r) => r.sourceKey === 'firstweek:place')).toHaveLength(1);
  });

  it('the first save that places a piece pays its +10 at once', async () => {
    const { user, headers } = await coinUser();
    const put = await (await api()).put('/me/cosmetics').set(headers).send({ layout: withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 })), worn: { ...EMPTY_WORN }, version: 0 });
    expect(put.status).toBe(200);
    expect((await rowsOf(user.id)).map((r) => [r.sourceKey, r.amount])).toEqual([['firstweek:place', 10]]);
  });

  it('7 on-time check-ins in a row pay +25 once; the fern row ticks on a bought fern (rulings 22, 24)', async () => {
    const { user, headers } = await coinUser();
    const today = habitDayFor(new Date(), 'UTC');
    for (let k = 0; k < 7; k++) await prisma.habitCheckIn.create({ data: { userId: user.id, habitDay: day(shiftDate(today, -k)), onTime: true } });
    await fund(user.id, 40);
    expect((await (await api()).post('/me/shop/purchases').set(headers).send({ requestId: randomUUID(), itemId: 'plant.fern' })).status).toBe(200);
    expect(done(await list(headers))).toEqual(['checkin', 'fern', 'streak7']);
    await list(headers);
    expect((await rowsOf(user.id)).filter((r) => r.sourceKey === 'firstweek:streak7').map((r) => r.amount)).toEqual([25]);
  });

  it('after day 7 the list is gone, and a bonus not reached by then lapses quietly', async () => {
    const { user, headers } = await coinUser();
    await prisma.roomFirstWeek.create({ data: { userId: user.id, startedOn: day(shiftDate(localCivilDateOrUtc(new Date(), 'UTC'), -8)) } });
    expect(await list(headers)).toEqual({ open: false });
    await prisma.roomFirstWeek.update({ where: { userId: user.id }, data: { firstPlacedAt: new Date() } });
    await list(headers);
    expect((await rowsOf(user.id)).some((r) => r.kind === 'firstweek')).toBe(false);
  });

  it('needs a session', async () => {
    expect((await (await api()).get('/me/firstweek')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins/firstWeek.test.ts`
Expected: FAIL (no `coins/firstWeek.ts`; 404 on the route).

- [ ] **Step 3: `backend/src/coins/firstWeek.ts`**

```ts
// The first-week list (spec 2026-10-15 §11.2, C7): seven rows for seven days from day 1 (ruling 21). Two pay a bonus
// once ever, outside the daily cap: placing a first piece (+10; a P1 placement made before coins counts, the one
// exception to "no backpay", ruling 23) and 7 on-time check-ins in a row while the list is open (+25, ruling 22). The
// other rows tick when their normal earn's row exists (a 0-coin row at the cap still ticks), the fern on a bought fern
// (ruling 24). After day 7 the list is gone and an unfinished bonus lapses quietly.
import { familyDef } from '../achievements/catalogue';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../biometrics/civilDate';
import { prisma } from '../db/client';
import { habitDayForOrUtc } from '../habits/habitDay';
import { TIER_GATES } from '../room/tiers';
import { daysBetween, shiftDate } from '../scoring/dates';
import type { CoinEarn } from './ledger';

export const FIRST_WEEK_DAYS = 7;
export const FIRST_WEEK_BONUS = { place: 10, streak7: 25 } as const;
export const FIRST_WEEK_TASKS = ['checkin', 'place', 'sleep', 'fern', 'cheer', 'recap', 'streak7'] as const;
export type FirstWeekTask = (typeof FIRST_WEEK_TASKS)[number];
/** What each row shows (C7): the normal earn, the two bonuses, and the fern's price as a spend. */
export const TASK_REWARDS: Readonly<Record<FirstWeekTask, number>> = { checkin: 5, place: 10, sleep: 20, fern: -40, cheer: 2, recap: 10, streak7: 25 };
const key = (d: Date) => d.toISOString().slice(0, 10);

export function lastDay(startedOn: string): string {
  return shiftDate(startedOn, FIRST_WEEK_DAYS - 1);
}

/** The on-time check-in run ending today, or yesterday while today's is still due (the CHECK_IN family's rule). */
export function checkInRun(days: ReadonlySet<string>, habitToday: string): number {
  let d = days.has(habitToday) ? habitToday : shiftDate(habitToday, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

export interface BonusFacts { startedOn: string; today: string; firstPlacedOn: string | null; run: number }

export function bonusEarns(f: BonusFacts): CoinEarn[] {
  const end = lastDay(f.startedOn);
  const out: CoinEarn[] = [];
  if (f.firstPlacedOn !== null && f.firstPlacedOn <= end) out.push({ kind: 'firstweek', sourceKey: 'firstweek:place', amount: FIRST_WEEK_BONUS.place, capDay: null });
  if (f.today <= end && f.run >= 7) out.push({ kind: 'firstweek', sourceKey: 'firstweek:streak7', amount: FIRST_WEEK_BONUS.streak7, capDay: null });
  return out;
}

/** Day 1 (ruling 21), set once: the local sign-up date for an account made at or after the launch, else today. */
export async function ensureStartedOn(userId: string, now: Date, launchedAt: Date): Promise<string | null> {
  if (now < launchedAt) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, createdAt: true } });
  if (!user) return null;
  const first = localCivilDateOrUtc(user.createdAt >= launchedAt ? user.createdAt : now, user.timezone);
  // Never on CosmeticLoadout (spec §11.1): a row made for a flag would turn the first save into a false 409.
  await prisma.roomFirstWeek.createMany({ data: [{ userId }], skipDuplicates: true });
  await prisma.roomFirstWeek.updateMany({ where: { userId, startedOn: null }, data: { startedOn: civilDateToUtcMidnight(first) } });
  const row = await prisma.roomFirstWeek.findUniqueOrThrow({ where: { userId }, select: { startedOn: true } });
  return key(row.startedOn!);
}

/** The bonuses this run may pay (the ledger drops the ones already paid). */
export async function firstWeekEarns(userId: string, now: Date, launchedAt: Date): Promise<CoinEarn[]> {
  const startedOn = await ensureStartedOn(userId, now, launchedAt);
  if (!startedOn) return [];
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  const habitToday = habitDayForOrUtc(now, user.timezone);
  const [row, checkIns] = await Promise.all([
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { firstPlacedAt: true } }),
    prisma.habitCheckIn.findMany({
      where: { userId, onTime: true, habitDay: { gte: civilDateToUtcMidnight(shiftDate(habitToday, -2 * FIRST_WEEK_DAYS)) } },
      select: { habitDay: true },
    }),
  ]);
  return bonusEarns({
    startedOn,
    today: localCivilDateOrUtc(now, user.timezone),
    firstPlacedOn: row?.firstPlacedAt ? localCivilDateOrUtc(row.firstPlacedAt, user.timezone) : null,
    run: checkInRun(new Set(checkIns.map((c) => key(c.habitDay))), habitToday),
  });
}

export type FirstWeekDTO =
  | { open: false }
  | { open: true; day: number; done: number; tasks: Array<{ key: FirstWeekTask; done: boolean; reward: number }>; next: { tier: 2; coins: number; streak: number } };

export async function readFirstWeek(userId: string, now: Date, launchedAt: Date): Promise<FirstWeekDTO> {
  const startedOn = await ensureStartedOn(userId, now, launchedAt);
  if (!startedOn) return { open: false };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  const today = localCivilDateOrUtc(now, user.timezone);
  if (today > lastDay(startedOn)) return { open: false };
  const [kinds, row, fern, streak] = await Promise.all([
    prisma.coinEvent.findMany({ where: { userId, kind: { in: ['checkin', 'sleep_goal', 'cheer_given', 'recap'] } }, distinct: ['kind'], select: { kind: true } }),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { firstPlacedAt: true } }),
    prisma.itemGrant.findFirst({ where: { userId, itemId: 'plant.fern', sourceKey: { startsWith: 'buy:' } }, select: { id: true } }),
    prisma.coinEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey: 'firstweek:streak7' } }, select: { id: true } }),
  ]);
  const has = new Set(kinds.map((k) => k.kind));
  const ticked: Record<FirstWeekTask, boolean> = {
    checkin: has.has('checkin'), place: !!row?.firstPlacedAt, sleep: has.has('sleep_goal'), fern: !!fern,
    cheer: has.has('cheer_given'), recap: has.has('recap'), streak7: !!streak,
  };
  const tasks = FIRST_WEEK_TASKS.map((k) => ({ key: k, done: ticked[k], reward: TASK_REWARDS[k] }));
  const gate = TIER_GATES[2];
  return {
    open: true,
    day: daysBetween(startedOn, today) + 1,
    done: tasks.filter((t) => t.done).length,
    tasks,
    next: { tier: 2, coins: gate.price, streak: familyDef(gate.family).thresholds[gate.level - 1]! },
  };
}
```

- [ ] **Step 4: Wire it in**

In `backend/src/coins/sources.ts` (import `firstWeekEarns` from `'./firstWeek'`), `earnCoins` becomes:

```ts
export async function earnCoins(userId: string, now: Date, opts: { launchedAt?: Date } = {}): Promise<number> {
  const launchedAt = opts.launchedAt ?? coinsConfig.launchedAt;
  const inputs = await loadEarnInputs(userId, now, launchedAt);
  if (!inputs) return 0;
  // The first-week bonuses are outside the cap and, for a P1 placement, outside "no backpay" (spec §11.2).
  const events = [...planEarns(inputs), ...(await firstWeekEarns(userId, now, launchedAt))];
  return (await applyCoinEvents(userId, events, now)).length;
}
```

In `backend/src/coins/routes.ts` (import `readFirstWeek` from `'./firstWeek'` and `coinsConfig` from `'./sources'`):

```ts
coinsRouter.get('/me/firstweek', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const now = new Date();
  // Earn first, so a bonus that is due shows as paid (spec §11.2).
  await earnCoinsSafely(req.userId!, now);
  res.json(await readFirstWeek(req.userId!, now, coinsConfig.launchedAt));
});
```

In `backend/src/cosmetics/loadout.ts` (import `earnCoinsSafely` from `'../coins/sources'`): inside `saveCosmetics`'
transaction, keep the result of the first-placement write,

```ts
        const first = await tx.roomFirstWeek.updateMany({ where: { userId, firstPlacedAt: null }, data: { firstPlacedAt: now } });
        placedFirst = first.count === 1;
```

with `let placedFirst = false;` declared next to `let tier`, and after the success log line:

```ts
  // The first placement's +10 lands at once (spec §11.2); a failure waits for the next GET /me/coins.
  if (placedFirst) await earnCoinsSafely(userId, now);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backend-jest.sh tests/coins tests/room`
Expected: PASS (Task 4's `earnCoins` tests are unchanged: their users signed up long after day 7 of `NOW`'s list).

- [ ] **Step 6: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0), `schema-drift.sh` (`no drift`).

```bash
git add backend/src/coins backend/src/cosmetics/loadout.ts backend/tests/coins/firstWeek.test.ts
git commit -m "feat(backend): the first-week list with its place and seven-day check-in bonuses, including a placement made before coins"
```

---

### Task 9: Mobile: the coins API, `coinsStore` (Spec B's guards), purchase and grow actions

Spec §12 Concurrency ("the app's `coinsStore` copies `cosmeticsStore`'s epoch, session and 'ignore older' guards"),
§6.6 (purchases are never optimistic; the piece lands in the inventory with NEW), §7 (the grow answer is the full
cosmetics body plus the balance) and §16 Mobile (`coinsStore` guards: a stale GET can't overwrite a purchase). Rulings
7, 30, 33.

**Files:**
- Create: `mobile/src/api/coins.ts`, `mobile/src/lib/coins/coinsStore.ts`, `mobile/src/lib/coins/actions.ts`,
  `mobile/__tests__/lib/coinsStore.test.tsx`, `mobile/__tests__/lib/coinActions.test.ts`
- Modify: `mobile/src/lib/room/cosmeticsStore.ts`, `mobile/src/components/kip/MyKipScope.tsx`, `mobile/jest-setup.js`,
  `mobile/jest-mocks/coachScreenHarness.tsx`, `mobile/__tests__/components/MyKipScope.test.tsx`

**Interfaces:**
- Consumes: P1's `apiFetch`, `send` (`api/buddies.ts`), `CosmeticsDTO`, `cosmeticsStore` (`publish`, `fromDTO`, the
  epoch); `expo-crypto`'s `randomUUID`.
- Produces:
  - `mobile/src/api/coins.ts`: `type CoinKind`, `interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }`,
    `interface CoinsDTO`, `interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: Array<{ itemId: string; price: number }> }`,
    `interface PurchaseDTO { balance: number; counts: Record<string, number> }`,
    `type ExpandDTO = CosmeticsDTO & { balance: number; stored: number }`, `type FirstWeekTaskKey`, `type FirstWeekDTO`,
    `fetchCoins(cursor?)`, `postCoinsSeen(through)`, `fetchShop()`, `postPurchase(requestId, itemId)`,
    `postExpand(requestId, toTier)`, `fetchFirstWeek()`;
  - `mobile/src/lib/coins/coinsStore.ts`: `interface Coins { balance: number; today: { earned: number; cap: number }; events: readonly CoinEventDTO[]; next: string | null }`,
    `getCoins()`, `getFirstWeek()`, `coinSession()`, `loadCoins()`, `loadMoreCoins()`, `setCoinBalance(balance)`,
    `markCoinsSeen(through)`, `loadFirstWeek()`, `resetCoins()`, `useCoins()`, `useFirstWeek()`;
  - `mobile/src/lib/coins/actions.ts`: `newRequestId(): string`, `buyPiece(itemId, requestId): Promise<PurchaseDTO>`,
    `growRoom(toTier: 2 | 3, requestId): Promise<{ stored: number; tier: number }>`;
  - `cosmeticsStore`: `applyPurchase(itemId, counts)`, `applyCosmeticsBody(dto: CosmeticsDTO)`.

- [ ] **Step 1: Write the failing tests**

Add to `mobile/jest-setup.js` (one id per call, so retries and repeats are visible in tests):

```js
// Request ids (P2 plan ruling 30): a fresh, readable id per call.
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}`) }));
```

Create `mobile/__tests__/lib/coinsStore.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native';
import { fetchCoins, fetchFirstWeek, postCoinsSeen, type CoinsDTO } from '../../src/api/coins';
import {
  getCoins, getFirstWeek, loadCoins, loadFirstWeek, loadMoreCoins, markCoinsSeen, resetCoins, setCoinBalance, useCoins,
} from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({
  fetchCoins: jest.fn(), postCoinsSeen: jest.fn(async () => undefined), fetchFirstWeek: jest.fn(),
  fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
const get = fetchCoins as jest.Mock;

const BODY = (over: Partial<CoinsDTO> = {}): CoinsDTO => ({
  balance: 120, today: { earned: 25, cap: 60 },
  events: [{ kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false }, { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false }],
  next: null, ...over,
});
const later = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  resetCoins();
});

it('loads the wallet, shares one read between loads started together, and keeps it when a read fails', async () => {
  get.mockResolvedValue(BODY());
  await Promise.all([loadCoins(), loadCoins()]);
  expect([get.mock.calls.length, getCoins()!.balance]).toEqual([1, 120]);
  get.mockRejectedValueOnce(new Error('offline'));
  await loadCoins();
  expect(getCoins()!.balance).toBe(120);
});

it('a read that started before a purchase never overwrites its balance (spec §16, ruling 33)', async () => {
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const read = loadCoins();
  setCoinBalance(30);
  d.resolve(BODY());
  await read;
  expect(getCoins()!.balance).toBe(30);
});

it('drops an answer that lands after sign-out', async () => {
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const read = loadCoins();
  resetCoins();
  d.resolve(BODY());
  await read;
  expect(getCoins()).toBeNull();
});

it('marks events seen up to `through` at once and tells the server', async () => {
  get.mockResolvedValue(BODY());
  await loadCoins();
  await markCoinsSeen('2026-11-11T06:30:00.000Z');
  expect(getCoins()!.events.map((e) => e.seen)).toEqual([false, true]);
  expect(postCoinsSeen).toHaveBeenCalledWith('2026-11-11T06:30:00.000Z');
});

it('appends the next page, and drops it when a newer read replaced the list meanwhile', async () => {
  get.mockResolvedValueOnce(BODY({ next: 'c1' }));
  await loadCoins();
  get.mockResolvedValueOnce(BODY({ events: [{ kind: 'recap', amount: 10, at: '2026-11-10T09:00:00.000Z', seen: true }], next: null }));
  await loadMoreCoins();
  expect([getCoins()!.events.length, getCoins()!.next, get.mock.calls[1]![0]]).toEqual([3, null, 'c1']);
  get.mockResolvedValueOnce(BODY({ next: 'c2' }));
  await loadCoins();
  const d = later<CoinsDTO>();
  get.mockReturnValueOnce(d.promise);
  const more = loadMoreCoins();
  setCoinBalance(5);
  d.resolve(BODY({ events: [], next: null }));
  await more;
  expect(getCoins()!.next).toBe('c2');
});

it('loads the first-week list and forgets it on sign-out', async () => {
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
  await loadFirstWeek();
  expect(getFirstWeek()).toEqual({ open: false });
  resetCoins();
  expect(getFirstWeek()).toBeNull();
});

it('useCoins follows the store', async () => {
  const { result } = renderHook(() => useCoins());
  expect(result.current).toBeNull();
  await act(async () => { setCoinBalance(9); });
  expect(result.current!.balance).toBe(9);
});
```

Create `mobile/__tests__/lib/coinActions.test.ts`:

```ts
import { ApiError } from '../../src/api/client';
import { postExpand, postPurchase, type ExpandDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { buyPiece, growRoom, newRequestId } from '../../src/lib/coins/actions';
import { getCoins, resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/coins', () => ({
  fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  resetCoins();
  resetCosmetics();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await loadCosmetics();
  setCoinBalance(200);
});

it('a purchase lands in both stores: the balance, the counts, owned and NEW (spec §6.6, ruling 7)', async () => {
  (postPurchase as jest.Mock).mockResolvedValue({ balance: 50, counts: { ...STARTER_COUNTS, 'item.radio': 1 } });
  await buyPiece('item.radio', 'req-1');
  expect(postPurchase).toHaveBeenCalledWith('req-1', 'item.radio');
  const c = getCosmetics()!;
  expect([getCoins()!.balance, c.counts['item.radio'], c.owned.has('item.radio'), c.fresh]).toEqual([50, 1, true, [{ itemId: 'item.radio', source: 'buy' }]]);
});

it('a room read that started before the purchase cannot wipe the new count', async () => {
  let resolve!: (v: unknown) => void;
  (fetchCosmetics as jest.Mock).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  const read = loadCosmetics();
  (postPurchase as jest.Mock).mockResolvedValue({ balance: 50, counts: { ...STARTER_COUNTS, 'item.radio': 1 } });
  await buyPiece('item.radio', 'req-2');
  resolve(cosmeticsDTO());
  await read;
  expect(getCosmetics()!.counts['item.radio']).toBe(1);
});

it('a refused purchase changes nothing and throws the server\'s error', async () => {
  (postPurchase as jest.Mock).mockRejectedValue(new ApiError(409, 'x', 'not_enough_coins', { error: 'not_enough_coins', needed: 40 }));
  await expect(buyPiece('item.radio', 'req-3')).rejects.toMatchObject({ status: 409, code: 'not_enough_coins' });
  expect([getCoins()!.balance, getCosmetics()!.counts['item.radio']]).toEqual([200, undefined]);
});

it('a grow publishes the grown room (newer version) and the balance', async () => {
  const body: ExpandDTO = { ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 0, stored: 1 };
  (postExpand as jest.Mock).mockResolvedValue(body);
  expect(await growRoom(2, 'req-4')).toEqual({ stored: 1, tier: 2 });
  expect(postExpand).toHaveBeenCalledWith('req-4', 2);
  expect([getCosmetics()!.tier, getCosmetics()!.cap, getCosmetics()!.version, getCoins()!.balance]).toEqual([2, 60, 3, 0]);
});

it('makes a new request id each time (ruling 30)', () => {
  expect(newRequestId()).not.toBe(newRequestId());
});
```

In `mobile/__tests__/components/MyKipScope.test.tsx`, add the mock
`jest.mock('../../src/lib/coins/coinsStore', () => ({ loadCoins: jest.fn(async () => null), resetCoins: jest.fn() }));`
and a test:

```tsx
it('loads the wallet with the room on sign-in and forgets it on sign-out', async () => {
  const coins = jest.requireMock('../../src/lib/coins/coinsStore') as { loadCoins: jest.Mock; resetCoins: jest.Mock };
  const s = render(<MyKipScope />);
  expect(coins.loadCoins).toHaveBeenCalledTimes(1);
  s.unmount();
  await act(async () => undefined);
  expect(coins.resetCoins).toHaveBeenCalledTimes(1);
});
```

In `mobile/jest-mocks/coachScreenHarness.tsx`, add next to the other API mocks (the KIP page loads coins and the
first-week list on focus from Task 12; no real HTTP from Jest):

```tsx
jest.mock('../src/api/coins', () => ({
  fetchCoins: jest.fn(async () => ({ balance: 0, today: { earned: 0, cap: 60 }, events: [], next: null })),
  postCoinsSeen: jest.fn(async () => undefined),
  fetchFirstWeek: jest.fn(async () => ({ open: false })),
  fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn(),
}));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinsStore.test.tsx __tests__/lib/coinActions.test.ts __tests__/components/MyKipScope.test.tsx`
Expected: FAIL (no `api/coins.ts`, no store, no actions).

- [ ] **Step 3: `mobile/src/api/coins.ts`**

```ts
import { apiFetch } from './client';
import { send } from './buddies';
import type { CosmeticsDTO } from './cosmetics';

// KIP coins (spec 2026-10-15 §12 P2). The server decides every amount, price and gate; the app only shows them.
export type CoinKind =
  | 'sleep_goal' | 'steps' | 'checkin' | 'recap' | 'cheer_given' | 'cheer_got' | 'challenge' | 'firstweek' | 'buy' | 'expand';
export interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }
export interface CoinsDTO { balance: number; today: { earned: number; cap: number }; events: CoinEventDTO[]; next: string | null }
export interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: Array<{ itemId: string; price: number }> }
export interface PurchaseDTO { balance: number; counts: Record<string, number> }
/** The full GET /me/cosmetics body, the balance after, and the pieces the new window sent to the inventory. */
export type ExpandDTO = CosmeticsDTO & { balance: number; stored: number };
export type FirstWeekTaskKey = 'checkin' | 'place' | 'sleep' | 'fern' | 'cheer' | 'recap' | 'streak7';
export type FirstWeekDTO =
  | { open: false }
  | { open: true; day: number; done: number; tasks: Array<{ key: FirstWeekTaskKey; done: boolean; reward: number }>; next: { tier: 2; coins: number; streak: number } };

export const fetchCoins = (cursor?: string) => apiFetch<CoinsDTO>(cursor ? `/me/coins?cursor=${encodeURIComponent(cursor)}` : '/me/coins');
export const postCoinsSeen = (through: string) => apiFetch<void>('/me/coins/seen', send('POST', { through }));
export const fetchShop = () => apiFetch<ShopDTO>('/me/shop');
export const postPurchase = (requestId: string, itemId: string) => apiFetch<PurchaseDTO>('/me/shop/purchases', send('POST', { requestId, itemId }));
export const postExpand = (requestId: string, toTier: 2 | 3) => apiFetch<ExpandDTO>('/me/room/expand', send('POST', { requestId, toTier }));
export const fetchFirstWeek = () => apiFetch<FirstWeekDTO>('/me/firstweek');
```

- [ ] **Step 4: `mobile/src/lib/coins/coinsStore.ts`**

```ts
import { useSyncExternalStore } from 'react';
import { fetchCoins, fetchFirstWeek, postCoinsSeen, type CoinEventDTO, type CoinsDTO, type FirstWeekDTO } from '../../api/coins';

// One shared copy of GET /me/coins (spec 2026-10-15 §6.7, §12) and of GET /me/firstweek (§11.2), with cosmeticsStore's
// guards: an answer that lands after sign-out is dropped (the session moves), and a read that started before a
// purchase, a grow or a mark-seen is dropped too (each moves the epoch), so a stale GET never overwrites a newer balance
// (ruling 33: coins have no version; the epoch is the "ignore older" rule). Loaded per sign-in by MyKipScope, on every
// KIP page focus and by the coin screens.

export interface Coins {
  balance: number;
  today: { earned: number; cap: number };
  /** Newest first, as many pages as were loaded. */
  events: readonly CoinEventDTO[];
  next: string | null;
}

let coins: Coins | null = null;
let firstWeek: FirstWeekDTO | null = null;
let epoch = 0;
let session = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function fromDTO(dto: CoinsDTO): Coins {
  if (typeof dto?.balance !== 'number' || !Array.isArray(dto.events)) throw new Error('not a coins body');
  return { balance: dto.balance, today: dto.today ?? { earned: 0, cap: 60 }, events: dto.events, next: dto.next ?? null };
}

export function getCoins(): Coins | null {
  return coins;
}
export function getFirstWeek(): FirstWeekDTO | null {
  return firstWeek;
}
/** Moves only on sign-out: an action's answer lands unless the account changed. */
export function coinSession(): number {
  return session;
}

let inflight: { at: number; read: Promise<Coins | null> } | null = null;

/** Reads the server (which also catches up on earns). Keeps what is shown when the read fails. */
export function loadCoins(): Promise<Coins | null> {
  if (inflight && inflight.at === epoch) return inflight.read;
  const at = epoch;
  const read = (async () => {
    try {
      const next = fromDTO(await fetchCoins());
      if (at === epoch) {
        coins = next;
        emit();
      }
    } catch {
      // The next focus or open tries again.
    }
    return coins;
  })();
  inflight = { at, read };
  void read.then(() => {
    if (inflight?.read === read) inflight = null;
  });
  return read;
}

/** The next history page, appended unless the list changed meanwhile. */
export async function loadMoreCoins(): Promise<void> {
  const from = coins;
  if (!from?.next) return;
  const at = epoch;
  try {
    const page = fromDTO(await fetchCoins(from.next));
    if (at === epoch && coins === from) {
      coins = { ...from, events: [...from.events, ...page.events], next: page.next };
      emit();
    }
  } catch {
    // Load more stays; tapping it tries again.
  }
}

/** A purchase or a grow answered with the balance: shown at once, and any older read is dropped. */
export function setCoinBalance(balance: number): void {
  epoch++;
  coins = coins ? { ...coins, balance } : { balance, today: { earned: 0, cap: 60 }, events: [], next: null };
  emit();
}

/** Coins that landed (spec §6.7): seen here at once, then on the server. */
export async function markCoinsSeen(through: string): Promise<void> {
  epoch++;
  if (coins) {
    coins = { ...coins, events: coins.events.map((e) => (!e.seen && e.at <= through ? { ...e, seen: true } : e)) };
    emit();
  }
  try {
    await postCoinsSeen(through);
  } catch {
    // Still unseen on the server: the next read may land it once more, which is harmless.
  }
}

export async function loadFirstWeek(): Promise<FirstWeekDTO | null> {
  const s = session;
  try {
    const dto = await fetchFirstWeek();
    if (s === session && dto && typeof dto.open === 'boolean') {
      firstWeek = dto;
      emit();
    }
  } catch {
    // Keep what is shown.
  }
  return firstWeek;
}

export function resetCoins(): void {
  epoch++;
  session++;
  coins = null;
  firstWeek = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCoins(): Coins | null {
  return useSyncExternalStore(subscribe, getCoins, getCoins);
}
export function useFirstWeek(): FirstWeekDTO | null {
  return useSyncExternalStore(subscribe, getFirstWeek, getFirstWeek);
}
```

- [ ] **Step 5: The room store's two entry points, and `mobile/src/lib/coins/actions.ts`**

In `mobile/src/lib/room/cosmeticsStore.ts` (import `type ItemId` from `'./loadout'`), after `saveCosmeticsLoadout`:

```ts
/** A coin-shop purchase landed (spec §6.6): the server's counts; the piece owned and NEW until seen (ruling 7). */
export function applyPurchase(itemId: ItemId, counts: Readonly<Record<string, number>>): void {
  if (!cosmetics) return;
  epoch++; // a read that started before the purchase never brings the old count back
  const owned = new Set(cosmetics.owned);
  owned.add(itemId);
  const fresh = cosmetics.fresh.some((f) => f.itemId === itemId) ? cosmetics.fresh : [...cosmetics.fresh, { itemId, source: 'buy' }];
  publish({ ...cosmetics, owned, counts: { ...counts }, fresh });
}

/** A whole GET body from another route (the grow, spec §7): published as a read is, and only if it is not older. */
export function applyCosmeticsBody(dto: CosmeticsDTO): void {
  epoch++;
  try {
    publish(fromDTO(dto));
  } catch {
    // Not a cosmetics body: keep what is shown.
  }
}
```

Create `mobile/src/lib/coins/actions.ts`:

```ts
import { randomUUID } from 'expo-crypto';
import { postExpand, postPurchase, type PurchaseDTO } from '../../api/coins';
import { applyCosmeticsBody, applyPurchase } from '../room/cosmeticsStore';
import { coinSession, setCoinBalance } from './coinsStore';

// The two coin actions (spec 2026-10-15 §6.6, §7). Never optimistic: nothing changes until the server answers, then
// both stores take the answer. Each attempt carries a request id (ruling 30): the screen keeps it for a retry after a
// network failure, so a retry is the same purchase, and drops it after any server answer.

export const newRequestId = (): string => randomUUID();

/** POST /me/shop/purchases. Throws the ApiError (409 not_enough_coins with `needed`, 400 not_for_sale). */
export async function buyPiece(itemId: string, requestId: string): Promise<PurchaseDTO> {
  const s = coinSession();
  const res = await postPurchase(requestId, itemId);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyPurchase(itemId, res.counts);
  }
  return res;
}

/** POST /me/room/expand. The answer is the whole room. Throws the ApiError (409 gate, 409 stale_tier). */
export async function growRoom(toTier: 2 | 3, requestId: string): Promise<{ stored: number; tier: number }> {
  const s = coinSession();
  const res = await postExpand(requestId, toTier);
  if (s === coinSession()) {
    setCoinBalance(res.balance);
    applyCosmeticsBody(res);
  }
  return { stored: res.stored, tier: res.tier };
}
```

In `mobile/src/components/kip/MyKipScope.tsx` (import `loadCoins`, `resetCoins` from `'../../lib/coins/coinsStore'`),
the effect calls `void loadCoins();` after `void loadCosmetics();` and `resetCoins();` after `resetCosmetics();`; the
comment says "its room, worn pieces and coins".

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinsStore.test.tsx __tests__/lib/coinActions.test.ts __tests__/components/MyKipScope.test.tsx __tests__/lib/cosmeticsStore.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/api/coins.ts mobile/src/lib/coins mobile/src/lib/room/cosmeticsStore.ts mobile/src/components/kip/MyKipScope.tsx mobile/jest-setup.js mobile/jest-mocks/coachScreenHarness.tsx mobile/__tests__/lib/coinsStore.test.tsx mobile/__tests__/lib/coinActions.test.ts mobile/__tests__/components/MyKipScope.test.tsx
git commit -m "feat(mobile): a coins store with the room store's guards, and purchase and grow actions that update both stores"
```

---

### Task 10: Mobile: the wallet chip, the coin history route, and the coin copy

Spec §6.7 (the wallet chip, a coin glyph and the balance, tabular, in the KIP page header, the editor header and the
shop, label "{n} KIP coins. Open coin history"; coin history: "Earned today · 40 of 60" with a bar, "A daily cap keeps
it about habits, not grinding.", rows "label · when · amount", then "How to earn"), §5.2 (the editor header's wallet),
§6.1 (no real-money copy) and §16 Mobile (wallet chip label; history). Rulings 8–11, 29, 35.

**Files:**
- Create: `mobile/src/lib/coins/history.ts`, `mobile/src/components/coins/CoinGlyph.tsx`,
  `mobile/src/components/coins/WalletChip.tsx`, `mobile/src/screens/CoinHistoryScreen.tsx`,
  `mobile/__tests__/lib/coinHistory.test.ts`, `mobile/__tests__/components/WalletChip.test.tsx`,
  `mobile/__tests__/screens/CoinHistoryScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts`, `mobile/src/navigation/RootNavigator.tsx`,
  `mobile/src/navigation/navigationRef.ts`, `mobile/src/screens/CoachScreen.tsx` (header),
  `mobile/src/screens/DecorateRoomScreen.tsx` (header), `mobile/__tests__/lib/roomCopy.test.ts`,
  `mobile/__tests__/screens/KipPage.test.tsx`, `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9's `useCoins`, `loadCoins`, `loadMoreCoins`, `setCoinBalance`, `CoinEventDTO`, `CoinKind`.
- Produces:
  - `roomCopy.ts`: `coinCount(n: number): string` ("1,500") and `ROOM_COPY.coins` (wallet, history, kinds, landed
    lines, How to earn, day and month names);
  - `mobile/src/lib/coins/history.ts`: `whenLabel(at: string, now: Date): string`,
    `interface HistoryRow { key: string; label: string; when: string; amount: string; spoken: string }`,
    `historyRows(events, now): HistoryRow[]`, `todayShare(today: { earned: number; cap: number }): number`;
  - `CoinGlyph({ size? })`, `WalletChip({ testID?, from? })`; route `CoinHistory: { from?: 'shop' } | undefined`
    (`presentation: 'modal'`), in `MODAL_ROUTES`;
  - the wallet in the KIP header (`kip-wallet`) and the editor header (`edit-wallet`).

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/coinHistory.test.ts`:

```ts
import { historyRows, todayShare, whenLabel } from '../../src/lib/coins/history';
import { coinCount } from '../../src/lib/room/roomCopy';

// Built on the device's own clock (ruling 29), so the cases hold in any zone the suite runs in.
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).toISOString();
const NOW = new Date(2026, 10, 11, 18, 40);

it('says when on the device clock: "Today, 07:12", "Yesterday", or the weekday and date', () => {
  expect(whenLabel(at(2026, 10, 11, 7, 12), NOW)).toBe('Today, 07:12');
  expect(whenLabel(at(2026, 10, 10, 23, 59), NOW)).toBe('Yesterday');
  expect(whenLabel(at(2026, 10, 9, 8, 0), NOW)).toBe('Mon 9 Nov');
});

it('labels each row by kind with its amount; a cap row reads +0 with the reason; spoken rows carry no "·" or "−" (ruling 35)', () => {
  const rows = historyRows([
    { kind: 'sleep_goal', amount: 20, at: at(2026, 10, 11, 7, 12), seen: false },
    { kind: 'recap', amount: 0, at: at(2026, 10, 11, 9, 0), seen: true },
    { kind: 'buy', amount: -150, at: at(2026, 10, 10, 12, 0), seen: true },
  ], NOW);
  expect(rows.map((r) => [r.label, r.when, r.amount])).toEqual([
    ['Hit your sleep goal', 'Today, 07:12', '+20'],
    ['Read your weekly recap', 'Today, 09:00', '+0 · daily cap'],
    ['Coin shop', 'Yesterday', '−150'],
  ]);
  expect(rows.map((r) => r.spoken)).toEqual([
    'Hit your sleep goal, Today, 07:12, plus 20 coins',
    'Read your weekly recap, Today, 09:00, plus 0 coins, daily cap',
    'Coin shop, Yesterday, minus 150 coins',
  ]);
  for (const r of rows) expect(r.spoken).not.toMatch(/·|−/);
});

it('fills the day\'s bar to the cap and no further, and groups thousands', () => {
  expect([todayShare({ earned: 40, cap: 60 }), todayShare({ earned: 90, cap: 60 }), todayShare({ earned: 0, cap: 60 })]).toEqual([40 / 60, 1, 0]);
  expect([coinCount(0), coinCount(360), coinCount(1500), coinCount(1234567)]).toEqual(['0', '360', '1,500', '1,234,567']);
});
```

Create `mobile/__tests__/components/WalletChip.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { WalletChip } from '../../src/components/coins/WalletChip';
import { resetCoins, setCoinBalance } from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows nothing until the wallet has loaded', () => {
  expect(render(<WalletChip />).queryByTestId('wallet')).toBeNull();
});

it('is a 44-point outline button with the coin and the balance, labelled for screen readers (spec §6.7, ruling 9)', async () => {
  const s = render(<WalletChip />);
  await act(async () => { setCoinBalance(1500); });
  const chip = s.getByTestId('wallet');
  expect([chip.props.accessibilityRole, chip.props.accessibilityLabel]).toEqual(['button', '1,500 KIP coins. Open coin history']);
  expect(s.getByText('1,500')).toBeTruthy();
  fireEvent.press(chip);
  expect(mockNavigate).toHaveBeenCalledWith('CoinHistory', undefined);
});

it('from the shop, the history leaves out its own way back to the shop', async () => {
  const s = render(<WalletChip from="shop" />);
  await act(async () => { setCoinBalance(5); });
  fireEvent.press(s.getByTestId('wallet'));
  expect(mockNavigate).toHaveBeenCalledWith('CoinHistory', { from: 'shop' });
});
```

Create `mobile/__tests__/screens/CoinHistoryScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchCoins } from '../../src/api/coins';
import { resetCoins } from '../../src/lib/coins/coinsStore';
import { CoinHistoryScreen } from '../../src/screens/CoinHistoryScreen';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

const BODY = (over = {}) => ({
  balance: 360, today: { earned: 40, cap: 60 },
  events: [{ kind: 'sleep_goal', amount: 20, at: new Date().toISOString(), seen: true }, { kind: 'checkin', amount: 5, at: new Date().toISOString(), seen: true }],
  next: null, ...over,
});

async function open(params?: object) {
  mockParams = params;
  const s = render(<CoinHistoryScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows today against the cap with its bar, the rows, How to earn, and the way to the shop (spec §6.7)', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(BODY());
  const s = await open();
  expect(s.getByText('Earned today · 40 of 60').props.accessibilityLabel).toBe('Earned today, 40 of 60');
  expect(s.getByTestId('history-today-bar').props.style).toEqual(expect.objectContaining({ width: '67%' }));
  expect(s.getByText('A daily cap keeps it about habits, not grinding.')).toBeTruthy();
  expect(s.getAllByTestId('history-row')).toHaveLength(2);
  expect(s.getByText('Sleep goal +20')).toBeTruthy();
  fireEvent.press(s.getByTestId('history-shop'));
  expect(mockNav.navigate).toHaveBeenCalledWith('CoinShop');
  fireEvent.press(s.getByTestId('history-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});

it('opened from the shop, it has no button back to the shop', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(BODY());
  expect((await open({ from: 'shop' })).queryByTestId('history-shop')).toBeNull();
});

it('loads the next page with the cursor', async () => {
  (fetchCoins as jest.Mock).mockResolvedValueOnce(BODY({ next: 'c1' })).mockResolvedValueOnce(BODY({ events: [{ kind: 'recap', amount: 10, at: new Date().toISOString(), seen: true }], next: null }));
  const s = await open();
  await act(async () => { fireEvent.press(s.getByTestId('history-more')); });
  expect([(fetchCoins as jest.Mock).mock.calls[1]![0], s.getAllByTestId('history-row').length, s.queryByTestId('history-more')]).toEqual(['c1', 3, null]);
});

it('a failed read offers Try again', async () => {
  (fetchCoins as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(BODY());
  const s = await open();
  await act(async () => { fireEvent.press(s.getByTestId('history-retry')); });
  expect(s.getAllByTestId('history-row')).toHaveLength(2);
});
```

In `mobile/__tests__/lib/roomCopy.test.ts`, replace the test "says nothing is sold, and no string carries a price"
with (ruling 11):

```ts
it('never prices anything in money: no currency, no real-money or ad copy (spec §6.1, ruling 11)', () => {
  const composed = [
    ROOM_COPY.newFor('x', 2), ROOM_COPY.backfill(3), ROOM_COPY.set.pieces(13, 'y'),
    ROOM_COPY.coins.walletLabel('1,500'), ROOM_COPY.coins.earnedToday(40, 60), ROOM_COPY.coins.landSpoken(20, 'Sleep goal hit'),
  ];
  expect(composed.slice(0, 3)).toEqual(["New for KIP's room: x and 2 more", "Your badges unlocked 3 things for KIP's room", '13 pieces · y']);
  for (const s of [JSON.stringify(ROOM_COPY), ...composed]) {
    expect(s).not.toMatch(/[$£€¥]|\b(USD|EUR|GBP)\b|get more coins|buy coins|coin pack|in-app purchase|watch an ad|\bads?\b/i);
  }
  expect(ROOM_COPY.arrive.items.at(-1)!.body).toMatch(/^Nothing is sold/);
});
```

In `mobile/__tests__/screens/KipPage.test.tsx` (import `setCoinBalance`, `resetCoins` from
`'../../src/lib/coins/coinsStore'` and `fetchCoins` from `'../../src/api/coins'`), add (the next read answers 360
too, so the test holds once Task 12 reads the coins on open):

```tsx
it('shows the wallet in the header once the coins have loaded; it opens the coin history (spec §6.7, C6)', async () => {
  resetCoins();
  (fetchCoins as jest.Mock).mockResolvedValueOnce({ balance: 360, today: { earned: 0, cap: 60 }, events: [], next: null });
  setCoinBalance(360);
  const utils = await openChat();
  const chip = utils.getByTestId('kip-wallet');
  expect(chip.props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
  fireEvent.press(chip);
  expect(mockNav.navigate).toHaveBeenCalledWith('CoinHistory', undefined);
  resetCoins();
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` (import `setCoinBalance`, `resetCoins` from
`'../../src/lib/coins/coinsStore'`; add `resetCoins()` to the existing `beforeEach`), add:

```tsx
it('shows the wallet in the editor\'s header (spec §5.2)', async () => {
  setCoinBalance(360);
  const s = await openEditor();
  expect(s.getByTestId('edit-wallet').props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinHistory.test.ts __tests__/components/WalletChip.test.tsx __tests__/screens/CoinHistoryScreen.test.tsx __tests__/lib/roomCopy.test.ts`
Expected: FAIL (no history module, chip or screen; no `ROOM_COPY.coins`).

- [ ] **Step 3: The copy, in `mobile/src/lib/room/roomCopy.ts`**

Above `ROOM_COPY`:

```ts
/** 1500 → "1,500": the wallet's number, with no locale data needed. */
export function coinCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
```

Inside `ROOM_COPY`, after `drawer`:

```ts
  /** KIP coins (spec 2026-10-15 §6.7, C1, F6): the wallet, the history and coins landing. Never a price in money. */
  coins: {
    walletLabel: (n: string) => `${n} KIP coins. Open coin history`,
    historyTitle: 'Coin history',
    close: 'Close',
    earnedToday: (earned: number, cap: number) => `Earned today · ${earned} of ${cap}`,
    earnedTodaySpoken: (earned: number, cap: number) => `Earned today, ${earned} of ${cap}`,
    capLine: 'A daily cap keeps it about habits, not grinding.',
    kinds: {
      sleep_goal: 'Hit your sleep goal', steps: 'Hit your step goal', checkin: 'Morning check-in', recap: 'Read your weekly recap',
      cheer_given: 'You cheered a room', cheer_got: 'A buddy cheered your room', challenge: 'Entered the room challenge',
      firstweek: 'First-week bonus', buy: 'Coin shop', expand: 'Your room grew',
    },
    /** The short line under the room when coins land (spec §6.7): what happened, never a value. */
    landed: {
      sleep_goal: 'Sleep goal hit', steps: 'Step goal hit', checkin: 'Checked in', recap: 'Weekly recap read',
      cheer_given: 'Room cheered', cheer_got: 'Your room got a cheer', challenge: 'Challenge entered', firstweek: 'First-week bonus',
      buy: 'Coin shop', expand: 'Your room grew',
    },
    capped: 'daily cap',
    today: (time: string) => `Today, ${time}`,
    yesterday: 'Yesterday',
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    plus: (n: number) => `+${n}`,
    minus: (n: number) => `−${n}`,
    amountSpoken: (n: number) => (n >= 0 ? `plus ${n} coins` : `minus ${-n} coins`),
    rowSpoken: (label: string, when: string, amount: string) => `${label}, ${when}, ${amount}`,
    howTitle: 'How to earn',
    how: ['Sleep goal +20', 'Step goal +15', 'Recap read +10', 'Check-in +5'],
    loadMore: 'Load more',
    empty: 'No coins yet. Healthy days earn them: a sleep goal, a step goal, a check-in, a weekly recap.',
    shop: 'Coin shop',
    loadFailed: "Couldn't load your coins just now. Check your connection and try again.",
    retry: 'Try again',
    bubble: (n: number) => `+${n}!`,
    landLine: (what: string, more: number) => (more > 0 ? `${what} and ${more} more` : what),
    landSpoken: (n: number, what: string) => `Plus ${n} coins. ${what}`,
  },
```

- [ ] **Step 4: `mobile/src/lib/coins/history.ts`, the glyph, the chip and the screen**

```ts
// The coin history's rows (spec 2026-10-15 §6.7, F6): a label by kind (ruling 35), when on the device's clock (ruling
// 29), and the amount; a 0-coin row says why. Spoken rows use words for the sign and never a "·".
import type { CoinEventDTO } from '../../api/coins';
import { ROOM_COPY } from '../room/roomCopy';

const C = ROOM_COPY.coins;
const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today, 07:12", "Yesterday" or "Mon 9 Nov". */
export function whenLabel(at: string, now: Date): string {
  const d = new Date(at);
  if (sameDay(d, now)) return C.today(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  if (sameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return C.yesterday;
  return `${C.days[d.getDay()]} ${d.getDate()} ${C.months[d.getMonth()]}`;
}

export interface HistoryRow { key: string; label: string; when: string; amount: string; spoken: string }

export function historyRows(events: readonly CoinEventDTO[], now: Date): HistoryRow[] {
  return events.map((e, i) => {
    const label = C.kinds[e.kind] ?? C.kinds.firstweek;
    const when = whenLabel(e.at, now);
    const capped = e.amount === 0;
    const amount = `${e.amount < 0 ? C.minus(-e.amount) : C.plus(e.amount)}${capped ? ` · ${C.capped}` : ''}`;
    return { key: `${e.at}-${i}`, label, when, amount, spoken: C.rowSpoken(label, when, `${C.amountSpoken(e.amount)}${capped ? `, ${C.capped}` : ''}`) };
  });
}

/** How full the day's bar is, 0 to 1. */
export function todayShare(today: { earned: number; cap: number }): number {
  return today.cap > 0 ? Math.max(0, Math.min(1, today.earned / today.cap)) : 0;
}
```

`mobile/src/components/coins/CoinGlyph.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

// The KIP coin (spec 2026-10-15 §6.7): an 8 × 8 pixel coin. Decorative: whatever holds it carries the label.
const COIN: ReadonlyArray<readonly [number, number, number, number, string]> = [
  [2, 0, 4, 1, '#B45309'], [1, 1, 6, 1, '#F59E0B'], [0, 2, 8, 4, '#F59E0B'], [1, 6, 6, 1, '#F59E0B'], [2, 7, 4, 1, '#B45309'],
  [0, 2, 1, 4, '#B45309'], [7, 2, 1, 4, '#B45309'], [3, 2, 2, 4, '#FDE68A'],
];

export function CoinGlyph({ size = 14 }: { size?: number }) {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 8 8">
        {COIN.map(([x, y, w, h, fill], i) => <Rect key={i} x={x} y={y} width={w} height={h} fill={fill} />)}
      </Svg>
    </View>
  );
}
```

`mobile/src/components/coins/WalletChip.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { CoinGlyph } from './CoinGlyph';
import { useCoins } from '../../lib/coins/coinsStore';
import { ROOM_COPY, coinCount } from '../../lib/room/roomCopy';

// The wallet (spec 2026-10-15 §6.7): the coin and the balance, tabular, in the KIP page's header, the editor's and the
// shop's. A shadcn Button (ruling 9), 44 points tall, that opens the coin history. Nothing until the first read lands.
export function WalletChip({ testID = 'wallet', from }: { testID?: string; from?: 'shop' }) {
  const coins = useCoins();
  const navigation = useNavigation<any>();
  if (!coins) return null;
  const n = coinCount(coins.balance);
  return (
    <Button
      testID={testID}
      variant="outline"
      size="sm"
      className="h-[44px] px-3"
      accessibilityLabel={ROOM_COPY.coins.walletLabel(n)}
      onPress={() => navigation.navigate('CoinHistory', from ? { from } : undefined)}
    >
      <View className="flex-row items-center gap-1.5">
        <CoinGlyph />
        <Text className="text-caption font-medium" style={{ fontVariant: ['tabular-nums'] }}>{n}</Text>
      </View>
    </Button>
  );
}
```

`mobile/src/screens/CoinHistoryScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { loadCoins, loadMoreCoins, useCoins } from '../lib/coins/coinsStore';
import { historyRows, todayShare } from '../lib/coins/history';
import { ROOM_COPY } from '../lib/room/roomCopy';

const C = ROOM_COPY.coins;

// Coin history (spec 2026-10-15 §6.7, F6's sheet): the native modal sheet (ruling 8). Today against the cap with its
// bar, the rows newest first with Load more, How to earn, and the way to the shop (not when it was opened from there).
// Opening it reads the server, which also catches up on earns.
export function CoinHistoryScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { from?: 'shop' };
  const coins = useCoins();
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    void loadCoins().then((c) => setFailed(!c));
  }, []);
  useEffect(() => { load(); }, [load]);
  const rows = coins ? historyRows(coins.events, new Date()) : [];
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <PageTitle>{C.historyTitle}</PageTitle>
        <Button testID="history-close" variant="ghost" className="h-[44px]" onPress={() => navigation.goBack()}>{C.close}</Button>
      </View>
      {!coins ? (
        failed ? (
          <View testID="history-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{C.loadFailed}</Text>
            <Button testID="history-retry" className="h-[44px]" onPress={load}>{C.retry}</Button>
          </View>
        ) : (
          <Skeleton testID="history-loading" className="m-4 h-40 rounded-lg" />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          <Card testID="history-today" className="gap-2 p-3">
            <Text accessibilityLabel={C.earnedTodaySpoken(coins.today.earned, coins.today.cap)} className="text-body">
              {C.earnedToday(coins.today.earned, coins.today.cap)}
            </Text>
            <View className="h-2 overflow-hidden rounded-lg bg-muted">
              <View testID="history-today-bar" className="h-2 rounded-lg bg-primary" style={{ width: `${Math.round(todayShare(coins.today) * 100)}%` }} />
            </View>
            <Text className="text-caption text-muted-foreground">{C.capLine}</Text>
          </Card>
          {rows.length ? (
            <View testID="history-rows">
              {rows.map((r) => (
                <View key={r.key} testID="history-row" accessible accessibilityLabel={r.spoken} className="flex-row items-center justify-between gap-3 border-b border-border py-2">
                  <View className="shrink gap-0.5">
                    <Text className="text-body">{r.label}</Text>
                    <Text className="text-caption text-muted-foreground">{r.when}</Text>
                  </View>
                  <Text className="text-body font-medium" style={{ fontVariant: ['tabular-nums'] }}>{r.amount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text testID="history-empty" className="text-caption text-muted-foreground">{C.empty}</Text>
          )}
          {coins.next ? <Button testID="history-more" variant="outline" className="h-[44px]" onPress={() => void loadMoreCoins()}>{C.loadMore}</Button> : null}
          <View testID="history-how" className="gap-1">
            <SectionLabel>{C.howTitle}</SectionLabel>
            {C.how.map((line) => <Text key={line} className="text-caption">{line}</Text>)}
          </View>
          {params.from === 'shop' ? null : <Button testID="history-shop" className="h-[44px]" onPress={() => navigation.navigate('CoinShop')}>{C.shop}</Button>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: The route and the two headers**

In `mobile/src/navigation/RootNavigator.tsx`: import `CoinHistoryScreen`; add to `RootStackParamList`

```ts
  // Coin history (spec 2026-10-15 §6.7): the native sheet, from any wallet chip; from the shop it has no shop button.
  CoinHistory: { from?: 'shop' } | undefined;
```

and after the `DecorateRoom` screen:

```tsx
              <Stack.Screen name="CoinHistory" component={CoinHistoryScreen} options={{ headerShown: false, presentation: 'modal' }} />
```

In `mobile/src/navigation/navigationRef.ts`, `MODAL_ROUTES` becomes
`new Set<keyof RootStackParamList>(['RecapStory', 'DecorateRoom', 'CoinHistory'])`.

In `mobile/src/screens/CoachScreen.tsx` (import `WalletChip` from `'../components/coins/WalletChip'`), the header's
button row starts with the chip: `<View className="flex-row gap-2">` then `<WalletChip testID="kip-wallet" />` then
the Decorate button.

In `mobile/src/screens/DecorateRoomScreen.tsx` (import `WalletChip`), the editor header's Done becomes:

```tsx
        <View className="flex-row items-center gap-2">
          <WalletChip testID="edit-wallet" />
          <Button testID="edit-done" disabled={!changed || saving} loading={saving} onPress={() => void save()}>{ROOM_COPY.done}</Button>
        </View>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinHistory.test.ts __tests__/components/WalletChip.test.tsx __tests__/screens/CoinHistoryScreen.test.tsx __tests__/lib/roomCopy.test.ts __tests__/screens/KipPage.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/conventions`
Expected: PASS (the conventions guards find no raw button and only A4 tokens).

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/lib/coins/history.ts mobile/src/components/coins mobile/src/screens/CoinHistoryScreen.tsx mobile/src/lib/room/roomCopy.ts mobile/src/navigation mobile/src/screens/CoachScreen.tsx mobile/src/screens/DecorateRoomScreen.tsx mobile/__tests__
git commit -m "feat(mobile): the wallet chip in the KIP and editor headers and the coin history sheet with today's cap"
```

---

### Task 11: Mobile: the coin shop (`CoinShop` route), its piece sheet, and the editor's drawer and counts

Spec §6.6 (the shop: from the drawer's header, the KIP page wallet and the coin history; header "Coin shop", the wallet;
tabs; This week's set card; tiles with icon, name, price with the coin glyph, "×1 owned"; the piece sheet: name, where
it goes, "You have 360 · 210 after", "Goes to your inventory", Not now and Get for 150; with too few coins "Needs 40
more", disabled; never optimistic, loading until the server answers, then in the inventory with NEW; the footer), §6.5
(a rule piece shows locked with its rule), §5.4 (the drawer header's "Coin shop") and §16 Mobile (the purchase waits for
the server; disabled "Needs n more"). Rulings 3, 4, 8, 13, 30, 34, 36.

**Files:**
- Create: `mobile/src/lib/coins/shop.ts`, `mobile/src/screens/CoinShopScreen.tsx`, `mobile/__tests__/lib/coinShop.test.ts`,
  `mobile/__tests__/screens/CoinShopScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts` (`ROOM_COPY.shop`, `drawer.shop`), `mobile/src/lib/room/edit/editor.ts`
  (`counts` action), `mobile/src/components/edit/InventoryDrawer.tsx`, `mobile/src/screens/DecorateRoomScreen.tsx`,
  `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/navigation/navigationRef.ts`, `mobile/__tests__/lib/editor.test.ts`,
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9's `fetchShop`, `ShopDTO`, `buyPiece`, `newRequestId`, `loadCoins`, `useCoins`, `applyPurchase`;
  Task 10's `WalletChip`, `CoinGlyph`, `coinCount`; P1's `ItemIcon`, `useMyKip`, `catalogueItem`, `itemName`,
  `spokenName`, `unlockLine`, `unlockSpoken`, `markCosmeticsSeen`.
- Produces:
  - `mobile/src/lib/coins/shop.ts`: `type ShopTab = 'all' | 'floor' | 'wall' | 'onTop'`, `SHOP_TABS`,
    `interface ShopTile { itemId: string; name: string; price: number; owned: number; locked: boolean; lockLine: string | null; label: string; featured: boolean }`,
    `shopTiles(shop, counts, tab, featuredOnly?): ShopTile[]`, `whereLine(itemId): { text: string; spoken: string }`,
    `interface PieceSheet { name: string; where: { text: string; spoken: string }; locked: string | null; have: string; haveSpoken: string; canBuy: boolean; button: string }`,
    `pieceSheet(itemId, price, balance, counts): PieceSheet`;
  - route `CoinShop: undefined` (`fullScreenModal`), in `MODAL_ROUTES`;
  - editor action `{ type: 'counts'; counts: Readonly<Record<ItemId, number>>; grew: readonly ItemId[] }`;
  - `InventoryDrawer` prop `onOpenShop?: () => void` (button `drawer-shop`).

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/coinShop.test.ts`:

```ts
import type { ShopDTO } from '../../src/api/coins';
import { pieceSheet, shopTiles, whereLine } from '../../src/lib/coins/shop';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const SHOP: ShopDTO = {
  week: '2026-W44',
  set: { id: 'deskDay', itemIds: ['item.mug', 'item.radio'] },
  items: [{ itemId: 'plant.monstera', price: 140 }, { itemId: 'art.neonheart', price: 200 }, { itemId: 'item.radio', price: 150 }, { itemId: 'item.mug', price: 25 }, { itemId: 'rug.slate', price: 80 }],
};

it('lists the week\'s set first, prices shop pieces, and locks a rule piece not earned yet with its rule (spec §6.5, §6.6)', () => {
  const tiles = shopTiles(SHOP, STARTER_COUNTS, 'all');
  expect(tiles.map((t) => t.itemId)).toEqual(['item.radio', 'item.mug', 'plant.monstera', 'art.neonheart', 'rug.slate']);
  const monstera = tiles.find((t) => t.itemId === 'plant.monstera')!;
  expect([monstera.locked, monstera.lockLine, monstera.label]).toEqual([true, 'Sleep goal · I', 'Monstera, locked. Sleep goal, level 1']);
  expect(tiles.find((t) => t.itemId === 'item.mug')!.label).toBe('Mug, 25 coins, 1 owned');
  expect(shopTiles(SHOP, { ...STARTER_COUNTS, 'plant.monstera': 1 }, 'all').find((t) => t.itemId === 'plant.monstera')!.locked).toBe(false);
});

it('filters by where a piece goes, and to the week\'s set (ruling 13)', () => {
  expect(shopTiles(SHOP, STARTER_COUNTS, 'wall').map((t) => t.itemId)).toEqual(['art.neonheart']);
  expect(shopTiles(SHOP, STARTER_COUNTS, 'onTop').map((t) => t.itemId)).toEqual(['item.radio', 'item.mug', 'plant.monstera']);
  expect(shopTiles(SHOP, STARTER_COUNTS, 'all', true).map((t) => t.itemId)).toEqual(['item.radio', 'item.mug']);
});

it('says where it goes, what you have and have after, or what is still needed (C1)', () => {
  expect(whereLine('item.radio')).toEqual({ text: 'Shelf, desk or floor · 1 tile', spoken: 'Shelf, desk or floor, 1 tile' });
  expect(whereLine('rug.slate')).toEqual({ text: 'Floor · 4 × 4 tiles', spoken: 'Floor, 4 by 4 tiles' });
  expect(whereLine('art.neonheart')).toEqual({ text: 'Wall', spoken: 'Wall' });
  expect(pieceSheet('item.radio', 150, 360, STARTER_COUNTS)).toEqual({
    name: 'Old radio', where: whereLine('item.radio'), locked: null,
    have: 'You have 360 · 210 after', haveSpoken: 'You have 360, 210 after', canBuy: true, button: 'Get for 150',
  });
  const short = pieceSheet('item.radio', 150, 110, STARTER_COUNTS);
  expect([short.canBuy, short.button, short.have]).toEqual([false, 'Needs 40 more', 'You have 110']);
  expect(pieceSheet('plant.monstera', 140, 999, STARTER_COUNTS)).toEqual(expect.objectContaining({ locked: 'Sleep goal · I', canBuy: false }));
});
```

Create `mobile/__tests__/screens/CoinShopScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { fetchCoins, fetchShop, postPurchase, type ShopDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetCoins } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { CoinShopScreen } from '../../src/screens/CoinShopScreen';
import { cosmeticsDTO, STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined), postRoomWelcomed: jest.fn() }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: undefined }) }));

const SHOP: ShopDTO = {
  week: '2026-W44', set: { id: 'deskDay', itemIds: ['item.radio', 'item.mug'] },
  items: [{ itemId: 'item.radio', price: 150 }, { itemId: 'item.mug', price: 25 }, { itemId: 'plant.monstera', price: 140 }, { itemId: 'art.neonheart', price: 200 }],
};
const wallet = (balance: number) => ({ balance, today: { earned: 0, cap: 60 }, events: [], next: null });

async function open(balance = 360) {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  (fetchCoins as jest.Mock).mockResolvedValue(wallet(balance));
  (fetchShop as jest.Mock).mockResolvedValue(SHOP);
  await act(async () => { await loadCosmetics(); });
  const s = render(<CoinShopScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); resetCosmetics(); });

it('shows the week\'s set card, tiles with prices, a locked rule piece with its rule, the wallet and the footer (spec §6.6)', async () => {
  const s = await open();
  expect(s.getByText('Desk day set · 2 pieces · this week').props.accessibilityLabel).toBe('Desk day set, 2 pieces, this week');
  expect(s.getByTestId('shop-tile-item.radio').props.accessibilityLabel).toBe('Old radio, 150 coins');
  expect(s.getByTestId('shop-tile-plant.monstera').props.accessibilityLabel).toBe('Monstera, locked. Sleep goal, level 1');
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('360 KIP coins. Open coin history');
  expect(s.getByText('Coins come from healthy days only. They can’t be bought.')).toBeTruthy();
  fireEvent.press(s.getByTestId('shop-tab-wall'));
  expect(s.queryByTestId('shop-tile-item.radio')).toBeNull();
  expect(s.getByTestId('shop-tile-art.neonheart')).toBeTruthy();
});

it('buys only when the server answers: one request for two taps, then NEW in the inventory and the new balance (Review Focus 3)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  expect(s.getByTestId('shop-sheet-have')).toHaveTextContent('You have 360 · 210 after');
  let resolve!: (v: unknown) => void;
  (postPurchase as jest.Mock).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  fireEvent.press(s.getByTestId('shop-get'));
  fireEvent.press(s.getByTestId('shop-get'));
  expect(postPurchase).toHaveBeenCalledTimes(1);
  expect(s.getByTestId('shop-get').props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
  expect(getCosmetics()!.counts['item.radio']).toBeUndefined(); // never optimistic
  await act(async () => { resolve({ balance: 210, counts: { ...STARTER_COUNTS, 'item.radio': 1 } }); });
  expect(s.queryByTestId('shop-sheet')).toBeNull();
  expect(s.getByTestId('shop-notice')).toHaveTextContent('Old radio is in your inventory.');
  expect([getCosmetics()!.counts['item.radio'], getCosmetics()!.fresh]).toEqual([1, [{ itemId: 'item.radio', source: 'buy' }]]);
  expect(s.getByTestId('shop-wallet').props.accessibilityLabel).toBe('210 KIP coins. Open coin history');
});

it('with too few coins the button is disabled and says what is still needed', async () => {
  const s = await open(110);
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  expect(s.getByTestId('shop-get')).toHaveTextContent('Needs 40 more');
  expect(s.getByTestId('shop-get').props.accessibilityState.disabled).toBe(true);
});

it('a dropped connection keeps the request id, so the retry is the same purchase; a server answer drops it (ruling 30)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  (postPurchase as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect(s.getByTestId('shop-notice')).toHaveTextContent("Couldn't get it just now. Try again.");
  (postPurchase as jest.Mock).mockRejectedValueOnce(new ApiError(409, 'x', 'not_enough_coins', { error: 'not_enough_coins', needed: 40 }));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  const [first, second] = (postPurchase as jest.Mock).mock.calls.map((c) => c[0]);
  expect(second).toBe(first);
  expect(s.getByTestId('shop-notice')).toHaveTextContent('Not enough coins for that yet.');
  expect((fetchCoins as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2); // the wallet is read again
  (postPurchase as jest.Mock).mockResolvedValueOnce({ balance: 335, counts: { ...STARTER_COUNTS, 'item.mug': 2 } });
  fireEvent.press(s.getByTestId('shop-not-now'));
  fireEvent.press(s.getByTestId('shop-tile-item.mug'));
  await act(async () => { fireEvent.press(s.getByTestId('shop-get')); });
  expect((postPurchase as jest.Mock).mock.calls[2]![0]).not.toBe(first);
});

it('a locked piece\'s sheet shows how it is earned and no Get button; Close goes back', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tile-plant.monstera'));
  expect(s.getByTestId('shop-sheet-locked')).toHaveTextContent('Earn it first: Sleep goal · I');
  expect(s.queryByTestId('shop-get')).toBeNull();
  fireEvent.press(s.getByTestId('shop-close'));
  expect(mockNav.goBack).toHaveBeenCalled();
});
```

In `mobile/__tests__/lib/editor.test.ts`, add:

```ts
describe('counts from the store (ruling 36)', () => {
  it('takes new counts and lists the pieces that grew as new, so the New tab shows them', () => {
    const s = run(start(), { type: 'counts', counts: { ...COUNTS, 'item.radio': 1 }, grew: ['item.radio'] });
    expect([s.counts['item.radio'], s.newIds, inventory(s)['item.radio']]).toEqual([1, ['item.radio'], 1]);
    expect(run(s, { type: 'counts', counts: s.counts, grew: ['item.radio'] }).newIds).toEqual(['item.radio']);
  });
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` (import `applyPurchase` from the store and
`postCosmeticsSeen` from the API mock), add:

```tsx
it('a piece bought from the editor\'s shop appears in the drawer with NEW and is marked seen (ruling 36)', async () => {
  const s = await openEditor();
  fireEvent.press(s.getByTestId('drawer-shop'));
  expect(mockNav.navigate).toHaveBeenCalledWith('CoinShop');
  await act(async () => { applyPurchase('item.radio', { ...STARTER_COUNTS, 'item.radio': 1 }); });
  fireEvent.press(s.getByTestId('drawer-tab-new'));
  expect(s.getByTestId('drawer-tile-item.radio')).toBeTruthy();
  expect(postCosmeticsSeen).toHaveBeenCalledWith(['item.radio']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinShop.test.ts __tests__/screens/CoinShopScreen.test.tsx __tests__/lib/editor.test.ts __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no shop module or screen; no `counts` action; no `drawer-shop`).

- [ ] **Step 3: The copy**

In `ROOM_COPY.drawer`, add `shop: 'Coin shop',`. After `ROOM_COPY.coins`, add:

```ts
  /** The coin shop (spec 2026-10-15 §6.6, C1, F6). Prices are coins only (ruling 11). */
  shop: {
    title: 'Coin shop',
    sub: 'A new featured set every Monday',
    close: 'Close',
    tabsLabel: 'Coin shop',
    tabs: { all: 'All', floor: 'Floor', wall: 'Wall', onTop: 'On top' },
    thisWeek: 'This week',
    sets: { cosyAutumn: 'Cosy autumn', greenCorner: 'Green corner', deskDay: 'Desk day', brightNight: 'Bright night' } as Readonly<Record<string, string>>,
    setLine: (name: string, n: number) => `${name} set · ${n} pieces · this week`,
    setSpoken: (name: string, n: number) => `${name} set, ${n} pieces, this week`,
    seeSet: 'See the set',
    seeAll: 'See everything',
    tile: (name: string, price: string, owned: number) => `${name}, ${price} coins${owned ? `, ${owned} owned` : ''}`,
    tileLocked: (name: string, rule: string) => `${name}, locked. ${rule}`,
    owned: (n: number) => `×${n} owned`,
    where: {
      anywhere: 'Shelf, desk or floor', floor: 'Floor', onTop: 'Shelf or desk', wall: 'Wall',
      tiles: (w: number, d: number) => (w * d === 1 ? '1 tile' : `${w} × ${d} tiles`),
      tilesSpoken: (w: number, d: number) => (w * d === 1 ? '1 tile' : `${w} by ${d} tiles`),
    },
    have: (balance: string, after: string) => `You have ${balance} · ${after} after`,
    haveSpoken: (balance: string, after: string) => `You have ${balance}, ${after} after`,
    haveOnly: (balance: string) => `You have ${balance}`,
    goes: 'Goes to your inventory',
    get: (price: string) => `Get for ${price}`,
    needs: (n: string) => `Needs ${n} more`,
    notNow: 'Not now',
    lockedLead: 'Earn it first:',
    bought: (name: string) => `${name} is in your inventory.`,
    short: 'Not enough coins for that yet.',
    notForSale: "That piece isn't in the shop just now.",
    failed: "Couldn't get it just now. Try again.",
    loadFailed: "Couldn't open the shop just now. Check your connection and try again.",
    retry: 'Try again',
    footer: 'Coins come from healthy days only. They can’t be bought.',
  },
```

- [ ] **Step 4: `mobile/src/lib/coins/shop.ts`**

```ts
// The coin shop's tiles and piece sheet (spec 2026-10-15 §6.6, C1, F6), pure. Tabs All, Floor, Wall and On top (ruling
// 13); the week's featured set first. A rule piece not earned yet shows locked with its rule, never as for sale (§6.5).
import type { ShopDTO } from '../../api/coins';
import { catalogueItem, type UnlockRule } from '../room/catalogue';
import { ROOM_COPY, coinCount, itemName, spokenName, unlockLine, unlockSpoken } from '../room/roomCopy';

export type ShopTab = 'all' | 'floor' | 'wall' | 'onTop';
export const SHOP_TABS: readonly ShopTab[] = ['all', 'floor', 'wall', 'onTop'];

export interface ShopTile {
  itemId: string;
  name: string;
  price: number;
  owned: number;
  locked: boolean;
  lockLine: string | null;
  label: string;
  featured: boolean;
}

const S = ROOM_COPY.shop;
const lockedFor = (rule: UnlockRule, owned: number) => rule.kind !== 'shop' && rule.kind !== 'starter' && owned === 0;

export function shopTiles(shop: ShopDTO, counts: Readonly<Record<string, number>>, tab: ShopTab, featuredOnly = false): ShopTile[] {
  const featured = new Set(shop.set.itemIds);
  return shop.items
    .filter(({ itemId }) => {
      const iso = catalogueItem(itemId)?.iso;
      if (!iso || (featuredOnly && !featured.has(itemId))) return false;
      return tab === 'all' || iso.layers.includes(tab);
    })
    .map(({ itemId, price }): ShopTile => {
      const item = catalogueItem(itemId)!;
      const owned = counts[itemId] ?? 0;
      const locked = lockedFor(item.unlock, owned);
      return {
        itemId, name: itemName(itemId), price, owned, locked, lockLine: locked ? unlockLine(item.unlock) : null,
        label: locked ? S.tileLocked(spokenName(itemId), unlockSpoken(item.unlock)) : S.tile(spokenName(itemId), coinCount(price), owned),
        featured: featured.has(itemId),
      };
    })
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

/** "Shelf, desk or floor · 1 tile" (C1), and its spoken form. */
export function whereLine(itemId: string): { text: string; spoken: string } {
  const iso = catalogueItem(itemId)?.iso;
  if (!iso) return { text: '', spoken: '' };
  const floor = iso.layers.includes('floor');
  const place = iso.layers.includes('wall') ? S.where.wall : floor && iso.layers.includes('onTop') ? S.where.anywhere : floor ? S.where.floor : S.where.onTop;
  if (!floor || !iso.foot) return { text: place, spoken: place };
  const [w, d] = iso.foot;
  return { text: `${place} · ${S.where.tiles(w, d)}`, spoken: `${place}, ${S.where.tilesSpoken(w, d)}` };
}

export interface PieceSheet {
  name: string;
  where: { text: string; spoken: string };
  /** The rule's line when the piece must be earned first; null when it is for sale. */
  locked: string | null;
  have: string;
  haveSpoken: string;
  canBuy: boolean;
  button: string;
}

export function pieceSheet(itemId: string, price: number, balance: number, counts: Readonly<Record<string, number>>): PieceSheet {
  const item = catalogueItem(itemId)!;
  const locked = lockedFor(item.unlock, counts[itemId] ?? 0) ? unlockLine(item.unlock) : null;
  const after = balance - price;
  const [b, a] = [coinCount(balance), coinCount(Math.max(0, after))];
  return {
    name: itemName(itemId),
    where: whereLine(itemId),
    locked,
    have: after >= 0 ? S.have(b, a) : S.haveOnly(b),
    haveSpoken: after >= 0 ? S.haveSpoken(b, a) : S.haveOnly(b),
    canBuy: !locked && after >= 0,
    button: after >= 0 ? S.get(coinCount(price)) : S.needs(coinCount(-after)),
  };
}
```

- [ ] **Step 5: `mobile/src/screens/CoinShopScreen.tsx`**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { fetchShop, type ShopDTO } from '../api/coins';
import { CoinGlyph } from '../components/coins/CoinGlyph';
import { WalletChip } from '../components/coins/WalletChip';
import { ItemIcon } from '../components/room/ItemIcon';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { SectionLabel } from '../components/ui/section-label';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { buyPiece, newRequestId } from '../lib/coins/actions';
import { loadCoins, useCoins } from '../lib/coins/coinsStore';
import { SHOP_TABS, pieceSheet, shopTiles, type ShopTab } from '../lib/coins/shop';
import { useMyKip } from '../lib/kip/myKip';
import { getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { ROOM_COPY, coinCount, itemName } from '../lib/room/roomCopy';

const S = ROOM_COPY.shop;
const TARGET = 'h-[44px]';

// The coin shop (spec 2026-10-15 §6.6, C1, F6), full screen (ruling 8). The week's featured set, the tabs, the tiles
// (a rule piece not earned yet is locked with its rule), and the piece sheet, a panel at the bottom: where it goes, what
// you have and have after, Not now and Get for n. Never optimistic: Get stays loading until the server answers, then
// the piece is in the inventory with NEW. A dropped connection keeps the attempt's request id, so a retry can't buy twice.
export function CoinShopScreen() {
  const navigation = useNavigation<any>();
  const me = useMyKip();
  const cosmetics = useCosmetics();
  const coins = useCoins();
  const [shop, setShop] = useState<ShopDTO | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<ShopTab>('all');
  const [setOnly, setSetOnly] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef<{ itemId: string; requestId: string } | null>(null);
  const busy = useRef(false);

  const load = useCallback(() => {
    setFailed(false);
    void loadCoins();
    if (!getCosmetics()) void loadCosmetics();
    fetchShop().then(setShop, () => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const say = (text: string) => {
    setNotice(text);
    AccessibilityInfo.announceForAccessibility(text);
  };
  const buy = async (itemId: string) => {
    if (busy.current) return;
    busy.current = true;
    if (attempt.current?.itemId !== itemId) attempt.current = { itemId, requestId: newRequestId() };
    setBuying(true);
    setNotice(null);
    try {
      await buyPiece(itemId, attempt.current.requestId);
      attempt.current = null;
      setPicked(null);
      say(S.bought(itemName(itemId)));
    } catch (err) {
      if (err instanceof ApiError) {
        // The server answered: nothing was bought, and a new tap is a new purchase.
        attempt.current = null;
        if (err.code === 'not_enough_coins') {
          await loadCoins();
          say(S.short);
        } else {
          say(S.notForSale);
        }
      } else {
        say(S.failed);
      }
    } finally {
      busy.current = false;
      setBuying(false);
    }
  };

  const counts = cosmetics?.counts ?? {};
  const offer = picked && shop ? shop.items.find((i) => i.itemId === picked) : undefined;
  const sheet = offer ? pieceSheet(offer.itemId, offer.price, coins?.balance ?? 0, counts) : null;
  const setName = shop ? S.sets[shop.set.id] ?? shop.set.id : '';
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
        <Button testID="shop-close" variant="ghost" className={TARGET} disabled={buying} onPress={() => navigation.goBack()}>{S.close}</Button>
        <PageTitle>{S.title}</PageTitle>
        <WalletChip testID="shop-wallet" from="shop" />
      </View>
      <Text className="px-4 pb-2 text-caption text-muted-foreground">{S.sub}</Text>
      {notice ? <Text testID="shop-notice" accessibilityLiveRegion="polite" className="px-4 pb-2 text-caption">{notice}</Text> : null}
      {!shop ? (
        failed ? (
          <View testID="shop-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{S.loadFailed}</Text>
            <Button testID="shop-retry" className={TARGET} onPress={load}>{S.retry}</Button>
          </View>
        ) : (
          <Skeleton testID="shop-loading" className="m-4 h-72 rounded-lg" />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: sheet ? 280 : 32 }}>
          {shop.set.itemIds.length ? (
            <Card testID="shop-week" className="mx-4 mb-3 gap-2 p-3">
              <SectionLabel>{S.thisWeek}</SectionLabel>
              <Text accessibilityLabel={S.setSpoken(setName, shop.set.itemIds.length)} className="text-body">{S.setLine(setName, shop.set.itemIds.length)}</Text>
              <View className="flex-row">
                <Button testID="shop-week-toggle" variant="outline" size="sm" className={TARGET} onPress={() => setSetOnly((v) => !v)}>{setOnly ? S.seeAll : S.seeSet}</Button>
              </View>
            </Card>
          ) : null}
          <View testID="shop-tabs" accessibilityRole="tablist" accessibilityLabel={S.tabsLabel} className="flex-row flex-wrap gap-2 px-4 pb-3">
            {SHOP_TABS.map((t) => (
              <Button key={t} testID={`shop-tab-${t}`} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} size="sm" className={TARGET}
                variant={tab === t ? 'default' : 'outline'} onPress={() => setTab(t)}>
                {S.tabs[t]}
              </Button>
            ))}
          </View>
          <View className="flex-row flex-wrap gap-2 px-4">
            {shopTiles(shop, counts, tab, setOnly).map((t) => (
              <Button key={t.itemId} testID={`shop-tile-${t.itemId}`} variant="outline" className="h-auto min-h-[96px] w-[31%] p-2"
                accessibilityLabel={t.label} accessibilityState={{ selected: picked === t.itemId }}
                onPress={() => { setPicked(t.itemId); setNotice(null); }}>
                <View className="items-center gap-1" style={{ opacity: t.locked ? 0.45 : 1 }}>
                  <ItemIcon id={t.itemId} colour={me.colour} />
                  <Text className="text-center text-fine" numberOfLines={2}>{t.name}</Text>
                  {t.locked ? (
                    <Text className="text-center text-fine text-muted-foreground" numberOfLines={2}>{t.lockLine}</Text>
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <CoinGlyph size={10} />
                      <Text className="text-fine" style={{ fontVariant: ['tabular-nums'] }}>{coinCount(t.price)}</Text>
                    </View>
                  )}
                  {t.owned > 0 ? <Text className="text-fine text-muted-foreground">{S.owned(t.owned)}</Text> : null}
                </View>
              </Button>
            ))}
          </View>
          <Text className="px-4 pt-4 text-fine text-muted-foreground">{S.footer}</Text>
        </ScrollView>
      )}
      {sheet && picked ? (
        <View testID="shop-sheet" accessibilityViewIsModal className="absolute bottom-0 left-0 right-0 gap-2 rounded-t-lg border-t border-border bg-background p-4 pb-8">
          <Text className="text-heading">{sheet.name}</Text>
          {sheet.where.text ? <Text accessibilityLabel={sheet.where.spoken} className="text-caption text-muted-foreground">{sheet.where.text}</Text> : null}
          {sheet.locked ? (
            <Text testID="shop-sheet-locked" className="text-body">{`${S.lockedLead} ${sheet.locked}`}</Text>
          ) : (
            <>
              <Text testID="shop-sheet-have" accessibilityLabel={sheet.haveSpoken} className="text-body">{sheet.have}</Text>
              <Text className="text-caption text-muted-foreground">{S.goes}</Text>
            </>
          )}
          <View className="flex-row gap-2">
            <Button testID="shop-not-now" variant="outline" className={`${TARGET} flex-1`} disabled={buying} onPress={() => setPicked(null)}>{S.notNow}</Button>
            {sheet.locked ? null : (
              <Button testID="shop-get" className={`${TARGET} flex-1`} disabled={!sheet.canBuy} loading={buying} onPress={() => void buy(picked)}>{sheet.button}</Button>
            )}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: The route, the drawer's button and the editor's counts**

`RootNavigator.tsx`: import `CoinShopScreen`; `RootStackParamList` gains
`// The coin shop (spec 2026-10-15 §6.6), full screen: from the drawer, the coin history and the first-week card.`
`CoinShop: undefined;` and after `CoinHistory`:

```tsx
              <Stack.Screen name="CoinShop" component={CoinShopScreen} options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
```

`navigationRef.ts`: `MODAL_ROUTES` adds `'CoinShop'`.

`mobile/src/lib/room/edit/editor.ts`: `EditorAction` gains
`| { type: 'counts'; counts: Readonly<Record<ItemId, number>>; grew: readonly ItemId[] }` and `reduce` the case:

```ts
    case 'counts':
      // The store's counts while the editor is open (ruling 36): a piece bought meanwhile joins the New tab.
      return { ...s, counts: a.counts, newIds: [...s.newIds, ...a.grew.filter((id) => !s.newIds.includes(id))] };
```

`mobile/src/components/edit/InventoryDrawer.tsx`: the props gain `/** The drawer header's Coin shop (spec §5.4, §6.6). */ onOpenShop?: () => void;`
and the header's right side becomes:

```tsx
        <View className="flex-row gap-2">
          {onOpenShop ? <Button testID="drawer-shop" variant="outline" size="sm" className={TARGET} onPress={onOpenShop}>{D.shop}</Button> : null}
          <Button testID="drawer-handle" variant="ghost" size="sm" className={TARGET} accessibilityLabel={full ? D.less : D.more} onPress={() => setFull((v) => !v)}>
            {full ? D.less : D.more}
          </Button>
        </View>
```

`mobile/src/screens/DecorateRoomScreen.tsx`, in `Editor` (after the mark-seen effect):

```tsx
  // The store's counts follow a purchase made from this editor's shop (ruling 36): new copies join the New tab and,
  // being shown, are marked seen, as opening the editor marks what it shows.
  const shownCounts = useRef(cosmetics.counts);
  useEffect(() => {
    if (cosmetics.counts === shownCounts.current) return;
    const before = shownCounts.current;
    shownCounts.current = cosmetics.counts;
    const grew = Object.keys(cosmetics.counts).filter((id) => (cosmetics.counts[id] ?? 0) > (before[id] ?? 0));
    dispatch({ type: 'counts', counts: cosmetics.counts, grew });
    if (grew.length) void markCosmeticsSeen(grew);
  }, [cosmetics.counts]);
```

and the drawer gets `onOpenShop={() => navigation.navigate('CoinShop')}`.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinShop.test.ts __tests__/screens/CoinShopScreen.test.tsx __tests__/lib/editor.test.ts __tests__/screens/DecorateRoomScreen.test.tsx __tests__/components/InventoryDrawer.test.tsx __tests__/conventions`
Expected: PASS.

- [ ] **Step 8: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/lib/coins/shop.ts mobile/src/screens/CoinShopScreen.tsx mobile/src/lib/room/roomCopy.ts mobile/src/lib/room/edit/editor.ts mobile/src/components/edit/InventoryDrawer.tsx mobile/src/screens/DecorateRoomScreen.tsx mobile/src/navigation mobile/__tests__
git commit -m "feat(mobile): the coin shop with its featured set, locked rule pieces and a piece sheet that buys only on the server's answer"
```

---

### Task 12: Mobile: coins land on the KIP page ("+20!" over the room, a line under it)

Spec §6.7 Coins land (C1: unseen earn events show once on the next KIP page focus as a "+20!" bubble over the room and
a short line under it, "Sleep goal hit", no values; then marked seen; under Reduce Motion the bubble does not float;
screen readers hear "Plus 20 coins. Sleep goal hit") and §16 Mobile (coins land once). Rulings 6, 12.

**Files:**
- Create: `mobile/src/lib/coins/landing.ts`, `mobile/src/components/coins/useCoinsLanding.ts`,
  `mobile/__tests__/lib/coinLanding.test.ts`
- Modify: `mobile/src/components/coach/RoomCard.tsx`, `mobile/src/screens/CoachScreen.tsx` (reads on focus),
  `mobile/__tests__/components/RoomCard.test.tsx`, `mobile/__tests__/screens/KipPage.test.tsx`

**Interfaces:**
- Consumes: Task 9's `useCoins`, `markCoinsSeen`, `loadCoins`, `loadFirstWeek`, `CoinEventDTO`, `CoinKind`; Task 10's
  `ROOM_COPY.coins.bubble`, `.landed`, `.landLine`, `.landSpoken`.
- Produces:
  - `mobile/src/lib/coins/landing.ts`: `LANDING_MS = 4000`, `interface Landing { total: number; kind: CoinKind; more: number; through: string }`,
    `landingOf(events): Landing | null`;
  - `useCoinsLanding(active: boolean): Landing | null`;
  - the KIP page reads the coins and the first-week list on mount and on every focus.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/coinLanding.test.ts`:

```ts
import { landingOf } from '../../src/lib/coins/landing';

it('lands every unseen positive earn once, as their total, named by the newest (ruling 12)', () => {
  expect(landingOf([
    { kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false },
    { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false },
    { kind: 'recap', amount: 10, at: '2026-11-10T09:00:00.000Z', seen: true },
  ])).toEqual({ total: 25, kind: 'sleep_goal', more: 1, through: '2026-11-11T07:12:00.000Z' });
});

it('never lands a 0-coin row, a spend or a seen event (Review Focus 5, ruling 6)', () => {
  expect(landingOf([
    { kind: 'recap', amount: 0, at: '2026-11-11T09:00:00.000Z', seen: false },
    { kind: 'buy', amount: -150, at: '2026-11-11T08:00:00.000Z', seen: false },
    { kind: 'steps', amount: 15, at: '2026-11-11T07:00:00.000Z', seen: true },
  ])).toBeNull();
});
```

In `mobile/__tests__/components/RoomCard.test.tsx`, add the imports
`import { AccessibilityInfo } from 'react-native';`, `import { fetchCoins, postCoinsSeen } from '../../src/api/coins';`
and `import { loadCoins, resetCoins } from '../../src/lib/coins/coinsStore';`, the mock
`jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(async () => undefined), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));`,
`resetCoins();` in the `afterEach`, and:

```tsx
const LANDING = {
  balance: 385, today: { earned: 25, cap: 60 }, next: null,
  events: [
    { kind: 'sleep_goal', amount: 20, at: '2026-11-11T07:12:00.000Z', seen: false },
    { kind: 'checkin', amount: 5, at: '2026-11-11T06:00:00.000Z', seen: false },
  ],
};

it('coins land once: "+25!" in KIP\'s bubble and a line under the room, announced, then marked seen (spec §6.7, ruling 12)', async () => {
  jest.useFakeTimers();
  const say = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
  await act(async () => { await loadCoins(); });
  const s = renderCard();
  await act(async () => undefined);
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('+25!');
  expect(s.getByTestId('coins-landed')).toHaveTextContent('Sleep goal hit and 1 more');
  expect(say).toHaveBeenCalledWith('Plus 25 coins. Sleep goal hit');
  expect(postCoinsSeen).toHaveBeenCalledWith('2026-11-11T07:12:00.000Z');
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(s.queryByTestId('coins-landed')).toBeNull();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('ON IT…');
  expect(postCoinsSeen).toHaveBeenCalledTimes(1);
  say.mockRestore();
  jest.useRealTimers();
});

it('nothing lands while the welcome card shows, or while the room is paused', async () => {
  (fetchCoins as jest.Mock).mockResolvedValue(LANDING);
  await act(async () => { await loadCoins(); });
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const s = renderCard();
  await act(async () => undefined);
  expect(s.queryByTestId('coins-landed')).toBeNull();
  const paused = renderCard({ paused: true });
  await act(async () => undefined);
  expect(paused.queryByTestId('coins-landed')).toBeNull();
  expect(postCoinsSeen).not.toHaveBeenCalled();
});
```

In `mobile/__tests__/screens/KipPage.test.tsx` (import `fetchCoins`, `fetchFirstWeek` from `'../../src/api/coins'`),
add:

```tsx
it('reads the coins and the first-week list when the page opens and on every focus (spec §6.7, §11.2)', async () => {
  await openChat();
  const reads = () => [(fetchCoins as jest.Mock).mock.calls.length, (fetchFirstWeek as jest.Mock).mock.calls.length];
  const [coins, week] = reads();
  expect(coins).toBeGreaterThanOrEqual(1);
  expect(week).toBeGreaterThanOrEqual(1);
  await act(async () => { mockNav.focus(); });
  expect(reads()).toEqual([coins + 1, week + 1]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinLanding.test.ts __tests__/components/RoomCard.test.tsx __tests__/screens/KipPage.test.tsx`
Expected: FAIL (no landing module; the card shows the stage's bubble; the page reads no coins).

- [ ] **Step 3: `mobile/src/lib/coins/landing.ts` and the hook**

```ts
// Coins landing on the KIP page (spec 2026-10-15 §6.7, C1): every unseen positive earn lands once, as their total,
// named by the newest (ruling 12). A 0-coin row at the cap and a spend never land (they are written seen, ruling 6).
import type { CoinEventDTO, CoinKind } from '../../api/coins';

export const LANDING_MS = 4000;
const EARNS: ReadonlySet<CoinKind> = new Set<CoinKind>(['sleep_goal', 'steps', 'checkin', 'recap', 'cheer_given', 'cheer_got', 'challenge', 'firstweek']);

export interface Landing {
  total: number;
  /** The newest earn's kind: the line names it. */
  kind: CoinKind;
  /** How many more earns landed with it. */
  more: number;
  /** Everything up to the newest is marked seen. */
  through: string;
}

/** `events` newest first, as the server sends them. */
export function landingOf(events: readonly CoinEventDTO[]): Landing | null {
  const unseen = events.filter((e) => !e.seen && e.amount > 0 && EARNS.has(e.kind));
  const newest = unseen[0];
  if (!newest) return null;
  return { total: unseen.reduce((n, e) => n + e.amount, 0), kind: newest.kind, more: unseen.length - 1, through: newest.at };
}
```

`mobile/src/components/coins/useCoinsLanding.ts`:

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { markCoinsSeen, useCoins } from '../../lib/coins/coinsStore';
import { LANDING_MS, landingOf, type Landing } from '../../lib/coins/landing';
import { ROOM_COPY } from '../../lib/room/roomCopy';

/**
 * The coins that land while `active` (spec §6.7): shown for LANDING_MS, said once, and marked seen at once, so they
 * never land twice. The bubble is the room's own, which never floats, so Reduce Motion changes nothing (ruling 12).
 */
export function useCoinsLanding(active: boolean): Landing | null {
  const coins = useCoins();
  const [shown, setShown] = useState<Landing | null>(null);
  useEffect(() => {
    if (!active || shown || !coins) return;
    const next = landingOf(coins.events);
    if (!next) return;
    setShown(next);
    AccessibilityInfo.announceForAccessibility(ROOM_COPY.coins.landSpoken(next.total, ROOM_COPY.coins.landed[next.kind]));
    void markCoinsSeen(next.through);
  }, [active, coins, shown]);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(null), LANDING_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}
```

- [ ] **Step 4: The room card and the page**

In `mobile/src/components/coach/RoomCard.tsx` (import `useCoinsLanding`):

```tsx
  const welcome = !!cosmetics && !cosmetics.welcomed && stage.id !== 'loading';
  // Coins land in KIP's bubble (spec §6.7, ruling 12), never over the welcome and never while the editor covers the room.
  const landing = useCoinsLanding(stage.id !== 'loading' && !paused && !welcome);
```

the `RoomView`'s bubble becomes
`bubble={welcome ? ROOM_COPY.welcome.bubble : landing ? ROOM_COPY.coins.bubble(landing.total) : stage.bubble}`, and
right after the frame's closing `</View>` (before the welcome card):

```tsx
      {landing ? (
        // Said once by the hook; hidden here so a screen reader does not read it a second time.
        <Text testID="coins-landed" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="text-caption">
          {ROOM_COPY.coins.landLine(ROOM_COPY.coins.landed[landing.kind], landing.more)}
        </Text>
      ) : null}
```

Update the component's comment: "Coins that landed since the last look show once in KIP's bubble, with a line under the
room (spec 2026-10-15 §6.7)."

In `mobile/src/screens/CoachScreen.tsx` (import `loadCoins`, `loadFirstWeek` from `'../lib/coins/coinsStore'`), next
to the existing focus listener:

```tsx
  // Coins land on the next look at the KIP page (spec §6.7), and the first-week card follows (§11.2): read on open and
  // on every focus. The reads catch up on earns server-side.
  useEffect(() => {
    void loadCoins();
    void loadFirstWeek();
  }, []);
  useEffect(() => navigation.addListener?.('focus', () => {
    void loadCoins();
    void loadFirstWeek();
  }), [navigation]);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinLanding.test.ts __tests__/components/RoomCard.test.tsx __tests__/screens/KipPage.test.tsx __tests__/screens/KipPageCollapse.test.tsx __tests__/screens/CoachScreen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/lib/coins/landing.ts mobile/src/components/coins/useCoinsLanding.ts mobile/src/components/coach/RoomCard.tsx mobile/src/screens/CoachScreen.tsx mobile/__tests__/lib/coinLanding.test.ts mobile/__tests__/components/RoomCard.test.tsx mobile/__tests__/screens/KipPage.test.tsx
git commit -m "feat(mobile): coins land once on the KIP page in KIP's bubble with a line under the room, then are marked seen"
```

---

### Task 13: Mobile: Room sizes, growing the room, the unlock moment, and the editor's rebase and re-centred pan

Spec §7 (Room sizes: both gates with progress, "Grow to 8 × 8", "Needs 240 more coins and 5 more days in a row"; the
unlock moment: the room redrawn at the new size with "NEW FLOOR" / "NEW WALL", "MORE ROOM!" over KIP in the cheer pose,
the card "Your room grew · 600 coins and 14 days of check-ins in a row." with "+1 row each side · +20 pieces" and Place
things / Later; an open editor rebases its draft onto the new version, dropping the stored wall pieces), §11.2 (the
next size's front rows dashed, the locked-row overlay), §5.3 (the room-full card's "See room sizes") and P1's ledger
P2-CARRY (reset the editor pan when a refresh changes the tier; recompute it on width change). Rulings 14–20, 30, 37.

**Files:**
- Create: `mobile/src/lib/coins/sizes.ts`, `mobile/src/screens/RoomSizesScreen.tsx`, `mobile/__tests__/lib/coinSizes.test.ts`,
  `mobile/__tests__/screens/RoomSizesScreen.test.tsx`, `mobile/__tests__/components/RoomFullCard.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts` (`ROOM_COPY.sizes`, `drawer.full.sizes`), `mobile/src/lib/room/edit/editor.ts`
  (`rebased`), `mobile/src/lib/room/edit/overlay.ts` (`nextRowsRects`), `mobile/src/components/edit/EditRoom.tsx`
  (P2-CARRY), `mobile/src/components/edit/RoomFullCard.tsx`, `mobile/src/components/edit/InventoryDrawer.tsx`,
  `mobile/src/screens/DecorateRoomScreen.tsx`, `mobile/src/navigation/RootNavigator.tsx`,
  `mobile/src/navigation/navigationRef.ts`, `mobile/__tests__/lib/editor.test.ts`,
  `mobile/__tests__/components/EditRoom.test.tsx`, `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 7's `CATALOGUE.tierGates`; Task 9's `growRoom`, `newRequestId`, `applyCosmeticsBody`, `useCoins`,
  `loadCoins`; Task 10's `WalletChip`, `coinCount`; P1's `TIERS`, `isoGrid`, `projOf`, `line`, `record`,
  `useDisposed`, `RoomView`, `initialPan`, `checkPiece`, `GEOMETRY_DEPS`; `useAchievements`, `refreshAchievements`.
- Produces:
  - `mobile/src/lib/coins/sizes.ts`: `interface FamilyStanding { family: AchievementFamilyName; level: number; current: number }`,
    `interface Gate { price: number; family: AchievementFamilyName; level: number; threshold: number }`,
    `gateOf(tier: 2 | 3): Gate`, `interface GateLine { title: string; progress: string; met: boolean }`,
    `interface SizeRow { tier: Tier; name: string; size: string; sizeSpoken: string; pieces: string; piecesSpoken: string; status: 'yours' | 'next' | 'later'; coins: GateLine | null; badge: GateLine | null }`,
    `sizeRows(tier, balance, families): SizeRow[]`, `growLine(tier, balance, families): string | null`,
    `familiesOf(snapshot: AchievementsSnapshot): FamilyStanding[] | null`;
  - `overlay.ts`: `nextRowsRects(g: IsoGrid, from: number): Rects`;
  - editor action `{ type: 'rebased'; saved: Draft; version: number; tier: Tier; counts: Readonly<Record<ItemId, number>> }`;
  - route `RoomSizes: { from?: 'editor' } | undefined` (`fullScreenModal`), in `MODAL_ROUTES`;
  - `RoomFullCard` prop `onSizes?: () => void` (`room-full-sizes`); `InventoryDrawer` prop `onOpenSizes?: () => void`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/coinSizes.test.ts`:

```ts
import { growLine, sizeRows, type FamilyStanding } from '../../src/lib/coins/sizes';
import { nextRowsRects } from '../../src/lib/room/edit/overlay';
import { isoGrid } from '../../src/lib/room/iso/grid';

const FAMILIES: FamilyStanding[] = [{ family: 'CHECK_IN', level: 1, current: 9 }, { family: 'SLEEP_GOAL', level: 2, current: 4 }];

it('lists the three sizes: yours, then both gates of each bigger one with their progress (spec §7, C2, ruling 14)', () => {
  const [starter, bigger, loft] = sizeRows(1, 360, FAMILIES);
  expect([starter!.name, starter!.size, starter!.pieces, starter!.status]).toEqual(['Starter', '7 × 7', '40 pieces', 'yours']);
  expect([bigger!.status, bigger!.coins, bigger!.badge]).toEqual(['next', { title: '600 coins', progress: '360 of 600', met: false }, { title: 'A 14-day check-in streak', progress: '9 of 14', met: false }]);
  expect([loft!.status, loft!.pieces, loft!.piecesSpoken, loft!.coins, loft!.badge]).toEqual([
    'later', '90 pieces · second window', '90 pieces, second window',
    { title: '1,500 coins', progress: '360 of 1,500', met: false }, { title: 'Sleep goal badge, level 3', progress: 'level 2 now', met: false },
  ]);
  expect(sizeRows(2, 0, FAMILIES)[1]!.status).toBe('yours');
  expect(sizeRows(1, 360, null)[1]!.badge).toEqual({ title: 'A 14-day check-in streak', progress: '0 of 14', met: false });
});

it('says what Grow still needs, both gates always (spec §7)', () => {
  expect(growLine(1, 360, FAMILIES)).toBe('Needs 240 more coins and 5 more days in a row.');
  expect(growLine(1, 600, FAMILIES)).toBe('Needs 5 more days in a row.');
  expect(growLine(1, 100, [{ family: 'CHECK_IN', level: 2, current: 0 }])).toBe('Needs 500 more coins.'); // a broken run after the badge costs nothing
  expect(growLine(1, 600, [{ family: 'CHECK_IN', level: 2, current: 0 }])).toBeNull();
  expect(growLine(2, 600, FAMILIES)).toBe('Needs 900 more coins and the sleep goal badge, level 3.');
  expect(growLine(3, 0, FAMILIES)).toBeNull();
});

it('dashes the next size\'s new rows on that size\'s grid (ruling 15)', () => {
  const g = isoGrid(2);
  const r = nextRowsRects(g, 7);
  expect(r.length).toBeGreaterThan(20);
  expect(r.every(([x, y, w, h]) => Number.isInteger(x) && Number.isInteger(y) && w === 1 && h === 1)).toBe(true);
});
```

Create `mobile/__tests__/components/RoomFullCard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoomFullCard } from '../../src/components/edit/RoomFullCard';

it('offers Store a piece and, from P2, See room sizes (spec §5.3)', () => {
  const store = jest.fn();
  const sizes = jest.fn();
  const s = render(<RoomFullCard cap={40} onStore={store} onSizes={sizes} />);
  expect(s.getByText("KIP's room is full. 40 pieces fit this room. Store something to make space, or grow the room")).toBeTruthy();
  fireEvent.press(s.getByTestId('room-full-sizes'));
  fireEvent.press(s.getByTestId('room-full-store'));
  expect([sizes.mock.calls.length, store.mock.calls.length]).toEqual([1, 1]);
});
```

Create `mobile/__tests__/screens/RoomSizesScreen.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import { fetchCoins, postExpand, type ExpandDTO } from '../../src/api/coins';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { resetCoins } from '../../src/lib/coins/coinsStore';
import { getCosmetics, loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { RoomSizesScreen } from '../../src/screens/RoomSizesScreen';
import { achievementsFixture } from '../../jest-mocks/achievementsFixture';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
let mockBadges: unknown;
jest.mock('../../src/lib/achievementsStore', () => ({ useAchievements: () => mockBadges, refreshAchievements: jest.fn(async () => undefined) }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

interface Open { balance: number; checkIn?: { level: number; current?: number }; sleepLevel?: number; params?: object; room?: ReturnType<typeof cosmeticsDTO> }

async function open({ balance, checkIn = { level: 1, current: 9 }, sleepLevel = 2, params, room = cosmeticsDTO() }: Open) {
  mockBadges = { state: { status: 'ready', data: achievementsFixture({ CHECK_IN: checkIn, SLEEP_GOAL: { level: sleepLevel } }) }, celebrated: new Set() };
  mockParams = params;
  (fetchCosmetics as jest.Mock).mockResolvedValue(room);
  (fetchCoins as jest.Mock).mockResolvedValue({ balance, today: { earned: 0, cap: 60 }, events: [], next: null });
  await act(async () => { await loadCosmetics(); });
  const s = render(<RoomSizesScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); resetCosmetics(); });

it('shows each size, both gates of the next with progress, the next size\'s dashed rows, and why Grow waits (spec §7, C2)', async () => {
  const s = await open({ balance: 360 });
  expect(s.getByTestId('sizes-row-1')).toHaveTextContent(/YOURS/);
  expect(s.getByTestId('sizes-coins-2').props.accessibilityLabel).toBe('600 coins, 360 of 600');
  expect(s.getByTestId('sizes-badge-2').props.accessibilityLabel).toBe('A 14-day check-in streak, 9 of 14');
  expect(s.getByTestId('sizes-grow').props.accessibilityState.disabled).toBe(true);
  expect(s.getByText('Needs 240 more coins and 5 more days in a row.')).toBeTruthy();
  const room = s.getByTestId('sizes-room');
  expect([room.props.tier, room.props.room.split(':')[2]]).toEqual([2, 'none']);
});

it('with both gates met, Grow spends once, the room redraws grown with MORE ROOM!, and the card says what changed (Review Focus 4)', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 }, params: { from: 'editor' } });
  const grown: ExpandDTO = { ...cosmeticsDTO({ tier: 2, cap: 60, version: 3 }), balance: 50, stored: 0 };
  (postExpand as jest.Mock).mockResolvedValue(grown);
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(postExpand).toHaveBeenCalledWith(expect.stringMatching(/^00000000-/), 2);
  const room = s.getByTestId('sizes-room');
  expect([room.props.tier, room.props.room.split(':')[0], room.props.room.split(':')[2]]).toEqual([2, 'cheer', 'MORE ROOM!']);
  expect(s.getByTestId('sizes-grown')).toHaveTextContent(/NEW FLOORNEW WALLYour room grew600 coins and 14 days of check-ins in a row\.\+1 row each side · \+20 pieces/);
  expect(s.queryByTestId('sizes-stored')).toBeNull();
  expect([getCosmetics()!.tier, getCosmetics()!.version]).toEqual([2, 3]);
  fireEvent.press(s.getByTestId('sizes-place'));
  expect(mockNav.goBack).toHaveBeenCalled(); // back to the editor that opened it
});

it('to the loft the card says the window needed the wall; Place things opens the editor when it was not open', async () => {
  const s = await open({ balance: 1600, checkIn: { level: 2 }, sleepLevel: 3, room: cosmeticsDTO({ tier: 2, cap: 60, version: 2 }) });
  expect(s.getByTestId('sizes-room').props.tier).toBe(3);
  (postExpand as jest.Mock).mockResolvedValue({ ...cosmeticsDTO({ tier: 3, cap: 90, version: 4 }), balance: 100, stored: 2 });
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-stored')).toHaveTextContent('The new window needed the wall: 2 pieces went to your inventory');
  fireEvent.press(s.getByTestId('sizes-place'));
  expect(mockNav.replace).toHaveBeenCalledWith('DecorateRoom');
});

it('a refused grow reads the wallet and the room again and says not yet; a dropped connection keeps the request id', async () => {
  const s = await open({ balance: 650, checkIn: { level: 2, current: 3 } });
  (postExpand as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed')).mockRejectedValueOnce(new ApiError(409, 'x', 'gate', { error: 'gate', coinsNeeded: 10, badgeNeeded: false }));
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  expect(s.getByTestId('sizes-notice')).toHaveTextContent("Couldn't grow the room just now. Try again.");
  await act(async () => { fireEvent.press(s.getByTestId('sizes-grow')); });
  const [a, b] = (postExpand as jest.Mock).mock.calls.map((c) => c[0]);
  expect(b).toBe(a);
  expect(s.getByTestId('sizes-notice')).toHaveTextContent('Not quite yet: your room sizes were refreshed.');
  expect((fetchCoins as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
});
```

In `mobile/__tests__/lib/editor.test.ts` (import `validateLayout` from `'../../src/lib/room/iso/geometry'` and
`GEOMETRY_DEPS` with `catalogueSet` from `'../../src/lib/room/catalogue'`), add:

```ts
describe('the room grows under the editor (spec §7, ruling 19)', () => {
  it('keeps the draft\'s own changes, drops what the server stored and any wall piece the new window covers, and clears undo', () => {
    // An 8 × 8 room whose plank (with the books) hangs where the loft's window will be.
    const base = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'plank' ? { ...p, x: 12 } : p)) };
    const s = run(start({ layout: base, tier: 2 }),
      { type: 'place', item: 'plant.fern' },
      { type: 'drop', id: null, item: 'art.calendar', target: { layer: 'wallR', x: 12, y: 2 } });
    expect(s.draft.layout.pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['p1', 'p2']));
    const grown = { ...base, pieces: base.pieces.filter((p) => p.id !== 'plank' && p.id !== 'shelf') };
    const r = run(s, { type: 'rebased', saved: { layout: grown, worn: EMPTY_WORN }, version: 7, tier: 3, counts: COUNTS });
    const ids = r.draft.layout.pieces.map((p) => p.id);
    expect([ids.includes('p1'), ids.includes('p2'), ids.includes('plank'), ids.includes('shelf')]).toEqual([true, false, false, false]);
    expect([r.tier, r.baseVersion, r.past.length, r.future.length, isChanged(r)]).toEqual([3, 7, 0, 0, true]);
    expect(validateLayout(r.draft.layout, 3, GEOMETRY_DEPS)).toBeNull();
  });
});
```

In `mobile/__tests__/components/EditRoom.test.tsx`, add:

```tsx
it('re-centres on the desk when the tier, the width or the height changes (P2-CARRY, ruling 20)', () => {
  const s = render(<EditRoom {...props} dispatch={jest.fn()} />);
  const offset = () => JSON.parse(s.getByTestId('edit-room-view').props.offset);
  expect(offset()).toEqual(initialPan(STATE, W, H));
  const grown = { ...STATE, tier: 3 as const };
  s.rerender(<EditRoom {...props} dispatch={jest.fn()} state={grown} />);
  expect(offset()).toEqual(initialPan(grown, W, H));
  s.rerender(<EditRoom {...props} dispatch={jest.fn()} state={grown} width={320} />);
  expect(offset()).toEqual(initialPan(grown, 320, H));
  s.rerender(<EditRoom {...props} dispatch={jest.fn()} state={grown} width={320} height={260} />);
  expect(offset()).toEqual(initialPan(grown, 320, 260));
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` (import `applyCosmeticsBody` from the store and
`editRoomHeight` is already imported), add:

```tsx
it('growing the room from the editor keeps the draft, re-centres, and Done saves at the new version (Review Focus 4)', async () => {
  const s = await openEditor();
  fireEvent.press(s.getByTestId('drawer-tile-plant.cactus'));
  fireEvent.press(s.getByTestId('drawer-place'));
  await act(async () => { applyCosmeticsBody(cosmeticsDTO({ tier: 2, cap: 60, version: 3 })); });
  expect(s.getByTestId('edit-count')).toHaveTextContent('8 / 60 in room');
  const room = s.getByTestId('edit-room-view');
  const grown = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 2, counts: STARTER_COUNTS, version: 3, newIds: [] });
  expect([room.props.tier, JSON.parse(room.props.offset)]).toEqual([2, initialPan(grown, Dimensions.get('window').width, editRoomHeight(Dimensions.get('window').height))]);
  (putCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ tier: 2, cap: 60, version: 4 }));
  await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
  const sent = (putCosmetics as jest.Mock).mock.calls[0]![0];
  expect([sent.version, sent.layout.pieces.some((p: { item: string }) => p.item === 'plant.cactus')]).toEqual([3, true]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinSizes.test.ts __tests__/components/RoomFullCard.test.tsx __tests__/screens/RoomSizesScreen.test.tsx __tests__/lib/editor.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no sizes module, screen, `rebased` action or `nextRowsRects`; the pan does not follow the tier).

- [ ] **Step 3: The copy**

In `ROOM_COPY.drawer.full`, add `sizes: 'See room sizes',`. After `ROOM_COPY.shop`, add:

```ts
  /** Room sizes and the unlock moment (spec 2026-10-15 §7, C2, F5). Effect slots join in P3 (ruling 14). */
  sizes: {
    title: 'Room sizes',
    sub: 'Coins and a streak, both',
    close: 'Close',
    names: { 1: 'Starter', 2: 'Bigger', 3: 'Loft' } as Readonly<Record<1 | 2 | 3, string>>,
    size: (n: number) => `${n} × ${n}`,
    sizeSpoken: (n: number) => `${n} by ${n}`,
    pieces: (cap: number, window: boolean) => (window ? `${cap} pieces · second window` : `${cap} pieces`),
    piecesSpoken: (cap: number, window: boolean) => (window ? `${cap} pieces, second window` : `${cap} pieces`),
    yours: 'YOURS',
    coinsTitle: (price: string) => `${price} coins`,
    of: (have: string, need: string) => `${have} of ${need}`,
    streakTitle: (days: number) => `A ${days}-day check-in streak`,
    badgeTitle: (level: number) => `Sleep goal badge, level ${level}`,
    levelNow: (level: number) => `level ${level} now`,
    noLevel: 'No level yet',
    done: 'Done',
    gateSpoken: (title: string, progress: string) => `${title}, ${progress}`,
    grow: (n: number) => `Grow to ${n} × ${n}`,
    growSpoken: (n: number) => `Grow to ${n} by ${n}`,
    needs: (parts: readonly string[]) => `Needs ${parts.join(' and ')}.`,
    moreCoins: (n: string) => `${n} more coins`,
    moreDays: (n: number) => (n === 1 ? '1 more day in a row' : `${n} more days in a row`),
    badgeNeed: (level: number) => `the sleep goal badge, level ${level}`,
    both: "Coins alone never buy space, and a streak alone doesn't either.",
    previewLabel: (n: number) => `Your room at ${n} by ${n}. The dashed rows are the new floor`,
    grownLabel: (n: number) => `Your room at ${n} by ${n}`,
    moreRoom: 'MORE ROOM!',
    newFloor: 'NEW FLOOR',
    newWall: 'NEW WALL',
    grewTitle: 'Your room grew',
    grewWhy: (tier: 2 | 3, price: string, gate: number) =>
      (tier === 2 ? `${price} coins and ${gate} days of check-ins in a row.` : `${price} coins and the sleep goal badge, level ${gate}.`),
    grewMore: (pieces: number, window: boolean) => `+1 row each side · +${pieces} pieces${window ? ' · a second window' : ''}`,
    grewMoreSpoken: (pieces: number, window: boolean) => `One more row each side, ${pieces} more pieces${window ? ', and a second window' : ''}`,
    stored: (n: number) => `The new window needed the wall: ${n} ${n === 1 ? 'piece' : 'pieces'} went to your inventory`,
    place: 'Place things',
    later: 'Later',
    notYet: 'Not quite yet: your room sizes were refreshed.',
    failed: "Couldn't grow the room just now. Try again.",
  },
```

- [ ] **Step 4: `mobile/src/lib/coins/sizes.ts` and the dashed rows**

```ts
// The Room sizes screen's rows (spec 2026-10-15 §7, C2, F5), pure: each size and its pieces, and for each bigger size
// both gates with progress ("360 of 600", "9 of 14", "level 2 now"). Coins alone never buy space; a streak alone
// doesn't either. The badge never re-locks: a broken run after it costs nothing. The gates come from the catalogue
// (ruling 37); effect slots join in P3 (ruling 14).
import type { AchievementsSnapshot } from '../achievementsStore';
import { CATALOGUE, type AchievementFamilyName } from '../room/catalogue';
import { TIERS, type Tier } from '../room/iso/geometry';
import { ROOM_COPY, coinCount } from '../room/roomCopy';

const Z = ROOM_COPY.sizes;

export interface FamilyStanding { family: AchievementFamilyName; level: number; current: number }
export interface Gate { price: number; family: AchievementFamilyName; level: number; threshold: number }
export interface GateLine { title: string; progress: string; met: boolean }
export interface SizeRow {
  tier: Tier;
  name: string;
  size: string;
  sizeSpoken: string;
  pieces: string;
  piecesSpoken: string;
  status: 'yours' | 'next' | 'later';
  coins: GateLine | null;
  badge: GateLine | null;
}

export function gateOf(tier: 2 | 3): Gate {
  return CATALOGUE.tierGates[tier === 2 ? '2' : '3'];
}

/** The badge store's families, or null until it has loaded. */
export function familiesOf(snapshot: AchievementsSnapshot): FamilyStanding[] | null {
  return snapshot.state.status === 'ready'
    ? snapshot.state.data.families.map((f) => ({ family: f.family as AchievementFamilyName, level: f.level, current: f.current }))
    : null;
}

function badgeLine(g: Gate, f: FamilyStanding | undefined): GateLine {
  const met = (f?.level ?? 0) >= g.level;
  if (g.family === 'CHECK_IN') {
    return { title: Z.streakTitle(g.threshold), progress: met ? Z.done : Z.of(String(Math.min(f?.current ?? 0, g.threshold)), String(g.threshold)), met };
  }
  return { title: Z.badgeTitle(g.level), progress: met ? Z.done : f?.level ? Z.levelNow(f.level) : Z.noLevel, met };
}

export function sizeRows(tier: Tier, balance: number, families: readonly FamilyStanding[] | null): SizeRow[] {
  return ([1, 2, 3] as const).map((t): SizeRow => {
    const { n, cap } = TIERS[t];
    const row = {
      tier: t, name: Z.names[t], size: Z.size(n), sizeSpoken: Z.sizeSpoken(n),
      pieces: Z.pieces(cap, t === 3), piecesSpoken: Z.piecesSpoken(cap, t === 3),
    };
    if (t <= tier) return { ...row, status: 'yours', coins: null, badge: null };
    const g = gateOf(t as 2 | 3);
    return {
      ...row,
      status: t === tier + 1 ? 'next' : 'later',
      coins: { title: Z.coinsTitle(coinCount(g.price)), progress: Z.of(coinCount(Math.min(balance, g.price)), coinCount(g.price)), met: balance >= g.price },
      badge: badgeLine(g, families?.find((f) => f.family === g.family)),
    };
  });
}

/** What the next size still needs, or null when Grow can act (or there is no bigger size). */
export function growLine(tier: Tier, balance: number, families: readonly FamilyStanding[] | null): string | null {
  if (tier >= 3) return null;
  const g = gateOf((tier + 1) as 2 | 3);
  const f = families?.find((x) => x.family === g.family);
  const short = Math.max(0, g.price - balance);
  const badgeMet = (f?.level ?? 0) >= g.level;
  if (!short && badgeMet) return null;
  const parts: string[] = [];
  if (short) parts.push(Z.moreCoins(coinCount(short)));
  if (!badgeMet) parts.push(g.family === 'CHECK_IN' ? Z.moreDays(Math.max(1, g.threshold - (f?.current ?? 0))) : Z.badgeNeed(g.level));
  return Z.needs(parts);
}
```

In `mobile/src/lib/room/edit/overlay.ts`:

```ts
const DASH = 'rgba(255,255,255,0.55)';

/**
 * The next size's new front rows as a dashed outline (spec §11.2's locked-row overlay, ruling 15), on a grid of the
 * NEXT size: `from` is today's n, so tiles at i or j ≥ from are the new floor.
 */
export function nextRowsRects(g: IsoGrid, from: number): Rects {
  const P = projOf(g);
  const r: Rects = [];
  const dashed = (a: readonly [number, number], b: readonly [number, number]) => {
    const seg: Rects = [];
    line(seg, a, b, DASH);
    seg.forEach((q, k) => { if (Math.floor(k / 2) % 2 === 0) r.push(q); });
  };
  dashed(P(from, 0), P(from, from));
  dashed(P(0, from), P(from, from));
  dashed(P(from, 0), P(g.n, 0));
  dashed(P(0, from), P(0, g.m));
  dashed(P(g.n, 0), P(g.n, g.m));
  dashed(P(0, g.m), P(g.n, g.m));
  return r;
}
```

- [ ] **Step 5: The editor: `rebased`, the effect, and the pan**

In `mobile/src/lib/room/edit/editor.ts`, import `checkPiece` from `'../iso/geometry'`; `EditorAction` gains
`| { type: 'rebased'; saved: Draft; version: number; tier: Tier; counts: Readonly<Record<ItemId, number>> }`, and
`reduce` the case:

```ts
    case 'rebased': {
      // The room grew under the editor (spec §7, ruling 19): the server's room is the new base. The draft keeps its own
      // changes but loses what the server stored and any wall piece the new window covers, with what stood on them.
      const kept = new Set(a.saved.layout.pieces.map((p) => p.id));
      const gone = new Set(s.saved.layout.pieces.filter((p) => !kept.has(p.id)).map((p) => p.id));
      for (const p of layout.pieces) {
        if ((p.layer === 'wallL' || p.layer === 'wallR') && checkPiece(layout, p, a.tier, GEOMETRY_DEPS)?.reason === 'window') gone.add(p.id);
      }
      const pieces = layout.pieces.filter((p) => !gone.has(p.id) && !(p.parent && gone.has(p.parent)));
      return {
        ...s, saved: a.saved, draft: { ...s.draft, layout: { ...layout, pieces } }, past: [], future: [], tier: a.tier, counts: a.counts,
        baseVersion: a.version, selected: null, nudging: false, preview: null, outcome: null,
      };
    }
```

In `mobile/src/screens/DecorateRoomScreen.tsx`, after the counts effect:

```tsx
  // The room grew while the editor was open (spec §7, ruling 19): rebase the draft onto the server's bigger room, so
  // Done saves against the new version.
  useEffect(() => {
    if (cosmetics.tier === state.tier || cosmetics.version <= state.baseVersion) return;
    dispatch({ type: 'rebased', saved: { layout: cosmetics.layout, worn: cosmetics.worn }, version: cosmetics.version, tier: cosmetics.tier, counts: cosmetics.counts });
  }, [cosmetics.tier, cosmetics.version]); // eslint-disable-line react-hooks/exhaustive-deps
```

and the drawer gets `onOpenSizes={() => navigation.navigate('RoomSizes', { from: 'editor' })}`.

In `mobile/src/components/edit/EditRoom.tsx` (P2-CARRY), right after the `setPan` helper is defined:

```tsx
  // A refresh or a grow that changes the tier, or a new width or height (rotation, split view), re-centres the room on
  // the desk (P1 ledger P2-CARRY, ruling 20): an old pan may be past the new room's edges.
  const centredFor = useRef({ tier: state.tier, width, height });
  useEffect(() => {
    const was = centredFor.current;
    if (was.tier === state.tier && was.width === width && was.height === height) return;
    centredFor.current = { tier: state.tier, width, height };
    setPan(initialPan(state, width, height));
  }, [state.tier, width, height]); // eslint-disable-line react-hooks/exhaustive-deps
```

(`useEffect` joins the React import.)

`mobile/src/components/edit/RoomFullCard.tsx`:

```tsx
// F4 "Can't place · room full" (spec 2026-10-15 §5.3): store a piece, or see the room sizes (P2).
export function RoomFullCard({ cap, onStore, onSizes }: { cap: number; onStore: () => void; onSizes?: () => void }) {
  return (
    <Card testID="room-full" className="gap-2 p-3" accessibilityLiveRegion="polite">
      <Text className="text-body">{ROOM_COPY.drawer.full.text(cap)}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button testID="room-full-store" variant="outline" className="h-[44px]" onPress={onStore}>{ROOM_COPY.drawer.full.store}</Button>
        {onSizes ? <Button testID="room-full-sizes" variant="outline" className="h-[44px]" onPress={onSizes}>{ROOM_COPY.drawer.full.sizes}</Button> : null}
      </View>
    </Card>
  );
}
```

`InventoryDrawer.tsx`: the props gain `onOpenSizes?: () => void;` and the card gets `onSizes={onOpenSizes}`.

- [ ] **Step 6: `mobile/src/screens/RoomSizesScreen.tsx` and the route**

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { ApiError } from '../api/client';
import { WalletChip } from '../components/coins/WalletChip';
import { record, useDisposed } from '../components/room/pictures';
import { RoomView } from '../components/room/RoomView';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PageTitle } from '../components/ui/page-title';
import { Text } from '../components/ui/text';
import { refreshAchievements, useAchievements } from '../lib/achievementsStore';
import { growRoom, newRequestId } from '../lib/coins/actions';
import { loadCoins, useCoins } from '../lib/coins/coinsStore';
import { familiesOf, gateOf, growLine, sizeRows, type GateLine } from '../lib/coins/sizes';
import { useMyKip } from '../lib/kip/myKip';
import { getCosmetics, loadCosmetics, useCosmetics } from '../lib/room/cosmeticsStore';
import { nextRowsRects } from '../lib/room/edit/overlay';
import { TIERS, type Tier } from '../lib/room/iso/geometry';
import { isoGrid } from '../lib/room/iso/grid';
import { starterLayout } from '../lib/room/layout';
import { ROOM_COPY, coinCount } from '../lib/room/roomCopy';

const Z = ROOM_COPY.sizes;
const TARGET = 'h-[44px]';

function Gate({ testID, gate }: { testID: string; gate: GateLine }) {
  return (
    <View testID={testID} accessible accessibilityLabel={Z.gateSpoken(gate.title, gate.progress)} className="flex-row items-center justify-between gap-2">
      <Text className="shrink text-caption">{gate.title}</Text>
      <Text className={gate.met ? 'text-caption text-primary' : 'text-caption text-muted-foreground'}>{gate.progress}</Text>
    </View>
  );
}

// Room sizes (spec 2026-10-15 §7, C2, F5), full screen (ruling 8). Your room drawn whole at the next size with the new
// rows dashed (ruling 15), each size and its gates, and Grow, which spends once (a dropped connection keeps the request
// id, ruling 30). Grown, the room redraws at the new size with KIP cheering "MORE ROOM!", the NEW tags (ruling 16) and
// the card; Place things goes back to the editor that opened it, or opens one.
export function RoomSizesScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as { from?: 'editor' };
  const me = useMyKip();
  const reduceMotion = useReducedMotion();
  const cosmetics = useCosmetics();
  const coins = useCoins();
  const families = familiesOf(useAchievements());
  const [grown, setGrown] = useState<{ tier: Tier; stored: number } | null>(null);
  const [growing, setGrowing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef<{ tier: 2 | 3; requestId: string } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    void loadCoins();
    if (!getCosmetics()) void loadCosmetics();
    void refreshAchievements();
  }, []);

  const tier = cosmetics?.tier ?? 1;
  const balance = coins?.balance ?? 0;
  const nextTier = tier < 3 ? ((tier + 1) as 2 | 3) : null;
  const blocker = growLine(tier, balance, families);
  const shown: Tier = grown ? grown.tier : nextTier ?? tier;
  const g = isoGrid(shown);
  const dashed = !grown && nextTier !== null;
  const overlay = useDisposed(useMemo(() => record([dashed ? nextRowsRects(g, TIERS[tier].n) : []], 1), [dashed, shown, tier])); // eslint-disable-line react-hooks/exhaustive-deps

  const grow = async () => {
    if (!nextTier || busy.current) return;
    busy.current = true;
    if (attempt.current?.tier !== nextTier) attempt.current = { tier: nextTier, requestId: newRequestId() };
    setGrowing(true);
    setNotice(null);
    try {
      const res = await growRoom(nextTier, attempt.current.requestId);
      attempt.current = null;
      setGrown({ tier: res.tier as Tier, stored: res.stored });
      AccessibilityInfo.announceForAccessibility(`${Z.grewTitle}. ${Z.grewMoreSpoken(TIERS[res.tier as Tier].cap - TIERS[tier].cap, res.tier === 3)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        attempt.current = null;
        await Promise.all([loadCoins(), loadCosmetics(), refreshAchievements()]);
        setNotice(Z.notYet);
      } else {
        setNotice(Z.failed);
      }
    } finally {
      busy.current = false;
      setGrowing(false);
    }
  };

  const placeThings = () => (params.from === 'editor' ? navigation.goBack() : navigation.replace('DecorateRoom'));
  const gate = grown && grown.tier !== 1 ? gateOf(grown.tier as 2 | 3) : null;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-1">
        <Button testID="sizes-close" variant="ghost" className={TARGET} disabled={growing} onPress={() => navigation.goBack()}>{Z.close}</Button>
        <PageTitle>{Z.title}</PageTitle>
        <WalletChip testID="sizes-wallet" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Text className="text-caption text-muted-foreground">{Z.sub}</Text>
        <View
          testID="sizes-preview"
          accessible
          accessibilityRole="image"
          accessibilityLabel={dashed ? Z.previewLabel(g.n) : Z.grownLabel(g.n)}
          style={{ width: g.W, height: g.H, alignSelf: 'center', overflow: 'hidden' }}
        >
          <RoomView
            testID="sizes-room"
            layout={cosmetics?.layout ?? starterLayout()}
            tier={shown}
            worn={me.worn}
            weather="clear"
            night={false}
            colour={me.colour}
            pose={grown ? 'cheer' : 'rest'}
            mood={grown ? 'proud' : 'idle'}
            screen="lines"
            bubble={grown ? Z.moreRoom : null}
            crop={{ width: g.W, height: g.H }}
            cellPt={1}
            offset={{ x: 0, y: 0 }}
            reduceMotion={reduceMotion}
            accessible={false}
          />
          <Canvas pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: g.W, height: g.H }}>
            <Picture picture={overlay} />
          </Canvas>
        </View>
        {grown && gate ? (
          <Card testID="sizes-grown" className="gap-2 p-3" accessibilityLiveRegion="polite">
            <View className="flex-row flex-wrap gap-2">
              {[Z.newFloor, Z.newWall].map((tag) => (
                <Text key={tag} className="rounded-lg border border-primary px-1 font-pixel text-label text-primary">{tag}</Text>
              ))}
            </View>
            <Text className="text-heading">{Z.grewTitle}</Text>
            <Text className="text-body">{Z.grewWhy(grown.tier as 2 | 3, coinCount(gate.price), grown.tier === 2 ? gate.threshold : gate.level)}</Text>
            <Text accessibilityLabel={Z.grewMoreSpoken(TIERS[grown.tier].cap - TIERS[(grown.tier - 1) as Tier].cap, grown.tier === 3)} className="text-caption text-muted-foreground">
              {Z.grewMore(TIERS[grown.tier].cap - TIERS[(grown.tier - 1) as Tier].cap, grown.tier === 3)}
            </Text>
            {grown.stored ? <Text testID="sizes-stored" className="text-caption">{Z.stored(grown.stored)}</Text> : null}
            <View className="flex-row gap-2">
              <Button testID="sizes-place" className={`${TARGET} flex-1`} onPress={placeThings}>{Z.place}</Button>
              <Button testID="sizes-later" variant="outline" className={`${TARGET} flex-1`} onPress={() => navigation.goBack()}>{Z.later}</Button>
            </View>
          </Card>
        ) : null}
        {notice ? <Text testID="sizes-notice" accessibilityLiveRegion="polite" className="text-caption">{notice}</Text> : null}
        {sizeRows(tier, balance, families).map((row) => (
          <Card key={row.tier} testID={`sizes-row-${row.tier}`} className="gap-1 p-3">
            <Text accessibilityLabel={`${row.name}, ${row.sizeSpoken}`} className="text-body font-semibold">{`${row.name} · ${row.size}`}</Text>
            <Text accessibilityLabel={row.piecesSpoken} className="text-caption text-muted-foreground">{row.pieces}</Text>
            {row.status === 'yours' ? (
              <Text className="font-pixel text-label text-primary">{Z.yours}</Text>
            ) : (
              <>
                <Gate testID={`sizes-coins-${row.tier}`} gate={row.coins!} />
                <Gate testID={`sizes-badge-${row.tier}`} gate={row.badge!} />
              </>
            )}
          </Card>
        ))}
        {nextTier && !grown ? (
          <View className="gap-2">
            <Button testID="sizes-grow" className={TARGET} accessibilityLabel={Z.growSpoken(TIERS[nextTier].n)} disabled={!!blocker} loading={growing} onPress={() => void grow()}>
              {Z.grow(TIERS[nextTier].n)}
            </Button>
            {blocker ? <Text className="text-caption">{blocker}</Text> : null}
            <Text className="text-caption text-muted-foreground">{Z.both}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

`RootNavigator.tsx`: import `RoomSizesScreen`; `RootStackParamList` gains
`// Room sizes (spec 2026-10-15 §7): from the room-full card, the first-week card and the KIP page.`
`RoomSizes: { from?: 'editor' } | undefined;` and after `CoinShop`:

```tsx
              <Stack.Screen name="RoomSizes" component={RoomSizesScreen} options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
```

`navigationRef.ts`: `MODAL_ROUTES` adds `'RoomSizes'`.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinSizes.test.ts __tests__/components/RoomFullCard.test.tsx __tests__/screens/RoomSizesScreen.test.tsx __tests__/lib/editor.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/components/InventoryDrawer.test.tsx __tests__/conventions`
Expected: PASS.

- [ ] **Step 8: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/lib/coins/sizes.ts mobile/src/screens/RoomSizesScreen.tsx mobile/src/lib/room/roomCopy.ts mobile/src/lib/room/edit mobile/src/components/edit mobile/src/screens/DecorateRoomScreen.tsx mobile/src/navigation mobile/__tests__
git commit -m "feat(mobile): room sizes with both gates, growing with the unlock moment, and the editor rebasing and re-centring when the room grows"
```

---

### Task 14: Mobile: the first-week card, the welcome's coins line, the drawer's coins line, and the earn-only guard

Spec §11.2 (the 7-day card on the KIP page, "First week · Day 4 of 7 · 4 of 7 done", the seven rows and rewards, "Next:
8 × 8 · 600 coins and a 14-day check-in streak. The dashed row is yours then."; gone after day 7), §11.1 (P2 adds
"Healthy days earn coins, and coins turn into things for the room." to the welcome), §5.4 ("How new things arrive"
gains a coins line), §6.1 (no real-money path anywhere: a test guards the dependencies and the copy) and §16 (no
real-money dependency or copy). Rulings 10, 11, 15, 24.

**Files:**
- Create: `mobile/src/components/coins/FirstWeekCard.tsx`, `mobile/__tests__/components/FirstWeekCard.test.tsx`,
  `mobile/__tests__/conventions/earnOnly.test.ts`
- Modify: `mobile/src/lib/room/roomCopy.ts` (`firstWeek`, `welcome.coins`, `arrive`), `mobile/src/components/coach/RoomCard.tsx`
  (`children`), `mobile/src/components/coach/RoomWelcomeCard.tsx`, `mobile/src/screens/CoachScreen.tsx`,
  `mobile/__tests__/components/RoomWelcomeCard.test.tsx`, `mobile/__tests__/lib/roomCopy.test.ts`,
  `mobile/__tests__/screens/KipPage.test.tsx`

**Interfaces:**
- Consumes: Task 9's `useFirstWeek`, `loadFirstWeek`, `FirstWeekDTO`, `FirstWeekTaskKey`; Task 10's `coinCount`; the
  `CoinShop` and `RoomSizes` routes (Tasks 11, 13).
- Produces: `FirstWeekCard()` (renders nothing unless the list is open); `RoomCard` prop `children?: React.ReactNode`
  (drawn last in the card); `ROOM_COPY.firstWeek`, `ROOM_COPY.welcome.coins`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/components/FirstWeekCard.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { fetchFirstWeek, type FirstWeekDTO } from '../../src/api/coins';
import { FirstWeekCard } from '../../src/components/coins/FirstWeekCard';
import { loadFirstWeek, resetCoins } from '../../src/lib/coins/coinsStore';

jest.mock('../../src/api/coins', () => ({ fetchCoins: jest.fn(), postCoinsSeen: jest.fn(), fetchFirstWeek: jest.fn(), fetchShop: jest.fn(), postPurchase: jest.fn(), postExpand: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

const OPEN: FirstWeekDTO = {
  open: true, day: 4, done: 4,
  tasks: [
    { key: 'checkin', done: true, reward: 5 }, { key: 'place', done: true, reward: 10 }, { key: 'sleep', done: true, reward: 20 },
    { key: 'fern', done: true, reward: -40 }, { key: 'cheer', done: false, reward: 2 }, { key: 'recap', done: false, reward: 10 },
    { key: 'streak7', done: false, reward: 25 },
  ],
  next: { tier: 2, coins: 600, streak: 14 },
};

async function card(dto: FirstWeekDTO) {
  (fetchFirstWeek as jest.Mock).mockResolvedValue(dto);
  await act(async () => { await loadFirstWeek(); });
  return render(<FirstWeekCard />);
}

beforeEach(() => { jest.clearAllMocks(); resetCoins(); });

it('shows nothing until the list is read, and nothing once it is gone (spec §11.2)', async () => {
  expect(render(<FirstWeekCard />).queryByTestId('first-week')).toBeNull();
  expect((await card({ open: false })).queryByTestId('first-week')).toBeNull();
});

it('shows the day, what is done, each row\'s reward (the two bonuses marked), and the next size (C7)', async () => {
  const s = await card(OPEN);
  expect(s.getByText('Day 4 of 7 · 4 of 7 done').props.accessibilityLabel).toBe('First week, day 4 of 7, 4 of 7 done');
  expect(s.getByTestId('first-week-place')).toHaveTextContent(/Place your first piece\+10 bonus/);
  expect(s.getByTestId('first-week-fern')).toHaveTextContent(/Get a fern in the coin shop−40/);
  expect(s.getByTestId('first-week-streak7').props.accessibilityLabel).toBe('7 check-ins in a row, not yet, plus 25 coins bonus');
  expect(s.getByTestId('first-week-fern').props.accessibilityLabel).toBe('Get a fern in the coin shop, done, costs 40 coins');
  for (const t of OPEN.tasks) expect(s.getByTestId(`first-week-${t.key}`).props.accessibilityLabel).not.toMatch(/·|−/);
  expect(s.getByText('Next: 8 × 8 · 600 coins and a 14-day check-in streak. The dashed row is yours then.')).toBeTruthy();
  fireEvent.press(s.getByTestId('first-week-shop'));
  fireEvent.press(s.getByTestId('first-week-sizes'));
  expect(mockNavigate.mock.calls).toEqual([['CoinShop'], ['RoomSizes']]);
});
```

Create `mobile/__tests__/conventions/earnOnly.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Earn only (spec 2026-10-15 §0, §6.1): no purchase or ad library in either package, and no app source that sells
// coins, prices anything in money or shows an ad. Coins never come from money.
const ROOT = path.join(__dirname, '../../..');
const MONEY_DEPS = /^(react-native-iap|expo-in-app-purchases|react-native-purchases|@revenuecat\/.+|expo-ads-.+|react-native-google-mobile-ads|@react-native-firebase\/admob|react-native-fbads)$/;
const MONEY_COPY = /get more coins|buy coins|coin pack|in-app purchase|watch an ad|remove ads|[£€¥]|\$\d+\.\d\d|\b(USD|EUR|GBP)\b/i;

it('neither package depends on a purchase or ad library', () => {
  for (const pkg of ['mobile/package.json', 'backend/package.json']) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, pkg), 'utf8')) as { dependencies?: object; devDependencies?: object };
    const deps = Object.keys({ ...json.dependencies, ...json.devDependencies });
    expect({ pkg, money: deps.filter((d) => MONEY_DEPS.test(d)) }).toEqual({ pkg, money: [] });
  }
});

it('no app source sells coins, prices anything in money or shows an ad', () => {
  const hits = sourceFiles(path.join(ROOT, 'mobile/src')).filter((f) => MONEY_COPY.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  expect(hits).toEqual([]);
});
```

In `mobile/__tests__/components/RoomWelcomeCard.test.tsx`, add to the first test:
`expect(s.getByText('Healthy days earn coins, and coins turn into things for the room.')).toBeTruthy();`

In `mobile/__tests__/lib/roomCopy.test.ts`, add:

```ts
it('tells how coins arrive, and that nothing is sold for money (spec §5.4, §6.1)', () => {
  const items = ROOM_COPY.arrive.items;
  expect(items.find((i) => i.lead === 'KIP coins.')!.body).toBe('Healthy days earn coins, up to 60 a day. The coin shop turns them into new pieces and extra copies.');
  expect(items.at(-1)!.body).toBe('Nothing is sold for money: coins come only from healthy days. The starter room is yours from day one, and items are never taken away.');
});
```

In `mobile/__tests__/screens/KipPage.test.tsx` (import `fetchFirstWeek`), add:

```tsx
it('shows the first-week card in the room card while the list is open (spec §11.2)', async () => {
  (fetchFirstWeek as jest.Mock).mockResolvedValue({
    open: true, day: 1, done: 0, next: { tier: 2, coins: 600, streak: 14 },
    tasks: ['checkin', 'place', 'sleep', 'fern', 'cheer', 'recap', 'streak7'].map((key) => ({ key, done: false, reward: 5 })),
  });
  const utils = await openChat();
  expect(utils.getByTestId('first-week')).toBeTruthy();
  (fetchFirstWeek as jest.Mock).mockResolvedValue({ open: false });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/components/FirstWeekCard.test.tsx __tests__/conventions/earnOnly.test.ts __tests__/components/RoomWelcomeCard.test.tsx __tests__/lib/roomCopy.test.ts __tests__/screens/KipPage.test.tsx`
Expected: FAIL (no card, no coins lines); `earnOnly` passes already (a regression pin).

- [ ] **Step 3: The copy**

In `ROOM_COPY.welcome`, add `coins: 'Healthy days earn coins, and coins turn into things for the room.',`. In
`ROOM_COPY.arrive.items`, the last entry becomes two:

```ts
      { lead: 'KIP coins.', body: 'Healthy days earn coins, up to 60 a day. The coin shop turns them into new pieces and extra copies.' },
      { lead: null, body: 'Nothing is sold for money: coins come only from healthy days. The starter room is yours from day one, and items are never taken away.' },
```

After `ROOM_COPY.sizes`:

```ts
  /** The first-week list (spec 2026-10-15 §11.2, C7). */
  firstWeek: {
    title: 'First week',
    head: (day: number, done: number) => `Day ${day} of 7 · ${done} of 7 done`,
    headSpoken: (day: number, done: number) => `First week, day ${day} of 7, ${done} of 7 done`,
    tasks: {
      checkin: 'First check-in', place: 'Place your first piece', sleep: 'Hit your sleep goal', fern: 'Get a fern in the coin shop',
      cheer: "Cheer a buddy's room", recap: 'Read your first weekly recap', streak7: '7 check-ins in a row',
    },
    reward: (n: number, bonus: boolean) => `${n < 0 ? `−${-n}` : `+${n}`}${bonus ? ' bonus' : ''}`,
    rowSpoken: (task: string, done: boolean, n: number, bonus: boolean) =>
      `${task}, ${done ? 'done' : 'not yet'}, ${n < 0 ? `costs ${-n} coins` : `plus ${n} coins${bonus ? ' bonus' : ''}`}`,
    next: (coins: string, streak: number) => `Next: 8 × 8 · ${coins} coins and a ${streak}-day check-in streak. The dashed row is yours then.`,
    nextSpoken: (coins: string, streak: number) => `Next: 8 by 8, ${coins} coins and a ${streak}-day check-in streak. The dashed row is yours then.`,
    shop: 'Coin shop',
    sizes: 'See room sizes',
  },
```

- [ ] **Step 4: The card, the welcome and the KIP page**

`mobile/src/components/coins/FirstWeekCard.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FirstWeekTaskKey } from '../../api/coins';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { useFirstWeek } from '../../lib/coins/coinsStore';
import { ROOM_COPY, coinCount } from '../../lib/room/roomCopy';

const F = ROOM_COPY.firstWeek;
const BONUS: ReadonlySet<FirstWeekTaskKey> = new Set<FirstWeekTaskKey>(['place', 'streak7']);

// The first-week list (spec 2026-10-15 §11.2, C7): seven days from day 1, inside the KIP page's room card, gone after
// day 7. Each row ticks when the server says so; only the two bonus rows pay extra. "Cheer a buddy's room" ticks from
// P4 (ruling 24). The next size's dashed rows are on Room sizes (ruling 15).
export function FirstWeekCard() {
  const week = useFirstWeek();
  const navigation = useNavigation<any>();
  if (!week || !week.open) return null;
  return (
    <Card testID="first-week" className="gap-2 p-3">
      <SectionLabel>{F.title}</SectionLabel>
      <Text accessibilityLabel={F.headSpoken(week.day, week.done)} className="text-body">{F.head(week.day, week.done)}</Text>
      {week.tasks.map((t) => (
        <View key={t.key} testID={`first-week-${t.key}`} accessible accessibilityLabel={F.rowSpoken(F.tasks[t.key], t.done, t.reward, BONUS.has(t.key))}
          className="flex-row items-center justify-between gap-2">
          <View className="shrink flex-row items-center gap-2">
            <Text className={t.done ? 'text-caption text-primary' : 'text-caption text-muted-foreground'}>{t.done ? '✓' : '○'}</Text>
            <Text className={t.done ? 'shrink text-caption text-muted-foreground' : 'shrink text-caption'}>{F.tasks[t.key]}</Text>
          </View>
          <Text className="text-caption" style={{ fontVariant: ['tabular-nums'] }}>{F.reward(t.reward, BONUS.has(t.key))}</Text>
        </View>
      ))}
      <Text accessibilityLabel={F.nextSpoken(coinCount(week.next.coins), week.next.streak)} className="text-caption text-muted-foreground">
        {F.next(coinCount(week.next.coins), week.next.streak)}
      </Text>
      <View className="flex-row gap-2">
        <Button testID="first-week-shop" variant="outline" className="h-[44px] flex-1" onPress={() => navigation.navigate('CoinShop')}>{F.shop}</Button>
        <Button testID="first-week-sizes" variant="outline" className="h-[44px] flex-1" onPress={() => navigation.navigate('RoomSizes')}>{F.sizes}</Button>
      </View>
    </Card>
  );
}
```

`mobile/src/components/coach/RoomWelcomeCard.tsx`: under `<Text className="text-body">{W.text}</Text>` add
`<Text className="text-body">{W.coins}</Text>`, and the comment's "P2 adds the coins line." becomes "With P2's coins
line (spec §11.1)."

`mobile/src/components/coach/RoomCard.tsx`: the props gain `/** Drawn last in the card: the first-week list (spec §11.2). */ children?: React.ReactNode;`
(destructured with the others) and `{children}` goes right after `{footer}`.

`mobile/src/screens/CoachScreen.tsx` (import `FirstWeekCard`): the `<RoomCard … />` element gets a child,

```tsx
    <RoomCard
      …the props as they are…
    >
      <FirstWeekCard />
    </RoomCard>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/components/FirstWeekCard.test.tsx __tests__/conventions __tests__/components/RoomWelcomeCard.test.tsx __tests__/components/RoomCard.test.tsx __tests__/lib/roomCopy.test.ts __tests__/screens/KipPage.test.tsx __tests__/screens/KipPageCollapse.test.tsx __tests__/components/InventoryDrawer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile typecheck (10).

```bash
git add mobile/src/components/coins/FirstWeekCard.tsx mobile/src/components/coach mobile/src/screens/CoachScreen.tsx mobile/src/lib/room/roomCopy.ts mobile/__tests__
git commit -m "feat(mobile): the first-week card on the KIP page, the coins lines in the welcome and the drawer, and an earn-only guard"
```

---

### Task 15: Whole-branch verification, the final review, the run-folder sync and the simulator check (controller)

- [ ] **Step 1: Suites, typechecks and guards**
  - Full backend suite with `backend-jest.sh` (no path), then backend `tsc --noEmit -p .`. Expected: green, 0.
  - `schema-drift.sh`. Expected: `no drift`.
  - Full mobile suite and the mobile typecheck. Expected: green, 10 (or the count recorded in the ledger).
  - `__tests__/conventions` alone: `buttons`, `typography`, `kipCopy`, `noCharacters`, `kipWorn` and the new
    `earnOnly` all pass; the buttons guard has no new entry (one `DecorateTile:testID`, none for the wallet or the shop).
  - `node scripts/room-art-size.mjs` (under 300 KB) and `ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf`;
    record both in the ledger.
  - From `backend/`, run `scripts/export-cosmetics.ts` and confirm `git status` shows no change to
    `mobile/src/lib/room/catalogue.json` or `mobile/src/lib/room/iso/geometry.ts`.
  - `git diff 7fccf46 -- mobile/src/components/social/CampScene.tsx mobile/src/components/social/CampBanner.tsx` is
    empty (OVERRIDE-P13).
  - `grep -rnE "console\.(info|log|warn|error)" backend/src/coins backend/src/room backend/src/cosmetics backend/scripts/convert-room-layouts.ts`:
    every line logs an event name with kinds, tiers or counts only (no user id, item id, amount, balance, layout or
    count map). `grep -rn "userId" backend/src/coins | grep -i "console"` prints nothing.
  - `grep -rnE "from ['\"][^'\"]*/(coins|cosmetics|room)/" backend/src/coach` prints nothing (also pinned by
    `tests/room/noCoachImport.test.ts`).
- [ ] **Step 2: The final review:** run the whole-branch review on opus with
  `review-package docs/superpowers/plans/2026-10-15-kip-freebuild-p2.md 7fccf46 HEAD`, then one fix wave. The reviewer
  checks, row by row:
  - spec §6.2's table against `coins/sources.ts` and `coins/firstWeek.ts` (each source's amount, key and cap day; the WEEK
    guard; on-time check-ins only; no backpay and its one exception);
  - §6.3 against `coins/ledger.ts` (the lock, filter before trim, the (kind, key) order, the 0 row, the cheer limit,
    `createManyAndReturn` + `skipDuplicates`, the wallet, the CHECK constraint, spends in the caller's transaction);
  - §6.4–§6.6 against `catalogue.ts` and `coins/shop.ts` (prices 25–200, rule pieces only once earned, the request id,
    the three error codes) and the shop screen (never optimistic, "Needs n more");
  - §7 against `room/expand.ts` and the Room sizes screen (both gates, `stale_tier`, the version bump, stored wall
    pieces, the unlock moment) and the editor's `rebased` and pan (P2-CARRY);
  - §11.2 against `coins/firstWeek.ts` and the card (day 1, the seven rows, the two bonuses, P1's placement, lapse);
  - §12 P2's routes (statuses, bodies, private no-store, 32 KB) and §12's deletion and telemetry rules; §2.4's drop
    migration and the conversion script; §13's P2 rows;
  - the privacy rules (no user id with amounts, balances, item ids or layouts in any log; nothing coin-related in the
    coach; no balance in any buddy DTO), the earn-only rule, and `USER_OWNED_MODELS`;
  - the five Review Focus lines and every ruling of this plan and the P1 ledger.
- [ ] **Step 3: Sync to the run folder** (`~/dev/biometrics-run`, outside iCloud):
  1. Back up the dev DB with `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/backup-db.sh` (`pg_dump -Fc`, only when
     `DATABASE_URL` is local; never print the URL); the dump is `biometrics-before-kip-freebuild-p2-2026-10-15.dump`.
     Confirm its byte count is non-zero.
  2. `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/sync-run.sh`: rsyncs `backend/`, runs `npm install` and
     `npx prisma generate`, then `scripts/convert-room-layouts.ts` **before** `npx prisma migrate deploy` (ruling 25;
     expected: one `room.converted` line, then the migrations `20261017120000_drop_slot_room` and
     `20261017130000_coins` applied with no guard exception), then `npm run build`; then syncs `mobile/` (excluding
     `node_modules`, `ios`, `android` and every `.env*`) and runs `npm install`. No native module is added
     (`expo-crypto` is already in the build), so no prebuild or `xcodebuild`.
  3. Restart the API on :3000 with `COINS_LAUNCHED_AT=2026-10-01T00:00:00.000Z` in its environment (dev only, ruling
     1), so earning works before the real launch date.
  4. Restart Metro on localhost: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p2/metro-local.sh`.
  5. For a fresh test account only (never the owner's own data), seed 700 coins and the CHECK_IN level II badge with a
     scratch script kept in the workspace folder and never committed,
     `.superpowers/sdd/2026-10-15-kip-freebuild-p2/seed-coins.ts`: it looks the account up by email, calls
     `applyCoinEvents(user.id, [{ kind: 'firstweek', sourceKey: 'dev:seed:1', amount: 700, capDay: null }], new Date())`
     and creates the `Achievement` row (`family: 'CHECK_IN'`, `level: 2`), run from `~/dev/biometrics-run/backend` with
     ts-node.
- [ ] **Step 4: Simulator check, with screenshots** (`xcrun simctl io booted screenshot <file>` into
  `.superpowers/sdd/2026-10-15-kip-freebuild-p2/shots/`). With the demo account and the seeded test account:
  - **The KIP page:** the wallet in the header (its number, 44 points, VoiceOver reads "{n} KIP coins. Open coin
    history"); the first-week card under the room (Day n of 7, the rows, the next size); after a check-in, the next
    focus lands "+5!" in KIP's bubble with "Checked in" under the room, once.
  - **Coin history:** today against 60 with its bar, the rows ("Morning check-in · Today, 08:03 · +5"), How to earn,
    Load more with 31+ events, the shop button.
  - **The shop:** the featured set, the tabs, a locked rule piece with its rule, a tile's sheet ("You have 700 · 550
    after"), Get for 150 (loading, then "Old radio is in your inventory."), the wallet drops; double-tap does not buy
    twice; the drawer's New tab shows the radio; place it on the desk and Done.
  - **Room full → Room sizes:** with a seeded 40-piece room, the card's See room sizes; the sizes screen with both
    gates and progress, the dashed rows of 8 × 8; Grow to 8 × 8 spends 600; KIP cheers "MORE ROOM!", the NEW tags and the
    card; Place things returns to the editor, now 8 × 8, re-centred, with the draft kept; Done saves.
  - **The six shop pieces** in the room, day and night (the candle and the sign glow after dark).
  - Light mode and the largest text size: the wallet, the shop tiles, the sheet and the sizes rows stay readable.
- [ ] **Step 5: Report to the owner** with the screenshots, the perf and size numbers and the OWNER NOTES (ruling 1: the
  release-4 date and the coins launch instant; rulings 2–4: the prices, the sold pieces and the four weekly sets;
  ruling 15: where the dashed rows show; ruling 24: the cheer row ticks from P4). Push the branch
  (`git push -u origin feature/kip-freebuild-p2`; never main, never force). Open a draft PR (base
  `feature/kip-freebuild`) only when the owner asks, with no attribution footer.

---

## Self-review (2026-10-15, against the spec and the real code on `feature/kip-freebuild-p2` at 7fccf46)

**Spec coverage, P2 only:**

| Spec | Task |
| --- | --- |
| §0 standing rules (earn only, frozen Campfire, buttons, A4 type, privacy, civil dates) and the accepted defaults | Global Constraints; 3 (log lines), 10–14 (buttons, type, copy), 14 (`earnOnly`), 15 (frozen check) |
| §0 controller ruling: a P1 first placement pays the +10 when P2 arrives | 8 |
| §2.1 `price`, `shop`, release 4 | 2 |
| §2.2 `ItemGrant`, counts with grants, the never-removed guard extended | 3, 6 |
| §2.4 P2 drops `room` (script first, guarded migration) | 0 (sync order), 1 |
| §4 P2's art batch; existing rule pieces not re-made | 2 |
| §5.2 the editor's wallet; §5.3 See room sizes; §5.4 Coin shop and the coins line | 10, 13, 11, 14 |
| §6.1 rules (earn only, no loss, no one sees a balance) | 3, 14, Global Constraints |
| §6.2 sources, amounts, cap, cap day, only measured data, no backpay, no health values | 3, 4, 5 |
| §6.3 the ledger, two-person locks (P4 uses the same lock; ruling 5), earn hooks, spends, history pages | 3, 4, 5 |
| §6.4 prices; §6.5 unlocks and coins together; §6.6 the shop | 2, 6, 11 |
| §6.7 wallet, history, coins land | 10, 12 |
| §7 room sizes, both gates, the badge never re-locks, stored wall pieces, the row and version, the unlock moment, the editor's rebase | 7, 13 |
| §11.1 the welcome's coins line | 14 |
| §11.2 the first-week list, its bonuses, the backfill, the locked-row overlay | 8, 13, 14 |
| §12 P2 endpoints, concurrency, deletion, telemetry, nothing to the model | 3, 5, 6, 7, 8 |
| §13 P2 rows: the MONTH-open hook; release 4's date | 5, 2 |
| §16 P2 tests (ledger, expansion, first week and expand, deletion, guards; mobile coins) | each task's Step 1 |
| P1 ledger P2-CARRY (pan on tier, width and height change) | 13 |
| P1 ledger Task 4 minor (p10 before p9) | 6 |
| §8, §9.2, §10, P3 and P4 rows of §12 | not built (out of P2) |

**Where the spec cannot be followed literally, and the ruling taken:**
1. **"`art.neonheart`"** names a new shop piece the boards call "Neon heart", which is already Spec B's `art.heart`
   (with a rule): the new id ships as "Neon heart sign", drawn as a sign (ruling 2).
2. **"Coins buy … extra copies"** does not say which existing pieces carry a price: placeable starters except the
   desks and the welcome lantern, plus the four rule pieces the boards price (ruling 3).
3. **"This week only" weekly sets** would hide most of P2's six pieces most weeks: every P2 price is always on and the
   weekly set is a featured bundle with no bundle price (ruling 4).
4. **An unearned rule piece** has no refusal code of its own in §12: it answers `400 not_for_sale` (ruling 3).
5. **The wallet as a raw `Pressable`** (§6.7) contradicts the owner's Button-only rule: it is a `Button` (ruling 9).
6. **`coinCopy.ts`** (§15) contradicts the owner's "all copy in ROOM_COPY": the strings live in `ROOM_COPY` (ruling 10),
   and P1's copy test, which forbids the word "coin", is replaced by a money-and-ads guard (ruling 11).
7. **"The shop from … the KIP page wallet"** (§6.6) and **the wallet's label "Open coin history"** (§6.7) disagree: every
   wallet opens the history, whose Coin shop button leads on (ruling 38).
8. **History "sheet" and the piece "sheet"** as RN modals would be dropped over the editor's native modal: routes and an
   in-screen panel instead (ruling 8).
9. **The coins bubble "does not float" under Reduce Motion:** it is KIP's own bubble, which never floats (ruling 12).
10. **The shop's Effects tab, the effect line and room sizes' effect slots** need P3's `effect` field: shown from P3
    (rulings 13, 14).
11. **The locked-row overlay "in the room"** (§11.2) is out of the KIP page's desk crop: drawn on Room sizes (ruling 15);
    the unlock tags are a row, not pinned to tiles (ruling 16).
12. **§12's expand answer** carries no count of stored pieces, but §7's card names it: `stored` is added (ruling 17).
13. **The gate's badge** is a stored level, which is written only when badges are evaluated: expansion evaluates that
    family first (ruling 18).
14. **"Rebases its draft"** (§7) does not say what happens to undo: it is cleared (ruling 19).
15. **"From the day P2 reaches you, or sign-up"** (§11.2) is ruled per account (ruling 21); **"7 check-ins in a row"**
    follows the CHECK_IN family's rule and may start before day 1 (ruling 22); **the cheer row** can only tick from P4
    (ruling 24).
16. **"Dropping `room`"** with a migration that "starts with a guard": the drop is its own migration so its guard sits
    first, and `layout` becomes NOT NULL in it (ruling 25).
17. **"By the same marker the SLEEP_GOAL badge uses"**: the badge's start-date shift after an easing change would skip
    nights that met the goal in effect, so only its per-night marker is used (ruling 27).
18. **"A stale GET can't overwrite a purchase" with "ignore older"**: coins have no version, so the epoch is the rule
    (ruling 33).
19. **Coin history rows** carry no key (§12), so a purchase reads "Coin shop", not the piece's name (ruling 35).

**Placeholder scan:** no "TBD" / "TODO" / "similar to". Every module, route, store, screen, reducer action, migration,
copy string and test is written out; where a task edits a file it keeps, the exact lines that change are named.

**Type consistency:** these names are used identically across tasks:
- backend: `layoutForRow`, `convertRoomLayouts`, `CosmeticRelease`, `ShippedRelease`, `PRICES`, `CoinEarn`,
  `CoinWritten`, `CAPPED_KINDS`, `EARN_KINDS`, `DAILY_CAP`, `PAID_CHEERS_A_DAY`, `planCapped`, `applyCoinEvents`,
  `spendInTx`, `balanceOf`, `coinsConfig`, `EARN_AMOUNTS`, `LOOKBACK_DAYS`, `planEarns`, `loadEarnInputs`, `earnCoins`,
  `coinsHooks`, `earnCoinsSafely`, `readCoins`, `markCoinsSeen`, `encodeCursor`, `decodeCursor`, `coinsRouter`,
  `noStore`, `countsOf`, `grantTotals`, `SHOP_WEEKS`, `weekSet`, `offeredIn`, `forSale`, `shopWeek`, `readShop`,
  `parsePurchase`, `buyPiece`, `TIER_GATES`, `parseExpand`, `coveredBy`, `expandRoom`, `ExpandBody`, `checkInRun`,
  `bonusEarns`, `ensureStartedOn`, `firstWeekEarns`, `readFirstWeek`, `FirstWeekDTO`, `TASK_REWARDS`;
- mobile: `CoinsDTO`, `CoinEventDTO`, `ShopDTO`, `PurchaseDTO`, `ExpandDTO`, `FirstWeekDTO`, `fetchCoins`,
  `postCoinsSeen`, `fetchShop`, `postPurchase`, `postExpand`, `fetchFirstWeek`, `Coins`, `loadCoins`,
  `loadMoreCoins`, `setCoinBalance`, `markCoinsSeen`, `loadFirstWeek`, `resetCoins`, `useCoins`, `useFirstWeek`,
  `coinSession`, `newRequestId`, `buyPiece`, `growRoom`, `applyPurchase`, `applyCosmeticsBody`, `coinCount`,
  `whenLabel`, `historyRows`, `todayShare`, `CoinGlyph`, `WalletChip`, `shopTiles`, `whereLine`, `pieceSheet`,
  `SHOP_TABS`, `landingOf`, `LANDING_MS`, `useCoinsLanding`, `sizeRows`, `growLine`, `gateOf`, `familiesOf`,
  `nextRowsRects`, `FirstWeekCard`, `spriteRows`; editor actions `counts` and `rebased`.

**Review Focus:** each of the five lines has its pinning test in the owning task (1: Tasks 3 and 5; 2: Tasks 4 and 5;
3: Tasks 6 and 11; 4: Tasks 7 and 13; 5: Tasks 3, 10 and 12). The shop's and the sizes screen's look at the largest
text size and the six pieces at night are also checked by hand in Task 15.

**Deferred P1 minors not folded in** (P2 does not touch their code): the backend load flakes (Task 1), `seatTile`
reflecting (Task 2), the desk's Another refusing with "full" and Replace desk's silent cases (Task 9), the KIP
sprite's 4-cell overlap tie (Task 8), the plank's spots on Flip (final review M5, parked).
