# KIP Free-build P3 (effects, the living room and KIP walking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KIP's room comes alive: some pieces do something (a floor lamp's warm pool after dark, an old radio's lo-fi
loop and floating notes, a cat that wanders and naps, a clock with your real time, a trophy shelf of your badge levels),
plants grow with your sleep-goal nights, the room runs only as many effects as its size allows, and between answers
KIP gets up from its desk and walks to the radio, a plant or the cat. This plan ships **P3** of the free-build spec:
item effects and effect slots (§8.1, §8.2), the effect pieces of release 5, the health-linked states and `living`
(§8.3), piece cards, the radio loop through `expo-audio` (off by default), tap effects, KIP walking and the `water` pose
(§3.6, §9.2), the Effects tabs and effect lines that P2 deferred (P2 plan rulings 13 and 14), and the P3 rows of §12,
§13 and §16. Social (P4: visits, gifts, challenges, the share card) is out.

**Architecture:**
- **Backend** (Tasks 1–3):
  - `backend/src/room/geometry.ts` (copied verbatim to the app) gains `EffectKind`, the `effect` field of `IsoSpec`,
    each tier's effect slots (3 / 5 / 8) and the one effect rule both sides use (`effectPieces`, `runningEffects`,
    `effectsRaised`);
  - `backend/src/cosmetics/catalogue.ts` gains release 5 (`pet.tabby`, `shelf.awards`) and the effect of every effect
    piece;
  - `PUT /me/cosmetics` answers `400 effects_full` only when a save raises the effect count above the slots;
  - `backend/src/room/living.ts` computes `living: { plantStage, petEnergy, awards }` for `GET /me/cosmetics` (bands and
    small counts, never a raw value, never logged, never in a buddy DTO).
- **Mobile** (Tasks 1, 4–13):
  - `lib/room/effects.ts` turns the layout, the tier, `living` and the device clock into each piece's **effect state**
    (`'lit'`, `'notes'`, `'live@07:12'`, `'g3'`, `'nap'`, `'a543'`, `'squash1'` …). The state is part of each piece's
    picture key and of the static room's key, so effects never re-record a picture on an animation tick;
  - the effect art (the lamp's pool, the radio's notes, the clock's hands, growing plants, the cat's three states, the
    trophy shelf's awards, the tap squash) lives beside the iso pieces;
  - `RoomView` gains **runs mode** (P1 ruling 8's "per-piece pictures and mover lists come with P3"): with a mover on
    screen it draws the shell, one cached picture per floor piece and the movers in depth order, and the loop frames
    under an inverted Skia clip of KIP's silhouette; a step only moves a transform;
  - `lib/room/live/` holds walking (`walk.ts`, `useKipWalk.ts`) and the cat's wander (`catWander.ts`);
  - the radio's sound (`useRoomRadio`, `expo-audio`, one bundled 20-second loop), the piece card route (`PieceCard`),
    the editor's effect slots, the drawer's and the shop's Effects tabs and Room sizes' effect slots.
- **Verification** (Task 14): full suites, the final review, the DB backup, the run-folder sync, an `expo prebuild` and
  iOS rebuild for the new native module, the dev backend with `COINS_LAUNCHED_AT`, and the simulator check.

**Tech Stack:**
- Backend: Express 5, Prisma 6 / Postgres, Jest with supertest, ts-node for scripts. No schema change, no migration.
- Mobile: Expo 57 / React Native 0.86 / React 19.2 with NativeWind, React Navigation 7 (native stack), Reanimated 4,
  `react-native-gesture-handler` 2.32, `@shopify/react-native-skia` 2.6.2, `expo-secure-store` (the sound switch),
  **`expo-audio` ~57.0.5 (new, a native module: Task 12 installs it, Task 14 prebuilds and rebuilds iOS)**. macOS
  `afconvert` encodes the radio loop. Jest 30 with React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-kip-freebuild-design.md` (binding; this plan implements its **P3** row of
§14: §8.1–§8.3, §3.6 and §9.2, the effect pieces of release 5 (§2.1, §4), piece cards (§8.1), the `living` and
`effects_full` rows of §12, the "Effects 3 of 3" reason of §5.3, the Effects tab of §5.4 and §6.6, the effect slots of
§7, and §16's P3 tests).
- Built base: P2 on `feature/kip-freebuild-p2` dadb1c8 (draft PR #68), on P1 (`feature/kip-freebuild`, draft PR #67),
  on Specs A and B (`feature/kip-room`). This plan builds against that real code; where the spec and the code differ, a
  ruling below says which way.
- Binding ledgers: `.superpowers/sdd/2026-10-15-kip-freebuild-p1/progress.md` and
  `.superpowers/sdd/2026-10-15-kip-freebuild-p2/progress.md`. Every `Ruling:` line in either binds P3 unless a ruling
  below supersedes it (Task 0 copies them into P3's ledger).
- Visual sources in `docs/design/freebuild/project/`: `F7.dc.html` (items that do something, the piece card), `C5.dc.html`
  (a living room, words the room uses), `C6.dc.html` (KIP lives there, "Effects 3 of 5"), `C1.dc.html` (the radio's
  notes), `C2.dc.html` (effect slots per size). Generators: `docs/design/freebuild/gen/isox.py` (`plantg`, `cat_play`,
  `trophy_shelf`, `glow_piece`, `kipx`) and `c5.py`, `c6.py`.
- Out of this plan: visits, the visit switch, room cheers, gifts, challenges and trophies, the share card (P4). The
  seams P3 leaves for P4: `NEUTRAL_LIVING` (a visit and the share card draw it), effect states that never leave the
  phone, and `living` kept out of every buddy DTO.

## Global Constraints

- **Branch:** `feature/kip-freebuild-p3`, in the worktree
  `/Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab`, cut from P2's head dadb1c8; this plan's
  commit sits on top.
  - Never `cd` to another repo root, never switch branches, never push to main, never force-push, never bare
    `git stash`.
- **Commits:** plain conventional messages with `git commit -m "…"`: **no `Co-Authored-By` trailer and no mention of
  Claude, Cursor or AI** (owner rule; it applies to every subagent). A PR body carries no attribution footer either.
- **Subagents** run on model **opus**.
- **Every task keeps both full suites green at its commit.** Run the touched tests while working. Before the commit,
  run the full mobile suite, both typechecks and, for a task that touches `backend/`, the full backend suite. Task 1
  regenerates `mobile/src/lib/room/catalogue.json` and `mobile/src/lib/room/iso/geometry.ts`, so it runs both.
- **Mobile commands**, from `mobile/`:
  - `export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH`
  - Tests: `node node_modules/.bin/jest --forceExit <paths>`. With no paths it runs the full suite.
  - Typecheck: `node node_modules/.bin/tsc --noEmit --types jest,node --pretty false | grep -c "error TS"`. The
    baseline is **10** (P2 ledger, Task 15); Task 0 measures it again on dadb1c8. No task may add an error.
- **Backend commands**, from `backend/`. Never run two backend test runs at once, never point tests at the dev
  `biometrics` DB, and never print a database URL.
  - Tests go only through `.superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh <paths>` (Task 0 copies it).
  - A suite that fails or SIGSEGVs under full-suite load is rerun alone before it is treated as real (P2 ledger: the
    "Can't reach database server" failures are environmental).
  - Typecheck: `node node_modules/.bin/tsc --noEmit -p .` must report **0** errors.
  - Scripts run with `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/<name>.ts`; the catalogue
    export is `scripts/export-cosmetics.ts`.
- **Owner-accepted defaults (spec §0 and this plan's brief), verbatim:**
  - "**Radio sound:** `expo-audio` is added in P3 with one bundled 20-second loop (under 300 KB), off until turned on."
  - Effects NEVER give health advice.
  - Nothing cosmetic or effect-related reaches the coach or the model.
  - Earn-only: nothing is ever sold for real money, there are no ads and no shipping timers.
- **Buttons:** use shadcn-style `<Button>` only (`mobile/src/components/ui/button.tsx`): `rounded-lg`, never pills, at
  least 44 pt (`h-[44px]` or `size-[44px]`). Tabs and tags are `Button`s or `rounded-lg` views. The room's tap targets
  are not buttons (the room stays one image, spec §5.7); this plan adds **no** raw `Pressable` with a button role, so
  `__tests__/conventions/buttons.test.ts` gets no new entry. The sound switch is React Native's `Switch`, as
  `ChatSettingsSection.tsx` uses it.
- **Type:** A4 type tokens only (`text-score`, `text-number`, `text-display`, `text-heading`, `text-headline`,
  `text-body`, `text-caption`, `text-fine`, `text-page-title`, `text-label`). Pixel labels use `font-pixel text-label`.
  No inline `fontSize` / `fontFamily`, no arbitrary `text-[..px]`. Tabular numbers use the `tabular-nums` class.
- **Copy:**
  - All copy goes in `ROOM_COPY` (`mobile/src/lib/room/roomCopy.ts`): effect lines under `ROOM_COPY.effects`, the piece
    card under `ROOM_COPY.card` (P2 ruling 10).
  - Spoken labels contain no "·" (U+00B7), no "−" (U+2212), no "×" and no Roman numerals.
  - The product name is **KIP** in capitals; `__tests__/conventions/kipCopy.test.ts` stays green.
  - Effect and living copy never gives health advice: no "should", "try", "more", "need", "must", and no sentence that
    opens with a health verb (Task 4's guard). It never shows a health value (no minutes, no steps, no scores).
  - No currency symbol, no price in money, no "get more coins" or ad copy (P2's `earnOnly` guard stays green).
- **Privacy and logging (spec §0, §12):**
  - Logs carry event names and counts only: never a user id together with item ids, layouts, coins, counts or a living
    state. P3 adds **no** log line.
  - Health values never appear in logs, in `living` (bands and small counts only) or in any coin row.
  - Nothing cosmetic or effect-related reaches the coach or the model: `backend/tests/room/noCoachImport.test.ts`
    already fails on any `src/coach/` import of `cosmetics/`, `room/`, `coins/` or `challenges/`; Task 4 adds the app's
    twin (`mobile/__tests__/conventions/noRoomInCoach.test.ts`).
  - `living` is sent only to its owner: never in a buddy DTO, a story, a request or a log (Task 3's test).
- **Account deletion:** P3 adds **no** user-owned model (the sound switch is device-only, `living` is computed), so
  `USER_OWNED_MODELS` (`backend/src/users/deletion.ts`) and `tests/users/ownedData.ts` are unchanged. A new user-owned
  model would go into both, in the task that adds it.
- **Dates and times:** civil dates only through the existing helpers (`localCivilDateOrUtc`, `todayFor`,
  `civilDateToUtcMidnight`); never `new Date('YYYY-MM-DD')` in the app. The device clock's local hour and minute come
  from `Date#getHours` / `getMinutes` in one place (`clockNow`, Task 5). Backend constants use a full ISO instant with
  `Z`.
- **Frozen files:** `mobile/src/components/social/CampScene.tsx` and `CampBanner.tsx` stay frozen
  (OVERRIDE-P13). Task 14 checks `git diff dadb1c8 -- <both>` is empty.
- **Reduce Motion:** KIP never walks, the cat never wanders, loops show frame 0, the tap squash does not play and the
  plant smile frame never shows. The clock still shows the time (it changes once a minute; it is not motion).
- **Screen readers (house patterns):** a change is announced with `AccessibilityInfo.announceForAccessibility` on iOS
  only, with a polite `accessibilityLiveRegion` for Android; a sheet takes focus with
  `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(ref))` on open and hides what is behind it on Android with
  `importantForAccessibility="no-hide-descendants"` (iOS: `accessibilityViewIsModal`), as `CoinShopScreen.tsx` does.
- **Performance (spec §3.7, P1 ruling T10-FIX):**
  - P1's room build budget stands: building every piece picture cold for 90 pieces is about 9 ms in Jest (a
    measurement, not a gate; Spec B ruling P32); on device, under 8 ms.
  - **An animation tick (the 400 ms loop frame, a walk step, a sway, a bob) records 0 pictures.** KIP walking never
    re-records the static pictures: it only changes a transform and, at a tile, the draw order of cached pictures.
  - A state change may record: a pose change (KIP's three frames, cached per pose), a pick-up or drop, the light, a
    living change, the clock's minute (once a minute, only while a running clock is in the room).
- **Shared test fixtures** live in `mobile/jest-mocks/` and `backend/tests/**/helpers.ts`, never as `__tests__` files.
- **Skia in Jest:** `@shopify/react-native-skia` is mocked by `mobile/jest-mocks/skia.js`; `RoomView` has the stand-in
  `jest-mocks/RoomView.js`. No test loads the real Skia module. `expo-audio` is mocked in `jest-setup.js` (Task 12).

## Plan rulings (made while writing the plan)

1. **Release 5 and its date.** `SHIPPED_RELEASES = {1, 3, 4, 5}`; `pet.tabby` and `shelf.awards` are `release: 5`;
   `RELEASE_LAUNCHED_AT[5]` is `2026-10-23T00:00:00.000Z`. OWNER NOTE: set to the real ship date at merge, as P1's and
   P2's release dates are.
2. **The two new pieces.** `pet.tabby` ("Ginger cat"): pet slot, coin shop only (`'C'`), 180 coins, 3 loop frames
   (`'A'`, its tail), 1 × 1, `facings: 1`, effect `wander`. `shelf.awards` ("Trophy shelf"): shelf slot, starter,
   a wall piece `wall: [8, 3]`, `facings: 1`, effect `awards`, drawn in the iso room only. **It is not sold** (P2
   ruling 3's list of unsold starters gains it): a second shelf would show the same awards.
3. **Effects on existing ids** (spec §8.2): `corner.floorlamp` `light`, `item.radio` `sound`, `art.clock` `clock`; and,
   hidden until B2 ships, `lamp.lava` `light`, `item.duck` `tap`, `pet.cat` `wander`. The duck keeps P2's price of 40
   (P2 ledger OWNER NOTE: §6.4 bands effect pieces 120–200; owner tuning, B2-hidden).
4. **One effect rule, in geometry.** `TIERS` gains `effects` (3 / 5 / 8). The effect pieces of a layout are ordered
   "first placed first" by the P2 instance rank (`p<n>` by n, any other id 0), then id; the first `slots` **run**, the
   rest are **inert** (spec §8.1 "the first ones by instance id run"). A save is refused (`400 effects_full { slots }`)
   only when its effect count is above the slots **and** above the stored layout's count (§8.1), checked after
   `room_full` and before `403 not_owned`, against the stored layout sanitised by `readLayout` (or the starter layout
   when there is no row). The editor refuses the same way on every add (`Place`, `Another`, a drop from the drawer,
   Apply set) with "Effects 3 of 3: store one to run another"; a move, Flip, Turn or Store never is.
5. **Inert pieces are plain decor.** An inert effect piece draws exactly as before P3 (the clock keeps its old turning
   hand, the floor lamp its glow without the pool, the radio no notes, the cat sits, the shelf is empty).
6. **`living`** is `{ plantStage: 1 | 2 | 3 | 4 | 5, petEnergy: 'nap' | 'wander' | 'play', awards: number[] }`:
   `plantStage = min(5, 1 + floor(sleepGoalEvents / 7))` over **every** `CoinEvent` of kind `sleep_goal` (0-coin rows
   included); `petEnergy` from today's STEPS rollup (the user's local date) against `STEPS_GOAL`: under 30% `nap`, 30% to
   under 100% `wander`, at or over `play`; `awards` the levels of the user's `Achievement` rows, highest first (then
   earliest), at most 8. It rides on every cosmetics body (`GET`, `PUT`'s answer, the expand answer). **The 22:00 nap**
   is applied by the app from the device clock (22:00 to 05:59), as the window's night is; the server never sends an
   hour.
7. **Effect states are picture keys** (spec §3.7 "keyed by (item, facing, mirror, night, colour, effect state)"):
   `IsoArtOpts.effect` joins the piece cache key and `isoRoomKey`. The running clock's minute is a state
   (`'live@07:12'`), so a room with a running clock rebuilds its static picture once a minute and never on a tick.
8. **Growing plants** follow `isox.py`'s `plantg`: the pot stays; the foliage is cut from the top to a fraction
   (stage 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1) and narrowed by `0.45 + 0.55 × fraction`. Every plant shows the room's
   one stage. Stage 5 draws the P1 plant unchanged.
9. **The plant mood** ("one extra smile frame in its idle loop"): in the KIP page's `idle` stage, with a plant in the
   room and KIP at its seat, loop frame 2 draws KIP with mood `curious` (eyes up, KIP's happy look). The three KIP frames
   are already recorded per pose, so it costs nothing per tick.
10. **The cat.** Its own art draws three states: `sit` (tail flick, the still and inert look), `play` (paw), `nap`
    (curled, with "z" frames). Napping, it lies on the first free `pet.bed` (by instance id) instead of its own tile.
    It **wanders** only in the KIP page's room card (`RoomView` `live`), with Reduce Motion off and the screen focused:
    from its tile to the nearest free tile of the **front row** (`j = m − 1`, the row nearest you along the left side),
    then up to 3 tiles along it, pausing 2.4 s at each end, one tile per 800 ms. With no route it sits. Its loop frames
    are not clipped by anything.
11. **Runs mode** (P1 ruling 8): when a mover is on screen (KIP off its seat, or a wandering cat), `RoomView` draws
    `under` (the shell, the wall pieces and the rugs), one picture per floor piece with what stands on it (cached by
    the piece's own content key, so a minute or a drop re-records only what changed), the movers at their depth
    (`depthOrder` with each mover as a 1 × 1 box; KIP at its seat keeps the desk-before-KIP edge), the light and glow
    layer, and the loop frames. With no mover it draws P1's four pictures, unchanged.
12. **Loops over a walking KIP** are cut by an inverted Skia clip of KIP's silhouette (its path, built once per pose),
    moved with KIP. A loop cell of a piece standing in front of KIP is hidden inside KIP's outline too (the piece's
    base still covers KIP there): a few cells for a few seconds, the price of never re-recording frames per step.
13. **Walking** (§9.2): targets are the running effect pieces and the plants (a wandering cat is no target; a napping or
    playing one is). Use tiles as §9.2; only targets whose standing KIP fits inside the room card's current crop. KIP
    leaves by the desk's exit tile (P1 ruling 11), glides **half a tile per loop frame** (one tile per two frames,
    400 ms each, whole cells only), with a 1-cell bob on the half steps; at the target it faces it and holds a use pose
    for 2.4 s: the radio `rest` swaying ±1 cell, a plant `water`, the cat `wave`, any other effect piece `point`; then it
    walks back. A trip every 20–40 s, never the same piece twice in a row. KIP walks only in the `idle` stage, with the
    prompt bar blurred, no bubble showing (coins landing, the welcome), the screen focused and Reduce Motion off. Any of
    those changing puts KIP on its seat in the same render. Walking KIP uses mood `glance` and is mirrored when it heads
    left (§3.6 "Facing is Spec A's mirror plus the glance mood").
14. **The `water` pose** is a new KIP pose: one arm out with a held watering can (`HELD.can`); arms only.
15. **The radio's sound.** `expo-audio` ~57.0.5 (`npx expo install expo-audio`). One loop,
    `mobile/assets/sounds/radio-loop.m4a`: 20 s, mono AAC at 64 kb/s (about 160 KB), generated by a committed script
    (`mobile/scripts/make-radio-loop.mjs`, Node writes the WAV, macOS `afconvert` encodes it) so it can be rebuilt. It
    plays at volume 0.35 only while: a **running** radio is placed, the device switch is on (off by default; key
    `kipRoomSound` in `expo-secure-store`, the `kipRoomPrefs.ts` pattern), the KIP page is focused, the room card is
    shown (not shrunk), the editor is not covering it and the app is in the foreground. It honours the iOS silent switch
    and mixes with other audio. There is no squeak asset: the duck's sound ships with B2 (spec §8.2's "plus sound if the
    radio switch has sound on").
16. **The piece card is a route,** `PieceCard` (`presentation: 'modal'`, the native sheet; P2 ruling 8), opened by
    tapping an effect piece or a plant in the KIP page's room, and for a screen reader through the room image's custom
    actions ("Old radio card"; the room stays one image). It shows the name, where it goes, how it was earned and its
    price, its effect line and current state, "Resting" when inert, and for the radio the sound switch; **Move** and
    **Store** open the editor with that piece selected (Store already applied as the first undo step; Done saves). In
    the editor a tap still selects (§5.3); the toolbar line carries the effect line instead.
17. **Tap effects.** Tapping a running `tap` piece squashes it for two frames (0.7 then 0.85 of its height, 400 ms each,
    bottom fixed) instead of opening a card; never under Reduce Motion. No shipped P3 piece has `tap` (the duck is B2),
    so its tests inject the effect through `roomEffects`' `deps`.
18. **The advice guard** (§8.3 "A copy guard test scans every effect and room string") scans every string and
    function result under `ROOM_COPY.effects` and `ROOM_COPY.card` for "should", "try", "more", "need", "must" and a
    sentence that opens with a health verb (sleep, walk, drink, rest, exercise, go, get, hit, reach, eat). The editor's,
    shop's and Room sizes' UI strings stay outside it: "Needs 40 more" and "20 more pieces" are counts, and "Move" and
    "Store a piece" are the room's own buttons, not advice.
19. **The shop's tabs** become All, Effects, Floor, Wall, On top (§6.6's order); an effect piece's tile says "does
    something in the room" (read aloud too) and its sheet shows the effect line (resolves P2 ruling 13).
20. **Room sizes** rows read "40 pieces · 3 effects" ("40 pieces, 3 effects" aloud) and the unlock card "+1 row each
    side · +20 pieces · +2 effect slots" (resolves P2 ruling 14).
21. **The drawer's Effects tab** sits after Funny; an effect piece's tile carries the tag "Does something". The
    editor's count line becomes "31 / 40 in room · Effects 3 of 5" ("31 of 40 pieces in the room, 3 of 5 effects
    running").
22. **No schema change, no migration, no new user-owned model** (Global Constraints). `GET /me/cosmetics` gains
    `living` only; the app reads the slots from `TIERS` in its geometry copy.
23. **A 400 `effects_full`** reaching the editor (only another device's save can cause it) reads as the editor's
    generic "Couldn't save your room. Try again." with a re-read, as any 400 does today.
24. **The drag ghost** of a growing plant is drawn at full growth (the ghost carries no effect state): a moment's
    difference while dragging, accepted.
25. **Ledger carries:** P1 Task 8's deferred "no behind + KIP + ahead == full order test" is folded into Task 9 (runs
    keep the static order). P2 Task 13's "one-frame old pan" (M3) stays deferred: P3 never touches the editor's pan
    (walking draws on the KIP page's crop, computed every render by `isoCrop`). P2 rulings 13 and 14 are resolved by
    rulings 19–21.

## Review Focus

1. **A room saved before P3 with more effect pieces than slots** (four wall clocks in a 7 × 7 room). Expected: it
   still saves after any move (200), the three lowest instance ids run (real time) and the fourth turns its old hand
   (inert), and adding a fifth effect piece is refused in the editor with "Effects 3 of 3: store one to run another"
   and by the server with `400 effects_full`. Pinned in Task 2 (the stored-extras save, the raise), Task 4 (running and
   inert by id) and Task 7 (the editor's refusal and the moves).
2. **Focusing the prompt bar (or sending, or a status change) while KIP is mid-walk.** Expected: KIP is back on its
   seat in the same render, with no walk back, so the typing pose starts at the desk; no timer fires afterwards.
   Pinned in Task 10 (`useKipWalk` disabled mid-trip returns the seat at once; the KIP page with a focused prompt).
3. **The sound switch on, then the screen blurs, the app goes to the background or the editor opens.** Expected: the
   loop pauses each time and resumes only if the switch is still on; it never plays with the switch off (the default),
   with no running radio, or with the radio inert. Pinned in Task 12 (`useRoomRadio` and the RoomCard wiring).
4. **Night (after 22:00 local) with a cat bed placed, Reduce Motion on.** Expected: the cat is drawn curled on the bed
   (not on its own tile), no mover, frame 0, and a loop tick records 0 pictures. Pinned in Task 6 (the nap on the bed)
   and Task 11 (no wander under Reduce Motion).
5. **A running clock's minute changing while KIP walks.** Expected: the static picture is rebuilt once for the new
   minute and only the shell picture and the frames re-record, never a floor piece's picture, and walk steps record
   nothing. Pinned in Task 9 (runs mode: a minute re-records only what changed; a step records 0).

## File Structure

**Backend (create):** `src/room/living.ts`; `tests/room/living.test.ts`.

**Backend (modify):** `src/room/geometry.ts` (and its generated app copy), `src/cosmetics/catalogue.ts`,
`src/cosmetics/loadout.ts`; tests `tests/room/geometry.test.ts`, `tests/room/save.test.ts`,
`tests/cosmetics/catalogue.test.ts`, `tests/cosmetics/export.test.ts`, `tests/cosmetics/rules.test.ts`,
`tests/cosmetics/people.test.ts`, `tests/cosmetics/everShipped.json`, `tests/cosmetics/grantsShipped.json`.

**Mobile (create):**
- `src/lib/room/effects.ts` (living, `roomEffects`, keys), `src/lib/room/useClockMinute.ts`, `src/lib/room/sound.ts`,
  `src/lib/room/card.ts`;
- `src/lib/room/items/living.ts` (the cat's front-on art), `src/lib/room/iso/pieces/awards.ts` (the trophy shelf),
  `src/lib/room/iso/pieces/effectArt.ts` (growth, the pool, the notes, the squash), `src/lib/room/iso/movers.ts`;
- `src/lib/room/live/walk.ts`, `src/lib/room/live/useKipWalk.ts`, `src/lib/room/live/catWander.ts`;
- `src/components/room/pictureCache.ts`, `src/components/room/useRoomEffects.ts`, `src/components/room/RoomRadio.tsx`;
- `src/screens/PieceCardScreen.tsx`;
- `assets/sounds/radio-loop.m4a`, `scripts/make-radio-loop.mjs`;
- tests: `__tests__/lib/{roomEffects,isoEffects,livingPieces,clockEffect,walk,useKipWalk,catWander,roomSound,pieceCard,isoMovers}.test.ts(x)`,
  `__tests__/components/{RoomRadio,RoomViewMovers}.test.tsx`, `__tests__/screens/PieceCardScreen.test.tsx`,
  `__tests__/conventions/noRoomInCoach.test.ts`.

**Mobile (modify):** `package.json` / `package-lock.json` (`expo-audio`), `jest-setup.js`, `jest-mocks/{skia.js,RoomView.js,cosmeticsFixture.ts,roomArtChecks.ts}`,
`src/api/cosmetics.ts`, `src/lib/room/{catalogue.json,cosmeticsStore,roomCopy,art,items,layout}.ts`,
`src/lib/room/iso/{geometry,art,room,index}.ts`, `src/lib/room/iso/pieces/{stand,extras}.ts`,
`src/lib/room/items/{art,shop}.ts`, `src/lib/kip/kipArt.ts`, `src/lib/room/edit/{editor,targets,drawer,labels}.ts`,
`src/lib/coins/{shop,sizes}.ts`, `src/components/room/RoomView.tsx`, `src/components/coach/{RoomCard,PromptBar,CollapsedKipHeader}.tsx`,
`src/components/edit/{EditRoom,EditToolbar,InventoryDrawer}.tsx`, `src/screens/{CoachScreen,DecorateRoomScreen,CoinShopScreen,RoomSizesScreen}.tsx`,
`src/navigation/RootNavigator.tsx`, and the tests named in each task.

---

### Task 0: Workspace (controller; no code)

- [ ] **Step 1:** Create the workspace with
  `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-15-kip-freebuild-p3.md`,
  so that `.superpowers/sdd/2026-10-15-kip-freebuild-p3/` exists. Copy `common-context.md`,
  `implementer-instructions.md` and `reviewer-instructions.md` from `.superpowers/sdd/2026-10-15-kip-freebuild-p2/`,
  then edit the branch (`feature/kip-freebuild-p3`), the plan name (`2026-10-15-kip-freebuild-p3.md`), the base note
  (P2 at dadb1c8 is the built base; only the free-build spec's P3 row is in scope; social is LATER) and every workspace
  path (`2026-10-15-kip-freebuild-p2` → `2026-10-15-kip-freebuild-p3`). The feature paragraph of `common-context.md`
  becomes:
  ```text
  **Feature:** KIP's free-build room, phase P3 only: item effects and effect slots, the living room (plants that grow
  with sleep-goal nights, a cat that follows steps, a trophy shelf of badge levels, a clock with real time, a radio loop
  that is off until turned on), piece cards, and KIP walking between answers. P2 (feature/kip-freebuild-p2 at dadb1c8:
  coins, the shop, room sizes, the first-week list) is the built base on this branch; only the free-build spec's P3 row
  is in scope. Visits, gifts, challenges and the share card are LATER (P4). CampScene.tsx and CampBanner.tsx stay
  FROZEN. Effects never give health advice; nothing cosmetic or effect-related reaches the coach or the model.
  ```
- [ ] **Step 2:** Copy `backend-jest.sh`, `backup-db.sh`, `schema-drift.sh`, `sync-run.sh`, `metro-local.sh`,
  `start-backend.sh`, `start-backend-coins.sh`, `convert-test-db.sh`, `pg-conns.sh` and `pg-waits.sh` from
  `.superpowers/sdd/2026-10-15-kip-freebuild-p2/` and `ios-build.sh` from `.superpowers/sdd/2026-10-14-kip-room/` into
  the new folder, then:
  - `backup-db.sh`: the dump name becomes `biometrics-before-kip-freebuild-p3-2026-10-15.dump`.
  - `sync-run.sh`: the header comment names `feature/kip-freebuild-p3`; the backend block (conversion before
    `prisma migrate deploy`, P2 ruling 25 and PF-F2) is unchanged. P3 has no migration, so the deploy answers "No
    pending migrations" and the conversion `converted: 0`.
  - `metro-local.sh`: the screenshot folder becomes `.superpowers/sdd/2026-10-15-kip-freebuild-p3/shots`.
  - `start-backend-coins.sh` is kept as it is: the run-folder API needs `COINS_LAUNCHED_AT=2026-10-01T00:00:00.000Z`
    in dev so the plants' sleep-goal nights (coin rows) exist before the real coins launch.
  - `ios-build.sh`: the comment becomes `# Task 14 step 3: prebuild iOS (new native module expo-audio), ad-hoc
    xcodebuild, install, Metro.`; the log files become `/tmp/kip-p3-prebuild.log`, `/tmp/kip-p3-pod.log` and
    `/tmp/kip-p3-xcodebuild.log`. Everything else (the simulator UDID `F9749496-D593-4A40-8E92-B1A8531B0051`, the
    run folder, the ad-hoc signing flags) stays.
  - `mkdir -p .superpowers/sdd/2026-10-15-kip-freebuild-p3/shots`.
- [ ] **Step 3:** Set up and measure: `cd backend && DATABASE_URL=postgresql://x@localhost/x npx prisma generate`,
  then confirm `node node_modules/.bin/tsc --noEmit -p .` reports 0. Run the mobile typecheck, save the error lines to
  `.superpowers/sdd/2026-10-15-kip-freebuild-p3/tsc-baseline.txt`, and confirm the count is 10. Confirm
  `grep -c expo-audio mobile/package.json` prints 0 (Task 12 adds it).
- [ ] **Step 4:** Write the ledger (`progress.md`), with a `ledger-init.sh` in the workspace modelled on P2's:
  - copy every `Ruling:` line of `.superpowers/sdd/2026-10-15-kip-freebuild-p1/progress.md` under "Inherited from P1
    (binding)" and every `Ruling:` line of `.superpowers/sdd/2026-10-15-kip-freebuild-p2/progress.md` under "Inherited
    from P2 (binding)", and P2's plan rulings 1–38 by reference (P2 plan lines 124–222), with rulings 13 and 14 marked
    "resolved by P3 rulings 19–21";
  - write this plan's 25 rulings as `Ruling: … — why — cost` lines;
  - record the order, subagent-driven: backend Tasks 1 → 2 → 3 strictly (shared catalogue, geometry and `loadout.ts`);
    mobile Tasks 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 strictly after 3 (they share `RoomView`, `ROOM_COPY`, the
    effects model and the KIP page); Task 14 last (controller).

---
### Task 1: Catalogue release 5: the effect field, effect slots and the effect rule, the ginger cat and the trophy shelf

Spec §2.1 (`effect?: EffectKind` on `IsoSpec`; release 5 for P3's effect pieces), §4 (P3's art batch: `pet.tabby`,
`shelf.awards`), §7 (effect slots 3 / 5 / 8 per tier), §8.1 (effect slots; the first ones by instance id run), §8.2
(the first set and its ids) and §16's catalogue and geometry tests. Rulings 1–4.

**Files:**
- Modify: `backend/src/room/geometry.ts`, `backend/src/cosmetics/catalogue.ts`
- Modify (tests): `backend/tests/room/geometry.test.ts`, `backend/tests/cosmetics/catalogue.test.ts`,
  `backend/tests/cosmetics/export.test.ts`, `backend/tests/cosmetics/everShipped.json`,
  `backend/tests/cosmetics/grantsShipped.json`
- Modify (generated, by `scripts/export-cosmetics.ts`): `mobile/src/lib/room/catalogue.json`,
  `mobile/src/lib/room/iso/geometry.ts`
- Create (mobile): `mobile/src/lib/room/items/living.ts`, `mobile/src/lib/room/iso/pieces/awards.ts`,
  `mobile/__tests__/lib/livingPieces.test.ts`
- Modify (mobile): `mobile/src/lib/room/art.ts`, `mobile/src/lib/room/iso/index.ts`,
  `mobile/src/lib/room/iso/pieces/stand.ts`, `mobile/src/lib/room/roomCopy.ts`, `mobile/jest-mocks/roomArtChecks.ts`,
  `mobile/__tests__/lib/roomCatalogue.test.ts`, `mobile/__tests__/lib/isoPieces.test.ts`

**Interfaces:**
- Consumes: P1/P2's `IsoSpec`, `TIERS`, `GeometryDeps`, `ISO_OVERRIDES`, `PRICES`, `withFlags`, `registerItems`,
  `registerIcons`, `registerIsoArt`, `standing`, `spriteRows`, `three`, `veiled`, `box`, `LOCAL`, `PLANK_DEPTH`,
  `PLANK_TOP`.
- Produces:
  - geometry (both copies): `type EffectKind = 'light' | 'sound' | 'wander' | 'clock' | 'tap' | 'awards'`;
    `IsoSpec.effect?: EffectKind`; `TIERS[t].effects` (3 / 5 / 8); `effectSlotsFor(tier: Tier): number`;
    `effectPieces(layout: RoomLayout, deps: GeometryDeps): Placement[]` (first placed first);
    `runningEffects(layout, tier, deps): Set<string>`;
    `effectsRaised(before: RoomLayout, after: RoomLayout, tier: Tier, deps: GeometryDeps): boolean`;
  - backend catalogue: `CosmeticRelease = 1 | 2 | 3 | 4 | 5`, `ShippedRelease = 1 | 3 | 4 | 5`, `SHIPPED_RELEASES`
    `{1, 3, 4, 5}`, `RELEASE_LAUNCHED_AT[5]`, `EFFECTS: Readonly<Record<string, EffectKind>>`,
    `PRICES['pet.tabby'] = 180`;
  - mobile: `TABBY_SIT: SpriteRect[]`, `TAIL` (items/living.ts); the `shelf.awards` iso art, `drawAwardsShelf` and
    `AWARDS_ALONG = 4` (iso/pieces/awards.ts); names `'pet.tabby': 'Ginger cat'`, `'shelf.awards': 'Trophy shelf'`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/room/geometry.test.ts`, extend the geometry import with
`effectPieces, effectSlotsFor, effectsRaised, runningEffects, TIERS` and add:

```ts
describe('effect slots (spec §7, §8.1, plan ruling 4)', () => {
  const clock = (id: string, layer: 'wallL' | 'wallR', x: number) => piece(id, 'art.clock', { layer, x, y: 0 });

  it('each tier runs 3, 5 or 8 effects', () => {
    expect(([1, 2, 3] as const).map((t) => effectSlotsFor(t))).toEqual([3, 5, 8]);
    expect([TIERS[1].effects, TIERS[2].effects, TIERS[3].effects]).toEqual([3, 5, 8]);
  });

  it('lists the effect pieces first placed first: any non-p id first, then p<n> by n (p2 before p10)', () => {
    const l = withPieces(clock('p10', 'wallR', 0), clock('p2', 'wallR', 10), clock('art', 'wallL', 0), piece('p1', 'plant.cactus', { x: 6, y: 6 }));
    expect(effectPieces(l, deps).map((p) => p.id)).toEqual(['art', 'p2', 'p10']);
  });

  it('runs the first slots and leaves the rest inert', () => {
    const l = withPieces(clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0), clock('p4', 'wallL', 9));
    expect([...runningEffects(l, 1, deps)].sort()).toEqual(['p1', 'p2', 'p3']);
    expect([...runningEffects(l, 2, deps)].sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('a save raises the effects only with more than the slots and more than before (spec §8.1)', () => {
    const three = withPieces(clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0));
    const four = withPieces(...three.pieces.filter((p) => p.item === 'art.clock'), clock('p4', 'wallL', 9));
    expect(effectsRaised(three, four, 1, deps)).toBe(true);
    expect(effectsRaised(four, four, 1, deps)).toBe(false); // an older room keeps its extras
    expect(effectsRaised(four, three, 1, deps)).toBe(false);
    expect(effectsRaised(three, four, 2, deps)).toBe(false); // 4 of 5 fits the bigger room
    expect(validateLayout(four, 1, deps)).toBeNull(); // the slots are not a placement rule
  });
});
```

In `backend/tests/cosmetics/catalogue.test.ts`:
- Replace "ships releases 1, 3 and 4, each with a launch date (spec §2.1 Releases, plan ruling 1)" with:

```ts
it('ships releases 1, 3, 4 and 5, each with a launch date (spec §2.1 Releases, P3 plan ruling 1)', () => {
  expect([...SHIPPED_RELEASES].sort()).toEqual([1, 3, 4, 5]);
  for (const r of SHIPPED_RELEASES) expect(RELEASE_LAUNCHED_AT[r as 1 | 3 | 4 | 5]).toBeInstanceOf(Date);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 3).map((i) => i.id).sort()).toEqual(['lamp.welcome', 'shelf.plank']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 4).map((i) => i.id).sort())
    .toEqual(['art.neonheart', 'corner.cone', 'corner.gnome', 'corner.pumpkin', 'item.candle', 'item.radio']);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 5).map((i) => i.id).sort()).toEqual(['pet.tabby', 'shelf.awards']);
});

it('gives the first set of effects to their pieces, and to no other (spec §8.2, P3 rulings 2-3)', () => {
  const effects = Object.fromEntries(COSMETIC_ITEMS.filter((i) => i.iso?.effect).map((i) => [i.id, i.iso!.effect]));
  expect(effects).toEqual({
    'corner.floorlamp': 'light', 'lamp.lava': 'light', 'item.radio': 'sound', 'pet.tabby': 'wander', 'pet.cat': 'wander',
    'art.clock': 'clock', 'item.duck': 'tap', 'shelf.awards': 'awards',
  });
  expect(cosmeticItem('pet.tabby')).toMatchObject({ slot: 'pet', unlock: { kind: 'shop' }, price: 180, frames: 3, iso: { layers: ['floor'], foot: [1, 1], facings: 1 } });
  expect(cosmeticItem('shelf.awards')).toMatchObject({ slot: 'shelf', unlock: { kind: 'starter' }, iso: { layers: ['wall'], wall: [8, 3], facings: 1 } });
  expect(cosmeticItem('shelf.awards')!.price).toBeUndefined(); // ruling 2: not sold
  expect(cosmeticItem('shelf.trophyB')!.iso!.effect).toBeUndefined(); // stays plain decor (§8.2)
  expect(cosmeticItem('pet.bed')!.iso!.effect).toBeUndefined(); // the cat's bed has no effect of its own
});
```

- In "has the 19 starter items, all shipped, and a starter room of placed starters", the title becomes "has the 20
  starter items, …" and the sorted list gains `'shelf.awards'` between `'rug.slate'` and `'shelf.books'`.
- In "prices only real pieces, and every placeable starter but the desks and the welcome lantern (ruling 3)", the
  filter becomes
  `.filter((i) => !!i.iso && i.slot !== 'desk' && i.id !== 'lamp.welcome' && i.id !== 'shelf.awards' && i.price === undefined)`
  and the title "… but the desks, the welcome lantern and the trophy shelf (P2 ruling 3, P3 ruling 2)".
- In "prices pieces 25 to 200 coins, …", add `expect(price('pet.tabby')).toBe(180);`.

In `backend/tests/cosmetics/export.test.ts`, `expect(e.releases).toEqual([1, 3, 4]);` becomes
`expect(e.releases).toEqual([1, 3, 4, 5]);`.

Append `"pet.tabby"` and `"shelf.awards"` to `backend/tests/cosmetics/everShipped.json` (before the closing `]`, one id a
line, as the file is) and `"pet.tabby": 1` and `"shelf.awards": 1` to `backend/tests/cosmetics/grantsShipped.json`.

In `mobile/__tests__/lib/roomCatalogue.test.ts`, the release test becomes:

```ts
it('holds releases 1, 3, 4 and 5: 97 items and the Cottage set, every piece known', () => {
  expect([CATALOGUE.releases, CATALOGUE.items.length, CATALOGUE.sets.map((s) => s.id)]).toEqual([[1, 3, 4, 5], 97, ['cottage']]);
  for (const item of CATALOGUE.items) expect([...ROOM_SLOTS, ...WORN_SLOTS]).toContain(item.slot);
  const cottage = catalogueSet('cottage')!;
  for (const id of [...Object.values(cottage.room), ...Object.values(cottage.worn)]) expect(catalogueItem(id!)).toBeDefined();
});
```

In `mobile/__tests__/lib/isoPieces.test.ts`, the count test becomes:

```ts
it('every shipped placeable piece has iso art, 64 in all: 54 of release 1, 2 of release 3, 6 shop pieces and 2 of release 5 (spec §4)', () => {
  expect(PLACEABLE).toHaveLength(64);
  for (const item of PLACEABLE) expect({ id: item.id, art: !!isoArtOf(item.id) }).toEqual({ id: item.id, art: true });
});
```

Create `mobile/__tests__/lib/livingPieces.test.ts`:

```ts
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueItem } from '../../src/lib/room/catalogue';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import { opaqueBounds } from '../../src/lib/room/iso/prims';
import { itemName } from '../../src/lib/room/roomCopy';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());

it('ships the ginger cat and the trophy shelf in release 5, named, with an icon and iso art (spec §4, P3 ruling 2)', () => {
  expect(CATALOGUE.items.filter((i) => i.release === 5).map((i) => i.id).sort()).toEqual(['pet.tabby', 'shelf.awards']);
  for (const id of ['pet.tabby', 'shelf.awards']) {
    expect({ id, icon: (itemIcon(id)?.length ?? 0) > 0, iso: !!isoArtOf(id) }).toEqual({ id, icon: true, iso: true });
  }
  expect([itemName('pet.tabby'), itemName('shelf.awards')]).toEqual(['Ginger cat', 'Trophy shelf']);
  expect([catalogueItem('pet.tabby')!.iso!.effect, catalogueItem('shelf.awards')!.iso!.effect]).toEqual(['wander', 'awards']);
});

it('the cat sits on its tile with a tail that flicks over three frames, day and night', () => {
  expect(itemArt('pet.tabby')!.frames).toBe(3);
  for (const ctx of [CTX_DAY, CTX_NIGHT]) {
    const l = pieceLayers('pet.tabby', ctx, { layer: 'floor', facing: 'L', mirror: false })!;
    expect((l.base?.length ?? 0) > 0).toBe(true);
    expect(l.frames).toHaveLength(3);
    expect(JSON.stringify(l.frames![0])).not.toBe(JSON.stringify(l.frames![1]));
  }
});

it('the trophy shelf is a plank along 4 tiles of either wall, plain until it holds awards', () => {
  for (const layer of ['wallL', 'wallR'] as const) {
    const l = pieceLayers('shelf.awards', CTX_DAY, { layer, facing: 'L', mirror: false })!;
    expect(opaqueBounds(l.base ?? [])!.w).toBeGreaterThanOrEqual(4 * 24 - 2); // 4 tiles, 24 cells a tile
    expect(l.frames).toBeUndefined();
  }
});
```

In `mobile/jest-mocks/roomArtChecks.ts`, above `checkSlotArt`:

```ts
/** Pieces the iso room draws itself, with no front-on art (release 3's plank and lantern are skipped by release). */
const ISO_ONLY: ReadonlySet<string> = new Set(['shelf.awards']);
```

and `checkSlotArt`'s filter becomes
`.filter((i) => (sets || !i.id.startsWith('set.')) && i.release !== 3 && !ISO_ONLY.has(i.id))`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room/geometry.test.ts tests/cosmetics/catalogue.test.ts`
Expected: FAIL (`effectSlotsFor` is not exported; no release 5).
Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/livingPieces.test.ts __tests__/lib/roomCatalogue.test.ts`
Expected: FAIL (release 5 is not in `catalogue.json`).

- [ ] **Step 3: The effect rule in geometry**

In `backend/src/room/geometry.ts`, above `export interface IsoSpec`:

```ts
/** What a piece does in the room (spec §8.1): a small, closed list. A piece with one takes an effect slot. */
export type EffectKind = 'light' | 'sound' | 'wander' | 'clock' | 'tap' | 'awards';
```

In `IsoSpec`, after `seat?`:

```ts
  /** What it does in the room (spec §8); it then takes one of the tier's effect slots. */
  effect?: EffectKind;
```

Replace `TIERS`, and add the slots after `capFor`:

```ts
export const TIERS: Readonly<Record<Tier, { n: number; cap: number; effects: number }>> = {
  1: { n: 7, cap: 40, effects: 3 },
  2: { n: 8, cap: 60, effects: 5 },
  3: { n: 9, cap: 90, effects: 8 },
};
```

```ts
/** How many effect pieces a room runs at once (spec §7, §8.1). */
export function effectSlotsFor(tier: Tier): number {
  return TIERS[tier].effects;
}
```

After `placedCounts`, add:

```ts
/** p1, p2, … rank by their number; any other id (a starter's, a converted room's) ranks 0 (P2 ruling PF-F1). */
const instanceRank = (id: string): number => {
  const m = /^p(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
};

/** The placed pieces that do something, first placed first: by instance rank, then id (spec §8.1). */
export function effectPieces(layout: RoomLayout, deps: GeometryDeps): Placement[] {
  return layout.pieces
    .filter((p) => !!deps.isoOf(p.item)?.effect)
    .sort((a, b) => instanceRank(a.id) - instanceRank(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The effect pieces that run: the first `effectSlotsFor(tier)`. The rest stay in the room, inert (spec §8.1). */
export function runningEffects(layout: RoomLayout, tier: Tier, deps: GeometryDeps): Set<string> {
  return new Set(effectPieces(layout, deps).slice(0, effectSlotsFor(tier)).map((p) => p.id));
}

/**
 * A save that answers `400 effects_full` (spec §8.1, §12): more effect pieces than the slots, and more than the stored
 * room had. A room saved before P3 with extra pieces never fails for keeping them.
 */
export function effectsRaised(before: RoomLayout, after: RoomLayout, tier: Tier, deps: GeometryDeps): boolean {
  const n = effectPieces(after, deps).length;
  return n > effectSlotsFor(tier) && n > effectPieces(before, deps).length;
}
```

- [ ] **Step 4: The catalogue**

In `backend/src/cosmetics/catalogue.ts`:

```ts
import type { EffectKind, IsoSpec } from '../room/geometry';
```

```ts
export type CosmeticRelease = 1 | 2 | 3 | 4 | 5;
/** Releases the app can draw. B2 (release 2) joins when its art ships; free-build P1's pieces are release 3, P2's shop
 * pieces release 4, P3's effect pieces release 5. */
export const SHIPPED_RELEASES: ReadonlySet<CosmeticRelease> = new Set<CosmeticRelease>([1, 3, 4, 5]);
export type ShippedRelease = 1 | 3 | 4 | 5;
```

In `RELEASE_LAUNCHED_AT`, add `5: new Date('2026-10-23T00:00:00.000Z'),` and end its comment with
`OWNER NOTE (P3 plan ruling 1): release 5's date is set at merge.`

After `SHOP_PIECES`:

```ts
// Free-build P3's effect pieces (spec 2026-10-15 §8.2): the ginger cat (coin shop) and the trophy shelf (everyone's).
const LIVING_PIECES: readonly Row[] = [
  ['pet.tabby', 'pet', 'C', 'A', 5],
  ['shelf.awards', 'shelf', 'S', '', 5],
];

/** The first set of effects (spec §8.2, P3 rulings 2-3). B2's three are set now and run when release 2 ships. */
export const EFFECTS: Readonly<Record<string, EffectKind>> = {
  'corner.floorlamp': 'light', 'lamp.lava': 'light', 'item.radio': 'sound', 'pet.tabby': 'wander', 'pet.cat': 'wander',
  'art.clock': 'clock', 'item.duck': 'tap', 'shelf.awards': 'awards',
};
```

In `PRICES`, after `'pet.cat': 180,` add `'pet.tabby': 180,`. In `ISO_OVERRIDES`, after `'art.neonheart'`:

```ts
  // The trophy shelf hangs on a wall: a plank 4 tiles long with room for 8 awards (P3 ruling 2).
  'shelf.awards': { layers: ['wall'], wall: [8, 3], facings: 1 },
```

In `build()`, the first loop reads `[...BASE, ...FREEBUILD, ...SHOP_PIECES, ...LIVING_PIECES]`, and the last loop
becomes:

```ts
  for (const [id, item] of items) {
    const iso = isoFor(item);
    const effect = EFFECTS[id];
    const price = PRICES[id];
    items.set(id, {
      ...item,
      // isoFor returns shared objects (SLOT_ISO, DESK_ISO): the spread never writes into them.
      ...(iso ? { iso: effect ? { ...iso, effect } : iso } : {}),
      ...(FUNNY.has(id) ? { tags: ['funny'] } : {}),
      ...(price !== undefined ? { price, shop: 'always' as const } : {}),
    });
  }
```

- [ ] **Step 5: Export, then the app's art and names**

From `backend/`: `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`. It rewrites
`mobile/src/lib/room/catalogue.json` (97 items) and `mobile/src/lib/room/iso/geometry.ts` (the banner and the new
geometry, verbatim).

Create `mobile/src/lib/room/items/living.ts`:

```ts
// Free-build P3's ginger cat (spec 2026-10-15 §8.2, C5; isox.py `cat_play`): a front-on sprite the iso room stands on
// its tile as a billboard (iso/pieces/stand.ts). Here it sits, its tail flicking over three frames; Task 6 adds the
// play and nap states. Its loop is not lit, so it dims at night (veiled).
import { registerIcons, type SpriteRect } from '../icons';
import { registerItems, type ItemArt } from '../items';
import { R, type Rects } from '../paint';
import { spriteRows, standing, three, veiled } from './shared';

export const GINGER = { o: '#EA9A4A', O: '#F0A75A', S: '#C2410C', e: '#1F2937', p: '#F9A8D4' } as const;
export const TABBY_SIT: SpriteRect[] = spriteRows([
  '.o.....o..',
  '.oo...oo..',
  '.ooooooo..',
  '.oeoooeo..',
  '.ooopooo..',
  '..ooooo...',
  '.ooSoSooo.',
  '.oooSoSoo.',
  '.oooooooo.',
  '..oo..oo..',
], GINGER);
export const SIT_FOOT = 10;
/** The tail's three frames, at the sitting cat's right side. */
export const TAIL: readonly (readonly SpriteRect[])[] = [
  [[9, 8, 1, 1, GINGER.S], [10, 8, 1, 1, GINGER.S]],
  [[9, 8, 1, 1, GINGER.S], [10, 7, 1, 1, GINGER.S]],
  [[9, 7, 1, 2, GINGER.S], [10, 6, 1, 1, GINGER.S]],
];

export const loopOf = (rects: readonly SpriteRect[], night: boolean): Rects => {
  const f: Rects = [];
  for (const [x, y, w, h, c] of rects) R(f, x, y, w, h, veiled(c, night));
  return f;
};

const tabby: ItemArt = {
  id: 'pet.tabby', slot: 'pet', frames: 3,
  draw: ({ ramp, night }) => {
    const r: Rects = [];
    standing(r, TABBY_SIT, 0, 0, SIT_FOOT, ramp);
    return { base: r, frames: three((k) => loopOf(TAIL[k]!, night)) };
  },
};

registerItems([tabby]);
registerIcons({ 'pet.tabby': [...TABBY_SIT, ...TAIL[0]!] });
```

Add `import './items/living';` to `mobile/src/lib/room/art.ts` after `import './items/shop';`.

Create `mobile/src/lib/room/iso/pieces/awards.ts`:

```ts
// The trophy shelf (spec 2026-10-15 §8.2, §8.3; isox.py `trophy_shelf`): a plank along 4 tiles of its wall. Task 5
// stands one award on it for each badge level you earn, up to 8; until then, and whenever it is inert, it is empty.
import { registerIcons } from '../../icons';
import { spriteRows } from '../../items/shared';
import type { Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import type { PlacementLayer } from '../geometry';
import { LOCAL } from '../grid';
import { box } from '../prims';
import { PLANK_DEPTH, PLANK_TOP } from './extras';

/** The shelf's length along its wall, in tiles (its `wall: [8, 3]` is 8 half tiles). */
export const AWARDS_ALONG = 4;

export function drawAwardsShelf(r: Rects, layer: PlacementLayer): void {
  if (layer === 'wallL') box(r, LOCAL, 0, 0, 0, PLANK_DEPTH, AWARDS_ALONG, 2, PLANK_TOP, '#4A382B', '#3A2D23');
  else box(r, LOCAL, 0, 0, 0, AWARDS_ALONG, PLANK_DEPTH, 2, PLANK_TOP, '#4A382B', '#3A2D23');
}

const shelf: IsoPieceArt = {
  id: 'shelf.awards',
  draw: (_ctx, o) => {
    const r: Rects = [];
    drawAwardsShelf(r, o.layer);
    return { base: r };
  },
};

registerIsoArt([shelf]);
registerIcons({
  'shelf.awards': spriteRows([
    '.yyy...sss...bbb',
    '.yyy...sss...bbb',
    '..y.....s.....b.',
    '.yyy...sss...bbb',
    'wwwwwwwwwwwwwwww',
    'dddddddddddddddd',
  ], { y: '#FACC15', s: '#CBD5E1', b: '#B45309', w: '#7C5A3E', d: '#5B4636' }),
});
```

Add `import './pieces/awards';` to `mobile/src/lib/room/iso/index.ts` after `import './pieces/extras';`. In
`mobile/src/lib/room/iso/pieces/stand.ts`, `OWN_ART` becomes
`new Set(['shelf.plank', 'lamp.welcome', 'set.cottage.lamp', 'shelf.awards'])`.

In `mobile/src/lib/room/roomCopy.ts` `ITEM_NAMES`, after the shop pieces' line:

```ts
  // Free-build P3's effect pieces (spec 2026-10-15 §8.2).
  'pet.tabby': 'Ginger cat', 'shelf.awards': 'Trophy shelf',
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room tests/cosmetics`
Expected: PASS (`tests/room/copy.test.ts`: the geometry copy is current; `export.test.ts`: the catalogue copy is current).
Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/livingPieces.test.ts __tests__/lib/roomCatalogue.test.ts __tests__/lib/isoPieces.test.ts __tests__/lib/roomSets.test.ts __tests__/lib/roomCopy.test.ts`
Expected: PASS. Then the full backend suite, the full mobile suite and both typechecks (backend 0, mobile 10).

- [ ] **Step 7: Commit**

```bash
git add backend/src/room/geometry.ts backend/src/cosmetics/catalogue.ts backend/tests/room/geometry.test.ts backend/tests/cosmetics mobile/src/lib/room mobile/jest-mocks/roomArtChecks.ts mobile/__tests__/lib/livingPieces.test.ts mobile/__tests__/lib/roomCatalogue.test.ts mobile/__tests__/lib/isoPieces.test.ts
git commit -m "feat(room): release 5, effect slots per room size and the first effect pieces"
```

---

### Task 2: Backend: `400 effects_full` on a save that raises the effects above the slots

Spec §8.1 ("the server rejects a save with `effects_full` only when it **raises** the number of effect pieces above the
slots"), §12 (P1's PUT list: "from P3, 400 `effects_full`") and §16 (geometry: effect slots). Rulings 4 and 23.

**Files:**
- Modify: `backend/src/cosmetics/loadout.ts`
- Test: `backend/tests/room/save.test.ts`

**Interfaces:**
- Consumes: Task 1's `effectsRaised`, `effectSlotsFor`; P1's `checkLayout`, `readLayout`, `starterLayout`,
  `geometryDeps`, `countsOf`.
- Produces: `SaveError` gains `'effects_full'`; `SaveFailure.body.slots?: number`;
  `checkLayout(layout, worn, tier, counts, stored?: RoomLayout)`: with `stored` it also answers
  `{ status: 400, body: { error: 'effects_full', slots } }`, after the geometry and `room_full` checks and before
  `403 not_owned`.

- [ ] **Step 1: Write the failing test**

In `backend/tests/room/save.test.ts`, add `import { Prisma } from '@prisma/client';` and:

```ts
describe('effect slots (spec §8.1, §12, P3 ruling 4)', () => {
  const clocks = [
    piece('c1', 'art.clock', { layer: 'wallR', x: 0, y: 0 }),
    piece('c2', 'art.clock', { layer: 'wallR', x: 10, y: 0 }),
    piece('c3', 'art.clock', { layer: 'wallL', x: 0, y: 0 }),
  ];
  const fourth = piece('c4', 'art.clock', { layer: 'wallL', x: 9, y: 0 });
  async function withClocks() {
    const m = await me();
    await prisma.itemGrant.create({ data: { userId: m.user.id, itemId: 'art.clock', qty: 4, sourceKey: 'test:clocks' } });
    return m;
  }

  it('saves up to the slots, and answers 400 effects_full with the slots for one more', async () => {
    const { headers } = await withClocks();
    expect((await put(headers, body(withPieces(...clocks), 0))).status).toBe(200);
    const res = await put(headers, body(withPieces(...clocks, fourth), 1));
    expect([res.status, res.body]).toEqual([400, { error: 'effects_full', slots: 3 }]);
  });

  it('a room stored before P3 with more than its slots still saves any other change, and keeps every piece', async () => {
    const { user, headers } = await withClocks();
    expect((await put(headers, body(withPieces(...clocks), 0))).status).toBe(200);
    const four = withPieces(...clocks, fourth);
    await prisma.cosmeticLoadout.update({ where: { userId: user.id }, data: { layout: four as unknown as Prisma.InputJsonValue } });
    const moved = { ...four, pieces: four.pieces.map((p) => (p.id === 'plant' ? { ...p, x: 0, y: 3 } : p)) };
    const res = await put(headers, body(moved, 1));
    expect(res.status).toBe(200);
    expect(res.body.layout.pieces.filter((p: { item: string }) => p.item === 'art.clock')).toHaveLength(4);
  });

  it('the cap answers before the slots: a room over its cap is room_full, not effects_full', async () => {
    const { headers } = await withClocks();
    // 7 starter pieces + 4 clocks + 30 cacti on free tiles (not the desk, its exit tile or the fern) = 41 > 40.
    const taken = (x: number, y: number) => (x >= 2 && x <= 4 && y <= 1) || (x === 3 && y === 2) || (x === 0 && y === 0);
    const tiles = Array.from({ length: 49 }, (_, k) => [k % 7, Math.floor(k / 7)] as const).filter(([x, y]) => !taken(x, y)).slice(0, 30);
    const cacti = tiles.map(([x, y], k) => piece(`k${k}`, 'plant.cactus', { x, y }));
    const res = await put(headers, body(withPieces(...clocks, fourth, ...cacti), 0));
    expect([res.status, res.body.error]).toEqual([400, 'room_full']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room/save.test.ts`
Expected: FAIL (the fourth clock saves with 200).

- [ ] **Step 3: Write the implementation**

In `backend/src/cosmetics/loadout.ts`:
- extend the geometry import with `effectSlotsFor, effectsRaised`;
- `SaveError` gains `| 'effects_full'`; `SaveFailure.body` gains `slots?: number`;
- `checkLayout` becomes:

```ts
/**
 * Every catalogue, geometry and ownership rule, in the order of spec §12. Given the stored layout it also checks the
 * effect slots (spec §8.1): only a save that raises the effects above the slots is refused.
 */
export function checkLayout(layout: RoomLayout, worn: Worn, tier: Tier, counts: Readonly<Record<string, number>>, stored?: RoomLayout): SaveFailure | null {
  const wornIds = WORN_SLOTS.flatMap((s) => (worn[s] === null ? [] : [worn[s]!]));
  const styleIds = STYLE_KEYS.map((k) => layout.styles[k]);
  if ([...layout.pieces.map((p) => p.item), ...styleIds, ...wornIds].some((id) => !shippedItem(id))) {
    return { status: 400, body: { error: 'unknown_item' } };
  }
  const wrongStyle = STYLE_KEYS.some((k) => shippedItem(layout.styles[k])!.slot !== k);
  const wrongWorn = WORN_SLOTS.some((s) => worn[s] !== null && shippedItem(worn[s]!)!.slot !== s);
  if (wrongStyle || wrongWorn) return { status: 400, body: { error: 'wrong_layer' } };
  const geo = validateLayout(layout, tier, geometryDeps);
  if (geo?.error === 'bad_place') return { status: 400, body: { error: 'bad_place', reason: geo.reason, pieceIds: geo.pieceIds } };
  if (geo) return { status: 400, body: { error: geo.error } };
  if (stored && effectsRaised(stored, layout, tier, geometryDeps)) return { status: 400, body: { error: 'effects_full', slots: effectSlotsFor(tier) } };
  const notOwned = new Set<string>();
  for (const [item, n] of Object.entries(placedCounts(layout))) if (n > (counts[item] ?? 0)) notOwned.add(item);
  for (const id of [...styleIds, ...wornIds]) if (!((counts[id] ?? 0) > 0)) notOwned.add(id);
  return notOwned.size ? { status: 403, body: { error: 'not_owned', itemIds: [...notOwned].sort() } } : null;
}
```

- in `saveCosmetics`, inside the transaction, the two lines `tier = toTier(row?.tier);` and
  `const bad = checkLayout(parsed.layout, parsed.worn, tier, countsOf(rows, grants));` become:

```ts
      tier = toTier(row?.tier);
      const counts = countsOf(rows, grants);
      // The slots compare with the room as the user sees it (P1 ruling 23's sanitising), or the starter room.
      const stored = (row ? readLayout(row.layout, counts) : null) ?? starterLayout();
      const bad = checkLayout(parsed.layout, parsed.worn, tier, counts, stored);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room tests/cosmetics`
Expected: PASS. Then the full backend suite and `tsc --noEmit -p .` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/cosmetics/loadout.ts backend/tests/room/save.test.ts
git commit -m "feat(room): refuse a save that runs more effects than the room has slots"
```

---

### Task 3: Backend: `living` on the cosmetics body (plant stage, pet energy, awards)

Spec §8.3 (the health-linked states, computed on the server and sent only to you, bands and small counts), §12
("`GET /me/cosmetics` adds … from P3, `living`") and §16 ("`living` (P3): plant stage from the count of `sleep_goal`
events; pet energy bands; awards count; absent from every buddy DTO"). Ruling 6.

**Files:**
- Create: `backend/src/room/living.ts`, `backend/tests/room/living.test.ts`
- Modify: `backend/src/cosmetics/loadout.ts`, `backend/tests/cosmetics/people.test.ts`

**Interfaces:**
- Consumes: `loadRecapData` (`recap/data.ts`), `localCivilDateOrUtc`, `STEPS_GOAL` (`coach/tools/metrics.ts`: the room
  reads the coach's constant, never the other way round, so `noCoachImport` stays green), `prisma.coinEvent`,
  `prisma.achievement`.
- Produces: `type PetEnergy = 'nap' | 'wander' | 'play'`;
  `interface Living { plantStage: 1 | 2 | 3 | 4 | 5; petEnergy: PetEnergy; awards: number[] }`;
  `PLANT_NIGHTS_PER_STAGE = 7`, `MAX_AWARDS = 8`; `plantStageOf(nights: number)`, `petEnergyOf(steps: number)`;
  `readLiving(userId: string, now: Date): Promise<Living>`; `CosmeticsDTO.living: Living` (on GET, on PUT's answer and
  on expand's, which all build the body with `readCosmetics`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/room/living.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { api } from '../buddies/helpers';
import { coinUser } from '../coins/helpers';
import { day, level } from '../cosmetics/helpers';
import { civilDateToUtcMidnight, localCivilDateOrUtc } from '../../src/biometrics/civilDate';
import { MAX_AWARDS, petEnergyOf, plantStageOf, readLiving } from '../../src/room/living';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

const NOW = new Date('2026-10-24T09:00:00.000Z');

async function nights(userId: string, n: number) {
  await prisma.coinEvent.createMany({
    data: Array.from({ length: n }, (_, k) => {
      const d = new Date(Date.UTC(2026, 8, 1 + k)).toISOString().slice(0, 10);
      // 0-coin rows count too (spec §8.3): every other night was written at the cap.
      return { userId, kind: 'sleep_goal', sourceKey: `sleep_goal:${d}`, amount: k % 2 ? 0 : 20, capDay: day(d) };
    }),
  });
}
async function steps(userId: string, tz: string, value: number) {
  await prisma.biometricRecord.create({ data: { userId, metricType: 'STEPS', value, recordedAt: civilDateToUtcMidnight(localCivilDateOrUtc(NOW, tz)) } });
}

describe('the living room (spec §8.3, P3 ruling 6)', () => {
  it('grows a plant a stage every 7 sleep-goal nights, from 1 to 5', () => {
    expect([0, 6, 7, 13, 14, 28, 200].map(plantStageOf)).toEqual([1, 1, 2, 2, 3, 5, 5]);
  });

  it('bands steps against the step goal: under 30% naps, then wanders, and plays at the goal', () => {
    expect([0, 2999, 3000, 9999, 10000, 25000].map(petEnergyOf)).toEqual(['nap', 'nap', 'wander', 'wander', 'play', 'play']);
  });

  it('reads the nights, today\'s steps in the user\'s own zone and the award levels, highest first, at most 8', async () => {
    const { user } = await coinUser({ timezone: 'Pacific/Auckland' });
    await nights(user.id, 15);
    await steps(user.id, 'Pacific/Auckland', 4200);
    const families = ['SLEEP_GOAL', 'STEADY_BEDTIME', 'STEP_GOAL', 'CHECK_IN', 'BEST_RECOVERY_WEEK'] as const;
    for (const [k, family] of families.entries()) {
      await level(user.id, family, 1, NOW);
      await level(user.id, family, 2, NOW);
      if (k < 2) await level(user.id, family, 3, NOW);
    }
    const living = await readLiving(user.id, NOW);
    expect(living).toEqual({ plantStage: 3, petEnergy: 'wander', awards: [3, 3, 2, 2, 2, 2, 2, 1] });
    expect(living.awards).toHaveLength(MAX_AWARDS);
  });

  it('a new user\'s room: stage 1, the cat asleep, no awards', async () => {
    const { user } = await coinUser();
    expect(await readLiving(user.id, NOW)).toEqual({ plantStage: 1, petEnergy: 'nap', awards: [] });
  });

  it('GET /me/cosmetics carries it, and no health value anywhere in the body', async () => {
    const { user, headers } = await coinUser();
    await nights(user.id, 7);
    const res = await (await api()).get('/me/cosmetics').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.living).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [] });
    expect(JSON.stringify(res.body)).not.toMatch(/"(steps|minutes|sleepMinutes|value)"/);
  });
});
```

In `backend/tests/cosmetics/people.test.ts`, at the end of "a buddy row carries what their KIP wears, and nothing about
their room", add:

```ts
  // P3: the living room is never shown to buddies (spec §8.3, §10.1).
  expect(JSON.stringify(res.body)).not.toMatch(/"(living|plantStage|petEnergy|awards)"/);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room/living.test.ts`
Expected: FAIL (`src/room/living` does not exist).

- [ ] **Step 3: Write the implementation**

Create `backend/src/room/living.ts`:

```ts
// The living room (spec 2026-10-15 §8.3, C5): the room mirrors your data in bands and small counts, never a raw value,
// computed here and sent only to you on the cosmetics body. Plants grow a stage every 7 sleep-goal nights (the
// `sleep_goal` coin rows, 0-coin ones included, so nights before coins launched don't count); the cat's energy is
// today's steps as a band of the step goal; the trophy shelf holds one award per badge level, highest first. Never
// logged, never in a buddy DTO, never in a coach context (tests/room/noCoachImport.test.ts). The 22:00 nap is the
// app's, from the device clock (P3 plan ruling 6).
import { localCivilDateOrUtc } from '../biometrics/civilDate';
import { STEPS_GOAL } from '../coach/tools/metrics';
import { prisma } from '../db/client';
import { loadRecapData } from '../recap/data';

export type PetEnergy = 'nap' | 'wander' | 'play';
export interface Living {
  plantStage: 1 | 2 | 3 | 4 | 5;
  petEnergy: PetEnergy;
  /** Badge levels (1-5), highest first, at most MAX_AWARDS. */
  awards: number[];
}

export const PLANT_NIGHTS_PER_STAGE = 7;
export const MAX_AWARDS = 8;

export function plantStageOf(nights: number): Living['plantStage'] {
  return Math.min(5, 1 + Math.floor(Math.max(0, nights) / PLANT_NIGHTS_PER_STAGE)) as Living['plantStage'];
}

export function petEnergyOf(steps: number): PetEnergy {
  const share = steps / STEPS_GOAL;
  return share >= 1 ? 'play' : share >= 0.3 ? 'wander' : 'nap';
}

export async function readLiving(userId: string, now: Date): Promise<Living> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? 'UTC';
  const today = localCivilDateOrUtc(now, tz);
  const [nights, data, rows] = await Promise.all([
    prisma.coinEvent.count({ where: { userId, kind: 'sleep_goal' } }),
    loadRecapData(userId, tz, today, today, { bedtimes: false }),
    prisma.achievement.findMany({
      where: { userId },
      select: { level: true },
      orderBy: [{ level: 'desc' }, { earnedOn: 'asc' }, { id: 'asc' }],
      take: MAX_AWARDS,
    }),
  ]);
  return { plantStage: plantStageOf(nights), petEnergy: petEnergyOf(data.get(today)?.steps ?? 0), awards: rows.map((r) => r.level) };
}
```

In `backend/src/cosmetics/loadout.ts`:
- `import { readLiving, type Living } from '../room/living';`
- `CosmeticsDTO` gains, after `welcomed`:

```ts
  /** The living room (spec §8.3): bands and small counts for your own room only. */
  living: Living;
```

- in `readCosmetics`, the `Promise.all` gains a seventh read, `readLiving(userId, now)`, destructured as `living`
  (`const [rows, loadout, facts, firstWeek, grants, newCopies, living] = …`), and the returned object gains `living,`
  after `welcomed`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backend-jest.sh tests/room tests/cosmetics tests/coins`
Expected: PASS (the purchase and expand bodies carry `living` too; no test compares their whole body). Then the full
backend suite and `tsc --noEmit -p .` (0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/room/living.ts backend/src/cosmetics/loadout.ts backend/tests/room/living.test.ts backend/tests/cosmetics/people.test.ts
git commit -m "feat(room): the living room: plant stage, pet energy and awards on the cosmetics body"
```

---

### Task 4: Mobile: the effects model, `living` in the store, effect states in the picture, growing plants, the lamp's pool, and the advice guard

Spec §8.1 (effect slots; the first ones by instance id run; inert extras never fail), §8.2 (the floor lamp's warm pool
after dark; plants: growth), §8.3 (plants by sleep-goal nights; "computed on the server, sent only to you"; words the
room uses and the copy guard), §3.7 (piece pictures keyed by effect state) and §12 ("nothing cosmetic reaches the
model"). Rulings 5–8, 18.

**Files:**
- Create: `mobile/src/lib/room/effects.ts`, `mobile/src/lib/room/iso/pieces/effectArt.ts`,
  `mobile/src/components/room/useRoomEffects.ts`, `mobile/__tests__/lib/roomEffects.test.ts`,
  `mobile/__tests__/lib/isoEffects.test.ts`, `mobile/__tests__/conventions/noRoomInCoach.test.ts`
- Modify: `mobile/src/api/cosmetics.ts`, `mobile/src/lib/room/cosmeticsStore.ts`, `mobile/src/lib/room/items.ts`,
  `mobile/src/lib/room/iso/art.ts`, `mobile/src/lib/room/iso/pieces/stand.ts`, `mobile/src/lib/room/iso/room.ts`,
  `mobile/src/lib/room/roomCopy.ts`, `mobile/src/components/room/RoomView.tsx`,
  `mobile/src/components/coach/RoomCard.tsx`, `mobile/src/components/coach/CollapsedKipHeader.tsx`,
  `mobile/src/components/edit/EditRoom.tsx`, `mobile/src/screens/DecorateRoomScreen.tsx`,
  `mobile/src/screens/RoomSizesScreen.tsx`, `mobile/jest-mocks/cosmeticsFixture.ts`, `mobile/jest-mocks/RoomView.js`,
  `mobile/__tests__/lib/roomCopy.test.ts`, `mobile/__tests__/lib/cosmeticsStore.test.tsx`,
  `mobile/__tests__/components/RoomView.test.tsx`

**Interfaces:**
- Consumes: Task 1's `EffectKind`, `effectPieces`, `effectSlotsFor`; Task 3's `living` body; P1's `GEOMETRY_DEPS`,
  `catalogueItem`, `pieceLayers`, `standPiece`, `drawIsoStatic`, `isoRoomKey`, `layoutKey`.
- Produces:
  - `effects.ts`: `type PetEnergy`; `interface Living { plantStage: 1 | 2 | 3 | 4 | 5; petEnergy: PetEnergy; awards: readonly number[] }`;
    `NEUTRAL_LIVING`; `readLiving(v: unknown): Living`; `livingKey(l: Living): string`;
    `interface ClockNow { hhmm: string; hour: number }`; `NAP_FROM = 22`, `NAP_UNTIL = 6`, `isNapHour(hour)`;
    `interface RoomEffects { running; inert; used; slots; states; napOn; plant; needsClock }`;
    `roomEffects(layout, tier, living, now: ClockNow | null, deps = GEOMETRY_DEPS): RoomEffects`;
    `effectsKey(e: RoomEffects): string`; `withState(e: RoomEffects, id: string, state: string): RoomEffects`;
    `effectOf(item: string, deps = GEOMETRY_DEPS): EffectKind | undefined`;
  - `effectArt.ts`: `GROWTH`, `POT_COLOURS`, `growRects(rects, stage)`, `growLayers(layers, stage)`, `POOL`,
    `lampPool(): Rects`, `SQUASH: Record<string, number>`, `squashRects(rects, k)`;
  - `IsoArtOpts.effect?: string` (in the piece cache key); `ItemContext.effect?: string`;
  - `IsoStaticInput.effects?: RoomEffects` (in `isoRoomKey`);
  - `useRoomEffects(layout, tier, living?: Living): RoomEffects` (Task 5 adds the clock, Task 6 the editing flag);
  - `Cosmetics.living: Living`, `MyRoom.living: Living`; `CosmeticsDTO.living?: unknown` (app);
  - `RoomViewProps.living?: Living`; `EditRoomProps.living?: Living`;
  - `ROOM_COPY.effects` (all effect and living lines, used by Tasks 5–13).

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/roomEffects.test.ts`:

```ts
import { GEOMETRY_DEPS } from '../../src/lib/room/catalogue';
import { NEUTRAL_LIVING, effectsKey, isNapHour, readLiving, roomEffects, withState, type Living } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const clock = (id: string, layer: 'wallL' | 'wallR', x: number) => at(id, 'art.clock', { layer, x });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const LIVING: Living = { plantStage: 3, petEnergy: 'play', awards: [5, 4, 3] };
const DAY = { hhmm: '07:12', hour: 7 };
const NIGHT = { hhmm: '23:05', hour: 23 };

describe('roomEffects (spec §8.1, §8.3, P3 rulings 4-6)', () => {
  it('runs the first slots by instance id, and the rest rest (Review Focus 1)', () => {
    const e = roomEffects(room(clock('p4', 'wallL', 9), clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0)), 1, LIVING, DAY);
    expect([[...e.running].sort(), [...e.inert], e.used, e.slots]).toEqual([['p1', 'p2', 'p3'], ['p4'], 3, 3]);
    expect([e.states.get('p1'), e.states.get('p4')]).toEqual(['live@07:12', undefined]);
    expect(e.needsClock).toBe(true);
  });

  it('gives each running piece its state: the lamp lit, the radio\'s notes, the shelf\'s awards', () => {
    const e = roomEffects(room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }), at('p2', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }), at('p3', 'shelf.awards', { layer: 'wallR', x: 0, y: 12 })), 1, LIVING, null);
    expect(Object.fromEntries(e.states)).toEqual({ p1: 'lit', p2: 'notes', p3: 'a543', plant: 'g3' });
    expect(e.needsClock).toBe(false);
  });

  it('grows every plant to the room\'s one stage; stage 5 is the plain plant; a plant is the room\'s mood', () => {
    const l = room(at('p1', 'plant.cactus', { x: 6, y: 6 }));
    expect([roomEffects(l, 1, LIVING, null).states.get('p1'), roomEffects(l, 1, LIVING, null).states.get('plant')]).toEqual(['g3', 'g3']);
    expect(roomEffects(l, 1, NEUTRAL_LIVING, null).states.size).toBe(0);
    expect(roomEffects(l, 1, LIVING, null).plant).toBe(true);
    expect(roomEffects({ ...l, pieces: l.pieces.filter((p) => !p.item.startsWith('plant.')) }, 1, LIVING, null).plant).toBe(false);
  });

  it('the cat follows the steps band by day, and naps on the first free bed by id after 22:00', () => {
    const l = room(at('p1', 'pet.tabby', { x: 6, y: 6 }), at('p3', 'pet.bed', { x: 5, y: 6 }), at('p2', 'pet.bed', { x: 4, y: 6 }));
    const day = roomEffects(l, 1, LIVING, DAY);
    expect([day.states.get('p1'), day.napOn.size]).toEqual(['play', 0]);
    const night = roomEffects(l, 1, LIVING, NIGHT);
    expect([night.states.get('p1'), night.napOn.get('p1')]).toEqual(['nap', 'p2']);
    expect([isNapHour(21), isNapHour(22), isNapHour(5), isNapHour(6)]).toEqual([false, true, true, false]);
    expect(roomEffects(room(at('p1', 'pet.tabby', { x: 6, y: 6 })), 1, LIVING, NIGHT).napOn.size).toBe(0); // no bed: curled on its tile
  });

  it('an inert piece has no state at all: it draws as plain decor (ruling 5)', () => {
    const lamps = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'corner.floorlamp', { x: 6, y: 3 + k }));
    expect(roomEffects(room(...lamps), 1, LIVING, null).states.has('p4')).toBe(false);
  });

  it('a tap piece runs with no state until it is tapped (ruling 17; injected, since the duck is B2)', () => {
    const deps = { isoOf: (id: string) => (id === 'item.mug' ? { ...GEOMETRY_DEPS.isoOf(id)!, effect: 'tap' as const } : GEOMETRY_DEPS.isoOf(id)) };
    const e = roomEffects(starterLayout(), 1, NEUTRAL_LIVING, null, deps);
    expect([e.running.has('deskitem'), e.states.has('deskitem')]).toEqual([true, false]);
    expect(withState(e, 'deskitem', 'squash1').states.get('deskitem')).toBe('squash1');
    expect(effectsKey(withState(e, 'deskitem', 'squash1'))).not.toBe(effectsKey(e));
  });

  it('reads a living body, and anything else as the neutral room', () => {
    expect(readLiving({ plantStage: 2, petEnergy: 'nap', awards: [3, 1] })).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [3, 1] });
    for (const bad of [undefined, null, {}, { plantStage: 6, petEnergy: 'nap', awards: [] }, { plantStage: 2, petEnergy: 'run', awards: [] }, { plantStage: 2, petEnergy: 'nap', awards: [9] }]) {
      expect(readLiving(bad)).toEqual(NEUTRAL_LIVING);
    }
  });
});
```

Create `mobile/__tests__/lib/isoEffects.test.ts`:

```ts
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { effectsKey, roomEffects } from '../../src/lib/room/effects';
import type { RoomRect } from '../../src/lib/room/grid';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import { POT_COLOURS, squashRects } from '../../src/lib/room/iso/pieces/effectArt';
import { opaqueBounds } from '../../src/lib/room/iso/prims';
import { drawIsoStatic, isoRoomKey } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());
const cells = (rs: readonly RoomRect[]) => rs.filter(([, , , , c]) => !c.startsWith('rgba')).reduce((n, [, , w, h]) => n + w * h, 0);
const pots = (rs: readonly RoomRect[]) => rs.filter(([, , , , c]) => POT_COLOURS.has(c.toUpperCase()));
const FLOOR = { layer: 'floor' as const, facing: 'L' as const, mirror: false };
const PLANTS = CATALOGUE.items.filter((i) => i.slot === 'plant' && i.iso && isoArtOf(i.id)).map((i) => i.id);

it('a plant grows from the pot up: the pot stays, the leaves are cut from the top and narrowed (ruling 8)', () => {
  expect(PLANTS.length).toBe(7);
  for (const id of PLANTS) {
    const full = pieceLayers(id, CTX_DAY, FLOOR)!.base!;
    const young = pieceLayers(id, CTX_DAY, { ...FLOOR, effect: 'g1' })!.base!;
    expect({ id, pots: pots(young) }).toEqual({ id, pots: pots(full) });
    expect({ id, fewer: cells(young) < cells(full), shorter: opaqueBounds(young)!.h < opaqueBounds(full)!.h }).toEqual({ id, fewer: true, shorter: true });
  }
});

it('the floor lamp lays a warm pool on the floor after dark, only while it runs (spec §8.2, ruling 5)', () => {
  const lit = pieceLayers('corner.floorlamp', CTX_NIGHT, { ...FLOOR, effect: 'lit' })!.emissive!;
  const plain = pieceLayers('corner.floorlamp', CTX_NIGHT, FLOOR)!.emissive!;
  expect(lit.length).toBeGreaterThan(plain.length);
  expect(pieceLayers('corner.floorlamp', CTX_DAY, { ...FLOOR, effect: 'lit' })!.emissive).toEqual(pieceLayers('corner.floorlamp', CTX_DAY, FLOOR)!.emissive);
});

it('a squash keeps the piece\'s bottom row and shortens it (ruling 17)', () => {
  const base = pieceLayers('plant.fern', CTX_DAY, FLOOR)!.base!;
  const b = opaqueBounds(base)!;
  const s = opaqueBounds(squashRects(base, 0.7))!;
  expect([s.y + s.h, s.h < b.h]).toEqual([b.y + b.h, true]);
});

it('the static room follows the living room: a new stage is a new key and a new picture, the same one is not', () => {
  const layout = starterLayout();
  const input = (stage: 1 | 5) => ({ layout, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const, effects: roomEffects(layout, 1, { plantStage: stage, petEnergy: 'wander', awards: [] }, null) });
  expect(isoRoomKey(input(1))).not.toBe(isoRoomKey(input(5)));
  expect(isoRoomKey(input(5))).toBe(isoRoomKey(input(5)));
  expect(effectsKey(input(5).effects)).toBe('|'); // the neutral starter room has no state at all
  const total = (stage: 1 | 5) => { const s = drawIsoStatic(input(stage)); return cells(s.back) + cells(s.front); };
  expect(total(1)).toBeLessThan(total(5)); // the starter fern is smaller at stage 1
});
```

Create `mobile/__tests__/conventions/noRoomInCoach.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import { sourceFiles } from '../../jest-mocks/sourceScan';

// Spec 2026-10-15 §8.1, §12: nothing cosmetic or effect-related reaches the coach or the model. The app's coach code
// (its API, stream, answers, prompts, status and conversation) never imports the room, coins or cosmetics.
const SRC = path.join(__dirname, '../../src');
const COACH = sourceFiles(SRC).filter((f) => /\/(api\/coach[^/]*|lib\/coach[^/]*|lib\/coachStatus\/[^/]+|lib\/useCoach[^/]*)\.(ts|tsx)$/.test(f.split(path.sep).join('/')));
const IMPORT = /(?:from|require\()\s*['"][^'"]*(?:\/room\/|\/coins\/|\/cosmetics|\/effects)[^'"]*['"]/;

it('finds the coach files it guards', () => {
  expect(COACH.length).toBeGreaterThanOrEqual(6);
});

it('no coach file imports the room, coins, cosmetics or effects', () => {
  expect(COACH.filter((f) => IMPORT.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SRC, f))).toEqual([]);
});
```

In `mobile/__tests__/lib/roomCopy.test.ts`, add:

```ts
/** Every string under a copy object, with each function called on sample arguments. */
function copyStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return copyStrings((v as (...a: unknown[]) => unknown)('fern', 7, 3));
  if (v && typeof v === 'object') return Object.values(v).flatMap(copyStrings);
  return [];
}
const ADVICE = /\b(should|try|more|need|needs|must)\b/i;
// Health verbs that open a sentence. "Move" and "Store" are the room's own buttons (moving furniture is no advice).
const HEALTH_VERB = /(^|[.!?:]\s+)(sleep|walk|drink|rest|exercise|go|get|hit|reach|eat)\b/i;
const advises = (s: string) => ADVICE.test(s) || HEALTH_VERB.test(s);

it('never gives health advice in an effect or living line (spec §8.3, P3 ruling 18)', () => {
  for (const bad of ['Sleep more to grow your fern.', 'Walk 2,000 more steps to wake the cat.', 'You should rest.', 'Try for 8 hours.']) expect(advises(bad)).toBe(true);
  const lines = copyStrings(ROOM_COPY.effects);
  expect(lines.length).toBeGreaterThan(15);
  for (const s of lines) expect({ s, advises: advises(s) }).toEqual({ s, advises: false });
  expect([ROOM_COPY.effects.grew('fern', 7), ROOM_COPY.effects.pet.nap]).toEqual(['The fern grew: 7 nights at your goal.', 'The cat’s napping.']);
  expect(copyStrings(ROOM_COPY.effects).join(' ')).not.toMatch(/\d+ (steps|minutes|hours)|%/); // never a health value
});
```

In `mobile/__tests__/lib/cosmeticsStore.test.tsx`, add (the file's `fetchCosmetics` mock and `cosmeticsDTO` are already
imported there):

```ts
it('keeps the living room from the body, and reads a missing or broken one as neutral (spec §8.3)', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ living: { plantStage: 2, petEnergy: 'nap', awards: [4] } }));
  expect((await loadCosmetics({ fresh: true }))!.living).toEqual({ plantStage: 2, petEnergy: 'nap', awards: [4] });
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ version: 2, living: 'nope' }));
  expect((await loadCosmetics({ fresh: true }))!.living).toEqual(NEUTRAL_LIVING);
});
```

with `import { NEUTRAL_LIVING } from '../../src/lib/room/effects';` at the top.

In `mobile/__tests__/components/RoomView.test.tsx`, add:

```ts
it('draws the living room: a new plant stage rebuilds the static picture once, the same one records nothing (ruling 7)', () => {
  const s = render(<RoomView {...PROPS} living={{ plantStage: 5, petEnergy: 'wander', awards: [] }} />);
  const [back, , front] = pictures(s);
  const before = picture.mock.calls.length;
  s.rerender(<RoomView {...PROPS} living={{ plantStage: 5, petEnergy: 'wander', awards: [] }} />);
  expect(picture.mock.calls.length - before).toBe(0);
  s.rerender(<RoomView {...PROPS} living={{ plantStage: 2, petEnergy: 'wander', awards: [] }} />);
  const [back2, , front2] = pictures(s);
  expect(back2 !== back || front2 !== front).toBe(true); // the starter fern is at stage 2 now
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/roomEffects.test.ts __tests__/lib/isoEffects.test.ts __tests__/lib/roomCopy.test.ts`
Expected: FAIL (`src/lib/room/effects` does not exist; `ROOM_COPY.effects` is undefined). The coach guard already passes
(it pins a rule that holds today).

- [ ] **Step 3: The effects model**

Create `mobile/src/lib/room/effects.ts`:

```ts
// The living room on the app's side (spec 2026-10-15 §8): which effect pieces run (the first slots by instance id,
// geometry's one rule) and which rest, and each piece's effect state, the key its art is drawn and cached by (P3
// ruling 7): 'lit' (the lamp's pool), 'notes' (the radio), 'live@HH:MM' (the clock), 'a543' (the shelf's awards),
// 'nap' | 'wander' | 'play' (the cat), 'g1'-'g4' (growing plants), 'squash1' | 'squash2' (a tapped piece). An inert
// piece has no state and draws as plain decor (ruling 5). `living` is the server's bands (Task 3); the 22:00 nap is the
// device clock's (ruling 6). Nothing here is sent anywhere: not to buddies, not to the coach.
import { GEOMETRY_DEPS, catalogueItem } from './catalogue';
import { effectPieces, effectSlotsFor, type EffectKind, type GeometryDeps, type Placement, type RoomLayout, type Tier } from './iso/geometry';

export type PetEnergy = 'nap' | 'wander' | 'play';
export interface Living {
  plantStage: 1 | 2 | 3 | 4 | 5;
  petEnergy: PetEnergy;
  /** Badge levels, highest first, at most 8. */
  awards: readonly number[];
}
/** Nothing health-linked: plants grown, the cat wandering, the shelf empty (spec §10.1). A visit and the share card draw
 * it (P4); so does an older server's body. */
export const NEUTRAL_LIVING: Living = { plantStage: 5, petEnergy: 'wander', awards: [] };

const isStage = (v: unknown): v is Living['plantStage'] => v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
const isEnergy = (v: unknown): v is PetEnergy => v === 'nap' || v === 'wander' || v === 'play';

export function readLiving(v: unknown): Living {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  if (!o || !isStage(o.plantStage) || !isEnergy(o.petEnergy) || !Array.isArray(o.awards)) return NEUTRAL_LIVING;
  const awards = o.awards as unknown[];
  if (awards.length > 8 || !awards.every((a) => a === 1 || a === 2 || a === 3 || a === 4 || a === 5)) return NEUTRAL_LIVING;
  return { plantStage: o.plantStage, petEnergy: o.petEnergy, awards: awards as number[] };
}

export const livingKey = (l: Living): string => `${l.plantStage}${l.petEnergy}${l.awards.join('')}`;

/** The device's local time, read once a minute (Task 5's useClockMinute). */
export interface ClockNow { hhmm: string; hour: number }
/** The cat always naps from 22:00 to 05:59 local (spec §8.3, ruling 6). */
export const NAP_FROM = 22;
export const NAP_UNTIL = 6;
export const isNapHour = (hour: number): boolean => hour >= NAP_FROM || hour < NAP_UNTIL;

export interface RoomEffects {
  /** Placement ids whose effect runs. */
  running: ReadonlySet<string>;
  /** Effect pieces past the slots: placed, drawn plain, doing nothing. */
  inert: ReadonlySet<string>;
  /** Running effects, for "Effects 3 of 5". */
  used: number;
  slots: number;
  /** Placement id → effect state (only pieces that have one). */
  states: ReadonlyMap<string, string>;
  /** A napping cat's id → the pet bed it lies on. */
  napOn: ReadonlyMap<string, string>;
  /** A plant is in the room: KIP's smile frame (ruling 9). */
  plant: boolean;
  /** A running clock or cat reads the time. */
  needsClock: boolean;
}

export function effectOf(item: string, deps: GeometryDeps = GEOMETRY_DEPS): EffectKind | undefined {
  return deps.isoOf(item)?.effect;
}

const byId = (a: Placement, b: Placement) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const isPlant = (p: Placement) => catalogueItem(p.item)?.slot === 'plant';

export function roomEffects(layout: RoomLayout, tier: Tier, living: Living, now: ClockNow | null, deps: GeometryDeps = GEOMETRY_DEPS): RoomEffects {
  const list = effectPieces(layout, deps);
  const slots = effectSlotsFor(tier);
  const running = new Set(list.slice(0, slots).map((p) => p.id));
  const inert = new Set(list.slice(slots).map((p) => p.id));
  const states = new Map<string, string>();
  const napOn = new Map<string, string>();
  const beds = layout.pieces.filter((p) => p.layer === 'floor' && p.item === 'pet.bed').sort(byId);
  let needsClock = false;
  for (const p of list) {
    if (!running.has(p.id)) continue;
    switch (deps.isoOf(p.item)!.effect) {
      case 'light': states.set(p.id, 'lit'); break;
      case 'sound': states.set(p.id, 'notes'); break;
      case 'awards': states.set(p.id, `a${living.awards.slice(0, 8).join('')}`); break;
      case 'clock':
        needsClock = true;
        if (now) states.set(p.id, `live@${now.hhmm}`);
        break;
      case 'wander': {
        needsClock = true;
        const state: PetEnergy = now && isNapHour(now.hour) ? 'nap' : living.petEnergy;
        states.set(p.id, state);
        const bed = state === 'nap' && p.layer === 'floor' ? beds.shift() : undefined;
        if (bed) napOn.set(p.id, bed.id);
        break;
      }
      case 'tap':
      case undefined:
        break;
    }
  }
  if (living.plantStage < 5) for (const p of layout.pieces) if (isPlant(p)) states.set(p.id, `g${living.plantStage}`);
  return { running, inert, used: running.size, slots, states, napOn, plant: layout.pieces.some(isPlant), needsClock };
}

/** The effect part of the static room's key (isoRoomKey). */
export function effectsKey(e: RoomEffects): string {
  const states = [...e.states].map(([id, s]) => `${id}=${s}`).sort().join(',');
  const naps = [...e.napOn].map(([cat, bed]) => `${cat}>${bed}`).sort().join(',');
  return `${states}|${naps}`;
}

/** The same effects with one piece's state set (a tap's squash, Task 13). */
export function withState(e: RoomEffects, id: string, state: string): RoomEffects {
  const states = new Map(e.states);
  states.set(id, state);
  return { ...e, states };
}
```

- [ ] **Step 4: Effect states in the art and the picture key**

In `mobile/src/lib/room/items.ts`, `ItemContext` gains, after `screen`:

```ts
  /** The piece's effect state (P3 ruling 7): only effect art reads it, and the picture key carries it. */
  effect?: string;
```

Create `mobile/src/lib/room/iso/pieces/effectArt.ts`:

```ts
// Effect art that is not a piece's own drawing (spec 2026-10-15 §8.2, §8.3): a plant growing from its pot (isox.py
// `plantg`), the floor lamp's warm pool after dark, and the tap squash. Task 5 adds the radio's notes. Pure; every rect
// is in the piece's own space, as standFront leaves it: (0, 0) is its opaque bottom centre.
import type { RoomRect } from '../../grid';
import type { ItemLayers } from '../../items';
import { glow, type Rects } from '../../paint';
import { opaqueBounds } from '../prims';

/** How much of the foliage shows at each stage (ruling 8). */
export const GROWTH: Readonly<Record<number, number>> = { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1 };
/** Pot colours (isox.py's `potc`, plus the succulent tray and the bamboo vase), upper case. */
export const POT_COLOURS: ReadonlySet<string> = new Set([
  '#B45309', '#8C4107', '#D97706', '#F8FAFC', '#E5E7EB', '#C2410C', '#F1F5F9', '#94A3B8', '#CBD5E1', '#BAE6FD',
]);

const isPot = (c: string) => POT_COLOURS.has(c.toUpperCase());

/** The pot stays; leaves above it are cut from the top to the stage's share and narrowed about the centre line. */
export function growRects(rects: readonly RoomRect[], stage: number): Rects {
  const grow = GROWTH[stage] ?? 1;
  const pots = rects.filter(([, , , , c]) => isPot(c));
  if (grow >= 1 || !pots.length) return [...rects];
  const potTop = Math.min(...pots.map(([, y]) => y));
  const isLeaf = ([, y, , , c]: RoomRect) => !c.startsWith('rgba') && !isPot(c) && y < potTop;
  const leaves = rects.filter(isLeaf);
  if (!leaves.length) return [...rects];
  const top = Math.min(...leaves.map(([, y]) => y));
  const cut = Math.ceil(potTop - (potTop - top) * grow);
  const sc = 0.45 + 0.55 * grow;
  const out: Rects = [];
  for (const q of rects) {
    const [x, y, w, h, c] = q;
    if (!isLeaf(q)) { out.push([x, y, w, h, c]); continue; }
    const y0 = Math.max(y, cut);
    const y1 = Math.min(y + h, potTop);
    if (y1 > y0) out.push([Math.round(x * sc), y0, Math.max(1, Math.round(w * sc)), y1 - y0, c]);
  }
  return out;
}

export function growLayers(l: ItemLayers, stage: number): ItemLayers {
  return { ...l, ...(l.base ? { base: growRects(l.base, stage) } : {}) };
}

/** The floor lamp's pool (spec §8.2): drawn in the glow layer, so after the night veil. */
export const POOL = { rx: 30, ry: 15, rgb: '253,224,150', a: 0.1 } as const;
export function lampPool(): Rects {
  const r: Rects = [];
  glow(r, 0, 0, POOL.rx, POOL.ry, POOL.rgb, POOL.a);
  return r;
}

/** A tapped piece's two frames (ruling 17): its height, bottom row fixed. */
export const SQUASH: Readonly<Record<string, number>> = { squash1: 0.7, squash2: 0.85 };
export function squashRects(rects: readonly RoomRect[], k: number): Rects {
  const b = opaqueBounds(rects);
  if (!b) return [...rects];
  const bottom = b.y + b.h;
  return rects.map(([x, y, w, h, c]) => {
    const y0 = bottom - Math.round((bottom - y) * k);
    const y1 = bottom - Math.round((bottom - (y + h)) * k);
    return [x, y0, w, Math.max(1, y1 - y0), c] as RoomRect;
  });
}
```

In `mobile/src/lib/room/iso/art.ts`:
- `IsoArtOpts` gains:

```ts
  /** The piece's effect state (P3 ruling 7): part of the cache key. */
  effect?: string;
```

- `pieceLayers` becomes:

```ts
export function pieceLayers(id: ItemId, ctx: ItemContext, o: IsoArtOpts): ItemLayers | null {
  const art = isoArtOf(id);
  if (!art) return null;
  const key = [id, o.layer, o.facing, o.mirror ? 1 : 0, ctx.night ? 'n' : 'd', ctx.colour, ctx.screen, o.effect ?? ''].join('|');
  const hit = CACHE.get(key);
  if (hit) {
    CACHE.delete(key);
    CACHE.set(key, hit);
    return hit;
  }
  const item = catalogueItem(id)!;
  // Front-on art reads the state through its context (the clock's time, the cat's pose).
  const drawn = art.draw(o.effect ? { ...ctx, effect: o.effect } : ctx, o);
  const squash = o.effect ? SQUASH[o.effect] : undefined;
  const layers: ItemLayers = {
    base: squash ? squashRects(drawn.base ?? [], squash) : drawn.base ?? [],
    ...(item.emissive && drawn.emissive ? { emissive: drawn.emissive } : {}),
    // An effect may bring a loop of its own (the radio's notes) to a piece with no loop flag.
    ...((item.frames || o.effect) && drawn.frames ? { frames: drawn.frames } : {}),
  };
  CACHE.set(key, layers);
  if (CACHE.size > PIECE_CACHE_SIZE) CACHE.delete(CACHE.keys().next().value!);
  return layers;
}
```

with `import { SQUASH, squashRects } from './pieces/effectArt';`.

In `mobile/src/lib/room/iso/pieces/stand.ts`, import `growLayers, lampPool` from `./effectArt` and `ItemContext`
from `../../items`, then in `standPiece`'s draw the last line becomes:

```ts
      return moveLayers(withEffect(item.slot, standFront(front, o.mirror), ctx, o), dx, dy);
```

with, above `standPiece`:

```ts
/** A billboard's effect state, in its own space (ruling 7): a growing plant, the floor lamp's pool after dark. */
function withEffect(slot: string, l: ItemLayers, ctx: ItemContext, o: IsoArtOpts): ItemLayers {
  const e = o.effect;
  if (!e) return l;
  if (slot === 'plant' && /^g[1-4]$/.test(e)) return growLayers(l, Number(e.slice(1)));
  if (e === 'lit' && ctx.night) return { ...l, emissive: [...(l.emissive ?? []), ...lampPool()] };
  return l;
}
```

In `mobile/src/lib/room/iso/room.ts`:
- `import { effectsKey, type RoomEffects } from '../effects';`
- `IsoStaticInput` gains:

```ts
  /** Each piece's effect state (P3 ruling 7); absent, every piece draws plain (P1's room). */
  effects?: RoomEffects;
```

- in `drawIsoStatic`, `put` builds its options with the state:

```ts
    const state = input.effects?.states.get(p.id);
    const o: IsoArtOpts = { layer: p.layer, facing: p.facing, mirror: p.mirror, ...(state ? { effect: state } : {}) };
```

- `isoRoomKey` becomes:

```ts
export function isoRoomKey(input: IsoStaticInput): string {
  const effects = input.effects ? effectsKey(input.effects) : '';
  return `${layoutKey(input.layout)}#${input.tier}#${input.weather}#${input.night ? 'n' : 'd'}#${input.colour}#${input.hide ?? ''}#${effects}`;
}
```

- [ ] **Step 5: `living` in the store, and every room view draws it**

In `mobile/src/api/cosmetics.ts`, `CosmeticsDTO` gains `living?: unknown;` (the store validates it).

In `mobile/src/lib/room/cosmeticsStore.ts`:
- `import { NEUTRAL_LIVING, livingKey, readLiving, type Living } from './effects';`
- `Cosmetics` gains `living: Living;`; `fromDTO` sets `living: readLiving(dto.living),`;
- `MyRoom` becomes `export interface MyRoom { layout: RoomLayout; tier: Tier; living: Living }`;
  `STARTER_ROOM_VIEW` gains `living: NEUTRAL_LIVING`; in `roomOf`, `same` also needs
  `livingKey(roomView.value.living) === livingKey(cosmetics.living)` and the new value is
  `{ layout: cosmetics.layout, tier: cosmetics.tier, living: cosmetics.living }`.

In `mobile/jest-mocks/cosmeticsFixture.ts`, the body gains `living: { plantStage: 5, petEnergy: 'wander', awards: [] },`
before `...over` (the neutral room, so no existing hit-box test moves).

In `mobile/jest-mocks/RoomView.js`, the stand-in's props gain `living: p.living ? JSON.stringify(p.living) : undefined,`.

Create `mobile/src/components/room/useRoomEffects.ts`:

```ts
import { useMemo } from 'react';
import { NEUTRAL_LIVING, livingKey, roomEffects, type Living, type RoomEffects } from '../../lib/room/effects';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { layoutKey } from '../../lib/room/layout';

/** The room's effects for a view (spec §8), recomputed only when the layout, the tier or the living room changes. */
export function useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING): RoomEffects {
  const key = `${layoutKey(layout)}#${tier}#${livingKey(living)}`;
  return useMemo(() => roomEffects(layout, tier, living, null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

In `mobile/src/components/room/RoomView.tsx`:
- `import { useRoomEffects } from './useRoomEffects';` and `import type { Living } from '../../lib/room/effects';`
- `RoomViewProps` gains:

```ts
  /** The living room (spec §8.3); absent, the neutral room (a visit, the share card, a test). */
  living?: Living;
```

- before `const input`, `const effects = useRoomEffects(layout, tier, props.living);`, and the input becomes
  `const input = { layout, tier, weather, night, colour, hide: props.hide ?? null, effects };`.

Pass the store's living to every room view:
- `RoomCard.tsx`: `const { layout, tier, living } = useMyRoom();` and `living={living}` on `RoomView`;
- `CollapsedKipHeader.tsx`: the same, on its thumbnail's `RoomView`;
- `EditRoom.tsx`: `EditRoomProps` gains `living?: Living` (`import type { Living } from '../../lib/room/effects'`);
  `const effects = useRoomEffects(draft.layout, state.tier, props.living);`, the input gains `effects`, and its
  `RoomView` gets `living={props.living}`;
- `DecorateRoomScreen.tsx`: `<EditRoom … living={cosmetics.living} />`;
- `RoomSizesScreen.tsx`: its preview's `RoomView` gets `living={cosmetics.living}` (the same `cosmetics` it reads the
  layout from).

- [ ] **Step 6: The effect copy**

In `mobile/src/lib/room/roomCopy.ts`, `import type { EffectKind } from './iso/geometry';` and add to `ROOM_COPY` after
`flags`:

```ts
  /**
   * Pieces that do something (spec 2026-10-15 §8, F7, C5): what each one does, the living room's lines and the slots.
   * Never advice, never a health value (P3 ruling 18; roomCopy.test's guard reads every line here).
   */
  effects: {
    lines: {
      light: 'Keeps a warm pool of light on the floor after dark, so the room isn’t lost at night.',
      sound: 'Plays a quiet lo-fi loop while the room is open. Notes float up from it.',
      wander: 'Wanders the front row, and naps in a cat bed after 22:00.',
      clock: 'Shows your real local time.',
      tap: 'Squeaks when you tap it. That’s it.',
      awards: 'Holds one award for each badge level you earn.',
    } as Readonly<Record<EffectKind, string>>,
    short: { light: 'Glows after dark', sound: 'Plays music', wander: 'Wanders', clock: 'Tells the time', tap: 'Squeaks', awards: 'Shows your awards' } as Readonly<Record<EffectKind, string>>,
    plant: 'KIP looks a little happier with a plant in the room.',
    grew: (name: string, nights: number) => `The ${name} grew: ${nights} nights at your goal.`,
    sprout: (name: string) => `The ${name} is just starting out.`,
    pet: { nap: 'The cat’s napping.', wander: 'The cat’s wandering.', play: 'The cat’s playing.' } as Readonly<Record<'nap' | 'wander' | 'play', string>>,
    awardCount: (n: number) => (n === 0 ? 'No awards on it yet.' : n === 1 ? '1 award so far.' : `${n} awards so far.`),
    resting: (slots: number) => `Resting. This room runs ${slots} effects at a time.`,
    full: (slots: number) => `Effects ${slots} of ${slots}: store one to run another`,
    tag: (used: number, slots: number) => `Effects ${used} of ${slots}`,
    tagSpoken: (used: number, slots: number) => `${used} of ${slots} effects running`,
    doesSomething: 'does something in the room',
    fxTag: 'Does something',
    onlyForFun: 'Effects are only for fun. They never change your health data, scores or what KIP says.',
  },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/roomEffects.test.ts __tests__/lib/isoEffects.test.ts __tests__/lib/roomCopy.test.ts __tests__/lib/cosmeticsStore.test.tsx __tests__/components/RoomView.test.tsx __tests__/conventions __tests__/lib/isoRoom.test.ts __tests__/lib/roomSets.test.ts`
Expected: PASS (the Cottage and starter snapshots are unchanged: a room view without `living` draws the neutral room,
whose plants are the plain stage 5). Then the full mobile suite and the mobile typecheck (10).

- [ ] **Step 8: Commit**

```bash
git add mobile/src mobile/jest-mocks mobile/__tests__
git commit -m "feat(room): effect states for every piece, growing plants and the floor lamp's pool after dark"
```

---

### Task 5: Mobile: the clock's real time, the radio's notes and the trophy shelf's awards

Spec §8.2 (clock: "shows your real local time (hour and minute hands, updated each minute)"; radio: "notes float up";
trophy shelf: one award piece per badge level), §8.3 (the trophy shelf: "up to 8 awards, highest levels first") and
§3.7 (no recording per tick). Rulings 5, 7.

**Files:**
- Create: `mobile/src/lib/room/useClockMinute.ts`, `mobile/__tests__/lib/clockEffect.test.ts`
- Modify: `mobile/src/lib/room/items/art.ts` (the clock), `mobile/src/lib/room/iso/pieces/effectArt.ts` (the notes),
  `mobile/src/lib/room/iso/pieces/stand.ts`, `mobile/src/lib/room/iso/pieces/awards.ts`,
  `mobile/src/components/room/useRoomEffects.ts`, `mobile/__tests__/components/RoomView.test.tsx`

**Interfaces:**
- Consumes: Task 4's `ClockNow`, `roomEffects`, `RoomEffects.needsClock`, `withEffect` in stand.ts, `drawAwardsShelf`.
- Produces: `clockNow(d: Date): ClockNow`; `useClockMinute(active: boolean): ClockNow | null`;
  `handCells(cx, cy, len, deg): Array<[number, number]>` and `parseHhmm(s): { h: number; m: number } | null`
  (items/art.ts); `radioNotes(night: boolean): [Rects, Rects, Rects]` (effectArt.ts); `AWARD_COLOURS`,
  `awardLevels(effect?: string): number[]` (awards.ts); `useRoomEffects` reads the clock while a running clock or cat
  is in the room.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/clockEffect.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { handCells, parseHhmm } from '../../src/lib/room/items/art';
import { clearPieceCache, pieceLayers } from '../../src/lib/room/iso/art';
import { AWARD_COLOURS, awardLevels } from '../../src/lib/room/iso/pieces/awards';
import { clockNow, useClockMinute } from '../../src/lib/room/useClockMinute';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());
const WALL = { layer: 'wallR' as const, facing: 'L' as const, mirror: false };

describe('the clock (spec §8.2)', () => {
  it('reads the device\'s local hour and minute', () => {
    expect(clockNow(new Date(2026, 9, 24, 7, 5, 59))).toEqual({ hhmm: '07:05', hour: 7 });
    expect(parseHhmm('23:59')).toEqual({ h: 23, m: 59 });
    expect(parseHhmm('9:5')).toBeNull();
  });

  it('points its hands at the time: 03:00 has the hour hand right of the centre, 09:00 left', () => {
    expect(handCells(7, 7, 3, 90).every(([x, y]) => x >= 7 && y === 7)).toBe(true);
    expect(handCells(7, 7, 3, 270).every(([x, y]) => x <= 7 && y === 7)).toBe(true);
    expect(handCells(7, 7, 4, 0).map(([, y]) => y)).toEqual([7, 6, 5, 4, 3]);
  });

  it('running, it shows the real time and no loop; resting, it keeps its old turning hand (ruling 5)', () => {
    const at712 = pieceLayers('art.clock', CTX_DAY, { ...WALL, effect: 'live@07:12' })!;
    const at713 = pieceLayers('art.clock', CTX_DAY, { ...WALL, effect: 'live@07:13' })!;
    expect(at712.frames).toBeUndefined();
    expect(JSON.stringify(at712.base)).not.toBe(JSON.stringify(at713.base));
    expect(pieceLayers('art.clock', CTX_DAY, WALL)!.frames).toHaveLength(3);
  });

  it('useClockMinute ticks once a minute while active, and reads nothing while not', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useClockMinute(on), { initialProps: { on: true } });
    expect(result.current).toEqual({ hhmm: '07:12', hour: 7 });
    act(() => { jest.advanceTimersByTime(31_000); });
    expect(result.current).toEqual({ hhmm: '07:13', hour: 7 });
    rerender({ on: false });
    expect(result.current).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});

describe('the radio and the trophy shelf (spec §8.2, §8.3)', () => {
  it('a running radio floats three notes up over three frames, dimmed at night; a resting one has no loop', () => {
    const on = pieceLayers('item.radio', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false, effect: 'notes' })!;
    expect(on.frames).toHaveLength(3);
    expect(JSON.stringify(on.frames![0])).not.toBe(JSON.stringify(on.frames![1]));
    expect(pieceLayers('item.radio', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false })!.frames).toBeUndefined();
  });

  it('the shelf stands one award per level, highest first, at most 8, in the level\'s colour', () => {
    expect(awardLevels('a54321')).toEqual([5, 4, 3, 2, 1]);
    expect(awardLevels('a5555555555')).toHaveLength(8);
    expect(awardLevels(undefined)).toEqual([]);
    const two = pieceLayers('shelf.awards', CTX_DAY, { ...WALL, effect: 'a53' })!.base!;
    const none = pieceLayers('shelf.awards', CTX_DAY, WALL)!.base!;
    expect(two.length).toBeGreaterThan(none.length);
    expect(two.some(([, , , , c]) => c === AWARD_COLOURS[5])).toBe(true);
    expect(two.some(([, , , , c]) => c === AWARD_COLOURS[1])).toBe(false);
  });
});
```

In `mobile/__tests__/components/RoomView.test.tsx`, add:

```ts
it('a running clock rebuilds the room once a minute and never on a loop tick (ruling 7)', () => {
  jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'art.clock', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }] };
  const s = render(<RoomView {...PROPS} layout={layout} />);
  const before = picture.mock.calls.length;
  act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
  expect(picture.mock.calls.length - before).toBe(0);
  act(() => { jest.advanceTimersByTime(30_000); });
  expect(picture.mock.calls.length - before).toBeGreaterThan(0); // 07:13: the static room and its frames, once
  const after = picture.mock.calls.length;
  act(() => { jest.advanceTimersByTime(LOOP_MS * 3); });
  expect(picture.mock.calls.length - after).toBe(0);
  s.unmount();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/clockEffect.test.ts __tests__/components/RoomView.test.tsx`
Expected: FAIL (`useClockMinute` does not exist; `handCells` is not exported).

- [ ] **Step 3: Write the implementation**

Create `mobile/src/lib/room/useClockMinute.ts`:

```ts
import { useEffect, useState } from 'react';
import type { ClockNow } from './effects';

/** The device's local hour and minute (the one place the room reads the wall clock). */
export function clockNow(d: Date): ClockNow {
  const h = d.getHours();
  return { hhmm: `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, hour: h };
}

/**
 * The local time, refreshed just after each minute turns, while `active` (a running clock or cat is in the room); null
 * and no timer otherwise. The same minute keeps the same object, so nothing downstream re-renders for nothing.
 */
export function useClockMinute(active: boolean): ClockNow | null {
  const [now, setNow] = useState<ClockNow>(() => clockNow(new Date()));
  useEffect(() => {
    if (!active) return undefined;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      const next = clockNow(d);
      setNow((prev) => (prev.hhmm === next.hhmm ? prev : next));
      id = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    tick();
    return () => clearTimeout(id);
  }, [active]);
  return active ? now : null;
}
```

`mobile/src/components/room/useRoomEffects.ts` becomes:

```ts
import { useMemo } from 'react';
import { NEUTRAL_LIVING, livingKey, roomEffects, type Living, type RoomEffects } from '../../lib/room/effects';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { layoutKey } from '../../lib/room/layout';
import { useClockMinute } from '../../lib/room/useClockMinute';

/**
 * The room's effects for a view (spec §8): recomputed when the layout, the tier or the living room changes, and, while
 * a running clock or cat is in the room, when the minute turns (ruling 7: never on a tick).
 */
export function useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING): RoomEffects {
  const key = `${layoutKey(layout)}#${tier}#${livingKey(living)}`;
  const base = useMemo(() => roomEffects(layout, tier, living, null), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useClockMinute(base.needsClock);
  return useMemo(() => (now ? roomEffects(layout, tier, living, now) : base), [base, now]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

In `mobile/src/lib/room/items/art.ts`, export the helpers and teach the clock its time:

```ts
/** "07:12" → { h: 7, m: 12 }; anything else is null. */
export function parseHhmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

/** The cells of a clock hand from (cx, cy), `len` cells long, at `deg` clockwise from 12. */
export function handCells(cx: number, cy: number, len: number, deg: number): Array<[number, number]> {
  const a = (deg * Math.PI) / 180;
  const cells = new Map<string, [number, number]>();
  for (let k = 0; k <= len; k++) {
    const x = Math.round(cx + Math.sin(a) * k);
    const y = Math.round(cy - Math.cos(a) * k);
    cells.set(`${x},${y}`, [x, y]);
  }
  return [...cells.values()];
}
```

and `clock`'s draw becomes:

```ts
  draw: ({ ramp, night, effect }) => {
    const r: Rects = [];
    artFrame(r, CLOCK_FACE, ramp, ANCHOR);
    const [ox, oy] = originOf(CLOCK);
    // Running (spec §8.2): your real local time, hands moved once a minute; no loop (ruling 7).
    const live = effect?.startsWith('live@') ? parseHhmm(effect.slice(5)) : null;
    if (live) {
      for (const [x, y] of handCells(ox + 7, oy + 7, 3, (live.h % 12) * 30 + live.m / 2)) R(r, x, y, 1, 1, '#1F2937');
      for (const [x, y] of handCells(ox + 7, oy + 7, 4, live.m * 6)) R(r, x, y, 1, 1, '#1F2937');
      R(r, ox + 7, oy + 7, 1, 1, '#DC2626');
      return { base: r };
    }
    R(r, ox + 7, oy + 4, 1, 4, '#1F2937'); // the hour hand
    const HANDS: Array<[number, number, number, number]> = [[7, 3, 1, 5], [7, 7, 4, 1], [7, 7, 1, 4]];
    return {
      base: r,
      frames: three((k) => {
        const f: Rects = [];
        const [x, y, w, h] = HANDS[k]!;
        R(f, ox + x, oy + y, w, h, veiled('#1F2937', night));
        R(f, ox + 7, oy + 7, 1, 1, veiled('#DC2626', night));
        return f;
      }),
    };
  },
```

In `mobile/src/lib/room/iso/pieces/effectArt.ts`, add (with `import { spriteRows, three, veiled } from '../../items/shared';`,
`import type { SpriteRect } from '../../icons';` and `R` added to the paint import):

```ts
const NOTE: readonly SpriteRect[] = spriteRows(['.kk', '.k.', 'kk.'], { k: '#FDE68A' });
/** Three notes over the radio's top, each two cells higher a frame, round and round (C1, C6 `notes_on_radio`). */
const NOTE_AT: ReadonlyArray<readonly [number, number]> = [[3, -14], [-5, -19], [6, -24]];
export function radioNotes(night: boolean): [Rects, Rects, Rects] {
  return three((k) => {
    const f: Rects = [];
    NOTE_AT.forEach(([x, y], i) => {
      const rise = ((k + i) % 3) * 2;
      for (const [sx, sy, w, h, c] of NOTE) R(f, x + sx, y - rise + sy, w, h, veiled(c, night));
    });
    return f;
  });
}
```

In `mobile/src/lib/room/iso/pieces/stand.ts`, `withEffect` gains, before its last line:

```ts
  if (e === 'notes') return { ...l, frames: radioNotes(ctx.night) };
```

(`radioNotes` added to the `./effectArt` import).

In `mobile/src/lib/room/iso/pieces/awards.ts`, add the awards (with `import { R } from '../../paint';` and
`spriteRows` already imported):

```ts
/** Bronze, Silver, Gold, Diamond, Legend (lib/badges.ts TIER_NAMES). */
export const AWARD_COLOURS: Readonly<Record<number, string>> = { 1: '#B45309', 2: '#CBD5E1', 3: '#FACC15', 4: '#67E8F9', 5: '#C4B5FD' };
const CUP = spriteRows(['ccccc', '.ccc.', '..c..', '.ccc.'], { c: '#000000' });

/** The levels a shelf state carries ('a543' → [5, 4, 3]): highest first, at most 8 (spec §8.3). */
export function awardLevels(effect: string | undefined): number[] {
  if (!effect?.startsWith('a')) return [];
  return [...effect.slice(1)].map(Number).filter((n) => n >= 1 && n <= 5).slice(0, 8);
}
```

and the shelf's draw becomes:

```ts
  draw: (_ctx, o) => {
    const r: Rects = [];
    drawAwardsShelf(r, o.layer);
    // One cup a level, 0.45 tiles apart along the plank's top (isox.py `trophy_shelf`).
    awardLevels(o.effect).forEach((lv, k) => {
      const a = 0.25 + k * 0.45;
      const [x, y] = (o.layer === 'wallL' ? LOCAL(0.18, a, 2) : LOCAL(a, 0.18, 2)).map(Math.round) as [number, number];
      for (const [sx, sy, w, h] of CUP) R(r, x - 2 + sx, y - 4 + sy, w, h, AWARD_COLOURS[lv]!);
    });
    return { base: r };
  },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/clockEffect.test.ts __tests__/components/RoomView.test.tsx __tests__/lib/roomArtWalls.test.ts __tests__/lib/isoPieces.test.ts __tests__/lib/shopPieces.test.ts`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(room): the clock shows your real time, the radio's notes and the trophy shelf's awards"
```

---

### Task 6: Mobile: the cat's three states, and its nap on the cat bed after 22:00

Spec §8.2 (the cat: "walks the front row, then naps in a cat bed (if placed) after 22:00 local; energy follows steps"),
§8.3 ("under 30% naps, 30–99% wanders, at the goal plays; always naps after 22:00"; "a low day stays cosy … the cat curls
up"). Rulings 5, 6, 10.

**Files:**
- Modify: `mobile/src/lib/room/items/living.ts`, `mobile/src/lib/room/iso/room.ts`,
  `mobile/src/components/room/useRoomEffects.ts`, `mobile/src/components/room/RoomView.tsx`,
  `mobile/src/components/edit/EditRoom.tsx`, `mobile/__tests__/lib/livingPieces.test.ts`,
  `mobile/__tests__/lib/isoRoom.test.ts`

**Interfaces:**
- Consumes: Task 4's `RoomEffects.states` / `napOn`, `useRoomEffects`; Task 1's `TABBY_SIT`, `TAIL`, `loopOf`, `GINGER`.
- Produces: `TABBY_NAP`, `ZZ`, `PAW` (living.ts); the tabby draws `sit` / `play` / `nap` from `ctx.effect`;
  `drawIsoStatic` draws a napping cat on its bed (right after the bed, at the bed's anchor, with the bed's depth);
  `useRoomEffects(layout, tier, living?, opts?: { editing?: boolean })` (editing: no nap on the bed, so a tap or a
  drag in the editor finds the cat where it is placed); `RoomViewProps.editing?: boolean`.

- [ ] **Step 1: Write the failing tests**

In `mobile/__tests__/lib/livingPieces.test.ts`, add:

```ts
it('the cat plays with a paw and its tail, and naps curled up with drifting z\'s (spec §8.3, ruling 10)', () => {
  const at = (effect?: string) => pieceLayers('pet.tabby', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false, ...(effect ? { effect } : {}) })!;
  const sit = at();
  const play = at('play');
  const nap = at('nap');
  expect(JSON.stringify(play.frames)).not.toBe(JSON.stringify(sit.frames));
  expect(opaqueBounds(nap.base!)!.h).toBeLessThan(opaqueBounds(sit.base!)!.h);
  expect(JSON.stringify(nap.frames![0])).not.toBe(JSON.stringify(nap.frames![2]));
  expect(JSON.stringify(at('wander').base)).toBe(JSON.stringify(sit.base)); // still, a wandering cat sits
});
```

In `mobile/__tests__/lib/isoRoom.test.ts`, add (with `roomEffects` from `../../src/lib/room/effects`, `projOf` and
`isoGrid` from `../../src/lib/room/iso/grid` imported):

```ts
it('draws a napping cat on its bed, right after the bed, and tapping the bed there finds the cat (spec §8.2)', () => {
  const pieces = [...starterLayout().pieces,
    { id: 'p1', item: 'pet.tabby', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p2', item: 'pet.bed', layer: 'floor' as const, x: 5, y: 5, facing: 'L' as const, mirror: false }];
  const layout = { ...starterLayout(), pieces };
  const effects = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'play', awards: [] }, { hhmm: '23:00', hour: 23 });
  const s = drawIsoStatic({ layout, tier: 1, weather: 'clear', night: true, colour: 'coral', effects });
  const placed = [...s.behind, ...s.ahead];
  const bed = placed.findIndex((pp) => pp.p.id === 'p2');
  expect(placed[bed + 1]!.p.id).toBe('p1');
  expect(placed[bed + 1]!.at).toEqual(placed[bed]!.at);
  expect(placed[bed + 1]!.o.effect).toBe('nap');
  const [x, y] = projOf(isoGrid(1))(5.5, 5.5, 4).map(Math.round);
  expect(pieceAt(s.hits, x, y - 2)).toBe('p1');
});
```

(`pieceAt` and `drawIsoStatic` are already imported by that file; if not, add them from `../../src/lib/room/iso/room`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/livingPieces.test.ts __tests__/lib/isoRoom.test.ts`
Expected: FAIL (the cat draws the same in every state; the cat stays on its own tile).

- [ ] **Step 3: Write the implementation**

In `mobile/src/lib/room/items/living.ts`, add the two states and replace `tabby`:

```ts
export const TABBY_NAP: SpriteRect[] = spriteRows([
  '....oooo....',
  '..oooooooo..',
  '.ooSoSoooooo',
  'oooSoSooeeoo',
  'oooooooooooo',
  '.oooooooooo.',
], GINGER);
const NAP_FOOT = 6;
/** One "z" drifting up from the curled cat. */
export const ZZ: readonly (readonly SpriteRect[])[] = [
  [[10, -3, 2, 1, '#E5E7EB'], [11, -2, 1, 1, '#E5E7EB'], [10, -1, 2, 1, '#E5E7EB']],
  [[11, -6, 2, 1, '#E5E7EB'], [12, -5, 1, 1, '#E5E7EB'], [11, -4, 2, 1, '#E5E7EB']],
  [[12, -9, 2, 1, '#E5E7EB'], [13, -8, 1, 1, '#E5E7EB'], [12, -7, 2, 1, '#E5E7EB']],
];
/** A paw batting at the air (isox.py `cat_play`). */
export const PAW: readonly (readonly SpriteRect[])[] = [
  [[0, 8, 1, 1, GINGER.o]],
  [[0, 6, 1, 2, GINGER.o]],
  [[0, 5, 1, 1, GINGER.o], [1, 6, 1, 1, GINGER.o]],
];

/** sit (still, wandering or resting), play or nap: the state is the cat's effect (Task 4's roomEffects). */
const tabby: ItemArt = {
  id: 'pet.tabby', slot: 'pet', frames: 3,
  draw: ({ ramp, night, effect }) => {
    const r: Rects = [];
    if (effect === 'nap') {
      standing(r, TABBY_NAP, 0, 0, NAP_FOOT, ramp);
      return { base: r, frames: three((k) => loopOf(ZZ[k]!, night)) };
    }
    standing(r, TABBY_SIT, 0, 0, SIT_FOOT, ramp);
    const loop = (k: 0 | 1 | 2) => (effect === 'play' ? [...PAW[k]!, ...TAIL[(k + 1) % 3]!] : TAIL[k]!);
    return { base: r, frames: three((k) => loopOf(loop(k), night)) };
  },
};
```

In `mobile/src/lib/room/iso/room.ts` `drawIsoStatic`:
- after `const byId = …`:

```ts
  // A napping cat lies on its bed (spec §8.2): drawn right after the bed, at the bed's corner, with the bed's depth.
  const napOn = input.effects?.napOn ?? new Map<string, string>();
  const catOnBed = new Map([...napOn].filter(([cat, bed]) => byId.has(cat) && byId.has(bed)).map(([cat, bed]) => [bed, cat]));
  const napping = new Set(catOnBed.values());
```

- `put` takes an optional anchor and puts the napping cat after its bed:

```ts
  const put = (p: Placement, at0?: [number, number]) => {
    const at = at0 ?? anchorOf(P, p, byId);
    const state = input.effects?.states.get(p.id);
    const o: IsoArtOpts = { layer: p.layer, facing: p.facing, mirror: p.mirror, ...(state ? { effect: state } : {}) };
    const l = at ? pieceLayers(p.item, ctx, o) : null;
    if (!at || !l) return;
    const base = moveRects(l.base ?? [], at[0], at[1]);
    target.push(...base);
    if (l.emissive) emissive.push(...moveRects(l.emissive, at[0], at[1]));
    list.push({ p, at, o });
    const b = opaqueBounds(base);
    if (b) hits.push({ id: p.id, box: b, rects: base });
    for (const c of childrenOf(visibleLayout, p.id)) put(c);
    const cat = catOnBed.get(p.id);
    if (cat) put(byId.get(cat)!, at);
  };
```

- the floor list leaves the napping cats out: `const floor = visible.filter((p) => p.layer === 'floor' && !napping.has(p.id));`

In `mobile/src/components/room/useRoomEffects.ts`, the signature becomes
`useRoomEffects(layout: RoomLayout, tier: Tier, living: Living = NEUTRAL_LIVING, opts: { editing?: boolean } = {})`,
and its last line:

```ts
  return useMemo(() => {
    const e = now ? roomEffects(layout, tier, living, now) : base;
    // In the editor the cat stays where it is placed, curled up if it is night, so a tap or a drag finds it there.
    return opts.editing && e.napOn.size ? { ...e, napOn: new Map<string, string>() } : e;
  }, [base, now, opts.editing]); // eslint-disable-line react-hooks/exhaustive-deps
```

In `RoomView.tsx`, `RoomViewProps` gains `editing?: boolean` ("the editor: a napping cat stays on its own tile") and the
hook call becomes `useRoomEffects(layout, tier, props.living, { editing: props.editing })`. In `EditRoom.tsx`, its own
call passes `{ editing: true }` and its `RoomView` gets `editing`.

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/livingPieces.test.ts __tests__/lib/isoRoom.test.ts __tests__/lib/roomEffects.test.ts __tests__/components/EditRoom.test.tsx __tests__/components/RoomView.test.tsx`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(room): the ginger cat plays, sits or naps, and sleeps in its bed after 22:00"
```

---

### Task 7: Mobile: the editor's effect slots, the drawer's Effects tab and the effect line on the toolbar

Spec §5.3 ("Invalid: … 'Effects 3 of 3' (P3)"), §5.4 (the drawer's tabs: "**Effects** (P3)"), §8.1 (effect slots;
"Placing one more effect piece is blocked with 'Effects 3 of 3: store one to run another'"; inert extras never fail)
and C6 ("Effects 3 of 5"). Rulings 4, 5, 21.

**Files:**
- Modify: `mobile/src/lib/room/edit/targets.ts`, `mobile/src/lib/room/edit/editor.ts`,
  `mobile/src/lib/room/edit/drawer.ts`, `mobile/src/lib/room/edit/labels.ts`, `mobile/src/lib/room/roomCopy.ts`,
  `mobile/src/components/edit/EditToolbar.tsx`, `mobile/src/components/edit/InventoryDrawer.tsx`,
  `mobile/src/screens/DecorateRoomScreen.tsx`
- Test: `mobile/__tests__/lib/editor.test.ts`, `mobile/__tests__/lib/editDrawer.test.ts`,
  `mobile/__tests__/lib/editLabels.test.ts`, `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's `effectPieces`, `effectSlotsFor`, `effectsRaised`, `runningEffects`; Task 4's
  `ROOM_COPY.effects`.
- Produces: `Refused.reason` gains `'effects'` and `Refused.slots?: number`; `refusal(…, adding = true)` refuses an
  effect piece when the room already has `slots` or more; Apply set refuses a set that raises the effects;
  `DrawerTab` gains `'effects'`; `Tools.effect: { kind: EffectKind; running: boolean } | null` and `Tools.slots`;
  `toolLine(…).effect: string | null`; the screen's `edit-effects` line ("Effects 3 of 5").

- [ ] **Step 1: Write the failing tests**

In `mobile/__tests__/lib/editor.test.ts`, add (the file's `COUNTS`, `start`, `run` and `piece` helpers are reused):

```ts
describe('effect slots (spec §5.3, §8.1, P3 ruling 4, Review Focus 1)', () => {
  const clock = (id: string, layer: 'wallL' | 'wallR', x: number): Placement => ({ id, item: 'art.clock', layer, x, y: 0, facing: 'L', mirror: false });
  const three = { ...starterLayout(), pieces: [...starterLayout().pieces, clock('p1', 'wallR', 0), clock('p2', 'wallR', 10), clock('p3', 'wallL', 0)] };
  const counts = { ...COUNTS, 'art.clock': 5, 'corner.floorlamp': 1 };

  it('refuses one more effect piece with "Effects 3 of 3: store one to run another", whatever the way in', () => {
    const s = start({ layout: three, counts });
    const refused = { ok: false, refused: { reason: 'effects', slots: 3 } };
    expect(run(s, { type: 'place', item: 'corner.floorlamp' }).outcome).toMatchObject(refused);
    expect(run(s, { type: 'select', id: 'p1' }, { type: 'another' }).outcome).toMatchObject(refused);
    expect(run(s, { type: 'drop', id: null, item: 'art.clock', target: { layer: 'wallL', x: 9, y: 0 } }).outcome).toMatchObject(refused);
    expect(outcomeText(run(s, { type: 'place', item: 'corner.floorlamp' }))).toEqual({ kind: 'reason', text: 'Effects 3 of 3: store one to run another' });
    expect(run(s, { type: 'place', item: 'plant.fern' }).outcome).toMatchObject({ ok: true }); // a plant takes no slot
  });

  it('a room with more than its slots still moves, flips and stores its pieces, and refuses only adding', () => {
    const four = { ...three, pieces: [...three.pieces, clock('p4', 'wallL', 9)] };
    const s = start({ layout: four, counts });
    const moved = run(s, { type: 'select', id: 'p4' }, { type: 'nudge', dir: 'backRight' });
    expect([moved.outcome?.ok, piece(moved, 'p4')!.x]).toEqual([true, 8]);
    expect(run(s, { type: 'select', id: 'p1' }, { type: 'flip' }).outcome?.ok).toBe(true);
    expect(run(s, { type: 'place', item: 'corner.floorlamp' }).outcome).toMatchObject({ ok: false, refused: { reason: 'effects' } });
    const stored = run(s, { type: 'select', id: 'p4' }, { type: 'store' }, { type: 'select', id: 'p3' }, { type: 'store' });
    expect(run(stored, { type: 'place', item: 'corner.floorlamp' }).outcome?.ok).toBe(true); // 2 of 3 now
  });

  it('the toolbar says what a piece does, or that it rests', () => {
    const four = { ...three, pieces: [...three.pieces, clock('p4', 'wallL', 9)] };
    const s = start({ layout: four, counts });
    expect(selectedTools(run(s, { type: 'select', id: 'p1' }))!.effect).toEqual({ kind: 'clock', running: true });
    expect(selectedTools(run(s, { type: 'select', id: 'p4' }))!.effect).toEqual({ kind: 'clock', running: false });
    expect(toolLine(four, selectedTools(run(s, { type: 'select', id: 'p4' }))!).effect).toBe('Resting. This room runs 3 effects at a time.');
    expect(toolLine(four, selectedTools(run(s, { type: 'select', id: 'p1' }))!).effect).toBe('Tells the time');
    expect(selectedTools(run(s, { type: 'select', id: 'plant' }))!.effect).toBeNull();
  });
});
```

with `toolLine` added to the `../../src/lib/room/edit/labels` import.

In `mobile/__tests__/lib/editDrawer.test.ts`:
- the tabs test's first line becomes
  `expect(drawerTabs(start())).toEqual(['all', 'floor', 'wall', 'onTop', 'funny', 'effects', 'room', 'kip', 'sets']);`
- add:

```ts
it('the Effects tab lists the effect pieces you own, each tagged and read as doing something (spec §5.4, ruling 21)', () => {
  const s = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: { ...counts, 'art.clock': 1, 'item.radio': 1 }, version: 1, newIds: [] });
  const tiles = pieceTiles(s, 'effects');
  expect(tiles.map((t) => t.item).sort()).toEqual(['art.clock', 'item.radio', 'shelf.awards']);
  const radio = tiles.find((t) => t.item === 'item.radio')!;
  expect([radio.tag, radio.label]).toEqual(['Does something', 'Old radio, 1 in inventory, does something in the room']);
  expect(pieceTiles(s, 'all').find((t) => t.item === 'plant.fern')!.tag).toBeNull();
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`, after its first `edit-count` assertions (line 81–82), add:

```ts
  expect(s.getByTestId('edit-effects')).toHaveTextContent('Effects 0 of 3');
  expect(s.getByTestId('edit-effects').props.accessibilityLabel).toBe('0 of 3 effects running');
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/editor.test.ts __tests__/lib/editDrawer.test.ts __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (the fourth effect piece is placed; there is no Effects tab).

- [ ] **Step 3: Write the implementation**

In `mobile/src/lib/room/edit/targets.ts`:
- extend the geometry import with `effectPieces, effectSlotsFor`;
- `Refused` becomes:

```ts
export interface Refused {
  /** `none` and `sameDesk`: Replace desk with a desk you have none left of, or the one already there (UI-OUTCOMES).
   * `effects`: one more effect piece than the room runs (spec §8.1), with the room's slots. */
  reason: BadReason | 'layer' | 'full' | 'none' | 'sameDesk' | 'effects';
  with?: string;
  slots?: number;
}
```

- in `refusal`, after the `full` line:

```ts
  // One more effect piece than the room runs is refused when it is added (spec §8.1); moving one never is.
  const slots = effectSlotsFor(tier);
  if (adding && iso.effect && effectPieces(layout, GEOMETRY_DEPS).length >= slots) return { reason: 'effects', slots };
```

In `mobile/src/lib/room/edit/editor.ts`:
- `DrawerTab` becomes `'all' | 'floor' | 'wall' | 'onTop' | 'funny' | 'effects' | 'new' | 'room' | 'kip' | 'sets'`;
- extend the geometry import with `effectSlotsFor, effectsRaised, runningEffects, type EffectKind`;
- `Tools` gains:

```ts
  /** What the piece does and whether it runs (spec §8.1): null for a piece with no effect. */
  effect: { kind: EffectKind; running: boolean } | null;
  slots: number;
```

- `selectedTools`' result gains:

```ts
    effect: iso.effect ? { kind: iso.effect, running: runningEffects(s.draft.layout, s.tier, GEOMETRY_DEPS).has(piece.id) } : null,
    slots: effectSlotsFor(s.tier),
```

- in `applySet`, after `if (!placed) return refuse(s, { reason: 'outside' }, null);`:

```ts
      const next = { ...layout, pieces: placed.pieces };
      if (effectsRaised(layout, next, s.tier, GEOMETRY_DEPS)) return refuse(s, { reason: 'effects', slots: effectSlotsFor(s.tier) }, null);
```

In `mobile/src/lib/room/roomCopy.ts`, `ROOM_COPY.drawer.tabs` gains `effects: 'Effects'` (after `funny`).

In `mobile/src/lib/room/edit/labels.ts`:
- `reasonText` gains, before `case 'layer'`:

```ts
    case 'effects': return ROOM_COPY.effects.full(r.slots ?? 0);
```

- `toolLine` returns an `effect` line too:

```ts
/** The toolbar's line for the selected piece: "Desk lamp · on the desk", "×2 in inventory", and what it does (§8.1). */
export function toolLine(layout: RoomLayout, t: Tools): { text: string; inventory: string; effect: string | null; spoken: string } {
  const name = itemName(t.piece.item);
  const where = whereText(layout, t.piece);
  const on = t.children ? ` · ${E.onIt(t.children)}` : '';
  const effect = t.effect ? (t.effect.running ? ROOM_COPY.effects.short[t.effect.kind] : ROOM_COPY.effects.resting(t.slots)) : null;
  return {
    text: `${name} · ${where}${on}`,
    inventory: E.inventory(t.inventory),
    effect,
    spoken: `${spokenName(t.piece.item)}, ${where}${t.children ? `, ${E.onIt(t.children)}` : ''}. ${E.inventorySpoken(t.inventory)}${effect ? `. ${effect}` : ''}`,
  };
}
```

In `mobile/src/lib/room/edit/drawer.ts`:
- `drawerTabs` returns
  `['all', 'floor', 'wall', 'onTop', 'funny', 'effects', ...(s.newIds.length ? (['new'] as const) : []), 'room', 'kip', 'sets']`;
- `inTab` gains `case 'effects': return !!iso.effect;`;
- in `pieceTiles`, the tile's `tag` and `label` become:

```ts
      const fx = !!i.iso!.effect;
      return {
        key: i.id, item: i.id, name: itemName(i.id), count, isNew, allPlaced: count === 0, locked: false,
        tag: fx ? ROOM_COPY.effects.fxTag : null,
        label: `${D.tile.piece(spokenName(i.id), count, isNew)}${fx ? `, ${ROOM_COPY.effects.doesSomething}` : ''}`,
        selected: s.picked === i.id,
      };
```

In `mobile/src/components/edit/InventoryDrawer.tsx`, `PIECE_TABS` gains `'effects'`.

In `mobile/src/components/edit/EditToolbar.tsx`, under the `edit-tool-line` and inventory texts:

```tsx
          {line.effect ? <Text testID="edit-tool-effect" className="text-caption text-muted-foreground">{line.effect}</Text> : null}
```

In `mobile/src/screens/DecorateRoomScreen.tsx`, `import { GEOMETRY_DEPS } from '../lib/room/catalogue';` and
`import { effectSlotsFor, runningEffects } from '../lib/room/iso/geometry';`; replace the `edit-count` text with a row
that also says the effects (C6's tag, ruling 21):

```tsx
      <View className="flex-row flex-wrap items-center gap-x-2 px-4 pb-2">
        <Text testID="edit-count" accessibilityLabel={ROOM_COPY.edit.countLabel(n, cosmetics.cap)} className="text-caption text-muted-foreground">
          {ROOM_COPY.edit.count(n, cosmetics.cap)}
        </Text>
        <Text testID="edit-effects" accessibilityLabel={ROOM_COPY.effects.tagSpoken(used, slots)} className="text-caption text-muted-foreground">
          {ROOM_COPY.effects.tag(used, slots)}
        </Text>
      </View>
```

with, beside `const n = …`:

```ts
  const slots = effectSlotsFor(state.tier);
  const used = runningEffects(state.draft.layout, state.tier, GEOMETRY_DEPS).size;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/editor.test.ts __tests__/lib/editDrawer.test.ts __tests__/lib/editTargets.test.ts __tests__/lib/editLabels.test.ts __tests__/lib/editDrag.test.ts __tests__/screens/DecorateRoomScreen.test.tsx __tests__/components/EditRoom.test.tsx`
Expected: PASS once `mobile/__tests__/lib/editLabels.test.ts` line 37's expected object (the wall plank's whole
`toolLine`) gains `effect: null` (`{ text: 'Wall plank · on the wall · 1 on it', inventory: '×0 in inventory', effect: null, spoken: … }`).
Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(room): effect slots in the editor, an Effects tab and what each piece does on the toolbar"
```

---

### Task 8: Mobile: the shop's Effects tab and effect lines, and the effect slots on Room sizes

Spec §6.6 (the shop's tabs "All, Effects, Floor, Wall, On top"; "Pieces with effects show 'does something in the room'";
the piece sheet's "effect line"), §7 (the Effects column; "+1 row each side · +20 pieces · +2 effect slots"), and P2
plan rulings 13 and 14 (deferred to P3). Rulings 19, 20.

**Files:**
- Modify: `mobile/src/lib/coins/shop.ts`, `mobile/src/lib/coins/sizes.ts`, `mobile/src/lib/room/roomCopy.ts`,
  `mobile/src/screens/CoinShopScreen.tsx`, `mobile/src/screens/RoomSizesScreen.tsx`
- Test: `mobile/__tests__/lib/coinShop.test.ts`, `mobile/__tests__/lib/coinSizes.test.ts`,
  `mobile/__tests__/screens/CoinShopScreen.test.tsx`, `mobile/__tests__/screens/RoomSizesScreen.test.tsx`

**Interfaces:**
- Consumes: Task 1's `TIERS[t].effects`, `effectSlotsFor`; Task 4's `ROOM_COPY.effects`.
- Produces: `ShopTab` gains `'effects'`, `SHOP_TABS = ['all', 'effects', 'floor', 'wall', 'onTop']`;
  `ShopTile.effect: EffectKind | null`; `PieceSheet.effect: string | null`; `ROOM_COPY.shop.tabs.effects`;
  `ROOM_COPY.sizes.pieces(cap, effects, window)` / `piecesSpoken(cap, effects, window)`;
  `ROOM_COPY.sizes.grewMore(pieces, effects, window)` / `grewMoreSpoken(pieces, effects, window)`.

- [ ] **Step 1: Write the failing tests**

In `mobile/__tests__/lib/coinShop.test.ts`, add:

```ts
it('the Effects tab lists the pieces that do something, and says so on the tile and the sheet (spec §6.6, ruling 19)', () => {
  const shop: ShopDTO = { ...SHOP, items: [...SHOP.items, { itemId: 'corner.floorlamp', price: 120 }, { itemId: 'pet.tabby', price: 180 }] };
  const counts = { ...STARTER_COUNTS, 'corner.floorlamp': 1 };
  expect(shopTiles(shop, counts, 'effects').map((t) => t.itemId)).toEqual(['item.radio', 'corner.floorlamp', 'pet.tabby']);
  const radio = shopTiles(shop, counts, 'all').find((t) => t.itemId === 'item.radio')!;
  expect([radio.effect, radio.label]).toEqual(['sound', 'Old radio, 150 coins, does something in the room']);
  expect(shopTiles(shop, counts, 'all').find((t) => t.itemId === 'item.mug')!.effect).toBeNull();
  expect(pieceSheet('item.radio', 150, 360, counts).effect).toBe('Plays a quiet lo-fi loop while the room is open. Notes float up from it.');
  expect(pieceSheet('item.mug', 25, 360, counts).effect).toBeNull();
  expect(SHOP_TABS).toEqual(['all', 'effects', 'floor', 'wall', 'onTop']);
});
```

with `SHOP_TABS` added to the `../../src/lib/coins/shop` import.

In `mobile/__tests__/lib/coinSizes.test.ts`, the first test's expectations become:

```ts
  expect([starter!.name, starter!.size, starter!.pieces, starter!.status]).toEqual(['Starter', '7 × 7', '40 pieces · 3 effects', 'yours']);
```

and

```ts
  expect([loft!.status, loft!.pieces, loft!.piecesSpoken, loft!.coins, loft!.badge]).toEqual([
    'later', '90 pieces · 8 effects · second window', '90 pieces, 8 effects, second window',
    { title: '1,500 coins', progress: '360 of 1,500', met: false }, { title: 'Sleep goal badge, level 3', progress: 'level 2 now', met: false },
  ]);
```

and add:

```ts
it('the unlock card counts the new effect slots (spec §7, C2, ruling 20)', () => {
  expect(ROOM_COPY.sizes.grewMore(20, 2, false)).toBe('+1 row each side · +20 pieces · +2 effect slots');
  expect(ROOM_COPY.sizes.grewMoreSpoken(30, 3, true)).toBe('One more row each side, 30 more pieces, 3 more effect slots, and a second window');
});
```

with `import { ROOM_COPY } from '../../src/lib/room/roomCopy';` at the top.

In `mobile/__tests__/screens/RoomSizesScreen.test.tsx`, line 295's expectation becomes
`'One more row each side, 30 more pieces, 3 more effect slots, and a second window'`.

In `mobile/__tests__/screens/CoinShopScreen.test.tsx`, the first test's radio label becomes
`'Old radio, 150 coins, does something in the room'`, and add (the file's `open()` helper renders the screen with the
shop, wallet and cosmetics mocks resolved):

```ts
it('the Effects tab shows only pieces that do something, and the sheet says what (ruling 19)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('shop-tab-effects'));
  expect(s.queryByTestId('shop-tile-item.mug')).toBeNull();
  fireEvent.press(s.getByTestId('shop-tile-item.radio'));
  await act(async () => undefined);
  expect(s.getByTestId('shop-sheet-effect')).toHaveTextContent('Plays a quiet lo-fi loop while the room is open.');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinShop.test.ts __tests__/lib/coinSizes.test.ts`
Expected: FAIL (no `'effects'` tab; the size rows say "40 pieces").

- [ ] **Step 3: Write the implementation**

In `mobile/src/lib/coins/shop.ts`:

```ts
import type { EffectKind } from '../room/iso/geometry';

export type ShopTab = 'all' | 'effects' | 'floor' | 'wall' | 'onTop';
/** Spec §6.6's order (P3 ruling 19). */
export const SHOP_TABS: readonly ShopTab[] = ['all', 'effects', 'floor', 'wall', 'onTop'];
```

`ShopTile` gains `effect: EffectKind | null;` and `PieceSheet` gains `effect: string | null;`. In `shopTiles`, the filter
becomes `return tab === 'all' || (tab === 'effects' ? !!iso.effect : iso.layers.includes(tab));` and the map:

```ts
    .map(({ itemId, price }): ShopTile => {
      const item = catalogueItem(itemId)!;
      const owned = counts[itemId] ?? 0;
      const locked = lockedFor(item.unlock, owned);
      const effect = item.iso!.effect ?? null;
      const label = locked ? S.tileLocked(spokenName(itemId), unlockSpoken(item.unlock)) : S.tile(spokenName(itemId), coinCount(price), owned);
      return {
        itemId, name: itemName(itemId), price, owned, locked, lockLine: locked ? unlockLine(item.unlock) : null,
        label: effect ? `${label}, ${ROOM_COPY.effects.doesSomething}` : label,
        featured: featured.has(itemId), effect,
      };
    })
```

and `pieceSheet`'s result gains `effect: item.iso?.effect ? ROOM_COPY.effects.lines[item.iso.effect] : null,`.

In `mobile/src/lib/room/roomCopy.ts`:
- `ROOM_COPY.shop.tabs` gains `effects: 'Effects'`;
- `ROOM_COPY.sizes.pieces` / `piecesSpoken` / `grewMore` / `grewMoreSpoken` become:

```ts
    pieces: (cap: number, effects: number, window: boolean) => `${cap} pieces · ${effects} effects${window ? ' · second window' : ''}`,
    piecesSpoken: (cap: number, effects: number, window: boolean) => `${cap} pieces, ${effects} effects${window ? ', second window' : ''}`,
```

```ts
    grewMore: (pieces: number, effects: number, window: boolean) =>
      `+1 row each side · +${pieces} pieces · +${effects} effect slots${window ? ' · a second window' : ''}`,
    grewMoreSpoken: (pieces: number, effects: number, window: boolean) =>
      `One more row each side, ${pieces} more pieces, ${effects} more effect slots${window ? ', and a second window' : ''}`,
```

and the `sizes` comment's "Effect slots join in P3 (ruling 14)" becomes "with each size's effect slots (P3 ruling 20)".

In `mobile/src/lib/coins/sizes.ts`, the row builds `const { n, cap, effects } = TIERS[t];` and
`pieces: Z.pieces(cap, effects, t === 3), piecesSpoken: Z.piecesSpoken(cap, effects, t === 3),`; the header comment's
"effect slots join in P3 (ruling 14)" becomes "with their effect slots (P3 ruling 20)".

In `mobile/src/screens/RoomSizesScreen.tsx`, beside `added`:

```ts
  const addedEffects = grown && grown.tier !== 1 ? TIERS[grown.tier].effects - TIERS[(grown.tier - 1) as Tier].effects : 0;
```

and the card's line reads `Z.grewMoreSpoken(added, addedEffects, grown.tier === 3)` /
`Z.grewMore(added, addedEffects, grown.tier === 3)`.

In `mobile/src/screens/CoinShopScreen.tsx`:
- in each tile, after the name `Text`:

```tsx
                    {t.effect ? <Text className="text-center text-fine text-muted-foreground" numberOfLines={2}>{ROOM_COPY.effects.doesSomething}</Text> : null}
```

- in the sheet, after the where line:

```tsx
          {sheet.effect ? <Text testID="shop-sheet-effect" className="text-body">{sheet.effect}</Text> : null}
```

(`ROOM_COPY` is already imported there as the source of `S`; import it by name if only `S` is.)

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/coinShop.test.ts __tests__/lib/coinSizes.test.ts __tests__/screens/CoinShopScreen.test.tsx __tests__/screens/RoomSizesScreen.test.tsx __tests__/lib/roomCopy.test.ts __tests__/conventions`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(coins): an Effects tab and effect lines in the shop, and effect slots on Room sizes"
```

---

### Task 9: Mobile: movers in `RoomView`: per-piece pictures in depth order, KIP and pieces at a tile, loops clipped by KIP

Spec §3.4 ("Movers (KIP and the pet) … are inserted into the sorted list at the tile they stand on, so a bookcase in
front of KIP hides KIP's legs"), §3.7 (per-piece pictures; "With movers, the frame draws the cached piece pictures in
sorted order with the movers inserted at their depth. This is a list of picture draws, not a rebuild"; the budget) and
P1 ruling 8 ("Per-piece `SkPicture`s and mover lists come with P3's walking"). Rulings 7, 11, 12, 25.

**Files:**
- Create: `mobile/src/lib/room/iso/movers.ts`, `mobile/src/components/room/pictureCache.ts`,
  `mobile/__tests__/lib/isoMovers.test.ts`, `mobile/__tests__/components/RoomViewMovers.test.tsx`
- Modify: `mobile/src/lib/room/iso/room.ts`, `mobile/src/lib/room/layout.ts`, `mobile/src/components/room/pictures.ts`,
  `mobile/src/components/room/RoomView.tsx`, `mobile/jest-mocks/skia.js`, `mobile/jest-mocks/RoomView.js`,
  `mobile/__tests__/components/RoomView.test.tsx`, `mobile/__tests__/perf/isoBuild.test.ts`

**Interfaces:**
- Consumes: P1's `depthOrder`, `DepthBox`, `drawIsoStatic`, `drawKipLayer`, `drawIsoFramesEach`, `pieceAt`, `record`,
  `isoCrop`; Task 4's `useRoomEffects`, `RoomEffects`; Task 6's napping cat inside its bed's run.
- Produces:
  - `iso/room.ts`: `interface IsoRun { id: string; key: string; box: DepthBox; rects: Rects }`; `IsoStatic.under`,
    `IsoStatic.runs`, `IsoStatic.deskId: string | null`, `IsoStatic.seat: [number, number] | null`;
    `IsoStaticInput.movers?: readonly string[]` (placement ids left out of the picture, in `isoRoomKey`);
    `RoomKip.flip?: boolean` (in `kipLayerKey`);
  - `iso/movers.ts`: `type Tile`, `KIP_MOVER = '@kip'`, `MOVER_PREFIX = '@m:'`, `interface MoverAt { key; depth }`,
    `moverOrder(runs, movers, seatEdge): string[]`, `kipTileCell(g, pos): [number, number]`,
    `pieceTileCell(g, pos): [number, number]`, `sameTile(a, b): boolean`;
  - `pictureCache.ts`: `class PictureLru` (`get(key, make)`, `clear()`, `size`), `class RunPictures` (`take`, `keep`,
    `clear`);
  - `layout.ts`: `pieceKey` exported;
  - `RoomView`: props `kipMover?: KipMover | null`, `pieceMovers?: readonly PieceMover[]`, `ref?: Ref<RoomViewHandle>`;
    `interface KipMover { pos: readonly [number, number]; depth: Tile; flip: boolean; pose: KipPose; moving: boolean; sway: boolean }`;
    `interface PieceMover { id: string; pos: readonly [number, number]; depth: Tile; flip: boolean }`;
    `interface RoomViewHandle { pieceAtPoint(x: number, y: number): string | null }` (x, y in the view's points).

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/isoMovers.test.ts`:

```ts
import { roomEffects } from '../../src/lib/room/effects';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { KIP_MOVER, kipTileCell, moverOrder, pieceTileCell, sameTile } from '../../src/lib/room/iso/movers';
import { drawIsoStatic } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';

const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
const input = (pieces: Placement[]) => ({ layout: { ...starterLayout(), pieces: [...starterLayout().pieces, ...pieces] }, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const });

it('keeps the static order: the shell, then each floor piece\'s run, is back + front (P1 Task 8 minor, ruling 11)', () => {
  const s = drawIsoStatic(input([at('p1', 'corner.beanbag', 3, 5), at('p2', 'plant.cactus', 6, 1)]));
  expect([...s.under, ...s.runs.flatMap((r) => r.rects)]).toEqual([...s.back, ...s.front]);
  expect(moverOrder(s.runs, [{ key: KIP_MOVER, depth: s.seat! }], [s.deskId!, KIP_MOVER]).filter((k) => k !== KIP_MOVER)).toEqual(s.runs.map((r) => r.id));
});

it('puts a mover after what is behind its tile and before what is in front of it (spec §3.4)', () => {
  const s = drawIsoStatic(input([at('p1', 'corner.beanbag', 3, 5), at('p2', 'plant.cactus', 3, 2)]));
  const order = moverOrder(s.runs, [{ key: KIP_MOVER, depth: [3, 4] }], null);
  expect(order.indexOf('desk')).toBeLessThan(order.indexOf(KIP_MOVER));
  expect(order.indexOf('p2')).toBeLessThan(order.indexOf(KIP_MOVER));
  expect(order.indexOf(KIP_MOVER)).toBeLessThan(order.indexOf('p1')); // the bean bag in front hides KIP's feet
  // At the seat, inside the desk's footprint, KIP still comes after the desk (the static picture's own edge).
  const seated = moverOrder(s.runs, [{ key: KIP_MOVER, depth: s.seat! }], ['desk', KIP_MOVER]);
  expect(seated.indexOf('desk')).toBeLessThan(seated.indexOf(KIP_MOVER));
});

it('a run\'s key changes only when its own piece does (a minute, a stage), so the others keep their pictures', () => {
  const pieces = [{ ...at('p1', 'art.clock', 0, 0), layer: 'wallR' as const }];
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, ...pieces] };
  const base = { layout, tier: 1 as const, weather: 'clear' as const, night: false, colour: 'coral' as const };
  const keys = (hhmm: string, stage: 1 | 5) => drawIsoStatic({ ...base, effects: roomEffects(layout, 1, { plantStage: stage, petEnergy: 'wander', awards: [] }, { hhmm, hour: 7 }) }).runs.map((r) => r.key);
  expect(keys('07:12', 5)).toEqual(keys('07:13', 5)); // the clock is on the wall, in `under`
  const [d1, f1] = keys('07:12', 5);
  const [d2, f2] = keys('07:12', 1);
  expect([d1 === d2, f1 === f2]).toEqual([true, false]); // only the fern's run changes with its stage
});

it('leaves movers out of the picture, and places KIP and a piece on a tile as the seat and the anchor do', () => {
  const s = drawIsoStatic({ ...input([]), movers: ['plant'] });
  expect(s.runs.map((r) => r.id)).toEqual(['desk']);
  const g = isoGrid(1);
  expect(kipTileCell(g, s.seat!)).toEqual([s.kipSeat.x, s.kipSeat.y]);
  expect(pieceTileCell(g, [2, 3])).toEqual([g.ox + (2 - 3) * 12, g.oy + (2 + 3) * 6]);
  expect([sameTile([1, 2], [1, 2]), sameTile([1, 2], null)]).toEqual([true, false]);
});
```

Create `mobile/__tests__/components/RoomViewMovers.test.tsx`:

```tsx
import React, { createRef } from 'react';
import { act, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { RoomView, type KipMover, type RoomViewHandle, type RoomViewProps } from '../../src/components/room/RoomView';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';

jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => true }));

const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'rest', mood: 'idle', screen: 'lines', crop: { width: 323, height: 240 }, cellPt: 2, bubble: null, reduceMotion: false, testID: 'room',
};
const OUT: KipMover = { pos: [3, 4], depth: [3, 4], flip: false, pose: 'rest', moving: true, sway: false };
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true }).map((p) => p.props.picture);
const groups = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-group', { includeHiddenElements: true });

beforeEach(() => { picture.mockClear(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

describe('RoomView with movers (spec §3.4, §3.7, rulings 11-12)', () => {
  it('draws the shell, each floor piece, KIP at its tile, the light and the loops, and keeps P1\'s four pictures without movers', () => {
    expect(pictures(render(<RoomView {...PROPS} />))).toHaveLength(4);
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    expect(pictures(s)).toHaveLength(6); // under, the fern, the desk, KIP, the overlay, the loop frame
    const clipped = groups(s).find((g) => g.props.skiaInvertClip);
    expect(clipped?.props.skiaClip).toBeTruthy();
  });

  it('a walk step records nothing: only KIP\'s transform and, at a tile, the order change (Review Focus 5)', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const before = picture.mock.calls.length;
    const kipAt = () => groups(s).map((g) => JSON.stringify(g.props.skiaTransform));
    const was = kipAt();
    s.rerender(<RoomView {...PROPS} kipMover={{ ...OUT, pos: [3.5, 4], depth: [4, 4] }} />);
    s.rerender(<RoomView {...PROPS} kipMover={{ ...OUT, pos: [4, 4], depth: [4, 4] }} />);
    act(() => { jest.advanceTimersByTime(400 * 6); });
    expect(picture.mock.calls.length - before).toBe(0);
    expect(kipAt()).not.toEqual(was);
  });

  it('bobs a walking KIP one cell on alternate frames, and sways it at the radio', () => {
    const s = render(<RoomView {...PROPS} kipMover={OUT} />);
    const ys = new Set<string>();
    for (let i = 0; i < 4; i++) { ys.add(JSON.stringify(groups(s).map((g) => g.props.skiaTransform))); act(() => { jest.advanceTimersByTime(400); }); }
    expect(ys.size).toBeGreaterThan(1);
    const still = render(<RoomView {...PROPS} reduceMotion kipMover={OUT} />);
    const first = JSON.stringify(groups(still).map((g) => g.props.skiaTransform));
    act(() => { jest.advanceTimersByTime(400 * 3); });
    expect(JSON.stringify(groups(still).map((g) => g.props.skiaTransform))).toBe(first);
  });

  it('draws a piece mover at its tile, left out of the picture, and moving it records nothing', () => {
    const s = render(<RoomView {...PROPS} pieceMovers={[{ id: 'plant', pos: [5, 5], depth: [5, 5], flip: false }]} />);
    expect(pictures(s)).toHaveLength(6); // under, the desk, KIP at its seat, the fern mover, the overlay, the loop frame
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pieceMovers={[{ id: 'plant', pos: [5.5, 5], depth: [6, 5], flip: false }]} />);
    expect(picture.mock.calls.length - before).toBe(0);
  });

  it('a running clock\'s minute re-records the shell, the light and the loops, never a floor piece (Review Focus 5)', () => {
    jest.setSystemTime(new Date(2026, 9, 24, 7, 12, 30));
    const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'art.clock', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }] };
    const s = render(<RoomView {...PROPS} layout={layout} kipMover={OUT} />);
    const runsBefore = pictures(s).slice(1, 3);
    const before = picture.mock.calls.length;
    act(() => { jest.advanceTimersByTime(30_000); });
    expect(picture.mock.calls.length - before).toBe(5); // under + overlay + 3 loop frames
    expect(pictures(s).slice(1, 3)).toEqual(runsBefore);
  });

  it('answers which piece is under a point in the view (the piece card, Task 13)', () => {
    const ref = createRef<RoomViewHandle>();
    render(<RoomView {...PROPS} ref={ref} />);
    expect(ref.current!.pieceAtPoint(-500, -500)).toBeNull();
    let hit: string | null = null;
    for (let x = 0; x < 323 && !hit; x += 4) for (let y = 0; y < 240 && !hit; y += 4) hit = ref.current!.pieceAtPoint(x, y);
    expect(hit).not.toBeNull();
  });
});
```

In `mobile/__tests__/components/RoomView.test.tsx`, the pose-change test's last line,
`expect([kip.dispose, frame.dispose].every((d: jest.Mock) => d.mock.calls.length > 0)).toBe(true);`, becomes (KIP's
poses are now cached, ruling 13's walk revisits them):

```ts
    expect([kip.dispose, frame.dispose].every((d: jest.Mock) => d.mock.calls.length === 0)).toBe(true); // cached for a return
    s.unmount();
    expect([kip.dispose, frame.dispose].every((d: jest.Mock) => d.mock.calls.length > 0)).toBe(true); // released with the view
```

In `mobile/jest-mocks/skia.js`, `Group` passes its clip through:

```js
const Group = ({ children, transform, clip, invertClip }) =>
  React.createElement(View, { testID: 'skia-group', skiaTransform: transform, skiaClip: clip, skiaInvertClip: invertClip }, children);
```

In `mobile/jest-mocks/RoomView.js`, replace the file: the stand-in keeps every prop it shows today (Task 4 added
`living`) and exposes the handle (React 19 passes `ref` as a prop). Tasks 10, 11 and 13 add fields to `propsOf`.

```js
// Jest stand-in for src/components/room/RoomView: the props a test needs, as text, on a plain View, and its handle.
const React = require('react');
const { View } = require('react-native');

let mockPieceAt = () => null;
const propsOf = (p) => ({
  testID: p.testID ?? 'room-view',
  accessible: p.accessible ?? true,
  accessibilityRole: p.accessible === false ? undefined : 'image',
  accessibilityLabel: p.accessibilityLabel,
  layout: JSON.stringify(p.layout), tier: p.tier, offset: p.offset ? JSON.stringify(p.offset) : undefined, hide: p.hide ?? null,
  worn: JSON.stringify(p.worn),
  living: p.living ? JSON.stringify(p.living) : undefined,
  room: `${p.pose}:${p.mood}:${p.bubble ?? 'none'}:${p.screen}:${p.weather}:${p.night ? 'night' : 'day'}:${p.colour}:${p.cellPt}:${p.reduceMotion ? 'still' : 'moving'}:${p.facing ?? ''}:${p.paused ? 'paused' : ''}`,
});

module.exports = {
  LOOP_MS: 400,
  bubbleAnchor: () => ({ x: 0, y: 0 }),
  /** Tests choose what a tap on the room finds. */
  __setPieceAt: (fn) => { mockPieceAt = fn; },
  RoomView: (p) => {
    React.useImperativeHandle(p.ref, () => ({ pieceAtPoint: (x, y) => mockPieceAt(x, y), squash: jest.fn() }), []);
    return React.createElement(View, propsOf(p));
  },
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/isoMovers.test.ts __tests__/components/RoomViewMovers.test.tsx`
Expected: FAIL (`iso/movers` does not exist; `IsoStatic` has no `runs`).

- [ ] **Step 3: Runs and movers in the static room**

In `mobile/src/lib/room/layout.ts`, `const pieceKey` becomes `export const pieceKey`.

In `mobile/src/lib/room/iso/room.ts`:
- `import { childrenOf, deskOf, layoutKey, pieceKey } from '../layout';`
- `RoomKip` gains:

```ts
  /** Walking (spec §3.6): mirrored when it heads left; set, it decides the mirror on its own. */
  flip?: boolean;
```

- `drawKipLayer`'s mirror line becomes
  `if (kip.flip ?? (facing === 'desk' && seat.deskSide === 'left')) grid = mirrorGrid(grid);`
- `kipLayerKey` ends `…#${kip.facing ?? ''}#${kip.flip === undefined ? '' : kip.flip ? 'f' : 'n'}`;
- `IsoStaticInput` gains:

```ts
  /** Pieces drawn as movers (the wandering cat): left out of the picture, as a lifted piece is. */
  movers?: readonly string[];
```

- add, after `PieceHit`:

```ts
/** One floor piece and what stands on it (and a cat napping on it), in draw order: one picture in runs mode (ruling 11). */
export interface IsoRun {
  /** The floor piece's placement id: its key in the draw order. */
  id: string;
  /** Its content: the pieces, where they are drawn, their states, the size, the light and KIP's colour. */
  key: string;
  box: DepthBox;
  rects: Rects;
}
```

- `IsoStatic` gains:

```ts
  /** The shell, the wall pieces and the rugs: everything drawn before the first floor piece. */
  under: Rects;
  /** Each floor piece with what stands on it, in the static depth order. */
  runs: IsoRun[];
  deskId: string | null;
  /** KIP's seat tile, or null with no desk. */
  seat: [number, number] | null;
```

- in `drawIsoStatic`:
  - `visible` also leaves movers out:

```ts
  const away = new Set([...(input.movers ?? []), ...(hide ? [hide] : [])]);
  const visible = layout.pieces.filter((p) => isoOf(p.item) && !away.has(p.id) && !(p.layer === 'onTop' && away.has(p.parent ?? '')));
```

  - `put` also adds its rects to the run being built (`let run: IsoRun | null = null;` beside `let list = behind;`),
    after `target.push(...base);`: `if (run) run.rects.push(...base);`
  - after the flat pieces are put and before `const solid`: `const under: Rects = [...back];`
  - the solid loop builds the runs:

```ts
  const runs: IsoRun[] = [];
  const boxOf = new Map(boxes.map((b) => [b.key, b]));
  for (const key of order) {
    if (key === KIP_KEY) { target = front; list = ahead; continue; }
    const p = byId.get(key)!;
    run = { id: p.id, key: '', box: boxOf.get(key)!, rects: [] };
    const from = list.length;
    put(p);
    const placed = list.slice(from).map((pp) => `${pieceKey(pp.p)}@${pp.at.join(',')}~${pp.o.effect ?? ''}`).join(';');
    run.key = `${tier}#${night ? 'n' : 'd'}#${colour}#${weather}#${placed}`;
    runs.push(run);
    run = null;
  }
```

  - the result gains `under, runs, deskId: desk && byId.has(desk.id) ? desk.id : null, seat,`.
- `isoRoomKey` appends `#${[...(input.movers ?? [])].sort().join(',')}`.

Create `mobile/src/lib/room/iso/movers.ts`:

```ts
// Movers in the iso room (spec 2026-10-15 §3.4, §3.7, P3 ruling 11): KIP off its seat and a wandering cat are not in
// the static picture. Each frame draws the cached floor-piece pictures (IsoRun) in depth order with each mover inserted
// at the tile it stands on, a 1 × 1 box in the same topological sort the static room uses. KIP at its seat keeps the
// static picture's own edge (the desk before KIP). Pure.
import { HH, HT, projOf, type IsoGrid } from './grid';
import { KIP_CELLS, type IsoRun } from './room';
import { depthOrder, type DepthBox } from './sort';

export type Tile = readonly [number, number];
export const KIP_MOVER = '@kip';
/** A piece mover's key in the draw order: its placement id after this prefix. */
export const MOVER_PREFIX = '@m:';
export interface MoverAt { key: string; depth: Tile }

const tileBox = (m: MoverAt): DepthBox => ({ key: m.key, i0: m.depth[0], j0: m.depth[1], i1: m.depth[0] + 1, j1: m.depth[1] + 1 });

/** The floor pieces' ids and the movers' keys, back to front. */
export function moverOrder(runs: readonly IsoRun[], movers: readonly MoverAt[], seatEdge: readonly [string, string] | null): string[] {
  return depthOrder([...runs.map((r) => r.box), ...movers.map(tileBox)], seatEdge ? [seatEdge] : []);
}

/** KIP's 32-cell grid top-left standing on a tile's centre (half tiles allowed), whole cells: kipAt's own formula. */
export function kipTileCell(g: Pick<IsoGrid, 'ox' | 'oy'>, pos: readonly [number, number]): [number, number] {
  const [cx, cy] = projOf(g)(pos[0] + 0.5, pos[1] + 0.5);
  return [Math.round(cx) - 8 * KIP_CELLS, Math.round(cy) - 15 * KIP_CELLS];
}

/** A floor piece's anchor (its back corner) on a tile, whole cells: anchorOf's own formula. */
export function pieceTileCell(g: Pick<IsoGrid, 'ox' | 'oy'>, pos: readonly [number, number]): [number, number] {
  return [Math.round(g.ox + (pos[0] - pos[1]) * HT), Math.round(g.oy + (pos[0] + pos[1]) * HH)];
}

export function sameTile(a: Tile | null | undefined, b: Tile | null | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}
```

- [ ] **Step 4: The picture caches**

In `mobile/src/components/room/pictures.ts`, `useDisposed` accepts a picture that may be absent:

```ts
/** Releases a picture when it is replaced or the view unmounts (one picture set per screen). */
export function useDisposed<T extends { dispose?: () => void } | null>(value: T): T {
  useEffect(() => () => value?.dispose?.(), [value]);
  return value;
}
```

Create `mobile/src/components/room/pictureCache.ts`:

```ts
import type { SkPicture } from '@shopify/react-native-skia';

// The room's picture caches (spec 2026-10-15 §3.7, P3 rulings 11-13). Recording happens only on a miss: a pose, a
// static room, a mover's sprite. An animation tick, a walk step, a sway or a bob only reads them.

/** A small LRU of picture sets: KIP's three frames per pose, the loop frames per static room, a mover's sprite. */
export class PictureLru {
  private readonly map = new Map<string, SkPicture[]>();
  constructor(private readonly capacity: number) {}
  get(key: string, make: () => SkPicture[]): SkPicture[] {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const made = make();
    this.map.set(key, made);
    while (this.map.size > this.capacity) {
      const [oldest, set] = this.map.entries().next().value!;
      this.map.delete(oldest);
      set.forEach((p) => p.dispose?.());
    }
    return made;
  }
  get size(): number {
    return this.map.size;
  }
  clear(): void {
    for (const set of this.map.values()) set.forEach((p) => p.dispose?.());
    this.map.clear();
  }
}

/** One picture per floor piece, by its content key (IsoRun.key): a drop or a minute re-records only what changed. */
export class RunPictures {
  private readonly map = new Map<string, SkPicture>();
  take(key: string, make: () => SkPicture): SkPicture {
    let pic = this.map.get(key);
    if (!pic) {
      pic = make();
      this.map.set(key, pic);
    }
    return pic;
  }
  /** Releases every picture whose key the current room no longer has. */
  keep(keys: ReadonlySet<string>): void {
    for (const [key, pic] of this.map) {
      if (keys.has(key)) continue;
      pic.dispose?.();
      this.map.delete(key);
    }
  }
  clear(): void {
    for (const pic of this.map.values()) pic.dispose?.();
    this.map.clear();
  }
}
```

- [ ] **Step 5: `RoomView` with movers**

Replace `mobile/src/components/room/RoomView.tsx` with:

```tsx
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { Canvas, Group, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { Text } from '../ui/text';
import { record, useDisposed } from './pictures';
import { PictureLru, RunPictures } from './pictureCache';
import { useRoomEffects } from './useRoomEffects';
import type { Rects } from '../../lib/room/paint';
import type { ItemContext, MonitorScreen } from '../../lib/room/items';
import type { KipWorn } from '../../lib/room/loadout';
import type { RoomWeather } from '../../lib/room/weather';
import type { Living } from '../../lib/room/effects';
import { pieceLayers } from '../../lib/room/iso/art';
import type { IsoStatic, KipSeat, RoomKip } from '../../lib/room/iso/room';
import { drawIsoFramesEach, drawIsoStatic, drawKipLayer, isoRoomKey, kipLayerKey, pieceAt } from '../../lib/room/iso/room';
import { isoCrop } from '../../lib/room/iso/crop';
import { KIP_MOVER, MOVER_PREFIX, kipTileCell, moverOrder, pieceTileCell, sameTile, type Tile } from '../../lib/room/iso/movers';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';
import { KIP_COLOURS, kipRamp, type KipColour, type KipMood, type KipPose } from '../../lib/kip/kipArt';
import { useFrameClock } from '../../lib/useFrameClock';
import { useScreenFocused } from '../../lib/useScreenFocused';

export const LOOP_MS = 400;
// The bubble is decoration over a fixed crop, so its text grows only a little with Dynamic Type.
const BUBBLE_MAX_FONT_SCALE = 1.3;
const BUBBLE_INSET = 4;
/** KIP's poses, the loop frames and the movers' sprites a view keeps (a trip uses five or six). */
const PICTURE_SETS = 24;

/** KIP off its seat (spec §9.2): where it stands (half tiles while it glides) and the tile it is drawn at in depth. */
export interface KipMover {
  pos: readonly [number, number];
  depth: Tile;
  flip: boolean;
  pose: KipPose;
  /** Between tiles: a 1-cell bob on alternate frames (spec §3.6). */
  moving: boolean;
  /** At the radio: KIP sways a cell each way (ruling 13). */
  sway: boolean;
}
/** A piece drawn as a mover (the wandering cat, spec §8.2). */
export interface PieceMover { id: string; pos: readonly [number, number]; depth: Tile; flip: boolean }
export interface RoomViewHandle {
  /** The topmost piece under a point in this view, in points (the piece card, spec §8.1), or null. */
  pieceAtPoint(x: number, y: number): string | null;
}

export interface RoomViewProps {
  layout: RoomLayout;
  tier: Tier;
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  worn: KipWorn;
  pose: KipPose;
  mood: KipMood;
  facing?: 'desk' | 'you';
  screen: MonitorScreen;
  crop: { width: number; height: number };
  cellPt: 1 | 2;
  box?: 'focus' | 'thumb';
  /** The editor's pan: the room's top-left in points, instead of the crop on the desk. */
  offset?: { x: number; y: number };
  /** The editor: a piece lifted into the drag ghost is left out of the picture (spec §3.7). */
  hide?: string | null;
  /** The editor: the static room it already built for these props (its hit boxes), so it is built once a change. */
  room?: IsoStatic;
  /** The living room (spec §8.3); absent, the neutral room (a visit, the share card, a test). */
  living?: Living;
  /** The editor: a napping cat stays on its own tile. */
  editing?: boolean;
  /** KIP off its seat, walking or at a target (Task 10 sets it from its own walk; a test may pass it). */
  kipMover?: KipMover | null;
  /** Pieces drawn as movers (Task 11 sets the wandering cat; a test may pass them). */
  pieceMovers?: readonly PieceMover[];
  bubble: string | null;
  reduceMotion: boolean;
  accessibilityLabel?: string;
  /** False when a parent carries the label (the collapsed header's thumbnail button). Default true. */
  accessible?: boolean;
  /** Holds the loops (frame 0) while something covers the room, such as the editor (spec §8 Loops). */
  paused?: boolean;
  testID?: string;
  ref?: Ref<RoomViewHandle>;
}

const NO_MOVERS: readonly PieceMover[] = [];

/** Where the speech bubble's bottom centre sits, in cells: just above KIP's head. */
export function bubbleAnchor(seat: KipSeat): { x: number; y: number } {
  return { x: seat.x + 16, y: seat.y + 10 };
}

const shift = (dx: number, dy: number, cellPt: number) => [{ translateX: dx * cellPt }, { translateY: dy * cellPt }];

// KIP's isometric room (spec 2026-10-15 §3.7). With no mover the static room is P1's two pictures, back and front,
// recorded once per isoRoomKey, with KIP between them and the loop frame over them (frames behind KIP clipped by its
// silhouette). With a mover on screen (KIP off its seat, a wandering cat: P3 ruling 11) it draws `under`, one cached
// picture per floor piece and the movers in depth order, the light and glow layer, and the loop frame under an
// inverted clip of KIP's silhouette (ruling 12). KIP's poses and the frame sets are cached (PictureLru), floor pieces
// by their content (RunPictures): a loop tick, a walk step, a bob or a sway records nothing (P1 ruling T10-FIX).
export function RoomView(props: RoomViewProps) {
  const { layout, tier, weather, night, colour, worn, pose, mood, facing, screen, crop, cellPt, bubble, reduceMotion } = props;
  const focused = useScreenFocused();
  const still = reduceMotion || !focused || !!props.paused;
  const t = useFrameClock(still);
  const frame = still ? 0 : Math.floor(t / LOOP_MS) % 3;

  const effects = useRoomEffects(layout, tier, props.living, { editing: props.editing });
  const pieceMovers = props.pieceMovers ?? NO_MOVERS;
  const moverKey = pieceMovers.map((m) => m.id).sort().join(',');
  const moverIds = useMemo(() => (moverKey ? moverKey.split(',') : []), [moverKey]);
  const input = { layout, tier, weather, night, colour, hide: props.hide ?? null, effects, movers: moverIds };
  const staticKey = isoRoomKey(input);
  const room = useMemo(() => props.room ?? drawIsoStatic(input), [staticKey, props.room]); // eslint-disable-line react-hooks/exhaustive-deps

  const kipMover = props.kipMover ?? null;
  const movers = !!kipMover || pieceMovers.length > 0;
  const back = useDisposed(useMemo(() => (movers ? null : record([room.back], cellPt)), [room, cellPt, movers]));
  const front = useDisposed(useMemo(() => (movers ? null : record([room.front, room.light, room.emissive], cellPt)), [room, cellPt, movers]));

  const lru = useRef(new PictureLru(PICTURE_SETS)).current;
  const runPictures = useRef(new RunPictures()).current;
  useEffect(() => () => { lru.clear(); runPictures.clear(); }, [lru, runPictures]);

  // KIP in all three loop frames at once, keyed without the frame (ruling T10-FIX); the seat joins the key, so a moved
  // desk re-places KIP. Walking, KIP glances and is mirrored when it heads left (spec §3.6).
  const kip: RoomKip = kipMover
    ? { colour, pose: kipMover.pose, mood: 'glance', worn, facing: 'you', flip: kipMover.flip }
    : { colour, pose, mood, worn, ...(facing ? { facing } : {}) };
  const seat = room.kipSeat;
  const poseKey = `${kipLayerKey({ ...kip, frame: 0 })}#${seat.style}@${seat.x},${seat.y},${seat.deskSide}`;
  const kipRects = useMemo(
    () => [0, 1, 2].map((f) => drawKipLayer({ ...kip, frame: f }, seat)) as [Rects, Rects, Rects],
    [poseKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const kipPictures = lru.get(`kip#${poseKey}#${cellPt}`, () => kipRects.map((r) => record([r], cellPt)));
  const seatedFrames = movers
    ? null
    : lru.get(`seated#${staticKey}#${screen}#${poseKey}#${cellPt}`, () => drawIsoFramesEach(room, { night, colour, screen }, kipRects).map((r) => record([r], cellPt)));

  // Runs mode (ruling 11): the shell, each floor piece by its content, the overlay and the unclipped loop frames.
  let runs: { under: SkPicture; overlay: SkPicture; frames: SkPicture[]; byId: Map<string, SkPicture> } | null = null;
  if (movers) {
    const keys = new Set<string>();
    const byId = new Map<string, SkPicture>();
    for (const r of room.runs) {
      const key = `${cellPt}#${r.key}`;
      keys.add(key);
      byId.set(r.id, runPictures.take(key, () => record([r.rects], cellPt)));
    }
    runPictures.keep(keys);
    const [under, overlay] = lru.get(`under#${staticKey}#${cellPt}`, () => [record([room.under], cellPt), record([room.light, room.emissive], cellPt)]);
    const frames = lru.get(`frames#${staticKey}#${screen}#${cellPt}`, () => drawIsoFramesEach(room, { night, colour, screen }, [[], [], []]).map((r) => record([r], cellPt)));
    runs = { under: under!, overlay: overlay!, frames, byId };
  }
  // KIP's silhouette as a path per frame (not a picture): the loops are clipped by it wherever KIP stands (ruling 12).
  const kipPaths = useMemo(() => (movers ? kipRects.map((rs) => {
    const p = Skia.Path.Make();
    for (const [x, y, w, h] of rs) p.addRect(Skia.XYWHRect(x * cellPt, y * cellPt, w * cellPt, h * cellPt));
    return p;
  }) : null), [kipRects, cellPt, movers]);

  // Where KIP is drawn, relative to its seat: its tile, a bob between tiles, a sway at the radio (no recording).
  const [kx, ky] = kipMover ? kipTileCell(room.grid, kipMover.pos) : [seat.x, seat.y];
  const bob = kipMover?.moving && !still && frame % 2 === 1 ? -1 : 0;
  const sway = kipMover?.sway && !still ? [0, 1, -1][frame]! : 0;
  const dx = kx - seat.x + sway;
  const dy = ky - seat.y + bob;
  const kipDepth: Tile | null = kipMover ? kipMover.depth : room.seat;
  const seatedKip = !kipMover || sameTile(kipMover.depth, room.seat);
  const moverAts = [
    ...(kipDepth ? [{ key: KIP_MOVER, depth: kipDepth }] : []),
    ...pieceMovers.map((m) => ({ key: `${MOVER_PREFIX}${m.id}`, depth: m.depth })),
  ];
  const orderKey = movers ? `${staticKey}|${moverAts.map((m) => `${m.key}:${m.depth[0]},${m.depth[1]}`).join(';')}|${seatedKip}` : '';
  const order = useMemo(
    () => (movers ? moverOrder(room.runs, moverAts, seatedKip && room.deskId ? [room.deskId, KIP_MOVER] : null) : []),
    [orderKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ctx: ItemContext = { weather, night, colour, ramp: kipRamp(KIP_COLOURS[colour]), screen: 'lines' };
  const moverPictures = new Map<string, { picture: SkPicture; at: [number, number] }>();
  for (const m of pieceMovers) {
    const p = layout.pieces.find((q) => q.id === m.id);
    if (!p) continue;
    const state = effects.states.get(p.id);
    const [picture] = lru.get(`mover#${p.item}#${p.facing}#${m.flip}#${state ?? ''}#${night ? 'n' : 'd'}#${colour}#${cellPt}`, () => [
      record([pieceLayers(p.item, ctx, { layer: 'floor', facing: p.facing, mirror: m.flip, ...(state ? { effect: state } : {}) })?.base ?? []], cellPt),
    ]);
    moverPictures.set(`${MOVER_PREFIX}${m.id}`, { picture: picture!, at: pieceTileCell(room.grid, m.pos) });
  }

  const box = props.box === 'thumb' ? room.thumb : room.focus;
  const offset = props.offset ?? isoCrop({ width: crop.width, height: crop.height, cellPt, box, room: room.grid });
  useImperativeHandle(props.ref, () => ({
    pieceAtPoint: (x: number, y: number) => pieceAt(room.hits, Math.floor((x - offset.x) / cellPt), Math.floor((y - offset.y) / cellPt)),
  }), [room, offset.x, offset.y, cellPt]);
  const anchor = bubbleAnchor(seat);
  // Measured, so a long bubble is pulled in from the right edge instead of clipped by the crop.
  const [bubbleWidth, setBubbleWidth] = useState(0);
  const bubbleLeft = Math.max(BUBBLE_INSET, Math.min(offset.x + anchor.x * cellPt - 36, crop.width - bubbleWidth - BUBBLE_INSET));
  const kipNode = (
    <Group key={KIP_MOVER} transform={shift(dx, dy, cellPt)}>
      <Picture picture={kipPictures[frame]!} />
    </Group>
  );
  return (
    <View
      testID={props.testID}
      accessible={props.accessible ?? true}
      accessibilityRole={props.accessible === false ? undefined : 'image'}
      accessibilityLabel={props.accessibilityLabel}
      style={{ width: crop.width, height: crop.height, overflow: 'hidden' }}
    >
      <Canvas style={{ width: crop.width, height: crop.height }}>
        <Group transform={[{ translateX: offset.x }, { translateY: offset.y }]}>
          {runs ? (
            <>
              <Picture picture={runs.under} />
              {kipDepth ? null : kipNode}
              {order.map((key) => {
                if (key === KIP_MOVER) return kipNode;
                const m = moverPictures.get(key);
                if (m) return <Group key={key} transform={shift(m.at[0], m.at[1], cellPt)}><Picture picture={m.picture} /></Group>;
                const pic = runs!.byId.get(key);
                return pic ? <Picture key={key} picture={pic} /> : null;
              })}
              <Picture picture={runs.overlay} />
              <Group transform={shift(dx, dy, cellPt)} clip={kipPaths![frame]!} invertClip>
                <Group transform={shift(-dx, -dy, cellPt)}>
                  <Picture picture={runs.frames[frame]!} />
                </Group>
              </Group>
            </>
          ) : (
            <>
              <Picture picture={back!} />
              <Picture picture={kipPictures[frame]!} />
              <Picture picture={front!} />
              <Picture picture={seatedFrames![frame]!} />
            </>
          )}
        </Group>
      </Canvas>
      {bubble ? (
        <View
          testID="room-bubble"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute rounded-lg bg-[#F5F5F4] px-2 py-1"
          onLayout={(e) => setBubbleWidth(e.nativeEvent.layout.width)}
          style={{ left: bubbleLeft, bottom: crop.height - (offset.y + anchor.y * cellPt) }}
        >
          <Text className="font-pixel text-label text-[#0A0B0E]" numberOfLines={1} maxFontSizeMultiplier={BUBBLE_MAX_FONT_SCALE}>
            {bubble}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
```

(The seated mode is P1's four pictures exactly; the existing `RoomView.test.tsx` cases keep passing, with the pose-change
case's release check moved to unmount as Step 1 says.)

In `mobile/__tests__/perf/isoBuild.test.ts`, inside the measured case, after `frame`:

```ts
    const order = median(() => moverOrder(s.runs, [{ key: KIP_MOVER, depth: [4, 4] }, { key: '@m:f0', depth: [6, 6] }], null));
```

log it as `orderMs: order` in the `room.iso.build` line, add `order` to the finite check, and import
`KIP_MOVER, moverOrder` from `../../src/lib/room/iso/movers`.

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/isoMovers.test.ts __tests__/components/RoomViewMovers.test.tsx __tests__/components/RoomView.test.tsx __tests__/lib/isoRoom.test.ts __tests__/lib/roomSets.test.ts __tests__/components/EditRoom.test.tsx`
and `ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf` (record the line in the ledger).
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 7: Commit**

```bash
git add mobile/src mobile/jest-mocks mobile/__tests__
git commit -m "feat(room): movers in the room: cached floor pieces in depth order, KIP at a tile, loops clipped by KIP"
```

---

### Task 10: Mobile: KIP walks between answers (targets, paths, the `water` pose, and the stop rules)

Spec §3.6 ("Walking … uses the same sprite with a 1-cell bob on alternate frames. Legs never change … KIP glides tile
to tile"), §9.2 (only while idle; exit tile; use tiles; inside the crop; breadth-first paths; one tile per two loop
frames; stop at once; one trip every 20 to 40 seconds, never two in a row to the same piece), §8.2 (plants: "one extra
smile frame in its idle loop") and C6. Rulings 9, 13, 14.

**Files:**
- Create: `mobile/src/lib/room/live/walk.ts`, `mobile/src/lib/room/live/useKipWalk.ts`,
  `mobile/__tests__/lib/walk.test.ts`, `mobile/__tests__/lib/useKipWalk.test.tsx`
- Modify: `mobile/src/lib/kip/kipArt.ts`, `mobile/src/components/room/RoomView.tsx`,
  `mobile/src/components/coach/PromptBar.tsx`, `mobile/src/components/coach/RoomCard.tsx`,
  `mobile/src/screens/CoachScreen.tsx`, `mobile/jest-mocks/RoomView.js`, `mobile/__tests__/lib/kipArt.test.ts`,
  `mobile/__tests__/components/PromptBar.test.tsx`, `mobile/__tests__/components/RoomCard.test.tsx`,
  `mobile/__tests__/screens/KipPage.test.tsx`

**Interfaces:**
- Consumes: Task 1's `exitTile`, `seatTile`, `footOf`, `tierSize`; Task 4's `RoomEffects`, `effectOf`; Task 9's
  `KipMover`, `kipTileCell`, `Tile`; P1's `deskOf`, `isoGrid`, `projOf`, `deskBoxes`.
- Produces:
  - `walk.ts`: `STEP_MS = 400`, `USE_MS = 2400`, `TRIP_MIN_MS = 20000`, `TRIP_SPAN_MS = 20000`;
    `type UseKind = 'sound' | 'plant' | 'cat' | 'other'`; `USE_POSE: Record<UseKind, KipPose>`;
    `interface WalkTarget { id: string; kind: UseKind; stand: Tile; x: number }`;
    `blockedTiles(layout, deps?): Set<string>`; `bfs(from, to, n, m, blocked): Tile[] | null`;
    `standTileOf(layout, p, tier, blocked, deps?): Tile | null`; `tileInView(g, tile, view): boolean`;
    `walkTargets(layout, tier, effects, view, deps?): WalkTarget[]`;
    `interface Trip { target: WalkTarget; path: Tile[]; faceLeft: boolean }`;
    `planTrip(layout, tier, effects, view, last, rng, deps?): Trip | null`;
    `posAt(path, s, dir: 1 | -1): { pos: [number, number]; depth: Tile }`; `headsLeft(from, to): boolean`;
  - `useKipWalk.ts`: `type KipWalk = { phase: 'seat' } | { phase: 'walk' | 'use'; pos; depth; flip; kind: UseKind; target: string }`;
    `useKipWalk(input: { enabled: boolean; layout; tier; effects; view: Box | null; rng?: () => number }): KipWalk`;
    `walkMover(w: KipWalk): KipMover | null`;
  - `KipPose` gains `'water'`; `RoomViewProps.kipWalks?: boolean`, `RoomViewProps.idle?: boolean`;
    `PromptBarProps.onFocusChange?: (focused: boolean) => void`; `RoomCard` prop `kipWalks?: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/walk.test.ts`:

```ts
import { GEOMETRY_DEPS } from '../../src/lib/room/catalogue';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { blockedTiles, bfs, headsLeft, planTrip, posAt, standTileOf, tileInView, walkTargets, USE_POSE } from '../../src/lib/room/live/walk';
import { starterLayout } from '../../src/lib/room/layout';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const WHOLE = { x: -1000, y: -1000, w: 3000, h: 3000 };
const fx = (l: RoomLayout) => roomEffects(l, 1, NEUTRAL_LIVING, null);

describe('use tiles (spec §9.2)', () => {
  it('a floor piece: the free tile in front of its facing side, the middle first', () => {
    const l = room(at('p1', 'corner.beanbag', { x: 5, y: 3 }));
    const blocked = blockedTiles(l);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p1')!, 1, blocked)).toEqual([5, 4]);
    expect(standTileOf(l, { ...l.pieces.find((p) => p.id === 'p1')!, facing: 'R' }, 1, blocked)).toEqual([6, 3]);
  });

  it('a wall piece: the floor tile against its wall under its centre; an on-top piece: its parent\'s', () => {
    const l = room(at('p1', 'art.clock', { layer: 'wallR', x: 10, y: 0 }), at('p2', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }));
    const blocked = blockedTiles(l);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p1')!, 1, blocked)).toEqual([5, 0]);
    expect(standTileOf(l, l.pieces.find((p) => p.id === 'p2')!, 1, blocked)).toEqual([3, 2]); // the desk's front, its exit tile
  });

  it('rugs never block; footprints do', () => {
    const blocked = blockedTiles(starterLayout());
    expect([blocked.has('2,0'), blocked.has('0,0'), blocked.has('2,3')]).toEqual([true, true, false]); // desk, fern, the rug
  });
});

describe('paths and targets (spec §9.2, ruling 13)', () => {
  it('finds a shortest path round the furniture, and none into a closed corner', () => {
    const blocked = new Set(['1,0', '1,1', '0,1']);
    expect(bfs([3, 3], [0, 0], 7, 7, blocked)).toBeNull();
    expect(bfs([3, 2], [3, 5], 7, 7, new Set())).toEqual([[3, 2], [3, 3], [3, 4], [3, 5]]);
  });

  it('targets the running effect pieces and the plants, never an inert or a wandering one, only inside the view', () => {
    // Every other tile, so each lamp's front tile is free; p4 at the back of the room rests anyway (ruling 5).
    const lamps = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'corner.floorlamp', { x: 6, y: 2 * k }));
    const l = room(...lamps);
    const ids = walkTargets(l, 1, fx(l), WHOLE).map((t) => t.id).sort();
    expect(ids).toEqual(['p1', 'p2', 'p3', 'plant']);
    expect(walkTargets(l, 1, fx(l), { x: 0, y: 0, w: 1, h: 1 })).toEqual([]);
    const cat = room(at('p9', 'pet.tabby', { x: 5, y: 5 }));
    expect(walkTargets(cat, 1, roomEffects(cat, 1, { ...NEUTRAL_LIVING, petEnergy: 'wander' }, { hhmm: '12:00', hour: 12 }), WHOLE).some((t) => t.id === 'p9')).toBe(false);
    expect(walkTargets(cat, 1, roomEffects(cat, 1, { ...NEUTRAL_LIVING, petEnergy: 'play' }, { hhmm: '12:00', hour: 12 }), WHOLE).find((t) => t.id === 'p9')!.kind).toBe('cat');
  });

  it('a trip leaves from the seat by the exit tile, and never goes to the same piece twice in a row', () => {
    const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 5 }));
    const trip = planTrip(l, 1, fx(l), WHOLE, null, () => 0)!;
    expect(trip.path.slice(0, 2)).toEqual([[3, 1], [3, 2]]);
    const again = planTrip(l, 1, fx(l), WHOLE, trip.target.id, () => 0)!;
    expect(again.target.id).not.toBe(trip.target.id);
    expect(planTrip({ ...l, pieces: l.pieces.filter((p) => p.id !== 'plant' && p.id !== 'p1') }, 1, fx(l), WHOLE, null, () => 0)).toBeNull();
  });

  it('glides half a tile a frame, taking its depth from the tile it is moving into', () => {
    const path = [[3, 1], [3, 2], [4, 2]] as const;
    expect(posAt(path, 0, 1)).toEqual({ pos: [3, 1], depth: [3, 1] });
    expect(posAt(path, 1, 1)).toEqual({ pos: [3, 1.5], depth: [3, 2] });
    expect(posAt(path, 3, -1)).toEqual({ pos: [3.5, 2], depth: [3, 2] });
    expect([headsLeft([3, 2], [4, 2]), headsLeft([3, 2], [3, 3])]).toEqual([false, true]);
    expect(USE_POSE).toEqual({ sound: 'rest', plant: 'water', cat: 'wave', other: 'point' });
    expect(tileInView(isoGrid(1), [3, 3], WHOLE)).toBe(true);
  });
});
```

Create `mobile/__tests__/lib/useKipWalk.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import { starterLayout } from '../../src/lib/room/layout';
import { STEP_MS, TRIP_MIN_MS, USE_MS } from '../../src/lib/room/live/walk';
import { useKipWalk, walkMover, type KipWalk } from '../../src/lib/room/live/useKipWalk';

const layout = starterLayout();
const effects = roomEffects(layout, 1, NEUTRAL_LIVING, null);
const WHOLE = { x: -1000, y: -1000, w: 3000, h: 3000 };
const props = (enabled: boolean) => ({ enabled, layout, tier: 1 as const, effects, view: WHOLE, rng: () => 0 });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('rests 20 s, walks out half a tile a frame to the fern, uses it, walks back and sits (spec §9.2)', () => {
  const { result } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  expect(result.current).toEqual({ phase: 'seat' });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS); });
  expect(result.current.phase).toBe('walk');
  const seen: KipWalk[] = [];
  for (let i = 0; i < 40 && result.current.phase !== 'use'; i++) { act(() => { jest.advanceTimersByTime(STEP_MS); }); seen.push(result.current); }
  expect(result.current).toMatchObject({ phase: 'use', kind: 'plant', target: 'plant' });
  expect(walkMover(result.current)).toMatchObject({ pose: 'water', moving: false });
  act(() => { jest.advanceTimersByTime(USE_MS); });
  for (let i = 0; i < 40 && result.current.phase !== 'seat'; i++) act(() => { jest.advanceTimersByTime(STEP_MS); });
  expect(result.current).toEqual({ phase: 'seat' });
});

it('stops at once: disabled mid-walk it is on the seat in the same render, and no timer fires (Review Focus 2)', () => {
  const { result, rerender } = renderHook((p: ReturnType<typeof props>) => useKipWalk(p), { initialProps: props(true) });
  act(() => { jest.advanceTimersByTime(TRIP_MIN_MS + STEP_MS * 3); });
  expect(result.current.phase).toBe('walk');
  rerender(props(false));
  expect(result.current).toEqual({ phase: 'seat' });
  expect(jest.getTimerCount()).toBe(0);
  rerender(props(true));
  expect(result.current).toEqual({ phase: 'seat' }); // starts over from the desk
});

it('a walking KIP bobs and glances the way it goes; seated there is no mover', () => {
  expect(walkMover({ phase: 'seat' })).toBeNull();
  expect(walkMover({ phase: 'walk', pos: [3, 1.5], depth: [3, 2], flip: true, kind: 'plant', target: 'plant' })).toEqual({ pos: [3, 1.5], depth: [3, 2], flip: true, pose: 'rest', moving: true, sway: false });
  expect(walkMover({ phase: 'use', pos: [3, 2], depth: [3, 2], flip: false, kind: 'sound', target: 'p1' })).toMatchObject({ pose: 'rest', sway: true });
});
```

In `mobile/__tests__/lib/kipArt.test.ts`, add:

```ts
it('has a water pose: one arm out holding a can, the arms-only rule (spec §9.2, ruling 14)', () => {
  expect(KIP_POSES).toContain('water');
  const rest = kipGrid({ pose: 'rest' });
  const water = kipGrid({ pose: 'water' });
  expect(JSON.stringify(water)).not.toBe(JSON.stringify(rest));
  expect(water.slice(13).map((r) => r.join())).toEqual(rest.slice(13).map((r) => r.join())); // legs never change
});
```

In `mobile/__tests__/components/PromptBar.test.tsx`, add:

```tsx
it('tells the page when the field gains and loses focus (KIP stops walking, spec §9.2)', () => {
  const onFocusChange = jest.fn();
  const s = render(<PromptBar value="" onChangeText={jest.fn()} onSend={jest.fn()} busy={false} onFocusChange={onFocusChange} inputLabel="Ask KIP" />);
  const input = s.getByTestId('coach-input');
  fireEvent(input, 'focus');
  fireEvent(input, 'blur');
  expect(onFocusChange.mock.calls).toEqual([[true], [false]]);
});
```

In `mobile/__tests__/components/RoomCard.test.tsx`, add:

```tsx
it('lets KIP walk only in the idle stage, with no bubble, and passes the idle loop (spec §9.2, rulings 9 and 13)', () => {
  const idle = kipStage({ ...INPUT, waiting: false, streaming: false, empty: false });
  const walking = renderCard({ stage: idle, kipWalks: true });
  expect(walking.getByTestId('kip-room').props.walks).toBe('walks');
  expect(walking.getByTestId('kip-room').props.idle).toBe('idle');
  walking.unmount();
  const thinking = renderCard({ stage: STAGE, kipWalks: true });
  expect(thinking.getByTestId('kip-room').props.walks).toBe('');
});
```

In `mobile/jest-mocks/RoomView.js`, `propsOf(p)` gains `walks: p.kipWalks ? 'walks' : ''` and
`idle: p.idle ? 'idle' : ''`.

In `mobile/__tests__/screens/KipPage.test.tsx`, inside `describe('the KIP page (W7)')`, add (the harness's `openChat`,
`ask`, `openTurn`, `doneEvent` and the file's `room()` helper, as the pose test uses them):

```tsx
  it('KIP walks between answers only while idle with the prompt bar blurred (spec §9.2, Review Focus 2)', async () => {
    const turn = openTurn(stream);
    const s = await openChat();
    await ask(s, 'How did I sleep?');
    room(s);
    expect(s.getByTestId('kip-room').props.walks).toBe(''); // a turn is running
    await turn.emit({ type: 'text', sentence: 'Mostly clear skies.' });
    await turn.finish(doneEvent());
    expect(s.getByTestId('kip-room').props.walks).toBe('walks');
    fireEvent(s.getByTestId('coach-input'), 'focus');
    expect(s.getByTestId('kip-room').props.walks).toBe('');
    fireEvent(s.getByTestId('coach-input'), 'blur');
    expect(s.getByTestId('kip-room').props.walks).toBe('walks');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/walk.test.ts __tests__/lib/useKipWalk.test.tsx __tests__/lib/kipArt.test.ts`
Expected: FAIL (`live/walk` does not exist; no `water` pose).

- [ ] **Step 3: The `water` pose**

In `mobile/src/lib/kip/kipArt.ts`:
- `KIP_POSES` gains `'water'` at the end;
- `HELD` becomes `Record<'bottle' | 'coffee' | 'can', HeldItem>` with:

```ts
  // A small watering can held out at the right (spec §9.2 "an arm out with a held can").
  can: {
    at: [13, 5],
    rows: ['.s..', 'cccS', 'cccc', '.cc.'],
    pal: { s: '#94A3B8', c: '#38BDF8', S: '#0EA5E9' },
  },
```

- `POSES` gains `water: { arms: [[12, 9, 's'], [13, 9, 's']], held: 'can' },` (one arm out at the shoulder's row; legs
  untouched).

- [ ] **Step 4: Walking, pure**

Create `mobile/src/lib/room/live/walk.ts`:

```ts
// KIP walking between answers (spec 2026-10-15 §9.2, C6; P3 ruling 13), pure: the tiles KIP may stand on, the use
// tile of each target (a floor piece: the free tile in front of its facing side; a wall piece: the floor tile against
// its wall under its centre; an on-top piece: its parent's), a breadth-first path on the floor grid (footprints block,
// rugs don't), the targets inside the room card's crop, and a trip: the seat, out by the desk's exit tile, to the
// target. KIP glides half a tile per 400 ms loop frame (one tile per two frames) with its depth taken from the tile it
// moves into.
import { GEOMETRY_DEPS, catalogueItem } from '../catalogue';
import type { Box } from '../grid';
import type { RoomEffects } from '../effects';
import { deskOf } from '../layout';
import { exitTile, footOf, seatTile, tierSize, type GeometryDeps, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import { isoGrid, projOf, type IsoGrid } from '../iso/grid';
import { kipTileCell, type Tile } from '../iso/movers';
import type { KipPose } from '../../kip/kipArt';

export const STEP_MS = 400;
export const USE_MS = 2400;
export const TRIP_MIN_MS = 20_000;
export const TRIP_SPAN_MS = 20_000;

export type UseKind = 'sound' | 'plant' | 'cat' | 'other';
/** What KIP does at a target (ruling 13): sways at the radio, waters a plant, waves at the cat, points at the rest. */
export const USE_POSE: Readonly<Record<UseKind, KipPose>> = { sound: 'rest', plant: 'water', cat: 'wave', other: 'point' };

export interface WalkTarget {
  id: string;
  kind: UseKind;
  /** The tile KIP stands on to use it. */
  stand: Tile;
  /** The piece's centre in room cells along x: KIP faces it. */
  x: number;
}
export interface Trip { target: WalkTarget; path: Tile[]; faceLeft: boolean }

const key = (t: Tile) => `${t[0]},${t[1]}`;

/** Every tile under a floor footprint, rugs left out. */
export function blockedTiles(layout: RoomLayout, deps: GeometryDeps = GEOMETRY_DEPS): Set<string> {
  const out = new Set<string>();
  for (const p of layout.pieces) {
    const iso = p.layer === 'floor' ? deps.isoOf(p.item) : undefined;
    if (!iso || iso.flat) continue;
    const a = footOf(p, iso);
    for (let i = a.x0; i < a.x1; i++) for (let j = a.y0; j < a.y1; j++) out.add(`${i},${j}`);
  }
  return out;
}

/** The shortest 4-neighbour path from `from` to `to` (both included) over free tiles, or null. At most 81 tiles. */
export function bfs(from: Tile, to: Tile, n: number, m: number, blocked: ReadonlySet<string>): Tile[] | null {
  const prev = new Map<string, Tile | null>([[key(from), null]]);
  const queue: Tile[] = [from];
  while (queue.length) {
    const t = queue.shift()!;
    if (t[0] === to[0] && t[1] === to[1]) {
      const path: Tile[] = [];
      for (let c: Tile | null = t; c; c = prev.get(key(c)) ?? null) path.unshift(c);
      return path;
    }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next: Tile = [t[0] + di, t[1] + dj];
      if (next[0] < 0 || next[1] < 0 || next[0] >= n || next[1] >= m || prev.has(key(next)) || blocked.has(key(next))) continue;
      prev.set(key(next), t);
      queue.push(next);
    }
  }
  return null;
}

/** Where KIP stands to use a piece (spec §9.2), or null when that tile is taken or off the floor. */
export function standTileOf(layout: RoomLayout, p: Placement, tier: Tier, blocked: ReadonlySet<string>, deps: GeometryDeps = GEOMETRY_DEPS): Tile | null {
  const { n, m } = tierSize(tier);
  const free = (t: Tile) => t[0] >= 0 && t[1] >= 0 && t[0] < n && t[1] < m && !blocked.has(key(t));
  if (p.layer === 'onTop') {
    const parent = layout.pieces.find((q) => q.id === p.parent);
    return parent ? standTileOf(layout, parent, tier, blocked, deps) : null;
  }
  const iso = deps.isoOf(p.item);
  if (!iso) return null;
  let line: Tile[];
  if (p.layer === 'floor') {
    const a = footOf(p, iso);
    line = [];
    if (p.facing === 'R') for (let j = a.y0; j < a.y1; j++) line.push([a.x1, j]);
    else for (let i = a.x0; i < a.x1; i++) line.push([i, a.y1]);
  } else {
    const [along] = iso.wall ?? [1, 1];
    const c = Math.floor((p.x + along / 2) / 2);
    line = [p.layer === 'wallR' ? [c, 0] : [0, c]];
  }
  const mid = (line.length - 1) / 2;
  const nearMiddle = line.map((t, k) => ({ t, d: Math.abs(k - mid), k })).sort((a, b) => a.d - b.d || a.k - b.k);
  return nearMiddle.find(({ t }) => free(t))?.t ?? null;
}

/** KIP standing on `tile` fits wholly inside `view` (room cells). */
export function tileInView(g: Pick<IsoGrid, 'ox' | 'oy'>, tile: Tile, view: Box): boolean {
  const [x, y] = kipTileCell(g, tile);
  return x >= view.x && y >= view.y && x + 32 <= view.x + view.w && y + 32 <= view.y + view.h;
}

const centreX = (g: IsoGrid, layout: RoomLayout, p: Placement, deps: GeometryDeps): number => {
  const P = projOf(g);
  if (p.layer === 'onTop') {
    const parent = layout.pieces.find((q) => q.id === p.parent);
    return parent ? centreX(g, layout, parent, deps) : g.W / 2;
  }
  const iso = deps.isoOf(p.item);
  if (p.layer === 'floor' && iso) { const a = footOf(p, iso); return P((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2)[0]; }
  const along = (p.x + (iso?.wall?.[0] ?? 1) / 2) / 2;
  return p.layer === 'wallR' ? P(along, 0)[0] : P(0, along)[0];
};

/** The running effect pieces and the plants KIP may walk to, standing inside `view` (spec §9.2, ruling 13). */
export function walkTargets(layout: RoomLayout, tier: Tier, effects: RoomEffects, view: Box, deps: GeometryDeps = GEOMETRY_DEPS): WalkTarget[] {
  const g = isoGrid(tier);
  const blocked = blockedTiles(layout, deps);
  const out: WalkTarget[] = [];
  for (const p of layout.pieces) {
    const effect = deps.isoOf(p.item)?.effect;
    const plant = catalogueItem(p.item)?.slot === 'plant';
    let kind: UseKind | null = null;
    if (effect && effects.running.has(p.id)) {
      if (effect === 'wander') kind = effects.states.get(p.id) === 'wander' ? null : 'cat';
      else kind = effect === 'sound' ? 'sound' : 'other';
    } else if (plant) kind = 'plant';
    if (!kind) continue;
    const stand = standTileOf(layout, p, tier, blocked, deps);
    if (stand && tileInView(g, stand, view)) out.push({ id: p.id, kind, stand, x: centreX(g, layout, p, deps) });
  }
  return out;
}

/** One trip: a target other than the last, picked by `rng`, with a path from the seat out by the exit tile. */
export function planTrip(layout: RoomLayout, tier: Tier, effects: RoomEffects, view: Box, last: string | null, rng: () => number, deps: GeometryDeps = GEOMETRY_DEPS): Trip | null {
  const desk = deskOf(layout);
  const iso = desk ? deps.isoOf(desk.item) : undefined;
  const seat = desk && iso ? seatTile(desk, iso) : null;
  const exit = desk && iso ? exitTile(desk, iso) : null;
  if (!seat || !exit) return null;
  const { n, m } = tierSize(tier);
  const blocked = blockedTiles(layout, deps);
  const g = isoGrid(tier);
  const targets = walkTargets(layout, tier, effects, view, deps).filter((t) => t.id !== last);
  // A fair shuffle by rng, then the first target with a path.
  const order = targets.map((t) => ({ t, r: rng() })).sort((a, b) => a.r - b.r || (a.t.id < b.t.id ? -1 : 1)).map((x) => x.t);
  for (const target of order) {
    const path = bfs(exit, target.stand, n, m, blocked);
    if (!path) continue;
    const [kx] = projOf(g)(target.stand[0] + 0.5, target.stand[1] + 0.5);
    return { target, path: [seat, ...path], faceLeft: target.x < kx };
  }
  return null;
}

/** KIP's place at half step `s` (0 to 2 × (path length − 1)), moving forward (dir 1) or back (dir −1). */
export function posAt(path: readonly Tile[], s: number, dir: 1 | -1): { pos: [number, number]; depth: Tile } {
  const k = Math.floor(s / 2);
  const a = path[Math.min(k, path.length - 1)]!;
  const b = path[Math.min(k + 1, path.length - 1)]!;
  if (s % 2 === 0) return { pos: [a[0], a[1]], depth: a };
  return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], depth: dir > 0 ? b : a };
}

/** Screen x is (i − j) × 12: a step that lowers it heads left. */
export function headsLeft(from: readonly [number, number], to: readonly [number, number]): boolean {
  return to[0] - to[1] - (from[0] - from[1]) < 0;
}
```

- [ ] **Step 5: The walk hook**

Create `mobile/src/lib/room/live/useKipWalk.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import type { Box } from '../grid';
import type { RoomEffects } from '../effects';
import type { RoomLayout, Tier } from '../iso/geometry';
import type { Tile } from '../iso/movers';
import { layoutKey } from '../layout';
import type { KipMover } from '../../../components/room/RoomView';
import { STEP_MS, TRIP_MIN_MS, TRIP_SPAN_MS, USE_MS, USE_POSE, headsLeft, planTrip, posAt, type UseKind } from './walk';

export type KipWalk =
  | { phase: 'seat' }
  | { phase: 'walk' | 'use'; pos: [number, number]; depth: Tile; flip: boolean; kind: UseKind; target: string };
const SEAT: KipWalk = { phase: 'seat' };

export interface KipWalkInput {
  enabled: boolean;
  layout: RoomLayout;
  tier: Tier;
  effects: RoomEffects;
  /** The room card's crop in room cells: targets outside it are never picked (spec §9.2). */
  view: Box | null;
  rng?: () => number;
}

/**
 * KIP's trips between answers (spec §9.2). Disabled (a turn, the prompt focused, the screen blurred, Reduce Motion,
 * a bubble) it is on the seat in that same render, with every timer cleared; enabled again, it rests 20–40 s first.
 */
export function useKipWalk({ enabled, layout, tier, effects, view, rng = Math.random }: KipWalkInput): KipWalk {
  const [walk, setWalk] = useState<KipWalk>(SEAT);
  const last = useRef<string | null>(null);
  const inputs = useRef({ layout, tier, effects, view, rng });
  inputs.current = { layout, tier, effects, view, rng };
  const roomKey = `${layoutKey(layout)}#${tier}`;
  useEffect(() => {
    setWalk(SEAT);
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = (ms: number, f: () => void) => { timer = setTimeout(f, ms); };
    const rest = () => later(TRIP_MIN_MS + Math.floor(inputs.current.rng() * TRIP_SPAN_MS), go);
    const go = () => {
      const c = inputs.current;
      const trip = c.view ? planTrip(c.layout, c.tier, c.effects, c.view, last.current, c.rng) : null;
      if (!trip) { rest(); return; }
      last.current = trip.target.id;
      const end = 2 * (trip.path.length - 1);
      const show = (s: number, dir: 1 | -1, phase: 'walk' | 'use') => {
        const here = posAt(trip.path, s, dir);
        const flip = phase === 'use' ? trip.faceLeft : headsLeft(here.pos, posAt(trip.path, Math.max(0, Math.min(end, s + dir)), dir).pos);
        setWalk({ phase, pos: here.pos, depth: here.depth, flip, kind: trip.target.kind, target: trip.target.id });
      };
      const out = (s: number) => {
        if (s >= end) { show(end, 1, 'use'); later(USE_MS, () => back(end)); return; }
        show(s, 1, 'walk');
        later(STEP_MS, () => out(s + 1));
      };
      const back = (s: number) => {
        if (s <= 0) { setWalk(SEAT); rest(); return; }
        show(s - 1, -1, 'walk');
        later(STEP_MS, () => back(s - 1));
      };
      out(0);
    };
    rest();
    return () => { if (timer) clearTimeout(timer); };
  }, [enabled, roomKey]);
  return enabled ? walk : SEAT;
}

/** What RoomView draws for a walk: null at the seat. */
export function walkMover(w: KipWalk): KipMover | null {
  if (w.phase === 'seat') return null;
  const using = w.phase === 'use';
  return { pos: w.pos, depth: w.depth, flip: w.flip, pose: using ? USE_POSE[w.kind] : 'rest', moving: !using, sway: using && w.kind === 'sound' };
}
```

(The type-only import of `KipMover` from `RoomView` creates no runtime cycle.)

- [ ] **Step 6: `RoomView` walks KIP and draws the smile frame; the page decides when**

In `mobile/src/components/room/RoomView.tsx`:
- `import { useKipWalk, walkMover } from '../../lib/room/live/useKipWalk';` and `import { deskBoxes } from '../../lib/room/iso/crop';`
  and `import { isoGrid } from '../../lib/room/iso/grid';`;
- `RoomViewProps` gains:

```ts
  /** The KIP page's room card while KIP may walk (spec §9.2: idle, prompt blurred, no bubble); the view adds focus,
   * Reduce Motion and the editor. */
  kipWalks?: boolean;
  /** The KIP page's idle stage: with a plant in the room, loop frame 2 smiles (ruling 9). */
  idle?: boolean;
```

- before `const kipMover = …`, the walk (its crop is computed from the desk boxes alone, so it never waits on the
  static picture):

```ts
  const g = isoGrid(tier);
  const desk = deskBoxes(g, layout);
  const viewOffset = props.offset ?? isoCrop({ width: crop.width, height: crop.height, cellPt, box: props.box === 'thumb' ? desk.thumb : desk.focus, room: g });
  const view = { x: -viewOffset.x / cellPt, y: -viewOffset.y / cellPt, w: crop.width / cellPt, h: crop.height / cellPt };
  const walk = useKipWalk({ enabled: !!props.kipWalks && !still && !bubble, layout, tier, effects, view });
```

- `const kipMover = props.kipMover ?? walkMover(walk);`
- the smile frame: `kipRects` becomes

```ts
  // With a plant in the room, the idle loop's frame 2 smiles (eyes up) while KIP is at its seat (ruling 9).
  const smile = !!props.idle && effects.plant && !kipMover;
  const kipRects = useMemo(
    () => [0, 1, 2].map((f) => drawKipLayer({ ...kip, frame: f, ...(smile && f === 2 ? { mood: 'curious' as const } : {}) }, seat)) as [Rects, Rects, Rects],
    [poseKey, smile], // eslint-disable-line react-hooks/exhaustive-deps
  );
```

  and `poseKey` gains `#${smile ? 's' : ''}` (so the cached KIP pictures follow it).

In `mobile/src/components/coach/PromptBar.tsx`, `PromptBarProps` gains
`/** The field gained or lost focus (KIP stops walking, spec §9.2). */ onFocusChange?: (focused: boolean) => void;`,
the function takes it, and its `TextInput` gets `onFocus={() => onFocusChange?.(true)}` and
`onBlur={() => onFocusChange?.(false)}`.

In `mobile/src/components/coach/RoomCard.tsx`, the props gain `kipWalks?: boolean` ("the page's part of when KIP
may walk: idle and the prompt blurred"), and its `RoomView` gets:

```tsx
                  kipWalks={!!kipWalks && stage.id === 'idle' && !welcome && !landing && !stage.bubble}
                  idle={stage.id === 'idle'}
```

In `mobile/src/screens/CoachScreen.tsx`:
- `const [promptFocused, setPromptFocused] = useState(false);`
- `<PromptBar … onFocusChange={setPromptFocused} />`
- `<RoomCard … kipWalks={!promptFocused && !streaming} />` (the stage check is RoomCard's own; `streaming` covers the
  turn's first moment).

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/walk.test.ts __tests__/lib/useKipWalk.test.tsx __tests__/lib/kipArt.test.ts __tests__/lib/wornArt.test.ts __tests__/screens/KipGalleryScreen.test.tsx __tests__/components/PromptBar.test.tsx __tests__/components/RoomCard.test.tsx __tests__/components/RoomView.test.tsx __tests__/components/RoomViewMovers.test.tsx __tests__/screens/KipPage.test.tsx __tests__/screens/CoachScreen.test.tsx`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 8: Commit**

```bash
git add mobile/src mobile/jest-mocks mobile/__tests__
git commit -m "feat(kip): KIP walks to the radio, a plant or the cat between answers, and is back at its desk at once"
```

---

### Task 11: Mobile: the cat wanders the front row on the KIP page

Spec §8.2 ("`wander`: walks the front row, then naps in a cat bed (if placed) after 22:00 local"), §8.3 (energy bands),
§9.2 ("The pet uses the same pathing on the front row") and §3.7 (with movers, a list of picture draws). Ruling 10.

**Files:**
- Create: `mobile/src/lib/room/live/catWander.ts`, `mobile/__tests__/lib/catWander.test.tsx`
- Modify: `mobile/src/components/room/RoomView.tsx`, `mobile/src/components/coach/RoomCard.tsx`,
  `mobile/jest-mocks/RoomView.js`, `mobile/__tests__/components/RoomViewMovers.test.tsx`,
  `mobile/__tests__/components/RoomCard.test.tsx`

**Interfaces:**
- Consumes: Task 10's `bfs`, `blockedTiles`, `posAt`, `headsLeft`, `STEP_MS`; Task 9's `PieceMover`; Task 4's
  `RoomEffects`.
- Produces: `PAUSE_STEPS = 6`; `interface CatRoute { id: string; path: Tile[] }`;
  `catRoute(layout, tier, cat: Placement, deps?): Tile[] | null`; `wanderRoutes(layout, tier, effects, deps?): CatRoute[]`;
  `catAt(route, tick): PieceMover`; `useCatWander(input: { enabled; layout; tier; effects }): readonly PieceMover[]`;
  `RoomViewProps.live?: boolean` (the KIP page's room card: the cat may wander).

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/catWander.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native';
import { roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { PAUSE_STEPS, catAt, catRoute, useCatWander, wanderRoutes } from '../../src/lib/room/live/catWander';
import { STEP_MS } from '../../src/lib/room/live/walk';

const cat: Placement = { id: 'p1', item: 'pet.tabby', layer: 'floor', x: 5, y: 3, facing: 'L', mirror: false };
const layout: RoomLayout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat] };
const DAY = { hhmm: '12:00', hour: 12 };
const wander = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, DAY);

it('goes to the nearest free tile of the front row, then up to 3 tiles along it (spec §8.2, ruling 10)', () => {
  expect(catRoute(layout, 1, cat)).toEqual([[5, 3], [5, 4], [5, 5], [5, 6], [4, 6], [3, 6], [2, 6]]);
  const box = [[4, 3], [6, 3], [5, 2], [5, 4]].map(([x, y], k): Placement => ({ id: `b${k}`, item: 'corner.beanbag', layer: 'floor', x: x!, y: y!, facing: 'L', mirror: false }));
  expect(catRoute({ ...layout, pieces: [...layout.pieces, ...box] }, 1, cat)).toBeNull(); // boxed in: it sits
});

it('only a running cat in the wander state wanders: playing, napping or resting it stays put', () => {
  expect(wanderRoutes(layout, 1, wander).map((r) => r.id)).toEqual(['p1']);
  expect(wanderRoutes(layout, 1, roomEffects(layout, 1, { plantStage: 5, petEnergy: 'play', awards: [] }, DAY))).toEqual([]);
  expect(wanderRoutes(layout, 1, roomEffects(layout, 1, { plantStage: 5, petEnergy: 'wander', awards: [] }, { hhmm: '22:30', hour: 22 }))).toEqual([]);
});

it('walks out half a tile a step, pauses 2.4 s, walks home and pauses again, facing the way it goes', () => {
  const route = { id: 'p1', path: catRoute(layout, 1, cat)! };
  const S = 2 * (route.path.length - 1);
  expect(catAt(route, 0)).toMatchObject({ pos: [5, 3] });
  expect(catAt(route, 1)).toMatchObject({ pos: [5, 3.5], depth: [5, 4] });
  expect(catAt(route, S)).toMatchObject({ pos: [2, 6] });
  expect(catAt(route, S + PAUSE_STEPS - 1)).toMatchObject({ pos: [2, 6] });
  expect(catAt(route, 2 * S + PAUSE_STEPS)).toMatchObject({ pos: [5, 3] });
  // Along the front row toward lower i, (i − j) falls: it heads left, mirrored.
  expect([catAt(route, S - 2).flip, catAt(route, S - 1).flip]).toEqual([true, true]);
});

it('useCatWander steps every 400 ms while enabled, and nothing while not', () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(({ on }: { on: boolean }) => useCatWander({ enabled: on, layout, tier: 1, effects: wander }), { initialProps: { on: true } });
  const first = result.current[0]!.pos;
  act(() => { jest.advanceTimersByTime(STEP_MS * 2); });
  expect(result.current[0]!.pos).not.toEqual(first);
  rerender({ on: false });
  expect(result.current).toEqual([]);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
```

In `mobile/__tests__/components/RoomViewMovers.test.tsx`, add:

```tsx
it('the KIP page\'s room lets the cat wander; Reduce Motion, the night and other rooms keep it still (Review Focus 4)', () => {
  const cat = { id: 'p1', item: 'pet.tabby', layer: 'floor' as const, x: 5, y: 3, facing: 'L' as const, mirror: false };
  const bed = { id: 'p2', item: 'pet.bed', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false };
  const layout = { ...starterLayout(), pieces: [...starterLayout().pieces, cat, bed] };
  const living = { plantStage: 5 as const, petEnergy: 'wander' as const, awards: [] };
  jest.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
  // under, the fern, the desk and the bed (three runs), KIP at its seat, the cat mover, the overlay, the loop frame.
  expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} live />))).toHaveLength(8);
  expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} live reduceMotion />))).toHaveLength(4);
  expect(pictures(render(<RoomView {...PROPS} layout={layout} living={living} />))).toHaveLength(4);
  jest.setSystemTime(new Date(2026, 9, 24, 23, 0, 0));
  const night = render(<RoomView {...PROPS} layout={layout} living={living} live reduceMotion />);
  expect(pictures(night)).toHaveLength(4); // curled on its bed, in the static room
  const before = picture.mock.calls.length;
  act(() => { jest.advanceTimersByTime(400 * 3); });
  expect(picture.mock.calls.length - before).toBe(0);
});
```

In `mobile/__tests__/components/RoomCard.test.tsx`, the walking test (Task 10) also checks
`expect(walking.getByTestId('kip-room').props.live).toBe('live');`, with `live: p.live ? 'live' : ''` added to the
stand-in's `propsOf` in `mobile/jest-mocks/RoomView.js`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/catWander.test.tsx __tests__/components/RoomViewMovers.test.tsx`
Expected: FAIL (`live/catWander` does not exist).

- [ ] **Step 3: Write the implementation**

Create `mobile/src/lib/room/live/catWander.ts`:

```ts
// The cat's wander (spec 2026-10-15 §8.2, §9.2; P3 ruling 10): from its own tile to the nearest free tile of the front
// row (j = m − 1, the row nearest you along the left side), then up to 3 tiles along it, toward the side with more
// room; half a tile per 400 ms step, a 2.4 s pause at each end, then home again, round and round. Only a running cat
// in the `wander` state wanders, and only where RoomView animates (the KIP page's room card, Reduce Motion off).
import { useEffect, useMemo, useState } from 'react';
import { GEOMETRY_DEPS } from '../catalogue';
import type { RoomEffects } from '../effects';
import { tierSize, type GeometryDeps, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import type { Tile } from '../iso/movers';
import { layoutKey } from '../layout';
import type { PieceMover } from '../../../components/room/RoomView';
import { STEP_MS, bfs, blockedTiles, headsLeft, posAt } from './walk';

/** 2.4 s at each end of the route. */
export const PAUSE_STEPS = 6;
export interface CatRoute { id: string; path: Tile[] }

export function catRoute(layout: RoomLayout, tier: Tier, cat: Placement, deps: GeometryDeps = GEOMETRY_DEPS): Tile[] | null {
  const { n, m } = tierSize(tier);
  const blocked = blockedTiles(layout, deps);
  blocked.delete(`${cat.x},${cat.y}`);
  const home: Tile = [cat.x, cat.y];
  const front = m - 1;
  let best: Tile[] | null = null;
  for (let i = 0; i < n; i++) {
    const p = bfs(home, [i, front], n, m, blocked);
    if (p && (!best || p.length < best.length)) best = p;
  }
  if (!best) return null;
  const end = best[best.length - 1]!;
  const along = (dir: 1 | -1): Tile[] => {
    const out: Tile[] = [];
    for (let k = 1; k <= 3; k++) {
      const t: Tile = [end[0] + dir * k, front];
      if (t[0] < 0 || t[0] >= n || blocked.has(`${t[0]},${t[1]}`)) break;
      out.push(t);
    }
    return out;
  };
  const right = along(1);
  const left = along(-1);
  const path = [...best, ...(right.length >= left.length ? right : left)];
  return path.length > 1 ? path : null;
}

export function wanderRoutes(layout: RoomLayout, tier: Tier, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS): CatRoute[] {
  return layout.pieces
    .filter((p) => p.layer === 'floor' && effects.running.has(p.id) && effects.states.get(p.id) === 'wander' && deps.isoOf(p.item)?.effect === 'wander')
    .flatMap((p) => {
      const path = catRoute(layout, tier, p, deps);
      return path ? [{ id: p.id, path }] : [];
    });
}

/** Where a cat is at step `tick` of its round: out, a pause, back, a pause. */
export function catAt(r: CatRoute, tick: number): PieceMover {
  const S = 2 * (r.path.length - 1);
  const c = tick % (2 * (S + PAUSE_STEPS));
  const [s, dir]: [number, 1 | -1] = c <= S ? [c, 1] : c < S + PAUSE_STEPS ? [S, 1] : c <= 2 * S + PAUSE_STEPS ? [2 * S + PAUSE_STEPS - c, -1] : [0, -1];
  const here = posAt(r.path, s, dir);
  const next = posAt(r.path, Math.max(0, Math.min(S, s + dir)), dir);
  return { id: r.id, pos: here.pos, depth: here.depth, flip: headsLeft(here.pos, next.pos) };
}

export function useCatWander({ enabled, layout, tier, effects }: { enabled: boolean; layout: RoomLayout; tier: Tier; effects: RoomEffects }): readonly PieceMover[] {
  // Keyed on the wandering cats, not the whole effects key: the clock's minute never sends the cat home.
  const cats = [...effects.states].filter(([, s]) => s === 'wander').map(([id]) => id).sort().join(',');
  const key = enabled ? `${layoutKey(layout)}#${tier}#${cats}` : '';
  const routes = useMemo(() => (enabled ? wanderRoutes(layout, tier, effects) : []), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    if (!routes.length) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => clearInterval(id);
  }, [routes]);
  return useMemo(() => routes.map((r) => catAt(r, tick)), [routes, tick]);
}
```

In `mobile/src/components/room/RoomView.tsx`:
- `import { useCatWander } from '../../lib/room/live/catWander';`
- `RoomViewProps` gains `/** The KIP page's room card: the cat may wander (spec §8.2). */ live?: boolean;`
- `const pieceMovers = props.pieceMovers ?? NO_MOVERS;` becomes:

```ts
  const catMovers = useCatWander({ enabled: !!props.live && !still, layout, tier, effects });
  const pieceMovers = props.pieceMovers ?? catMovers;
```

In `mobile/src/components/coach/RoomCard.tsx`, its `RoomView` gets `live`.

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/catWander.test.tsx __tests__/components/RoomViewMovers.test.tsx __tests__/components/RoomView.test.tsx __tests__/components/RoomCard.test.tsx __tests__/lib/walk.test.ts`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 5: Commit**

```bash
git add mobile/src mobile/jest-mocks mobile/__tests__
git commit -m "feat(room): the ginger cat wanders the front row of KIP's room"
```

---

### Task 12: Mobile: the radio's sound (`expo-audio`, one bundled loop, off until turned on)

Spec §0 ("**Radio sound:** `expo-audio` is added in P3 with one bundled 20-second loop (under 300 KB), off until
turned on"), §8.2 ("a quiet lo-fi loop while the room is open … **Sound is off until you turn it on** in its card; the
switch is remembered on the device"). Ruling 15.

**Files:**
- Create: `mobile/scripts/make-radio-loop.mjs`, `mobile/assets/sounds/radio-loop.m4a` (generated by the script),
  `mobile/src/lib/room/sound.ts`, `mobile/src/components/room/RoomRadio.tsx`, `mobile/__tests__/lib/roomSound.test.ts`,
  `mobile/__tests__/components/RoomRadio.test.tsx`
- Modify: `mobile/package.json`, `mobile/package-lock.json` (by `npx expo install expo-audio`), `mobile/jest-setup.js`,
  `mobile/src/components/coach/RoomCard.tsx`, `mobile/__tests__/components/RoomCard.test.tsx`

**Interfaces:**
- Consumes: Task 4's `useRoomEffects`, `effectOf`; `expo-secure-store` (the `kipRoomPrefs.ts` pattern).
- Produces: `loadRoomSound(): Promise<boolean>`, `setRoomSound(on: boolean): Promise<void>`, `getRoomSound(): boolean`,
  `useRoomSound(): boolean`, `resetRoomSound(): void`, `ROOM_SOUND_KEY = 'kipRoomSound'` (sound.ts);
  `RADIO_VOLUME = 0.35`, `RoomRadio({ active: boolean })` (RoomRadio.tsx); `runsSound(layout, effects): boolean`
  (RoomCard.tsx, exported for Task 13).

- [ ] **Step 1: Add the module and the loop**

From `mobile/`: `npx expo install expo-audio` (adds `"expo-audio": "~57.0.5"` to `dependencies`; nothing else). Confirm
`__tests__/conventions/earnOnly.test.ts` still passes (no money segment in `expo-audio`).

Create `mobile/scripts/make-radio-loop.mjs`:

```js
#!/usr/bin/env node
// Builds KIP's radio loop (spec 2026-10-15 §0, §8.2; P3 ruling 15): 20 seconds of quiet lo-fi in A minor at 72 bpm
// (6 bars, so it loops seamlessly: every voice is silent at a bar line), mono, encoded to AAC at 64 kb/s by macOS
// `afconvert` (about 160 KB, under the 300 KB budget). Deterministic: the same file every run. Logs its length and
// size only. Run from mobile/: node scripts/make-radio-loop.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const RATE = 22050;
const BEAT = 60 / 72;
const BARS = 6;
const SECONDS = BARS * 4 * BEAT; // 20 s
const N = Math.round(SECONDS * RATE);
const OUT = join(process.cwd(), 'assets/sounds/radio-loop.m4a');

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Am7, Fmaj7, Cmaj7, G6, Am7, Fmaj7: the last bar leads back to the first.
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64], [57, 60, 64, 67], [53, 57, 60, 64]];
const ROOTS = [45, 41, 36, 43, 45, 41];
const SCALE = [69, 72, 74, 76, 79, 81]; // A minor pentatonic, high and soft

let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const mix = new Float32Array(N);
const add = (start, dur, f) => {
  const a = Math.max(0, Math.floor(start * RATE));
  const b = Math.min(N, Math.floor((start + dur) * RATE));
  for (let i = a; i < b; i++) mix[i] += f((i - a) / RATE, (i - a) / (b - a));
};
const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;

for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * 4 * BEAT;
  // The pad: each chord tone a sine that swells in and out over its bar (silent at both bar lines).
  for (const note of CHORDS[bar]) add(t0, 4 * BEAT, (t, u) => 0.06 * Math.sin(2 * Math.PI * hz(note) * t) * Math.sin(Math.PI * u));
  // The bass on beats 1 and 3, fading out before the next.
  for (const beat of [0, 2]) add(t0 + beat * BEAT, 1.5 * BEAT, (t, u) => 0.12 * tri(hz(ROOTS[bar]) * t) * (1 - u) * Math.min(1, t * 200));
  // A brushed hat on the off-beats.
  for (let e = 1; e < 8; e += 2) add(t0 + (e * BEAT) / 2, 0.06, (_t, u) => 0.03 * (rand() * 2 - 1) * (1 - u));
  // A few plucked melody notes, each gone before the bar line.
  for (let e = 0; e < 7; e++) {
    if (rand() >= 0.35) continue;
    const note = SCALE[Math.floor(rand() * SCALE.length)];
    add(t0 + (e * BEAT) / 2, BEAT / 2, (t, u) => 0.05 * Math.sin(2 * Math.PI * hz(note) * t) * Math.exp(-6 * t) * Math.min(1, t * 300) * (1 - u));
  }
}
// Vinyl crackle: rare, tiny clicks.
for (let i = 0; i < N; i++) if (rand() < 0.0006) mix[i] += (rand() - 0.5) * 0.08;
// A one-pole low-pass for warmth, run twice round the loop so its start and end agree.
let y = 0;
for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { y += 0.18 * (mix[i] - y); if (pass === 1) mix[i] = y; }

const peak = mix.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const wav = Buffer.alloc(44 + N * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 2, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) wav.writeInt16LE(Math.round((mix[i] / peak) * 0.5 * 32767), 44 + i * 2);

const tmp = mkdtempSync(join(tmpdir(), 'kip-radio-'));
const src = join(tmp, 'radio-loop.wav');
writeFileSync(src, wav);
mkdirSync(dirname(OUT), { recursive: true });
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', src, OUT]);
rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ event: 'radio.loop', seconds: Number(SECONDS.toFixed(2)), bytes: statSync(OUT).size }));
```

Run it from `mobile/`: `node scripts/make-radio-loop.mjs`. Expected: one line, `seconds` 20, `bytes` under 307200.
OWNER NOTE: the loop is a simple generated tune in the room's mood; the owner may replace the file with any 20-second
loop under 300 KB (the tests check its size, not its notes).

In `mobile/jest-setup.js`, after the `expo-crypto` mock:

```js
// The radio's loop (P3 ruling 15): one fake player tests can inspect through the module's __player.
const mockAudioPlayer = { play: jest.fn(), pause: jest.fn(), remove: jest.fn(), loop: false, volume: 1 };
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => mockAudioPlayer),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  __player: mockAudioPlayer,
}));
```

- [ ] **Step 2: Write the failing tests**

Create `mobile/__tests__/lib/roomSound.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as SecureStore from 'expo-secure-store';
import { ROOM_SOUND_KEY, getRoomSound, loadRoomSound, resetRoomSound, setRoomSound } from '../../src/lib/room/sound';

jest.mock('expo-secure-store');
const store = SecureStore as jest.Mocked<typeof SecureStore>;
afterEach(() => { resetRoomSound(); jest.clearAllMocks(); });

it('is off until you turn it on, and remembers the switch on this device only (spec §8.2)', async () => {
  store.getItemAsync.mockResolvedValueOnce(null);
  expect(await loadRoomSound()).toBe(false);
  await setRoomSound(true);
  expect(store.setItemAsync).toHaveBeenCalledWith(ROOM_SOUND_KEY, '1');
  expect(getRoomSound()).toBe(true);
  store.getItemAsync.mockResolvedValueOnce('1');
  expect(await loadRoomSound()).toBe(true);
});

it('a keychain failure reads as off, and a failed write keeps the choice for the session', async () => {
  store.getItemAsync.mockRejectedValueOnce(new Error('locked'));
  expect(await loadRoomSound()).toBe(false);
  store.setItemAsync.mockRejectedValueOnce(new Error('locked'));
  await setRoomSound(true);
  expect(getRoomSound()).toBe(true);
});

it('bundles one loop of about 20 seconds under 300 KB (spec §0)', () => {
  const bytes = fs.statSync(path.join(__dirname, '../../assets/sounds/radio-loop.m4a')).size;
  expect(bytes).toBeGreaterThan(40 * 1024); // 20 s at 64 kb/s is about 160 KB
  expect(bytes).toBeLessThan(300 * 1024);
});
```

Create `mobile/__tests__/components/RoomRadio.test.tsx`:

```tsx
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as Audio from 'expo-audio';
import { RADIO_VOLUME, RoomRadio } from '../../src/components/room/RoomRadio';
import { resetRoomSound, setRoomSound } from '../../src/lib/room/sound';

jest.mock('expo-secure-store');
const player = (Audio as unknown as { __player: { play: jest.Mock; pause: jest.Mock; loop: boolean; volume: number } }).__player;
let appState: (s: AppStateStatus) => void = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
  resetRoomSound();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => { appState = cb as (s: AppStateStatus) => void; return { remove: jest.fn() } as never; });
});

it('stays silent with the switch off, the default (Review Focus 3)', async () => {
  render(<RoomRadio active />);
  await act(async () => undefined);
  expect(player.play).not.toHaveBeenCalled();
  expect([player.loop, player.volume]).toEqual([true, RADIO_VOLUME]);
});

it('plays the loop with the switch on, and pauses when the room is covered, blurred or backgrounded', async () => {
  const s = render(<RoomRadio active />);
  await act(async () => undefined);
  await act(async () => { await setRoomSound(true); });
  expect(player.play).toHaveBeenCalledTimes(1);
  s.rerender(<RoomRadio active={false} />);
  expect(player.pause).toHaveBeenCalled();
  s.rerender(<RoomRadio active />);
  expect(player.play).toHaveBeenCalledTimes(2);
  act(() => appState('background'));
  expect(player.pause.mock.calls.length).toBeGreaterThanOrEqual(2);
  act(() => appState('active'));
  expect(player.play).toHaveBeenCalledTimes(3);
  await act(async () => { await setRoomSound(false); });
  expect(player.play).toHaveBeenCalledTimes(3);
  s.unmount();
});
```

In `mobile/__tests__/components/RoomCard.test.tsx`, add (with `import * as Audio from 'expo-audio';`):

```tsx
it('mounts the radio\'s sound only while a running radio is in the room (ruling 15)', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO());
  await act(async () => { await loadCosmetics(); });
  renderCard();
  expect(Audio.useAudioPlayer).not.toHaveBeenCalled();
  const radio = { id: 'p1', item: 'item.radio', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 1 };
  (fetchCosmetics as jest.Mock).mockResolvedValueOnce(cosmeticsDTO({ version: 2, layout: { ...starterLayout(), pieces: [...starterLayout().pieces, radio] }, counts: { ...cosmeticsDTO().counts, 'item.radio': 1 } }));
  await act(async () => { await loadCosmetics({ fresh: true }); });
  renderCard();
  expect(Audio.useAudioPlayer).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/roomSound.test.ts __tests__/components/RoomRadio.test.tsx`
Expected: FAIL (`lib/room/sound` and `RoomRadio` do not exist).

- [ ] **Step 4: Write the implementation**

Create `mobile/src/lib/room/sound.ts`:

```ts
import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

// The radio's sound switch (spec 2026-10-15 §8.2, P3 ruling 15): off until you turn it on, remembered on this device
// only, never sent to the server. The repo's device-storage pattern (kipRoomPrefs.ts): a keychain failure reads as off.
export const ROOM_SOUND_KEY = 'kipRoomSound';

let on = false;
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  if (next === on) return;
  on = next;
  listeners.forEach((l) => l());
};

export async function loadRoomSound(): Promise<boolean> {
  try {
    publish((await SecureStore.getItemAsync(ROOM_SOUND_KEY)) === '1');
  } catch {
    publish(false);
  }
  return on;
}

export async function setRoomSound(next: boolean): Promise<void> {
  publish(next);
  try {
    await SecureStore.setItemAsync(ROOM_SOUND_KEY, next ? '1' : '0');
  } catch {
    // The choice still holds for this session.
  }
}

export function getRoomSound(): boolean {
  return on;
}

export function resetRoomSound(): void {
  publish(false);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useRoomSound(): boolean {
  return useSyncExternalStore(subscribe, getRoomSound, getRoomSound);
}
```

Create `mobile/src/components/room/RoomRadio.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { loadRoomSound, useRoomSound } from '../../lib/room/sound';

/** Quiet: the room's loop sits under whatever else is playing. */
export const RADIO_VOLUME = 0.35;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RADIO_LOOP = require('../../../assets/sounds/radio-loop.m4a');

/**
 * The radio's lo-fi loop (spec 2026-10-15 §8.2, P3 ruling 15). The room card mounts this only while a running radio is
 * in the room; it plays only with the device switch on, while `active` (the KIP page focused, the room shown, the editor
 * not over it) and the app in the foreground. It honours the silent switch and mixes with other audio. Renders nothing.
 */
export function RoomRadio({ active }: { active: boolean }) {
  const on = useRoomSound();
  const player = useAudioPlayer(RADIO_LOOP);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    void loadRoomSound();
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  const play = active && on && foreground;
  useEffect(() => {
    player.loop = true;
    player.volume = RADIO_VOLUME;
    if (play) player.play();
    else player.pause();
  }, [player, play]);
  useEffect(() => () => player.pause(), [player]);
  return null;
}
```

If the installed `expo-audio`'s `AudioMode` type names `interruptionMode`'s values differently, keep the key and use
its "mix with others" value; `playsInSilentMode: false` stays (the silent switch wins).

In `mobile/src/components/coach/RoomCard.tsx`:
- imports: `RoomRadio` from `../room/RoomRadio`, `useRoomEffects` from `../room/useRoomEffects`, `effectOf` and
  `type RoomEffects` from `../../lib/room/effects`, `type RoomLayout` from `../../lib/room/iso/geometry`;
- above the component:

```ts
/** A running radio is in the room (spec §8.2): only then is its sound mounted. */
export function runsSound(layout: RoomLayout, effects: RoomEffects): boolean {
  return layout.pieces.some((p) => effects.running.has(p.id) && effectOf(p.item) === 'sound');
}
```

- in the component, after `useMyRoom()`: `const effects = useRoomEffects(layout, tier, living);`
- inside the `Card`, after the `coins-landed` text:

```tsx
      {runsSound(layout, effects) ? <RoomRadio active={focused && !paused && stage.id !== 'loading' && inner > 0} /> : null}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/roomSound.test.ts __tests__/components/RoomRadio.test.tsx __tests__/components/RoomCard.test.tsx __tests__/conventions`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 6: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/jest-setup.js mobile/scripts/make-radio-loop.mjs mobile/assets/sounds/radio-loop.m4a mobile/src mobile/__tests__
git commit -m "feat(room): the old radio plays a quiet lo-fi loop, off until you turn it on"
```

---

### Task 13: Mobile: the piece card, tapping the room, and the tap squash

Spec §8.1 ("**Piece card** (F7): tapping an effect piece in view mode … opens a sheet: name, where it goes, how it was
earned or its price, its effect line, and any switch (sound), with Move and Store"), §8.2 (the radio's switch; the
duck's squash), §8.3 (words the room uses), §5.7 ("the room is one image in view mode") and F7. Rulings 16–18.

**Files:**
- Create: `mobile/src/lib/room/card.ts`, `mobile/src/screens/PieceCardScreen.tsx`, `mobile/__tests__/lib/pieceCard.test.ts`,
  `mobile/__tests__/screens/PieceCardScreen.test.tsx`
- Modify: `mobile/src/lib/room/roomCopy.ts`, `mobile/src/lib/room/edit/editor.ts` (`DecorateParams`),
  `mobile/src/screens/DecorateRoomScreen.tsx` (`initialState`), `mobile/src/components/room/RoomView.tsx`,
  `mobile/src/components/coach/RoomCard.tsx`, `mobile/src/screens/CoachScreen.tsx`,
  `mobile/src/navigation/RootNavigator.tsx`, `mobile/jest-mocks/RoomView.js`, `mobile/__tests__/lib/roomCopy.test.ts`,
  `mobile/__tests__/components/RoomCard.test.tsx`, `mobile/__tests__/components/RoomViewMovers.test.tsx`,
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 4's `roomEffects`, `withState`, `effectOf`, `ROOM_COPY.effects`; Task 5's `useClockMinute`; Task 8's
  `whereLine`; Task 9's `RoomViewHandle`; Task 12's `useRoomSound`, `setRoomSound`, `loadRoomSound`.
- Produces: `interface PieceCardModel { id; item; name; nameSpoken; where; earned; effect; state; resting; sound }`;
  `pieceCard(layout, tier, living, now, id, deps?): PieceCardModel | null`;
  `cardPieces(layout, effects, deps?): Array<{ id: string; label: string }>`;
  `type PieceTap = 'card' | 'squash' | 'none'`, `pieceTap(layout, id, effects, deps?): PieceTap`;
  `ROOM_COPY.card`; `RoomViewHandle.squash(id: string): void`; `RoomViewProps.pieceActions` / `onPieceAction`;
  `RoomCard` prop `onOpenPiece?: (pieceId: string) => void`; route `PieceCard: { pieceId: string }`;
  `DecorateParams.select?: string`, `DecorateParams.store?: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/__tests__/lib/pieceCard.test.ts`:

```ts
import { GEOMETRY_DEPS } from '../../src/lib/room/catalogue';
import { NEUTRAL_LIVING, roomEffects } from '../../src/lib/room/effects';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { cardPieces, pieceCard, pieceTap } from '../../src/lib/room/card';

const at = (id: string, item: string, over: Partial<Placement> = {}): Placement => ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });
const room = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const DAY = { hhmm: '12:00', hour: 12 };

it('the radio\'s card: where it goes, the coin shop and its price, what it does and the sound switch (spec §8.1, F7)', () => {
  const l = room(at('p1', 'item.radio', { layer: 'onTop', parent: 'desk', spot: 1 }));
  expect(pieceCard(l, 1, NEUTRAL_LIVING, DAY, 'p1')).toEqual({
    id: 'p1', item: 'item.radio', name: 'Old radio', nameSpoken: 'Old radio',
    where: { text: 'Shelf, desk or floor · 1 tile', spoken: 'Shelf, desk or floor, 1 tile' },
    earned: { text: 'From the coin shop · 150 coins', spoken: 'From the coin shop, 150 coins' },
    effect: 'Plays a quiet lo-fi loop while the room is open. Notes float up from it.',
    state: null, resting: null, sound: true,
  });
});

it('a plant\'s card says how it grew, the cat\'s how it is, the shelf how many awards: never advice (spec §8.3)', () => {
  const living = { plantStage: 3 as const, petEnergy: 'play' as const, awards: [5, 4] };
  const l = room(at('p1', 'pet.tabby', { x: 6, y: 6 }), at('p2', 'shelf.awards', { layer: 'wallR', x: 0, y: 12 }));
  expect(pieceCard(l, 1, living, DAY, 'plant')).toMatchObject({ effect: 'KIP looks a little happier with a plant in the room.', state: 'The fern grew: 14 nights at your goal.' });
  expect(pieceCard(l, 1, { ...living, plantStage: 1 }, DAY, 'plant')!.state).toBe('The fern is just starting out.');
  expect(pieceCard(l, 1, living, DAY, 'p1')!.state).toBe('The cat’s playing.');
  expect(pieceCard(l, 1, living, { hhmm: '23:00', hour: 23 }, 'p1')!.state).toBe('The cat’s napping.');
  expect(pieceCard(l, 1, living, DAY, 'p2')!.state).toBe('2 awards so far.');
  expect(pieceCard(l, 1, living, DAY, 'p2')!.earned).toEqual({ text: 'In every room from day one', spoken: 'In every room from day one' });
});

it('an inert piece says it rests, and a missing piece has no card (ruling 5)', () => {
  const clocks = ['p1', 'p2', 'p3', 'p4'].map((id, k) => at(id, 'art.clock', { layer: k < 2 ? 'wallR' : 'wallL', x: k % 2 ? 10 : 0 }));
  expect(pieceCard(room(...clocks), 1, NEUTRAL_LIVING, DAY, 'p4')!.resting).toBe('Resting. This room runs 3 effects at a time.');
  expect(pieceCard(room(...clocks), 1, NEUTRAL_LIVING, DAY, 'p1')!.resting).toBeNull();
  expect(pieceCard(starterLayout(), 1, NEUTRAL_LIVING, DAY, 'nope')).toBeNull();
});

it('a tap opens the card of an effect piece or a plant, squashes a running tap piece, and passes over the rest', () => {
  const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }));
  const e = roomEffects(l, 1, NEUTRAL_LIVING, null);
  expect([pieceTap(l, 'p1', e), pieceTap(l, 'plant', e), pieceTap(l, 'rug', e), pieceTap(l, 'desk', e)]).toEqual(['card', 'card', 'none', 'none']);
  const deps = { isoOf: (id: string) => (id === 'item.mug' ? { ...GEOMETRY_DEPS.isoOf(id)!, effect: 'tap' as const } : GEOMETRY_DEPS.isoOf(id)) };
  expect(pieceTap(starterLayout(), 'deskitem', roomEffects(starterLayout(), 1, NEUTRAL_LIVING, null, deps), deps)).toBe('squash');
});

it('a screen reader reaches each card through the room image\'s actions, read without "·"', () => {
  const l = room(at('p1', 'corner.floorlamp', { x: 6, y: 6 }));
  const actions = cardPieces(l, roomEffects(l, 1, NEUTRAL_LIVING, null));
  expect(actions).toEqual([{ id: 'plant', label: 'Fern card' }, { id: 'p1', label: 'Floor lamp card' }]);
  for (const a of actions) expect(a.label).not.toMatch(/·|×/);
});
```

Create `mobile/__tests__/screens/PieceCardScreen.test.tsx`:

```tsx
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { starterLayout } from '../../src/lib/room/layout';
import { getRoomSound, resetRoomSound } from '../../src/lib/room/sound';
import { PieceCardScreen } from '../../src/screens/PieceCardScreen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('expo-secure-store');
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(), postRoomWelcomed: jest.fn() }));
const mockNav = { goBack: jest.fn(), navigate: jest.fn() };
let mockParams: object = { pieceId: 'p1' };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

async function open(pieceId = 'p1') {
  mockParams = { pieceId };
  const radio = { id: 'p1', item: 'item.radio', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 1 };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout: { ...starterLayout(), pieces: [...starterLayout().pieces, radio] }, counts: { ...cosmeticsDTO().counts, 'item.radio': 1 } }));
  await act(async () => { await loadCosmetics(); });
  const s = render(<PieceCardScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCosmetics(); resetRoomSound(); (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null); });

it('shows the radio\'s card and takes a screen reader\'s focus on its name (spec §8.1, house pattern)', async () => {
  const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => undefined);
  const s = await open();
  expect(s.getByTestId('card-name')).toHaveTextContent('Old radio');
  expect(s.getByTestId('card-effect')).toHaveTextContent('Plays a quiet lo-fi loop while the room is open.');
  expect(s.getByTestId('card-earned').props.accessibilityLabel).toBe('From the coin shop, 150 coins');
  expect(focus).toHaveBeenCalled();
  focus.mockRestore();
});

it('the sound switch starts off and is remembered on the device (spec §8.2, ruling 15)', async () => {
  const s = await open();
  expect(s.getByTestId('card-sound').props.value).toBe(false);
  await act(async () => { fireEvent(s.getByTestId('card-sound'), 'valueChange', true); });
  expect(getRoomSound()).toBe(true);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('kipRoomSound', '1');
});

it('Move and Store open the editor with the piece selected; Store has already stored it (ruling 16)', async () => {
  const s = await open();
  fireEvent.press(s.getByTestId('card-store'));
  expect(mockNav.goBack).toHaveBeenCalled();
  expect(mockNav.navigate).toHaveBeenCalledWith('DecorateRoom', { select: 'p1', store: true });
  fireEvent.press(s.getByTestId('card-move'));
  expect(mockNav.navigate).toHaveBeenLastCalledWith('DecorateRoom', { select: 'p1' });
});

it('a piece that has left the room says so', async () => {
  const s = await open('gone');
  expect(s.getByTestId('card-gone')).toBeTruthy();
});
```

In `mobile/__tests__/lib/roomCopy.test.ts`, the advice guard's `lines` become
`[...copyStrings(ROOM_COPY.effects), ...copyStrings(ROOM_COPY.card)]`.

In `mobile/__tests__/components/RoomCard.test.tsx`, add (with `const RoomViewMock = jest.requireMock('../../src/components/room/RoomView');`):

```tsx
it('a tap on an effect piece or a plant opens its card; a tap elsewhere does nothing (spec §8.1)', async () => {
  const onOpenPiece = jest.fn();
  const s = renderCard({ onOpenPiece });
  RoomViewMock.__setPieceAt(() => 'plant');
  fireEvent.press(s.getByTestId('kip-room-press'), { nativeEvent: { locationX: 120, locationY: 90 } });
  expect(onOpenPiece).toHaveBeenCalledWith('plant');
  RoomViewMock.__setPieceAt(() => 'rug');
  fireEvent.press(s.getByTestId('kip-room-press'), { nativeEvent: { locationX: 10, locationY: 10 } });
  expect(onOpenPiece).toHaveBeenCalledTimes(1);
  RoomViewMock.__setPieceAt(() => null);
  expect(s.getByTestId('kip-room').props.accessibilityActions).toEqual([{ name: 'plant', label: 'Fern card' }]);
});
```

In `mobile/__tests__/components/RoomViewMovers.test.tsx`, add:

```tsx
it('a tapped piece squashes over two frames and springs back; never under Reduce Motion (ruling 17)', () => {
  const ref = createRef<RoomViewHandle>();
  const s = render(<RoomView {...PROPS} ref={ref} />);
  const [back, , front] = pictures(s);
  act(() => ref.current!.squash('plant'));
  expect(pictures(s)[0] !== back || pictures(s)[2] !== front).toBe(true);
  act(() => { jest.advanceTimersByTime(800); });
  const calm = render(<RoomView {...PROPS} ref={ref} reduceMotion />);
  const before = picture.mock.calls.length;
  act(() => ref.current!.squash('plant'));
  expect(picture.mock.calls.length - before).toBe(0);
  calm.unmount();
});
```

In `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`, add:

```tsx
it('opened from a piece card\'s Store, the piece is selected and already stored, ready for Done (ruling 16)', async () => {
  const s = await openEditor({ select: 'plant', store: true });
  expect(s.getByTestId('edit-count')).toHaveTextContent('6 / 40 in room');
  expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/pieceCard.test.ts __tests__/screens/PieceCardScreen.test.tsx`
Expected: FAIL (`lib/room/card` and `PieceCardScreen` do not exist).

- [ ] **Step 3: The card's model and copy**

In `mobile/src/lib/room/roomCopy.ts`, add to `ROOM_COPY` after `effects`:

```ts
  /** The piece card (spec 2026-10-15 §8.1, F7). Never advice (P3 ruling 18). */
  card: {
    close: 'Close',
    effectTitle: 'EFFECT',
    price: (coins: string) => `${coins} coins`,
    sound: 'Play sound in the room',
    soundHint: 'Sound is off until you turn it on.',
    move: 'Move',
    store: 'Store',
    moveLabel: (name: string) => `Move the ${name}`,
    storeLabel: (name: string) => `Store the ${name}`,
    open: (name: string) => `${name} card`,
    gone: 'That piece has left your room.',
  },
```

Create `mobile/src/lib/room/card.ts`:

```ts
// The piece card (spec 2026-10-15 §8.1, F7; P3 rulings 16-18), pure: what a tapped effect piece or plant is, where it
// goes, how it was earned (or the coin shop and its price), what it does, how it is now (the living room's words, never
// advice), whether it rests, and whether it has a sound switch. Also what a tap on the room does, and the room image's
// actions for a screen reader.
import { whereLine } from '../coins/shop';
import { GEOMETRY_DEPS, catalogueItem } from './catalogue';
import { roomEffects, type ClockNow, type Living, type PetEnergy, type RoomEffects } from './effects';
import { lowerName } from './edit/labels';
import type { GeometryDeps, RoomLayout, Tier } from './iso/geometry';
import { ROOM_COPY, coinCount, itemName, spokenName, unlockLine, unlockSpoken } from './roomCopy';

export interface PieceCardModel {
  id: string;
  item: string;
  name: string;
  nameSpoken: string;
  where: { text: string; spoken: string };
  earned: { text: string; spoken: string };
  effect: string | null;
  state: string | null;
  resting: string | null;
  sound: boolean;
}

const E = ROOM_COPY.effects;
const C = ROOM_COPY.card;

export function pieceCard(layout: RoomLayout, tier: Tier, living: Living, now: ClockNow | null, id: string, deps: GeometryDeps = GEOMETRY_DEPS): PieceCardModel | null {
  const p = layout.pieces.find((q) => q.id === id);
  const item = p ? catalogueItem(p.item) : undefined;
  if (!p || !item?.iso) return null;
  const effects = roomEffects(layout, tier, living, now, deps);
  const kind = deps.isoOf(p.item)?.effect;
  const plant = item.slot === 'plant';
  const running = effects.running.has(p.id);
  const shop = item.unlock.kind === 'shop' && item.price !== undefined;
  const rule = unlockLine(item.unlock);
  const earned = shop
    ? { text: `${rule} · ${C.price(coinCount(item.price!))}`, spoken: `${unlockSpoken(item.unlock)}, ${C.price(coinCount(item.price!))}` }
    : { text: rule, spoken: unlockSpoken(item.unlock) };
  const name = itemName(p.item);
  let state: string | null = null;
  if (plant) state = living.plantStage > 1 ? E.grew(lowerName(name), (living.plantStage - 1) * 7) : E.sprout(lowerName(name));
  else if (kind === 'wander' && running) state = E.pet[(effects.states.get(p.id) as PetEnergy | undefined) ?? 'wander'];
  else if (kind === 'awards' && running) state = E.awardCount(Math.min(8, living.awards.length));
  return {
    id: p.id, item: p.item, name, nameSpoken: spokenName(p.item), where: whereLine(p.item), earned,
    effect: kind ? E.lines[kind] : plant ? E.plant : null,
    state,
    resting: kind && !running ? E.resting(effects.slots) : null,
    sound: kind === 'sound',
  };
}

export type PieceTap = 'card' | 'squash' | 'none';

/** What a tap on a piece does in view mode (rulings 16-17). */
export function pieceTap(layout: RoomLayout, id: string, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS): PieceTap {
  const p = layout.pieces.find((q) => q.id === id);
  if (!p) return 'none';
  const kind = deps.isoOf(p.item)?.effect;
  if (kind === 'tap') return effects.running.has(p.id) ? 'squash' : 'card';
  return kind || catalogueItem(p.item)?.slot === 'plant' ? 'card' : 'none';
}

/** The room image's custom actions (spec §5.7: the room stays one image), one per card, plants first by id. */
export function cardPieces(layout: RoomLayout, effects: RoomEffects, deps: GeometryDeps = GEOMETRY_DEPS): Array<{ id: string; label: string }> {
  return layout.pieces
    .filter((p) => pieceTap(layout, p.id, effects, deps) === 'card')
    .sort((a, b) => Number(!!deps.isoOf(a.item)?.effect) - Number(!!deps.isoOf(b.item)?.effect) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => ({ id: p.id, label: C.open(spokenName(p.item)) }));
}
```

- [ ] **Step 4: The card's route**

Create `mobile/src/screens/PieceCardScreen.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Switch, View, findNodeHandle, type Text as RNText } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button } from '../components/ui/button';
import { Text } from '../components/ui/text';
import { useMyRoom } from '../lib/room/cosmeticsStore';
import { pieceCard } from '../lib/room/card';
import { lowerName } from '../lib/room/edit/labels';
import { ROOM_COPY } from '../lib/room/roomCopy';
import { loadRoomSound, setRoomSound, useRoomSound } from '../lib/room/sound';
import { useClockMinute } from '../lib/room/useClockMinute';
import { useColorScheme } from 'nativewind';
import { COLORS } from '../theme';

const C = ROOM_COPY.card;
const TARGET = 'h-[44px]';

// The piece card (spec 2026-10-15 §8.1, F7; P3 ruling 16): a native sheet over the KIP page, opened by tapping an
// effect piece or a plant in the room, or through the room image's actions. Name, where it goes, how it was earned, what
// it does and how it is now; the radio's sound switch; Move and Store open the editor with the piece selected. It takes
// a screen reader's focus on its name (the CoinShop pattern); the native sheet hides what is behind it.
export function PieceCardScreen() {
  const navigation = useNavigation<any>();
  const { pieceId } = (useRoute().params ?? {}) as { pieceId?: string };
  const { layout, tier, living } = useMyRoom();
  const now = useClockMinute(true);
  const card = pieceId ? pieceCard(layout, tier, living, now, pieceId) : null;
  const sound = useRoomSound();
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const nameRef = useRef<RNText>(null);
  useEffect(() => {
    void loadRoomSound();
    const node = nameRef.current ? findNodeHandle(nameRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const toEditor = (store: boolean) => {
    navigation.goBack();
    navigation.navigate('DecorateRoom', store ? { select: pieceId, store: true } : { select: pieceId });
  };
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text ref={nameRef} testID="card-name" accessibilityRole="header" accessibilityLabel={card?.nameSpoken} className="shrink text-heading">
            {card?.name ?? ''}
          </Text>
          <Button testID="card-close" variant="ghost" className={TARGET} onPress={() => navigation.goBack()}>{C.close}</Button>
        </View>
        {card ? (
          <>
            <Text testID="card-where" accessibilityLabel={card.where.spoken} className="text-caption text-muted-foreground">{card.where.text}</Text>
            <Text testID="card-earned" accessibilityLabel={card.earned.spoken} className="text-caption text-muted-foreground">{card.earned.text}</Text>
            {card.effect ? (
              <View className="gap-1">
                <Text className="font-pixel text-label text-muted-foreground">{C.effectTitle}</Text>
                <Text testID="card-effect" className="text-body">{card.effect}</Text>
              </View>
            ) : null}
            {card.state ? <Text testID="card-state" className="text-body">{card.state}</Text> : null}
            {card.resting ? <Text testID="card-resting" className="text-caption text-muted-foreground">{card.resting}</Text> : null}
            {card.sound ? (
              <View className="min-h-[44px] flex-row items-center justify-between gap-3">
                <Text className="shrink text-body">{C.sound}</Text>
                <Switch testID="card-sound" accessibilityLabel={C.sound} value={sound} onValueChange={(v) => void setRoomSound(v)} trackColor={{ true: colors.accent }} />
              </View>
            ) : null}
            {card.sound ? <Text className="text-caption text-muted-foreground">{C.soundHint}</Text> : null}
            <Text className="text-fine text-muted-foreground">{ROOM_COPY.effects.onlyForFun}</Text>
            <View className="flex-row gap-2">
              <Button testID="card-move" variant="outline" className={`${TARGET} flex-1`} accessibilityLabel={C.moveLabel(lowerName(card.nameSpoken))} onPress={() => toEditor(false)}>{C.move}</Button>
              <Button testID="card-store" variant="outline" className={`${TARGET} flex-1`} accessibilityLabel={C.storeLabel(lowerName(card.nameSpoken))} onPress={() => toEditor(true)}>{C.store}</Button>
            </View>
          </>
        ) : (
          <Text testID="card-gone" className="text-body">{C.gone}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
```

(The switch's track colour is `ChatSettingsSection.tsx`'s: `COLORS[scheme].accent`.)

In `mobile/src/navigation/RootNavigator.tsx`:
- `import { PieceCardScreen } from '../screens/PieceCardScreen';`
- `RootStackParamList` gains, after `RoomSizes`:

```ts
  // The piece card (spec 2026-10-15 §8.1): the native sheet, from a tap on an effect piece or a plant in KIP's room.
  PieceCard: { pieceId: string };
```

- after the `RoomSizes` screen:
  `<Stack.Screen name="PieceCard" component={PieceCardScreen} options={{ headerShown: false, presentation: 'modal' }} />`

In `mobile/src/lib/room/edit/editor.ts`, `DecorateParams` becomes
`{ drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean; select?: string; store?: boolean }` (doc: "a piece card's
Move and Store: the piece selected, and for Store already stored as the first undo step"). In
`mobile/src/screens/DecorateRoomScreen.tsx`, `initialState` becomes:

```ts
export function initialState(c: Cosmetics, params: DecorateParams): EditorState {
  let s = initEditor({ layout: c.layout, worn: c.worn, tier: c.tier, counts: c.counts, version: c.version, newIds: c.fresh.map((f) => f.itemId) }, params);
  // From a piece card (ruling 16): the piece selected, and Store already done (one undo step; Done saves it).
  if (params.select && s.draft.layout.pieces.some((p) => p.id === params.select)) {
    s = editorReducer(s, { type: 'select', id: params.select });
    if (params.store) s = editorReducer(s, { type: 'store' });
  }
  return s;
}
```

- [ ] **Step 5: Tapping the room, its actions, and the squash**

In `mobile/src/components/room/RoomView.tsx`:
- `import { withState } from '../../lib/room/effects';`
- `RoomViewHandle` gains `/** Plays a tapped piece's squash (ruling 17); nothing under Reduce Motion. */ squash(id: string): void;`
- `RoomViewProps` gains:

```ts
  /** The room image's custom actions: one per piece card (spec §5.7, ruling 16). */
  pieceActions?: ReadonlyArray<{ id: string; label: string }>;
  onPieceAction?: (pieceId: string) => void;
```

- the squash state, right after `const effects = useRoomEffects(…)`:

```ts
  const [squash, setSquash] = useState<{ id: string; k: 1 | 2 } | null>(null);
  const squashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => squashTimers.current.forEach(clearTimeout), []);
  const shown = squash ? withState(effects, squash.id, `squash${squash.k}`) : effects;
```

  and `input` uses `effects: shown`;
- the handle gains:

```ts
    squash: (id: string) => {
      if (still) return;
      squashTimers.current.forEach(clearTimeout);
      setSquash({ id, k: 1 });
      squashTimers.current = [setTimeout(() => setSquash({ id, k: 2 }), LOOP_MS), setTimeout(() => setSquash(null), 2 * LOOP_MS)];
    },
```

  with `still` added to the handle's dependency list;
- the root `View` gains

```tsx
      accessibilityActions={props.pieceActions?.map((a) => ({ name: a.id, label: a.label }))}
      onAccessibilityAction={(e) => props.onPieceAction?.(e.nativeEvent.actionName)}
```

In `mobile/jest-mocks/RoomView.js`, `propsOf(p)` gains
`accessibilityActions: p.pieceActions?.map((a) => ({ name: a.id, label: a.label })), onAccessibilityAction: p.onPieceAction ? (e) => p.onPieceAction(e.nativeEvent.actionName) : undefined`.

In `mobile/src/components/coach/RoomCard.tsx`:
- imports: `useRef`, `type RoomViewHandle` from `../room/RoomView`, `cardPieces, pieceTap` from `../../lib/room/card`;
- the props gain `/** A piece card (spec §8.1): a tap on an effect piece or a plant, or the room's action. */ onOpenPiece?: (pieceId: string) => void;`
- in the component:

```ts
  const roomRef = useRef<RoomViewHandle>(null);
  const onRoomPress = (x: number, y: number) => {
    const id = roomRef.current?.pieceAtPoint(x, y);
    if (!id) return;
    const tap = pieceTap(layout, id, effects);
    if (tap === 'squash') roomRef.current?.squash(id);
    else if (tap === 'card') onOpenPiece?.(id);
  };
```

- the room's `Pressable` gains `onPress={(e) => onRoomPress(e.nativeEvent.locationX, e.nativeEvent.locationY)}`, and
  its `RoomView` gets `ref={roomRef}`, `pieceActions={onOpenPiece ? cardPieces(layout, effects) : undefined}` and
  `onPieceAction={onOpenPiece}`.

In `mobile/src/screens/CoachScreen.tsx`, the room card gets
`onOpenPiece={(pieceId) => navigation.navigate('PieceCard', { pieceId })}`.

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/pieceCard.test.ts __tests__/screens/PieceCardScreen.test.tsx __tests__/lib/roomCopy.test.ts __tests__/components/RoomCard.test.tsx __tests__/components/RoomViewMovers.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/screens/KipPage.test.tsx __tests__/navigation __tests__/conventions`
Expected: PASS. Then the full mobile suite and the typecheck (10).

- [ ] **Step 7: Commit**

```bash
git add mobile/src mobile/jest-mocks mobile/__tests__
git commit -m "feat(room): piece cards for what does something, the radio's sound switch, and tap to squash"
```

---

### Task 14: Whole-branch verification, the final review, the run-folder sync, the iOS rebuild and the simulator check (controller)

- [ ] **Step 1: Suites, typechecks and guards**
  - Full backend suite with `backend-jest.sh` (no path), then backend `tsc --noEmit -p .`. Expected: green, 0.
  - `schema-drift.sh`. Expected: `no drift` (P3 changes no schema).
  - Full mobile suite and the mobile typecheck. Expected: green, 10 (or the count recorded in the ledger).
  - `__tests__/conventions` alone: `buttons`, `typography`, `kipCopy`, `noCharacters`, `kipWorn`, `earnOnly` and the new
    `noRoomInCoach` pass; the buttons guard has no new entry.
  - `node scripts/room-art-size.mjs` (under 300 KB) and `ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf`;
    record both in the ledger (cold build, rebuild, frame, the new mover order).
  - `ls -l mobile/assets/sounds/radio-loop.m4a`: under 300 KB.
  - From `backend/`, run `scripts/export-cosmetics.ts` and confirm `git status` shows no change to
    `mobile/src/lib/room/catalogue.json` or `mobile/src/lib/room/iso/geometry.ts`.
  - `git diff dadb1c8 -- mobile/src/components/social/CampScene.tsx mobile/src/components/social/CampBanner.tsx` is
    empty (OVERRIDE-P13).
  - `grep -rnE "console\.(info|log|warn|error)" backend/src/room backend/src/cosmetics mobile/src/lib/room mobile/src/components/room`:
    no new line since dadb1c8 (`git diff dadb1c8 -- <those paths> | grep -E "^\+.*console\."` prints nothing).
  - `grep -rnE "from ['\"][^'\"]*/(coins|cosmetics|room)/" backend/src/coach` prints nothing.
  - `grep -rn "living\|plantStage\|petEnergy" backend/src/buddies backend/src/social` prints nothing.
- [ ] **Step 2: The final review:** run the whole-branch review on opus with
  `review-package docs/superpowers/plans/2026-10-15-kip-freebuild-p3.md dadb1c8 HEAD`, then one fix wave. The
  reviewer checks, row by row:
  - spec §8.1 against `room/geometry.ts`, `cosmetics/loadout.ts` and the editor (slots 3 / 5 / 8; the first by instance
    id run; inert extras never fail; `effects_full` only on a raise; the editor's refusal on every add, never on a move);
  - §8.2's table against the catalogue and the art (each piece's effect, the floor lamp's pool after the veil, the
    radio's notes and its sound off by default, the cat's wander and its nap on a bed after 22:00, the clock's real
    time each minute, the duck's tap kept for B2, the trophy shelf's awards; `shelf.trophyB` plain);
  - §8.3 against `room/living.ts` and `lib/room/effects.ts` (stages from `sleep_goal` rows including 0-coin ones, the
    step bands, awards highest first ≤ 8, never in a buddy DTO or a log; plants pause, never wilt; the words the room
    uses and the advice guard);
  - §3.6, §3.7 and §9.2 against `RoomView`, `iso/movers.ts`, `live/walk.ts` and `live/useKipWalk.ts` (walk only while
    idle, prompt blurred, focused, Reduce Motion off; the exit tile; use tiles; inside the crop; BFS; one tile per two
    frames with the bob; stop at once with no walk back; 20–40 s, never the same piece twice; the `water` pose arms
    only; 0 recordings per tick, step, bob or sway; a minute or a drop re-records only what changed);
  - the piece card against F7 (name, where, earned or price, effect line, the switch, Move and Store; focus on open);
  - §6.6 and §7 against the shop and Room sizes (the Effects tab, "does something in the room", the sheet's effect line,
    "+2 effect slots"); §5.4's Effects tab;
  - §12 P3's rows (`living` on GET, `400 effects_full`), §13 (release 5's date), §16's P3 tests;
  - the privacy rules (no user id with item ids, layouts, coins, counts or living in any log; nothing cosmetic or
    effect-related in the coach), the frozen Campfire, the Button and type rules, `USER_OWNED_MODELS` unchanged;
  - the five Review Focus lines and every ruling of this plan and the P1 and P2 ledgers.
- [ ] **Step 3: Sync to the run folder and rebuild iOS** (`~/dev/biometrics-run`, outside iCloud):
  1. Back up the dev DB with `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/backup-db.sh` (`pg_dump -Fc`, only when
     `DATABASE_URL` is local; never print the URL); the dump is `biometrics-before-kip-freebuild-p3-2026-10-15.dump`.
     Confirm its byte count is non-zero.
  2. `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/sync-run.sh`: rsyncs `backend/`, runs `npm install` and
     `npx prisma generate`, the conversion script (`converted: 0`), `npx prisma migrate deploy` (expected: no pending
     migrations), `npm run build`; then syncs `mobile/` (excluding `node_modules`, `ios`, `android` and every `.env*`)
     and runs `npm install` (which installs `expo-audio`).
  3. **`expo-audio` is a native module**, so the dev client needs a rebuild:
     `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/ios-build.sh` (`npx expo prebuild --platform ios --no-install`,
     `pod install`, the ad-hoc `xcodebuild` for the simulator, install, Metro). Expected: `prebuild ok`, `pods ok`,
     `xcodebuild ok`, `installed`, `metro started`.
  4. Restart the API on :3000 with the dev coins launch:
     `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/start-backend-coins.sh` (`COINS_LAUNCHED_AT=2026-10-01T00:00:00.000Z`,
     so the plants' sleep-goal nights exist as coin rows before the real launch). Expected: the health check answers.
  5. Restart Metro on localhost: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p3/metro-local.sh`.
  6. For a fresh test account only (never the owner's own data), seed with a scratch script kept in the workspace and
     never committed, `.superpowers/sdd/2026-10-15-kip-freebuild-p3/seed-living.ts`, run from
     `~/dev/biometrics-run/backend` with ts-node: it looks the account up by email; writes 15 `sleep_goal` coin rows on
     past days through `applyCoinEvents` (keys `sleep_goal:<date>`); grants `item.radio`, `pet.tabby`, `corner.floorlamp`
     and `pet.bed` with `ItemGrant` rows (`sourceKey` `dev:seed:<item>`); and creates two `Achievement` rows. It prints
     counts only.
- [ ] **Step 4: Simulator check, with screenshots** (`xcrun simctl io booted screenshot <file>` into
  `.superpowers/sdd/2026-10-15-kip-freebuild-p3/shots/`). With the demo account and the seeded test account:
  - **The editor:** place the radio on the desk, the floor lamp, the cat and its bed; "Effects 3 of 3" under the
    header; a fourth effect piece is refused with "Effects 3 of 3: store one to run another"; the drawer's Effects tab;
    the toolbar's effect line; Done.
  - **The KIP page, by day:** the fern at stage 3; the cat wanders the front row; after 20–40 s KIP leaves its seat by
    the exit tile, walks to the radio (sways, notes) or the fern (waters it) and back; tap the prompt bar mid-walk: KIP
    is at its desk at once; send a question: the typing pose starts at the desk.
  - **The piece card:** tap the radio: the card, the switch off; turn it on: the loop plays quietly; blur the tab, open
    the editor, background the app: it pauses each time; the silent switch silences it. Tap the cat and the fern:
    their lines. Move and Store open the editor.
  - **At night** (the simulator clock past 22:00, or a night scene): the floor lamp's warm pool after the veil, the cat
    curled on its bed, the clock's real time; Reduce Motion on: nothing moves, KIP sits.
  - **The shop:** the Effects tab, "does something in the room" on the radio, the cat and the floor lamp, the sheet's
    effect line. **Room sizes:** "40 pieces · 3 effects", the unlock card's "+2 effect slots".
  - VoiceOver: the room image's actions ("Old radio card"), the card's focus on its name, the switch's label; the
    largest text size on the card and the toolbar.
- [ ] **Step 5: Report to the owner** with the screenshots, the perf and size numbers and the OWNER NOTES (ruling 1:
  release 5's date; ruling 2: the cat's price 180 and the trophy shelf not sold; ruling 3: the duck's price; ruling 15:
  the generated radio loop, replaceable by any 20-second loop under 300 KB; ruling 13: the walk's timings). Push the
  branch (`git push -u origin feature/kip-freebuild-p3`; never main, never force). Open a draft PR (base
  `feature/kip-freebuild-p2`) only when the owner asks, with no attribution footer.

---

## Self-review (2026-10-15, against the spec and the real code on `feature/kip-freebuild-p3` at dadb1c8)

**Spec coverage, P3 only:**

| Spec | Task |
| --- | --- |
| §0 standing rules (earn only, frozen Campfire, buttons, A4 type, privacy, nothing cosmetic to the model, effects never advise) and the accepted radio default | Global Constraints; 3 (no living in buddy DTOs), 4 (advice guard, coach guard), 12 (sound off by default), 14 (frozen check, log check) |
| §2.1 `effect?: EffectKind`, release 5 | 1 |
| §3.4 movers inserted at their tile; occlusion by a piece in front | 9 |
| §3.6 KIP on a tile, facing by mirror and glance, walking with a bob, legs never change | 9, 10 |
| §3.7 per-piece pictures keyed by effect state; movers as a list of picture draws; the budget; Reduce Motion | 4, 5, 9 (perf line), 14 |
| §4 P3's art batch (`pet.tabby`, `shelf.awards`) and the effect states | 1, 4, 5, 6 |
| §5.3 "Effects 3 of 3" reason; §5.4 the Effects tab | 7 |
| §6.6 the shop's Effects tab, "does something in the room", the effect line | 8 |
| §7 effect slots per size (3 / 5 / 8), "+2 effect slots" | 1, 8 |
| §8.1 the effect system, slots, inert extras, `effects_full` only on a raise, the piece card | 1, 2, 4, 7, 13 |
| §8.2 the first set: floor lamp, radio (sound off until on, remembered on the device), cat, plants (mood, growth), clock, duck (B2, tap built), trophy shelf; lava lamp B2 | 1, 4, 5, 6, 10, 11, 12, 13 |
| §8.3 health-linked visuals, `living` on the server, words the room uses, the copy guard, a low day stays cosy | 3, 4, 6, 13 |
| §9.2 walking: idle only, exit tile, use tiles, inside the crop, BFS, one tile per two frames, stop at once, 20–40 s, never twice; the pet's front row | 10, 11 |
| §12 P3 rows: `living` on GET, `400 effects_full`; telemetry (no new log line); nothing cosmetic to the model | 2, 3, 4, 14 |
| §13 P3 rows: release 5's launch date (OWNER NOTE); OVERRIDE-P13 | 1, 14 |
| §16 P3 tests (`living`; effect slots in geometry; each effect's states; slots block with the message; sound off by default; KIP walks only while idle and snaps back; Reduce Motion stops walking and loops; the advice guard; perf) | each task's Step 1; 9 (perf) |
| P2 plan rulings 13 and 14 (Effects tab, effect line, effect slots deferred to P3) | 7, 8 |
| P1 ledger Task 8 minor (behind + KIP + ahead == the full order) | 9 |
| §10, P4's rows of §12 | not built (P4); the seams: `NEUTRAL_LIVING`, `living` absent from buddy DTOs |

**Where the spec cannot be followed literally, and the ruling taken:**
1. **"The server rejects a save with `effects_full` only when it raises the number"** (§8.1) against "Placing one more
   effect piece is blocked": both hold. The server compares with the stored room (sanitised), the editor refuses every
   add once the room has its slots, and moves never fail (ruling 4).
2. **"Always naps after 22:00"** (§8.3) needs the local hour, but `living` is computed on the server at read time: the
   server sends the steps band and the app applies 22:00–05:59 from the device clock (ruling 6).
3. **"One extra smile frame in its idle loop"** (§8.2): KIP's idle poses have no loop. In the idle stage with a plant
   in the room, loop frame 2 draws mood `curious` (eyes up), at no recording cost (ruling 9).
4. **The duck's "plus sound"** (§8.2) against "one bundled 20-second loop" (§0): no squeak asset ships; the duck is B2,
   so its sound comes with B2. The `tap` squash is built and tested with an injected effect (rulings 15, 17).
5. **The piece card "in view mode (… or the editor with nothing selected)"** (§8.1) against "Tap to select a placed
   piece" (§5.3): in the editor a tap keeps selecting, and the toolbar line shows the effect line or "Resting"; the card
   is the KIP page's (ruling 16).
6. **The card's "Move and Store"** in view mode would be a second writer of the room: they open the editor with the piece
   selected, Store already applied as the first undo step, so Done saves through the one path (ruling 16).
7. **"A copy guard test scans every effect and room string for those words"** (§8.3): "more" is a count in the shop's
   "Needs 40 more" and Room sizes' "20 more pieces", and "Move" / "Store" are buttons. The guard scans the effect and
   card strings, where advice could live (ruling 18).
8. **"The static room is one picture built from the shell and the sorted pieces"** (§3.7): P1 already draws two (back
   and front, split at KIP's seat); with movers the view draws one cached picture per floor piece (P1 ruling 8's own
   plan). "Effect state" in the key includes the clock's minute, so a running clock rebuilds once a minute (rulings 7,
   11).
9. **Loop frames behind KIP are clipped by KIP's silhouette** (P1 ruling 8): with KIP walking, re-clipping rects at
   every step would record pictures per step. An inverted Skia clip of KIP's path does it with no recording; a loop cell
   of a piece in front of KIP inside KIP's outline is hidden too (ruling 12).
10. **"The radio (KIP sways, notes)"** has no sway pose and §9.2 names only three targets: the sway is a ±1-cell
    transform of `rest`; any other effect piece gets `point` (ruling 13).
11. **"Only targets whose use tile is inside the current crop"** (§9.2): a tile is inside when KIP standing on it fits
    wholly in the room card's crop, so KIP is never cut by the frame (ruling 13).
12. **"Only while idle (no turn running, the prompt bar not focused, …)"**: KIP's speech bubble is anchored to its seat,
    so KIP also stays seated while a bubble shows (coins landing, the welcome) (ruling 13).
13. **"Walks the front row"** (§8.2) has no meaning yet on an iso grid: the front row is `j = m − 1`, the cat walks to its
    nearest free tile and up to 3 tiles along it (ruling 10).
14. **"KIP glides tile to tile" with "One tile per two loop frames (800 ms)"** (§3.6, §9.2): a half tile per 400 ms
    frame, whole cells only, the bob on the half steps (ruling 13).
15. **"A quiet lo-fi loop while the room is open"** (§8.2): "open" is the KIP page's room card, focused, not shrunk, not
    under the editor, the app in the foreground (ruling 15).
16. **"Your Achievement rows"** (§8.3) for awards: each row is a badge level, so `awards` is the levels, highest first,
    at most 8 (ruling 6).
17. **"Pieces with effects 120–200"** (§6.4) against P2's duck at 40: kept, as P2's ledger left it to the owner (ruling 3).
18. **The trophy shelf as "starter"** (§8.2): owned by everyone but not placed in the starter room and not sold (one shelf
    shows all your awards) (ruling 2).
19. **§12 lists no effect-slot count** on the GET body: the app reads the slots from `TIERS` in its geometry copy, the
    server's own file (ruling 22).
20. **Plants "are not effect pieces"** (§8.1) yet carry the room's growth words (§8.3): a plant has a card too, with its
    growth line, and is a walking target (§9.2) (rulings 13, 16).

**Placeholder scan:** no "TBD" / "TODO" / "similar to". Every module, hook, screen, reducer change, copy string, script
and test is written out; where a task edits a file it keeps, the exact lines that change are named. The one open choice
handed to the implementer is mechanical: `expo-audio`'s mix-with-others enum value if the installed type names it
differently (Task 12, Step 4).

**Type consistency:** these names are used identically across tasks:
- backend: `EffectKind`, `IsoSpec.effect`, `TIERS[t].effects`, `effectSlotsFor`, `effectPieces`, `runningEffects`,
  `effectsRaised`, `EFFECTS`, `LIVING_PIECES`, `checkLayout(…, stored)`, `'effects_full'`, `Living`, `PetEnergy`,
  `PLANT_NIGHTS_PER_STAGE`, `MAX_AWARDS`, `plantStageOf`, `petEnergyOf`, `readLiving`, `CosmeticsDTO.living`;
- mobile model: `Living`, `PetEnergy`, `NEUTRAL_LIVING`, `readLiving`, `livingKey`, `ClockNow`, `NAP_FROM`, `NAP_UNTIL`,
  `isNapHour`, `RoomEffects` (`running`, `inert`, `used`, `slots`, `states`, `napOn`, `plant`, `needsClock`),
  `roomEffects`, `effectsKey`, `withState`, `effectOf`, `clockNow`, `useClockMinute`, `useRoomEffects`;
- mobile art: `IsoArtOpts.effect`, `ItemContext.effect`, `GROWTH`, `POT_COLOURS`, `growRects`, `growLayers`, `POOL`,
  `lampPool`, `SQUASH`, `squashRects`, `radioNotes`, `parseHhmm`, `handCells`, `AWARD_COLOURS`, `awardLevels`,
  `drawAwardsShelf`, `AWARDS_ALONG`, `TABBY_SIT`, `TABBY_NAP`, `TAIL`, `PAW`, `ZZ`, `GINGER`, `loopOf`;
- mobile engine: `IsoRun`, `IsoStatic.under` / `runs` / `deskId` / `seat`, `IsoStaticInput.effects` / `movers`,
  `RoomKip.flip`, `Tile`, `KIP_MOVER`, `MOVER_PREFIX`, `MoverAt`, `moverOrder`, `kipTileCell`, `pieceTileCell`,
  `sameTile`, `PictureLru`, `RunPictures`, `KipMover`, `PieceMover`, `RoomViewHandle` (`pieceAtPoint`, `squash`);
- mobile live: `STEP_MS`, `USE_MS`, `TRIP_MIN_MS`, `TRIP_SPAN_MS`, `UseKind`, `USE_POSE`, `WalkTarget`, `Trip`,
  `blockedTiles`, `bfs`, `standTileOf`, `tileInView`, `walkTargets`, `planTrip`, `posAt`, `headsLeft`, `KipWalk`,
  `useKipWalk`, `walkMover`, `PAUSE_STEPS`, `CatRoute`, `catRoute`, `wanderRoutes`, `catAt`, `useCatWander`;
- mobile sound and card: `ROOM_SOUND_KEY`, `loadRoomSound`, `setRoomSound`, `getRoomSound`, `useRoomSound`,
  `resetRoomSound`, `RADIO_VOLUME`, `RoomRadio`, `runsSound`, `PieceCardModel`, `pieceCard`, `PieceTap`, `pieceTap`,
  `cardPieces`, `PieceCardScreen`, route `PieceCard: { pieceId }`, `DecorateParams.select` / `store`;
- props: `RoomViewProps.living` / `editing` / `kipMover` / `pieceMovers` / `kipWalks` / `idle` / `live` /
  `pieceActions` / `onPieceAction` / `ref`; `RoomCard`'s `kipWalks` / `onOpenPiece`; `PromptBarProps.onFocusChange`;
  `EditRoomProps.living`; `Refused.reason 'effects'` with `slots`; `DrawerTab 'effects'`; `ShopTab 'effects'`;
  `Tools.effect` / `slots`; `toolLine(…).effect`; `ShopTile.effect`; `PieceSheet.effect`;
- copy: `ROOM_COPY.effects` (`lines`, `short`, `plant`, `grew`, `sprout`, `pet`, `awardCount`, `resting`, `full`, `tag`,
  `tagSpoken`, `doesSomething`, `fxTag`, `onlyForFun`), `ROOM_COPY.card`, `ROOM_COPY.drawer.tabs.effects`,
  `ROOM_COPY.shop.tabs.effects`, `ROOM_COPY.sizes.pieces(cap, effects, window)` and `grewMore(pieces, effects, window)`.

**Review Focus:** each of the five lines has its pinning test in the owning task (1: Tasks 2, 4 and 7; 2: Task 10;
3: Task 12; 4: Tasks 6 and 11; 5: Tasks 5 and 9). The walk, the radio and the night are also checked by hand in Task 14.

**Deferred minors not folded in** (P3 does not touch their code): P2 Task 13's one-frame old pan (the editor's pan; P3
walks on the KIP page's crop only), P2 Task 13's other-device additions lost on rebase, P2 Task 11's offline wallet
skeleton, P1 Task 2's `seatTile` reflecting on facing R (walking uses the same `seatTile` and `exitTile`, so it stays
consistent), P1 Task 9's desk Another/Replace desk refusals, P1 final review M5 (plank spots on Flip, parked).
