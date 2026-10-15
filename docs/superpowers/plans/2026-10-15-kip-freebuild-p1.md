# KIP Free-build P1 (the isometric room) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KIP's room stops being 12 fixed slots and becomes a small isometric room you build freely: place, stack,
flip and turn any piece you own anywhere it fits, keep copies in an inventory with counts, change the three room-wide
styles, and see the same room on the KIP page. This plan ships **P1** of the free-build spec: the iso engine and the
P1 art, the placement data model, slot → iso conversion, the editor (grid, drag with ghost and snap, invalid reasons,
toolbar, undo / redo, the inventory drawer, room full, the non-drag path, Replace desk), the welcome and the guided
first placement, and the endpoints behind them. Coins, the shop, expansion, effects, walking KIP and social are P2–P4.

**Architecture:**
- **Backend** (Tasks 1–4):
  - `backend/src/cosmetics/catalogue.ts` gains `iso` blocks, `SHIPPED_RELEASES = {1, 3}`, release-3 structural
    pieces (`shelf.plank`, `lamp.welcome`) and a full `RELEASE_LAUNCHED_AT`;
  - `backend/src/room/geometry.ts` holds every placement rule, pure and import-free; the export script copies it to
    `mobile/src/lib/room/iso/geometry.ts` and a test fails when the copy is stale;
  - `backend/src/room/convert.ts` turns a sanitised slot room into an iso layout (`layoutFromSlots`), and gives the
    starter layout and the derived slot `room` for dev builds;
  - `CosmeticLoadout.layout` / `tier` and `RoomFirstWeek` (migration `20261016120000_freebuild`); `GET
    /me/cosmetics` converts lazily with a conditional write; `PUT /me/cosmetics` validates a layout under the
    per-user advisory lock; `POST /me/room/welcomed`; `scripts/convert-room-layouts.ts`.
- **Iso engine** (Tasks 5–8), `mobile/src/lib/room/iso/`, pure: the 2:1 grid and `iso.py`'s primitives ported to
  TypeScript, a topological depth sort, the shell with the 21 styles, the 54 placeable release-1 pieces plus the
  three new ones, and `drawIsoStatic` / `drawIsoFrames` (back, KIP, front, light, emissive, frames).
- **The editor** (Tasks 9, 11–14): a pure reducer (`lib/room/edit/editor.ts`) over the draft layout with 20-step undo /
  redo; snap targets and nearest-free search (`edit/targets.ts`); the `DecorateRoom` route rebuilt as the free-build
  editor with gestures, the ghost, the toolbar, the inventory drawer and the accessible path.
- **The KIP page** (Task 10) draws the iso room in the room card (240 points, cropped on the desk) and opens the
  editor on long-press; **the first week** (Task 15) adds the welcome card and the guided first placement.
- **Verification** (Task 16): full suites, final review, DB backup, run-folder sync with `prisma migrate deploy` and
  the conversion script, Metro on localhost, the simulator check.

**Tech Stack:**
- Backend: Express 5, Prisma 6 / Postgres, Jest with supertest, ts-node for scripts.
- Mobile: Expo 57 / React Native 0.86 with NativeWind, React Navigation 7, Reanimated 4,
  `react-native-gesture-handler` 2.32, `@shopify/react-native-skia` 2.6.2, `react-native-svg`, `expo-haptics` (all
  installed; nothing new). Tests use Jest 30 with React Native Testing Library and
  `react-native-gesture-handler/jest-utils`.

**Spec:** `docs/superpowers/specs/2026-10-15-kip-freebuild-design.md` (binding; this plan implements its **P1** row
of §14 only, plus the data-model seams it says P1 must leave).
- Built base: Spec A (`2026-10-14-kip-coach-design.md`) and Spec B (`2026-10-14-kip-room-design.md`) on
  `feature/kip-room` 086f772 (draft PRs #65, #66). This plan builds against that real code; where the spec and the
  code differ, a ruling below says which way.
- Visual sources in `docs/design/freebuild/project/`: `F1.dc.html` (iso free-build: grid, ghost, snap, red, wall
  snap, stacking), `F4.dc.html` (drawer, toolbar, counts, room full), `C7.dc.html` (welcome, guided first placement).
- Drawing reference: `docs/design/freebuild/gen/iso.py` and `isox.py` (`P`, `box`, `flat`, `line`, `face`,
  `shadow`, `shell`, `win`, `daylight`, `veil`, `spr_at`, `plant`, `kipx`, `standard`). Their `data.json` is not
  needed: the port reads the app's own item registry (ruling 25).
- Out of this plan: coins and the ledger, `ItemGrant`, the shop, expansion purchases (tier stays 1; tiers 2–3 are
  drawn and validated so P2 can grow rooms), effects and `living`, KIP walking and the `water` pose, visits, cheers,
  gifts, challenges, the share card. The seams P1 leaves: `tier` on the row, `grants` / `price` / `shop` / `tags`
  optional on items, `ItemGrant`-shaped counts in `countsOf`, the room advisory lock, `RoomFirstWeek.startedOn`.

## Global Constraints

- **Branch:** `feature/kip-freebuild`, in the worktree
  `/Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab`, cut from `feature/kip-room` 086f772; the
  spec commits end at 00aa195 and this plan's commit sits on top.
  - Never switch branches, never push to main, never force-push, never bare `git stash`.
- **Commits:** plain `git commit -m "…"` with **no `Co-Authored-By` trailer and no mention of Claude, Cursor or AI**
  (owner rule; it applies to every subagent). A PR body carries no attribution footer either.
- **Subagents** run on model **opus**.
- **Every task keeps both full suites green at its commit.** Run the touched tests while working. Before the commit,
  run the full mobile suite, both typechecks and, for a task that touches `backend/`, the full backend suite.
  Backend Tasks 1–2 regenerate `mobile/src/lib/room/catalogue.json` (and Task 2 the geometry copy), so they run the
  full mobile suite too.
- **Mobile commands**, from `mobile/`:
  - `export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH`
  - Tests: `node node_modules/.bin/jest --forceExit <paths>`. With no paths it runs the full suite.
  - Typecheck: `node node_modules/.bin/tsc --noEmit --types jest,node --pretty false | grep -c "error TS"`.
    - The baseline, **measured on this branch (00aa195) on 2026-10-15, is 10**: `__tests__/api/client.test.tsx` (2),
      `__tests__/components/FactorBar.test.tsx` (1), `__tests__/components/ScoreRing.test.tsx` (1),
      `__tests__/screens/MetricDetailScreen.test.tsx` (5) and `App.tsx` (1).
    - No task may add an error. Record any change of the count in the ledger.
- **Backend commands**, from `backend/`. Never run two backend test runs at once, never point tests at the dev
  `biometrics` DB, and never print the database URL.
  - Tests go only through `.superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh <paths>` (Task 0 copies it).
    It uses `TEST_DATABASE_URL` from `~/dev/biometrics-run/backend/.env` and Redis db 1.
  - A suite that fails or SIGSEGVs under full-suite load is rerun alone before it is treated as real.
  - Typecheck: `node node_modules/.bin/tsc --noEmit -p .` must report **0** errors (**measured 0 on 00aa195 on
    2026-10-15**, after `DATABASE_URL=postgresql://x@localhost/x npx prisma generate`). After a schema or migration
    change, run that `prisma generate` first (generate needs the variable but never connects).
  - Scripts run with `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/<name>.ts`.
- **Buttons:**
  - Every button is `<Button>` from `mobile/src/components/ui/button.tsx`, with `rounded-lg`. No pills: chips, tags,
    tabs and the drawer handle are `rounded-lg`.
  - A raw `Pressable` with `accessibilityRole="button"` or `"link"` needs an entry in
    `mobile/__tests__/conventions/buttons.test.ts`, with a count and a reason, **in the task that adds it**. This plan
    keeps `DecorateTile:testID` (the drawer tile, spec §5.4) and adds no other raw button: the pieces list, the
    toolbar, the arrows and the coach mark are `Button`s.
  - An entry whose site disappears is removed **in the task that removes it** (`decorate-hotspot-${slot}` goes in
    Task 10 with `HotspotLayer.tsx`).
  - Every touch target is at least **44 points** (spec §5.7).
- **Type:** A4 tokens only (`text-score`, `text-number`, `text-display`, `text-heading`, `text-headline`,
  `text-body`, `text-caption`, `text-fine`, `text-page-title`, `text-label`). Pixel labels use `font-pixel text-label`.
  No inline `fontSize` / `fontFamily`, no arbitrary `text-[..px]`. `__tests__/conventions/typography.test.ts` stays
  green with its EXEMPT counts unchanged.
- **Copy:**
  - Every new room, editor and first-week string lives in `mobile/src/lib/room/roomCopy.ts` (spec §15).
  - Spoken labels never contain "·" (U+00B7) or "−" (U+2212) and never Roman numerals (Spec A ruling G6, Spec B P19).
  - The product name is **KIP** in capitals. `__tests__/conventions/kipCopy.test.ts` stays green (its one 'Cap'
    exception for `roomCopy.ts` stays).
  - No price, coin or shop copy in P1 except the spec's own P2 hooks, which are **not** shown yet.
- **Privacy and logging (spec §0, §12):**
  - Never log user ids together with item ids, layouts, counts or coin amounts. Room logs carry an event name and
    counts only: `room.saved { pieces, tier }`, `room.converted { count }`.
  - Nothing cosmetic reaches the model: a source scan (Task 4) fails if anything under `backend/src/coach/` imports
    from `cosmetics/` or `room/`.
  - Only worn ids reach buddies (unchanged); no layout, count or tier is in any buddy DTO.
- **Earn only (spec §0):** nothing is sold; no purchase library, no price, no "get more" button. Items are never
  taken away: Store sends a piece to the inventory, nothing is deleted.
- **Dates:** never `new Date('YYYY-MM-DD')` in the app; civil dates only through the existing helpers. The backend
  release constants use a full ISO instant with `Z`.
- **Frozen files:** `mobile/src/components/social/CampScene.tsx` and `CampBanner.tsx` are not touched at all
  (OVERRIDE-P13). Tasks 10 and 16 check `git diff 086f772 -- <both>` is empty.
- **Shared test fixtures** live in `mobile/jest-mocks/` and `backend/tests/**/helpers.ts`, never as `__tests__` files.
- **Skia in Jest:** `@shopify/react-native-skia` is mocked by `mobile/jest-mocks/skia.js`; `RoomView` has the
  stand-in `jest-mocks/RoomView.js`. No test loads the real Skia module.
- **Pixels:** whole cells only, antialiasing off, one `Path` per colour per picture; iso diagonals are 2:1 stair steps
  (`line`), never smoothed lines (spec §3.7).

## Plan rulings (made while writing the plan)

1. **Release 3 and the shipped set.** `SHIPPED_RELEASES = new Set([1, 3])`; `shelf.plank` and `lamp.welcome` are
   `release: 3`, starter. `RELEASE_LAUNCHED_AT` is `{ 1: 2026-10-15T00:00:00.000Z, 3: 2026-10-16T00:00:00.000Z }`.
   OWNER NOTE: both are set to the real ship date when Spec B and P1 merge (they reach users together, spec §0).
2. **Footprint axes.** `foot: [w, d]` is `w` tiles along `i` and `d` along `j` when facing **L**; facing **R** swaps
   them. A facing-L piece's front is its `j`-max face (iso.py's lighter "left" face, toward the lower left), so its
   long side runs along `i`. The spec's parenthetical "long side along j" contradicts its own conversion table (a
   3 × 2 desk at tile (2, 0) next to a corner piece at (5, 0) only fits with `w` along `i`); the table wins.
3. **Billboards.** The boards' small pieces (shelf, desk item, lamp, plant, corner, pet slots) are drawn the way
   `isox.py`'s `spr_at` and `plant` draw them: the front-on sprite stood on its tile centre or its spot, with its own
   contact shadow, glows and loops. They declare `facings: 1` (Flip mirrors; Turn is greyed). Desks, rugs and the
   welcome lantern have true L / R drawings (`facings: 2`). The front-on item files under `lib/room/items/` stay as
   the sprite source and the icon source; nothing draws them as a room any more.
4. **Wall art** is the front-on art sheared onto its wall (`face`, slope +1 on the right wall, −1 on the left). Its
   `wall` size comes from each piece's measured bounds (Task 1's `ART_WALL`); every one is at most 4 half-tiles wide.
5. **Window styles.** The iso window (left wall `j` 1.6–3.6, `z` 24–54, as `isox.py`) draws today's sky with Spec A's
   `windowSky` sheared onto the wall. A window style's decor is its board sprite in board-frame cells (the 34 × 30
   frame at 0, 0), scaled by 26 / 34 across and 34 / 30 up onto the iso frame and sheared. The Cottage window's decor
   is split out of its front-on draw (`cottageWindowDecor`).
6. **Wallpapers and floors.** A wallpaper's iso texture is its front-on back-wall band (the 64 rows above the
   skirting) sheared onto both walls, the left wall darkened 14% as `isox.py`. Floors are five iso functions (tiles,
   seams, speckles in the boards' colours); concrete's speckle uses the board's steps `(k·7+3, k·11+5)` (Spec B
   Task 9 minor).
7. **The Cottage fairy lights are a wall piece** (`layers: ['wall']`, `wall: [8, 2]`), a garland on the left wall at
   half-tile 0, step 14, above the window. `layoutFromSlots` puts any lamp-slot item without `onTop` there.
8. **Pictures in P1.** With KIP the only mover and always at the desk, the static room is two pictures: everything
   depth-sorted before KIP (`back`) and after (`front`, with the light layer and glows). Each piece's rects are cached
   (an LRU of 200, keyed by item, layer, facing, mirror, night, colour and screen) so a drop rebuilds the picture
   from cached rects. Per-piece `SkPicture`s and mover lists come with P3's walking. Loop frames of pieces behind KIP
   are clipped by KIP's silhouette, so a monitor's screen loop never paints over KIP.
9. **KIP's seat** keeps Spec A's `KipSeat` (top-left of KIP's 32-cell grid, `deskSide`, `style`): KIP stands on the
   desk's seat tile centre; `deskSide` is `'right'` for a facing-L desk and `'left'` for facing R.
10. **Instance ids.** The app makes `p1`, `p2`, … (the lowest unused); conversion and the starter layout use fixed
    ids per slot (`desk`, `deskitem`, `lamp`, `plank`, `shelf`, `art`, `plant`, `corner`, `rug`, `pet`).
11. **The desk's exit tile** must lie inside the room; flat pieces (rugs) may cover it and the seat; any other floor
    piece covering it is `bad_place: seat`.
12. **Reasons.** `bad_place` reasons map to copy: `outside` "Doesn't fit here", `overlap` "Overlaps the {name}",
    `wall` "Overlaps the {name}", `window` "Covers the window", `spot` "That spot is taken", `parent` / `nested`
    "Nothing can stand on that", `seat` "Blocks KIP's chair"; a layer the piece can't use reads "Only on the floor",
    "Only on the wall", "Only on a desk or shelf" or "Only on the floor or a surface"; the cap reads "Room is full".
    A facing `R` on a `facings: 1` item is `400 wrong_layer`.
13. **`GET /me/cosmetics` adds `welcomed: boolean`** (`RoomFirstWeek.welcomedAt` set): §11.1 shows the welcome once
    across devices, and §12's list omits the field that makes it possible.
14. **Bodies over 32 KB** are `400 invalid_body` (spec §12's cap, the house error).
15. **The New tab** is a snapshot of the unseen ids taken when the editor opens: opening still marks them seen
    (Spec B §4), and the tab stays for that session.
16. **Dragging from the drawer.** Each drawer tile carries its own long-press pan (200 ms). Its absolute finger
    position is mapped into room cells through the room view's measured window origin and the current pan, so the
    gesture that started on the tile keeps tracking over the room.
17. **The editor's room is 320 points tall** (a whole 7 × 7 room at 2 points), full width, pannable.
18. **The welcome card** sits inside the room card, under the frame; KIP's bubble says "WELCOME HOME!" while it
    shows. Both "Place the lantern" and "Later" post `welcomed`.
19. **The coach tile** is the free tile nearest (5, 3) where the lantern fits.
20. **The Funny tab** lists items tagged `'funny'` (`tags`, which P4 extends for challenge briefs): `shelf.luckycat`,
    `shelf.globe`, `item.controller`, `corner.beanbag` in P1.
21. **Set layouts** are computed at export as `layoutFromSlots(set.room)`, so every set ships one (spec §5.5).
22. **Shared fixture:** `mobile/jest-mocks/cosmeticsFixture.ts` builds the GET body every mobile test uses.
23. **Read-time sanitising** (spec §2.2): placements whose item is unknown or unshipped are dropped with their
    children; placements over the owned count are dropped highest id first with their children; an unowned style
    reads as the starter style. The stored row is not rewritten until the next save.
24. **Ledger items folded in** (from `.superpowers/sdd/2026-10-14-kip-room/progress.md`):
    - Spec A Task 6 / Spec B Task 7 `layerOf` / `kipSeatFor` slot guards: the iso art lookup (`isoArtOf`) returns
      art only for an item whose catalogue row has an `iso` block (Task 7).
    - Spec B Task 2: `item.sets` in the export is filtered to shipped sets (Task 1).
    - Spec B Task 5: PUT `version` upper bound 2³¹ − 1; tests for an extra worn key and a negative version (Task 4).
    - Spec B Task 8: `setMyKipWorn` is skipped when worn is unchanged (Task 10).
    - Spec B Task 9: concrete speckle steps (Task 6).
    - Spec B Task 11: the Cottage fairy lights' icon shows lit bulbs (Task 7).
    - Spec B Task 12: optional worn props on wrappers: the `kipWorn` guard reads whole opening tags
      (`sourceScan.openingTag`), rejects `worn={undefined}`, and also requires `myWorn` / `worn` / `kipWorn` on
      `HomeScene`, `HomeHeader`, `ProfileButton`, `RecapCardView`, `YearPixelsView`, `WeeklyStoryView` and
      `CampNoteCard` call sites (Task 10).
    - Spec B Task 13 / 14: the reducer checks counts before placing (Task 9); "How new things arrive" stores lead and
      body separately (Task 13); `SetCard` swatch keys use the index (Task 13); a screen-reader activation can't reach
      the drawer or the room while a save is in flight (Tasks 10 and 11).
25. **No `data.json`.** The Python generators read Spec B's art export; the TypeScript port reads the registry
    directly (`itemArt`, `itemIcon`), so nothing is regenerated.
26. **The sync script excludes `.env*`** in the mobile rsync: the old `--delete` would remove the run folder's
    `.env.development.local` (the localhost API override). It also runs `scripts/convert-room-layouts.ts` after
    `prisma migrate deploy`.

## Review Focus

1. **A Spec B dev room meets P1** (a stored slot room with Cottage's desk, a rug the user no longer owns, no
   `layout`). Expected: the first GET converts it once to the same pieces in the iso room (the unowned rug as the
   starter rug), a second GET or the script changes nothing, the KIP page draws it, and the editor's Done saves it.
   Pinned in Task 3 (lazy conversion, script and GET agree, idempotent) and Task 11 (Done saves the layout the editor
   opened with, against its version).
2. **Two devices.** Phone A moves the desk and saves; phone B, opened before, adds a fern and taps Done. Expected:
   409; phone B stays in the editor with A's layout, its fern gone from the room and back in the drawer, the line
   "Something changed on another device. Your room was refreshed." and Done disabled. Pinned in Task 4 (stale
   version, concurrent first saves under the lock) and Task 11 (the refreshed path rebases the draft).
3. **Letting go on an invalid spot.** A beanbag dragged from the drawer onto the chair, then a fern dragged off the
   floor's edge. Expected: the beanbag goes back to the inventory, the fern back to its tile, the reason shows while
   dragging ("Blocks KIP's chair", "Doesn't fit here"), no undo step is added, and Undo then undoes the action before.
   Pinned in Task 9 (invalid drops are no-ops), Task 12 (the ghost turns red with the reason; letting go restores) and
   Task 13 (the drawer's drag-in onto the chair).
4. **Storing a parent.** The wall plank with books on it is stored, then Undo. Expected: both go to the inventory
   (counts +1 each), "Store wall plank and 1 piece on it" is the button's spoken label, and Undo puts both back on
   the same spot. Pinned in Task 9 (store with children, undo) and Task 11 (the label).
5. **A full room.** At 40 pieces: the drawer's Place is disabled, Another is greyed, a dragged-in piece reads "Room
   is full", and the room-full card shows "Store a piece"; after storing one, Place works again. Pinned in Task 9
   (cap in `canPlace`), Task 12 (a drag-in at the cap) and Task 13 (the card and the disabled Place).

## File Structure

**Backend (create):**
- `src/room/geometry.ts`: placement types and rules, pure, no imports (copied to the app).
- `src/room/convert.ts`: `layoutFromSlots`, `STARTER_LAYOUT`, `slotsFromLayout`.
- `src/room/layout.ts`: `countsOf`, `placedCounts`, `readLayout` (read-time sanitising), `geometryDeps`.
- `src/room/lock.ts`: `ROOM_LOCK_NAMESPACE`, `lockRoom`.
- `scripts/convert-room-layouts.ts`.
- `prisma/migrations/20261016120000_freebuild/migration.sql`.
- Tests in `tests/room/`: `geometry.test.ts`, `convert.test.ts`, `copy.test.ts`, `read.test.ts`, `save.test.ts`,
  `script.test.ts`, `noCoachImport.test.ts`, `helpers.ts`; `tests/cosmetics/grantsShipped.json`.

**Backend (modify):** `prisma/schema.prisma`, `src/cosmetics/{catalogue,export,rules,unlock,worn,loadout,routes}.ts`,
`scripts/export-cosmetics.ts`, `src/users/deletion.ts`, `tests/users/ownedData.ts`, `tests/cosmetics/*.test.ts`,
`tests/cosmetics/everShipped.json`.

**Mobile (create):**
- `src/lib/room/iso/geometry.ts` (generated copy), `grid.ts`, `prims.ts`, `sort.ts`, `styles.ts`, `art.ts`,
  `room.ts`, `crop.ts`, `index.ts`;
- `src/lib/room/iso/pieces/stand.ts`, `wallArt.ts`, `desks.ts`, `rugs.ts`, `extras.ts`;
- `src/lib/room/layout.ts`; `src/lib/room/edit/editor.ts`, `targets.ts`, `labels.ts`, `overlay.ts`, `drag.ts`,
  `drawer.ts`;
- `src/components/edit/EditRoom.tsx`, `EditToolbar.tsx`, `InventoryDrawer.tsx`, `RoomFullCard.tsx`,
  `PiecesList.tsx`, `NudgePad.tsx`, `CoachMark.tsx`; `src/components/room/pictures.ts`;
- `src/components/coach/RoomWelcomeCard.tsx`;
- `jest-mocks/cosmeticsFixture.ts`;
- tests under `__tests__/lib/iso*.test.ts`, `__tests__/lib/edit*.test.ts`, `__tests__/components/Edit*.test.tsx`,
  `__tests__/screens/DecorateRoomScreen.test.tsx` (rewritten), `__tests__/perf/isoBuild.test.ts`.

**Mobile (modify):** `src/lib/room/{catalogue,catalogue.json,loadout,items,cosmeticsStore,roomCopy,announce}.ts`,
`src/lib/room/items/{window,sets/cottage}.ts`, `src/api/cosmetics.ts`, `src/components/room/RoomView.tsx`,
`src/components/coach/{RoomCard,CollapsedKipHeader}.tsx`, `src/components/decorate/{DecorateTile,SetCard}.tsx`,
`src/screens/{DecorateRoomScreen,CoachScreen}.tsx`, `src/navigation/RootNavigator.tsx`, `src/lib/kipStage.ts`, every
`room/slots` importer (Task 10), `jest-mocks/{RoomView.js,roomArtChecks.ts}`, `scripts/room-art-size.mjs`,
`__tests__/conventions/{buttons,kipWorn}.test.ts`.

**Mobile (delete):** in Task 10 `src/lib/room/{draw,slots,hotspots,decorate}.ts`, `src/components/room/roomCrop.ts`,
`src/components/decorate/{HotspotLayer,DecorateTray}.tsx` and the tests that only covered them
(`__tests__/lib/{room,decorate}.test.ts`, `__tests__/perf/roomBuild.test.ts`); in Task 13 `src/lib/room/tray.ts` and
`__tests__/lib/decorateTray.test.ts`. The iso and editor tests replace them.

---

### Task 0: Workspace (controller; no code)

- [ ] **Step 1:** Create the workspace with
  `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-15-kip-freebuild-p1.md`,
  so that `.superpowers/sdd/2026-10-15-kip-freebuild-p1/` exists. Copy `common-context.md`,
  `implementer-instructions.md` and `reviewer-instructions.md` from `.superpowers/sdd/2026-10-14-kip-room/`, then
  edit the branch (`feature/kip-freebuild`), the plan and spec names, and the base note (Specs A and B are the built
  base; only the free-build spec's P1 row is in scope).
- [ ] **Step 2:** Copy `backend-jest.sh`, `backup-db.sh`, `schema-drift.sh`, `sync-run.sh` and `metro-local.sh`
  from `.superpowers/sdd/2026-10-14-kip-room/` into the new folder, then:
  - `backup-db.sh`: the dump name becomes `biometrics-before-kip-freebuild-p1-2026-10-15.dump`.
  - `sync-run.sh` (ruling 26): in the mobile rsync add `--exclude '.env*'` (replacing `--exclude .env`), and after
    the `npx prisma migrate deploy` line add
    `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts 2>&1 | tail -1`.
  - `metro-local.sh`: drop the inline `EXPO_PUBLIC_API_BASE_URL=…` (the run folder's `mobile/.env.development.local`
    already points the app at `http://localhost:3000`), add a guard line
    `grep -q 'localhost:3000' "$HOME/dev/biometrics-run/mobile/.env.development.local" || { echo "missing .env.development.local"; exit 1; }`,
    and set the screenshot folder to `.superpowers/sdd/2026-10-15-kip-freebuild-p1/shots`.
- [ ] **Step 3:** Set up and measure: `cd backend && DATABASE_URL=postgresql://x@localhost/x npx prisma generate`,
  then confirm `node node_modules/.bin/tsc --noEmit -p .` reports 0. Run the mobile typecheck, save the error lines to
  `.superpowers/sdd/2026-10-15-kip-freebuild-p1/tsc-baseline.txt`, and confirm the count is 10.
- [ ] **Step 4:** Write the 26 plan rulings into the ledger as `Ruling: … — why — cost` lines, and record the order:
  - subagent-driven;
  - backend Tasks 1 → 2 → 3 → 4 strictly (shared catalogue, schema and loadout code);
  - Task 5 after 2 (it imports the geometry copy); Tasks 6 → 7 → 8 strictly after 5 (shared `iso/` files and art
    tests);
  - Task 9 after 8; Task 10 after 4 and 9; Tasks 11 → 12 → 13 → 14 → 15 strictly after 10 (they share the screen,
    the reducer and `roomCopy.ts`);
  - Task 16 last.

---

### Task 1: Backend: the catalogue goes iso (`iso` blocks, shipped releases, the release-3 pieces)

Spec §2.1 (catalogue additions, releases, the new structural pieces, `kipDesk` on every desk), §4 (what ships in P1)
and §16's catalogue tests. Rulings 1–4, 7, 20 and the Spec B Task 2 ledger item (`item.sets` filtered).

**Files:**
- Modify: `backend/src/cosmetics/catalogue.ts`, `backend/src/cosmetics/rules.ts`, `backend/src/cosmetics/unlock.ts`,
  `backend/src/cosmetics/worn.ts`, `backend/src/cosmetics/loadout.ts`, `backend/src/cosmetics/export.ts`
- Create: `backend/src/room/geometry.ts` (types only in this task; the rules arrive in Task 2)
- Modify (tests): `backend/tests/cosmetics/catalogue.test.ts`, `export.test.ts`, `rules.test.ts`, `routes.test.ts`,
  `everShipped.json`; create `backend/tests/cosmetics/grantsShipped.json`
- Modify (generated): `mobile/src/lib/room/catalogue.json`
- Modify (mobile): `mobile/src/lib/room/catalogue.ts` (`releases`), `mobile/__tests__/lib/roomCatalogue.test.ts`,
  `mobile/jest-mocks/roomArtChecks.ts` (release-3 pieces have iso art only)

**Interfaces:**
- Consumes: Spec B's `COSMETIC_ITEMS`, `COSMETIC_SETS`, `cosmeticItem`, `planGrants`, `grantCosmetics`,
  `exportCatalogue`.
- Produces:
  - `type CosmeticRelease = 1 | 2 | 3`; `SHIPPED_RELEASES: ReadonlySet<CosmeticRelease>` (`{1, 3}`);
    `type ShippedRelease = 1 | 3`; `RELEASE_LAUNCHED_AT: Readonly<Record<ShippedRelease, Date>>`;
    `isShipped(x: { release: CosmeticRelease }): boolean`; `shippedItem(id: string): CosmeticItem | undefined`
    (`COSMETICS_RELEASE` is removed);
  - `CosmeticItem.iso?: IsoSpec`, `.grants?: number`, `.tags?: string[]`;
  - `STARTER_IDS` (19 ids: Spec B's 17 plus `shelf.plank`, `lamp.welcome`);
  - from `backend/src/room/geometry.ts`: `IsoLayer`, `IsoSpec`, `PlacementLayer`, `Placement`, `StyleKey`,
    `STYLE_KEYS`, `RoomLayout`, `Tier`;
  - `planGrants({ …, shipped: ReadonlySet<number>, launchedAt })` and `GrantOptions.shipped` (replacing `release`);
  - `exportCatalogue(shipped?: ReadonlySet<number>): CatalogueExport` with `releases: number[]` (replacing
    `release`).

- [ ] **Step 1: Write the failing tests**

In `backend/tests/cosmetics/catalogue.test.ts`:
- change the import list: drop `COSMETICS_RELEASE`, add `SHIPPED_RELEASES`, `isShipped`;
- `const base = COSMETIC_ITEMS.filter((i) => !i.id.startsWith('set.') && i.release !== 3);` (the Cat boards' 134
  stay 134; the release-3 pieces are structural);
- replace the starter test:

```ts
it('has the 19 starter items, all shipped, and a starter room of placed starters', () => {
  expect([...STARTER_IDS].sort()).toEqual([
    'art.calendar', 'desk.monitor', 'desk.notebook', 'floor.oakDark', 'item.mug', 'item.sticky', 'lamp.amber', 'lamp.welcome',
    'out.beanie', 'out.earbuds', 'plant.cactus', 'plant.fern', 'rug.slate', 'shelf.books', 'shelf.minicactus', 'shelf.plank',
    'wall.dots', 'wall.plain', 'win.plain',
  ]);
  for (const id of STARTER_IDS) expect(isShipped(cosmeticItem(id)!)).toBe(true);
  for (const slot of ROOM_SLOTS) {
    const id = STARTER_ROOM[slot];
    if (id === null) expect(OPTIONAL_ROOM_SLOTS.has(slot)).toBe(true);
    else expect([slot, cosmeticItem(id)!.slot, STARTER_IDS.includes(id)]).toEqual([slot, slot, true]);
  }
  expect([STARTER_ROOM.corner, STARTER_ROOM.pet]).toEqual([null, null]);
});
```

- replace the last test ("a launch date for every release the app ships"), and add the iso tests:

```ts
it('has a launch date for every shipped release, and ships releases 1 and 3 (spec §2.1 Releases)', () => {
  expect([...SHIPPED_RELEASES].sort()).toEqual([1, 3]);
  for (const r of SHIPPED_RELEASES) expect(RELEASE_LAUNCHED_AT[r as 1 | 3]).toBeInstanceOf(Date);
  expect(COSMETIC_ITEMS.filter((i) => i.release === 3).map((i) => i.id).sort()).toEqual(['lamp.welcome', 'shelf.plank']);
});

const PLACEABLE = ROOM_SLOTS.filter((s) => s !== 'wallpaper' && s !== 'floor' && s !== 'window');

describe('iso blocks (spec §2.1, §16 Catalogue)', () => {
  it('every placeable item has one; styles and worn items have none', () => {
    for (const item of COSMETIC_ITEMS) {
      const placeable = (PLACEABLE as readonly string[]).includes(item.slot);
      expect({ id: item.id, iso: !!item.iso }).toEqual({ id: item.id, iso: placeable });
    }
  });

  it('footprints and wall sizes are positive whole tiles; on-top pieces are one tile at most and hold nothing', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.iso)) {
      const iso = item.iso!;
      const tag = { id: item.id };
      expect({ ...tag, layers: iso.layers.length > 0 }).toEqual({ ...tag, layers: true });
      for (const n of [...(iso.foot ?? []), ...(iso.wall ?? [])]) expect({ ...tag, ok: Number.isInteger(n) && n > 0 }).toEqual({ ...tag, ok: true });
      if (iso.layers.includes('floor')) expect({ ...tag, foot: !!iso.foot }).toEqual({ ...tag, foot: true });
      if (iso.layers.includes('wall')) expect({ ...tag, wall: !!iso.wall }).toEqual({ ...tag, wall: true });
      if (iso.layers.includes('onTop')) {
        expect({ ...tag, small: !iso.foot || (iso.foot[0] <= 1 && iso.foot[1] <= 1), surface: !!iso.surface }).toEqual({ ...tag, small: true, surface: false });
      }
      if (iso.flat) expect({ ...tag, layers: iso.layers }).toEqual({ ...tag, layers: ['floor'] });
    }
  });

  it('every desk item, shipped or not, is a kipDesk: 3 × 2, a seat on the front row, 3 spots on the desk', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === 'desk')) {
      const iso = item.iso!;
      expect({ id: item.id, kipDesk: iso.kipDesk, foot: iso.foot, seat: iso.seat, spots: iso.surface?.spots.length, facings: iso.facings })
        .toEqual({ id: item.id, kipDesk: true, foot: [3, 2], seat: [1, 1], spots: 3, facings: 2 });
    }
    expect(COSMETIC_ITEMS.filter((i) => i.iso?.kipDesk).every((i) => i.slot === 'desk')).toBe(true);
  });

  it('spots lie inside their piece: the footprint on the floor, the first half tile off the wall', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.iso?.surface)) {
      const iso = item.iso!;
      const [w, d] = iso.foot ?? [iso.wall![0] / 2, 0.5];
      for (const [si, sj] of iso.surface!.spots) expect({ id: item.id, inside: si > 0 && si < w && sj > 0 && sj < d }).toEqual({ id: item.id, inside: true });
    }
  });

  it('wall art is at most 4 half-tiles wide, so a converted room\'s art ends before the plank (spec §2.4)', () => {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === 'art')) expect({ id: item.id, w: item.iso!.wall![0] <= 4 }).toEqual({ id: item.id, w: true });
  });

  it('only desks, rugs and the welcome lantern have two drawn facings (ruling 3)', () => {
    const two = COSMETIC_ITEMS.filter((i) => isShipped(i) && i.iso?.facings === 2).map((i) => i.id);
    expect(two.every((id) => /^(desk|rug)\./.test(id) || id === 'set.cottage.desk' || id === 'set.cottage.rug' || id === 'lamp.welcome')).toBe(true);
    expect(two).toEqual(expect.arrayContaining(['desk.monitor', 'rug.slate', 'lamp.welcome', 'set.cottage.desk']));
  });

  it('the structural pieces: a 2-spot wall plank, the welcome lantern, the Cottage garland on the wall', () => {
    expect(cosmeticItem('shelf.plank')!.iso).toEqual({ layers: ['wall'], wall: [4, 1], surface: { z: 2, spots: [[0.5, 0.2], [1.5, 0.2]] }, facings: 1 });
    expect(cosmeticItem('lamp.welcome')!.iso).toEqual({ layers: ['floor', 'onTop'], foot: [1, 1], facings: 2 });
    expect(cosmeticItem('lamp.welcome')!.emissive).toBe(true);
    expect(cosmeticItem('set.cottage.lamp')!.iso).toEqual({ layers: ['wall'], wall: [8, 2], facings: 1 });
  });

  it('tags the Funny tab\'s pieces (ruling 20)', () => {
    expect(COSMETIC_ITEMS.filter((i) => i.tags?.includes('funny')).map((i) => i.id).sort()).toEqual(['corner.beanbag', 'item.controller', 'shelf.globe', 'shelf.luckycat']);
  });
});

// A copy count, once shipped, never changes (spec §2.1 `grants`).
const grantsShipped = JSON.parse(fs.readFileSync(path.join(__dirname, 'grantsShipped.json'), 'utf8')) as Record<string, number>;
it('keeps every shipped item\'s copy count; every shipped item is recorded', () => {
  for (const [id, n] of Object.entries(grantsShipped)) expect({ id, n: cosmeticItem(id)!.grants ?? 1 }).toEqual({ id, n });
  expect(COSMETIC_ITEMS.filter((i) => isShipped(i) && !(i.id in grantsShipped)).map((i) => i.id)).toEqual([]);
});
```

In `backend/tests/cosmetics/export.test.ts` replace the second to fourth tests (import `isShipped`, drop
`COSMETICS_RELEASE`):

```ts
it('ships only the shipped releases, and every set id an item names is a shipped set', () => {
  const e = exportCatalogue();
  expect(e.releases).toEqual([1, 3]);
  expect(e.items.every((i) => isShipped(i))).toBe(true);
  expect(e.sets.every((s) => isShipped(s))).toBe(true);
  const shipped = new Set(e.items.map((i) => i.id));
  for (const set of e.sets) for (const id of [...Object.values(set.room), ...Object.values(set.worn)]) expect(shipped.has(id!)).toBe(true);
  const setIds = new Set(e.sets.map((s) => s.id));
  for (const item of e.items) for (const s of item.sets ?? []) expect({ id: item.id, s, shipped: setIds.has(s) }).toEqual({ id: item.id, s, shipped: true });
  expect(e.items.find((i) => i.id === 'plant.snake')!.sets).toBeUndefined(); // homeGym and library are release 2
});

it('ships every item grantCosmetics can grant', () => {
  const shipped = new Set(exportCatalogue().items.map((i) => i.id));
  const grantable = COSMETIC_ITEMS.filter((i) => isShipped(i) && !i.retired && i.unlock.kind !== 'starter');
  expect(grantable.filter((i) => !shipped.has(i.id)).map((i) => i.id)).toEqual([]);
});

it('a release-2 export would add the other five sets', () => {
  const all = exportCatalogue(new Set([1, 2, 3]));
  expect(all.sets).toHaveLength(6);
  expect(all.items.length).toBeGreaterThan(exportCatalogue().items.length);
});
```

In `backend/tests/cosmetics/rules.test.ts` line 9 change `release: 1` to `shipped: new Set([1, 3])`, and line 93
change `{ release: 2, launchedAt }` to `{ shipped: new Set([1, 2, 3]), launchedAt }`. In `routes.test.ts` line 36
change `toHaveLength(17)` to `toHaveLength(19)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run (from the worktree root): `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/cosmetics`
Expected: FAIL (`SHIPPED_RELEASES`, `isShipped` not exported; no iso blocks; `releases` missing).

- [ ] **Step 3: The placement types in `backend/src/room/geometry.ts`**

```ts
// KIP's free-build room (spec 2026-10-15 §2.1, §2.3, §3.2, §3.3, §12): the placement types and, from Task 2, every
// placement rule. Pure and self-contained, with no imports: backend/scripts/export-cosmetics.ts copies this file
// verbatim to mobile/src/lib/room/iso/geometry.ts and tests/room/copy.test.ts fails when the copy is stale, so the
// app's red tint and the server's 400 never disagree.

export type IsoLayer = 'floor' | 'wall' | 'onTop';

export interface IsoSpec {
  /** Where it may go; a cactus: ['floor', 'onTop']. */
  layers: IsoLayer[];
  /** Floor footprint in whole tiles, [along i, along j] facing L; facing R swaps them (plan ruling 2). */
  foot?: [number, number];
  /** Rugs: drawn under everything, never block other pieces, never overlap another rug. */
  flat?: true;
  /** Wall size: half tiles along the wall × 4-cell steps up. */
  wall?: [number, number];
  /** Things can stand on it: spots in tile fractions from the piece's origin, at height z (cells). */
  surface?: { z: number; spots: Array<[number, number]> };
  /** 2 = drawn facing L and R; 1 = Turn is off. */
  facings: 1 | 2;
  /** The desk KIP sits at (one per room). */
  kipDesk?: true;
  /** KIP's tile in the footprint, [along w, along d] facing L. */
  seat?: [number, number];
}

export type PlacementLayer = 'floor' | 'wallL' | 'wallR' | 'onTop';

export interface Placement {
  /** Made by the app: /^[a-z0-9]{1,12}$/, unique in the layout. */
  id: string;
  item: string;
  layer: PlacementLayer;
  /** floor: tile i, j of the back corner; wall: half tile along, 4-cell step up; onTop: 0, 0. */
  x: number;
  y: number;
  facing: 'L' | 'R';
  mirror: boolean;
  /** onTop only: the instance it stands on, and that piece's spot index. */
  parent?: string;
  spot?: number;
}

export const STYLE_KEYS = ['wallpaper', 'floor', 'window'] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

export interface RoomLayout {
  v: 1;
  styles: Record<StyleKey, string>;
  /** Order is not meaningful; the engine sorts. */
  pieces: Placement[];
}

/** 1 starter 7 × 7, 2 bigger 8 × 8, 3 loft 9 × 9 (spec §7). Only the expand route (P2) changes it. */
export type Tier = 1 | 2 | 3;
```

- [ ] **Step 4: The catalogue in `backend/src/cosmetics/catalogue.ts`**

Replace the header comment's last two sentences with: "Only items whose release is in SHIPPED_RELEASES are exported
to the app or granted (free-build §2.1: releases no longer ship in order), so nobody owns an item the app cannot
draw. The art lives only in the app; placement data (`iso`) lives here because the server validates layouts."

Replace the release constants:

```ts
import type { IsoSpec } from '../room/geometry';

export type CosmeticRelease = 1 | 2 | 3;
/** Releases the app can draw. B2 (release 2) joins when its art ships; free-build P1's pieces are release 3. */
export const SHIPPED_RELEASES: ReadonlySet<CosmeticRelease> = new Set<CosmeticRelease>([1, 3]);
export type ShippedRelease = 1 | 3;
/**
 * When each shipped release reached users (Spec B §3.1): a rule met before it grants as 'backfill'. A full record,
 * so a release cannot ship without a date (Spec B Task 3 minor). OWNER NOTE (plan ruling 1): both are set to the real
 * ship date when Spec B and P1 merge.
 */
export const RELEASE_LAUNCHED_AT: Readonly<Record<ShippedRelease, Date>> = Object.freeze({
  1: new Date('2026-10-15T00:00:00.000Z'),
  3: new Date('2026-10-16T00:00:00.000Z'),
});
export function isShipped(x: { release: CosmeticRelease }): boolean {
  return SHIPPED_RELEASES.has(x.release);
}
```

Extend `CosmeticItem`:

```ts
  /** Placement rules (free-build §2.1); styles and worn items have none. */
  iso?: IsoSpec;
  /** Copies an unlock gives; default 1; frozen once shipped (tests/cosmetics/grantsShipped.json). */
  grants?: number;
  /** 'funny' (the drawer's Funny tab); P4 adds challenge tags. */
  tags?: string[];
```

After the `BASE` rows add the release-3 rows (they join `BASE` in `build()`):

```ts
// Free-build P1's structural pieces (spec 2026-10-15 §2.1): a wall plank for the old shelf slot's items, and C7's
// welcome lantern, owned by everyone from P1.
const FREEBUILD: readonly Row[] = [
  ['shelf.plank', 'shelf', 'S', '', 3],
  ['lamp.welcome', 'lamp', 'S', 'G', 3],
];
```

and the iso data:

```ts
/** KIP's desk and chair (spec §2.1, §3.2): 3 × 2, KIP's seat on the front row, 3 spots on the desk top. */
const DESK_ISO: IsoSpec = {
  layers: ['floor'], foot: [3, 2], facings: 2, kipDesk: true, seat: [1, 1],
  surface: { z: 22, spots: [[0.45, 0.55], [1.5, 0.6], [2.55, 0.55]] },
};
const SLOT_ISO: Partial<Record<RoomSlot, IsoSpec>> = {
  art: { layers: ['wall'], wall: [4, 6], facings: 1 },
  shelf: { layers: ['onTop'], facings: 1 },
  desk: DESK_ISO,
  desk_item: { layers: ['onTop'], facings: 1 },
  plant: { layers: ['floor', 'onTop'], foot: [1, 1], facings: 1 },
  lamp: { layers: ['onTop'], facings: 1 },
  corner: { layers: ['floor'], foot: [1, 1], facings: 1 },
  rug: { layers: ['floor'], foot: [4, 3], flat: true, facings: 2 },
  pet: { layers: ['floor'], foot: [1, 1], facings: 1 },
};
/** Each release-1 art piece's wall size from its front-on bounds (pin and shadow included): ceil(w / 6) half tiles ×
 * ceil(h / 4) steps (plan ruling 4). Release-2 art keeps the slot default until its iso art is drawn. */
const ART_WALL: Readonly<Record<string, [number, number]>> = {
  'art.calendar': [3, 6], 'art.mountain': [4, 5], 'art.pennant': [3, 5], 'art.clock': [3, 5], 'art.heart': [3, 4],
  'art.motto': [3, 6], 'art.band': [3, 6], 'art.cork': [4, 5], 'art.wave': [4, 5], 'set.cottage.art': [3, 5],
};
/** Rug footprints: each fits the converted room's rug tiles from (1, 2) (spec §2.4). */
const RUG_FOOT: Readonly<Record<string, [number, number]>> = {
  'rug.slate': [4, 4], 'rug.red': [4, 3], 'rug.gymmat': [4, 2], 'rug.checker': [3, 3], 'rug.woven': [3, 3], 'rug.tatami': [4, 3],
  'set.cottage.rug': [4, 3],
};
const ISO_OVERRIDES: Readonly<Record<string, IsoSpec>> = {
  'shelf.plank': { layers: ['wall'], wall: [4, 1], surface: { z: 2, spots: [[0.5, 0.2], [1.5, 0.2]] }, facings: 1 },
  'lamp.welcome': { layers: ['floor', 'onTop'], foot: [1, 1], facings: 2 },
  // The fairy lights along the beam become a garland on the left wall, above the window (plan ruling 7).
  'set.cottage.lamp': { layers: ['wall'], wall: [8, 2], facings: 1 },
};
const FUNNY: ReadonlySet<string> = new Set(['shelf.luckycat', 'shelf.globe', 'item.controller', 'corner.beanbag']);

function isoFor(item: CosmeticItem): IsoSpec | undefined {
  const over = ISO_OVERRIDES[item.id];
  if (over) return over;
  const base = SLOT_ISO[item.slot as RoomSlot];
  if (!base) return undefined;
  if (item.slot === 'art' && ART_WALL[item.id]) return { ...base, wall: ART_WALL[item.id] };
  if (item.slot === 'rug' && RUG_FOOT[item.id]) return { ...base, foot: RUG_FOOT[item.id] };
  return base;
}
```

In `build()` iterate `[...BASE, ...FREEBUILD]`, and just before `return` finish every item:

```ts
  for (const [id, item] of items) {
    const iso = isoFor(item);
    items.set(id, { ...item, ...(iso ? { iso } : {}), ...(FUNNY.has(id) ? { tags: ['funny'] } : {}) });
  }
```

At the bottom:

```ts
export function shippedItem(id: string): CosmeticItem | undefined {
  const item = ITEM_BY_ID.get(id);
  return item && isShipped(item) ? item : undefined;
}
```

Delete `COSMETICS_RELEASE`. `CosmeticSet.release` stays `CosmeticRelease`.

- [ ] **Step 5: Rules, grants, worn and the loadout read the shipped set**

`backend/src/cosmetics/rules.ts`: in the `planGrants` input replace `release: number;` with
`shipped: ReadonlySet<number>;` and type `launchedAt` as `Readonly<Partial<Record<number, Date>>>`; then
`item.release > release` becomes `!shipped.has(item.release)` and `set.release > release` becomes
`!shipped.has(set.release)`.

`backend/src/cosmetics/unlock.ts`:

```ts
import { COSMETIC_ITEMS, COSMETIC_SETS, RELEASE_LAUNCHED_AT, SHIPPED_RELEASES, type CosmeticItem, type CosmeticSet } from './catalogue';

export interface GrantOptions {
  shipped?: ReadonlySet<number>;
  launchedAt?: Readonly<Partial<Record<number, Date>>>;
  items?: readonly CosmeticItem[];
  sets?: readonly CosmeticSet[];
}
```

and in the `planGrants` call `shipped: opts.shipped ?? SHIPPED_RELEASES,`. Find any other caller with
`grep -rn "release:" backend/tests/cosmetics backend/src | grep -v "catalogue.ts"` and convert it to `shipped`.

`backend/src/cosmetics/worn.ts`: `item.release <= COSMETICS_RELEASE` becomes `isShipped(item)`.

`backend/src/cosmetics/loadout.ts`: delete the local `shipped` helper and call `shippedItem(id)` (imported from the
catalogue) at its four call sites; drop the `COSMETICS_RELEASE` import.

- [ ] **Step 6: The export in `backend/src/cosmetics/export.ts`**

```ts
import {
  COSMETICS_CATALOGUE_VERSION, COSMETIC_ITEMS, COSMETIC_SETS, SHIPPED_RELEASES, STARTER_ROOM,
  type CosmeticItem, type CosmeticSet, type RoomSlot,
} from './catalogue';

export interface CatalogueExport {
  version: number;
  releases: number[];
  starterRoom: Record<RoomSlot, string | null>;
  items: CosmeticItem[];
  sets: CosmeticSet[];
}

export function exportCatalogue(shipped: ReadonlySet<number> = SHIPPED_RELEASES): CatalogueExport {
  const sets = COSMETIC_SETS.filter((s) => shipped.has(s.release));
  const setIds = new Set<string>(sets.map((s) => s.id));
  return {
    version: COSMETICS_CATALOGUE_VERSION,
    releases: [...shipped].sort((a, b) => a - b),
    starterRoom: { ...STARTER_ROOM },
    // An item lists only shipped sets (Spec B Task 2 minor): the app never sees a set it cannot show.
    items: COSMETIC_ITEMS.filter((i) => shipped.has(i.release)).map(({ sets: itemSets, ...rest }) => {
      const kept = (itemSets ?? []).filter((s) => setIds.has(s));
      return kept.length ? { ...rest, sets: kept } : rest;
    }),
    sets,
  };
}
```

Update the header comment ("release <= COSMETICS_RELEASE" → "releases in SHIPPED_RELEASES").

- [ ] **Step 7: The id and copy-count snapshots**

Append `"shelf.plank"` and `"lamp.welcome"` to `backend/tests/cosmetics/everShipped.json`. Write
`backend/tests/cosmetics/grantsShipped.json` from the catalogue (from `backend/`):

```bash
node node_modules/.bin/ts-node --project tsconfig.evals.json -e "const c=require('./src/cosmetics/catalogue');const o={};for(const i of c.COSMETIC_ITEMS)if(c.isShipped(i))o[i.id]=i.grants??1;require('fs').writeFileSync('tests/cosmetics/grantsShipped.json',JSON.stringify(o,null,2)+'\n')"
```

Expected: 89 entries, every value 1.

- [ ] **Step 8: Regenerate the app's catalogue and keep the mobile suite green**

From `backend/`: `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`
(expected: `wrote 89 items to the app's catalogue`).

In `mobile/src/lib/room/catalogue.ts` change the `CATALOGUE` cast's `release: number;` to `releases: number[];`. In
`mobile/__tests__/lib/roomCatalogue.test.ts` the second test's first lines become:

```ts
it('holds releases 1 and 3: 89 items and the Cottage set, every piece known', () => {
  expect([CATALOGUE.releases, CATALOGUE.items.length, CATALOGUE.sets.map((s) => s.id)]).toEqual([[1, 3], 89, ['cottage']]);
```

In `mobile/jest-mocks/roomArtChecks.ts`, `checkSlotArt` skips release-3 pieces (their art is iso only, Task 7):

```ts
  for (const item of catalogueItemsFor(slot).filter((i) => (sets || !i.id.startsWith('set.')) && i.release !== 3)) {
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/cosmetics`
Expected: PASS. Then, from `mobile/`: `node node_modules/.bin/jest --forceExit __tests__/lib` Expected: PASS.

- [ ] **Step 10: Full suites, typechecks, commit**

Full backend suite (green), backend tsc (0), full mobile suite (green), mobile tsc (10).

```bash
git add backend/src/cosmetics backend/src/room/geometry.ts backend/tests/cosmetics mobile/src/lib/room/catalogue.json mobile/src/lib/room/catalogue.ts mobile/__tests__/lib/roomCatalogue.test.ts mobile/jest-mocks/roomArtChecks.ts
git commit -m "feat(backend): iso placement data on the room catalogue, shipped releases 1 and 3, the wall plank and the welcome lantern"
```

---

### Task 2: Backend: the placement rules, slot → iso conversion, and their copies in the app

Spec §2.3 (the layout), §2.4 (conversion table), §3.2 (footprints, blocking, seat and exit tile, walls, windows),
§3.3 (stacking), §5.5 (sets as layouts), §11.1 (the starter layout), §12 (the rules live once, copied to the app) and
§16's geometry and conversion tests. Rulings 2, 7, 10, 11, 12 and 21.

**Files:**
- Modify: `backend/src/room/geometry.ts` (the rules)
- Create: `backend/src/room/convert.ts`, `backend/tests/room/geometry.test.ts`, `backend/tests/room/convert.test.ts`,
  `backend/tests/room/copy.test.ts`, `backend/tests/room/helpers.ts`
- Modify: `backend/src/cosmetics/export.ts`, `backend/scripts/export-cosmetics.ts`,
  `backend/tests/cosmetics/export.test.ts`
- Create (generated): `mobile/src/lib/room/iso/geometry.ts`; modify (generated) `mobile/src/lib/room/catalogue.json`
- Modify: `mobile/src/lib/room/catalogue.ts`; create `mobile/__tests__/lib/isoCatalogue.test.ts`

**Interfaces:**
- Consumes: Task 1's `IsoSpec`, `Placement`, `RoomLayout`, `Tier`, `STYLE_KEYS`, `shippedItem`, `cosmeticItem`,
  `STARTER_ROOM`, `ROOM_SLOTS`, `OPTIONAL_ROOM_SLOTS`.
- Produces (`backend/src/room/geometry.ts`, copied verbatim to `mobile/src/lib/room/iso/geometry.ts`):
  - `TIERS: Record<Tier, { n: number; cap: number }>`, `tierSize(tier): { n: number; m: number }`,
    `capFor(tier): number`, `WALL_STEPS = 16`, `INSTANCE_ID`, `MAX_LAYOUT_PIECES = 200`;
  - `interface Area { x0; y0; x1; y1 }`, `footOf(p, iso): Area`, `wallAreaOf(p, iso): Area`,
    `wallLength(wall, tier): number`, `windowsOn(wall, tier): Area[]`, `seatTile(p, iso)`, `exitTile(p, iso)`
    (`[number, number] | null`), `layerAllows(iso, layer): boolean`;
  - `type BadReason`, `interface Refusal { reason: BadReason; with?: string }`,
    `interface GeometryDeps { isoOf(item: string): IsoSpec | undefined }`;
  - `checkPiece(layout, piece, tier, deps): Refusal | null`;
  - `type LayoutFailure`, `validateLayout(layout, tier, deps): LayoutFailure | null`;
  - `parseLayout(value: unknown): RoomLayout | null`.
- Produces (`backend/src/room/convert.ts`): `type SlotRoom`, `ART_STEP = 9`, `layoutFromSlots(room): RoomLayout`,
  `starterLayout(): RoomLayout`, `slotsFromLayout(layout): SlotRoom`.
- Produces (export): `CatalogueExport.starterLayout: RoomLayout`, each set's `layout: RoomLayout`,
  `MOBILE_GEOMETRY_PATH`, `geometryCopy(): string`.
- Produces (mobile `catalogue.ts`): `CatalogueItem.iso?`, `.tags?`, `.grants?`, `CatalogueSet.layout`,
  `CATALOGUE.starterLayout`, `isoOf(id): IsoSpec | undefined`, `GEOMETRY_DEPS: GeometryDeps`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/room/helpers.ts`:

```ts
import { shippedItem } from '../../src/cosmetics/catalogue';
import type { GeometryDeps, Placement, RoomLayout } from '../../src/room/geometry';
import { starterLayout } from '../../src/room/convert';

export const deps: GeometryDeps = { isoOf: (id) => shippedItem(id)?.iso };

/** A placement with the defaults a test does not care about. */
export const piece = (id: string, item: string, over: Partial<Placement> = {}): Placement =>
  ({ id, item, layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false, ...over });

/** The starter layout with these pieces added (or replaced by id). */
export function withPieces(...extra: Placement[]): RoomLayout {
  const base = starterLayout();
  const ids = new Set(extra.map((p) => p.id));
  return { ...base, pieces: [...base.pieces.filter((p) => !ids.has(p.id)), ...extra] };
}
```

`backend/tests/room/geometry.test.ts`:

```ts
import { capFor, checkPiece, exitTile, footOf, parseLayout, seatTile, validateLayout, windowsOn, type RoomLayout } from '../../src/room/geometry';
import { starterLayout } from '../../src/room/convert';
import { deps, piece, withPieces } from './helpers';

const check = (layout: RoomLayout, id: string, tier: 1 | 2 | 3 = 1) => checkPiece(layout, layout.pieces.find((p) => p.id === id)!, tier, deps);

describe('footprints, the seat and the exit tile (spec §3.2, plan rulings 2 and 11)', () => {
  it('a facing-L desk covers 3 along i and 2 along j; turned, the axes swap and the back corner stays', () => {
    const iso = deps.isoOf('desk.monitor')!;
    expect(footOf({ x: 2, y: 0, facing: 'L' }, iso)).toEqual({ x0: 2, y0: 0, x1: 5, y1: 2 });
    expect(footOf({ x: 2, y: 0, facing: 'R' }, iso)).toEqual({ x0: 2, y0: 0, x1: 4, y1: 3 });
  });

  it('KIP\'s seat is on the front row and the exit tile is in front of it, for each facing', () => {
    const iso = deps.isoOf('desk.monitor')!;
    expect([seatTile(piece('d', 'desk.monitor', { x: 2 }), iso), exitTile(piece('d', 'desk.monitor', { x: 2 }), iso)]).toEqual([[3, 1], [3, 2]]);
    const r = piece('d', 'desk.monitor', { x: 0, y: 2, facing: 'R' });
    expect([seatTile(r, iso), exitTile(r, iso)]).toEqual([[1, 3], [2, 3]]);
  });
});

describe('checkPiece', () => {
  it('the starter layout is valid at every tier', () => {
    for (const tier of [1, 2, 3] as const) expect(validateLayout(starterLayout(), tier, deps)).toBeNull();
  });

  it('outside: off the 7 × 7 floor; the same desk fits the 8 × 8 room', () => {
    const l = withPieces(piece('desk', 'desk.monitor', { x: 5, y: 0 }));
    expect(check(l, 'desk', 1)).toEqual({ reason: 'outside' });
    expect(check(l, 'desk', 2)).toBeNull();
  });

  it('overlap names the other piece; a rug lies under anything but never on another rug', () => {
    expect(check(withPieces(piece('f', 'plant.fern', { x: 3, y: 0 })), 'f')).toEqual({ reason: 'overlap', with: 'desk' });
    expect(check(withPieces(piece('r2', 'rug.red', { x: 2, y: 0 })), 'r2')).toEqual({ reason: 'overlap', with: 'rug' });
    expect(check(withPieces(piece('rug', 'rug.red', { x: 2, y: 0 })), 'rug')).toBeNull(); // under the desk
  });

  it('seat: nothing but a rug may cover the desk\'s exit tile, and the exit tile must be in the room', () => {
    expect(check(withPieces(piece('b', 'corner.beanbag', { x: 3, y: 2 })), 'b')).toEqual({ reason: 'seat', with: 'desk' });
    expect(check(withPieces(piece('desk', 'desk.monitor', { x: 2, y: 5 })), 'desk')).toEqual({ reason: 'seat' });
    expect(check(starterLayout(), 'rug')).toBeNull(); // the starter rug covers (3, 2)
  });

  it('walls: inside the wall, never over a window, never over another wall piece', () => {
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallL', x: 4, y: 6 })), 'a')).toEqual({ reason: 'window' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 7, y: 9 })), 'a')).toEqual({ reason: 'wall', with: 'plank' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 12, y: 0 })), 'a')).toEqual({ reason: 'outside' });
    expect(check(withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 0, y: 12 })), 'a')).toEqual({ reason: 'outside' });
  });

  it('the loft adds a right-wall window over half-tiles 12 to 16 (spec §3.2)', () => {
    expect(windowsOn('wallR', 3)).toEqual([{ x0: 12, y0: 5, x1: 17, y1: 14 }]);
    expect(windowsOn('wallR', 2)).toEqual([]);
    const l = withPieces(piece('a', 'art.mountain', { layer: 'wallR', x: 12, y: 6 }));
    expect([check(l, 'a', 3), check(l, 'a', 2)]).toEqual([{ reason: 'window' }, null]);
  });

  it('stacking: a free spot of a parent with a surface, one level only', () => {
    const top = (id: string, parent: string, spot: number, item = 'item.sticky') => piece(id, item, { layer: 'onTop', parent, spot });
    expect(check(withPieces(top('s', 'desk', 1)), 's')).toBeNull();
    expect(check(withPieces(top('s', 'desk', 2)), 's')).toEqual({ reason: 'spot', with: 'deskitem' });
    expect(check(withPieces(top('s', 'desk', 3)), 's')).toEqual({ reason: 'spot', with: 'desk' });
    expect(check(withPieces(top('s', 'gone', 0)), 's')).toEqual({ reason: 'parent' });
    expect(check(withPieces(top('s', 'plant', 0)), 's')).toEqual({ reason: 'parent', with: 'plant' });
    expect(check(withPieces(top('s', 'deskitem', 0)), 's')).toEqual({ reason: 'nested', with: 'deskitem' });
  });
});

describe('validateLayout (spec §12 PUT errors, in order)', () => {
  it('wrong_layer: a desk on the wall, a mug on the floor, a turned fern', () => {
    expect(validateLayout(withPieces(piece('m', 'item.mug')), 1, deps)).toEqual({ error: 'wrong_layer', pieceIds: ['m'] });
    expect(validateLayout(withPieces(piece('f', 'plant.fern', { x: 6, y: 6, facing: 'R' })), 1, deps)).toEqual({ error: 'wrong_layer', pieceIds: ['f'] });
  });

  it('bad_place names the pieces and the reason', () => {
    expect(validateLayout(withPieces(piece('f', 'plant.fern', { x: 3, y: 0 })), 1, deps)).toEqual({ error: 'bad_place', reason: 'overlap', pieceIds: ['desk', 'f'] }); // the desk is checked first
  });

  it('desk_required: exactly one kipDesk piece', () => {
    const none = { ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id !== 'desk' && p.parent !== 'desk') };
    expect(validateLayout(none, 1, deps)).toEqual({ error: 'desk_required' });
    expect(validateLayout(withPieces(piece('d2', 'desk.notebook', { x: 2, y: 4 })), 1, deps)).toEqual({ error: 'desk_required' });
  });

  it('room_full past the tier\'s cap', () => {
    const tiles: Array<[number, number]> = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!(x >= 2 && x < 5 && y < 2) && !(x === 3 && y === 2)) tiles.push([x, y]);
    const l: RoomLayout = { ...starterLayout(), pieces: [piece('desk', 'desk.monitor', { x: 2 }), ...tiles.slice(0, 40).map(([x, y], k) => piece(`f${k}`, 'plant.fern', { x, y }))] };
    expect(validateLayout(l, 1, deps)).toEqual({ error: 'room_full', cap: capFor(1) });
    expect(validateLayout(l, 2, deps)).toBeNull();
  });
});

describe('parseLayout (400 invalid_body shapes)', () => {
  it('round-trips a valid layout', () => {
    expect(parseLayout(JSON.parse(JSON.stringify(starterLayout())))).toEqual(starterLayout());
  });

  it.each([
    ['v 2', (l: any) => ({ ...l, v: 2 })],
    ['an extra key', (l: any) => ({ ...l, rooms: [] })],
    ['a missing style', (l: any) => ({ ...l, styles: { wallpaper: 'wall.plain', floor: 'floor.oakDark' } })],
    ['a bad instance id', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], id: 'Desk!' }] })],
    ['duplicate ids', (l: any) => ({ ...l, pieces: [l.pieces[0], l.pieces[0]] })],
    ['an unknown placement key', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], colour: 'red' }] })],
    ['a fractional tile', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], x: 1.5 }] })],
    ['an on-top piece without a parent', (l: any) => ({ ...l, pieces: [{ ...l.pieces[1], parent: undefined }] })],
    ['a floor piece with a spot', (l: any) => ({ ...l, pieces: [{ ...l.pieces[0], spot: 1 }] })],
    ['over 200 pieces', (l: any) => ({ ...l, pieces: Array.from({ length: 201 }, (_, k) => ({ ...l.pieces[0], id: `p${k}` })) })],
  ])('rejects %s', (_label, make) => {
    expect(parseLayout(make(JSON.parse(JSON.stringify(starterLayout()))))).toBeNull();
  });
});
```

`backend/tests/room/convert.test.ts`:

```ts
import { COSMETIC_ITEMS, OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_ROOM, isShipped, type RoomSlot } from '../../src/cosmetics/catalogue';
import { layoutFromSlots, slotsFromLayout, starterLayout } from '../../src/room/convert';
import { validateLayout } from '../../src/room/geometry';
import { deps } from './helpers';

const STYLE: Partial<Record<RoomSlot, 'wallpaper' | 'floor' | 'window'>> = { wallpaper: 'wallpaper', floor: 'floor', window: 'window' };

it('converts every shipped item in every slot to a valid iso room (spec §2.4, §16)', () => {
  for (const slot of ROOM_SLOTS) {
    for (const item of COSMETIC_ITEMS.filter((i) => i.slot === slot && isShipped(i) && i.release !== 3)) {
      const layout = layoutFromSlots({ ...STARTER_ROOM, [slot]: item.id });
      const tag = { slot, id: item.id };
      expect({ ...tag, failure: validateLayout(layout, 1, deps) }).toEqual({ ...tag, failure: null });
      const placed = STYLE[slot] ? layout.styles[STYLE[slot]!] : layout.pieces.find((p) => p.item === item.id)?.item;
      expect({ ...tag, placed }).toEqual({ ...tag, placed: item.id });
    }
  }
});

it('puts each slot where isox.py\'s standard room has it', () => {
  const room = { ...STARTER_ROOM, art: 'art.mountain', corner: 'corner.floorlamp', pet: 'pet.bed' };
  expect(layoutFromSlots(room)).toEqual({
    v: 1,
    styles: { wallpaper: 'wall.plain', floor: 'floor.oakDark', window: 'win.plain' },
    pieces: [
      { id: 'desk', item: 'desk.monitor', layer: 'floor', x: 2, y: 0, facing: 'L', mirror: false },
      { id: 'lamp', item: 'lamp.amber', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 0 },
      { id: 'deskitem', item: 'item.mug', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 2 },
      { id: 'plank', item: 'shelf.plank', layer: 'wallR', x: 6, y: 10, facing: 'L', mirror: false },
      { id: 'shelf', item: 'shelf.books', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'plank', spot: 0 },
      { id: 'art', item: 'art.mountain', layer: 'wallR', x: 2, y: 9, facing: 'L', mirror: false },
      { id: 'plant', item: 'plant.fern', layer: 'floor', x: 0, y: 0, facing: 'L', mirror: false },
      { id: 'corner', item: 'corner.floorlamp', layer: 'floor', x: 5, y: 0, facing: 'L', mirror: false },
      { id: 'rug', item: 'rug.slate', layer: 'floor', x: 1, y: 2, facing: 'L', mirror: false },
      { id: 'pet', item: 'pet.bed', layer: 'floor', x: 4, y: 5, facing: 'L', mirror: false },
    ],
  });
});

it('places nothing for an empty slot, and hangs a lamp that cannot stand on a desk on the left wall (ruling 7)', () => {
  const ids = layoutFromSlots({ ...STARTER_ROOM, art: null, corner: null, pet: null }).pieces.map((p) => p.id);
  expect(ids.filter((id) => ['art', 'corner', 'pet'].includes(id))).toEqual([]);
  const garland = layoutFromSlots({ ...STARTER_ROOM, lamp: 'set.cottage.lamp' }).pieces.find((p) => p.id === 'lamp');
  expect(garland).toEqual({ id: 'lamp', item: 'set.cottage.lamp', layer: 'wallL', x: 0, y: 14, facing: 'L', mirror: false });
});

it('the starter layout is C7\'s: 7 placements, the books on a plank, no calendar (spec §11.1)', () => {
  const l = starterLayout();
  expect(l.pieces.map((p) => p.item).sort()).toEqual(['desk.monitor', 'item.mug', 'lamp.amber', 'plant.fern', 'rug.slate', 'shelf.books', 'shelf.plank']);
  expect(starterLayout()).not.toBe(l); // a fresh copy each call
});

it('derives a slot room back from a layout for dev builds (spec §2.4, until P2)', () => {
  const room = { ...STARTER_ROOM, art: 'art.mountain', corner: 'corner.floorlamp', pet: 'pet.bed', rug: 'rug.red' };
  expect(slotsFromLayout(layoutFromSlots(room))).toEqual(room);
  const bare = slotsFromLayout({ ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id === 'desk') });
  for (const slot of ROOM_SLOTS) if (bare[slot] === null) expect(OPTIONAL_ROOM_SLOTS.has(slot)).toBe(true);
});
```

`backend/tests/room/copy.test.ts`:

```ts
import fs from 'fs';
import { MOBILE_GEOMETRY_PATH, geometryCopy } from '../../src/cosmetics/export';

it('the app\'s copy of the placement rules is current: run scripts/export-cosmetics.ts after any change (spec §12)', () => {
  expect(fs.readFileSync(MOBILE_GEOMETRY_PATH, 'utf8')).toBe(geometryCopy());
});

it('the rules file imports nothing, so the copy compiles in the app', () => {
  expect(geometryCopy()).not.toMatch(/^\s*import\s/m);
});
```

Add to `backend/tests/cosmetics/export.test.ts`:

```ts
import { validateLayout } from '../../src/room/geometry';
import { layoutFromSlots, starterLayout } from '../../src/room/convert';
import { deps } from '../room/helpers';

it('ships the starter layout and one valid iso layout per set (spec §5.5, ruling 21)', () => {
  const e = exportCatalogue();
  expect(e.starterLayout).toEqual(starterLayout());
  for (const set of e.sets) {
    expect(set.layout).toEqual(layoutFromSlots(set.room));
    expect({ id: set.id, failure: validateLayout(set.layout, 1, deps) }).toEqual({ id: set.id, failure: null });
  }
});
```

`mobile/__tests__/lib/isoCatalogue.test.ts`:

```ts
import { CATALOGUE, GEOMETRY_DEPS, catalogueSet, isoOf } from '../../src/lib/room/catalogue';
import { validateLayout } from '../../src/lib/room/iso/geometry';

it('carries the server\'s iso blocks, the starter layout and each set\'s layout, all valid in the app\'s rules too', () => {
  expect(isoOf('desk.monitor')?.kipDesk).toBe(true);
  expect(isoOf('wall.plain')).toBeUndefined();
  expect(isoOf('no.such')).toBeUndefined();
  expect(CATALOGUE.starterLayout.pieces).toHaveLength(7);
  expect(validateLayout(CATALOGUE.starterLayout, 1, GEOMETRY_DEPS)).toBeNull();
  expect(validateLayout(catalogueSet('cottage')!.layout, 1, GEOMETRY_DEPS)).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room tests/cosmetics/export.test.ts`
Expected: FAIL (`checkPiece`, `convert.ts`, `geometryCopy` missing).

- [ ] **Step 3: The rules, appended to `backend/src/room/geometry.ts`**

```ts
export const TIERS: Readonly<Record<Tier, { n: number; cap: number }>> = {
  1: { n: 7, cap: 40 },
  2: { n: 8, cap: 60 },
  3: { n: 9, cap: 90 },
};
export function tierSize(tier: Tier): { n: number; m: number } {
  const n = TIERS[tier].n;
  return { n, m: n };
}
export function capFor(tier: Tier): number {
  return TIERS[tier].cap;
}
/** Walls are 64 cells tall: 16 steps of 4. */
export const WALL_STEPS = 16;
export const INSTANCE_ID = /^[a-z0-9]{1,12}$/;
/** A shape bound well above the largest cap; the cap itself is `room_full`. */
export const MAX_LAYOUT_PIECES = 200;

/** A box on the floor (tiles) or a wall (half tiles × steps): [x0, x1) × [y0, y1). */
export interface Area { x0: number; y0: number; x1: number; y1: number }
const overlap = (a: Area, b: Area) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const covers = (a: Area, t: readonly [number, number]) => t[0] >= a.x0 && t[0] < a.x1 && t[1] >= a.y0 && t[1] < a.y1;

/** The floor tiles a piece covers from its back corner; turned, w and d swap. */
export function footOf(p: Pick<Placement, 'x' | 'y' | 'facing'>, iso: IsoSpec): Area {
  const [w, d] = iso.foot ?? [1, 1];
  const [fw, fd] = p.facing === 'R' ? [d, w] : [w, d];
  return { x0: p.x, y0: p.y, x1: p.x + fw, y1: p.y + fd };
}

export function wallAreaOf(p: Pick<Placement, 'x' | 'y'>, iso: IsoSpec): Area {
  const [a, h] = iso.wall ?? [1, 1];
  return { x0: p.x, y0: p.y, x1: p.x + a, y1: p.y + h };
}

/** A wall's length in half tiles: the left wall runs along j (m tiles), the right wall along i (n tiles). */
export function wallLength(wall: 'wallL' | 'wallR', tier: Tier): number {
  const { n, m } = tierSize(tier);
  return 2 * (wall === 'wallL' ? m : n);
}

/** The window openings (spec §3.2): the left wall's at j 1.6–3.6, and the loft's on the right wall at i n − 2.6. */
export function windowsOn(wall: 'wallL' | 'wallR', tier: Tier): Area[] {
  const span = (a0: number, a1: number): Area => ({ x0: Math.floor(2 * a0), y0: 5, x1: Math.ceil(2 * a1), y1: 14 });
  if (wall === 'wallL') return [span(1.6, 3.6)];
  const { n } = tierSize(tier);
  return tier === 3 ? [span(n - 2.6, n - 0.6)] : [];
}

/** KIP's tile at a kipDesk piece: the seat moves with the desk, turns with it, and Flip mirrors it across the width. */
export function seatTile(p: Pick<Placement, 'x' | 'y' | 'facing' | 'mirror'>, iso: IsoSpec): [number, number] | null {
  if (!iso.seat) return null;
  const [w] = iso.foot ?? [1, 1];
  const si = p.mirror ? w - 1 - iso.seat[0] : iso.seat[0];
  const sj = iso.seat[1];
  return p.facing === 'R' ? [p.x + sj, p.y + si] : [p.x + si, p.y + sj];
}

/** The tile in front of the seat, kept free so KIP can always walk out (spec §3.2, §9.2). */
export function exitTile(p: Pick<Placement, 'x' | 'y' | 'facing' | 'mirror'>, iso: IsoSpec): [number, number] | null {
  const s = seatTile(p, iso);
  if (!s) return null;
  return p.facing === 'R' ? [s[0] + 1, s[1]] : [s[0], s[1] + 1];
}

export function layerAllows(iso: IsoSpec, layer: PlacementLayer): boolean {
  return iso.layers.includes(layer === 'wallL' || layer === 'wallR' ? 'wall' : layer);
}

export type BadReason = 'outside' | 'overlap' | 'wall' | 'window' | 'spot' | 'parent' | 'nested' | 'seat';
/** Why a piece can't stand where it is; `with` names the other piece involved, when there is one. */
export interface Refusal { reason: BadReason; with?: string }
export interface GeometryDeps {
  /** The item's iso block, or undefined for a style, a worn item or an id this side does not ship. */
  isoOf(item: string): IsoSpec | undefined;
}

/**
 * Why `piece` can't stand where it is in `layout`, or null. The layout's own entry with the piece's id is ignored, so
 * the same call checks a placed piece, a moved piece and a ghost from the drawer. The layer is assumed allowed
 * (validateLayout checks it first; the app checks it with layerAllows).
 */
export function checkPiece(layout: RoomLayout, piece: Placement, tier: Tier, deps: GeometryDeps): Refusal | null {
  const iso = deps.isoOf(piece.item);
  if (!iso) return { reason: 'outside' };
  const others = layout.pieces.filter((q) => q.id !== piece.id);
  const { n, m } = tierSize(tier);
  if (piece.layer === 'floor') {
    const a = footOf(piece, iso);
    if (a.x0 < 0 || a.y0 < 0 || a.x1 > n || a.y1 > m) return { reason: 'outside' };
    const exit = exitTile(piece, iso);
    if (exit && (exit[0] < 0 || exit[1] < 0 || exit[0] >= n || exit[1] >= m)) return { reason: 'seat' };
    for (const q of others) {
      if (q.layer !== 'floor') continue;
      const qi = deps.isoOf(q.item);
      if (!qi) continue;
      const b = footOf(q, qi);
      // Rugs lie under anything, never on another rug; everything else never overlaps.
      if (overlap(a, b) && !!iso.flat === !!qi.flat) return { reason: 'overlap', with: q.id };
      if (!iso.flat && !qi.flat) {
        const qExit = exitTile(q, qi);
        if ((qExit && covers(a, qExit)) || (exit && covers(b, exit))) return { reason: 'seat', with: q.id };
      }
    }
    return null;
  }
  if (piece.layer === 'wallL' || piece.layer === 'wallR') {
    const a = wallAreaOf(piece, iso);
    if (a.x0 < 0 || a.y0 < 0 || a.x1 > wallLength(piece.layer, tier) || a.y1 > WALL_STEPS) return { reason: 'outside' };
    if (windowsOn(piece.layer, tier).some((w) => overlap(a, w))) return { reason: 'window' };
    for (const q of others) {
      if (q.layer !== piece.layer) continue;
      const qi = deps.isoOf(q.item);
      if (qi && overlap(a, wallAreaOf(q, qi))) return { reason: 'wall', with: q.id };
    }
    return null;
  }
  const parent = others.find((q) => q.id === piece.parent);
  const pIso = parent ? deps.isoOf(parent.item) : undefined;
  if (!parent || !pIso) return { reason: 'parent' };
  if (parent.layer === 'onTop') return { reason: 'nested', with: parent.id };
  if (!pIso.surface) return { reason: 'parent', with: parent.id };
  const spot = piece.spot ?? -1;
  if (!Number.isInteger(spot) || spot < 0 || spot >= pIso.surface.spots.length) return { reason: 'spot', with: parent.id };
  const taken = others.find((q) => q.layer === 'onTop' && q.parent === parent.id && q.spot === spot);
  return taken ? { reason: 'spot', with: taken.id } : null;
}

export type LayoutFailure =
  | { error: 'wrong_layer'; pieceIds: string[] }
  | { error: 'bad_place'; reason: BadReason; pieceIds: string[] }
  | { error: 'desk_required' }
  | { error: 'room_full'; cap: number };

/** Every rule a saved layout must meet, in the order PUT /me/cosmetics answers them (spec §12). Ids are known. */
export function validateLayout(layout: RoomLayout, tier: Tier, deps: GeometryDeps): LayoutFailure | null {
  const wrong = layout.pieces.filter((p) => {
    const iso = deps.isoOf(p.item);
    return !iso || !layerAllows(iso, p.layer) || (p.facing === 'R' && iso.facings !== 2);
  });
  if (wrong.length) return { error: 'wrong_layer', pieceIds: wrong.map((p) => p.id) };
  for (const p of layout.pieces) {
    const r = checkPiece(layout, p, tier, deps);
    if (r) return { error: 'bad_place', reason: r.reason, pieceIds: r.with ? [p.id, r.with] : [p.id] };
  }
  const desks = layout.pieces.filter((p) => deps.isoOf(p.item)?.kipDesk);
  if (desks.length !== 1 || desks[0]!.layer !== 'floor') return { error: 'desk_required' };
  const cap = capFor(tier);
  return layout.pieces.length > cap ? { error: 'room_full', cap } : null;
}

const PLACEMENT_KEYS: ReadonlySet<string> = new Set(['id', 'item', 'layer', 'x', 'y', 'facing', 'mirror', 'parent', 'spot']);
const LAYERS: ReadonlySet<string> = new Set(['floor', 'wallL', 'wallR', 'onTop']);
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isItemId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

/** A layout's shape (400 invalid_body), or null. Ids are not looked up here. */
export function parseLayout(value: unknown): RoomLayout | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'pieces,styles,v' || v.v !== 1) return null;
  const s = v.styles as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).length !== STYLE_KEYS.length) return null;
  if (!STYLE_KEYS.every((k) => isItemId(s[k]))) return null;
  if (!Array.isArray(v.pieces) || v.pieces.length > MAX_LAYOUT_PIECES) return null;
  const ids = new Set<string>();
  const pieces: Placement[] = [];
  for (const raw of v.pieces as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const p = raw as Record<string, unknown>;
    if (Object.keys(p).some((k) => !PLACEMENT_KEYS.has(k))) return null;
    if (typeof p.id !== 'string' || !INSTANCE_ID.test(p.id) || ids.has(p.id)) return null;
    if (!isItemId(p.item) || typeof p.layer !== 'string' || !LAYERS.has(p.layer)) return null;
    if (!isInt(p.x, -64, 64) || !isInt(p.y, -64, 64) || (p.facing !== 'L' && p.facing !== 'R') || typeof p.mirror !== 'boolean') return null;
    const onTop = p.layer === 'onTop';
    if (onTop) {
      if (typeof p.parent !== 'string' || !INSTANCE_ID.test(p.parent) || !isInt(p.spot, 0, 15) || p.x !== 0 || p.y !== 0) return null;
    } else if (p.parent !== undefined || p.spot !== undefined) return null;
    ids.add(p.id);
    pieces.push({
      id: p.id, item: p.item, layer: p.layer as PlacementLayer, x: p.x, y: p.y, facing: p.facing, mirror: p.mirror,
      ...(onTop ? { parent: p.parent as string, spot: p.spot as number } : {}),
    });
  }
  return { v: 1, styles: { wallpaper: s.wallpaper as string, floor: s.floor as string, window: s.window as string }, pieces };
}
```

- [ ] **Step 4: Conversion in `backend/src/room/convert.ts`**

```ts
// Slot rooms to iso rooms (spec 2026-10-15 §2.4). The input is always Spec B's sanitised room (loadout.ts readRoom),
// never the raw JSON, so every id is owned, shipped and in its slot. Each slot has a fixed place taken from isox.py's
// `standard` room, and a fixed instance id (plan ruling 10).
import { OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_ROOM, cosmeticItem, type RoomSlot } from '../cosmetics/catalogue';
import type { Placement, PlacementLayer, RoomLayout } from './geometry';

export type SlotRoom = Record<RoomSlot, string | null>;
/** The converted art hangs from step 9, so the tallest piece (6 steps) ends under the wall top. */
export const ART_STEP = 9;

const at = (id: string, item: string, layer: PlacementLayer, x: number, y: number, extra: Partial<Placement> = {}): Placement =>
  ({ id, item, layer, x, y, facing: 'L', mirror: false, ...extra });

export function layoutFromSlots(room: SlotRoom): RoomLayout {
  const pieces: Placement[] = [at('desk', room.desk ?? STARTER_ROOM.desk!, 'floor', 2, 0)];
  const onDesk = (id: string, item: string, spot: number) => pieces.push(at(id, item, 'onTop', 0, 0, { parent: 'desk', spot }));
  if (room.lamp) {
    if (cosmeticItem(room.lamp)?.iso?.layers.includes('onTop')) onDesk('lamp', room.lamp, 0);
    else pieces.push(at('lamp', room.lamp, 'wallL', 0, 14)); // the Cottage garland, above the window (ruling 7)
  }
  if (room.desk_item) onDesk('deskitem', room.desk_item, 2);
  if (room.shelf) {
    pieces.push(at('plank', 'shelf.plank', 'wallR', 6, 10));
    pieces.push(at('shelf', room.shelf, 'onTop', 0, 0, { parent: 'plank', spot: 0 }));
  }
  if (room.art) pieces.push(at('art', room.art, 'wallR', 2, ART_STEP));
  if (room.plant) pieces.push(at('plant', room.plant, 'floor', 0, 0));
  if (room.corner) pieces.push(at('corner', room.corner, 'floor', 5, 0));
  if (room.rug) pieces.push(at('rug', room.rug, 'floor', 1, 2));
  if (room.pet) pieces.push(at('pet', room.pet, 'floor', 4, 5));
  return {
    v: 1,
    styles: { wallpaper: room.wallpaper ?? STARTER_ROOM.wallpaper!, floor: room.floor ?? STARTER_ROOM.floor!, window: room.window ?? STARTER_ROOM.window! },
    pieces,
  };
}

/** A new user's room (spec §11.1): Spec B's starter room without the wall calendar, which waits in the inventory. */
export function starterLayout(): RoomLayout {
  return layoutFromSlots({ ...STARTER_ROOM, art: null });
}

/** The slot room GET still returns until P2 drops `room` (spec §2.4), for dev builds on Spec B. */
export function slotsFromLayout(layout: RoomLayout): SlotRoom {
  const room = {} as SlotRoom;
  for (const slot of ROOM_SLOTS) {
    if (slot === 'wallpaper' || slot === 'floor' || slot === 'window') { room[slot] = layout.styles[slot]; continue; }
    const first = layout.pieces
      .filter((p) => p.item !== 'shelf.plank' && cosmeticItem(p.item)?.slot === slot)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    room[slot] = first?.item ?? (OPTIONAL_ROOM_SLOTS.has(slot) ? null : STARTER_ROOM[slot]);
  }
  return room;
}
```

- [ ] **Step 5: The export writes the starter layout, set layouts and the rules copy**

In `backend/src/cosmetics/export.ts`:

```ts
import fs from 'fs';
import { layoutFromSlots, starterLayout } from '../room/convert';
import type { RoomLayout } from '../room/geometry';

export interface CatalogueExport {
  version: number;
  releases: number[];
  starterRoom: Record<RoomSlot, string | null>;
  starterLayout: RoomLayout;
  items: CosmeticItem[];
  sets: Array<CosmeticSet & { layout: RoomLayout }>;
}

export const MOBILE_GEOMETRY_PATH = path.join(__dirname, '../../../mobile/src/lib/room/iso/geometry.ts');
const GEOMETRY_PATH = path.join(__dirname, '../room/geometry.ts');
const GEOMETRY_BANNER = '// GENERATED from backend/src/room/geometry.ts by backend/scripts/export-cosmetics.ts. Do not edit.\n';

/** The app's copy of the placement rules: the banner, then the backend file verbatim. */
export function geometryCopy(): string {
  return GEOMETRY_BANNER + fs.readFileSync(GEOMETRY_PATH, 'utf8');
}
```

and in `exportCatalogue` add `starterLayout: starterLayout(),` and map `sets` to
`sets.map((s) => ({ ...s, layout: layoutFromSlots(s.room) }))`.

`backend/scripts/export-cosmetics.ts`:

```ts
import fs from 'fs';
import { MOBILE_CATALOGUE_PATH, MOBILE_GEOMETRY_PATH, exportCatalogue, geometryCopy, serialiseExport } from '../src/cosmetics/export';

if (require.main === module) {
  fs.writeFileSync(MOBILE_CATALOGUE_PATH, serialiseExport(exportCatalogue()));
  fs.mkdirSync(require('path').dirname(MOBILE_GEOMETRY_PATH), { recursive: true });
  fs.writeFileSync(MOBILE_GEOMETRY_PATH, geometryCopy());
  console.log(`wrote ${exportCatalogue().items.length} items and the placement rules to the app`);
}
```

Run it from `backend/`: `node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/export-cosmetics.ts`.
Expected: `wrote 89 items and the placement rules to the app`.

- [ ] **Step 6: The app's catalogue reads the new fields (`mobile/src/lib/room/catalogue.ts`)**

```ts
import { type GeometryDeps, type IsoSpec, type RoomLayout } from './iso/geometry';

export interface CatalogueItem {
  // …Spec B's fields, unchanged…
  iso?: IsoSpec;
  tags?: string[];
  grants?: number;
}

export interface CatalogueSet {
  // …Spec B's fields, unchanged…
  /** The set's own iso layout (spec §5.5): what Apply set places. */
  layout: RoomLayout;
}

export const CATALOGUE = data as unknown as {
  version: number;
  releases: number[];
  starterRoom: RoomLoadout;
  starterLayout: RoomLayout;
  items: CatalogueItem[];
  sets: CatalogueSet[];
};

/** A placeable item's iso block; undefined for styles, worn items and ids this build does not know. */
export function isoOf(id: ItemId | null | undefined): IsoSpec | undefined {
  return catalogueItem(id)?.iso;
}
/** The app's side of the placement rules: the same file as the server's (spec §12). */
export const GEOMETRY_DEPS: GeometryDeps = { isoOf: (id) => isoOf(id) };
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room tests/cosmetics`
Expected: PASS. From `mobile/`: `node node_modules/.bin/jest --forceExit __tests__/lib/isoCatalogue.test.ts __tests__/lib/roomCatalogue.test.ts`
Expected: PASS.

- [ ] **Step 8: Full suites, typechecks, commit**

Full backend suite, backend tsc (0), full mobile suite, mobile tsc (10; the generated `geometry.ts` must add none).

```bash
git add backend/src/room backend/src/cosmetics/export.ts backend/scripts/export-cosmetics.ts backend/tests/room backend/tests/cosmetics/export.test.ts mobile/src/lib/room/iso/geometry.ts mobile/src/lib/room/catalogue.json mobile/src/lib/room/catalogue.ts mobile/__tests__/lib/isoCatalogue.test.ts
git commit -m "feat(backend): free-build placement rules shared with the app, slot to iso conversion, and the starter and set layouts"
```

---

### Task 3: Backend: storing the layout, the lazy conversion on GET, counts, and the conversion script

Spec §2.2 (counts, the read-time backstop), §2.3 (the layout on `CosmeticLoadout`, `tier`), §2.4 (migration, lazy
GET conversion with `Prisma.DbNull`, the script, the derived `room`), §11.1 (`RoomFirstWeek`), §12 (GET body,
deletion) and §16's conversion and count tests. Rulings 13 and 23.

**Files:**
- Modify: `backend/prisma/schema.prisma`; create `backend/prisma/migrations/20261016120000_freebuild/migration.sql`
- Create: `backend/src/room/layout.ts`, `backend/scripts/convert-room-layouts.ts`
- Modify: `backend/src/cosmetics/loadout.ts`, `backend/src/users/deletion.ts`, `backend/tests/users/ownedData.ts`
- Test: create `backend/tests/room/read.test.ts`, `backend/tests/room/script.test.ts`; modify
  `backend/tests/cosmetics/routes.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2 (`shippedItem`, `STARTER_IDS`, `parseLayout`, `capFor`, `Tier`, `layoutFromSlots`,
  `starterLayout`, `slotsFromLayout`, `STYLE_KEYS`).
- Produces:
  - `backend/src/room/layout.ts`: `geometryDeps: GeometryDeps`, `countsOf(rows): Record<string, number>`,
    `placedCounts(layout): Record<string, number>`, `readLayout(json, counts): RoomLayout | null`,
    `toTier(n: unknown): Tier`;
  - `backend/src/cosmetics/loadout.ts`: `readRoom` (now exported), `ownedFrom` (exported),
    `convertLoadout(row: { userId: string; room: unknown; version: number }): Promise<boolean>`, and
    `CosmeticsDTO` = Spec B's fields plus `layout: RoomLayout`, `tier: Tier`, `cap: number`,
    `counts: Record<string, number>`, `welcomed: boolean` (`room` is now derived with `slotsFromLayout`);
  - `scripts/convert-room-layouts.ts`: `convertRoomLayouts(batch?: number): Promise<{ converted: number; skipped: number }>`;
  - Prisma: `CosmeticLoadout.layout Json?`, `CosmeticLoadout.tier Int @default(1)`, model `RoomFirstWeek`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/room/read.test.ts`:

```ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_IDS, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { convertLoadout } from '../../src/cosmetics/loadout';
import { layoutFromSlots, slotsFromLayout, starterLayout } from '../../src/room/convert';
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
/** A Spec B row: a slot room, no layout yet. */
const specBRow = (userId: string, room: Record<string, string | null>, version = 3) =>
  prisma.cosmeticLoadout.create({ data: { userId, room: { ...STARTER_ROOM, ...room }, worn: { ...EMPTY_WORN }, version } });

describe('GET /me/cosmetics (free-build)', () => {
  it('a new user: the starter layout, tier 1, a cap of 40, a count for each of the 19 starters, not welcomed', async () => {
    const { headers } = await me();
    const body = await get(headers);
    expect([body.layout, body.tier, body.cap, body.version, body.welcomed]).toEqual([starterLayout(), 1, 40, 0, false]);
    expect(Object.keys(body.counts).sort()).toEqual([...STARTER_IDS].sort());
    expect(Object.values(body.counts).every((n) => n === 1)).toBe(true);
    expect(body.room).toEqual(slotsFromLayout(starterLayout()));
  });

  it('counts an unlocked item once per unlock row (grants defaults to 1)', async () => {
    const { user, headers } = await me();
    await level(user.id, 'SLEEP_GOAL', 1, new Date(Date.now() - 1000));
    expect((await get(headers)).counts['rug.red']).toBe(1);
  });

  it('converts a Spec B room once, from the sanitised room, without bumping the version (spec §2.4)', async () => {
    const { user, headers } = await me();
    await specBRow(user.id, { rug: 'rug.red', corner: 'corner.bag' }); // neither is owned
    const first = await get(headers);
    expect(first.layout).toEqual(layoutFromSlots({ ...STARTER_ROOM, rug: 'rug.slate', corner: null }));
    expect(first.version).toBe(3);
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect([row!.layout, row!.version]).toEqual([first.layout, 3]);
    expect((await get(headers)).layout).toEqual(first.layout);
  });

  it('two GETs racing the conversion both answer the same layout; the conditional write lands once', async () => {
    const { user, headers } = await me();
    await specBRow(user.id, { desk: 'desk.notebook' });
    const [a, b] = await Promise.all([get(headers), get(headers)]);
    expect(a.layout).toEqual(b.layout);
    expect(a.layout.pieces.find((p: { id: string }) => p.id === 'desk').item).toBe('desk.notebook');
  });

  it('the conditional write never overwrites: a stale version writes nothing', async () => {
    const { user } = await me();
    await specBRow(user.id, {}, 2);
    expect(await convertLoadout({ userId: user.id, room: STARTER_ROOM, version: 5 })).toBe(false);
    const row = await prisma.cosmeticLoadout.findFirst({ where: { userId: user.id, layout: { equals: Prisma.DbNull } } });
    expect(row).not.toBeNull();
  });

  it('drops placements over the owned count at read, highest id first, children too, and keeps the stored row (spec §2.2)', async () => {
    const { user, headers } = await me();
    const stored = { ...starterLayout(), pieces: [...starterLayout().pieces, piece('pz', 'shelf.plank', { layer: 'wallR', x: 0, y: 2 }), piece('st', 'item.sticky', { layer: 'onTop', parent: 'pz', spot: 1 })] };
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: STARTER_ROOM, worn: EMPTY_WORN, layout: stored as unknown as Prisma.InputJsonValue, version: 4 } });
    expect((await get(headers)).layout).toEqual(starterLayout());
    const row = await prisma.cosmeticLoadout.findUnique({ where: { userId: user.id } });
    expect(row!.layout).toEqual(stored);
  });

  it('drops unshipped placements and reads an unowned style as the starter style (ruling 23)', async () => {
    const { user, headers } = await me();
    const stored = { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' }, pieces: [...starterLayout().pieces, piece('x1', 'desk.dual', { x: 2, y: 4 })] };
    await prisma.cosmeticLoadout.create({ data: { userId: user.id, room: STARTER_ROOM, worn: EMPTY_WORN, layout: stored as unknown as Prisma.InputJsonValue, version: 1 } });
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

`backend/tests/room/script.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { convertRoomLayouts } from '../../scripts/convert-room-layouts';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});

it('converts every Spec B row once, gives the same layout the lazy GET would, and is idempotent (spec §2.4)', async () => {
  const quiet = jest.spyOn(console, 'info').mockImplementation(() => {});
  const a = await buddyUser();
  const b = await buddyUser();
  for (const u of [a, b]) {
    await prisma.cosmeticLoadout.create({ data: { userId: u.id, room: { ...STARTER_ROOM, plant: 'plant.cactus' }, worn: { ...EMPTY_WORN }, version: 2 } });
  }
  const first = await convertRoomLayouts(1);
  expect(first.converted).toBeGreaterThanOrEqual(2);
  expect((await convertRoomLayouts()).converted).toBe(0);
  const gotA = (await (await api()).get('/me/cosmetics').set(await authHeaderFor(a.id))).body;
  const rowA = await prisma.cosmeticLoadout.findUnique({ where: { userId: a.id } });
  expect(gotA.layout).toEqual(rowA!.layout);
  expect(gotA.layout.pieces.find((p: { id: string }) => p.id === 'plant').item).toBe('plant.cactus');
  expect(rowA!.version).toBe(2);
  quiet.mockRestore();
});
```

In `backend/tests/cosmetics/routes.test.ts` the first GET test's `toEqual` becomes:

```ts
    expect(res.body).toEqual({
      catalogueVersion: 1, owned: expect.any(Array), fresh: [], room: slotsFromLayout(starterLayout()), worn: { ...EMPTY_WORN }, version: 0,
      counters: { recapsRead: 0, buddyCheers: 0 }, layout: starterLayout(), tier: 1, cap: 40, counts: expect.any(Object), welcomed: false,
    });
```

(import `slotsFromLayout`, `starterLayout` from `../../src/room/convert`). Its third test ("reads a stored slot naming
an item the user no longer owns as the starter piece") stays: the row is converted from the sanitised room, so
`room.rug` reads `'rug.slate'` and `room.corner` `null`. The PUT tests stay as they are until Task 4: the slot save
still works through this task (Step 5), and its answer's `room` is the derived one, equal to what was saved.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room/read.test.ts tests/room/script.test.ts tests/cosmetics/routes.test.ts`
Expected: FAIL (no `layout` column, no `RoomFirstWeek`, no script).

- [ ] **Step 3: Schema and migration**

In `backend/prisma/schema.prisma`, `model CosmeticLoadout` gains (under `worn`):

```prisma
  /// RoomLayout (spec 2026-10-15 §2.3); null = a Spec B row not converted yet (§2.4). `room` is read-only from P1
  /// and dropped in P2.
  layout    Json?
  /// 1 starter 7×7, 2 bigger 8×8, 3 loft 9×9; written only by the expand route (P2).
  tier      Int      @default(1)
```

`model User` gains `roomFirstWeek RoomFirstWeek?` beside `cosmeticLoadout`, and add:

```prisma
/// The first week (spec 2026-10-15 §11). Never on CosmeticLoadout: a loadout row made for a flag would turn the
/// user's first save (the version-0 create) into a false 409.
model RoomFirstWeek {
  userId        String    @id
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  welcomedAt    DateTime?
  /// Set once by PUT /me/cosmetics when a layout first holds an instance id the stored one did not.
  firstPlacedAt DateTime?
  /// The first-week list's day 1 (P2).
  startedOn     DateTime? @db.Date
}
```

`backend/prisma/migrations/20261016120000_freebuild/migration.sql`:

```sql
-- KIP's free-build room (spec 2026-10-15 §2.3, §2.4, §11.1): the iso layout and the room size on the loadout row,
-- and the first-week row. `room` stays, read-only, until P2.
ALTER TABLE "CosmeticLoadout" ADD COLUMN "layout" JSONB,
ADD COLUMN "tier" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "RoomFirstWeek" (
    "userId" TEXT NOT NULL,
    "welcomedAt" TIMESTAMP(3),
    "firstPlacedAt" TIMESTAMP(3),
    "startedOn" DATE,

    CONSTRAINT "RoomFirstWeek_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "RoomFirstWeek" ADD CONSTRAINT "RoomFirstWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Then `cd backend && DATABASE_URL=postgresql://x@localhost/x npx prisma generate` and
`bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/schema-drift.sh` after the first test run has migrated the test DB.
Expected: `no drift`.

- [ ] **Step 4: Counts and the read-time backstop in `backend/src/room/layout.ts`**

```ts
// Reading a stored layout (spec 2026-10-15 §2.2): what you own is a count; a stored layout that places more copies
// than you own (or an item this server does not ship) is trimmed at read, never rewritten until the next save.
import { STARTER_IDS, shippedItem } from '../cosmetics/catalogue';
import { starterLayout } from './convert';
import { STYLE_KEYS, parseLayout, type GeometryDeps, type Placement, type RoomLayout, type Tier } from './geometry';

export const geometryDeps: GeometryDeps = { isoOf: (id) => shippedItem(id)?.iso };

/** owned(item) = starter 1 + an unlock row's `grants ?? 1` (P2 adds ItemGrant sums). Shipped items only. */
export function countsOf(rows: ReadonlyArray<{ itemId: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of STARTER_IDS) counts[id] = 1;
  for (const { itemId } of rows) {
    const item = shippedItem(itemId);
    if (item && item.unlock.kind !== 'starter') counts[itemId] = (counts[itemId] ?? 0) + (item.grants ?? 1);
  }
  return counts;
}

export function placedCounts(layout: RoomLayout): Record<string, number> {
  const placed: Record<string, number> = {};
  for (const p of layout.pieces) placed[p.item] = (placed[p.item] ?? 0) + 1;
  return placed;
}

export function toTier(n: unknown): Tier {
  return n === 2 || n === 3 ? n : 1;
}

/** Drops pieces whose parent is gone, until none is left (one level of stacking, so one pass is enough). */
const withParents = (pieces: Placement[]): Placement[] => {
  const ids = new Set(pieces.map((p) => p.id));
  return pieces.filter((p) => p.layer !== 'onTop' || ids.has(p.parent!));
};

/** A stored layout as the user may see it, or null when the JSON is not a layout (the caller uses the starter). */
export function readLayout(json: unknown, counts: Readonly<Record<string, number>>): RoomLayout | null {
  const parsed = parseLayout(json);
  if (!parsed) return null;
  const starter = starterLayout();
  const styles = { ...parsed.styles };
  for (const k of STYLE_KEYS) {
    const item = shippedItem(styles[k]);
    if (!item || item.slot !== k || !((counts[styles[k]] ?? 0) > 0)) styles[k] = starter.styles[k];
  }
  const known = withParents(parsed.pieces.filter((p) => !!shippedItem(p.item)?.iso));
  const drop = new Set<string>();
  const byItem = new Map<string, Placement[]>();
  for (const p of known) byItem.set(p.item, [...(byItem.get(p.item) ?? []), p]);
  for (const [item, list] of byItem) {
    const extra = list.length - (counts[item] ?? 0);
    if (extra > 0) [...list].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, extra).forEach((p) => drop.add(p.id));
  }
  return { v: 1, styles, pieces: withParents(known.filter((p) => !drop.has(p.id))) };
}
```

- [ ] **Step 5: GET reads the layout (`backend/src/cosmetics/loadout.ts`)**

Export `ownedFrom` and `readRoom` (add `export`). Extend the DTO and the read:

```ts
import { layoutFromSlots, slotsFromLayout, starterLayout } from '../room/convert';
import { capFor, type RoomLayout, type Tier } from '../room/geometry';
import { countsOf, readLayout, toTier } from '../room/layout';

export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  /** Derived from the layout for dev builds on Spec B (spec §2.4); dropped in P2. */
  room: Room;
  layout: RoomLayout;
  tier: Tier;
  cap: number;
  /** owned(item) for every item with a count (spec §2.2). */
  counts: Record<string, number>;
  worn: Worn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  /** The welcome card has been answered on some device (spec §11.1, plan ruling 13). */
  welcomed: boolean;
}

/**
 * Converts one Spec B row (layout null) to an iso layout with the conditional write the GET and the script share
 * (spec §2.4): only while the row is still unconverted at the version read, and never bumping it. True when this call
 * wrote it; false means the script, another GET or a save got there first.
 */
export async function convertLoadout(row: { userId: string; room: unknown; version: number }): Promise<boolean> {
  const rows = await prisma.cosmeticUnlock.findMany({ where: { userId: row.userId }, select: { itemId: true } });
  const layout = layoutFromSlots(readRoom(row.room, ownedFrom(rows)));
  const { count } = await prisma.cosmeticLoadout.updateMany({
    where: { userId: row.userId, layout: { equals: Prisma.DbNull }, version: row.version },
    data: { layout: layout as unknown as Prisma.InputJsonValue },
  });
  return count === 1;
}

export async function readCosmetics(userId: string, now: Date, opts: { grant?: boolean } = {}): Promise<CosmeticsDTO> {
  if (opts.grant ?? true) await grantCosmeticsSafely(userId, now);
  const [rows, first, facts, firstWeek] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: [{ unlockedAt: 'asc' }, { itemId: 'asc' }], select: { itemId: true, source: true, seenAt: true } }),
    prisma.cosmeticLoadout.findUnique({ where: { userId } }),
    loadUnlockFacts(userId),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { welcomedAt: true } }),
  ]);
  let loadout = first;
  if (loadout && loadout.layout === null) {
    // Lazily, once (spec §2.4). Whoever wrote it, the row now holds a layout: read it back.
    await convertLoadout(loadout);
    loadout = await prisma.cosmeticLoadout.findUnique({ where: { userId } });
  }
  const owned = ownedFrom(rows);
  const counts = countsOf(rows);
  const layout = (loadout?.layout != null ? readLayout(loadout.layout, counts) : null) ?? starterLayout();
  const tier = toTier(loadout?.tier);
  return {
    catalogueVersion: COSMETICS_CATALOGUE_VERSION,
    owned: [...owned].sort(),
    fresh: rows.filter((r) => r.seenAt === null && owned.has(r.itemId)).map((r) => ({ itemId: r.itemId, source: r.source })),
    room: slotsFromLayout(layout),
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

`saveCosmetics` keeps Spec B's slot body until Task 4 replaces it. So that a slot save is not hidden behind an older
layout, its `create` and `updateMany` data gain `layout: Prisma.DbNull` (comment: "until Task 4: the next read converts
the saved slots"); the read that answers the save then converts the new room.

- [ ] **Step 6: The script `backend/scripts/convert-room-layouts.ts`**

```ts
/// <reference types="node" />
// Converts every Spec B slot room to an iso layout once (spec 2026-10-15 §2.4), with the same conditional write as
// the lazy GET, so the two can run in either order and a second run converts nothing. P2's deploy runs it before
// `prisma migrate deploy`. Logs counts only, never a user id or a layout.
//   node node_modules/.bin/ts-node --project tsconfig.evals.json scripts/convert-room-layouts.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db/client';
import { convertLoadout } from '../src/cosmetics/loadout';

export async function convertRoomLayouts(batch = 200): Promise<{ converted: number; skipped: number }> {
  let converted = 0;
  let skipped = 0;
  let after = '';
  for (;;) {
    const rows = await prisma.cosmeticLoadout.findMany({
      where: { layout: { equals: Prisma.DbNull }, userId: { gt: after } },
      orderBy: { userId: 'asc' },
      take: batch,
      select: { userId: true, room: true, version: true },
    });
    if (!rows.length) break;
    for (const row of rows) (await convertLoadout(row)) ? converted++ : skipped++;
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

- [ ] **Step 7: Account deletion**

`backend/src/users/deletion.ts`: add `'RoomFirstWeek',` after `'CosmeticLoadout',` in `USER_OWNED_MODELS`.
`backend/tests/users/ownedData.ts`: after the `cosmeticLoadout.create` line add
`await prisma.roomFirstWeek.create({ data: { userId, welcomedAt: day } });`. In
`backend/tests/cosmetics/neverRemoved.test.ts` the second test adds `'RoomFirstWeek'` to its `arrayContaining` list.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room tests/cosmetics tests/users`
Expected: PASS.

- [ ] **Step 9: Full backend suite, typecheck, commit**

Full backend suite (green), `schema-drift.sh` (`no drift`), backend tsc (0). The mobile suite is untouched.

```bash
git add backend/prisma backend/src/room/layout.ts backend/src/cosmetics/loadout.ts backend/scripts/convert-room-layouts.ts backend/src/users/deletion.ts backend/tests
git commit -m "feat(backend): store the iso layout and room size, convert Spec B rooms lazily on read and by script, and count owned copies"
```

---

### Task 4: Backend: `PUT /me/cosmetics` saves a layout under the room lock, the first placement, and `POST /me/room/welcomed`

Spec §2.2 (the shared per-user advisory lock), §2.4 (slot bodies answer `update_app`), §11.1 (`firstPlacedAt`,
`welcomedAt`), §12 (every P1 error code, the version bound, the 32 KB cap, concurrency, telemetry, nothing cosmetic
reaches the model) and §16's PUT tests. Rulings 12 and 14; Spec B Task 5 ledger items (version bound, extra worn key,
negative version).

**Files:**
- Create: `backend/src/room/lock.ts`, `backend/tests/room/save.test.ts`, `backend/tests/room/noCoachImport.test.ts`
- Modify: `backend/src/cosmetics/loadout.ts`, `backend/src/cosmetics/routes.ts`,
  `backend/tests/cosmetics/routes.test.ts` (its PUT block moves to `tests/room/save.test.ts`)

**Interfaces:**
- Consumes: Task 2's `parseLayout`, `validateLayout`, `BadReason`, `starterLayout`, `slotsFromLayout`; Task 3's
  `countsOf`, `placedCounts`, `geometryDeps`, `toTier`, `readCosmetics`.
- Produces:
  - `ROOM_LOCK_NAMESPACE`, `lockRoom(tx: Prisma.TransactionClient, userId: string): Promise<void>` (P2's gift-send
    and expansion take the same lock);
  - `type SaveError`, `SaveFailure { status: 400 | 403 | 409; body: { error: SaveError; itemIds?; pieceIds?; reason? } }`;
  - `validateBody(body): { layout: RoomLayout; worn: Worn; version: number } | SaveFailure`;
  - `checkLayout(layout, worn, tier, counts): SaveFailure | null`;
  - `saveCosmetics(userId, body, now, rawBytes?: number)`; `markWelcomed(userId, now): Promise<void>`;
  - `MAX_VERSION = 2 ** 31 - 1`, `MAX_BODY_BYTES = 32 * 1024`;
  - routes: `PUT /me/cosmetics` with `{ layout, worn, version }`, `POST /me/room/welcomed` → 204;
  - log line `room.saved { pieces, tier }` (no user id).

- [ ] **Step 1: Write the failing tests**

Delete the `describe('PUT /me/cosmetics', …)` block from `backend/tests/cosmetics/routes.test.ts` (keep its `room` and
`worn` helpers: the GET tests use them). Create `backend/tests/room/save.test.ts`:

```ts
import { prisma } from '../../src/db/client';
import { connection } from '../../src/sync/queue';
import { migrateTestDb } from '../setupTestDb';
import { authHeaderFor } from '../helpers/auth';
import { api, buddyUser } from '../buddies/helpers';
import { EMPTY_WORN, STARTER_ROOM } from '../../src/cosmetics/catalogue';
import { starterLayout } from '../../src/room/convert';
import { lockRoom } from '../../src/room/lock';
import type { RoomLayout } from '../../src/room/geometry';
import { piece, withPieces } from './helpers';

beforeAll(() => migrateTestDb());
afterAll(async () => {
  await prisma.$disconnect();
  await connection.quit();
});
let info: jest.SpyInstance;
beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => info.mockRestore());

async function me() {
  const user = await buddyUser();
  return { user, headers: await authHeaderFor(user.id) };
}
const put = async (headers: Record<string, string>, body: unknown) => (await api()).put('/me/cosmetics').set(headers).send(body as object);
const body = (layout: RoomLayout = starterLayout(), version = 0, worn: Record<string, string | null> = { ...EMPTY_WORN }) => ({ layout, worn, version });
const fern = (id: string, x: number, y: number) => piece(id, 'plant.fern', { x, y });

describe('PUT /me/cosmetics (free-build §12)', () => {
  it('saves a layout of owned pieces, answers the GET body, and logs counts only', async () => {
    const { user, headers } = await me();
    const layout = withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 }));
    const res = await put(headers, body(layout, 0, { ...EMPTY_WORN, head: 'out.beanie' }));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect([res.body.layout, res.body.worn.head, res.body.version, res.body.room.plant]).toEqual([layout, 'out.beanie', 1, 'plant.cactus']); // the lowest id wins the derived slot
    const lines = info.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('room.saved'));
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ event: 'room.saved', pieces: 8, tier: 1 }]);
    expect(lines.join('')).not.toContain(user.id);
  });

  it('400 update_app for a Spec B slot body (spec §2.4)', async () => {
    const { headers } = await me();
    const res = await put(headers, { room: { ...STARTER_ROOM }, worn: { ...EMPTY_WORN }, version: 0 });
    expect([res.status, res.body]).toEqual([400, { error: 'update_app' }]);
  });

  it.each([
    ['no body', () => undefined],
    ['a missing layout', () => ({ worn: { ...EMPTY_WORN }, version: 0 })],
    ['an extra key', () => ({ ...body(), tier: 3 })],
    ['a bad layout shape', () => ({ ...body(), layout: { v: 1, styles: {}, pieces: [] } })],
    ['a duplicate instance id', () => body({ ...starterLayout(), pieces: [...starterLayout().pieces, fern('desk', 6, 6)] })],
    ['a missing worn key', () => ({ ...body(), worn: { head: null, face: null, neck: null } })],
    ['an extra worn key', () => ({ ...body(), worn: { ...EMPTY_WORN, tail: null } })],
    ['a non-integer version', () => body(starterLayout(), 1.5)],
    ['a negative version', () => body(starterLayout(), -1)],
    ['a version past 2^31 - 1', () => body(starterLayout(), 2 ** 31)],
    ['a body over 32 KB', () => ({ ...body(), pad: 'x'.repeat(40 * 1024) })],
  ])('400 invalid_body for %s', async (_label, make) => {
    const { headers } = await me();
    const res = await put(headers, make());
    expect([res.status, res.body]).toEqual([400, { error: 'invalid_body' }]);
  });

  it('400 unknown_item for a piece or style that is not shipped', async () => {
    const { headers } = await me();
    for (const layout of [withPieces(piece('p1', 'plant.nope', { x: 6, y: 6 })), { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.shoji' } }]) {
      const res = await put(headers, body(layout));
      expect([res.status, res.body]).toEqual([400, { error: 'unknown_item' }]);
    }
  });

  it('400 wrong_layer for a layer the item does not allow, or a style under the wrong key', async () => {
    const { headers } = await me();
    for (const layout of [withPieces(piece('p1', 'item.mug', { x: 6, y: 6 })), { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'floor.oakDark' } }]) {
      const res = await put(headers, body(layout));
      expect([res.status, res.body]).toEqual([400, { error: 'wrong_layer' }]);
    }
  });

  it('400 bad_place with the pieces and the reason', async () => {
    const { headers } = await me();
    const res = await put(headers, body(withPieces(piece('p1', 'plant.cactus', { x: 3, y: 2 }))));
    expect([res.status, res.body]).toEqual([400, { error: 'bad_place', reason: 'seat', pieceIds: ['desk', 'p1'] }]); // the desk is checked first
  });

  it('400 desk_required without exactly one desk', async () => {
    const { headers } = await me();
    const noDesk = { ...starterLayout(), pieces: starterLayout().pieces.filter((p) => p.id !== 'desk' && p.parent !== 'desk') };
    expect((await put(headers, body(noDesk))).body).toEqual({ error: 'desk_required' });
  });

  it('400 room_full past the cap, before ownership is checked', async () => {
    const { headers } = await me();
    const tiles: Array<[number, number]> = [];
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) if (!(x >= 2 && x < 5 && y < 2) && !(x === 3 && y === 2)) tiles.push([x, y]);
    const layout: RoomLayout = { ...starterLayout(), pieces: [piece('desk', 'desk.monitor', { x: 2 }), ...tiles.slice(0, 40).map(([x, y], k) => fern(`f${k}`, x, y))] };
    expect((await put(headers, body(layout))).body).toEqual({ error: 'room_full' });
  });

  it('403 not_owned when more copies are placed than owned, or a style or worn piece is not owned', async () => {
    const { headers } = await me();
    const two = withPieces(fern('p1', 6, 6));
    expect((await put(headers, body(two))).body).toEqual({ error: 'not_owned', itemIds: ['plant.fern'] });
    const res = await put(headers, body({ ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.brick' } }, 0, { ...EMPTY_WORN, head: 'out.cap' }));
    expect([res.status, res.body]).toEqual([403, { error: 'not_owned', itemIds: ['out.cap', 'wall.brick'] }]);
  });

  it('409 stale for an old version; two concurrent first saves give one 200 and one 409; the next version saves', async () => {
    const { headers } = await me();
    const [a, b] = await Promise.all([put(headers, body()), put(headers, body())]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await put(headers, body())).body).toEqual({ error: 'stale' });
    const next = await put(headers, body(starterLayout(), 1));
    expect([next.status, next.body.version]).toEqual([200, 2]);
  });

  it('a welcomed user\'s first save still creates the row at version 1 (spec §11.1)', async () => {
    const { headers } = await me();
    expect((await (await api()).post('/me/room/welcomed').set(headers)).status).toBe(204);
    const res = await put(headers, body());
    expect([res.status, res.body.version, res.body.welcomed]).toEqual([200, 1, true]);
  });

  it('sets firstPlacedAt once, on the first save holding an instance id the stored layout did not have', async () => {
    const { user, headers } = await me();
    await put(headers, body());
    const firstWeek = () => prisma.roomFirstWeek.findUnique({ where: { userId: user.id } });
    expect((await firstWeek())?.firstPlacedAt ?? null).toBeNull();
    await put(headers, body(withPieces(piece('p1', 'plant.cactus', { x: 6, y: 6 })), 1));
    const placedAt = (await firstWeek())!.firstPlacedAt;
    expect(placedAt).toBeInstanceOf(Date);
    await put(headers, body(withPieces(piece('p2', 'plant.cactus', { x: 6, y: 6 })), 2));
    expect((await firstWeek())!.firstPlacedAt).toEqual(placedAt);
  });

  it('needs a session', async () => {
    expect((await (await api()).put('/me/cosmetics').send({})).status).toBe(401);
  });
});

describe('the room lock (spec §2.2, §12 Concurrency)', () => {
  it('serialises room writes for one user', async () => {
    const user = await buddyUser();
    const order: string[] = [];
    const a = prisma.$transaction(async (tx) => {
      await lockRoom(tx, user.id);
      order.push('a in');
      await new Promise((r) => setTimeout(r, 300));
      order.push('a out');
    });
    await new Promise((r) => setTimeout(r, 50));
    const b = prisma.$transaction(async (tx) => {
      await lockRoom(tx, user.id);
      order.push('b in');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a in', 'a out', 'b in']);
  });
});

describe('POST /me/room/welcomed', () => {
  it('answers 204, is idempotent, keeps the first time, and needs a session', async () => {
    const { user, headers } = await me();
    expect((await (await api()).post('/me/room/welcomed').set(headers)).status).toBe(204);
    const at = (await prisma.roomFirstWeek.findUnique({ where: { userId: user.id } }))!.welcomedAt;
    await Promise.all([(await api()).post('/me/room/welcomed').set(headers), (await api()).post('/me/room/welcomed').set(headers)]);
    expect((await prisma.roomFirstWeek.findUnique({ where: { userId: user.id } }))!.welcomedAt).toEqual(at);
    expect((await (await api()).post('/me/room/welcomed')).status).toBe(401);
  });
});
```

`backend/tests/room/noCoachImport.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

// Spec 2026-10-15 §12: nothing cosmetic reaches the model. The coach never imports the room, cosmetics, coins or
// challenge modules, directly or by a relative path.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.ts$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

it('no file under src/coach imports cosmetics/, room/, coins/ or challenges/', () => {
  const root = path.join(__dirname, '../../src/coach');
  const IMPORT = /(?:from|require\()\s*['"][^'"]*\/(?:cosmetics|room|coins|challenges)(?:\/[^'"]*)?['"]/;
  const hits = files(root).filter((f) => IMPORT.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  expect(hits).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room/save.test.ts tests/room/noCoachImport.test.ts`
Expected: FAIL (slot validation answers the layout bodies; no `lock.ts`; no welcomed route). The coach guard passes
already (a regression pin, Spec B ruling P33).

- [ ] **Step 3: The lock, `backend/src/room/lock.ts`**

```ts
// One advisory lock for every write to a user's room (spec 2026-10-15 §2.2, §12): room and worn saves now; P2's
// expansion and P4's gift-send take the same lock, so a save, a gift and a grow can never interleave. Transaction
// scoped: it is released when the transaction ends. A namespace of its own, so it never collides with the coach
// consent lock or the sleep repository's.
import type { Prisma } from '@prisma/client';

export const ROOM_LOCK_NAMESPACE = 0x526f6f6d; // 'Room'

export async function lockRoom(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ROOM_LOCK_NAMESPACE}::int4, hashtext(${userId}))`;
}
```

- [ ] **Step 4: The save in `backend/src/cosmetics/loadout.ts`**

Replace Spec B's `SaveFailure`, `validateBody`, `checkPieces` and `saveCosmetics` (keep `exactSlots`, `readWorn`,
`markSeen`):

```ts
import { STYLE_KEYS, parseLayout, validateLayout, type BadReason } from '../room/geometry';
import { geometryDeps, placedCounts } from '../room/layout';
import { lockRoom } from '../room/lock';

export type SaveError =
  | 'invalid_body' | 'update_app' | 'unknown_item' | 'wrong_layer' | 'bad_place' | 'desk_required' | 'room_full' | 'not_owned' | 'stale';
export interface SaveFailure {
  status: 400 | 403 | 409;
  body: { error: SaveError; itemIds?: string[]; pieceIds?: string[]; reason?: BadReason };
}
/** Postgres INTEGER (Spec B Task 5 minor: 1e12 overflowed into a 500). */
export const MAX_VERSION = 2 ** 31 - 1;
export const MAX_BODY_BYTES = 32 * 1024;

const INVALID: SaveFailure = { status: 400, body: { error: 'invalid_body' } };
const STALE: SaveFailure = { status: 409, body: { error: 'stale' } };

export function validateBody(body: unknown): { layout: RoomLayout; worn: Worn; version: number } | SaveFailure {
  const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  // A Spec B dev build (spec §2.4): its slot body can't be saved any more.
  if ('room' in b && !('layout' in b)) return { status: 400, body: { error: 'update_app' } };
  if (Object.keys(b).sort().join(',') !== 'layout,version,worn') return INVALID;
  const layout = parseLayout(b.layout);
  if (!layout || !exactSlots(b.worn, WORN_SLOTS)) return INVALID;
  if (typeof b.version !== 'number' || !Number.isInteger(b.version) || b.version < 0 || b.version > MAX_VERSION) return INVALID;
  return { layout, worn: b.worn as Worn, version: b.version };
}

/** Every catalogue, geometry and ownership rule, in the order of spec §12. */
export function checkLayout(layout: RoomLayout, worn: Worn, tier: Tier, counts: Readonly<Record<string, number>>): SaveFailure | null {
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
  const notOwned = new Set<string>();
  for (const [item, n] of Object.entries(placedCounts(layout))) if (n > (counts[item] ?? 0)) notOwned.add(item);
  for (const id of [...styleIds, ...wornIds]) if (!((counts[id] ?? 0) > 0)) notOwned.add(id);
  return notOwned.size ? { status: 403, body: { error: 'not_owned', itemIds: [...notOwned].sort() } } : null;
}

/** Inserts the user's first-week row if it is missing (ON CONFLICT DO NOTHING: never a P2002 inside a transaction). */
async function ensureFirstWeek(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<void> {
  await db.roomFirstWeek.createMany({ data: [{ userId }], skipDuplicates: true });
}

export async function saveCosmetics(userId: string, body: unknown, now: Date, rawBytes?: number): Promise<{ ok: true; dto: CosmeticsDTO } | { ok: false; failure: SaveFailure }> {
  if (rawBytes !== undefined && rawBytes > MAX_BODY_BYTES) return { ok: false, failure: INVALID };
  const parsed = validateBody(body);
  if ('status' in parsed) return { ok: false, failure: parsed };
  let tier: Tier = 1;
  let failure: SaveFailure | null;
  try {
    failure = await prisma.$transaction(async (tx) => {
      // One writer at a time per room (spec §2.2); the version check below still answers another device's save.
      await lockRoom(tx, userId);
      const [rows, row] = await Promise.all([
        tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
        tx.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, version: true, tier: true } }),
      ]);
      tier = toTier(row?.tier);
      const bad = checkLayout(parsed.layout, parsed.worn, tier, countsOf(rows));
      if (bad) return bad;
      const data = {
        layout: parsed.layout as unknown as Prisma.InputJsonValue,
        room: slotsFromLayout(parsed.layout) as unknown as Prisma.InputJsonValue,
        worn: parsed.worn as unknown as Prisma.InputJsonValue,
      };
      if (parsed.version === 0) {
        if (row) return STALE;
        await tx.cosmeticLoadout.create({ data: { userId, ...data, version: 1 } });
      } else {
        const { count } = await tx.cosmeticLoadout.updateMany({ where: { userId, version: parsed.version }, data: { ...data, version: { increment: 1 } } });
        if (count === 0) return STALE;
      }
      // "Placed a piece" (spec §11.1): an instance id the stored layout (or the starter one) did not have.
      const before = new Set((parseLayout(row?.layout) ?? starterLayout()).pieces.map((p) => p.id));
      if (parsed.layout.pieces.some((p) => !before.has(p.id))) {
        await ensureFirstWeek(tx, userId);
        await tx.roomFirstWeek.updateMany({ where: { userId, firstPlacedAt: null }, data: { firstPlacedAt: now } });
      }
      return null;
    });
  } catch (err) {
    // A first save racing another create (the lock makes this a backstop only): the app re-reads.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, failure: STALE };
    throw err;
  }
  if (failure) return { ok: false, failure };
  console.info(JSON.stringify({ event: 'room.saved', pieces: parsed.layout.pieces.length, tier }));
  return { ok: true, dto: await readCosmetics(userId, now, { grant: false }) };
}

/** The welcome card was answered (spec §11.1): the first time is kept. */
export async function markWelcomed(userId: string, now: Date): Promise<void> {
  await ensureFirstWeek(prisma, userId);
  await prisma.roomFirstWeek.updateMany({ where: { userId, welcomedAt: null }, data: { welcomedAt: now } });
}
```

(Remove Task 3's `layout: Prisma.DbNull` stopgap: this save writes the layout itself.)

- [ ] **Step 5: The routes, `backend/src/cosmetics/routes.ts`**

```ts
import { markSeen, markWelcomed, readCosmetics, saveCosmetics } from './loadout';

cosmeticsRouter.put('/me/cosmetics', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  const raw = (req as AuthedRequest & { rawBody?: Buffer }).rawBody;
  const result = await saveCosmetics(req.userId!, req.body, new Date(), raw?.length);
  if (!result.ok) {
    res.status(result.failure.status).json(result.failure.body);
    return;
  }
  res.json(result.dto);
});

cosmeticsRouter.post('/me/room/welcomed', requireAuth, async (req: AuthedRequest, res) => {
  noStore(res);
  await markWelcomed(req.userId!, new Date());
  res.status(204).end();
});
```

Update the file's header comment to name spec 2026-10-15 §12 and the welcomed route.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backend-jest.sh tests/room tests/cosmetics`
Expected: PASS.

- [ ] **Step 7: Full backend suite, typecheck, commit**

Full backend suite (green), backend tsc (0). The app still sends Spec B's slot body until Task 10; its tests mock
the API, so the mobile suite is unaffected (note it in the ledger).

```bash
git add backend/src/room/lock.ts backend/src/cosmetics/loadout.ts backend/src/cosmetics/routes.ts backend/tests/room backend/tests/cosmetics/routes.test.ts
git commit -m "feat(backend): save free-build layouts under the per-user room lock with every placement check, record the first placement, and the welcomed route"
```

---

### Task 5: The iso engine I: the grid, `iso.py`'s primitives, and the depth sort

Spec §3.1 (the grid and its sizes per tier), §3.4 (topological depth sorting, ties on instance id), §3.7 (whole
cells, stair-step diagonals) and §16's engine tests (`P(i, j, z)` matches `iso.py`; the L-shaped sort fixture). Pure;
no React, no Skia; nothing is wired in yet.

**Files:**
- Create: `mobile/src/lib/room/iso/grid.ts`, `mobile/src/lib/room/iso/prims.ts`, `mobile/src/lib/room/iso/sort.ts`
- Test: `mobile/__tests__/lib/isoGrid.test.ts`, `mobile/__tests__/lib/isoSort.test.ts`

**Interfaces:**
- Consumes: `tierSize`, `Tier` (Task 2's `iso/geometry.ts`); `R`, `poly`, `shade`, `Rects` (`lib/room/paint.ts`);
  `RoomRect`, `Box` (`lib/room/grid.ts`); `mixHex` (`lib/colour.ts`).
- Produces:
  - `grid.ts`: `HT = 12`, `HH = 6`, `WALL_H = 64`, `type Proj = (i: number, j: number, z?: number) => [number, number]`,
    `interface IsoGrid { n; m; ox; oy; W; H }`, `isoGrid(tier): IsoGrid`, `projOf(g): Proj`, `LOCAL: Proj`,
    `unproject(g, x, y): [number, number]`;
  - `prims.ts`: `dark(c, t?)`, `lite(c, t?)`, `line(r, a, b, c)`, `box(r, P, i, j, z, di, dj, h, top, left?, right?)`,
    `flat(r, P, i, j, di, dj, c, z?)`, `isoShadow(r, P, i, j, di, dj, a?)`,
    `shear(rects, x0, y0, slope: 1 | -1): Rects`, `scaleRects(rects, kx, ky): Rects`, `moveRects(rects, dx, dy): Rects`,
    `mirrorRects(rects, axis): Rects`, `opaqueBounds(rects): Box | null`;
  - `sort.ts`: `interface DepthBox { key: string; i0: number; j0: number; i1: number; j1: number }`,
    `depthOrder(boxes, extra?: ReadonlyArray<readonly [string, string]>): string[]`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/isoGrid.test.ts`:

```ts
import { isoGrid, LOCAL, projOf, unproject } from '../../src/lib/room/iso/grid';
import { box, flat, line, mirrorRects, moveRects, opaqueBounds, scaleRects, shear } from '../../src/lib/room/iso/prims';
import type { RoomRect } from '../../src/lib/room/grid';

describe('the grid (spec §3.1, iso.py Iso)', () => {
  it('P(i, j, z) is iso.py\'s 2:1 projection with the back corner at (m·12 + 2, 68)', () => {
    const P = projOf(isoGrid(1));
    expect([P(0, 0), P(7, 0), P(0, 7), P(7, 7), P(1, 2, 10)]).toEqual([[86, 68], [170, 110], [2, 110], [86, 152], [74, 76]]);
    expect(LOCAL(1, 0, 0)).toEqual([12, 6]);
  });

  it('a room is (n + m)·12 + 4 by 68 + (n + m)·6 + 8 cells: 172 × 160, 196 × 172, 220 × 184', () => {
    expect([1, 2, 3].map((t) => { const g = isoGrid(t as 1 | 2 | 3); return [g.n, g.W, g.H]; })).toEqual([[7, 172, 160], [8, 196, 172], [9, 220, 184]]);
  });

  it('unproject is P\'s inverse on the floor', () => {
    const g = isoGrid(2);
    const [x, y] = projOf(g)(3.5, 4.25);
    expect(unproject(g, x, y)).toEqual([3.5, 4.25]);
  });
});

describe('primitives (iso.py line, box, flat, face)', () => {
  it('a diagonal is 2:1 stair steps of single cells', () => {
    const r: RoomRect[] = [];
    line(r, [0, 0], [4, 2], '#fff');
    expect(r).toEqual([[0, 0, 1, 1, '#fff'], [1, 0, 1, 1, '#fff'], [2, 1, 1, 1, '#fff'], [3, 1, 1, 1, '#fff']]);
  });

  it('a box draws its left face lighter than its right, its top, and a lit top edge, on whole cells', () => {
    const r: RoomRect[] = [];
    box(r, LOCAL, 0, 0, 0, 1, 1, 6, '#808080');
    const colours = new Set(r.map((q) => q[4]));
    expect(colours.size).toBe(4);
    expect(r.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger))).toBe(true);
  });

  it('flat fills a floor parallelogram', () => {
    const r: RoomRect[] = [];
    flat(r, LOCAL, 0, 0, 1, 1, '#123456');
    const b = opaqueBounds(r)!;
    expect(b.x >= -12 && b.x + b.w <= 12 && b.w >= 22).toBe(true); // the tile's two side points are a cell thin
    expect([b.y, b.h]).toEqual([0, 12]);
  });

  it('shear puts columns on a wall: down by floor(u/2) on the right wall, up by ceil(u/2) on the left', () => {
    const rect: RoomRect[] = [[0, 0, 4, 1, '#f00']];
    expect(shear(rect, 10, 20, 1)).toEqual([[10, 20, 2, 1, '#f00'], [12, 21, 2, 1, '#f00']]);
    expect(shear(rect, 10, 20, -1)).toEqual([[10, 20, 1, 1, '#f00'], [11, 19, 2, 1, '#f00'], [13, 18, 1, 1, '#f00']]);
  });

  it('scale, move, mirror; opaque bounds ignore shadows', () => {
    expect(scaleRects([[2, 2, 2, 2, '#a']], 0.5, 1.5)).toEqual([[1, 3, 1, 3, '#a']]);
    expect(moveRects([[1, 1, 1, 1, '#a']], 2, -1)).toEqual([[3, 0, 1, 1, '#a']]);
    expect(mirrorRects([[1, 0, 2, 1, '#a']], 0)).toEqual([[-3, 0, 2, 1, '#a']]);
    expect(opaqueBounds([[0, 0, 9, 9, 'rgba(0,0,0,0.2)'], [2, 3, 1, 1, '#a']])).toEqual({ x: 2, y: 3, w: 1, h: 1 });
  });
});
```

`mobile/__tests__/lib/isoSort.test.ts`:

```ts
import { depthOrder, type DepthBox } from '../../src/lib/room/iso/sort';

const b = (key: string, i0: number, j0: number, i1: number, j1: number): DepthBox => ({ key, i0, j0, i1, j1 });

describe('depth order (spec §3.4)', () => {
  it('draws back to front along either axis', () => {
    expect(depthOrder([b('front', 2, 2, 3, 3), b('back', 0, 0, 1, 1)])).toEqual(['back', 'front']);
  });

  it('gets the L-shaped case right that one depth key gets wrong', () => {
    // A long piece across the front row and a small one behind its right end: by corner or centre sums A comes
    // first, but B's far edge is at A's near edge (B.j1 <= A.j0), so B is behind.
    const A = b('A', 0, 1, 5, 2);
    const B = b('B', 4, 0, 5, 1);
    expect(depthOrder([A, B])).toEqual(['B', 'A']);
  });

  it('keeps extra edges (KIP after its desk) and breaks ties on the key, whatever the input order', () => {
    const desk = b('desk', 2, 0, 5, 2);
    const kip = b('@kip', 3, 1, 4, 2);
    const fern = b('fern', 0, 0, 1, 1);
    const order = depthOrder([kip, desk, fern], [['desk', '@kip']]);
    expect(order).toEqual(['fern', 'desk', '@kip']);
    expect(depthOrder([fern, desk, kip], [['desk', '@kip']])).toEqual(order);
  });

  it('never throws on overlapping boxes (a stored layout from a newer server): falls back to position, then key', () => {
    expect(depthOrder([b('y', 0, 0, 2, 2), b('x', 0, 0, 2, 2)])).toEqual(['x', 'y']);
  });

  it('sorts 90 pieces in well under a millisecond-scale budget (a smoke check, not a gate)', () => {
    const boxes = Array.from({ length: 81 }, (_, k) => b(`p${k}`, k % 9, Math.floor(k / 9), (k % 9) + 1, Math.floor(k / 9) + 1));
    const order = depthOrder(boxes);
    expect(order).toHaveLength(81);
    expect(order[0]).toBe('p0');
    expect(order[80]).toBe('p80');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `mobile/`): `node node_modules/.bin/jest --forceExit __tests__/lib/isoGrid.test.ts __tests__/lib/isoSort.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: `mobile/src/lib/room/iso/grid.ts`**

```ts
// KIP's isometric room grid (spec 2026-10-15 §3.1; docs/design/freebuild/gen/iso.py `Iso`). Tiles are 24 × 12 cells:
// P(i, j, z) = (ox + (i − j)·12, oy + (i + j)·6 − z). i runs down-right along the right wall (j = 0), j down-left
// along the left wall (i = 0), z is height in cells. Walls are 64 cells tall. Drawn at 2 points per cell.
import { tierSize, type Tier } from './geometry';

export const HT = 12;
export const HH = 6;
export const WALL_H = 64;

export type Proj = (i: number, j: number, z?: number) => [number, number];

export interface IsoGrid {
  n: number;
  m: number;
  /** The back corner's floor point, in cells. */
  ox: number;
  oy: number;
  /** The room's size in cells. */
  W: number;
  H: number;
}

export function isoGrid(tier: Tier): IsoGrid {
  const { n, m } = tierSize(tier);
  const ox = m * HT + 2;
  const oy = WALL_H + 4;
  return { n, m, ox, oy, W: (n + m) * HT + 4, H: oy + (n + m) * HH + 8 };
}

export function projOf(g: Pick<IsoGrid, 'ox' | 'oy'>): Proj {
  return (i, j, z = 0) => [g.ox + (i - j) * HT, g.oy + (i + j) * HH - z];
}

/** A piece's own drawing space, its origin at (0, 0): the engine moves it to its anchor. */
export const LOCAL: Proj = projOf({ ox: 0, oy: 0 });

/** The floor point (i, j) under room cell (x, y) at z = 0: P's inverse. */
export function unproject(g: Pick<IsoGrid, 'ox' | 'oy'>, x: number, y: number): [number, number] {
  const a = (x - g.ox) / HT;
  const b = (y - g.oy) / HH;
  return [(a + b) / 2, (b - a) / 2];
}
```

- [ ] **Step 4: `mobile/src/lib/room/iso/prims.ts`**

```ts
// iso.py's drawing primitives, typed (spec 2026-10-15 §3.7, §4): boxes with the window-side light (left faces
// lighter, right faces darker), flat floor shapes, 2:1 stair-step lines, sprites sheared onto a wall. Every helper
// appends whole-cell rects; nothing here knows about items.
import { mixHex } from '../../colour';
import type { Box, RoomRect } from '../grid';
import { R, poly, shade, type Rects } from '../paint';
import { HH, HT, type Proj } from './grid';

export const dark = (c: string, t = 0.25): string => mixHex(c, '#000000', t);
export const lite = (c: string, t = 0.2): string => mixHex(c, '#FFFFFF', t);

type Pt = readonly [number, number];

/** iso.py `line`: one cell per column, so a 2:1 diagonal is a stair (never a smoothed line). */
export function line(r: Rects, a: Pt, b: Pt, c: string): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const n = Math.max(Math.trunc(Math.abs(x1 - x0)), 1);
  for (let k = 0; k < n; k++) {
    const t = k / n;
    R(r, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t), 1, 1, c);
  }
}

/** iso.py `box`: the j-max face (toward the lower left, lit), the i-max face (shaded), the top and its lit edge. */
export function box(r: Rects, P: Proj, i: number, j: number, z: number, di: number, dj: number, h: number, top: string, left = dark(top, 0.22), right = dark(top, 0.38)): void {
  poly(r, [P(i, j + dj, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], left);
  poly(r, [P(i + di, j, z), P(i + di, j + dj, z), P(i + di, j + dj, z + h), P(i + di, j, z + h)], right);
  poly(r, [P(i, j, z + h), P(i + di, j, z + h), P(i + di, j + dj, z + h), P(i, j + dj, z + h)], top);
  line(r, P(i, j + dj, z + h), P(i + di, j + dj, z + h), lite(top, 0.18));
}

/** iso.py `flat`: a floor parallelogram (a rug, a tile) at height z. */
export function flat(r: Rects, P: Proj, i: number, j: number, di: number, dj: number, c: string, z = 0): void {
  poly(r, [P(i, j, z), P(i + di, j, z), P(i + di, j + dj, z), P(i, j + dj, z)], c);
}

/** iso.py `shadow`: a soft contact shadow under a footprint. */
export function isoShadow(r: Rects, P: Proj, i: number, j: number, di: number, dj: number, a = 0.22): void {
  const [cx, cy] = P(i + di / 2, j + dj / 2);
  shade(r, cx, cy, (di + dj) * HT * 0.55, (di + dj) * HH * 0.55, a);
}

/**
 * Rects sheared onto a wall (iso.py `face`). A rect's x and y are relative to the plane's origin (x0, y0); column u
 * drops by floor(u / 2) on the right wall's plane (slope +1) and rises by ceil(u / 2) on the left wall's (slope -1).
 * Runs of columns with the same drop stay one rect.
 */
export function shear(rects: readonly RoomRect[], x0: number, y0: number, slope: 1 | -1): Rects {
  const dy = (u: number) => (slope > 0 ? Math.floor(u / 2) : -Math.ceil(u / 2));
  const out: Rects = [];
  for (const [x, y, w, h, c] of rects) {
    let u = Math.round(x);
    const end = Math.round(x + w);
    while (u < end) {
      const d = dy(u);
      let v = u + 1;
      while (v < end && dy(v) === d) v++;
      R(out, x0 + u, y0 + y + d, v - u, h, c);
      u = v;
    }
  }
  return out;
}

/** Nearest-neighbour resampling of whole-cell rects (window decor onto the iso frame); never below one cell. */
export function scaleRects(rects: readonly RoomRect[], kx: number, ky: number): Rects {
  return rects.map(([x, y, w, h, c]) => {
    const xa = Math.round(x * kx);
    const xb = Math.max(xa + 1, Math.round((x + w) * kx));
    const ya = Math.round(y * ky);
    const yb = Math.max(ya + 1, Math.round((y + h) * ky));
    return [xa, ya, xb - xa, yb - ya, c] as RoomRect;
  });
}

export function moveRects(rects: readonly RoomRect[], dx: number, dy: number): Rects {
  return rects.map(([x, y, w, h, c]) => [x + dx, y + dy, w, h, c] as RoomRect);
}

/** Mirrors rects across the vertical line x = axis (Flip). */
export function mirrorRects(rects: readonly RoomRect[], axis: number): Rects {
  return rects.map(([x, y, w, h, c]) => [2 * axis - x - w, y, w, h, c] as RoomRect);
}

/** The box around the opaque rects (contact shadows and glows are 'rgba(…)' and left out), or null. */
export function opaqueBounds(rects: readonly RoomRect[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h, c] of rects) {
    if (c.startsWith('rgba')) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
```

- [ ] **Step 5: `mobile/src/lib/room/iso/sort.ts`**

```ts
// Depth order for floor pieces (spec 2026-10-15 §3.4): a topological sort, not one depth key. A is behind B when
// A's far edge is at or behind B's near edge on either axis. When both hold, the two never overlap on screen (A is
// wholly left or right of B), so no edge is needed. Kahn's algorithm picks, among the pieces ready to draw, the one
// furthest back (i0 + j0), then the key (the instance id), so the picture is deterministic. Footprints of a valid
// layout never overlap, so a cycle cannot form; if a stored layout ever has one, the rest are drawn by position and
// key instead of throwing. O(n²) for at most 90 pieces.

export interface DepthBox {
  key: string;
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

const behind = (a: DepthBox, b: DepthBox) => a.i1 <= b.i0 || a.j1 <= b.j0;
const rank = (a: DepthBox, b: DepthBox) => a.i0 + a.j0 - (b.i0 + b.j0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function depthOrder(boxes: readonly DepthBox[], extra: ReadonlyArray<readonly [string, string]> = []): string[] {
  const n = boxes.length;
  const indeg = new Array<number>(n).fill(0);
  const next: number[][] = boxes.map(() => []);
  const edge = (a: number, b: number) => { next[a]!.push(b); indeg[b]!++; };
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const ab = behind(boxes[a]!, boxes[b]!);
      const ba = behind(boxes[b]!, boxes[a]!);
      if (ab && !ba) edge(a, b);
      else if (ba && !ab) edge(b, a);
    }
  }
  const index = new Map(boxes.map((box, k) => [box.key, k]));
  for (const [from, to] of extra) {
    const a = index.get(from);
    const b = index.get(to);
    if (a !== undefined && b !== undefined) edge(a, b);
  }
  const done = new Array<boolean>(n).fill(false);
  const out: string[] = [];
  for (;;) {
    let pick = -1;
    for (let k = 0; k < n; k++) if (!done[k] && indeg[k] === 0 && (pick < 0 || rank(boxes[k]!, boxes[pick]!) < 0)) pick = k;
    if (pick < 0) break;
    done[pick] = true;
    out.push(boxes[pick]!.key);
    for (const b of next[pick]!) indeg[b]!--;
  }
  if (out.length < n) out.push(...boxes.filter((_, k) => !done[k]).sort(rank).map((b) => b.key));
  return out;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoGrid.test.ts __tests__/lib/isoSort.test.ts`
Expected: PASS.

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src/lib/room/iso/grid.ts mobile/src/lib/room/iso/prims.ts mobile/src/lib/room/iso/sort.ts mobile/__tests__/lib/isoGrid.test.ts mobile/__tests__/lib/isoSort.test.ts
git commit -m "feat(mobile): the isometric grid, iso.py's drawing primitives in TypeScript, and the topological depth sort"
```

---

### Task 6: The iso engine II: the shell and the 21 room-wide styles

Spec §1 (styles: `wallpaper` on both back walls, `floor` on the floor diamond, `window` around the fixed glass),
§3.2 (the left window, the loft's right window), §3.7 (lighting carried over: today's weather in the glass), §4
(styles are textures, one drawing each). Rulings 5, 6 and the Spec B Task 9 ledger item (concrete speckle steps).

**Files:**
- Create: `mobile/src/lib/room/iso/styles.ts`
- Modify: `mobile/src/lib/room/items/window.ts` (decor split out), `mobile/src/lib/room/items/sets/cottage.ts`
  (window decor split out)
- Test: `mobile/__tests__/lib/isoStyles.test.ts`

**Interfaces:**
- Consumes: Task 5 (`IsoGrid`, `projOf`, `HT`, `HH`, `WALL_H`, `box`, `flat`, `line`, `shear`, `scaleRects`,
  `moveRects`, `dark`, `lite`); Spec A/B `itemArt`, `ItemContext`, `ItemLayers`, `windowSky`, `clipB`, `px`, `poly`,
  `WALL_X0`, `WALL_X1`, `FLOOR_Y`, `StyleKey`, `Tier`.
- Produces:
  - `window.ts`: `WINDOW_O: readonly [number, number]` (19, 15), `WINDOW_DECOR: Readonly<Record<ItemId, (ctx) => ItemLayers>>`
    (absolute front-on cells, no frame) for `win.plain`, `win.curtains`, `win.blinds`, `win.sticker`, `win.fairy`,
    `win.chime`; the front-on pieces are built from it and draw exactly as before;
  - `cottage.ts`: `cottageWindowDecor(r: Rects): void` (absolute front-on cells);
  - `styles.ts`: `WALL_TEXTURE_ROWS = 62`, `wallTexture(id, ctx): Rects`, `FLOOR_STYLES`,
    `WINDOW_STYLES: Readonly<Record<ItemId, WindowStyle>>`, `interface IsoWindow { wall: 'wallL' | 'wallR'; a0: number; da: number }`,
    `windowsFor(g: IsoGrid, tier: Tier): IsoWindow[]`,
    `drawShell(g: IsoGrid, tier: Tier, styles: Record<StyleKey, ItemId>, ctx: ItemContext): ItemLayers`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/isoStyles.test.ts`:

```ts
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import { catalogueItemsFor } from '../../src/lib/room/catalogue';
import { boundsOf, boxContains } from '../../src/lib/room/grid';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { FLOOR_STYLES, WINDOW_STYLES, drawShell, wallTexture, windowsFor } from '../../src/lib/room/iso/styles';
import { itemArt } from '../../src/lib/room/items';
import { WINDOW_DECOR } from '../../src/lib/room/items/window';
import '../../src/lib/room/art';

const PLAIN = { wallpaper: 'wall.plain', floor: 'floor.oakDark', window: 'win.plain' } as const;
const LIME = { ...CTX_DAY, colour: 'lime' as const, ramp: kipRamp(KIP_COLOURS.lime) };
const shell = (over: Partial<Record<'wallpaper' | 'floor' | 'window', string>> = {}, ctx = CTX_DAY, tier: 1 | 2 | 3 = 1) =>
  drawShell(isoGrid(tier), tier, { ...PLAIN, ...over }, ctx);

it('every shipped style has an iso drawing: 9 wallpapers, 5 floors, 7 window styles (spec §4)', () => {
  const walls = catalogueItemsFor('wallpaper').filter((i) => i.release !== 3);
  const floors = catalogueItemsFor('floor');
  const windows = catalogueItemsFor('window');
  expect([walls.length, floors.length, windows.length]).toEqual([9, 5, 7]);
  for (const w of walls) expect({ id: w.id, art: !!itemArt(w.id) && wallTexture(w.id, CTX_DAY).length > 0 }).toEqual({ id: w.id, art: true });
  for (const f of floors) expect({ id: f.id, style: !!FLOOR_STYLES[f.id] }).toEqual({ id: f.id, style: true });
  for (const w of windows) expect({ id: w.id, style: !!WINDOW_STYLES[w.id] }).toEqual({ id: w.id, style: true });
});

it('each style changes the picture, stays inside the room and on whole cells, day and night, at every tier', () => {
  const plain = JSON.stringify(shell().base);
  for (const [key, ids] of [['wallpaper', catalogueItemsFor('wallpaper')], ['floor', catalogueItemsFor('floor')], ['window', catalogueItemsFor('window')]] as const) {
    for (const { id } of ids) {
      for (const tier of [1, 2, 3] as const) {
        for (const ctx of [CTX_DAY, CTX_NIGHT]) {
          const layers = shell({ [key]: id }, ctx, tier);
          const g = isoGrid(tier);
          const b = boundsOf(layers.base!)!;
          expect({ id, tier, inside: boxContains({ x: 0, y: 0, w: g.W, h: g.H }, b) }).toEqual({ id, tier, inside: true });
          expect(layers.base!.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger))).toBe(true);
          expect(drawShell(g, tier, { ...PLAIN, [key]: id }, ctx)).toEqual(layers); // deterministic
        }
      }
      if (id !== PLAIN[key]) expect({ id, differs: JSON.stringify(shell({ [key]: id }).base) !== plain }).toEqual({ id, differs: true });
    }
  }
});

it('tinted styles follow KIP\'s colour; the others never do', () => {
  for (const [key, id, tinted] of [['floor', 'floor.carpet', true], ['wallpaper', 'wall.stripes', true], ['window', 'win.curtains', true], ['floor', 'floor.tiles', false], ['window', 'win.blinds', false]] as const) {
    const follows = JSON.stringify(shell({ [key]: id }, CTX_DAY)) !== JSON.stringify(shell({ [key]: id }, LIME));
    expect({ id, follows }).toEqual({ id, follows: tinted });
  }
});

it('the glass shows today\'s weather and the night (Spec A §6)', () => {
  const sky = (weather: typeof CTX_DAY.weather, night = false) => JSON.stringify(shell({}, { ...CTX_DAY, weather, night }).base);
  expect(new Set([sky('clear'), sky('stormy'), sky('cloudy'), sky('clear', true)]).size).toBe(4);
});

it('one window on the left wall; the loft adds the right wall\'s, at i = n − 2.6 (spec §3.2)', () => {
  expect(windowsFor(isoGrid(1), 1)).toEqual([{ wall: 'wallL', a0: 1.6, da: 2 }]);
  expect(windowsFor(isoGrid(3), 3)).toEqual([{ wall: 'wallL', a0: 1.6, da: 2 }, { wall: 'wallR', a0: 6.4, da: 2 }]);
});

it('a lit window style glows and loops around the glass; a still one does neither', () => {
  const fairy = shell({ window: 'win.fairy' }, CTX_NIGHT);
  expect([(fairy.emissive?.length ?? 0) > 0, fairy.frames?.length]).toEqual([true, 3]);
  expect(JSON.stringify(fairy.frames![0]) !== JSON.stringify(fairy.frames![1])).toBe(true);
  expect(shell({ window: 'win.chime' }).frames?.length).toBe(3);
  const plain = shell();
  expect([plain.emissive?.length ?? 0, plain.frames]).toEqual([0, undefined]);
});

it('the front-on window pieces still draw exactly the frame plus their decor (Spec B art unchanged)', () => {
  for (const id of Object.keys(WINDOW_DECOR)) {
    if (id === 'win.plain') continue;
    const decor = WINDOW_DECOR[id]!(CTX_DAY).base ?? [];
    const base = itemArt(id)!.draw(CTX_DAY).base!;
    expect({ id, tail: JSON.stringify(base.slice(base.length - decor.length)) }).toEqual({ id, tail: JSON.stringify(decor) });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoStyles.test.ts`
Expected: FAIL (`iso/styles.ts` and `WINDOW_DECOR` missing).

- [ ] **Step 3: Split the window decor out of `mobile/src/lib/room/items/window.ts`**

Keep the sprites. Replace `still`, `fairy`, `chime` and the `registerItems` call with:

```ts
/** The board's (0, 0) in room cells: the curtains' (-3, -3) lands on the window anchor's corner (16, 12). */
export const WINDOW_O = [19, 15] as const;
const O = WINDOW_O;

const FAIRY_WIRE = FAIRY.filter(([, , , , c]) => c === '#475569');
const FAIRY_BULBS = FAIRY.filter(([, , , , c]) => c !== '#475569');
const CHIME_BAR = CHIME.filter(([, y]) => y < 7);
const CHIME_TUBES = CHIME.filter(([, y]) => y >= 7);

const still = (decor: readonly SpriteRect[]) => (ctx: ItemContext): ItemLayers => {
  const r: Rects = [];
  sprite(r, decor, O[0], O[1], ctx.ramp);
  return { base: r };
};

/**
 * Each window style's decor in front-on cells, without the frame and the glass (plan ruling 5): the front-on pieces
 * draw Spec A's frame and then this; the iso window draws its own frame and sky and then this, scaled and sheared.
 */
export const WINDOW_DECOR: Readonly<Record<ItemId, (ctx: ItemContext) => ItemLayers>> = {
  'win.plain': () => ({}),
  'win.curtains': still(CURTAINS),
  'win.blinds': still(BLINDS),
  'win.sticker': still(STICKER),
  // Fairy lights: the wire in the base; each bulb in the glow layer, every third one brighter in turn.
  'win.fairy': (ctx) => {
    const r: Rects = [];
    sprite(r, FAIRY_WIRE, O[0], O[1], ctx.ramp);
    const emissive: Rects = [];
    sprite(emissive, FAIRY_BULBS, O[0], O[1], ctx.ramp);
    if (ctx.night) for (const [x, y, , , c] of FAIRY_BULBS) glow(emissive, O[0] + x + 0.5, O[1] + y + 0.5, 2.5, 2.5, rgbOf(c), 0.1);
    const frames = three((k) => {
      const f: Rects = [];
      FAIRY_BULBS.forEach(([x, y], i) => { if ((i + k) % 3 === 0) R(f, O[0] + x, O[1] + y, 1, 1, '#FFFFFF'); });
      return f;
    });
    return { base: r, emissive, frames };
  },
  // Wind chime: the bar in the base; the tubes and the clapper swing one cell and back.
  'win.chime': (ctx) => {
    const r: Rects = [];
    sprite(r, CHIME_BAR, O[0], O[1], ctx.ramp);
    return {
      base: r,
      frames: three((k) => {
        const f: Rects = [];
        sprite(f, CHIME_TUBES.map(([x, y, w, h, c]) => [x, y, w, h, veiled(tintOf(c, ctx.ramp), ctx.night)] as const), O[0] + [0, 1, -1][k]!, O[1], ctx.ramp);
        return f;
      }),
    };
  },
};

/** A front-on window piece: Spec A's frame with today's sky, then its decor. */
const framed = (id: ItemId, flags: Pick<ItemArt, 'tint' | 'emissive' | 'frames'>): ItemArt => ({
  id, slot: 'window', ...flags,
  draw: (ctx) => {
    const r: Rects = [];
    windowFrame(r, ctx);
    const d = WINDOW_DECOR[id]!(ctx);
    return { base: [...r, ...(d.base ?? [])], ...(d.emissive ? { emissive: d.emissive } : {}), ...(d.frames ? { frames: d.frames } : {}) };
  },
});

registerItems([
  framed('win.curtains', { tint: true }), framed('win.blinds', {}), framed('win.sticker', {}),
  framed('win.fairy', { emissive: true, frames: 3 }), framed('win.chime', { frames: 3 }),
]);
```

(Import `ItemContext`, `ItemLayers` from `../items` and `ItemId` from `../loadout`; `win.plain` stays registered by
`starterItems.ts`.) Run `node node_modules/.bin/jest --forceExit __tests__/lib/roomArtWalls.test.ts` now: it must stay
green (the front-on pieces draw the same rects).

- [ ] **Step 4: Split the Cottage window's decor in `mobile/src/lib/room/items/sets/cottage.ts`**

Move every line of `win.draw` after `R(r, 21, 30, 30, 2, '#F5F1E6');` (the sill, the flower pots, both curtains,
their ties and the rod line) into

```ts
/** The Cottage window's decor in front-on cells (sill, geraniums, gingham curtains, ties, rod): the iso window draws
 *  its own frame and sky, then this (plan ruling 5). */
export function cottageWindowDecor(r: Rects): void {
  R(r, 16, 48, 40, 2, '#8A6542'); R(r, 18, 50, 36, 5, '#8B5A3C'); R(r, 18, 50, 36, 1, '#A87350');
  ([[21, '#E8A0A0'], [26, '#F472B6'], [31, '#FDE047'], [36, '#E8A0A0'], [41, '#FB7185'], [46, '#F5F1E6'], [50, '#F472B6']] as const).forEach(([x, c], k) => {
    E(r, x + 1, 47, 2.2, 2.2, '#6E9A4A'); E(r, x + 1, 45.5 - (k % 2), 1.6, 1.6, c); px(r, x + 1, 45 - (k % 2), '#FDE68A');
  });
  poly(r, [[16, 12], [25, 12], [23, 30], [19, 54], [16, 54]], '#E8A0A0');
  poly(r, [[47, 12], [56, 12], [56, 54], [53, 54], [49, 30]], '#E8A0A0');
  for (let y = 14; y < 54; y += 4) { R(r, 16, y, 4, 1, '#F5C6C6'); R(r, 52, y, 4, 1, '#F5C6C6'); }
  R(r, 18, 30, 4, 2, '#8BA77A'); R(r, 50, 30, 4, 2, '#8BA77A'); R(r, 16, 12, 40, 1, '#523822');
}
```

and end `win.draw` with `cottageWindowDecor(r); return { base: r };`. (The front-on picture is unchanged; the set test
`__tests__/lib/roomSets.test.ts` must stay green.)

- [ ] **Step 5: `mobile/src/lib/room/iso/styles.ts`**

```ts
// The room's shell and its three room-wide styles (spec 2026-10-15 §1, §3.2, §4; isox.py `shell`, `win`). Walls:
// the wallpaper's front-on back-wall band, sheared onto both walls (the left one darker, as the window lights the
// right one). Floor: five iso floors in the boards' colours. Windows: today's sky (Spec A's windowSky) sheared onto
// the wall, the style's frame colour and its decor scaled onto the iso frame (plan rulings 5 and 6).
import { FLOOR_Y, WALL_X0, WALL_X1, type RoomRect } from '../grid';
import { itemArt, type ItemContext, type ItemLayers } from '../items';
import type { ItemId } from '../loadout';
import { clipB, poly, px, type Rects } from '../paint';
import { windowSky } from '../weather';
import { WINDOW_DECOR, WINDOW_O } from '../items/window';
import { cottageWindowDecor } from '../items/sets/cottage';
import type { StyleKey, Tier } from './geometry';
import { HT, HH, WALL_H, projOf, type IsoGrid, type Proj } from './grid';
import { dark, flat, lite, line, moveRects, scaleRects, shear } from './prims';

/** The wallpaper rows used: the 62 above Spec A's 2-row skirting (the iso skirting covers the last 3). */
export const WALL_TEXTURE_ROWS = 62;

/** A wallpaper as a texture: its front-on back-wall band, x from the back wall's left edge, y up from the floor line. */
export function wallTexture(id: ItemId, ctx: ItemContext): Rects {
  const art = itemArt(id)?.slot === 'wallpaper' ? itemArt(id)! : itemArt('wall.plain')!;
  const band = clipB(art.draw(ctx).base ?? [], [WALL_X0, FLOOR_Y - WALL_H, WALL_X1 - WALL_X0, WALL_TEXTURE_ROWS]);
  return moveRects(band, -WALL_X0, -FLOOR_Y);
}

function drawWalls(r: Rects, g: IsoGrid, P: Proj, id: ItemId, ctx: ItemContext): void {
  const tex = wallTexture(id, ctx);
  // The right wall (j = 0): its texture starts at the back corner and runs down-right.
  r.push(...shear(clipB(tex, [0, -WALL_H, g.n * HT, WALL_H]), g.ox, g.oy, 1));
  // The left wall (i = 0): its screen-left end is the front left corner, rising to the back corner.
  r.push(...shear(clipB(tex, [0, -WALL_H, g.m * HT, WALL_H]), g.ox - g.m * HT, g.oy + g.m * HH, -1));
  poly(r, [P(0, 0, 0), P(0, g.m, 0), P(0, g.m, WALL_H), P(0, 0, WALL_H)], 'rgba(0,0,0,0.14)');
  line(r, P(0, g.m, WALL_H), P(0, 0, WALL_H), 'rgba(255,255,255,0.14)');
  line(r, P(0, 0, WALL_H), P(g.n, 0, WALL_H), 'rgba(255,255,255,0.14)');
  poly(r, [P(0, 0, 0), P(0, g.m, 0), P(0, g.m, 3), P(0, 0, 3)], 'rgba(0,0,0,0.38)');
  poly(r, [P(0, 0, 0), P(g.n, 0, 0), P(g.n, 0, 3), P(0, 0, 3)], 'rgba(0,0,0,0.3)');
}

type FloorStyle = (r: Rects, g: IsoGrid, P: Proj, ctx: ItemContext) => void;

const tiles = (r: Rects, g: IsoGrid, P: Proj, a: string, b: string) => {
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.m; j++) flat(r, P, i, j, 1, 1, (i + j) % 2 ? b : a);
};
const planks = (r: Rects, g: IsoGrid, P: Proj, c: string) => {
  for (let j = 0; j < g.m; j++) line(r, P(0, j + 0.5), P(g.n, j + 0.5), c);
};
const seams = (r: Rects, g: IsoGrid, P: Proj, c: string, every = 1) => {
  for (let i = every; i < g.n; i += every) line(r, P(i, 0), P(i, g.m), c);
  for (let j = every; j < g.m; j += every) line(r, P(0, j), P(g.n, j), c);
};
/** Speckles stepping through the floor in tenths of a tile, with the board's steps (Spec B Task 9 minor). */
const speckle = (r: Rects, g: IsoGrid, P: Proj, n: number, a: string, b: string, si: number, sj: number, oi: number, oj: number) => {
  for (let k = 0; k < n; k++) {
    const [x, y] = P(((k * si + oi) % (g.n * 10)) / 10 + 0.05, ((k * sj + oj) % (g.m * 10)) / 10 + 0.05);
    px(r, Math.round(x), Math.round(y), k % 2 ? a : b);
  }
};

export const FLOOR_STYLES: Readonly<Record<ItemId, FloorStyle>> = {
  'floor.oakDark': (r, g, P) => { tiles(r, g, P, '#4A382B', '#523E2F'); planks(r, g, P, dark('#4A382B', 0.12)); },
  'floor.tiles': (r, g, P) => { tiles(r, g, P, '#E5E7EB', '#DDE1E6'); seams(r, g, P, '#CBD5E1'); },
  'floor.carpet': (r, g, P, { ramp }) => { tiles(r, g, P, ramp.shade, ramp.shade); speckle(r, g, P, g.n * g.m * 24, ramp.deep, ramp.body, 5, 3, 1, 2); },
  'floor.concrete': (r, g, P) => { tiles(r, g, P, '#57534E', '#5A5650'); speckle(r, g, P, g.n * g.m * 16, '#48443F', '#6B665F', 7, 11, 3, 5); seams(r, g, P, '#4A4642', 2); },
  'set.cottage.floor': (r, g, P) => { tiles(r, g, P, '#C19A6B', '#BB9465'); planks(r, g, P, '#A57F52'); },
};
const FLOOR_EDGE: Readonly<Record<ItemId, string>> = {
  'floor.oakDark': '#4A382B', 'floor.tiles': '#B8BEC8', 'floor.concrete': '#57534E', 'set.cottage.floor': '#A57F52',
};

export interface WindowStyle {
  frame: string;
  mullion: string;
  /** Decor in front-on cells; the board's window frame (34 × 30) sits at WINDOW_O. */
  decor: (ctx: ItemContext) => ItemLayers;
}
export const WINDOW_STYLES: Readonly<Record<ItemId, WindowStyle>> = {
  ...Object.fromEntries(Object.entries(WINDOW_DECOR).map(([id, decor]) => [id, { frame: '#1E2430', mullion: '#1E2430', decor }])),
  'set.cottage.window': { frame: '#F5F1E6', mullion: '#F5F1E6', decor: () => { const r: Rects = []; cottageWindowDecor(r); return { base: r }; } },
};

export interface IsoWindow { wall: 'wallL' | 'wallR'; a0: number; da: number }
/** The left wall's window (j 1.6–3.6) and, in the loft, the right wall's at i = n − 2.6 (spec §3.2). */
export function windowsFor(g: IsoGrid, tier: Tier): IsoWindow[] {
  return [{ wall: 'wallL', a0: 1.6, da: 2 }, ...(tier === 3 ? [{ wall: 'wallR' as const, a0: g.n - 2.6, da: 2 }] : [])];
}

/** The iso window frame: 24 cells across (2 tiles), 34 up (z 22–56); the glass inside at z 24–54. */
const FRAME_W = 24;
const FRAME_H = 34;
const BOARD_W = 34;
const BOARD_H = 30;

function drawWindow(out: Required<Pick<ItemLayers, 'base' | 'emissive'>> & { frames: Rects[] | null }, g: IsoGrid, P: Proj, w: IsoWindow, style: WindowStyle, ctx: ItemContext): void {
  const left = w.wall === 'wallL';
  // The plane's origin: the frame's screen-left end at z 22 (the far end on the left wall, the near end on the right).
  const [ox, oy] = left ? P(0, w.a0 + w.da, 22) : P(w.a0, 0, 22);
  const onWall = (rects: Rects) => shear(rects, ox, oy, left ? -1 : 1);
  const plane: Rects = [[0, -FRAME_H, FRAME_W, FRAME_H, style.frame]];
  windowSky(plane, { x: 1, y: -FRAME_H + 2, w: FRAME_W - 2, h: 30 }, ctx.weather, ctx.night);
  plane.push([FRAME_W / 2 - 1, -FRAME_H + 2, 2, 30, style.mullion], [1, -17, FRAME_W - 2, 1, style.mullion]);
  out.base.push(...onWall(plane));
  // The sill stands out of the wall on the floor plane (isox.py).
  const sill = left
    ? [P(0, w.a0 - 0.1, 22), P(0, w.a0 + w.da + 0.1, 22), P(0.25, w.a0 + w.da + 0.1, 22), P(0.25, w.a0 - 0.1, 22)]
    : [P(w.a0 - 0.1, 0, 22), P(w.a0 + w.da + 0.1, 0, 22), P(w.a0 + w.da + 0.1, 0.25, 22), P(w.a0 - 0.1, 0.25, 22)];
  poly(out.base, sill, lite('#2F3646', 0.1));
  // The style's decor, from board-frame cells onto the iso frame.
  const map = (rects: readonly RoomRect[] | undefined) =>
    onWall(moveRects(scaleRects(moveRects(rects ?? [], -WINDOW_O[0], -WINDOW_O[1]), FRAME_W / BOARD_W, FRAME_H / BOARD_H), 0, -FRAME_H));
  const d = style.decor(ctx);
  out.base.push(...map(d.base));
  out.emissive.push(...map(d.emissive));
  if (d.frames) {
    const f = d.frames.map((fr) => map(fr));
    out.frames = out.frames ? out.frames.map((prev, k) => [...prev, ...f[k]!]) : f;
  }
}

/** The walls, windows and floor for a tier and three styles; unknown ids draw as the starter styles. */
export function drawShell(g: IsoGrid, tier: Tier, styles: Record<StyleKey, ItemId>, ctx: ItemContext): ItemLayers {
  const P = projOf(g);
  const out = { base: [] as Rects, emissive: [] as Rects, frames: null as Rects[] | null };
  drawWalls(out.base, g, P, styles.wallpaper, ctx);
  const win = WINDOW_STYLES[styles.window] ?? WINDOW_STYLES['win.plain']!;
  for (const w of windowsFor(g, tier)) drawWindow(out, g, P, w, win, ctx);
  const floorId = FLOOR_STYLES[styles.floor] ? styles.floor : 'floor.oakDark';
  FLOOR_STYLES[floorId]!(out.base, g, P, ctx);
  const edge = FLOOR_EDGE[floorId] ?? ctx.ramp.deep;
  poly(out.base, [P(g.n, 0, 0), P(g.n, g.m, 0), P(g.n, g.m, -5), P(g.n, 0, -5)], dark(edge, 0.42));
  poly(out.base, [P(0, g.m, 0), P(g.n, g.m, 0), P(g.n, g.m, -5), P(0, g.m, -5)], dark(edge, 0.3));
  return { base: out.base, emissive: out.emissive, ...(out.frames ? { frames: out.frames as [Rects, Rects, Rects] } : {}) };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoStyles.test.ts __tests__/lib/roomArtWalls.test.ts __tests__/lib/roomSets.test.ts`
Expected: PASS. If the inside-the-room check fails for a window style's decor near the left wall's front end, the
decor overhang is 2 cells at most: clip `map(…)` results to the room box with `clipB(…, [0, 0, g.W, g.H])`.

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src/lib/room/iso/styles.ts mobile/src/lib/room/items/window.ts mobile/src/lib/room/items/sets/cottage.ts mobile/__tests__/lib/isoStyles.test.ts
git commit -m "feat(mobile): the iso room shell with every wallpaper, floor and window style, today's sky in the glass, and the loft's second window"
```

---

### Task 7: The iso engine III: the art of every placeable piece, in both facings

Spec §3.5 (Flip and Turn: two drawings with the window-side light; Flip mirrors detail, never the footprint; wall
pieces drawn per wall), §4 (still code, not images; the 54 placeable release-1 pieces, `shelf.plank`,
`lamp.welcome`, the Cottage pieces; icons stay Spec B's) and §16's art tests. Rulings 3, 4, 7, 8 (the piece cache)
and the ledger items: the iso art lookup checks the item's `iso` block (Spec A/B slot guards), and the Cottage
garland's icon shows lit bulbs (Spec B Task 11).

**Files:**
- Create: `mobile/src/lib/room/iso/art.ts`, `mobile/src/lib/room/iso/pieces/stand.ts`,
  `mobile/src/lib/room/iso/pieces/wallArt.ts`, `mobile/src/lib/room/iso/pieces/desks.ts`,
  `mobile/src/lib/room/iso/pieces/rugs.ts`, `mobile/src/lib/room/iso/pieces/extras.ts`,
  `mobile/src/lib/room/iso/index.ts`
- Modify: `mobile/src/lib/room/items/sets/cottage.ts` (the garland icon)
- Test: `mobile/__tests__/lib/isoPieces.test.ts`

**Interfaces:**
- Consumes: Task 5's `LOCAL`, `box`, `flat`, `line`, `shear`, `moveRects`, `mirrorRects`, `opaqueBounds`,
  `isoShadow`; Task 2's `isoOf`, `PlacementLayer`; Spec A/B `itemArt`, `ItemContext`, `ItemLayers`, `itemIcon`,
  `registerIcons`, `SpriteRect`, `spriteBox`, `tintOf`, `three`, `SHELF_TOP`, `glow`, `shade`, `poly`, `R`.
- Produces:
  - `art.ts`: `interface IsoArtOpts { layer: PlacementLayer; facing: 'L' | 'R'; mirror: boolean }`,
    `interface IsoPieceArt { id: ItemId; draw(ctx: ItemContext, o: IsoArtOpts): ItemLayers }`,
    `registerIsoArt(list)`, `isoArtOf(id): IsoPieceArt | undefined`, `moveLayers(l, dx, dy): ItemLayers`,
    `PIECE_CACHE_SIZE = 200`, `pieceLayers(id, ctx, o): ItemLayers | null`, `pieceCacheSize()`, `clearPieceCache()`;
  - `pieces/stand.ts`: `onDeskTop(rect): boolean`, `filterLayers(l, keep)`, `standFront(l, mirror)`,
    `standPiece(id): IsoPieceArt`;
  - `pieces/wallArt.ts`: `wallArt(id)`; `pieces/desks.ts`: `DESK_H = 22`, `deskPiece(id, wood)`;
    `pieces/rugs.ts`: `rugPiece(id)`; `pieces/extras.ts`: the plank, the lantern, the garland and their icons;
  - `iso/index.ts`: imports every piece file once (the iso engine imports it, as `draw.ts` imported `art.ts`).
  - Piece space: a floor piece's origin is its back corner (`P(x, y, 0)`); a wall piece's is its start along the wall
    at its bottom step (`P(x/2, 0, 4y)` on the right wall, `P(0, x/2, 4y)` on the left); an on-top piece's is its spot.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/isoPieces.test.ts`:

```ts
import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import { CATALOGUE, isoOf, type CatalogueItem } from '../../src/lib/room/catalogue';
import { boundsOf } from '../../src/lib/room/grid';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { clearPieceCache, isoArtOf, PIECE_CACHE_SIZE, pieceCacheSize, pieceLayers, type IsoArtOpts } from '../../src/lib/room/iso/art';
import { footOf, type PlacementLayer } from '../../src/lib/room/iso/geometry';
import '../../src/lib/room/iso';

const LIME = { ...CTX_DAY, colour: 'lime' as const, ramp: kipRamp(KIP_COLOURS.lime) };
const PLACEABLE = CATALOGUE.items.filter((i) => i.iso);
const layersOf = (item: CatalogueItem): PlacementLayer[] =>
  item.iso!.layers.flatMap((l) => (l === 'wall' ? (['wallL', 'wallR'] as const) : ([l] as const)));
const opts = (item: CatalogueItem, over: Partial<IsoArtOpts> = {}): IsoArtOpts => ({ layer: layersOf(item)[0]!, facing: 'L', mirror: false, ...over });

beforeEach(() => clearPieceCache());

it('every shipped placeable piece has iso art, 56 in all: the 54 release-1 pieces (the Cottage ones among them) and the 2 new ones (spec §4)', () => {
  expect(PLACEABLE).toHaveLength(56); // 54 release-1 placeables + shelf.plank + lamp.welcome
  for (const item of PLACEABLE) expect({ id: item.id, art: !!isoArtOf(item.id) }).toEqual({ id: item.id, art: true });
});

it('draws each declared facing on every layer it allows, day and night: whole cells, flags kept, deterministic', () => {
  for (const item of PLACEABLE) {
    for (const layer of layersOf(item)) {
      for (const facing of item.iso!.facings === 2 ? (['L', 'R'] as const) : (['L'] as const)) {
        for (const ctx of [CTX_DAY, CTX_NIGHT]) {
          const tag = { id: item.id, layer, facing, night: ctx.night };
          const l = pieceLayers(item.id, ctx, { layer, facing, mirror: false })!;
          expect({ ...tag, base: l.base!.length > 0 }).toEqual({ ...tag, base: true });
          expect({ ...tag, whole: l.base!.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger)) }).toEqual({ ...tag, whole: true });
          expect({ ...tag, glow: (l.emissive?.length ?? 0) > 0 }).toEqual({ ...tag, glow: !!item.emissive });
          expect({ ...tag, frames: l.frames?.length ?? 0 }).toEqual({ ...tag, frames: item.frames ? 3 : 0 });
          clearPieceCache();
          expect(pieceLayers(item.id, ctx, { layer, facing, mirror: false })).toEqual(l);
        }
      }
    }
  }
});

it('Flip changes the picture, never the footprint (spec §3.5)', () => {
  // The footprint can't change: footOf takes no mirror. The picture must.
  for (const id of ['desk.monitor', 'set.cottage.desk', 'plant.cactus', 'item.mug', 'lamp.amber', 'lamp.welcome', 'rug.gymmat']) {
    const item = CATALOGUE.items.find((i) => i.id === id)!;
    const a = JSON.stringify(pieceLayers(id, CTX_DAY, opts(item)));
    const b = JSON.stringify(pieceLayers(id, CTX_DAY, opts(item, { mirror: true })));
    expect({ id, differs: a !== b }).toEqual({ id, differs: true });
  }
  expect(footOf({ x: 1, y: 2, facing: 'R' }, isoOf('desk.monitor')!)).toEqual({ x0: 1, y0: 2, x1: 3, y1: 5 });
});

it('a turned piece is its own drawing, not the L one mirrored (spec §3.5)', () => {
  for (const item of PLACEABLE.filter((i) => i.iso!.facings === 2)) {
    const L = pieceLayers(item.id, CTX_DAY, opts(item))!;
    const R = pieceLayers(item.id, CTX_DAY, opts(item, { facing: 'R' }))!;
    const mirroredL = L.base!.map(([x, y, w, h, c]) => `${-x - w},${y},${w},${h},${c}`).sort().join('|');
    const r = R.base!.map(([x, y, w, h, c]) => `${x},${y},${w},${h},${c}`).sort().join('|');
    expect({ id: item.id, own: JSON.stringify(L) !== JSON.stringify(R) && r !== mirroredL }).toEqual({ id: item.id, own: true });
  }
});

it('tinted pieces follow KIP\'s colour; the others never do', () => {
  for (const item of PLACEABLE) {
    const o = opts(item);
    const follows = JSON.stringify(pieceLayers(item.id, CTX_DAY, o)) !== JSON.stringify(pieceLayers(item.id, LIME, o));
    // A desk's screen takes KIP's colour only in its dots (Spec A), not in the idle lines drawn here.
    expect({ id: item.id, follows }).toEqual({ id: item.id, follows: !!item.tint });
  }
});

it('each art piece fits the wall size the catalogue gives it (ruling 4)', () => {
  for (const item of CATALOGUE.items.filter((i) => i.slot === 'art')) {
    const b = boundsOf(itemArt(item.id)!.draw(CTX_DAY).base!)!;
    const [along, high] = item.iso!.wall!;
    expect({ id: item.id, fits: b.w <= along * 6 && b.h <= high * 4 }).toEqual({ id: item.id, fits: true });
  }
});

it('only items with an iso block get piece art: styles, worn items and unknown ids never do (ledger: slot guards)', () => {
  for (const id of ['wall.plain', 'floor.oakDark', 'win.plain', 'out.beanie', 'no.such']) expect({ id, art: isoArtOf(id) }).toEqual({ id, art: undefined });
  expect(isoOf('no.such')).toBeUndefined();
});

it('keeps at most 200 piece pictures, and a repeat is a cache hit (ruling 8)', () => {
  for (const item of PLACEABLE) for (const mirror of [false, true]) for (const ctx of [CTX_DAY, CTX_NIGHT]) pieceLayers(item.id, ctx, opts(item, { mirror }));
  expect(pieceCacheSize()).toBe(PIECE_CACHE_SIZE);
  const item = PLACEABLE[0]!;
  expect(pieceLayers(item.id, CTX_DAY, opts(item))).toBe(pieceLayers(item.id, CTX_DAY, opts(item)));
});

it('the new pieces have drawer icons, and the Cottage garland\'s icon shows lit bulbs (Spec B Task 11)', () => {
  for (const id of ['shelf.plank', 'lamp.welcome']) expect((itemIcon(id)?.length ?? 0) > 0).toBe(true);
  expect(itemIcon('set.cottage.lamp')!.some(([, , , , c]) => c === '#FDE68A')).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoPieces.test.ts`
Expected: FAIL (`iso/art.ts` and the piece files missing).

- [ ] **Step 3: The registry and cache, `mobile/src/lib/room/iso/art.ts`**

```ts
// The iso art of every placeable piece (spec 2026-10-15 §4): one draw function per item, in the piece's own space,
// for a layer, a facing and a mirror. isoArtOf answers only for an item whose catalogue row has an iso block (the
// Spec A / B slot guards, ledger), so a style, a worn item or a newer server's id is never drawn as a piece. Each
// piece's rects are cached (an LRU of PIECE_CACHE_SIZE, plan ruling 8): a drop rebuilds the room from cached rects.
import { catalogueItem } from '../catalogue';
import type { ItemContext, ItemLayers } from '../items';
import type { ItemId } from '../loadout';
import type { Rects } from '../paint';
import type { PlacementLayer } from './geometry';
import { moveRects } from './prims';

export interface IsoArtOpts {
  layer: PlacementLayer;
  facing: 'L' | 'R';
  mirror: boolean;
}

export interface IsoPieceArt {
  id: ItemId;
  draw(ctx: ItemContext, o: IsoArtOpts): ItemLayers;
}

const ART = new Map<ItemId, IsoPieceArt>();

export function registerIsoArt(list: readonly IsoPieceArt[]): void {
  for (const a of list) ART.set(a.id, a);
}

export function isoArtOf(id: ItemId | null | undefined): IsoPieceArt | undefined {
  return id && catalogueItem(id)?.iso ? ART.get(id) : undefined;
}

export function moveLayers(l: ItemLayers, dx: number, dy: number): ItemLayers {
  const m = (rs: Rects) => moveRects(rs, dx, dy);
  return {
    ...(l.base ? { base: m(l.base) } : {}),
    ...(l.emissive ? { emissive: m(l.emissive) } : {}),
    ...(l.frames ? { frames: l.frames.map(m) as [Rects, Rects, Rects] } : {}),
  };
}

export const PIECE_CACHE_SIZE = 200;
const CACHE = new Map<string, ItemLayers>();

/** A piece's layers in its own space, or null when this build has no iso art for it. Glows and loops only for flagged items. */
export function pieceLayers(id: ItemId, ctx: ItemContext, o: IsoArtOpts): ItemLayers | null {
  const art = isoArtOf(id);
  if (!art) return null;
  const key = [id, o.layer, o.facing, o.mirror ? 1 : 0, ctx.night ? 'n' : 'd', ctx.colour, ctx.screen].join('|');
  const hit = CACHE.get(key);
  if (hit) {
    CACHE.delete(key);
    CACHE.set(key, hit);
    return hit;
  }
  const item = catalogueItem(id)!;
  const drawn = art.draw(ctx, o);
  const layers: ItemLayers = {
    base: drawn.base ?? [],
    ...(item.emissive && drawn.emissive ? { emissive: drawn.emissive } : {}),
    ...(item.frames && drawn.frames ? { frames: drawn.frames } : {}),
  };
  CACHE.set(key, layers);
  if (CACHE.size > PIECE_CACHE_SIZE) CACHE.delete(CACHE.keys().next().value!);
  return layers;
}

export function pieceCacheSize(): number {
  return CACHE.size;
}
export function clearPieceCache(): void {
  CACHE.clear();
}
```

- [ ] **Step 4: Billboards, `mobile/src/lib/room/iso/pieces/stand.ts`**

```ts
// The boards' small pieces stood in the iso room (plan ruling 3; isox.py `spr_at` and `plant`): the front-on sprite
// with its own contact shadow, glows and loops, its opaque bottom centre on the tile centre or the spot. Front-on
// furniture the iso room draws itself (the shelf plank) is left out.
import { catalogueItem, CATALOGUE } from '../../catalogue';
import type { RoomRect } from '../../grid';
import { itemArt, type ItemLayers } from '../../items';
import { SHELF_TOP } from '../../items/shared';
import type { Rects } from '../../paint';
import { moveLayers, registerIsoArt, type IsoArtOpts, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { mirrorRects, moveRects, opaqueBounds } from '../prims';

type Keep = (q: RoomRect) => boolean;
const DESK_TOP = 72;
/** What stands on a front-on desk: above its top, between its left edge and KIP's chair (Spec A's furniture left out). */
export const onDeskTop: Keep = ([x, y, w, h]) => y + h <= DESK_TOP && x >= 62 && x + w <= 112;
/** Shelf pieces stand on Spec A's plank (top at SHELF_TOP); the iso room has its own planks. */
const KEEP: Partial<Record<string, Keep>> = { shelf: ([, y, , h]) => y + h <= SHELF_TOP };

export function filterLayers(l: ItemLayers, keep: Keep): ItemLayers {
  return {
    ...(l.base ? { base: l.base.filter(keep) } : {}),
    ...(l.emissive ? { emissive: l.emissive } : {}),
    ...(l.frames ? { frames: l.frames.map((f) => f.filter(keep)) as [Rects, Rects, Rects] } : {}),
  };
}

/** A front-on picture moved so its opaque bottom centre is at (0, 0), mirrored about that centre for Flip. */
export function standFront(l: ItemLayers, mirror: boolean): ItemLayers {
  const b = opaqueBounds(l.base ?? []);
  if (!b) return {};
  const cx = Math.round(b.x + b.w / 2);
  const foot = b.y + b.h;
  const t = (rs: Rects) => { const m = moveRects(rs, -cx, -foot); return mirror ? mirrorRects(m, 0) : m; };
  return {
    base: t(l.base ?? []),
    ...(l.emissive ? { emissive: t(l.emissive) } : {}),
    ...(l.frames ? { frames: l.frames.map(t) as [Rects, Rects, Rects] } : {}),
  };
}

/** A billboard stands on its footprint's centre on the floor, on the spot itself on a surface. */
function standAt(o: IsoArtOpts, foot: readonly [number, number]): [number, number] {
  if (o.layer !== 'floor') return [0, 0];
  const [w, d] = o.facing === 'R' ? [foot[1], foot[0]] : foot;
  return LOCAL(w / 2, d / 2);
}

export function standPiece(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const art = itemArt(id);
      const item = catalogueItem(id);
      if (!art || !item?.iso) return {};
      const keep = KEEP[item.slot];
      const front = keep ? filterLayers(art.draw(ctx), keep) : art.draw(ctx);
      const [dx, dy] = standAt(o, item.iso.foot ?? [1, 1]);
      return moveLayers(standFront(front, o.mirror), dx, dy);
    },
  };
}

const BILLBOARD_SLOTS: ReadonlySet<string> = new Set(['shelf', 'desk_item', 'plant', 'lamp', 'corner', 'pet']);
/** Drawn their own way (extras.ts). */
const OWN_ART: ReadonlySet<string> = new Set(['shelf.plank', 'lamp.welcome', 'set.cottage.lamp']);
registerIsoArt(CATALOGUE.items.filter((i) => i.iso && BILLBOARD_SLOTS.has(i.slot) && !OWN_ART.has(i.id)).map((i) => standPiece(i.id)));
```

- [ ] **Step 5: Wall art, `mobile/src/lib/room/iso/pieces/wallArt.ts`**

```ts
// Art on a wall (plan ruling 4): the front-on piece (its pin and wall shadow included) centred in its wall span and
// sheared onto the wall, slope +1 on the right wall, -1 on the left (iso.py `wall_art`). Flip mirrors it first.
import { CATALOGUE, isoOf } from '../../catalogue';
import { boundsOf } from '../../grid';
import { itemArt } from '../../items';
import type { Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import { mirrorRects, moveRects, shear } from '../prims';

export function wallArt(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const art = itemArt(id);
      const wall = isoOf(id)?.wall;
      if (!art || !wall) return {};
      const l = art.draw(ctx);
      const b = boundsOf(l.base ?? []);
      if (!b) return {};
      const across = wall[0] * 6;
      const dx = Math.floor((across - b.w) / 2);
      const t = (rs: Rects) => {
        let m = moveRects(rs, dx - b.x, -(b.y + b.h));
        if (o.mirror) m = mirrorRects(m, across / 2);
        // The left wall's screen-left end is the piece's far end along j: LOCAL(0, wall/2) = (-across, across/2).
        return o.layer === 'wallL' ? shear(m, -across, across / 2, -1) : shear(m, 0, 0, 1);
      };
      return {
        base: t(l.base ?? []),
        ...(l.emissive ? { emissive: t(l.emissive) } : {}),
        ...(l.frames ? { frames: l.frames.map(t) as [Rects, Rects, Rects] } : {}),
      };
    },
  };
}

registerIsoArt(CATALOGUE.items.filter((i) => i.slot === 'art' && i.iso).map((i) => wallArt(i.id)));
```

- [ ] **Step 6: Desks, `mobile/src/lib/room/iso/pieces/desks.ts`**

```ts
// KIP's desks (spec 2026-10-15 §2.1, §3.5, §3.6): a 3 × 2 piece, the desk along its back row and KIP's chair on the
// seat tile (1, 1), drawn with real boxes for each facing so the window-side light stays right when turned. What
// stands on the front-on desk (the monitor, the laptop, the notebook, the Cottage typewriter, with their screens'
// loops and glows) stands on the iso desk top. Flip moves the drawer unit and mirrors what stands on top.
import { CATALOGUE } from '../../catalogue';
import { itemArt } from '../../items';
import type { Rects } from '../../paint';
import { moveLayers, registerIsoArt, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { box, dark, isoShadow } from '../prims';
import { filterLayers, onDeskTop, standFront } from './stand';

export const DESK_H = 22;
export interface Wood { top: string; leg: string; chair: string; seat: string }
const SPEC_A: Wood = { top: '#9A7350', leg: '#7C5A3E', chair: '#3F4656', seat: '#475569' };
const OAK: Wood = { top: '#C19A6B', leg: '#8A6542', chair: '#8A6542', seat: '#B88A5A' };

export function deskPiece(id: string, wood: Wood): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const r: Rects = [];
      const turned = o.facing === 'R';
      // a runs along the desk (3 tiles), b from its back to the chair's front (2 tiles); Flip mirrors a.
      const A = (a: number, da: number) => (o.mirror ? 3 - a - da : a);
      const B = (a: number, b: number, z: number, da: number, db: number, h: number, top: string, left?: string, right?: string) => {
        const a0 = A(a, da);
        if (turned) box(r, LOCAL, b, a0, z, db, da, h, top, left, right);
        else box(r, LOCAL, a0, b, z, da, db, h, top, left, right);
      };
      const at = (a: number, b: number, z: number) => (turned ? LOCAL(b, A(a, 0), z) : LOCAL(A(a, 0), b, z));
      if (turned) isoShadow(r, LOCAL, 0, 0, 1, 3, 0.18);
      else isoShadow(r, LOCAL, 0, 0, 3, 1, 0.18);
      // Back legs, the drawer unit at one end (Flip moves it), then the front leg at the other end.
      B(0.1, 0.1, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(2.75, 0.1, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(2.2, 0.12, 0, 0.7, 0.8, DESK_H - 3, wood.leg);
      B(0.1, 0.75, 0, 0.15, 0.15, DESK_H - 3, dark(wood.leg, 0.15));
      B(0, 0.05, DESK_H - 3, 3, 0.95, 3, wood.top);
      const art = itemArt(id);
      const top = art ? standFront(filterLayers(art.draw(ctx), onDeskTop), o.mirror) : {};
      const [tx, ty] = at(1.5, 0.3, DESK_H);
      const onTop = moveLayers(top, tx, ty);
      r.push(...(onTop.base ?? []));
      // KIP's chair on the seat tile, its back toward you (KIP faces the desk while thinking, spec §3.6).
      isoShadow(r, LOCAL, 1, 1, 1, 1, 0.16); // the seat tile is (1, 1) for both facings and under Flip
      B(1.42, 1.42, 0, 0.16, 0.16, 8, '#1F2937');
      B(1.1, 1.1, 8, 0.8, 0.8, 3, wood.seat);
      B(1.1, 1.78, 11, 0.8, 0.12, 14, wood.chair);
      return { base: r, ...(onTop.emissive ? { emissive: onTop.emissive } : {}), ...(onTop.frames ? { frames: onTop.frames } : {}) };
    },
  };
}

registerIsoArt(CATALOGUE.items.filter((i) => i.iso?.kipDesk && itemArt(i.id)).map((i) => deskPiece(i.id, i.id === 'set.cottage.desk' ? OAK : SPEC_A)));
```

- [ ] **Step 7: Rugs, `mobile/src/lib/room/iso/pieces/rugs.ts`**

```ts
// Rugs (spec 2026-10-15 §3.2, §3.5): flat, under everything. A base rug's board pattern (its 60 × 7 icon) is laid
// over its footprint, the long axis along i facing L and along j facing R; Flip mirrors the pattern. The Cottage
// quilt is drawn as its 8 × 2 patchwork.
import { CATALOGUE, isoOf } from '../../catalogue';
import { itemIcon } from '../../icons';
import { spriteBox, tintOf } from '../../items/shared';
import type { Rects } from '../../paint';
import { registerIsoArt, type IsoArtOpts, type IsoPieceArt } from '../art';
import { LOCAL } from '../grid';
import { flat } from '../prims';

/** A patch at (u0..u1 along the rug, v0..v1 across), in fractions of the footprint. */
function patch(r: Rects, o: IsoArtOpts, foot: readonly [number, number], u0: number, u1: number, v0: number, v1: number, c: string): void {
  const [w, d] = foot;
  const [a0, a1] = o.mirror ? [1 - u1, 1 - u0] : [u0, u1];
  if (o.facing === 'L') flat(r, LOCAL, a0 * w, v0 * d, (a1 - a0) * w, (v1 - v0) * d, c);
  else flat(r, LOCAL, v0 * d, a0 * w, (v1 - v0) * d, (a1 - a0) * w, c);
}

export function rugPiece(id: string): IsoPieceArt {
  return {
    id,
    draw: (ctx, o) => {
      const icon = itemIcon(id);
      const foot = isoOf(id)?.foot;
      if (!icon || !foot) return {};
      const b = spriteBox(icon);
      const r: Rects = [];
      for (const [x, y, w, h, c] of icon) patch(r, o, foot, (x - b.x) / b.w, (x + w - b.x) / b.w, (y - b.y) / b.h, (y + h - b.y) / b.h, tintOf(c, ctx.ramp));
      return { base: r };
    },
  };
}

const QUILT = ['#E8A0A0', '#8BA77A', '#F5D58A', '#93C5FD'];
const cottageRug: IsoPieceArt = {
  id: 'set.cottage.rug',
  draw: (_ctx, o) => {
    const foot = isoOf('set.cottage.rug')!.foot!;
    const r: Rects = [];
    patch(r, o, foot, 0, 1, 0, 1, '#F5F1E6');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      patch(r, o, foot, (i + 0.08) / 8, (i + 0.92) / 8, j * 0.5 + 0.06, j * 0.5 + 0.44, QUILT[(i + j * 2) % 4]!);
    }
    return { base: r };
  },
};

registerIsoArt([...CATALOGUE.items.filter((i) => i.slot === 'rug' && i.id !== 'set.cottage.rug').map((i) => rugPiece(i.id)), cottageRug]);
```

- [ ] **Step 8: The new pieces, `mobile/src/lib/room/iso/pieces/extras.ts`**

```ts
// Free-build P1's own pieces (spec 2026-10-15 §2.1, C7): the wall plank, the welcome lantern (two facings: its lit
// pane faces the lower left or the lower right; Flip moves its ring), and the Cottage fairy lights as a garland on
// the wall (plan ruling 7).
import { registerIcons, type SpriteRect } from '../../icons';
import { three } from '../../items/shared';
import { glow, poly, R, shade, type Rects } from '../../paint';
import { registerIsoArt, type IsoPieceArt } from '../art';
import { LOCAL, type Proj } from '../grid';
import { box, line } from '../prims';

const plank: IsoPieceArt = {
  id: 'shelf.plank',
  draw: (_ctx, o) => {
    const r: Rects = [];
    if (o.layer === 'wallL') box(r, LOCAL, 0, 0, 0, 0.35, 2, 2, '#5B4636', '#4A382B', '#3A2D23');
    else box(r, LOCAL, 0, 0, 0, 2, 0.35, 2, '#5B4636', '#4A382B', '#3A2D23');
    return { base: r };
  },
};

const lantern: IsoPieceArt = {
  id: 'lamp.welcome',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const [cx, cy] = o.layer === 'floor' ? LOCAL(0.5, 0.5) : [0, 0];
    const C: Proj = (i, j, z = 0) => { const [x, y] = LOCAL(i, j, z); return [x + cx, y + cy]; };
    if (o.layer === 'floor') shade(r, cx, cy, 7, 3, 0.22);
    box(r, C, -0.2, -0.2, 0, 0.4, 0.4, 2, '#44403C');
    box(r, C, -0.16, -0.16, 2, 0.32, 0.32, 9, '#57534E');
    box(r, C, -0.22, -0.22, 11, 0.44, 0.44, 2, '#44403C');
    const pane = o.facing === 'L'
      ? [C(-0.11, 0.16, 4), C(0.11, 0.16, 4), C(0.11, 0.16, 10), C(-0.11, 0.16, 10)]
      : [C(0.16, -0.11, 4), C(0.16, 0.11, 4), C(0.16, 0.11, 10), C(0.16, -0.11, 10)];
    poly(r, pane, '#B45309');
    poly(em, pane, ctx.night ? '#FEF3C7' : '#F59E0B');
    const [hx, hy] = C(0, 0, 13);
    const side = o.mirror ? 2 : -3;
    R(r, Math.round(hx) + side, Math.round(hy) - 3, 1, 3, '#44403C');
    R(r, Math.round(hx) - 1, Math.round(hy) - 4, 3, 1, '#44403C');
    glow(em, cx, cy - 8, ctx.night ? 16 : 8, ctx.night ? 10 : 5, '253,224,71', ctx.night ? 0.08 : 0.04);
    return { base: r, emissive: em };
  },
};

const garland: IsoPieceArt = {
  id: 'set.cottage.lamp',
  draw: (ctx, o) => {
    const r: Rects = [];
    const em: Rects = [];
    const W = (a: number, z: number) => (o.layer === 'wallL' ? LOCAL(0.05, a, z) : LOCAL(a, 0.05, z));
    const N = 16;
    const bulbs = Array.from({ length: N + 1 }, (_, k) => W((k / N) * 4, 7 - 3 * Math.sin((k / N) * Math.PI * 2) ** 2));
    for (let k = 0; k < N; k++) line(r, bulbs[k]!, bulbs[k + 1]!, '#4A4340');
    for (const [x, y] of bulbs) glow(em, x, y + 1, ctx.night ? 4 : 2, ctx.night ? 3 : 2, '253,224,150', ctx.night ? 0.06 : 0.03);
    const frames = three((f) => {
      const fr: Rects = [];
      bulbs.forEach(([x, y], i) => {
        const lit = (i + f) % 4 !== 0;
        R(fr, Math.round(x), Math.round(y) + 1, 1, 1, lit ? '#FDE68A' : '#B59A55');
        if (lit && ctx.night) R(fr, Math.round(x) - 1, Math.round(y), 3, 3, 'rgba(253,230,138,0.18)');
      });
      return fr;
    });
    return { base: r, emissive: em, frames };
  },
};

registerIsoArt([plank, lantern, garland]);

/** A sprite from rows of palette letters ('.' is empty), one rect per run. */
function rows(lines: readonly string[], pal: Readonly<Record<string, string>>): SpriteRect[] {
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

// isox.py's XS lantern, and a plank with two brackets.
registerIcons({
  'lamp.welcome': rows(['..k..', '.kkk.', 'kyyyk', 'kyYyk', 'kyyyk', 'kyyyk', '.kkk.'], { k: '#44403C', y: '#F59E0B', Y: '#FEF3C7' }),
  'shelf.plank': rows(['wwwwwwwwwwwwwwww', 'dddddddddddddddd', '..b..........b..', '..b..........b..'], { w: '#7C5A3E', d: '#5B4636', b: '#3A2D23' }),
});
```

`mobile/src/lib/room/iso/index.ts`:

```ts
// Registers every piece's iso art (spec 2026-10-15 §4). The engine (room.ts) imports this once. The front-on art
// is registered first: billboards, wall art and desk tops are drawn from it.
import '../art';
import './pieces/stand';
import './pieces/wallArt';
import './pieces/desks';
import './pieces/rugs';
import './pieces/extras';
```

In `mobile/src/lib/room/items/sets/cottage.ts` the icon line becomes:

```ts
// Each piece's tray icon is its own clear-day picture; the garland's shows its lit bulbs (Spec B Task 11 minor).
registerIcons(Object.fromEntries(PIECES.map((p) => {
  const l = p.draw(DAY);
  return [p.id, [...(l.base ?? []), ...(p.id === 'set.cottage.lamp' ? l.frames?.[0] ?? [] : [])] as SpriteRect[]];
})));
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoPieces.test.ts __tests__/lib/roomSets.test.ts`
Expected: PASS. If the turned-drawing check fails for a rug whose pattern is symmetric along both axes (the woven
rug), the R drawing differs from the mirrored L one by its footprint shape, which the check compares; only a 1 × 1
two-facing piece could fail it, and none ships.

- [ ] **Step 10: Bundle size, full mobile suite, typecheck, commit**

In `mobile/scripts/room-art-size.mjs` change the entry point to `src/lib/room/iso/index.ts`, `LIMIT` to
`300 * 1024`, and the message to `room art (front-on sprites and iso pieces)`; update its header comment to cite
spec 2026-10-15 §4. Run `node scripts/room-art-size.mjs` and record the size in the ledger (expected well under
300 KB). Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src/lib/room/iso mobile/src/lib/room/items/sets/cottage.ts mobile/scripts/room-art-size.mjs mobile/__tests__/lib/isoPieces.test.ts
git commit -m "feat(mobile): iso art for every placeable piece in both facings: billboards, wall art, desks with KIP's chair, rugs, the plank, the welcome lantern and the Cottage garland"
```

---

### Task 8: The iso engine IV: the room picture (depth order, KIP, light, frames), crops on the desk, layout helpers, perf

Spec §3.3 (children after their parent, carried with it), §3.4 (the draw order: shell, wall pieces left then right,
flats, floor pieces and their children, light, emissive, loops; KIP inserted at its tile), §3.6 (KIP at the desk's
seat), §3.7 (two pictures, light carried over, loops above the veil; the budget, measured), §9.1 (the crop on the
desk; the thumbnail follows it) and §16's engine tests. Rulings 8 and 9.

**Files:**
- Create: `mobile/src/lib/room/iso/room.ts`, `mobile/src/lib/room/iso/crop.ts`, `mobile/src/lib/room/layout.ts`
- Modify: `mobile/src/lib/room/draw.ts` (KIP's layer moves to `iso/room.ts`; `draw.ts` re-exports it until Task 10
  deletes the file), `mobile/src/lib/room/weather.ts` (export `DAYLIGHT`)
- Test: `mobile/__tests__/lib/isoRoom.test.ts`, `mobile/__tests__/lib/roomLayout.test.ts`,
  `mobile/__tests__/perf/isoBuild.test.ts`

**Interfaces:**
- Consumes: Tasks 5–7 (`isoGrid`, `projOf`, `depthOrder`, `drawShell`, `windowsFor`, `pieceLayers`, `IsoArtOpts`,
  `moveRects`, `opaqueBounds`), Task 2 (`footOf`, `seatTile`, `parseLayout`, `Placement`, `RoomLayout`, `Tier`,
  `isoOf`, `CATALOGUE.starterLayout`), Spec A (`kipGrid`, `mirrorGrid`, `KIP_GRID`, `kipRamp`, `KIP_COLOURS`,
  `NIGHT_VEIL`, `wornKey`).
- Produces:
  - `lib/room/layout.ts`: `starterLayout(): RoomLayout`, `readLayout(value: unknown): RoomLayout`,
    `placedCounts(layout)`, `inventoryOf(counts, layout): Record<ItemId, number>`, `childrenOf(layout, id): Placement[]`,
    `deskOf(layout): Placement | undefined`, `layoutKey(layout): string`, `newPieceId(layout): string`;
  - `iso/room.ts`: `KIP_CELLS = 2`, `interface KipSeat { x; y; deskSide: 'left' | 'right'; style: SeatStyle }`,
    `interface RoomKip`, `drawKipLayer(kip, seat): Rects`, `kipLayerKey(kip): string` (moved from `draw.ts`),
    `interface IsoStaticInput { layout; tier; weather; night; colour; hide?: string | null }`,
    `interface PlacedPiece { p: Placement; at: [number, number]; o: IsoArtOpts }`, `interface PieceHit { id: string; box: Box; rects: Rects }`,
    `interface IsoStatic { grid; back; front; light; emissive; shellFrames; behind: PlacedPiece[]; ahead: PlacedPiece[]; hits: PieceHit[]; kipSeat: KipSeat; focus: Box; thumb: Box }`,
    `spotPoint(parent, parentIso, spot): [i, j, z]`, `anchorOf(g, p, byId): [number, number] | null`,
    `drawIsoStatic(input): IsoStatic`, `drawIsoFrames(s, ctx: { night; colour; screen }, kip: Rects): [Rects, Rects, Rects]`,
    `clipOut(rects, kip): Rects`, `isoRoomKey(input): string`, `pieceAt(hits, x, y): string | null`;
  - `iso/crop.ts`: `deskBoxes(g, layout): { focus: Box; thumb: Box }`,
    `isoCrop({ width, height, cellPt, box, room: { W, H } }): { x: number; y: number }`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/roomLayout.test.ts`:

```ts
import { CATALOGUE } from '../../src/lib/room/catalogue';
import { childrenOf, deskOf, inventoryOf, layoutKey, newPieceId, placedCounts, readLayout, starterLayout } from '../../src/lib/room/layout';

it('the starter layout is a fresh copy of the server\'s', () => {
  const a = starterLayout();
  a.pieces.pop();
  expect(starterLayout()).toEqual(CATALOGUE.starterLayout);
});

it('reads a layout, or the starter one when the value is not a layout', () => {
  expect(readLayout(CATALOGUE.starterLayout)).toEqual(CATALOGUE.starterLayout);
  expect(readLayout({ v: 2 })).toEqual(CATALOGUE.starterLayout);
});

it('counts placed copies and what is left in the inventory, never below zero', () => {
  const l = starterLayout();
  expect(placedCounts(l)['plant.fern']).toBe(1);
  expect(inventoryOf({ 'plant.fern': 3, 'plant.cactus': 1, 'rug.slate': 1 }, l)).toEqual({ 'plant.fern': 2, 'plant.cactus': 1, 'rug.slate': 0 });
});

it('finds the desk and its children in spot order', () => {
  const l = starterLayout();
  expect(deskOf(l)!.id).toBe('desk');
  expect(childrenOf(l, 'desk').map((p) => p.id)).toEqual(['lamp', 'deskitem']);
});

it('makes the lowest unused p-id, and keys a layout by its content, not its order', () => {
  const l = starterLayout();
  expect(newPieceId(l)).toBe('p1');
  const withP1 = { ...l, pieces: [...l.pieces, { ...l.pieces[0]!, id: 'p1' }] };
  expect(newPieceId(withP1)).toBe('p2');
  expect(layoutKey({ ...l, pieces: [...l.pieces].reverse() })).toBe(layoutKey(l));
  expect(layoutKey({ ...l, pieces: l.pieces.map((p) => (p.id === 'plant' ? { ...p, mirror: true } : p)) })).not.toBe(layoutKey(l));
});
```

`mobile/__tests__/lib/isoRoom.test.ts`:

```ts
import { CATALOGUE, catalogueSet } from '../../src/lib/room/catalogue';
import { boxContains } from '../../src/lib/room/grid';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';
import { isoCrop, deskBoxes } from '../../src/lib/room/iso/crop';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { clipOut, drawIsoFrames, drawIsoStatic, drawKipLayer, isoRoomKey, pieceAt, type IsoStaticInput } from '../../src/lib/room/iso/room';
import { NIGHT_VEIL } from '../../src/lib/room/weather';

const KIP = { colour: 'coral' as const, pose: 'rest' as const, mood: 'idle' as const, worn: EMPTY_WORN };
const input = (layout: RoomLayout = starterLayout(), over: Partial<IsoStaticInput> = {}): IsoStaticInput =>
  ({ layout, tier: 1, weather: 'clear', night: false, colour: 'coral', ...over });
const with_ = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
/** Spec B's full slot room converted (every slot filled), as the server would send it. */
const CONVERTED: RoomLayout = {
  ...starterLayout(),
  pieces: [...starterLayout().pieces, { id: 'art', item: 'art.mountain', layer: 'wallR', x: 2, y: 9, facing: 'L', mirror: false }, at('corner', 'corner.floorlamp', 5, 0), at('pet', 'pet.bed', 4, 5)],
};

describe('drawIsoStatic (spec §3.4, §3.6)', () => {
  it('seats KIP on the desk\'s seat tile, facing the desk on its right', () => {
    const s = drawIsoStatic(input());
    // The seat tile (3, 1): centre P(3.5, 1.5) = (86 + 24, 68 + 30); KIP's 32-cell grid stands on it.
    expect(s.kipSeat).toEqual({ x: 110 - 16, y: 98 - 30, deskSide: 'right', style: 'standard' });
  });

  it('draws children right after their parent, and the desk before KIP', () => {
    const s = drawIsoStatic(input());
    const ids = s.behind.map((b) => b.p.id);
    expect(ids.indexOf('lamp')).toBe(ids.indexOf('desk') + 1);
    expect(ids.indexOf('deskitem')).toBe(ids.indexOf('desk') + 2);
    expect(ids).toEqual(expect.arrayContaining(['plank', 'shelf', 'rug', 'plant', 'desk']));
  });

  it('puts a piece in front of KIP in the front picture, so it hides KIP\'s legs (spec §3.4 movers)', () => {
    const s = drawIsoStatic(input(with_(at('bag', 'corner.beanbag', 3, 3))));
    expect(s.ahead.map((a) => a.p.id)).toEqual(['bag']);
    expect(s.front.length).toBeGreaterThan(0);
  });

  it('a lifted piece and its children are left out; KIP stays at the desk\'s seat', () => {
    const s = drawIsoStatic(input(starterLayout(), { hide: 'desk' }));
    expect(s.behind.map((b) => b.p.id)).not.toEqual(expect.arrayContaining(['desk', 'lamp', 'deskitem']));
    expect(s.kipSeat).toEqual(drawIsoStatic(input()).kipSeat);
  });

  it('skips an item this build cannot draw (a newer server) without throwing', () => {
    expect(() => drawIsoStatic(input(with_(at('x', 'plant.fromTheFuture', 6, 6))))).not.toThrow();
  });

  it('day: daylight through each window; night: the veil over the whole room (Spec A lighting)', () => {
    const g = isoGrid(1);
    expect(drawIsoStatic(input(starterLayout(), { night: true })).light).toEqual([[0, 0, g.W, g.H, NIGHT_VEIL]]);
    const day1 = drawIsoStatic(input()).light.length;
    const day3 = drawIsoStatic(input(starterLayout(), { tier: 3 })).light.length;
    expect(day1).toBeGreaterThan(0);
    expect(day3).toBeGreaterThan(day1);
  });

  it('keeps its rect counts per layer: starter, converted and Cottage rooms, day and night, at each tier', () => {
    const counts: Record<string, number[]> = {};
    for (const [name, layout] of [['starter', starterLayout()], ['converted', CONVERTED], ['cottage', catalogueSet('cottage')!.layout]] as const) {
      for (const tier of [1, 2, 3] as const) for (const night of [false, true]) {
        const s = drawIsoStatic(input(layout, { tier, night }));
        counts[`${name}/${tier}/${night ? 'night' : 'day'}`] = [s.back.length, s.front.length, s.light.length, s.emissive.length];
        expect(drawIsoStatic(input(layout, { tier, night }))).toEqual(s);
      }
    }
    expect(counts).toMatchSnapshot();
  });

  it('finds the topmost piece under a point (taps in the editor)', () => {
    const s = drawIsoStatic(input());
    const fern = s.hits.find((h) => h.id === 'plant')!;
    const [x, y] = fern.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!; // its top leaf
    expect(pieceAt(s.hits, x, y)).toBe('plant');
    expect(pieceAt(s.hits, 0, 0)).toBeNull();
  });

  it('keys the static picture by the layout\'s content and the light, not by object identity', () => {
    expect(isoRoomKey(input())).toBe(isoRoomKey(input(starterLayout())));
    expect(isoRoomKey(input(starterLayout(), { night: true }))).not.toBe(isoRoomKey(input()));
  });
});

describe('loop frames (spec §3.7, ruling 8)', () => {
  it('a screen loop behind KIP never paints over KIP', () => {
    const s = drawIsoStatic(input(starterLayout(), { night: true }));
    const kip = drawKipLayer(KIP, s.kipSeat);
    const cells = new Set<string>();
    for (const [x, y, w, h] of kip) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.add(`${x + i},${y + j}`);
    const frames = drawIsoFrames(s, { night: true, colour: 'coral', screen: 'dots' }, kip);
    expect(frames.every((f) => f.length > 0)).toBe(true);
    for (const f of frames) for (const [x, y, w, h] of f) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) expect(cells.has(`${x + i},${y + j}`)).toBe(false);
  });

  it('clipOut removes exactly the covered cells', () => {
    expect(clipOut([[0, 0, 4, 1, '#a']], [[1, 0, 2, 1, '#k']])).toEqual([[0, 0, 1, 1, '#a'], [3, 0, 1, 1, '#a']]);
  });
});

describe('crops on the desk (spec §9.1)', () => {
  it('the 140 × 120 focus box and the 96 × 60 thumbnail follow the desk', () => {
    const g = isoGrid(1);
    const a = deskBoxes(g, starterLayout());
    const moved = deskBoxes(g, { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'desk' ? { ...p, x: 0, y: 4 } : p)) });
    expect([a.focus.w, a.focus.h, a.thumb.w, a.thumb.h]).toEqual([140, 120, 96, 60]);
    expect(moved.focus.x).toBeLessThan(a.focus.x);
    expect(boxContains({ x: 0, y: 0, w: g.W, h: g.H }, { ...a.thumb, x: Math.max(0, a.thumb.x) })).toBe(true);
  });

  it('crops, never shrinks: the room is clamped so its edges never show; a wider view shows more room', () => {
    const g = isoGrid(1);
    const box = deskBoxes(g, starterLayout()).focus;
    const o = isoCrop({ width: 330, height: 240, cellPt: 2, box, room: g });
    expect(o.x).toBeLessThanOrEqual(0);
    expect(o.x).toBeGreaterThanOrEqual(330 - g.W * 2);
    expect(isoCrop({ width: 400, height: 400, cellPt: 2, box, room: g })).toEqual({ x: 28, y: 40 });
  });
});
```

`mobile/__tests__/perf/isoBuild.test.ts`:

```ts
import { performance } from 'perf_hooks';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { clearPieceCache } from '../../src/lib/room/iso/art';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { drawIsoFrames, drawIsoStatic, drawKipLayer } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';

// Spec 2026-10-15 §3.7 budget, for a full 9 × 9 room of 90 pieces at night: every piece picture cold, the rebuild
// after a drop, and one frame's compose. On-device targets are checked by hand (Task 16); this measures the pure build
// in Node and logs it (run with ROOM_PERF=1). A measurement, not a gate (Spec B ruling P32). Never logs user data.
const run = process.env.ROOM_PERF === '1' ? describe : describe.skip;

function fullRoom(): RoomLayout {
  const FLOOR = ['plant.fern', 'plant.cactus', 'corner.floorlamp', 'corner.beanbag', 'pet.bed', 'plant.monstera'];
  const pieces: Placement[] = starterLayout().pieces.filter((p) => p.id === 'desk' || p.parent === 'desk');
  let k = 0;
  for (let x = 0; x < 9 && pieces.length < 78; x++) for (let y = 0; y < 9 && pieces.length < 78; y++) {
    if ((x >= 2 && x < 5 && y < 2) || (x === 3 && y === 2)) continue;
    pieces.push({ id: `f${k}`, item: FLOOR[k++ % FLOOR.length]!, layer: 'floor', x, y, facing: 'L', mirror: false });
  }
  for (let a = 0; pieces.length < 90; a++) pieces.push({ id: `w${a}`, item: 'art.heart', layer: a % 2 ? 'wallL' : 'wallR', x: 3 * Math.floor(a / 2), y: 0, facing: 'L', mirror: false });
  return { ...starterLayout(), pieces };
}

const median = (f: () => void, n = 30) => {
  const t: number[] = [];
  for (let i = 0; i < n; i++) { const a = performance.now(); f(); t.push(performance.now() - a); }
  t.sort((a, b) => a - b);
  return Number(t[Math.floor(n / 2)]!.toFixed(2));
};

run('iso room build time', () => {
  it('cold, after a drop, and one frame at night', () => {
    const layout = fullRoom();
    const input = { layout, tier: 3 as const, weather: 'stormy' as const, night: true, colour: 'coral' as const };
    const cold = median(() => { clearPieceCache(); drawIsoStatic(input); });
    const rebuild = median(() => drawIsoStatic({ ...input, hide: null }));
    const s = drawIsoStatic(input);
    const kip = drawKipLayer({ colour: 'coral', pose: 'type', mood: 'idle', worn: EMPTY_WORN }, s.kipSeat);
    const frame = median(() => drawIsoFrames(s, { night: true, colour: 'coral', screen: 'dots' }, kip));
    console.info(JSON.stringify({ event: 'room.iso.build', pieces: layout.pieces.length, coldMs: cold, rebuildMs: rebuild, frameMs: frame }));
    expect(layout.pieces).toHaveLength(90);
    for (const ms of [cold, rebuild, frame]) expect(Number.isFinite(ms) && ms > 0).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoRoom.test.ts __tests__/lib/roomLayout.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: `mobile/src/lib/room/layout.ts`**

```ts
// The free-build layout on the app's side (spec 2026-10-15 §2.2, §2.3): the starter layout, reading a stored one,
// counts and the inventory ("×n" in the drawer), children, the desk, stable keys and new instance ids.
import { CATALOGUE, isoOf } from './catalogue';
import type { ItemId } from './loadout';
import { parseLayout, type Placement, type RoomLayout } from './iso/geometry';

export function starterLayout(): RoomLayout {
  return JSON.parse(JSON.stringify(CATALOGUE.starterLayout)) as RoomLayout;
}

/** A layout from the server, or the starter one when the value is not a layout (an older or broken body). */
export function readLayout(value: unknown): RoomLayout {
  return parseLayout(value) ?? starterLayout();
}

export function placedCounts(layout: RoomLayout): Record<ItemId, number> {
  const placed: Record<ItemId, number> = {};
  for (const p of layout.pieces) placed[p.item] = (placed[p.item] ?? 0) + 1;
  return placed;
}

/** owned − placed for every owned item (spec §2.2), never below zero. */
export function inventoryOf(counts: Readonly<Record<ItemId, number>>, layout: RoomLayout): Record<ItemId, number> {
  const placed = placedCounts(layout);
  const out: Record<ItemId, number> = {};
  for (const [id, n] of Object.entries(counts)) out[id] = Math.max(0, n - (placed[id] ?? 0));
  return out;
}

export function childrenOf(layout: RoomLayout, id: string): Placement[] {
  return layout.pieces.filter((p) => p.layer === 'onTop' && p.parent === id).sort((a, b) => (a.spot ?? 0) - (b.spot ?? 0));
}

export function deskOf(layout: RoomLayout): Placement | undefined {
  return layout.pieces.filter((p) => p.layer === 'floor' && isoOf(p.item)?.kipDesk).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
}

const pieceKey = (p: Placement) => [p.id, p.item, p.layer, p.x, p.y, p.facing, p.mirror ? 1 : 0, p.parent ?? '', p.spot ?? ''].join(',');
/** A stable key of a layout's content (memo keys): piece order does not matter. */
export function layoutKey(layout: RoomLayout): string {
  return `${layout.styles.wallpaper},${layout.styles.floor},${layout.styles.window}|${layout.pieces.map(pieceKey).sort().join(';')}`;
}

/** The lowest unused id of the form p1, p2, … (plan ruling 10). */
export function newPieceId(layout: RoomLayout): string {
  const used = new Set(layout.pieces.map((p) => p.id));
  for (let k = 1; ; k++) if (!used.has(`p${k}`)) return `p${k}`;
}
```

- [ ] **Step 4: Move KIP's layer and export the daylight table**

Cut `KIP_CELLS`, `KipSeat`, `RoomKip`, `drawKipLayer` and `kipLayerKey` from `mobile/src/lib/room/draw.ts` into the top
of the new `mobile/src/lib/room/iso/room.ts` unchanged, and in `draw.ts` add
`export { KIP_CELLS, drawKipLayer, kipLayerKey, type KipSeat, type RoomKip } from './iso/room';` (Task 10 deletes
`draw.ts`). In `mobile/src/lib/room/weather.ts` change `const DAYLIGHT` to `export const DAYLIGHT`.

- [ ] **Step 5: The engine, the rest of `mobile/src/lib/room/iso/room.ts`**

```ts
// KIP's isometric room picture (spec 2026-10-15 §3.3, §3.4, §3.6, §3.7). Pure: no React, no Skia. Order: the shell
// (walls, windows, floor), wall pieces (left wall back to front, then right), flat pieces, then floor pieces in
// topological depth order with KIP inserted at its seat tile and each piece's children right after it. Everything
// before KIP is `back`, everything after is `front` (plan ruling 8). Then the light layer (daylight through each
// window, or the night veil), the glows, and the loop frames (those behind KIP clipped by its silhouette).
import './index';
import { catalogueItem, isoOf } from '../catalogue';
import type { Box, RoomRect } from '../grid';
import type { ItemContext, MonitorScreen } from '../items';
import { childrenOf, layoutKey } from '../layout';
import { poly, R, type Rects } from '../paint';
import { DAYLIGHT, NIGHT_VEIL, type RoomWeather } from '../weather';
import { kipRamp, KIP_COLOURS, type KipColour } from '../../kip/kipArt';
import { pieceLayers, type IsoArtOpts } from './art';
import { deskBoxes } from './crop';
import { footOf, seatTile, type IsoSpec, type Placement, type RoomLayout, type Tier } from './geometry';
import { isoGrid, projOf, type IsoGrid, type Proj } from './grid';
import { moveRects, opaqueBounds } from './prims';
import { depthOrder, type DepthBox } from './sort';
import { drawShell, windowsFor } from './styles';

// …KIP_CELLS, KipSeat, RoomKip, drawKipLayer, kipLayerKey (moved from draw.ts)…

export interface IsoStaticInput {
  layout: RoomLayout;
  tier: Tier;
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  /** A piece lifted into the drag ghost: it and its children are left out (spec §3.7). */
  hide?: string | null;
}

export interface PlacedPiece { p: Placement; at: [number, number]; o: IsoArtOpts }
/** A drawn piece for hit tests: its opaque bounds and its own rects. */
export interface PieceHit { id: string; box: Box; rects: Rects }

export interface IsoStatic {
  grid: IsoGrid;
  back: Rects;
  front: Rects;
  light: Rects;
  emissive: Rects;
  /** The window decor's loop frames (fairy lights, the chime): on the walls, behind KIP. */
  shellFrames: [Rects, Rects, Rects] | null;
  behind: PlacedPiece[];
  ahead: PlacedPiece[];
  /** Every drawn piece's opaque bounds, in draw order (the last one under a point is on top). */
  hits: PieceHit[];
  kipSeat: KipSeat;
  focus: Box;
  thumb: Box;
}

const KIP_KEY = '@kip';

/** The room point of a spot on a parent (spec §3.3): [i, j, z]. Flip mirrors a floor parent's spots across its width. */
export function spotPoint(parent: Placement, piso: IsoSpec, spot: readonly [number, number]): [number, number, number] {
  const z = piso.surface!.z;
  const [si, sj] = spot;
  if (parent.layer === 'wallR') return [parent.x / 2 + si, sj, parent.y * 4 + z];
  if (parent.layer === 'wallL') return [sj, parent.x / 2 + si, parent.y * 4 + z];
  const [w] = piso.foot ?? [1, 1];
  const a = parent.mirror ? w - si : si;
  return parent.facing === 'R' ? [parent.x + sj, parent.y + a, z] : [parent.x + a, parent.y + sj, z];
}

/** Where a piece's own space starts in room cells (Task 7's piece space), or null when it can't stand. */
export function anchorOf(P: Proj, p: Placement, byId: ReadonlyMap<string, Placement>): [number, number] | null {
  if (p.layer === 'floor') return P(p.x, p.y, 0);
  if (p.layer === 'wallR') return P(p.x / 2, 0, p.y * 4);
  if (p.layer === 'wallL') return P(0, p.x / 2, p.y * 4);
  const parent = byId.get(p.parent ?? '');
  const piso = parent ? isoOf(parent.item) : undefined;
  const spot = piso?.surface?.spots[p.spot ?? -1];
  if (!parent || !piso || !spot) return null;
  const [x, y] = P(...spotPoint(parent, piso, spot));
  return [Math.round(x), Math.round(y)];
}

/** KIP on the desk's seat tile (spec §3.6): its 32-cell grid stands on the tile centre. No desk: the room's centre. */
export function kipAt(g: IsoGrid, layout: RoomLayout): KipSeat {
  const P = projOf(g);
  const desk = layout.pieces.find((p) => p.layer === 'floor' && isoOf(p.item)?.kipDesk);
  const iso = desk ? isoOf(desk.item) : undefined;
  const seat = desk && iso ? seatTile(desk, iso) : null;
  const [si, sj] = seat ?? [Math.floor(g.n / 2), Math.floor(g.m / 2)];
  const [cx, cy] = P(si + 0.5, sj + 0.5);
  return {
    x: Math.round(cx) - 8 * KIP_CELLS,
    y: Math.round(cy) - 15 * KIP_CELLS,
    deskSide: desk?.facing === 'R' ? 'left' : 'right',
    style: catalogueItem(desk?.item)?.style ?? 'standard',
  };
}

function daylightIn(r: Rects, P: Proj, g: IsoGrid, tier: Tier, weather: RoomWeather): void {
  const a = DAYLIGHT[weather];
  for (const w of windowsFor(g, tier)) {
    const pool = (o: number, dz: number, far: number) =>
      w.wall === 'wallL'
        ? [P(0, w.a0 + o), P(0, w.a0 + w.da - o), P(far, w.a0 + w.da + dz), P(far, w.a0 + 1.6 - o)]
        : [P(w.a0 + o, 0), P(w.a0 + w.da - o, 0), P(w.a0 + w.da + dz, far), P(w.a0 + 1.6 - o, far)];
    poly(r, pool(0, 1.6, 3.4), `rgba(255,241,210,${a})`);
    poly(r, pool(0.3, 1.0, 2.4), `rgba(255,241,210,${(a * 0.6).toFixed(3)})`);
  }
}

export function drawIsoStatic(input: IsoStaticInput): IsoStatic {
  const { layout, tier, night, weather, colour } = input;
  const g = isoGrid(tier);
  const P = projOf(g);
  const ctx: ItemContext = { weather, night, colour, ramp: kipRamp(KIP_COLOURS[colour]), screen: 'lines' };
  const shell = drawShell(g, tier, layout.styles, ctx);
  const back: Rects = [...(shell.base ?? [])];
  const front: Rects = [];
  const emissive: Rects = [...(shell.emissive ?? [])];
  const behind: PlacedPiece[] = [];
  const ahead: PlacedPiece[] = [];
  const hits: PieceHit[] = [];
  const hide = input.hide ?? null;
  const visible = layout.pieces.filter((p) => isoOf(p.item) && p.id !== hide && !(p.layer === 'onTop' && p.parent === hide));
  const byId = new Map(visible.map((p) => [p.id, p]));
  let target = back;
  let list = behind;
  const put = (p: Placement) => {
    const at = anchorOf(P, p, byId);
    const o: IsoArtOpts = { layer: p.layer, facing: p.facing, mirror: p.mirror };
    const l = at ? pieceLayers(p.item, ctx, o) : null;
    if (!at || !l) return;
    const base = moveRects(l.base ?? [], at[0], at[1]);
    target.push(...base);
    if (l.emissive) emissive.push(...moveRects(l.emissive, at[0], at[1]));
    list.push({ p, at, o });
    const b = opaqueBounds(base);
    if (b) hits.push({ id: p.id, box: b, rects: base });
    for (const c of childrenOf({ ...layout, pieces: visible }, p.id)) put(c);
  };
  const byPos = (a: Placement, b: Placement) => a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const wall of ['wallL', 'wallR'] as const) visible.filter((p) => p.layer === wall).sort(byPos).forEach(put);
  const floor = visible.filter((p) => p.layer === 'floor');
  floor.filter((p) => isoOf(p.item)!.flat).sort((a, b) => a.x + a.y - (b.x + b.y) || byPos(a, b)).forEach(put);
  const solid = floor.filter((p) => !isoOf(p.item)!.flat);
  const boxes: DepthBox[] = solid.map((p) => { const a = footOf(p, isoOf(p.item)!); return { key: p.id, i0: a.x0, j0: a.y0, i1: a.x1, j1: a.y1 }; });
  const kipSeat = kipAt(g, layout);
  const desk = layout.pieces.find((p) => p.layer === 'floor' && isoOf(p.item)?.kipDesk);
  const seat = desk ? seatTile(desk, isoOf(desk.item)!) : null;
  if (seat) boxes.push({ key: KIP_KEY, i0: seat[0], j0: seat[1], i1: seat[0] + 1, j1: seat[1] + 1 });
  const order = depthOrder(boxes, desk && byId.has(desk.id) ? [[desk.id, KIP_KEY]] : []);
  if (!seat) { target = front; list = ahead; }
  for (const key of order) {
    if (key === KIP_KEY) { target = front; list = ahead; continue; }
    put(byId.get(key)!);
  }
  const light: Rects = [];
  if (night) R(light, 0, 0, g.W, g.H, NIGHT_VEIL);
  else daylightIn(light, P, g, tier, weather);
  const { focus, thumb } = deskBoxes(g, layout);
  return { grid: g, back, front, light, emissive, shellFrames: shell.frames ?? null, behind, ahead, hits, kipSeat, focus, thumb };
}

/** Removes from `rects` every cell KIP's rects cover (a loop behind KIP never paints over it, ruling 8). */
export function clipOut(rects: readonly RoomRect[], kip: readonly RoomRect[]): Rects {
  const mask = new Set<string>();
  for (const [x, y, w, h] of kip) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) mask.add(`${x + i},${y + j}`);
  const out: Rects = [];
  for (const [x, y, w, h, c] of rects) {
    for (let row = y; row < y + h; row++) {
      let u = x;
      while (u < x + w) {
        if (mask.has(`${u},${row}`)) { u++; continue; }
        let v = u + 1;
        while (v < x + w && !mask.has(`${v},${row}`)) v++;
        out.push([u, row, v - u, 1, c]);
        u = v;
      }
    }
  }
  return out;
}

/** The three loop frames for a screen state: the shell's and those behind KIP clipped by KIP, then those in front. */
export function drawIsoFrames(s: IsoStatic, c: { night: boolean; colour: KipColour; screen: MonitorScreen }, kip: Rects): [Rects, Rects, Rects] {
  const ctx: ItemContext = { weather: 'clear', night: c.night, colour: c.colour, ramp: kipRamp(KIP_COLOURS[c.colour]), screen: c.screen };
  const out: [Rects, Rects, Rects] = [[], [], []];
  const add = (frames: readonly Rects[] | undefined, dx: number, dy: number, clip: boolean) => {
    frames?.forEach((f, k) => { const m = moveRects(f, dx, dy); out[k as 0 | 1 | 2].push(...(clip ? clipOut(m, kip) : m)); });
  };
  add(s.shellFrames ?? undefined, 0, 0, true);
  for (const pp of s.behind) add(pieceLayers(pp.p.item, ctx, pp.o)?.frames, pp.at[0], pp.at[1], true);
  for (const pp of s.ahead) add(pieceLayers(pp.p.item, ctx, pp.o)?.frames, pp.at[0], pp.at[1], false);
  return out;
}

/** The static picture's memo key: the layout's content, the tier, the light, KIP's colour and the lifted piece. */
export function isoRoomKey(input: IsoStaticInput): string {
  return `${layoutKey(input.layout)}#${input.tier}#${input.weather}#${input.night ? 'n' : 'd'}#${input.colour}#${input.hide ?? ''}`;
}

/** The topmost piece with an opaque cell at room cell (x, y), or null (its shadow and glows don't count). */
export function pieceAt(hits: readonly PieceHit[], x: number, y: number): string | null {
  const inside = (b: { x: number; y: number; w: number; h: number }) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  for (let k = hits.length - 1; k >= 0; k--) {
    const { id, box, rects } = hits[k]!;
    if (inside(box) && rects.some(([rx, ry, w, h, c]) => !c.startsWith('rgba') && inside({ x: rx, y: ry, w, h }))) return id;
  }
  return null;
}
```

(`drawIsoFrames` ignores `weather`: no piece's loop reads it; the window decor's frames come from the static
picture, drawn for its weather.)

- [ ] **Step 6: Crops, `mobile/src/lib/room/iso/crop.ts`**

```ts
// The KIP page's crop of the iso room (spec 2026-10-15 §9.1): a 140 × 120-cell box centred on KIP's desk (it can
// move), and the collapsed header's 96 × 60 thumbnail, also on the desk. Crop, never shrink: the box is centred in
// the view, then the room is clamped so its edges never show; extra width shows more room. Whole points.
import { isoOf } from '../catalogue';
import type { Box } from '../grid';
import { deskOf } from '../layout';
import { footOf, type RoomLayout } from './geometry';
import { projOf, type IsoGrid } from './grid';

export const FOCUS = { w: 140, h: 120 } as const;
export const THUMB = { w: 96, h: 60 } as const;

export function deskBoxes(g: IsoGrid, layout: RoomLayout): { focus: Box; thumb: Box } {
  const desk = deskOf(layout);
  const iso = desk ? isoOf(desk.item) : undefined;
  let [cx, cy] = [g.W / 2, g.H / 2];
  if (desk && iso) {
    const a = footOf(desk, iso);
    [cx, cy] = projOf(g)((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, 16);
  }
  return {
    focus: { x: Math.round(cx - FOCUS.w / 2), y: Math.round(cy - FOCUS.h / 2), w: FOCUS.w, h: FOCUS.h },
    thumb: { x: Math.round(cx - THUMB.w / 2), y: Math.round(cy - THUMB.h / 2 - 6), w: THUMB.w, h: THUMB.h },
  };
}

export function isoCrop({ width, height, cellPt, box, room }: { width: number; height: number; cellPt: number; box: Box; room: { W: number; H: number } }): { x: number; y: number } {
  const axis = (view: number, start: number, size: number, cells: number) => {
    const roomPt = cells * cellPt;
    if (roomPt <= view) return Math.round((view - roomPt) / 2);
    const centred = view / 2 - (start + size / 2) * cellPt;
    return Math.round(Math.min(0, Math.max(view - roomPt, centred)));
  };
  return { x: axis(width, box.x, box.w, room.W), y: axis(height, box.y, box.h, room.H) };
}
```

(The test's `isoCrop(400 × 400)` expectation: the 172 × 160 room is 344 × 320 points, so it centres at
((400 − 344) / 2, (400 − 320) / 2) = (28, 40).)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/isoRoom.test.ts __tests__/lib/roomLayout.test.ts`
Expected: PASS, with a new snapshot file `__tests__/lib/__snapshots__/isoRoom.test.ts.snap` (commit it). Then
`ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf/isoBuild.test.ts` and record the logged
`coldMs`, `rebuildMs` and `frameMs` in the ledger (a measurement, not a gate).

- [ ] **Step 8: Full mobile suite, typecheck, commit**

Full mobile suite (green: the front-on engine still re-exports KIP's layer), mobile tsc (10).

```bash
git add mobile/src/lib/room/iso/room.ts mobile/src/lib/room/iso/crop.ts mobile/src/lib/room/layout.ts mobile/src/lib/room/draw.ts mobile/src/lib/room/weather.ts mobile/__tests__/lib/isoRoom.test.ts mobile/__tests__/lib/__snapshots__ mobile/__tests__/lib/roomLayout.test.ts mobile/__tests__/perf/isoBuild.test.ts
git commit -m "feat(mobile): the iso room picture with depth order, KIP at its desk, daylight and the night veil, loops clipped behind KIP, desk-centred crops and layout helpers"
```

---

### Task 9: The editor's model: the draft, every action, 20-step undo / redo, snap targets and nearest free

Spec §5.3 (drag, snap, invalid, toolbar: Move, Flip, Turn, Another, Store, Replace desk; undo / redo 20 steps; room
full), §5.4 (Place: nearest free valid tile to the room's centre; style rows; Apply set as one step), §5.7 (nudge
arrows, Up / Down on a wall, Put on…), §11.1 (the guided first placement's steps) and §16's editor tests. Pure; no UI.
Rulings 10, 12, 15, 19 and the Spec B Task 13 / 14 ledger items (the reducer checks counts before placing or applying
a set).

**Files:**
- Create: `mobile/src/lib/room/edit/targets.ts`, `mobile/src/lib/room/edit/editor.ts`
- Test: `mobile/__tests__/lib/editTargets.test.ts`, `mobile/__tests__/lib/editor.test.ts`

**Interfaces:**
- Consumes: Task 2 (`checkPiece`, `layerAllows`, `capFor`, `wallLength`, `WALL_STEPS`, `footOf`, `BadReason`,
  `Placement`, `RoomLayout`, `Tier`, `StyleKey`, `GEOMETRY_DEPS`, `isoOf`, `catalogueItem`, `catalogueSet`), Task 5
  (`isoGrid`, `projOf`, `unproject`, `HT`, `HH`), Task 8 (`spotPoint`, `childrenOf`, `inventoryOf`, `placedCounts`,
  `deskOf`, `layoutKey`, `newPieceId`), Spec B (`KipWorn`, `WornSlot`).
- Produces (`edit/targets.ts`):
  - `type Target = { layer: 'floor' | 'wallL' | 'wallR'; x: number; y: number } | { layer: 'onTop'; parent: string; spot: number }`;
  - `interface Refused { reason: BadReason | 'layer' | 'full'; with?: string }`;
  - `placedAt(base: Pick<Placement, 'id' | 'item' | 'facing' | 'mirror'>, t: Target): Placement`;
  - `refusal(layout, piece, tier, adding: boolean): Refused | null`;
  - `SPOT_RADIUS = 10`, `snapTarget(g, layout, item, cell: [number, number], facing, exclude: string | null): Target | null`;
  - `targetPoint(g, layout, item, t, facing): [number, number]`, `roomCentre(g): [number, number]`;
  - `nearestFree(g, layout, item, tier, near, base): Target | null`;
  - `COACH_ITEM = 'lamp.welcome'`, `coachTile(g, layout, tier): [number, number]`.
- Produces (`edit/editor.ts`):
  - `interface Draft { layout: RoomLayout; worn: KipWorn }`, `type DrawerTab`, `type NudgeDir`, `type Preview`,
    `type Outcome`, `interface CoachState`, `interface EditorState`, `type EditorAction`, `UNDO_STEPS = 20`;
  - `initEditor(c: EditorInput, open?: { drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean }): EditorState`
    with `interface EditorInput { layout; worn; tier; counts; version; newIds: readonly ItemId[] }`;
  - `editorReducer(s, a): EditorState`, `isChanged(s)`, `displayDraft(s): Draft`, `inventory(s): Record<ItemId, number>`,
    `canPlace(s, item): boolean`, `selectedTools(s): Tools | null` with
    `interface Tools { piece: Placement; children: number; inventory: number; canTurn: boolean; canAnother: boolean; canStore: boolean; isDesk: boolean }`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/editTargets.test.ts`:

```ts
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { starterLayout } from '../../src/lib/room/layout';
import { coachTile, nearestFree, placedAt, refusal, roomCentre, snapTarget, targetPoint } from '../../src/lib/room/edit/targets';

const g = isoGrid(1);
const P = projOf(g);
const fern = (over: Partial<Placement> = {}): Placement => ({ id: 'p1', item: 'plant.fern', layer: 'floor', x: 6, y: 6, facing: 'L', mirror: false, ...over });

describe('snapTarget (spec §5.3 Snap)', () => {
  it('snaps a floor piece to the tile under the point, a desk by its footprint\'s centre', () => {
    expect(snapTarget(g, starterLayout(), 'plant.fern', P(4.5, 5.5), 'L', null)).toEqual({ layer: 'floor', x: 4, y: 5 });
    expect(snapTarget(g, starterLayout(), 'desk.notebook', P(3.5, 5), 'L', 'desk')).toEqual({ layer: 'floor', x: 2, y: 4 });
  });

  it('snaps a poster to the wall grid: half tiles along, 4-cell steps up', () => {
    expect(snapTarget(g, starterLayout(), 'art.mountain', P(3, 0, 40), 'L', null)).toEqual({ layer: 'wallR', x: 4, y: 8 });
    expect(snapTarget(g, starterLayout(), 'art.mountain', P(0, 5, 40), 'L', null)).toEqual({ layer: 'wallL', x: 8, y: 8 });
  });

  it('snaps an on-top piece to the nearest free spot near the point ("a mug snaps onto the desk")', () => {
    expect(snapTarget(g, starterLayout(), 'item.sticky', P(3.5, 0.6, 22), 'L', null)).toEqual({ layer: 'onTop', parent: 'desk', spot: 1 });
    // Spot 2 holds the mug: a point on it finds spot 1 (still within reach) or nothing.
    expect(snapTarget(g, starterLayout(), 'item.sticky', P(1, 6), 'L', null)).toBeNull();
  });
});

describe('refusal (spec §5.3 Invalid)', () => {
  it('names the layer, the cap and the geometry reason', () => {
    expect(refusal(starterLayout(), fern({ item: 'item.mug' }), 1, false)).toEqual({ reason: 'layer' });
    expect(refusal(starterLayout(), fern({ x: 3, y: 2 }), 1, false)).toEqual({ reason: 'seat', with: 'desk' });
    expect(refusal(starterLayout(), fern(), 1, false)).toBeNull();
    const full = { ...starterLayout(), pieces: [...starterLayout().pieces, ...Array.from({ length: 33 }, (_, k) => fern({ id: `q${k}`, layer: 'wallR', x: 0, y: 0 }))] };
    expect(refusal(full, fern(), 1, true)).toEqual({ reason: 'full' });
  });

  it('builds a placement for a target, dropping parent and spot off a surface', () => {
    const top = placedAt({ id: 'm', item: 'item.mug', facing: 'L', mirror: false }, { layer: 'onTop', parent: 'desk', spot: 1 });
    expect(top).toEqual({ id: 'm', item: 'item.mug', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'desk', spot: 1 });
    expect(placedAt(top, { layer: 'floor', x: 1, y: 1 })).toEqual({ id: 'm', item: 'item.mug', layer: 'floor', x: 1, y: 1, facing: 'L', mirror: false });
  });
});

describe('nearestFree (spec §5.4 Place)', () => {
  it('finds the free valid place nearest the room\'s centre, and nothing when nothing fits', () => {
    const t = nearestFree(g, starterLayout(), 'plant.cactus', 1, roomCentre(g), { id: 'p1', item: 'plant.cactus', facing: 'L', mirror: false })!;
    expect(refusal(starterLayout(), placedAt({ id: 'p1', item: 'plant.cactus', facing: 'L', mirror: false }, t), 1, false)).toBeNull();
    const d = (q: typeof t) => Math.hypot(...targetPoint(g, starterLayout(), 'plant.cactus', q, 'L').map((v, k) => v - roomCentre(g)[k]!) as [number, number]);
    expect(d(t)).toBeLessThan(20);
    expect(nearestFree(g, starterLayout(), 'item.sticky', 1, roomCentre(g), { id: 'p1', item: 'item.sticky', facing: 'L', mirror: false })).toEqual({ layer: 'onTop', parent: 'desk', spot: 1 });
  });

  it('the coach tile is (5, 3) when it is free, else the nearest free tile to it (ruling 19)', () => {
    expect(coachTile(g, starterLayout(), 1)).toEqual([5, 3]);
    const taken = { ...starterLayout(), pieces: [...starterLayout().pieces, fern({ x: 5, y: 3 })] };
    const [x, y] = coachTile(g, taken, 1);
    expect(Math.abs(x - 5) + Math.abs(y - 3)).toBe(1);
  });
});
```

`mobile/__tests__/lib/editor.test.ts`:

```ts
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import type { Placement } from '../../src/lib/room/iso/geometry';
import { childrenOf, starterLayout } from '../../src/lib/room/layout';
import { canPlace, displayDraft, editorReducer, initEditor, inventory, isChanged, selectedTools, UNDO_STEPS, type EditorAction, type EditorState } from '../../src/lib/room/edit/editor';
import { catalogueSet } from '../../src/lib/room/catalogue';

const COUNTS: Record<string, number> = {
  'desk.monitor': 1, 'desk.notebook': 1, 'lamp.amber': 1, 'item.mug': 1, 'item.sticky': 1, 'shelf.books': 1, 'shelf.plank': 1,
  'plant.fern': 3, 'plant.cactus': 1, 'rug.slate': 1, 'lamp.welcome': 1, 'corner.beanbag': 1, 'wall.plain': 1, 'wall.dots': 1,
  'floor.oakDark': 1, 'win.plain': 1, 'out.beanie': 1, 'art.calendar': 1,
};
const start = (over: Partial<Parameters<typeof initEditor>[0]> = {}, open?: Parameters<typeof initEditor>[1]) =>
  initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: COUNTS, version: 3, newIds: [], ...over }, open);
const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const piece = (s: EditorState, id: string) => s.draft.layout.pieces.find((p) => p.id === id);

describe('placing (spec §5.4 Place, §5.3 Room full)', () => {
  it('Place puts an owned piece on the nearest free valid spot, selects it and counts it out of the inventory', () => {
    const s = run(start(), { type: 'place', item: 'plant.fern' });
    expect(s.selected).toBe('p1');
    expect(piece(s, 'p1')!.item).toBe('plant.fern');
    expect([inventory(s)['plant.fern'], s.past.length, isChanged(s)]).toEqual([1, 1, true]);
  });

  it('never places what you don\'t own or have none left of (ledger: the reducer checks counts)', () => {
    const s = start();
    expect(run(s, { type: 'place', item: 'plant.monstera' }).draft).toBe(s.draft);
    const none = run(s, { type: 'place', item: 'plant.cactus' }, { type: 'place', item: 'plant.cactus' });
    expect(none.draft.layout.pieces.filter((p) => p.item === 'plant.cactus')).toHaveLength(1);
    expect(none.outcome).toEqual({ ok: false, refused: { reason: 'outside' }, id: null });
  });

  it('at the cap, Place is refused with "full" and canPlace is false', () => {
    const many = { ...starterLayout(), pieces: [...starterLayout().pieces, ...Array.from({ length: 33 }, (_, k): Placement => ({ id: `w${k}`, item: 'art.calendar', layer: 'wallR', x: 0, y: 0, facing: 'L', mirror: false }))] };
    const s = start({ layout: many, counts: { ...COUNTS, 'art.calendar': 40 } });
    expect(canPlace(s, 'plant.fern')).toBe(false);
    expect(run(s, { type: 'place', item: 'plant.fern' }).outcome).toEqual({ ok: false, refused: { reason: 'full' }, id: null });
  });
});

describe('dragging (spec §5.3)', () => {
  it('a valid drop moves the piece (children follow) as one undo step', () => {
    const s = run(start(), { type: 'drop', id: 'desk', item: 'desk.monitor', target: { layer: 'floor', x: 2, y: 4 } });
    expect([piece(s, 'desk')!.x, piece(s, 'desk')!.y, s.past.length]).toEqual([2, 4, 1]);
    expect(childrenOf(s.draft.layout, 'desk').map((p) => p.id)).toEqual(['lamp', 'deskitem']);
  });

  it('an invalid drop changes nothing: a moved piece stays where it was, a new one stays in the inventory', () => {
    const s = start();
    const moved = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 9, y: 9 } });
    expect([moved.draft, moved.past.length, moved.outcome]).toEqual([s.draft, 0, { ok: false, refused: { reason: 'outside' }, id: 'plant' }]);
    const fresh = run(s, { type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 3, y: 2 } });
    expect([fresh.draft, fresh.outcome]).toEqual([s.draft, { ok: false, refused: { reason: 'seat', with: 'desk' }, id: null }]);
  });

  it('a drop from the drawer adds a new piece with a new id', () => {
    const s = run(start(), { type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 6, y: 6 } });
    expect([piece(s, 'p1')?.item, s.selected]).toEqual(['corner.beanbag', 'p1']);
  });
});

describe('the toolbar (spec §5.3)', () => {
  it('Flip mirrors; Turn switches facing and keeps the back corner, or refuses and stays', () => {
    let s = run(start(), { type: 'select', id: 'desk' }, { type: 'flip' });
    expect(piece(s, 'desk')!.mirror).toBe(true);
    s = run(s, { type: 'turn' });
    expect([piece(s, 'desk')!.facing, piece(s, 'desk')!.x, piece(s, 'desk')!.y]).toEqual(['R', 2, 0]);
    // A fern at (2, 2) is clear of the desk facing L, but inside its footprint turned to R.
    const edge = run(start(), { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 2, y: 2 } }, { type: 'select', id: 'desk' });
    const turned = run(edge, { type: 'turn' });
    expect([turned.draft, turned.outcome?.ok]).toEqual([edge.draft, false]);
    expect(selectedTools(edge)!.canTurn).toBe(false);
    expect(selectedTools(run(start(), { type: 'select', id: 'plant' }))!.canTurn).toBe(false); // facings: 1
  });

  it('Another places one more copy near the piece; greyed at ×0 and for the desk', () => {
    let s = run(start(), { type: 'select', id: 'plant' });
    expect(selectedTools(s)!.canAnother).toBe(true);
    s = run(s, { type: 'another' }, { type: 'select', id: 'plant' }, { type: 'another' });
    expect(s.draft.layout.pieces.filter((p) => p.item === 'plant.fern')).toHaveLength(3);
    expect(selectedTools(run(s, { type: 'select', id: 'plant' }))!.canAnother).toBe(false);
    const desk = selectedTools(run(start(), { type: 'select', id: 'desk' }))!;
    expect([desk.canAnother, desk.canStore, desk.isDesk]).toEqual([false, false, true]);
  });

  it('Store sends a piece and everything on it to the inventory; Undo puts both back on the same spot', () => {
    const s = run(start(), { type: 'select', id: 'plank' });
    expect(selectedTools(s)!.children).toBe(1);
    const stored = run(s, { type: 'store' });
    expect([piece(stored, 'plank'), piece(stored, 'shelf'), inventory(stored)['shelf.plank'], inventory(stored)['shelf.books'], stored.selected])
      .toEqual([undefined, undefined, 1, 1, null]);
    const back = run(stored, { type: 'undo' });
    expect(back.draft).toEqual(s.draft);
    expect(piece(back, 'shelf')).toEqual({ id: 'shelf', item: 'shelf.books', layer: 'onTop', x: 0, y: 0, facing: 'L', mirror: false, parent: 'plank', spot: 0 });
  });

  it('Replace desk takes the old desk\'s corner, facing and children; refuses when it does not fit', () => {
    const s = run(start(), { type: 'replaceDesk', item: 'desk.notebook' });
    expect([piece(s, 'desk')!.item, piece(s, 'desk')!.x, childrenOf(s.draft.layout, 'desk').length, s.past.length]).toEqual(['desk.notebook', 2, 2, 1]);
    expect(inventory(s)['desk.monitor']).toBe(1);
    expect(run(start(), { type: 'replaceDesk', item: 'desk.laptop' }).draft).toEqual(start().draft); // not owned
  });
});

describe('undo and redo (spec §5.3: 20 steps)', () => {
  it('goes back and forward; a new change clears redo; at most 20 steps are kept', () => {
    let s = start();
    for (let k = 0; k < 25; k++) s = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: k % 2 ? 0 : 1, y: 6 } });
    expect(s.past).toHaveLength(UNDO_STEPS);
    s = run(s, { type: 'undo' }, { type: 'undo' });
    expect(s.future).toHaveLength(2);
    s = run(s, { type: 'redo' });
    expect([s.past.length, s.future.length]).toEqual([UNDO_STEPS - 1, 1]);
    s = run(s, { type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 6, y: 5 } });
    expect(s.future).toEqual([]);
  });
});

describe('styles, worn, sets and previews (spec §5.4)', () => {
  it('a style is one undo step and must be owned', () => {
    const s = run(start(), { type: 'style', key: 'wallpaper', item: 'wall.dots' }, { type: 'style', key: 'wallpaper', item: 'wall.brick' });
    expect([s.draft.layout.styles.wallpaper, s.past.length]).toEqual(['wall.dots', 1]);
  });

  it('a locked worn piece previews without entering the draft (Spec B ruling P18)', () => {
    const s = run(start(), { type: 'previewWorn', slot: 'head', item: 'out.crown' });
    expect([s.draft.worn.head, displayDraft(s).worn.head, isChanged(s)]).toEqual([null, 'out.crown', false]);
    expect(run(s, { type: 'wear', slot: 'head', item: 'out.beanie' }).draft.worn.head).toBe('out.beanie');
  });

  it('Apply set stores everything and places the set\'s layout with owned copies only, as one step', () => {
    const cottage = catalogueSet('cottage')!;
    const counts = { ...COUNTS, ...Object.fromEntries([...Object.values(cottage.room), ...Object.values(cottage.worn)].map((id) => [id!, 1])) };
    const s = run(start({ counts }), { type: 'applySet', setId: 'cottage' });
    expect([s.draft.layout, s.draft.worn.head, s.past.length]).toEqual([cottage.layout, 'out.beanie', 1]);
    const partial = run(start(), { type: 'applySet', setId: 'cottage' });
    expect(partial.draft.layout.pieces.every((p) => (COUNTS[p.item] ?? 0) > 0)).toBe(true);
  });
});

describe('without dragging (spec §5.7)', () => {
  it('nudges along the tile axes and says where it went or why not', () => {
    let s = run(start(), { type: 'select', id: 'plant' }, { type: 'nudge', dir: 'frontRight' });
    expect([piece(s, 'plant')!.x, s.outcome]).toEqual([1, { ok: true, id: 'plant' }]);
    s = run(s, { type: 'nudge', dir: 'backLeft' }, { type: 'nudge', dir: 'backLeft' });
    expect([piece(s, 'plant')!.x, s.outcome]).toEqual([0, { ok: false, refused: { reason: 'outside' }, id: 'plant' }]);
  });

  it('moves wall pieces along and up or down, and Put on moves a piece onto a free spot', () => {
    let s = run(start(), { type: 'select', id: 'plank' }, { type: 'nudge', dir: 'up' }, { type: 'nudge', dir: 'frontRight' });
    expect([piece(s, 'plank')!.x, piece(s, 'plank')!.y]).toEqual([7, 11]);
    s = run(s, { type: 'select', id: 'plant' }, { type: 'putOn', parent: 'desk', spot: 1 });
    expect(piece(s, 'plant')).toMatchObject({ layer: 'onTop', parent: 'desk', spot: 1 });
  });
});

describe('the guided first placement (spec §11.1)', () => {
  it('step 1 ends when the lantern is placed (it is selected), step 2 when it is turned', () => {
    let s = start({}, { coach: true, drawer: 'new', item: 'lamp.welcome' });
    expect([s.coach?.step, s.coach?.tile, s.drawer, s.picked]).toEqual([1, [5, 3], 'all', 'lamp.welcome']); // nothing new: All
    s = run(s, { type: 'drop', id: null, item: 'lamp.welcome', target: { layer: 'floor', x: 5, y: 3 } });
    expect([s.coach?.step, piece(s, s.selected!)!.item]).toEqual([2, 'lamp.welcome']);
    s = run(s, { type: 'turn' });
    expect(s.coach?.step).toBe(3);
    expect(run(s, { type: 'coach', step: null }).coach).toBeNull();
  });
});

describe('saving (Spec B §6.4 rulings)', () => {
  it('a refreshed read replaces the draft, clears history and keeps the notice; saved rebases', () => {
    const changed = run(start(), { type: 'place', item: 'plant.fern' });
    const other = { layout: { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.dots' } }, worn: EMPTY_WORN };
    const r = run(changed, { type: 'refreshed', draft: other, version: 4, counts: COUNTS, tier: 1 });
    expect([r.draft, r.saved, r.past, r.notice, r.baseVersion, isChanged(r)]).toEqual([other, other, [], 'refreshed', 4, false]);
    expect(run(changed, { type: 'saved', draft: changed.draft, version: 5 }).baseVersion).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editTargets.test.ts __tests__/lib/editor.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: `mobile/src/lib/room/edit/targets.ts`**

```ts
// Where a piece can go (spec 2026-10-15 §5.3, §5.4): snapping a finger's point to a tile, the wall grid or the
// nearest free spot; why a place is refused (layer, cap, geometry); the nearest free valid place for Place and
// Another; the guided first placement's tile. Pure. The geometry is the server's (iso/geometry.ts).
import { GEOMETRY_DEPS, isoOf } from '../catalogue';
import { capFor, checkPiece, layerAllows, wallLength, WALL_STEPS, type BadReason, type Placement, type RoomLayout, type Tier } from '../iso/geometry';
import { HH, HT, projOf, unproject, type IsoGrid } from '../iso/grid';
import { spotPoint } from '../iso/room';
import type { ItemId } from '../loadout';

export type Target =
  | { layer: 'floor' | 'wallL' | 'wallR'; x: number; y: number }
  | { layer: 'onTop'; parent: string; spot: number };

export interface Refused {
  reason: BadReason | 'layer' | 'full';
  with?: string;
}

type Base = Pick<Placement, 'id' | 'item' | 'facing' | 'mirror'>;

export function placedAt(base: Base, t: Target): Placement {
  const { id, item, facing, mirror } = base;
  return t.layer === 'onTop'
    ? { id, item, layer: 'onTop', x: 0, y: 0, facing, mirror, parent: t.parent, spot: t.spot }
    : { id, item, layer: t.layer, x: t.x, y: t.y, facing, mirror };
}

/** Why `piece` can't go where it is (its own entry ignored), or null. `adding` counts it against the cap. */
export function refusal(layout: RoomLayout, piece: Placement, tier: Tier, adding: boolean): Refused | null {
  const iso = isoOf(piece.item);
  if (!iso || !layerAllows(iso, piece.layer) || (piece.facing === 'R' && iso.facings !== 2)) return { reason: 'layer' };
  if (adding && layout.pieces.length >= capFor(tier)) return { reason: 'full' };
  return checkPiece(layout, piece, tier, GEOMETRY_DEPS);
}

export const SPOT_RADIUS = 10;

/** The target under a point in room cells (spec §5.3 Snap): a free spot within reach, else the wall, else the floor. */
export function snapTarget(g: IsoGrid, layout: RoomLayout, item: ItemId, cell: readonly [number, number], facing: 'L' | 'R', exclude: string | null): Target | null {
  const iso = isoOf(item);
  if (!iso) return null;
  const [cx, cy] = cell;
  const P = projOf(g);
  if (iso.layers.includes('onTop')) {
    let best: { t: Target; d: number } | null = null;
    for (const parent of layout.pieces) {
      const piso = isoOf(parent.item);
      if (parent.id === exclude || parent.layer === 'onTop' || !piso?.surface) continue;
      piso.surface.spots.forEach((spot, k) => {
        if (layout.pieces.some((q) => q.layer === 'onTop' && q.parent === parent.id && q.spot === k && q.id !== exclude)) return;
        const [x, y] = P(...spotPoint(parent, piso, spot));
        const d = Math.hypot(x - cx, y - cy);
        if (d <= SPOT_RADIUS && (!best || d < best.d)) best = { t: { layer: 'onTop', parent: parent.id, spot: k }, d };
      });
    }
    if (best) return (best as { t: Target }).t;
  }
  const [i, j] = unproject(g, cx, cy);
  const overFloor = i >= 0 && j >= 0;
  if (iso.layers.includes('wall') && !overFloor) {
    const right = cx >= g.ox;
    const a = Math.abs(cx - g.ox) / HT;
    const z = g.oy + a * HH - cy;
    const [along, high] = iso.wall!;
    return { layer: right ? 'wallR' : 'wallL', x: Math.round(2 * a - along / 2), y: Math.round(z / 4 - high / 2) };
  }
  if (iso.layers.includes('floor')) {
    const [w, d] = iso.foot ?? [1, 1];
    const [fw, fd] = facing === 'R' ? [d, w] : [w, d];
    return { layer: 'floor', x: Math.round(i - fw / 2), y: Math.round(j - fd / 2) };
  }
  return null;
}

/** A target's centre in room cells (for distances and for drawing the ghost there). */
export function targetPoint(g: IsoGrid, layout: RoomLayout, item: ItemId, t: Target, facing: 'L' | 'R'): [number, number] {
  const P = projOf(g);
  const iso = isoOf(item);
  if (t.layer === 'onTop') {
    const parent = layout.pieces.find((p) => p.id === t.parent);
    const piso = parent ? isoOf(parent.item) : undefined;
    const spot = piso?.surface?.spots[t.spot];
    return parent && piso && spot ? P(...spotPoint(parent, piso, spot)) : [g.W / 2, g.H / 2];
  }
  if (t.layer === 'floor') {
    const [w, d] = iso?.foot ?? [1, 1];
    const [fw, fd] = facing === 'R' ? [d, w] : [w, d];
    return P(t.x + fw / 2, t.y + fd / 2);
  }
  const [along, high] = iso?.wall ?? [1, 1];
  const a = (t.x + along / 2) / 2;
  const z = (t.y + high / 2) * 4;
  return t.layer === 'wallR' ? P(a, 0, z) : P(0, a, z);
}

/** The floor's centre in room cells: where Place looks first. */
export function roomCentre(g: IsoGrid): [number, number] {
  return projOf(g)(g.n / 2, g.m / 2);
}

function candidates(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier): Target[] {
  const iso = isoOf(item);
  if (!iso) return [];
  const out: Target[] = [];
  if (iso.layers.includes('floor')) for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) out.push({ layer: 'floor', x, y });
  if (iso.layers.includes('wall')) {
    const [along, high] = iso.wall!;
    for (const layer of ['wallL', 'wallR'] as const) {
      for (let x = 0; x + along <= wallLength(layer, tier); x++) for (let y = 0; y + high <= WALL_STEPS; y++) out.push({ layer, x, y });
    }
  }
  if (iso.layers.includes('onTop')) {
    for (const parent of layout.pieces) {
      const spots = parent.layer === 'onTop' ? undefined : isoOf(parent.item)?.surface?.spots;
      spots?.forEach((_, spot) => out.push({ layer: 'onTop', parent: parent.id, spot }));
    }
  }
  return out;
}

const targetKey = (t: Target) => (t.layer === 'onTop' ? `t:${t.parent}:${t.spot}` : `${t.layer}:${t.x}:${t.y}`);

/** The free, valid place nearest `near` (spec §5.4 Place, §5.3 Another), or null when nothing fits. */
export function nearestFree(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier, near: readonly [number, number], base: Base): Target | null {
  const ranked = candidates(g, layout, item, tier)
    .map((t) => { const [x, y] = targetPoint(g, layout, item, t, base.facing); return { t, d: Math.hypot(x - near[0], y - near[1]) }; })
    .sort((a, b) => a.d - b.d || (targetKey(a.t) < targetKey(b.t) ? -1 : 1));
  for (const { t } of ranked) if (!refusal(layout, placedAt(base, t), tier, false)) return t;
  return null;
}

export const COACH_ITEM = 'lamp.welcome';

/** The guided first placement's lime tile (ruling 19): (5, 3), or the free tile nearest it where the lantern fits. */
export function coachTile(g: IsoGrid, layout: RoomLayout, tier: Tier): [number, number] {
  const base = { id: '__coach', item: COACH_ITEM, facing: 'L' as const, mirror: false };
  const tiles: Array<[number, number]> = [];
  for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) tiles.push([x, y]);
  tiles.sort((a, b) => Math.abs(a[0] - 5) + Math.abs(a[1] - 3) - (Math.abs(b[0] - 5) + Math.abs(b[1] - 3)) || a[0] - b[0] || a[1] - b[1]);
  return tiles.find(([x, y]) => !refusal(layout, placedAt(base, { layer: 'floor', x, y }), tier, false)) ?? [5, 3];
}
```

- [ ] **Step 4: `mobile/src/lib/room/edit/editor.ts`**

```ts
// The free-build editor's draft (spec 2026-10-15 §5), pure. The draft holds only owned copies: every action checks
// the inventory (counts − placed) and the cap first (ledger: Spec B Task 13 / 14), so Done can only save what you
// own. A refused action changes nothing and leaves an `outcome` for the screen to say and shake. Every drag, toolbar
// action, style change and set apply is one undo step; 20 are kept. Previews (a locked worn piece, a locked set)
// never enter the draft (Spec B ruling P18).
import { catalogueItem, catalogueSet, isoOf } from '../catalogue';
import type { KipWorn, ItemId } from '../loadout';
import type { WornSlot } from '../slots'; // moves to '../catalogue' in Task 10
import { capFor, type Placement, type RoomLayout, type StyleKey, type Tier } from '../iso/geometry';
import { isoGrid } from '../iso/grid';
import { childrenOf, deskOf, inventoryOf, layoutKey, newPieceId } from '../layout';
import { COACH_ITEM, coachTile, nearestFree, placedAt, refusal, roomCentre, targetPoint, type Refused, type Target } from './targets';

export interface Draft { layout: RoomLayout; worn: KipWorn }
export type DrawerTab = 'all' | 'floor' | 'wall' | 'onTop' | 'funny' | 'new' | 'room' | 'kip' | 'sets';
export type NudgeDir = 'backLeft' | 'backRight' | 'frontLeft' | 'frontRight' | 'up' | 'down';
export type Preview = { kind: 'worn'; slot: WornSlot; item: ItemId } | { kind: 'set'; setId: string };
export type Outcome = { ok: true; id: string } | { ok: false; refused: Refused; id: string | null };
export interface CoachState { step: 1 | 2 | 3; tile: [number, number] }

export interface EditorState {
  saved: Draft;
  draft: Draft;
  past: Draft[];
  future: Draft[];
  tier: Tier;
  counts: Readonly<Record<ItemId, number>>;
  /** The server version `saved` came from: Done sends it (Spec B final review fix #1). */
  baseVersion: number;
  selected: string | null;
  picked: ItemId | null;
  drawer: DrawerTab;
  nudging: boolean;
  preview: Preview | null;
  outcome: Outcome | null;
  /** The unseen ids when the editor opened (plan ruling 15). */
  newIds: readonly ItemId[];
  notice: 'refreshed' | 'saveFailed' | null;
  coach: CoachState | null;
}

export interface EditorInput {
  layout: RoomLayout;
  worn: KipWorn;
  tier: Tier;
  counts: Readonly<Record<ItemId, number>>;
  version: number;
  newIds: readonly ItemId[];
}

export type EditorAction =
  | { type: 'select'; id: string | null }
  | { type: 'pick'; item: ItemId | null }
  | { type: 'drawer'; tab: DrawerTab }
  | { type: 'place'; item: ItemId }
  | { type: 'drop'; id: string | null; item: ItemId; target: Target }
  | { type: 'flip' }
  | { type: 'turn' }
  | { type: 'another' }
  | { type: 'store' }
  | { type: 'nudging'; on: boolean }
  | { type: 'nudge'; dir: NudgeDir }
  | { type: 'putOn'; parent: string; spot: number }
  | { type: 'replaceDesk'; item: ItemId }
  | { type: 'style'; key: StyleKey; item: ItemId }
  | { type: 'wear'; slot: WornSlot; item: ItemId | null }
  | { type: 'previewWorn'; slot: WornSlot; item: ItemId }
  | { type: 'applySet'; setId: string }
  | { type: 'previewSet'; setId: string | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'coach'; step: CoachState['step'] | null }
  | { type: 'clearOutcome' }
  | { type: 'refreshed'; draft: Draft; version: number; counts: Readonly<Record<ItemId, number>>; tier: Tier }
  | { type: 'saveFailed' }
  | { type: 'saved'; draft: Draft; version: number };

export const UNDO_STEPS = 20;

export function initEditor(c: EditorInput, open: { drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean } = {}): EditorState {
  const draft = { layout: c.layout, worn: c.worn };
  const drawer: DrawerTab = open.drawer === 'new' ? (c.newIds.length ? 'new' : 'all') : open.drawer ?? 'all';
  return {
    saved: draft, draft, past: [], future: [], tier: c.tier, counts: c.counts, baseVersion: c.version,
    selected: null, picked: open.item ?? null, drawer, nudging: false, preview: null, outcome: null, newIds: c.newIds,
    notice: null, coach: open.coach ? { step: 1, tile: coachTile(isoGrid(c.tier), c.layout, c.tier) } : null,
  };
}

const wornEquals = (a: KipWorn, b: KipWorn) => (Object.keys(a) as WornSlot[]).every((k) => a[k] === b[k]);
const sameDraft = (a: Draft, b: Draft) => layoutKey(a.layout) === layoutKey(b.layout) && wornEquals(a.worn, b.worn);

export function isChanged(s: EditorState): boolean {
  return !sameDraft(s.draft, s.saved);
}

export function inventory(s: Pick<EditorState, 'counts' | 'draft'>): Record<ItemId, number> {
  return inventoryOf(s.counts, s.draft.layout);
}

export function canPlace(s: EditorState, item: ItemId): boolean {
  if (!((inventory(s)[item] ?? 0) > 0) || !isoOf(item)) return false;
  return !!isoOf(item)!.kipDesk || s.draft.layout.pieces.length < capFor(s.tier);
}

function commit(s: EditorState, draft: Draft, extra: Partial<EditorState> = {}): EditorState {
  if (sameDraft(draft, s.draft)) return { ...s, ...extra };
  return { ...s, ...extra, past: [...s.past, s.draft].slice(-UNDO_STEPS), future: [], draft, preview: null, notice: null };
}

const withPieces = (s: EditorState, pieces: Placement[]): Draft => ({ ...s.draft, layout: { ...s.draft.layout, pieces } });
const refuse = (s: EditorState, refused: Refused, id: string | null): EditorState => ({ ...s, outcome: { ok: false, refused, id } });
/** Coach step 1 ends when the lantern lands (spec §11.1). */
const coachAfterPlace = (s: EditorState, item: ItemId): CoachState | null =>
  s.coach && s.coach.step === 1 && item === COACH_ITEM ? { ...s.coach, step: 2 } : s.coach;

function add(s: EditorState, item: ItemId, target: Target | null, facing: 'L' | 'R' = 'L'): EditorState {
  if (!((inventory(s)[item] ?? 0) > 0)) return refuse(s, { reason: 'outside' }, null);
  if (!target) return refuse(s, { reason: 'outside' }, null);
  const piece = placedAt({ id: newPieceId(s.draft.layout), item, facing, mirror: false }, target);
  const why = refusal(s.draft.layout, piece, s.tier, true);
  if (why) return refuse(s, why, null);
  return commit(s, withPieces(s, [...s.draft.layout.pieces, piece]), { selected: piece.id, outcome: { ok: true, id: piece.id }, coach: coachAfterPlace(s, item), picked: null });
}

function move(s: EditorState, id: string, next: Placement): EditorState {
  const why = refusal(s.draft.layout, next, s.tier, false);
  if (why) return refuse(s, why, id);
  return commit(s, withPieces(s, s.draft.layout.pieces.map((p) => (p.id === id ? next : p))), { selected: id, outcome: { ok: true, id } });
}

const NUDGE: Record<NudgeDir, { floor?: [number, number]; wallR?: [number, number]; wallL?: [number, number] }> = {
  backLeft: { floor: [-1, 0], wallR: [-1, 0] },
  backRight: { floor: [0, -1], wallL: [-1, 0] },
  frontLeft: { floor: [0, 1], wallL: [1, 0] },
  frontRight: { floor: [1, 0], wallR: [1, 0] },
  up: { wallL: [0, 1], wallR: [0, 1] },
  down: { wallL: [0, -1], wallR: [0, -1] },
};

export interface Tools {
  piece: Placement;
  children: number;
  inventory: number;
  canTurn: boolean;
  canAnother: boolean;
  canStore: boolean;
  isDesk: boolean;
}

export function selectedTools(s: EditorState): Tools | null {
  const piece = s.draft.layout.pieces.find((p) => p.id === s.selected);
  const iso = piece ? isoOf(piece.item) : undefined;
  if (!piece || !iso) return null;
  const isDesk = !!iso.kipDesk;
  const turned: Placement = { ...piece, facing: piece.facing === 'L' ? 'R' : 'L' };
  const left = inventory(s)[piece.item] ?? 0;
  return {
    piece,
    children: childrenOf(s.draft.layout, piece.id).length,
    inventory: left,
    canTurn: iso.facings === 2 && !refusal(s.draft.layout, turned, s.tier, false),
    canAnother: !isDesk && left > 0 && s.draft.layout.pieces.length < capFor(s.tier),
    canStore: !isDesk,
    isDesk,
  };
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  const g = isoGrid(s.tier);
  const layout = s.draft.layout;
  const selected = layout.pieces.find((p) => p.id === s.selected);
  switch (a.type) {
    case 'select':
      return { ...s, selected: a.id, nudging: false, outcome: null };
    case 'pick':
      return { ...s, picked: a.item };
    case 'drawer':
      return { ...s, drawer: a.tab, preview: null };
    case 'place': {
      if (isoOf(a.item)?.kipDesk) return editorReducer(s, { type: 'replaceDesk', item: a.item });
      const base = { id: newPieceId(layout), item: a.item, facing: 'L' as const, mirror: false };
      return add(s, a.item, nearestFree(g, layout, a.item, s.tier, roomCentre(g), base));
    }
    case 'drop': {
      if (a.id === null) return add(s, a.item, a.target);
      const piece = layout.pieces.find((p) => p.id === a.id);
      return piece ? move(s, piece.id, placedAt(piece, a.target)) : s;
    }
    case 'flip':
      return selected ? move(s, selected.id, { ...selected, mirror: !selected.mirror }) : s;
    case 'turn': {
      if (!selected) return s;
      if (isoOf(selected.item)?.facings !== 2) return refuse(s, { reason: 'layer' }, selected.id);
      const next = move(s, selected.id, { ...selected, facing: selected.facing === 'L' ? 'R' : 'L' });
      const coach = next.outcome?.ok && s.coach?.step === 2 && selected.item === COACH_ITEM ? { ...s.coach, step: 3 as const } : next.coach;
      return { ...next, coach };
    }
    case 'another': {
      const tools = selectedTools(s);
      if (!selected || !tools?.canAnother) return selected ? refuse(s, { reason: tools && tools.inventory > 0 ? 'full' : 'outside' }, selected.id) : s;
      const near = targetPoint(g, layout, selected.item, selected.layer === 'onTop' ? { layer: 'onTop', parent: selected.parent!, spot: selected.spot! } : { layer: selected.layer, x: selected.x, y: selected.y }, selected.facing);
      const base = { id: newPieceId(layout), item: selected.item, facing: selected.facing, mirror: selected.mirror };
      return add(s, selected.item, nearestFree(g, layout, selected.item, s.tier, near, base), selected.facing);
    }
    case 'store': {
      if (!selected || isoOf(selected.item)?.kipDesk) return s;
      const gone = new Set([selected.id, ...childrenOf(layout, selected.id).map((c) => c.id)]);
      return commit(s, withPieces(s, layout.pieces.filter((p) => !gone.has(p.id))), { selected: null, nudging: false, outcome: null });
    }
    case 'nudging':
      return { ...s, nudging: a.on };
    case 'nudge': {
      if (!selected || selected.layer === 'onTop') return selected ? refuse(s, { reason: 'layer' }, selected.id) : s;
      const step = NUDGE[a.dir][selected.layer];
      if (!step) return refuse(s, { reason: 'layer' }, selected.id);
      return move(s, selected.id, { ...selected, x: selected.x + step[0], y: selected.y + step[1] });
    }
    case 'putOn':
      return selected ? move(s, selected.id, placedAt(selected, { layer: 'onTop', parent: a.parent, spot: a.spot })) : s;
    case 'replaceDesk': {
      const desk = deskOf(layout);
      const iso = isoOf(a.item);
      if (!desk || !iso?.kipDesk || desk.item === a.item || !((inventory(s)[a.item] ?? 0) > 0)) return s;
      const next: Placement = { ...desk, item: a.item };
      const spots = iso.surface?.spots.length ?? 0;
      const kept = layout.pieces.filter((p) => !(p.parent === desk.id && (p.spot ?? 0) >= spots)).map((p) => (p.id === desk.id ? next : p));
      const why = refusal({ ...layout, pieces: kept }, next, s.tier, false);
      if (why) return refuse(s, why, desk.id);
      return commit(s, withPieces(s, kept), { selected: desk.id, outcome: { ok: true, id: desk.id } });
    }
    case 'style': {
      if (catalogueItem(a.item)?.slot !== a.key || !((s.counts[a.item] ?? 0) > 0)) return s;
      return commit(s, { ...s.draft, layout: { ...layout, styles: { ...layout.styles, [a.key]: a.item } } });
    }
    case 'wear': {
      if (a.item !== null && (catalogueItem(a.item)?.slot !== a.slot || !((s.counts[a.item] ?? 0) > 0))) return s;
      return commit(s, { ...s.draft, worn: { ...s.draft.worn, [a.slot]: a.item } });
    }
    case 'previewWorn':
      return { ...s, preview: { kind: 'worn', slot: a.slot, item: a.item } };
    case 'applySet': {
      const set = catalogueSet(a.setId);
      if (!set) return s;
      // Owned copies only (spec §5.4): a piece you have no copy of is left out, with anything on it.
      const left: Record<ItemId, number> = { ...s.counts };
      const pieces = set.layout.pieces.filter((p) => { if (!((left[p.item] ?? 0) > 0)) return false; left[p.item]!--; return true; });
      const ids = new Set(pieces.map((p) => p.id));
      const kept = pieces.filter((p) => p.layer !== 'onTop' || ids.has(p.parent!));
      if (!kept.some((p) => isoOf(p.item)?.kipDesk)) return s;
      const owned = (id: ItemId) => (s.counts[id] ?? 0) > 0;
      const styles = Object.fromEntries(Object.entries(set.layout.styles).map(([k, id]) => [k, owned(id) ? id : layout.styles[k as StyleKey]])) as RoomLayout['styles'];
      const worn = { ...s.draft.worn };
      for (const [slot, id] of Object.entries(set.worn)) if (id && owned(id)) worn[slot as WornSlot] = id;
      return commit(s, { layout: { v: 1, styles, pieces: kept }, worn }, { selected: null });
    }
    case 'previewSet':
      return { ...s, preview: a.setId ? { kind: 'set', setId: a.setId } : null };
    case 'undo': {
      const last = s.past[s.past.length - 1];
      return last ? { ...s, draft: last, past: s.past.slice(0, -1), future: [s.draft, ...s.future], selected: null, outcome: null, preview: null } : s;
    }
    case 'redo': {
      const next = s.future[0];
      return next ? { ...s, draft: next, past: [...s.past, s.draft].slice(-UNDO_STEPS), future: s.future.slice(1), selected: null, outcome: null } : s;
    }
    case 'coach':
      return { ...s, coach: a.step === null || !s.coach ? null : { ...s.coach, step: a.step } };
    case 'clearOutcome':
      return { ...s, outcome: null };
    case 'refreshed':
      return { ...s, saved: a.draft, draft: a.draft, past: [], future: [], counts: a.counts, tier: a.tier, baseVersion: a.version, notice: 'refreshed', selected: null, preview: null, outcome: null };
    case 'saveFailed':
      return { ...s, notice: 'saveFailed' };
    case 'saved':
      return { ...s, saved: a.draft, draft: a.draft, past: [], future: [], baseVersion: a.version, notice: null };
  }
}

/** What the room and KIP show: the draft with any locked preview on top. */
export function displayDraft(s: EditorState): Draft {
  const p = s.preview;
  if (!p) return s.draft;
  if (p.kind === 'worn') return { ...s.draft, worn: { ...s.draft.worn, [p.slot]: p.item } };
  const set = catalogueSet(p.setId);
  return set ? { layout: set.layout, worn: { ...s.draft.worn, ...set.worn } } : s.draft;
}

```

(`WornSlot` is still exported by `lib/room/slots.ts` until Task 10 moves it into `catalogue.ts`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editTargets.test.ts __tests__/lib/editor.test.ts`
Expected: PASS. Where a number in a test depends on the exact nearest-free order (the Another test expects three
ferns from `COUNTS['plant.fern'] = 3`), it is a count, not a position.

- [ ] **Step 6: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src/lib/room/edit mobile/__tests__/lib/editTargets.test.ts mobile/__tests__/lib/editor.test.ts
git commit -m "feat(mobile): the free-build editor's model: snap targets, refusals with reasons, place, drag, flip, turn, another, store, replace desk, styles, sets, nudges and 20-step undo"
```

---

### Task 10: The app runs on layouts: the store, `RoomView` in iso, the KIP page's room card and thumbnail, long-press

Spec §2.3 (the app reads `layout`, `tier`, `cap`, `counts`), §3 (the slot engine's `draw.ts` is replaced; slot ids
and types move to `catalogue.ts`; only `SLOT_ANCHORS` and `DRAW_ORDER` go), §1 (`HotspotLayer.tsx`, `hotspots.ts`,
`HOTSPOT_CELLS` are deleted), §5.1 (long-press on the room opens the editor; the toast's and the celebration's
Decorate open it on New), §9.1 (the iso room in the existing card: 240 points, cropped on the desk; the thumbnail
follows the desk; the label "KIP in its room, {state}. Window: {weather}"). The `DecorateRoom` screen becomes the
editor's shell here (header, count, room, Cancel, load and error states); Task 11 gives it its tools. Rulings 13, 17,
22 and the ledger items: `setMyKipWorn` skipped when worn is unchanged (Spec B Task 8), and the `kipWorn` guard reads
whole opening tags and covers the worn props on wrappers (Spec B Task 12).

**Files:**
- Modify: `mobile/src/lib/room/catalogue.ts` (slot ids and types move in), `mobile/src/lib/room/loadout.ts`,
  `mobile/src/api/cosmetics.ts`, `mobile/src/lib/room/cosmeticsStore.ts`, `mobile/src/components/room/RoomView.tsx`,
  `mobile/jest-mocks/RoomView.js`, `mobile/src/components/coach/RoomCard.tsx`,
  `mobile/src/components/coach/CollapsedKipHeader.tsx`, `mobile/src/screens/CoachScreen.tsx`, `mobile/src/lib/kipStage.ts`,
  `mobile/src/lib/room/announce.ts`, `mobile/src/navigation/RootNavigator.tsx`, `mobile/src/screens/DecorateRoomScreen.tsx`,
  `mobile/src/lib/room/roomCopy.ts`, `mobile/src/lib/room/tray.ts` (trimmed), `mobile/src/lib/room/items/art.ts`,
  `mobile/src/lib/room/items/shared.ts`, `mobile/src/lib/room/grid.ts`, `mobile/src/lib/room/edit/editor.ts`, every
  importer of `lib/room/slots`
- Create: `mobile/src/components/edit/EditRoom.tsx`, `mobile/jest-mocks/cosmeticsFixture.ts`
- Delete: `mobile/src/lib/room/{draw,slots,hotspots,decorate}.ts`, `mobile/src/components/room/roomCrop.ts`,
  `mobile/src/components/decorate/{HotspotLayer,DecorateTray}.tsx`, `mobile/__tests__/lib/{room,decorate}.test.ts`,
  `mobile/__tests__/perf/roomBuild.test.ts`
- Test: rewrite `mobile/__tests__/components/RoomView.test.tsx` and `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`;
  update `RoomCard.test.tsx`, `CollapsedKipHeader.test.tsx`, `cosmeticsStore.test.tsx`, `kipStage.test.ts`,
  `RoomToastHost.test.tsx`, `CelebrationHost.test.tsx`, `decorateTray.test.ts`, `roomArtWalls.test.ts`,
  `roomArtFurniture.test.ts`, `roomSets.test.ts`, `roomCatalogue.test.ts`, `jest-mocks/roomArtChecks.ts`,
  `__tests__/conventions/{buttons,kipWorn}.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 8 (`drawIsoStatic`, `drawIsoFrames`, `drawKipLayer`, `kipLayerKey`, `isoRoomKey`, `isoCrop`,
  `deskBoxes`, `KipSeat`, `readLayout`, `starterLayout`), Task 9 (`initEditor`, `editorReducer`, `isChanged`,
  `displayDraft`, `EditorState`, `EditorAction`).
- Produces:
  - `catalogue.ts`: `ROOM_SLOTS`, `RoomSlot`, `WORN_SLOTS`, `WornSlot` (moved from `slots.ts`);
  - `api/cosmetics.ts`: `CosmeticsDTO` with `layout`, `tier`, `cap`, `counts`, `welcomed` (`room` optional);
    `putCosmetics({ layout, worn, version })`, `postRoomWelcomed()`;
  - `cosmeticsStore.ts`: `Cosmetics { owned; fresh; layout: RoomLayout; tier: Tier; cap: number; counts; worn; version; counters; welcomed }`,
    `saveCosmeticsLoadout({ layout, worn, version })`, `interface MyRoom { layout; tier }`, `useMyRoom(): MyRoom`;
  - `RoomViewProps`: `layout: RoomLayout`, `tier: Tier` (replacing `loadout`), `offset?: { x: number; y: number }`,
    `hide?: string | null`;
  - `RoomCard` prop `onDecorate?: () => void` (long-press), `ROOM_FRAME_HEIGHT = 240`;
  - `edit/editor.ts`: `type DecorateParams = { drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean }`;
    `announce.ts` `decorateTarget(itemId): DecorateParams` → `{ drawer: 'new', item: itemId }`;
  - `screens/DecorateRoomScreen.tsx`: `EDIT_ROOM_HEIGHT = 320`, `initialState(c, params): EditorState`;
  - `components/edit/EditRoom.tsx`: `EDIT_CELL_PT = 2`, `initialPan(state, width, height)`, `EditRoom`;
  - `jest-mocks/cosmeticsFixture.ts`: `STARTER_COUNTS`, `cosmeticsDTO(over?)`.

- [ ] **Step 1: The shared fixture, `mobile/jest-mocks/cosmeticsFixture.ts`**

```ts
// The GET /me/cosmetics body the mobile tests use (plan ruling 22): a new user's starter layout and counts. Tests
// override what they need. `welcomed` is true so the welcome card stays away unless a test asks for it.
import type { CosmeticsDTO } from '../src/api/cosmetics';
import { CATALOGUE } from '../src/lib/room/catalogue';
import { EMPTY_WORN } from '../src/lib/room/loadout';

export const STARTER_COUNTS: Readonly<Record<string, number>> = Object.fromEntries(
  CATALOGUE.items.filter((i) => i.unlock.kind === 'starter').map((i) => [i.id, 1]),
);

export function cosmeticsDTO(over: Partial<CosmeticsDTO> = {}): CosmeticsDTO {
  return {
    catalogueVersion: 1,
    owned: Object.keys(STARTER_COUNTS).sort(),
    fresh: [],
    layout: JSON.parse(JSON.stringify(CATALOGUE.starterLayout)),
    tier: 1,
    cap: 40,
    counts: { ...STARTER_COUNTS },
    worn: { ...EMPTY_WORN },
    version: 1,
    counters: { recapsRead: 0, buddyCheers: 0 },
    welcomed: true,
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Rewrite `mobile/__tests__/components/RoomView.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { createPicture } from '@shopify/react-native-skia';
import { bubbleAnchor, LOOP_MS, RoomView, type RoomViewProps } from '../../src/components/room/RoomView';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';
import { isoCrop } from '../../src/lib/room/iso/crop';
import { drawIsoStatic } from '../../src/lib/room/iso/room';

let mockFocused = true;
jest.mock('../../src/lib/useScreenFocused', () => ({ useScreenFocused: () => mockFocused }));

const picture = createPicture as jest.Mock;
const PROPS: RoomViewProps = {
  layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral', worn: EMPTY_WORN,
  pose: 'type', mood: 'glance', screen: 'dots', crop: { width: 323, height: 240 }, cellPt: 2,
  bubble: 'ON IT…', reduceMotion: false, accessibilityLabel: 'KIP in its room, typing. Window: cloudy', testID: 'room',
};
const pictures = (s: ReturnType<typeof render>) => s.getAllByTestId('skia-picture', { includeHiddenElements: true }).map((p) => p.props.picture);
const STATIC = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'cloudy', night: false, colour: 'coral' });

beforeEach(() => {
  mockFocused = true;
  picture.mockClear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('RoomView (iso)', () => {
  it('draws back, KIP, front and the loop frame, moved by the crop on the desk', () => {
    const s = render(<RoomView {...PROPS} />);
    expect(pictures(s)).toHaveLength(4);
    const o = isoCrop({ width: 323, height: 240, cellPt: 2, box: STATIC.focus, room: STATIC.grid });
    expect(s.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: o.x }, { translateY: o.y }]);
  });

  it('draws the thumbnail at 1 point a cell on the desk, and an editor offset when one is given', () => {
    const thumb = render(<RoomView {...PROPS} cellPt={1} box="thumb" crop={{ width: 96, height: 60 }} bubble={null} />);
    const o = isoCrop({ width: 96, height: 60, cellPt: 1, box: STATIC.thumb, room: STATIC.grid });
    expect(thumb.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: o.x }, { translateY: o.y }]);
    thumb.unmount();
    const edit = render(<RoomView {...PROPS} offset={{ x: -12, y: 4 }} />);
    expect(edit.getByTestId('skia-group', { includeHiddenElements: true }).props.skiaTransform).toEqual([{ translateX: -12 }, { translateY: 4 }]);
  });

  it('a pose change keeps the room\'s pictures: KIP and the frames (clipped by KIP) are re-recorded', () => {
    const s = render(<RoomView {...PROPS} />);
    const [back, , front] = pictures(s);
    const before = picture.mock.calls.length;
    s.rerender(<RoomView {...PROPS} pose="point" mood="glance" />);
    const [back2, , front2] = pictures(s);
    expect([back2, front2]).toEqual([back, front]);
    expect(picture.mock.calls.length - before).toBe(4);
  });

  it('a moved desk moves KIP, even with the same pose', () => {
    const s = render(<RoomView {...PROPS} />);
    const [, kip] = pictures(s);
    const moved = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'desk' ? { ...p, y: 4 } : p)) };
    s.rerender(<RoomView {...PROPS} layout={moved} />);
    expect(pictures(s)[1]).not.toBe(kip);
  });

  it('runs the 3-frame loop at 400 ms a frame', () => {
    const s = render(<RoomView {...PROPS} />);
    const seen = new Set([pictures(s)[3]]);
    for (let i = 0; i < 3; i++) {
      act(() => { jest.advanceTimersByTime(LOOP_MS); });
      seen.add(pictures(s)[3]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it.each([
    ['under Reduce Motion', { reduceMotion: true }, true],
    ['when the tab is not focused', {}, false],
    ['while paused (the editor is open)', { paused: true }, true],
  ] as const)('holds the first frame %s', (_label, extra, focused) => {
    mockFocused = focused;
    const s = render(<RoomView {...PROPS} {...extra} />);
    const [, kip, , frame] = pictures(s);
    act(() => { jest.advanceTimersByTime(LOOP_MS * 4); });
    expect([pictures(s)[1], pictures(s)[3]]).toEqual([kip, frame]);
  });

  it('is one image with one label; the bubble is decorative and sits above KIP\'s head', () => {
    const s = render(<RoomView {...PROPS} />);
    const room = s.getByTestId('room');
    expect([room.props.accessibilityRole, room.props.accessibilityLabel]).toEqual(['image', 'KIP in its room, typing. Window: cloudy']);
    expect(s.getByTestId('room-bubble', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(bubbleAnchor(STATIC.kipSeat)).toEqual({ x: STATIC.kipSeat.x + 16, y: STATIC.kipSeat.y + 10 });
  });

  it.each([280, 323])('keeps a measured bubble inside the %i-point crop, 4 points from either edge', (width) => {
    const s = render(<RoomView {...PROPS} bubble="HERE'S MY TAKE" crop={{ width, height: 240 }} />);
    const bubble = () => s.getByTestId('room-bubble', { includeHiddenElements: true });
    act(() => { fireEvent(bubble(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 135, height: 20 } } }); });
    const { left } = bubble().props.style;
    expect(left).toBeGreaterThanOrEqual(4);
    expect(left + 135).toBeLessThanOrEqual(width - 4);
  });

  it('is no element of its own when a parent carries the label, shows no bubble without one, and releases its pictures', () => {
    const s = render(<RoomView {...PROPS} accessible={false} accessibilityLabel={undefined} bubble={null} />);
    expect(s.getByTestId('room').props.accessible).toBe(false);
    expect(s.queryByTestId('room-bubble', { includeHiddenElements: true })).toBeNull();
    const all = pictures(s);
    s.unmount();
    for (const p of all) expect(p.dispose).toHaveBeenCalled();
  });
});
```

In `mobile/__tests__/components/RoomCard.test.tsx`: the layout events use `height: 240`; every `'KIP at the desk, …'`
label becomes `'KIP in its room, …'`; the two "draws your saved room" tests become (import `starterLayout` from
`../../src/lib/room/layout` and `cosmeticsDTO` from `../../jest-mocks/cosmeticsFixture`; drop `STARTER_LOADOUT`):

```tsx
it('draws your saved layout and what KIP wears (the server already trimmed what you don\'t own)', async () => {
  const layout = { ...starterLayout(), styles: { ...starterLayout().styles, wallpaper: 'wall.dots' } };
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout, worn: { ...EMPTY_WORN, head: 'out.cap' } }));
  await act(async () => { await loadCosmetics(); });
  const room = renderCard().getByTestId('kip-room');
  expect([JSON.parse(room.props.layout), room.props.tier, JSON.parse(room.props.worn).head]).toEqual([layout, 1, 'out.cap']);
});

it('draws the starter layout and a bare KIP before the first read', () => {
  const room = renderCard().getByTestId('kip-room');
  expect([JSON.parse(room.props.layout), JSON.parse(room.props.worn)]).toEqual([starterLayout(), EMPTY_WORN]);
});

it('is 240 points tall, and a long press on the room opens the editor (spec §5.1, §9.1)', () => {
  const onDecorate = jest.fn();
  const s = renderCard({ onDecorate });
  expect(s.getByTestId('kip-room-frame-inner').props.style.height).toBe(240);
  fireEvent(s.getByTestId('kip-room-press'), 'longPress');
  expect(onDecorate).toHaveBeenCalledTimes(1);
  expect(s.getByTestId('kip-room-press').props.accessible).toBe(false); // the room stays one image for screen readers
});
```

`CollapsedKipHeader.test.tsx`'s thumbnail test takes the same shape (`cosmeticsDTO({ layout, worn })`,
`JSON.parse(thumb.props.layout)`), its other tests unchanged.

In `mobile/__tests__/lib/cosmeticsStore.test.tsx`:

```tsx
const RED = { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'rug' ? { ...p, item: 'rug.red' } : p)) };
const DTO = cosmeticsDTO({
  owned: ['wall.plain', 'rug.red'], fresh: [{ itemId: 'rug.red', source: 'family:SLEEP_GOAL:1' }], layout: RED,
  counts: { ...STARTER_COUNTS, 'rug.red': 1 }, worn: { ...EMPTY_WORN, head: 'out.beanie' }, version: 3,
  counters: { recapsRead: 2, buddyCheers: 1 },
});
```

The first test expects `result.current` to equal `{ layout: starterLayout(), tier: 1 }` before the load and
`result.current.layout` to equal `RED` after it. The save test sends and expects layouts:

```tsx
  const DOTS = { ...RED, styles: { ...RED.styles, wallpaper: 'wall.dots' } };
  put.mockResolvedValueOnce({ ...DTO, layout: DOTS, version: 4 });
  await act(async () => { await saveCosmeticsLoadout({ layout: DOTS, worn: { ...EMPTY_WORN, head: 'out.beanie' }, version: 3 }); });
  expect([getCosmetics()!.layout.styles.wallpaper, getCosmetics()!.version]).toEqual(['wall.dots', 4]);
  put.mockRejectedValueOnce(new ApiError(409, 'stale', 'stale'));
  await expect(saveCosmeticsLoadout({ layout: RED, worn: EMPTY_WORN, version: 3 })).rejects.toBeInstanceOf(ApiError);
  expect(getCosmetics()!.version).toBe(4);
```

Add:

```tsx
it('hands worn items to useMyKip only when they change (Spec B Task 8 minor)', async () => {
  const myKip = require('../../src/lib/kip/myKip');
  const spy = jest.spyOn(myKip, 'setMyKipWorn');
  get.mockResolvedValue(DTO);
  await act(async () => { await loadCosmetics(); });
  await act(async () => { await loadCosmetics(); });
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

it('reads a body without a layout (an older server) as the starter layout, welcomed', async () => {
  const { layout: _drop, welcomed: _w, ...old } = DTO;
  get.mockResolvedValue(old);
  await act(async () => { await loadCosmetics(); });
  expect([getCosmetics()!.layout, getCosmetics()!.welcomed]).toEqual([starterLayout(), true]);
});
```

In `mobile/__tests__/lib/kipStage.test.ts` lines 63–64 expect `'KIP in its room, typing. Window: cloudy'` and
`'KIP in its room, resting. Window: night'`. In `RoomToastHost.test.tsx` and `CelebrationHost.test.tsx` each
`{ tab: 'room', slot: '…' }` becomes `{ drawer: 'new', item: '…' }` with the toasted id (`'wall.panel'`, `'rug.red'`,
`'art.motto'`).

Rewrite `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` (Tasks 11–14 add to it):

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fetchCosmetics } from '../../src/api/cosmetics';
import { DecorateRoomScreen } from '../../src/screens/DecorateRoomScreen';
import { loadCosmetics, resetCosmetics } from '../../src/lib/room/cosmeticsStore';
import { useDecorateOpen } from '../../src/lib/room/decorateOpen';
import { cosmeticsDTO } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));
// The window's weather (useTodayScene): no real HTTP from Jest (Spec B ruling P29).
jest.mock('../../src/api/scores', () => ({ ...jest.requireActual('../../src/api/scores'), fetchScoresWithBands: jest.fn(async () => ({ scores: [], bands: undefined })) }));
jest.mock('../../src/api/sleep', () => ({ ...jest.requireActual('../../src/api/sleep'), fetchSleep: jest.fn(async () => ({ nights: [] })) }));
jest.mock('../../src/api/cosmetics', () => ({ fetchCosmetics: jest.fn(), putCosmetics: jest.fn(), postCosmeticsSeen: jest.fn(async () => undefined), postRoomWelcomed: jest.fn(async () => undefined) }));
type RemoveEvent = { preventDefault: () => void; data: { action: unknown } };
const mockListeners: Record<string, (e: RemoveEvent) => void> = {};
const mockNav = {
  goBack: jest.fn(), navigate: jest.fn(), dispatch: jest.fn(),
  addListener: jest.fn((event: string, cb: (e: RemoveEvent) => void) => { mockListeners[event] = cb; return () => undefined; }),
};
let mockParams: object | undefined;
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) }));

async function openEditor(params?: object, dto = cosmeticsDTO({ version: 2 })) {
  mockParams = params;
  (fetchCosmetics as jest.Mock).mockResolvedValue(dto);
  await act(async () => { await loadCosmetics(); });
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  return s;
}

beforeEach(() => { jest.clearAllMocks(); resetCosmetics(); });

it('shows EDITING, the room count, and the whole room at 2 points, Done disabled (spec §5.2)', async () => {
  const s = await openEditor();
  expect(s.getByText('EDITING')).toBeTruthy();
  expect(s.getByTestId('edit-count')).toHaveTextContent('7 / 40 in room');
  expect(s.getByTestId('edit-count').props.accessibilityLabel).toBe('7 of 40 pieces in the room');
  const room = s.getByTestId('edit-room-view');
  expect([room.props.tier, JSON.parse(room.props.layout).pieces.length, room.props.room.split(':')[7]]).toEqual([1, 7, '2']);
  expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
});

it('pauses the KIP page\'s loops while open (Spec B ruling 17)', async () => {
  const seen: boolean[] = [];
  function Probe() { seen.push(useDecorateOpen()); return null; }
  const p = render(<Probe />);
  const s = await openEditor();
  expect(seen.at(-1)).toBe(true);
  s.unmount();
  p.rerender(<Probe />);
  expect(seen.at(-1)).toBe(false);
});

it('Cancel with nothing changed closes at once', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const s = await openEditor();
  fireEvent.press(s.getByTestId('edit-cancel'));
  expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});

it('a failed read shows Try again and Close (Spec B Task 13 ruling)', async () => {
  (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
  mockParams = undefined;
  const s = render(<DecorateRoomScreen />);
  await act(async () => undefined);
  expect(s.getByTestId('edit-load-failed')).toBeTruthy();
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO());
  await act(async () => { fireEvent.press(s.getByTestId('edit-retry')); });
  expect(s.getByText('EDITING')).toBeTruthy();
});
```

In `mobile/__tests__/conventions/kipWorn.test.ts` replace the one test with (ledger: Spec B Task 12):

```ts
import { openingTag, sourceFiles } from '../../jest-mocks/sourceScan';

// Each tag and the prop that must carry what that KIP wears. Wrappers pass it on to Kip / PersonKip, so an
// optional prop there could silently drop an outfit (Spec B Task 12 minor). `worn={undefined}` is no outfit.
const WORN_PROP: Record<string, string> = {
  Kip: 'worn', PersonKip: 'worn', ProfileButton: 'worn', HomeHeader: 'myWorn', HomeScene: 'myWorn',
  RecapCardView: 'kipWorn', YearPixelsView: 'kipWorn', WeeklyStoryView: 'kipWorn', CampNoteCard: 'kipWorn',
};
const TAG = new RegExp(`<(${Object.keys(WORN_PROP).join('|')})\\b`, 'g');

it('every Kip, PersonKip and worn-passing wrapper outside the exemptions passes what KIP wears', () => {
  const hits = sourceFiles(SRC).flatMap((file) => {
    const rel = path.relative(SRC, file);
    if (EXEMPT[rel]) return [];
    const text = fs.readFileSync(file, 'utf8');
    const out: string[] = [];
    for (const m of text.matchAll(TAG)) {
      const prop = WORN_PROP[m[1]!]!;
      if (!new RegExp(`\\b${prop}=\\{(?!\\s*undefined\\s*\\})`).test(openingTag(text, m.index!))) out.push(`${rel}: <${m[1]}> without ${prop}`);
    }
    return out;
  });
  expect(hits).toEqual([]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/components/RoomView.test.tsx __tests__/components/RoomCard.test.tsx __tests__/lib/cosmeticsStore.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/conventions/kipWorn.test.ts`
Expected: FAIL (RoomView takes a loadout; the store has no layout; the screen is Spec B's). The `kipWorn` guard may
pass already (a regression pin, Spec B ruling P33).

- [ ] **Step 4: Move the slot ids into `mobile/src/lib/room/catalogue.ts` and delete the slot engine**

Move `ROOM_SLOTS`, `RoomSlot`, `WORN_SLOTS`, `WornSlot` from `slots.ts` into `catalogue.ts` (above `CatalogueItem`),
delete `slots.ts`, and repoint every importer:

```bash
grep -rlE "room/slots'|from '\./slots'|from '\.\./slots'" src __tests__ jest-mocks | xargs sed -i '' -E "s#room/slots'#room/catalogue'#; s#from '\./slots'#from './catalogue'#; s#from '\.\./slots'#from '../catalogue'#"
grep -rnE "/slots'" src __tests__ jest-mocks
```

Expected: no output from the second grep. Then:
- `src/lib/room/items/art.ts`: replace the `SLOT_ANCHORS` import and `const ANCHOR = SLOT_ANCHORS.art;` with
  `const ANCHOR = { x: 130, y: 12, w: 22, h: 24 }; // Spec A's art anchor: the frame the front-on sprite hangs in`.
- Delete `src/lib/room/draw.ts`, `src/lib/room/hotspots.ts`, `src/lib/room/decorate.ts`,
  `src/components/room/roomCrop.ts`, `src/components/decorate/HotspotLayer.tsx`, `src/components/decorate/DecorateTray.tsx`,
  `__tests__/lib/room.test.ts`, `__tests__/lib/decorate.test.ts`, `__tests__/perf/roomBuild.test.ts`.
- `src/lib/room/grid.ts`: delete `FOCUS_BOX` and `THUMB_BOX` (the iso crops replace them).
- `src/lib/room/loadout.ts`: delete `STARTER_LOADOUT` and `loadoutKey`; keep `ItemId`, `RoomLoadout` (a set's slot
  record), `KipWorn`, `EMPTY_WORN`, `wornKey`.
- `src/lib/room/tray.ts`: keep only `TrayContext`, `TileModel`, `SetCardModel` and `setCards` (Task 13 replaces the
  file); delete `offeredItems`, `tilesFor`, `InfoLine`, `infoLine` and the imports only they used.
  `__tests__/lib/decorateTray.test.ts` keeps only its `setCards` tests.
- `src/lib/room/items/shared.ts`: delete `ANCHOR_EXEMPT` (nothing reads it).
- `src/lib/room/roomCopy.ts`: delete `HOTSPOT_LABELS`, `ROOM_COPY.hotspot`, `ROOM_COPY.hotspotLabel`, `ROOM_COPY.locked`,
  `ROOM_COPY.info`, `ROOM_COPY.tile`, `ROOM_COPY.tabs` and `ROOM_COPY.title` (Task 13 adds the drawer's copy), and add:

```ts
  edit: {
    title: 'EDITING',
    count: (n: number, cap: number) => `${n} / ${cap} in room`,
    countLabel: (n: number, cap: number) => `${n} of ${cap} pieces in the room`,
    roomLabel: "KIP's room, being edited",
  },
```

- `__tests__/conventions/buttons.test.ts`: remove the `components/decorate/HotspotLayer.tsx` entry.
- `jest-mocks/roomArtChecks.ts`: remove the "inside its anchor" check and the `SLOT_ANCHORS` / `ANCHOR_EXEMPT`
  imports (front-on art is a sprite source now; Task 7's iso tests check placement).
- `__tests__/lib/roomArtFurniture.test.ts`: delete the two tests that read Spec A's seat (`kipSeatFor`, `SEATS`,
  `drawKipLayer`, `THUMB_BOX`); keep the per-slot `checkSlotArt` test and the laptop screen test.
- `__tests__/lib/roomArtWalls.test.ts`: its last test compares the iso light instead (import `drawIsoStatic` and
  `starterLayout`, drop `drawRoomStatic` and `STARTER_LOADOUT`):

```ts
it('every window piece keeps the weather sky, and a window style never changes the room\'s light', () => {
  const sky = (id: string) => itemArt(id)!.draw(CTX_DAY).base!.filter(([x, y]) => x >= 22 && x < 34 && y >= 16 && y < 20);
  expect(sky('win.blinds').length).toBeGreaterThan(0);
  const light = (window: string) =>
    drawIsoStatic({ layout: { ...starterLayout(), styles: { ...starterLayout().styles, window } }, tier: 1, weather: 'clear', night: false, colour: 'coral' }).light;
  expect(light('win.curtains')).toEqual(light('win.plain'));
});
```

- `__tests__/lib/roomSets.test.ts`: the set test draws the set's iso layout. Delete the old entries in
  `__tests__/lib/__snapshots__/roomSets.test.ts.snap` and re-record with
  `node node_modules/.bin/jest --forceExit __tests__/lib/roomSets.test.ts -u`:

```ts
it.each(CATALOGUE.sets.map((s) => s.id))('the %s set draws its iso layout deterministically, day and night, with four swatches', (id) => {
  const set = catalogueSet(id)!;
  expect(SET_SWATCHES[id]).toHaveLength(4);
  for (const night of [false, true]) {
    const input = { layout: set.layout, tier: 1 as const, weather: 'mostly' as const, night, colour: 'lime' as const };
    const d = drawIsoStatic(input);
    expect(drawIsoStatic(input)).toEqual(d);
    expect({ back: d.back.length, front: d.front.length, light: d.light.length, emissive: d.emissive.length }).toMatchSnapshot(`${id} ${night ? 'night' : 'day'}`);
  }
});
```

- `__tests__/lib/roomCatalogue.test.ts`: its first test becomes `expect(starterLayout()).toEqual(CATALOGUE.starterLayout);`.

- [ ] **Step 5: The API and the store**

`mobile/src/api/cosmetics.ts`:

```ts
import { apiFetch } from './client';
import { send } from './buddies';
import type { KipWorn } from '../lib/room/loadout';
import type { RoomLayout } from '../lib/room/iso/geometry';

// KIP's room (spec 2026-10-15 §12). The server decides ownership and validates every layout; the app only shows it.
export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  /** Spec B's slot room, derived by the server until P2; the app reads `layout`. */
  room?: Record<string, string | null>;
  layout: unknown;
  tier: number;
  cap: number;
  counts: Record<string, number>;
  worn: Record<string, string | null>;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  welcomed: boolean;
}

export const fetchCosmetics = () => apiFetch<CosmeticsDTO>('/me/cosmetics');
export const putCosmetics = (body: { layout: RoomLayout; worn: KipWorn; version: number }) =>
  apiFetch<CosmeticsDTO>('/me/cosmetics', send('PUT', body));
export const postCosmeticsSeen = (itemIds: string[]) => apiFetch<void>('/me/cosmetics/seen', send('POST', { itemIds }));
export const postRoomWelcomed = () => apiFetch<void>('/me/room/welcomed', send('POST', {}));
```

`mobile/src/lib/room/cosmeticsStore.ts`: the epoch, session, version and in-flight guards are unchanged; replace the
types, `publish`, `fromDTO`, `saveCosmeticsLoadout` and `useMyRoom`:

```ts
import { capFor, type RoomLayout, type Tier } from './iso/geometry';
import { readLayout, starterLayout } from './layout';

export interface Cosmetics {
  owned: ReadonlySet<string>;
  fresh: ReadonlyArray<{ itemId: string; source: string }>;
  layout: RoomLayout;
  tier: Tier;
  cap: number;
  counts: Readonly<Record<string, number>>;
  worn: KipWorn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  welcomed: boolean;
}

const sameWorn = (a: KipWorn, b: KipWorn) => WORN_SLOTS.every((s) => a[s] === b[s]);

function publish(next: Cosmetics): void {
  if (cosmetics && next.version < cosmetics.version) return;
  const wornChanged = !cosmetics || !sameWorn(cosmetics.worn, next.worn);
  cosmetics = next;
  if (wornChanged) setMyKipWorn(next.worn); // a new object only when it changed (Spec B Task 8 minor)
  listeners.forEach((l) => l());
}

const toTier = (n: unknown): Tier => (n === 2 || n === 3 ? n : 1);

function fromDTO(dto: CosmeticsDTO): Cosmetics {
  const worn = { ...EMPTY_WORN };
  for (const slot of WORN_SLOTS) worn[slot] = idOrNull(dto.worn?.[slot]);
  const tier = toTier(dto.tier);
  return {
    owned: new Set(dto.owned), fresh: dto.fresh, layout: readLayout(dto.layout), tier,
    cap: typeof dto.cap === 'number' ? dto.cap : capFor(tier), counts: dto.counts ?? {}, worn,
    version: dto.version, counters: dto.counters,
    // An older server sends no flag: never show the welcome there.
    welcomed: dto.welcomed !== false,
  };
}

/** PUT /me/cosmetics. Throws the ApiError (403 not_owned, 409 stale, 400 …) for the editor to handle. */
export async function saveCosmeticsLoadout(input: { layout: RoomLayout; worn: KipWorn; version: number }): Promise<Cosmetics> {
  epoch++;
  const at = session;
  const next = fromDTO(await putCosmetics(input));
  if (at === session) publish(next);
  return next;
}

export interface MyRoom { layout: RoomLayout; tier: Tier }
const STARTER_ROOM_VIEW: MyRoom = { layout: starterLayout(), tier: 1 };
let roomView: { from: Cosmetics; value: MyRoom } | null = null;
const roomOf = (): MyRoom => {
  if (!cosmetics) return STARTER_ROOM_VIEW;
  if (roomView?.from !== cosmetics) roomView = { from: cosmetics, value: { layout: cosmetics.layout, tier: cosmetics.tier } };
  return roomView.value;
};
/** Your stored room (the starter layout until the first read), one stable object per published read. */
export function useMyRoom(): MyRoom {
  return useSyncExternalStore(subscribe, roomOf, roomOf);
}
```

(Drop the `ROOM_SLOTS` and `STARTER_LOADOUT` imports; update the header comment: the store holds the layout.)

- [ ] **Step 6: `RoomView` on the iso engine (`mobile/src/components/room/RoomView.tsx`)**

Replace the engine imports and `loadout` with the layout (the `record` and `useDisposed` helpers, the bubble and the
four `Picture`s stay as they are):

```tsx
import type { KipSeat } from '../../lib/room/iso/room';
import { drawIsoFrames, drawIsoStatic, drawKipLayer, isoRoomKey, kipLayerKey } from '../../lib/room/iso/room';
import { isoCrop } from '../../lib/room/iso/crop';
import type { RoomLayout, Tier } from '../../lib/room/iso/geometry';

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
  bubble: string | null;
  reduceMotion: boolean;
  accessibilityLabel?: string;
  accessible?: boolean;
  paused?: boolean;
  testID?: string;
}

export function RoomView(props: RoomViewProps) {
  const { layout, tier, weather, night, colour, worn, pose, mood, facing, screen, crop, cellPt, bubble, reduceMotion } = props;
  const focused = useScreenFocused();
  const still = reduceMotion || !focused || !!props.paused;
  const t = useFrameClock(still);
  const frame = still ? 0 : Math.floor(t / LOOP_MS) % 3;

  const input = { layout, tier, weather, night, colour, hide: props.hide ?? null };
  const staticKey = isoRoomKey(input);
  const room = useMemo(() => drawIsoStatic(input), [staticKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useDisposed(useMemo(() => record([room.back], cellPt), [room, cellPt]));
  const front = useDisposed(useMemo(() => record([room.front, room.light, room.emissive], cellPt), [room, cellPt]));

  const kip = { colour, pose, mood, worn, frame, ...(facing ? { facing } : {}) };
  const seat = room.kipSeat;
  const kipKey = `${kipLayerKey(kip)}#${seat.style}@${seat.x},${seat.y},${seat.deskSide}`;
  const kipRects = useMemo(() => drawKipLayer(kip, seat), [kipKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const kipPicture = useDisposed(useMemo(() => record([kipRects], cellPt), [kipRects, cellPt]));

  // Loops behind KIP are clipped by KIP's silhouette (plan ruling 8), so they follow KIP's pose too.
  const frameKey = `${staticKey}#${screen}#${cellPt}#${kipKey}`;
  const framePictures = useMemo(
    () => drawIsoFrames(room, { night, colour, screen }, kipRects).map((f) => record([f], cellPt)),
    [frameKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => () => framePictures.forEach((p) => p.dispose?.()), [framePictures]);

  const box = props.box === 'thumb' ? room.thumb : room.focus;
  const offset = props.offset ?? isoCrop({ width: crop.width, height: crop.height, cellPt, box, room: room.grid });
  const anchor = bubbleAnchor(seat);
  // …the measured bubble, the View, the Canvas with back, kipPicture, front and framePictures[frame], unchanged…
}
```

`bubbleAnchor(seat: KipSeat)` is unchanged. Update the header comment to cite spec 2026-10-15 §3.7. In
`mobile/jest-mocks/RoomView.js` replace `loadout: JSON.stringify(p.loadout),` with
`layout: JSON.stringify(p.layout), tier: p.tier, offset: p.offset ? JSON.stringify(p.offset) : undefined, hide: p.hide ?? null,`.

- [ ] **Step 7: The KIP page**

`mobile/src/lib/kipStage.ts`: `roomLabel` returns `` `KIP in its room, ${DOING[stage]}. Window: ${windowWord(window)}` ``
(update its doc comment).

`mobile/src/components/coach/RoomCard.tsx`:

```tsx
import { Pressable, View, type ViewProps } from 'react-native';
export const ROOM_FRAME_HEIGHT = 240;

export function RoomCard({ stage, look, window, recovery, reduceMotion, paused, onOpenRecovery, onDecorate, footer, onLayout }: {
  stage: KipStage;
  look?: KipLook;
  window: { weather: RoomWeather; night: boolean };
  recovery: { score: number | null; band: ScoreBand | null };
  reduceMotion: boolean;
  paused?: boolean;
  onOpenRecovery: () => void;
  /** Long-press on the room opens the editor (spec 2026-10-15 §5.1). */
  onDecorate?: () => void;
  footer?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
}) {
  const me = useMyKip();
  const { layout, tier } = useMyRoom();
  const [inner, setInner] = useState(0);
  return (
    <Card testID="kip-room-card" className="gap-3 p-3.5" onLayout={onLayout}>
      <View testID="kip-room-frame" style={{ borderWidth: 2, borderColor: WOOD_LINE, borderRadius: 4 }}>
        <View style={{ borderWidth: 6, borderColor: WOOD, borderRadius: 2 }}>
          {/* No button role: the room stays one image; the card's Decorate button is the accessible way in. */}
          <Pressable testID="kip-room-press" accessible={false} delayLongPress={400} onLongPress={onDecorate}>
            <View
              testID="kip-room-frame-inner"
              style={{ height: ROOM_FRAME_HEIGHT, overflow: 'hidden', backgroundColor: '#0A0B0E' }}
              onLayout={(e) => setInner(Math.floor(e.nativeEvent.layout.width))}
            >
              {stage.id === 'loading' ? (
                <Skeleton testID="kip-room-skeleton" className="h-full w-full rounded-none" />
              ) : inner > 0 ? (
                <RoomView
                  testID="kip-room"
                  layout={layout}
                  tier={tier}
                  worn={me.worn}
                  weather={window.weather}
                  night={window.night}
                  colour={me.colour}
                  pose={look?.pose ?? stage.pose}
                  mood={look?.mood ?? stage.mood}
                  facing={look?.facing}
                  screen={stage.screen}
                  bubble={stage.bubble}
                  crop={{ width: inner, height: ROOM_FRAME_HEIGHT }}
                  cellPt={2}
                  reduceMotion={reduceMotion}
                  paused={paused}
                  accessibilityLabel={roomLabel(stage.id, window)}
                />
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>
      {/* …the caption row and the footer, unchanged… */}
    </Card>
  );
}
```

(Drop the `drawableLoadout` import; the header comment says the iso room is cropped on the desk, 240 points, and a
long-press opens the editor.) In `mobile/src/screens/CoachScreen.tsx` pass `onDecorate={openDecorate}` to `RoomCard`.

`mobile/src/components/coach/CollapsedKipHeader.tsx`: `const { layout, tier } = useMyRoom();` replaces the stored
loadout (drop `useMemo` and `drawableLoadout`), and its `RoomView` takes `layout={layout} tier={tier}` (still
`cellPt={1}`, `box="thumb"`); its comment says the thumbnail follows the desk.

`mobile/src/lib/room/edit/editor.ts`: add
`export type DecorateParams = { drawer?: DrawerTab | 'new'; item?: ItemId; coach?: boolean };` and switch its
`WornSlot` import to `'../catalogue'`.

`mobile/src/lib/room/announce.ts`:

```ts
import type { DecorateParams } from './edit/editor';

/** The toast's and the celebration line's Decorate: the editor with the drawer on New (spec 2026-10-15 §1 Toasts). */
export function decorateTarget(itemId: string): DecorateParams {
  return { drawer: 'new', item: itemId };
}
```

(drop the `isWornSlot` and `decorate` imports it no longer needs). `mobile/src/navigation/RootNavigator.tsx`: the route
type becomes `DecorateRoom: DecorateParams | undefined;` with the comment "The free-build editor (spec 2026-10-15 §5),
full screen: from Decorate, a long-press on the room, a toast or a celebration (drawer on New), or the welcome card".

- [ ] **Step 8: The editor's shell**

`mobile/src/components/edit/EditRoom.tsx` (Task 11 adds the overlay and taps, Task 12 the drag and pan):

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import { RoomView } from '../room/RoomView';
import type { KipColour } from '../../lib/kip/kipArt';
import { displayDraft, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { deskBoxes, isoCrop } from '../../lib/room/iso/crop';
import { isoGrid } from '../../lib/room/iso/grid';
import { ROOM_COPY } from '../../lib/room/roomCopy';
import type { RoomWeather } from '../../lib/room/weather';

export const EDIT_CELL_PT = 2;

/** Where the editor's room starts: centred on KIP's desk, clamped to the room (spec §5.6). */
export function initialPan(state: EditorState, width: number, height: number): { x: number; y: number } {
  const g = isoGrid(state.tier);
  return isoCrop({ width, height, cellPt: EDIT_CELL_PT, box: deskBoxes(g, state.draft.layout).focus, room: g });
}

// The editor's room (spec 2026-10-15 §5.2): the whole room at 2 points with KIP at the desk. Not one image here: the
// pieces list (Task 11) is how a screen reader reaches each piece.
export function EditRoom({ state, width, height, window, colour, reduceMotion }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  width: number;
  height: number;
  window: { weather: RoomWeather; night: boolean };
  colour: KipColour;
  reduceMotion: boolean;
}) {
  const [pan] = useState(() => initialPan(state, width, height));
  const draft = displayDraft(state);
  return (
    <View testID="edit-room" style={{ width, height, overflow: 'hidden' }} accessibilityLabel={ROOM_COPY.edit.roomLabel}>
      <RoomView
        testID="edit-room-view"
        layout={draft.layout}
        tier={state.tier}
        worn={draft.worn}
        weather={window.weather}
        night={window.night}
        colour={colour}
        pose="rest"
        mood="glance"
        screen="lines"
        bubble={null}
        crop={{ width, height }}
        cellPt={EDIT_CELL_PT}
        offset={pan}
        reduceMotion={reduceMotion}
        accessible={false}
      />
    </View>
  );
}
```

Replace `mobile/src/screens/DecorateRoomScreen.tsx`:

```tsx
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { Button } from '../components/ui/button';
import { PageTitle } from '../components/ui/page-title';
import { Skeleton } from '../components/ui/skeleton';
import { Text } from '../components/ui/text';
import { EditRoom } from '../components/edit/EditRoom';
import { useMyKip } from '../lib/kip/myKip';
import { useTodayScene } from '../lib/home/useTodayScene';
import { setDecorateOpen } from '../lib/room/decorateOpen';
import { loadCosmetics, markCosmeticsSeen, useCosmetics, type Cosmetics } from '../lib/room/cosmeticsStore';
import { editorReducer, initEditor, isChanged, type DecorateParams, type EditorAction, type EditorState } from '../lib/room/edit/editor';
import { ROOM_COPY } from '../lib/room/roomCopy';

/** The editor's room: a whole 7 × 7 room at 2 points (plan ruling 17); bigger rooms pan. */
export const EDIT_ROOM_HEIGHT = 320;

// The free-build editor (spec 2026-10-15 §5): a full-screen modal over the KIP page (C6's "drawer over the chat"
// drawn as this modal, §5.1). Cancel / EDITING / Done, the room count, the room. The KIP page's loops pause while it
// is open (Spec B ruling 17). Task 11 adds the toolbar, the pieces list and Done; Task 12 the drag; Task 13 the drawer.
export function DecorateRoomScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as DecorateParams;
  const cosmetics = useCosmetics();
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    void loadCosmetics().then((loaded) => setFailed(!loaded));
  }, []);
  useEffect(() => {
    setDecorateOpen(true);
    if (!cosmetics) load();
    return () => setDecorateOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cosmetics) {
    // The route has no swipe to close, so Cancel is here from the first frame.
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
          <Button testID="edit-cancel" variant="ghost" onPress={() => navigation.goBack()}>{ROOM_COPY.cancel}</Button>
          <PageTitle>{ROOM_COPY.edit.title}</PageTitle>
          <View className="w-16" />
        </View>
        {failed ? (
          <View testID="edit-load-failed" className="m-4 gap-3 rounded-lg border border-border bg-card p-4">
            <Text className="text-body">{ROOM_COPY.loadFailed.text}</Text>
            <View className="flex-row gap-2">
              <Button testID="edit-retry" className="flex-1" onPress={load}>{ROOM_COPY.loadFailed.retry}</Button>
              <Button testID="edit-close" variant="outline" className="flex-1" onPress={() => navigation.goBack()}>{ROOM_COPY.loadFailed.close}</Button>
            </View>
          </View>
        ) : (
          <Skeleton testID="edit-loading" className="m-4 h-72 rounded-lg" />
        )}
      </SafeAreaView>
    );
  }
  return <Editor cosmetics={cosmetics} params={params} navigation={navigation} />;
}

export function initialState(c: Cosmetics, params: DecorateParams): EditorState {
  return initEditor({ layout: c.layout, worn: c.worn, tier: c.tier, counts: c.counts, version: c.version, newIds: c.fresh.map((f) => f.itemId) }, params);
}

function Editor({ cosmetics, params, navigation }: { cosmetics: Cosmetics; params: DecorateParams; navigation: any }) {
  const me = useMyKip();
  const reduceMotion = useReducedMotion();
  const day = useTodayScene(navigation);
  const { width } = useWindowDimensions();
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialState(cosmetics, params));
  const leaving = useRef(false);
  const [saving] = useState(false);
  const savingRef = useRef(false);
  // While a save is in flight nothing reaches the draft, a screen reader's activation included (Spec B Task 14 minor).
  const act = useCallback((a: EditorAction) => { if (!savingRef.current) dispatch(a); }, []);

  // Opening the editor marks everything shown as seen (Spec B §4); the New tab keeps its snapshot (ruling 15).
  useEffect(() => { void markCosmeticsSeen(cosmetics.fresh.map((f) => f.itemId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = isChanged(state);
  const cancel = () => {
    if (!changed) { leaving.current = true; navigation.goBack(); return; }
    Alert.alert(ROOM_COPY.discard.title, undefined, [
      { text: ROOM_COPY.discard.keep, style: 'cancel' },
      { text: ROOM_COPY.discard.discard, style: 'destructive', onPress: () => { leaving.current = true; navigation.goBack(); } },
    ]);
  };
  const n = state.draft.layout.pieces.length;
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-1">
        <Button testID="edit-cancel" variant="ghost" disabled={saving} onPress={cancel}>{ROOM_COPY.cancel}</Button>
        <PageTitle>{ROOM_COPY.edit.title}</PageTitle>
        <Button testID="edit-done" disabled>{ROOM_COPY.done}</Button>
      </View>
      <Text testID="edit-count" accessibilityLabel={ROOM_COPY.edit.countLabel(n, cosmetics.cap)} className="px-4 pb-2 text-caption text-muted-foreground">
        {ROOM_COPY.edit.count(n, cosmetics.cap)}
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View testID="edit-editing" pointerEvents={saving ? 'none' : 'auto'}>
          <EditRoom state={state} dispatch={act} width={width} height={EDIT_ROOM_HEIGHT} window={day.window} colour={me.colour} reduceMotion={reduceMotion} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/components __tests__/lib __tests__/screens __tests__/conventions __tests__/navigation`
Expected: PASS. If the `kipWorn` guard names a call site without its worn prop, pass the real value there
(`useMyKip().worn`, a buddy's `kipWorn`), never an exemption.

- [ ] **Step 10: Full mobile suite, typecheck, frozen files, commit**

Full mobile suite (green), mobile tsc (10), and
`git diff 086f772 -- mobile/src/components/social/CampScene.tsx mobile/src/components/social/CampBanner.tsx` (empty).

```bash
git add -A mobile
git commit -m "feat(mobile): the app runs on free-build layouts: the iso room on the KIP page and its thumbnail, long-press to edit, and the editor's shell; the slot engine and hotspots are gone"
```

---

### Task 11: The editor I: select, the grid, the toolbar, undo / redo, the pieces list, Done and Cancel

Spec §5.2 (header, room count, the grid overlay and its toggle, the toolbar with a piece selected, Undo / Redo with
nothing selected), §5.3 (tap to select with a light outline, tap empty floor to deselect; Flip, Turn greyed when it
can't fit or is symmetric, Another greyed at ×0, Store with children; desk: Store and Another greyed; Done with 403 /
409 / failure exactly as Spec B's rulings; Cancel asks), §5.7 (the "Pieces in the room" list, spoken labels without
"·", 44-point targets). Rulings 12, 24 (Spec B Task 14 minors). Review Focus 2 and 4.

**Files:**
- Create: `mobile/src/components/room/pictures.ts` (`record`, `useDisposed` moved out of `RoomView.tsx`),
  `mobile/src/lib/room/edit/overlay.ts`, `mobile/src/lib/room/edit/labels.ts`,
  `mobile/src/components/edit/EditToolbar.tsx`, `mobile/src/components/edit/PiecesList.tsx`
- Modify: `mobile/src/components/room/RoomView.tsx`, `mobile/src/components/edit/EditRoom.tsx`,
  `mobile/src/screens/DecorateRoomScreen.tsx`, `mobile/src/lib/room/roomCopy.ts`
- Test: `mobile/__tests__/lib/editLabels.test.ts`, `mobile/__tests__/components/EditRoom.test.tsx`; extend
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9's reducer and `selectedTools`, `Refused`; Task 8's `drawIsoStatic`, `pieceAt`, `isoRoomKey`;
  Task 5's `line`, `projOf`, `isoGrid`; Task 10's shell, `EDIT_CELL_PT`, `initialPan`, `initialState`,
  `saveCosmeticsLoadout`, `loadCosmetics`, `getCosmetics`.
- Produces:
  - `pictures.ts`: `record(layers: readonly (readonly RoomRect[])[], cellPt: number): SkPicture`, `useDisposed(value)`;
  - `overlay.ts`: `gridRects(g: IsoGrid): Rects`, `outlineRects(box: Box): Rects`;
  - `labels.ts`: `lowerName(name)`, `pieceNoun(item)`, `whereText(layout, p)`, `pieceLabel(layout, p)`,
    `reasonText(refused, item)`, `toolLine(layout, tools)`;
  - `EditRoom` props add `showGrid: boolean`; its tap gesture has test id `edit-room-tap`;
  - `EditToolbar({ state, dispatch, showGrid, onToggleGrid })`, `PiecesList({ state, dispatch })`;
  - `ROOM_COPY.edit` gains `where`, `deskNoun`, `tile`, `inventory`, `onIt`, `tools`, `storeLabel`, `piecesTitle`,
    `reason`; `ITEM_NAMES` gains `'shelf.plank': 'Wall plank'` and `'lamp.welcome': 'Welcome lantern'`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/editLabels.test.ts`:

```ts
import { starterLayout } from '../../src/lib/room/layout';
import { lowerName, pieceLabel, pieceNoun, reasonText, toolLine, whereText } from '../../src/lib/room/edit/labels';
import { editorReducer, initEditor, selectedTools } from '../../src/lib/room/edit/editor';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const L = starterLayout();
const p = (id: string) => L.pieces.find((q) => q.id === id)!;

it('says where a piece is: on the floor, on the wall, on its parent (the desk is "the desk")', () => {
  expect([whereText(L, p('plant')), whereText(L, p('plank')), whereText(L, p('lamp')), whereText(L, p('shelf'))])
    .toEqual(['on the floor', 'on the wall', 'on the desk', 'on the wall plank']);
  expect([pieceNoun('desk.monitor'), pieceNoun('lamp.amber'), lowerName('KIP-colour lamp'), lowerName('“SLEEP IS A SKILL” poster')])
    .toEqual(['desk', 'amber desk lamp', 'KIP-colour lamp', '“SLEEP IS A SKILL” poster']);
});

it('labels a piece in the pieces list with its tile (counting from 1), never with "·" (spec §5.7)', () => {
  expect(pieceLabel(L, p('plant'))).toBe('Fern, on the floor, tile 1, 1');
  expect(pieceLabel(L, p('lamp'))).toBe('Amber desk lamp, on the desk');
  for (const q of L.pieces) expect(pieceLabel(L, q)).not.toMatch(/[·−]/);
});

it('gives each refusal a short reason (ruling 12)', () => {
  expect([
    reasonText({ reason: 'outside' }, 'plant.fern'), reasonText({ reason: 'seat', with: 'desk' }, 'plant.fern'),
    reasonText({ reason: 'overlap', with: 'desk' }, 'plant.fern', L), reasonText({ reason: 'window' }, 'art.mountain'),
    reasonText({ reason: 'full' }, 'plant.fern'), reasonText({ reason: 'layer' }, 'item.mug'), reasonText({ reason: 'layer' }, 'corner.beanbag'),
    reasonText({ reason: 'layer' }, 'art.mountain'), reasonText({ reason: 'layer' }, 'plant.fern'), reasonText({ reason: 'spot' }, 'item.mug'),
  ]).toEqual([
    "Doesn't fit here", "Blocks KIP's chair", 'Overlaps the desk', 'Covers the window', 'Room is full', 'Only on a desk or shelf',
    'Only on the floor', 'Only on the wall', 'Only on the floor or a surface', 'That spot is taken',
  ]);
});

it('the toolbar line: name, where, what is on it, and the inventory count', () => {
  const s = editorReducer(initEditor({ layout: L, worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] }), { type: 'select', id: 'plank' });
  expect(toolLine(L, selectedTools(s)!)).toEqual({ text: 'Wall plank · on the wall · 1 on it', inventory: '×0 in inventory', spoken: 'Wall plank, on the wall, 1 on it. 0 in inventory' });
});
```

`mobile/__tests__/components/EditRoom.test.tsx`:

```tsx
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { EditRoom, EDIT_CELL_PT, initialPan } from '../../src/components/edit/EditRoom';
import { initEditor } from '../../src/lib/room/edit/editor';
import { drawIsoStatic } from '../../src/lib/room/iso/room';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/components/room/RoomView', () => require('../../jest-mocks/RoomView'));

const STATE = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const W = 390, H = 320;
const props = { state: STATE, width: W, height: H, window: { weather: 'clear' as const, night: false }, colour: 'coral' as const, reduceMotion: true, showGrid: true };

it('a tap selects the topmost piece under the finger; a tap on empty floor deselects (spec §5.3)', () => {
  const dispatch = jest.fn();
  render(<EditRoom {...props} dispatch={dispatch} />);
  const pan = initialPan(STATE, W, H);
  const fern = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'clear', night: false, colour: 'coral' }).hits.find((h) => h.id === 'plant')!;
  const [cx, cy] = fern.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!;
  const at = (x: number, y: number) => ({ x: pan.x + (x + 0.5) * EDIT_CELL_PT, y: pan.y + (y + 0.5) * EDIT_CELL_PT });
  act(() => fireGestureHandler(getByGestureTestId('edit-room-tap'), [{ state: State.BEGAN, ...at(cx, cy) }, { state: State.END, ...at(cx, cy) }]));
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'select', id: 'plant' });
  act(() => fireGestureHandler(getByGestureTestId('edit-room-tap'), [{ state: State.BEGAN, x: 1, y: 1 }, { state: State.END, x: 1, y: 1 }]));
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'select', id: null });
});

it('draws the grid overlay and the selection outline over the room, never taking touches', () => {
  const s = render(<EditRoom {...props} dispatch={jest.fn()} state={{ ...STATE, selected: 'plant' }} />);
  expect(s.getByTestId('edit-overlay').props.pointerEvents).toBe('none');
});
```

Append to `mobile/__tests__/screens/DecorateRoomScreen.test.tsx` (add the imports: `ApiError` from
`../../src/api/client`, `putCosmetics` from `../../src/api/cosmetics`, `getCosmetics` from the store, `starterLayout`):

```tsx
const select = (s: ReturnType<typeof render>, id: string) => fireEvent.press(s.getByTestId(`edit-piece-${id}`));

describe('the toolbar (spec §5.3)', () => {
  it('with nothing selected shows Undo, Redo and the grid toggle; the pieces list selects', async () => {
    const s = await openEditor();
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
    expect(s.getByTestId('edit-grid').props.accessibilityLabel).toBe('Hide grid');
    fireEvent.press(s.getByTestId('edit-grid'));
    expect(s.getByTestId('edit-grid').props.accessibilityLabel).toBe('Show grid');
    expect(s.getByTestId('edit-piece-plant').props.accessibilityLabel).toBe('Fern, on the floor, tile 1, 1');
    select(s, 'plant');
    expect(s.getByTestId('edit-tool-line')).toHaveTextContent('Fern · on the floor');
    expect(s.getByTestId('edit-piece-plant').props.accessibilityState.selected).toBe(true);
  });

  it('Flip changes the room and enables Done; Undo puts it back and Done greys again', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((q: { id: string }) => q.id === 'plant').mirror).toBe(true);
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(s.getByTestId('edit-room-deselect'));
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(s.getByTestId('edit-redo'));
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
  });

  it('Turn is greyed for a symmetric piece; the desk can turn but never be stored or copied', async () => {
    const s = await openEditor();
    select(s, 'plant');
    expect(s.getByTestId('edit-turn').props.accessibilityState.disabled).toBe(true);
    select(s, 'desk');
    expect([s.getByTestId('edit-turn'), s.getByTestId('edit-store'), s.getByTestId('edit-another')].map((b) => b.props.accessibilityState.disabled)).toEqual([false, true, true]);
  });

  it('Store sends a piece and what is on it to the inventory, and says so (Review Focus 4)', async () => {
    const s = await openEditor();
    select(s, 'plank');
    expect(s.getByTestId('edit-store').props.accessibilityLabel).toBe('Store wall plank and 1 piece on it');
    fireEvent.press(s.getByTestId('edit-store'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('5 / 40 in room');
    expect(s.queryByTestId('edit-piece-shelf')).toBeNull();
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('7 / 40 in room');
  });

  it('Turn is greyed when the turned piece would not fit (spec §5.3)', async () => {
    const crowded = { ...starterLayout(), pieces: [...starterLayout().pieces, { id: 'p1', item: 'plant.cactus', layer: 'floor' as const, x: 2, y: 2, facing: 'L' as const, mirror: false }] };
    const s = await openEditor(undefined, cosmeticsDTO({ layout: crowded }));
    select(s, 'desk');
    // Turned, the desk would cover the cactus at (2, 2): Turn is greyed rather than refused.
    expect(s.getByTestId('edit-turn').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Done and Cancel (Spec B §6.4 rulings, spec §5.3)', () => {
  it('Done saves the draft against the version it was built on, and closes', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockImplementation(async (body) => cosmeticsDTO({ layout: body.layout, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(putCosmetics).toHaveBeenCalledWith(expect.objectContaining({ version: 2, worn: expect.any(Object), layout: expect.objectContaining({ v: 1 }) }));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    expect(getCosmetics()!.version).toBe(3);
  });

  it('409: stays open with the server\'s layout, says it was refreshed, Done greyed (Review Focus 2)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    const theirs = { ...starterLayout(), pieces: starterLayout().pieces.map((q) => (q.id === 'desk' ? { ...q, y: 4 } : q)) };
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ layout: theirs, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout)).toEqual(theirs);
    expect(s.getByTestId('edit-notice')).toHaveTextContent('Something changed on another device. Your room was refreshed.');
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(true);
  });

  it('a failed re-read keeps the draft and says the save failed; Done stays enabled', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    (putCosmetics as jest.Mock).mockRejectedValue(new ApiError(409, 'stale', 'stale'));
    (fetchCosmetics as jest.Mock).mockRejectedValue(new Error('offline'));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-notice')).toHaveTextContent("Couldn't save your room. Try again.");
    expect(s.getByTestId('edit-done').props.accessibilityState.disabled).toBe(false);
  });

  it('nothing can be edited while a save is in flight (Spec B Task 14 rulings)', async () => {
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    let resolve!: (v: unknown) => void;
    (putCosmetics as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    act(() => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(s.getByTestId('edit-editing').props.pointerEvents).toBe('none');
    fireEvent.press(s.getByTestId('edit-flip'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((q: { id: string }) => q.id === 'plant').mirror).toBe(true);
    await act(async () => { resolve(cosmeticsDTO({ version: 3 })); });
  });

  it('Cancel with changes asks first; a dismiss is held the same way', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const s = await openEditor();
    select(s, 'plant');
    fireEvent.press(s.getByTestId('edit-flip'));
    fireEvent.press(s.getByTestId('edit-cancel'));
    expect(alert.mock.calls[0]![0]).toBe('Discard your changes?');
    const prevent = jest.fn();
    act(() => mockListeners.beforeRemove!({ preventDefault: prevent, data: { action: { type: 'GO_BACK' } } }));
    expect(prevent).toHaveBeenCalled();
    (alert.mock.calls[0]![2] as Array<{ onPress?: () => void }>)[1]!.onPress!();
    expect(mockNav.goBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editLabels.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no labels module, no toolbar, no pieces list, no tap).

- [ ] **Step 3: Copy (`mobile/src/lib/room/roomCopy.ts`)**

Add to `ITEM_NAMES`: `'shelf.plank': 'Wall plank', 'lamp.welcome': 'Welcome lantern',`. Extend `ROOM_COPY.edit`:

```ts
  edit: {
    title: 'EDITING',
    count: (n: number, cap: number) => `${n} / ${cap} in room`,
    countLabel: (n: number, cap: number) => `${n} of ${cap} pieces in the room`,
    roomLabel: "KIP's room, being edited",
    where: { floor: 'on the floor', wall: 'on the wall', on: (parent: string) => `on the ${parent}` },
    /** What the desk piece is called in a sentence: KIP's desk, whatever stands on it. */
    deskNoun: 'desk',
    /** Tiles count from 1 for people (the back corner is tile 1, 1). */
    tile: (x: number, y: number) => `tile ${x + 1}, ${y + 1}`,
    inventory: (n: number) => `×${n} in inventory`,
    inventorySpoken: (n: number) => `${n} in inventory`,
    onIt: (n: number) => `${n} on it`,
    tools: { move: 'Move', flip: 'Flip', turn: 'Turn', another: 'Another', store: 'Store', undo: 'Undo', redo: 'Redo', showGrid: 'Show grid', hideGrid: 'Hide grid', deselect: 'Done with this piece' },
    undoLabel: 'Undo the last change',
    redoLabel: 'Redo',
    storeLabel: (name: string, n: number) => (n ? `Store ${name} and ${n} ${n === 1 ? 'piece' : 'pieces'} on it` : `Store ${name}`),
    piecesTitle: 'Pieces in the room',
    reason: {
      outside: "Doesn't fit here",
      overlap: (name: string) => `Overlaps the ${name}`,
      window: 'Covers the window',
      spot: 'That spot is taken',
      parent: 'Nothing can stand on that',
      seat: "Blocks KIP's chair",
      full: 'Room is full',
      layer: { floor: 'Only on the floor', wall: 'Only on the wall', onTop: 'Only on a desk or shelf', floorOnTop: 'Only on the floor or a surface' },
    },
  },
```

- [ ] **Step 4: Labels, `mobile/src/lib/room/edit/labels.ts`**

```ts
// How the editor talks about a piece (spec 2026-10-15 §5.2, §5.3, §5.7): where it is, its spoken label in the pieces
// list, the toolbar line, and the reason a place is refused (plan ruling 12). Spoken forms never carry "·".
import { isoOf } from '../catalogue';
import type { Placement, RoomLayout } from '../iso/geometry';
import { ROOM_COPY, itemName, spokenName } from '../roomCopy';
import type { Tools } from './editor';
import type { Refused } from './targets';

const E = ROOM_COPY.edit;

/** A name inside a sentence: lower-case first letter, unless it starts with KIP or a quote. */
export function lowerName(name: string): string {
  return /^(KIP|“|")/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** What a piece is called in a sentence: KIP's desk is "desk", whatever stands on it. */
export function pieceNoun(item: string): string {
  return isoOf(item)?.kipDesk ? E.deskNoun : lowerName(spokenName(item));
}

export function whereText(layout: RoomLayout, p: Placement): string {
  if (p.layer === 'floor') return E.where.floor;
  if (p.layer === 'wallL' || p.layer === 'wallR') return E.where.wall;
  const parent = layout.pieces.find((q) => q.id === p.parent);
  return E.where.on(parent ? pieceNoun(parent.item) : E.where.floor);
}

/** The pieces list's label: "Fern, on the floor, tile 1, 1" (spec §5.7). */
export function pieceLabel(layout: RoomLayout, p: Placement): string {
  const base = `${spokenName(p.item)}, ${whereText(layout, p)}`;
  return p.layer === 'floor' ? `${base}, ${E.tile(p.x, p.y)}` : base;
}

export function reasonText(r: Refused, item: string, layout?: RoomLayout): string {
  switch (r.reason) {
    case 'outside': return E.reason.outside;
    case 'overlap':
    case 'wall': {
      const other = layout?.pieces.find((q) => q.id === r.with);
      return other ? E.reason.overlap(pieceNoun(other.item)) : E.reason.outside;
    }
    case 'window': return E.reason.window;
    case 'spot': return E.reason.spot;
    case 'parent':
    case 'nested': return E.reason.parent;
    case 'seat': return E.reason.seat;
    case 'full': return E.reason.full;
    case 'layer': {
      const layers = isoOf(item)?.layers ?? [];
      if (layers.includes('floor') && layers.includes('onTop')) return E.reason.layer.floorOnTop;
      if (layers.includes('wall')) return E.reason.layer.wall;
      if (layers.includes('onTop')) return E.reason.layer.onTop;
      return E.reason.layer.floor;
    }
  }
}

/** The toolbar's line for the selected piece: "Desk lamp · on the desk", "×2 in inventory" (spec §5.2). */
export function toolLine(layout: RoomLayout, t: Tools): { text: string; inventory: string; spoken: string } {
  const name = itemName(t.piece.item);
  const where = whereText(layout, t.piece);
  const on = t.children ? ` · ${E.onIt(t.children)}` : '';
  return {
    text: `${name} · ${where}${on}`,
    inventory: E.inventory(t.inventory),
    spoken: `${spokenName(t.piece.item)}, ${where}${t.children ? `, ${E.onIt(t.children)}` : ''}. ${E.inventorySpoken(t.inventory)}`,
  };
}
```

(`reasonText(…, 'overlap')` without a layout falls back to "Doesn't fit here"; the screen always passes it.)

- [ ] **Step 5: The overlay, `mobile/src/lib/room/edit/overlay.ts`**

```ts
// The editor's overlay (spec 2026-10-15 §5.2): the floor's tile lines and the walls' half-tile dots (isogrid on the
// boards), and the selected piece's light outline. Whole cells, translucent.
import type { Box } from '../grid';
import { R, type Rects } from '../paint';
import { WALL_H, projOf, type IsoGrid } from '../iso/grid';
import { line } from '../iso/prims';

const GRID = 'rgba(255,255,255,0.22)';
const DOTS = 'rgba(255,255,255,0.18)';

export function gridRects(g: IsoGrid): Rects {
  const P = projOf(g);
  const r: Rects = [];
  for (let i = 0; i <= g.n; i++) line(r, P(i, 0), P(i, g.m), GRID);
  for (let j = 0; j <= g.m; j++) line(r, P(0, j), P(g.n, j), GRID);
  for (let z = 4; z < WALL_H; z += 8) {
    for (let a = 1; a < 2 * g.n; a++) { const [x, y] = P(a / 2, 0, z); R(r, Math.round(x), Math.round(y), 1, 1, DOTS); }
    for (let a = 1; a < 2 * g.m; a++) { const [x, y] = P(0, a / 2, z); R(r, Math.round(x), Math.round(y), 1, 1, DOTS); }
  }
  return r;
}

/** A one-cell light outline around a box (2 points on screen, spec §5.3). */
export function outlineRects(b: Box): Rects {
  const r: Rects = [];
  const c = '#F5F5F4';
  R(r, b.x - 1, b.y - 1, b.w + 2, 1, c);
  R(r, b.x - 1, b.y + b.h, b.w + 2, 1, c);
  R(r, b.x - 1, b.y, 1, b.h, c);
  R(r, b.x + b.w, b.y, 1, b.h, c);
  return r;
}
```

- [ ] **Step 6: Shared picture helpers and the room's overlay and tap**

Move `record` and `useDisposed` from `RoomView.tsx` into `mobile/src/components/room/pictures.ts` unchanged (export
both) and import them back in `RoomView.tsx`.

`mobile/src/components/edit/EditRoom.tsx` gains the overlay and the tap (the `RoomView` inside is unchanged):

```tsx
import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { record, useDisposed } from '../room/pictures';
import { drawIsoStatic, isoRoomKey, pieceAt } from '../../lib/room/iso/room';
import { gridRects, outlineRects } from '../../lib/room/edit/overlay';

export function EditRoom({ state, dispatch, width, height, window, colour, reduceMotion, showGrid }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  width: number;
  height: number;
  window: { weather: RoomWeather; night: boolean };
  colour: KipColour;
  reduceMotion: boolean;
  showGrid: boolean;
}) {
  const [pan] = useState(() => initialPan(state, width, height));
  const draft = displayDraft(state);
  const g = isoGrid(state.tier);
  const input = { layout: draft.layout, tier: state.tier, weather: window.weather, night: window.night, colour };
  // The same picture RoomView draws (cached piece rects), here for its hit boxes.
  const drawn = useMemo(() => drawIsoStatic(input), [isoRoomKey(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedBox = drawn.hits.find((h) => h.id === state.selected)?.box ?? null;
  const overlay = useDisposed(useMemo(
    () => record([showGrid ? gridRects(g) : [], selectedBox ? outlineRects(selectedBox) : []], EDIT_CELL_PT),
    [showGrid, g.n, selectedBox?.x, selectedBox?.y, selectedBox?.w, selectedBox?.h], // eslint-disable-line react-hooks/exhaustive-deps
  ));
  const toCell = (x: number, y: number): [number, number] => [(x - pan.x) / EDIT_CELL_PT, (y - pan.y) / EDIT_CELL_PT];
  const tap = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .withTestId('edit-room-tap')
    .onEnd((e, ok) => {
      if (!ok) return;
      const [cx, cy] = toCell(e.x, e.y);
      dispatch({ type: 'select', id: pieceAt(drawn.hits, Math.floor(cx), Math.floor(cy)) });
    });
  return (
    <GestureDetector gesture={tap}>
      <View testID="edit-room" style={{ width, height, overflow: 'hidden' }} accessibilityLabel={ROOM_COPY.edit.roomLabel}>
        {/* …the RoomView as in Task 10… */}
        <Canvas testID="edit-overlay" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
          <Group transform={[{ translateX: pan.x }, { translateY: pan.y }]}>
            <Picture picture={overlay} />
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
```

(In `jest-mocks/skia.js` the `Canvas` stand-in passes its props through: change it to
`({ children, style, testID, pointerEvents }) => React.createElement(View, { testID: testID ?? 'skia-canvas', style, pointerEvents }, children)`.)

- [ ] **Step 7: The toolbar and the pieces list**

`mobile/src/components/edit/EditToolbar.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, buttonIconSize } from '../ui/button';
import { Text } from '../ui/text';
import { selectedTools, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { pieceNoun, toolLine } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const T = ROOM_COPY.edit.tools;
const TOOL = 'h-[44px]'; // spec §5.2: 44 points tall at least

// The toolbar (spec 2026-10-15 §5.2, F4 "Selected piece"): the piece's name and where it is, then Flip, Turn,
// Another, Store (Move arrives with the nudge pad, Task 14). With nothing selected: Undo, Redo and the grid toggle.
export function EditToolbar({ state, dispatch, showGrid, onToggleGrid }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}) {
  const tools = selectedTools(state);
  if (!tools) {
    return (
      <View testID="edit-history" className="flex-row items-center gap-2 px-4 py-2">
        <Button testID="edit-undo" variant="outline" className={TOOL} disabled={!state.past.length} accessibilityLabel={ROOM_COPY.edit.undoLabel} onPress={() => dispatch({ type: 'undo' })}>{T.undo}</Button>
        <Button testID="edit-redo" variant="outline" className={TOOL} disabled={!state.future.length} accessibilityLabel={ROOM_COPY.edit.redoLabel} onPress={() => dispatch({ type: 'redo' })}>{T.redo}</Button>
        <View className="flex-1" />
        <Button testID="edit-grid" variant="outline" size="icon-lg" accessibilityLabel={showGrid ? T.hideGrid : T.showGrid} onPress={onToggleGrid}>
          <Ionicons name={showGrid ? 'grid' : 'grid-outline'} size={buttonIconSize('icon-lg')} />
        </Button>
      </View>
    );
  }
  const line = toolLine(state.draft.layout, tools);
  return (
    <View testID="edit-toolbar" className="gap-2 px-4 py-2">
      <View className="flex-row items-start gap-2">
        <View testID="edit-tool-info" accessible accessibilityLabel={line.spoken} className="shrink grow gap-0.5">
          <Text testID="edit-tool-line" className="text-body">{line.text}</Text>
          <Text className="text-caption text-muted-foreground">{line.inventory}</Text>
        </View>
        <Button testID="edit-room-deselect" variant="ghost" size="icon-lg" accessibilityLabel={T.deselect} onPress={() => dispatch({ type: 'select', id: null })}>
          <Ionicons name="close" size={buttonIconSize('icon-lg')} />
        </Button>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button testID="edit-flip" variant="outline" className={TOOL} onPress={() => dispatch({ type: 'flip' })}>{T.flip}</Button>
        <Button testID="edit-turn" variant="outline" className={TOOL} disabled={!tools.canTurn} onPress={() => dispatch({ type: 'turn' })}>{T.turn}</Button>
        <Button testID="edit-another" variant="outline" className={TOOL} disabled={!tools.canAnother} onPress={() => dispatch({ type: 'another' })}>{T.another}</Button>
        <Button testID="edit-store" variant="outline" className={TOOL} disabled={!tools.canStore} accessibilityLabel={ROOM_COPY.edit.storeLabel(pieceNoun(tools.piece.item), tools.children)} onPress={() => dispatch({ type: 'store' })}>{T.store}</Button>
      </View>
    </View>
  );
}
```

`mobile/src/components/edit/PiecesList.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import type { EditorAction, EditorState } from '../../lib/room/edit/editor';
import { pieceLabel } from '../../lib/room/edit/labels';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// "Pieces in the room" (spec 2026-10-15 §5.7): one Button per placement, in the room's own order, so a screen reader
// (or anyone) can select a piece without finding it on the picture. Buttons, so no buttons-guard entry.
export function PiecesList({ state, dispatch }: { state: EditorState; dispatch: (a: EditorAction) => void }) {
  const layout = state.draft.layout;
  return (
    <View testID="edit-pieces" className="gap-1 px-4 pt-4">
      <SectionLabel>{ROOM_COPY.edit.piecesTitle}</SectionLabel>
      {layout.pieces.map((p) => {
        const label = pieceLabel(layout, p);
        return (
          <Button
            key={p.id}
            testID={`edit-piece-${p.id}`}
            variant={state.selected === p.id ? 'secondary' : 'ghost'}
            className="h-[44px] justify-start"
            accessibilityLabel={label}
            accessibilityState={{ selected: state.selected === p.id }}
            onPress={() => dispatch({ type: 'select', id: p.id })}
          >
            {label}
          </Button>
        );
      })}
    </View>
  );
}
```

(If `Button` has no `secondary` variant, use `outline` for the selected row.)

- [ ] **Step 8: Done, Cancel and the notices in `mobile/src/screens/DecorateRoomScreen.tsx`**

In `Editor` replace `const [saving] = useState(false);` with `const [saving, setSaving] = useState(false);`, add
`const [showGrid, setShowGrid] = useState(true);`, and:

```tsx
  // Cancel, the Android back button and a dismiss gesture all ask first when something changed (one confirm, P30).
  const confirmDiscard = (onDiscard: () => void) =>
    Alert.alert(ROOM_COPY.discard.title, undefined, [
      { text: ROOM_COPY.discard.keep, style: 'cancel' },
      { text: ROOM_COPY.discard.discard, style: 'destructive', onPress: () => { leaving.current = true; onDiscard(); } },
    ]);
  useEffect(() => navigation.addListener?.('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
    if (leaving.current || !changed) return;
    e.preventDefault();
    confirmDiscard(() => navigation.dispatch(e.data.action));
  }), [navigation, changed]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = () => {
    if (!changed) { leaving.current = true; navigation.goBack(); return; }
    confirmDiscard(() => navigation.goBack());
  };

  // A polite live region on Android; iOS has none, so each failure is announced as it happens.
  const announce = (text: string) => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text); };

  const save = async () => {
    savingRef.current = true;
    setSaving(true);
    try {
      // Saved against the version the draft was built on (Spec B final review fix #1): a newer room read meanwhile
      // answers 409 instead of being overwritten.
      const next = await saveCosmeticsLoadout({ layout: state.draft.layout, worn: state.draft.worn, version: state.baseVersion });
      dispatch({ type: 'saved', draft: { layout: next.layout, worn: next.worn }, version: next.version });
      leaving.current = true;
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 409)) {
        // Another device saved, or something placed is no longer yours: show the server's room and stay. Identity
        // tells a real refresh from a failed or dropped read (Spec B Task 14 ruling).
        const before = getCosmetics();
        const fresh = await loadCosmetics();
        if (fresh && fresh !== before) {
          dispatch({ type: 'refreshed', draft: { layout: fresh.layout, worn: fresh.worn }, version: fresh.version, counts: fresh.counts, tier: fresh.tier });
          announce(ROOM_COPY.refreshed);
          return;
        }
      }
      dispatch({ type: 'saveFailed' });
      announce(ROOM_COPY.saveFailed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
```

The header's Done becomes
`<Button testID="edit-done" disabled={!changed || saving} loading={saving} onPress={() => void save()}>{ROOM_COPY.done}</Button>`,
and under the `EditRoom` (inside `edit-editing`):

```tsx
          {state.notice ? (
            <Text testID="edit-notice" accessibilityLiveRegion="polite" className="px-4 pt-2 text-caption text-muted-foreground">
              {state.notice === 'refreshed' ? ROOM_COPY.refreshed : ROOM_COPY.saveFailed}
            </Text>
          ) : null}
          {state.outcome && !state.outcome.ok ? (
            <Text testID="edit-reason" accessibilityLiveRegion="polite" className="px-4 pt-2 text-caption text-destructive">
              {reasonText(state.outcome.refused, state.outcome.id ? state.draft.layout.pieces.find((p) => p.id === state.outcome!.id)?.item ?? '' : state.picked ?? '', state.draft.layout)}
            </Text>
          ) : null}
          <EditToolbar state={state} dispatch={act} showGrid={showGrid} onToggleGrid={() => setShowGrid((v) => !v)} />
          <PiecesList state={state} dispatch={act} />
```

and `EditRoom` gets `showGrid={showGrid}`. Imports: `AccessibilityInfo`, `Platform` from `react-native`, `ApiError`
from `../api/client`, `getCosmetics`, `saveCosmeticsLoadout` from the store, `EditToolbar`, `PiecesList`,
`reasonText`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editLabels.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/components/RoomView.test.tsx __tests__/conventions`
Expected: PASS (`buttons` and `typography` guards green with no new entries).

- [ ] **Step 10: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src mobile/jest-mocks/skia.js mobile/__tests__
git commit -m "feat(mobile): the editor's tools: tap to select with an outline, the grid, Flip, Turn, Another, Store, undo and redo, the pieces list, and Done with the refresh rules"
```

---

### Task 12: The editor II: drag with a ghost, snap with a tick, the red reason, letting go, panning

Spec §5.3 (press and hold 200 ms, the 70% ghost offset above the finger, snap to tile / half-tile / nearest free spot,
a light haptic tick per new snap, red with a short reason, letting go on an invalid spot puts it back, the drawer's
pieces go back to the inventory), §3.3 (the parent carries its children), §3.7 (the lifted piece leaves the static
picture once on pick-up and returns once on drop; the ghost is its own layer, never a rebuild while dragging), §5.6
(one finger on empty floor pans; a dragged piece near an edge auto-scrolls; no pinch zoom). Ruling 16 (the handle the
drawer's tiles drive in Task 13). Review Focus 3 and 5.

**Files:**
- Create: `mobile/src/lib/room/edit/drag.ts`
- Modify: `mobile/src/components/edit/EditRoom.tsx` (drag, ghost, pan, the imperative handle),
  `mobile/src/screens/DecorateRoomScreen.tsx` (holds the handle), `mobile/src/lib/room/roomCopy.ts`
- Test: `mobile/__tests__/lib/editDrag.test.ts`; extend `mobile/__tests__/components/EditRoom.test.tsx` and
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9 (`snapTarget`, `refusal`, `placedAt`, `Target`, `Refused`, `inventory`, `EditorState`), Task 8
  (`anchorOf`, `drawIsoStatic`, `pieceAt`), Task 7 (`pieceLayers`), Task 11 (`EditRoom`, `pictures.ts`, `reasonText`).
- Produces:
  - `edit/drag.ts`: `LIFT_PT = 24`, `EDGE_PT = 32`, `interface DragBase { item: ItemId; id: string | null; facing: 'L' | 'R'; mirror: boolean }`,
    `interface Drag extends DragBase { cell: [number, number]; target: Target | null; refused: Refused | null }`,
    `dragAt(state, base, cell): Drag`, `targetKey(t): string`,
    `ghostRects(state, drag, ctx: { night: boolean; colour: KipColour }): { base: Rects; tint: Rects }`,
    `clampPan(pan, view: { width; height }, g): { x; y }`;
  - `EditRoom` is a `forwardRef` component with `interface EditRoomHandle { lift(item: ItemId, absX: number, absY: number): void; move(absX: number, absY: number): void; drop(): void; cancel(): void }`;
    gesture test ids `edit-room-drag`, `edit-room-pan`, `edit-room-tap`; testIDs `edit-ghost`, `edit-ghost-red`, `edit-drag-reason`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/editDrag.test.ts`:

```ts
import { clampPan, dragAt, ghostRects, targetKey } from '../../src/lib/room/edit/drag';
import { initEditor } from '../../src/lib/room/edit/editor';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const S = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, version: 1, newIds: [] });
const P = projOf(isoGrid(1));
const fern = { item: 'plant.fern', id: 'plant', facing: 'L' as const, mirror: false };
const bag = { item: 'corner.beanbag', id: null, facing: 'L' as const, mirror: false };

it('snaps to the tile under the point and says nothing when it fits', () => {
  expect(dragAt(S, fern, P(5.5, 5.5))).toMatchObject({ target: { layer: 'floor', x: 5, y: 5 }, refused: null });
});

it('turns red with the reason: the chair\'s exit tile, off the floor, or a full room (spec §5.3)', () => {
  expect(dragAt(S, bag, P(3.5, 2.5)).refused).toEqual({ reason: 'seat', with: 'desk' });
  expect(dragAt(S, fern, P(9, 9)).refused).toEqual({ reason: 'outside' });
  const full = { ...S, draft: { ...S.draft, layout: { ...S.draft.layout, pieces: [...S.draft.layout.pieces, ...Array.from({ length: 33 }, (_, k) => ({ id: `w${k}`, item: 'art.calendar', layer: 'wallR' as const, x: 0, y: 0, facing: 'L' as const, mirror: false }))] } } };
  expect(dragAt(full, bag, P(6.5, 6.5)).refused).toEqual({ reason: 'full' });
  expect(dragAt(full, fern, P(6.5, 6.5)).refused).toBeNull(); // moving is not adding
});

it('a wall piece over the floor says it belongs on the wall', () => {
  expect(dragAt(S, { item: 'shelf.plank', id: 'plank', facing: 'L', mirror: false }, P(4, 4)).refused).toEqual({ reason: 'layer' });
});

it('the ghost is the piece (and what stands on it) at the target, with a red copy only when refused', () => {
  const desk = { item: 'desk.monitor', id: 'desk', facing: 'L' as const, mirror: false };
  const ok = ghostRects(S, dragAt(S, desk, P(3.5, 5)), { night: false, colour: 'coral' });
  expect(ok.base.length).toBeGreaterThan(0);
  expect(ok.tint).toEqual([]);
  const bad = ghostRects(S, dragAt(S, bag, P(3.5, 2.5)), { night: false, colour: 'coral' });
  expect(bad.tint.length).toBeGreaterThan(0);
  expect(bad.tint.every((q) => q[4] === 'rgba(248,113,113,0.6)')).toBe(true);
  expect(targetKey({ layer: 'floor', x: 1, y: 2 })).toBe('floor:1:2');
});

it('pans only as far as the room goes; a narrower room stays centred (spec §5.6)', () => {
  const g = isoGrid(3); // 440 × 368 points
  expect(clampPan({ x: 50, y: 50 }, { width: 390, height: 320 }, g)).toEqual({ x: 0, y: 0 });
  expect(clampPan({ x: -500, y: -500 }, { width: 390, height: 320 }, g)).toEqual({ x: 390 - 440, y: 320 - 368 });
  expect(clampPan({ x: -500, y: 0 }, { width: 400, height: 400 }, isoGrid(1))).toEqual({ x: 28, y: 40 });
});
```

Append to `mobile/__tests__/components/EditRoom.test.tsx` (add `import * as Haptics from 'expo-haptics';`,
`import { createRef } from 'react';`, `import { projOf, isoGrid } from '../../src/lib/room/iso/grid';`, and
`import { LIFT_PT } from '../../src/lib/room/edit/drag';`):

```tsx
const P = projOf(isoGrid(1));
const pt = (i: number, j: number, z = 0) => {
  const pan = initialPan(STATE, W, H);
  const [x, y] = P(i, j, z);
  return { x: pan.x + x * EDIT_CELL_PT, y: pan.y + y * EDIT_CELL_PT + LIFT_PT };
};
const fernTop = () => {
  const hit = drawIsoStatic({ layout: starterLayout(), tier: 1, weather: 'clear', night: false, colour: 'coral' }).hits.find((h) => h.id === 'plant')!;
  const [x, y] = hit.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!;
  const pan = initialPan(STATE, W, H);
  return { x: pan.x + (x + 0.5) * EDIT_CELL_PT, y: pan.y + (y + 0.5) * EDIT_CELL_PT };
};

describe('dragging (spec §5.3)', () => {
  it('lifts the held piece out of the picture, ticks on each new snap, and drops it on the tile under the ghost', () => {
    const dispatch = jest.fn();
    const s = render(<EditRoom {...props} dispatch={dispatch} />);
    (Haptics.selectionAsync as jest.Mock).mockClear();
    const g = getByGestureTestId('edit-room-drag');
    act(() => fireGestureHandler(g, [{ state: State.BEGAN, ...fernTop() }, { state: State.ACTIVE, ...fernTop() }, { state: State.ACTIVE, ...pt(5.5, 5.5) }]));
    expect(s.getByTestId('edit-room-view').props.hide).toBe('plant');
    expect(s.getByTestId('edit-ghost')).toBeTruthy();
    act(() => fireGestureHandler(g, [{ state: State.ACTIVE, ...pt(6.5, 5.5) }, { state: State.END, ...pt(6.5, 5.5) }]));
    expect((Haptics.selectionAsync as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'drop', id: 'plant', item: 'plant.fern', target: { layer: 'floor', x: 6, y: 5 } });
    expect(s.getByTestId('edit-room-view').props.hide).toBeNull();
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });

  it('shows red with the reason while over an invalid spot (Review Focus 3)', () => {
    const s = render(<EditRoom {...props} dispatch={jest.fn()} />);
    act(() => fireGestureHandler(getByGestureTestId('edit-room-drag'), [{ state: State.BEGAN, ...fernTop() }, { state: State.ACTIVE, ...fernTop() }, { state: State.ACTIVE, ...pt(3.5, 2.5) }]));
    expect(s.getByTestId('edit-ghost-red')).toBeTruthy();
    expect(s.getByTestId('edit-drag-reason')).toHaveTextContent("Blocks KIP's chair");
  });

  it('a drag that starts on empty floor lifts nothing', () => {
    const dispatch = jest.fn();
    const s = render(<EditRoom {...props} dispatch={dispatch} />);
    act(() => fireGestureHandler(getByGestureTestId('edit-room-drag'), [{ state: State.BEGAN, x: 1, y: 1 }, { state: State.ACTIVE, x: 1, y: 1 }, { state: State.END, x: 5, y: 5 }]));
    expect(dispatch).not.toHaveBeenCalled();
    expect(s.queryByTestId('edit-ghost')).toBeNull();
  });

  it('the drawer drives the same drag through the handle, in window coordinates (ruling 16)', () => {
    const dispatch = jest.fn();
    const ref = createRef<EditRoomHandle>();
    const counts = { ...STARTER_COUNTS, 'corner.beanbag': 1 };
    render(<EditRoom {...props} ref={ref} state={{ ...STATE, counts }} dispatch={dispatch} />);
    const at = pt(6.5, 6.5);
    act(() => { ref.current!.lift('corner.beanbag', at.x, at.y); });
    act(() => { ref.current!.move(at.x, at.y); });
    act(() => { ref.current!.drop(); });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'drop', id: null, item: 'corner.beanbag', target: { layer: 'floor', x: 6, y: 6 } });
  });
});

describe('panning (spec §5.6)', () => {
  it('one finger pans a room bigger than the view, never past its edges', () => {
    const loft = { ...STATE, tier: 3 as const };
    const s = render(<EditRoom {...props} state={loft} dispatch={jest.fn()} />);
    const before = JSON.parse(s.getByTestId('edit-room-view').props.offset);
    act(() => fireGestureHandler(getByGestureTestId('edit-room-pan'), [{ state: State.BEGAN }, { state: State.ACTIVE, translationX: -20, translationY: 0 }, { state: State.END, translationX: -20, translationY: 0 }]));
    const after = JSON.parse(s.getByTestId('edit-room-view').props.offset);
    expect(after.x).toBe(Math.max(390 - 440, before.x - 20));
  });
});
```

(import `EditRoomHandle` with `EditRoom`.) Append to `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`:

```tsx
it('letting go on an invalid spot puts the piece back and adds no undo step (Review Focus 3)', async () => {
  const s = await openEditor();
  const before = s.getByTestId('edit-room-view').props.layout;
  const g = getByGestureTestId('edit-room-drag');
  const room = s.getByTestId('edit-room');
  // Hold on nothing in particular, then drop far off the floor: nothing is lifted, nothing changes.
  act(() => fireGestureHandler(g, [{ state: State.BEGAN, x: 2, y: 2 }, { state: State.ACTIVE, x: 2, y: 2 }, { state: State.END, x: 2, y: 2 }]));
  expect(room).toBeTruthy();
  expect(s.getByTestId('edit-room-view').props.layout).toBe(before);
  expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
});
```

(import `State` and the jest-utils as in `EditRoom.test.tsx`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editDrag.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no `drag.ts`, no drag gesture, no handle).

- [ ] **Step 3: `mobile/src/lib/room/edit/drag.ts`**

```ts
// A drag in the editor (spec 2026-10-15 §5.3): what the ghost snaps to under the finger, whether it may land there
// and why not, the ghost's rects (the piece and what stands on it, at the target) and its red copy, and the pan's
// limits (§5.6). Pure.
import { KIP_COLOURS, kipRamp, type KipColour } from '../../kip/kipArt';
import type { ItemContext } from '../items';
import type { ItemId } from '../loadout';
import type { Rects } from '../paint';
import { pieceLayers } from '../iso/art';
import { isoGrid, projOf, type IsoGrid } from '../iso/grid';
import type { Placement } from '../iso/geometry';
import { moveRects } from '../iso/prims';
import { anchorOf } from '../iso/room';
import { childrenOf } from '../layout';
import { inventory, type EditorState } from './editor';
import { placedAt, refusal, snapTarget, type Refused, type Target } from './targets';

/** The ghost sits this far above the finger, so the finger never hides it. */
export const LIFT_PT = 24;
/** A dragged piece this close to the room view's edge scrolls the room. */
export const EDGE_PT = 32;
const RED = 'rgba(248,113,113,0.6)';

export interface DragBase { item: ItemId; id: string | null; facing: 'L' | 'R'; mirror: boolean }
export interface Drag extends DragBase { cell: [number, number]; target: Target | null; refused: Refused | null }

export const targetKey = (t: Target | null): string =>
  !t ? '' : t.layer === 'onTop' ? `onTop:${t.parent}:${t.spot}` : `${t.layer}:${t.x}:${t.y}`;

export function dragAt(state: EditorState, base: DragBase, cell: [number, number]): Drag {
  const g = isoGrid(state.tier);
  const layout = state.draft.layout;
  const target = snapTarget(g, layout, base.item, cell, base.facing, base.id);
  if (!target) return { ...base, cell, target, refused: { reason: 'layer' } };
  if (base.id === null && !((inventory(state)[base.item] ?? 0) > 0)) return { ...base, cell, target, refused: { reason: 'outside' } };
  const piece = placedAt({ id: base.id ?? '__ghost', item: base.item, facing: base.facing, mirror: base.mirror }, target);
  return { ...base, cell, target, refused: refusal(layout, piece, state.tier, base.id === null) };
}

/** The ghost: the piece at its target (or under the finger when nothing snaps), what stands on it, and a red copy. */
export function ghostRects(state: EditorState, drag: Drag, c: { night: boolean; colour: KipColour }): { base: Rects; tint: Rects } {
  const g = isoGrid(state.tier);
  const P = projOf(g);
  const ctx: ItemContext = { weather: 'clear', night: c.night, colour: c.colour, ramp: kipRamp(KIP_COLOURS[c.colour]), screen: 'lines' };
  const layout = state.draft.layout;
  const piece: Placement = drag.target
    ? placedAt({ id: drag.id ?? '__ghost', item: drag.item, facing: drag.facing, mirror: drag.mirror }, drag.target)
    : { id: drag.id ?? '__ghost', item: drag.item, layer: 'floor', x: 0, y: 0, facing: drag.facing, mirror: drag.mirror };
  const byId = new Map(layout.pieces.map((p) => [p.id, p]));
  byId.set(piece.id, piece);
  const base: Rects = [];
  const put = (p: Placement, at: [number, number] | null) => {
    const l = at ? pieceLayers(p.item, ctx, { layer: p.layer, facing: p.facing, mirror: p.mirror }) : null;
    if (at && l) base.push(...moveRects(l.base ?? [], at[0], at[1]));
  };
  // Nothing snapped: the piece hangs at the finger as a floor piece would stand there.
  put(piece, drag.target ? anchorOf(P, piece, byId) : [Math.round(drag.cell[0]), Math.round(drag.cell[1]) - 6]);
  if (drag.id && drag.target) for (const child of childrenOf(layout, drag.id)) put(child, anchorOf(P, child, byId));
  const tint = drag.refused ? base.filter((q) => !q[4].startsWith('rgba')).map(([x, y, w, h]) => [x, y, w, h, RED] as Rects[number]) : [];
  return { base, tint };
}

/** The pan, clamped so the room's edges never show; a room narrower than the view stays centred (spec §5.6). */
export function clampPan(pan: { x: number; y: number }, view: { width: number; height: number }, g: IsoGrid, cellPt = 2): { x: number; y: number } {
  const axis = (v: number, size: number, cells: number) => {
    const room = cells * cellPt;
    if (room <= size) return Math.round((size - room) / 2);
    return Math.round(Math.min(0, Math.max(size - room, v)));
  };
  return { x: axis(pan.x, view.width, g.W), y: axis(pan.y, view.height, g.H) };
}
```

- [ ] **Step 4: Drag, ghost, pan and the handle in `mobile/src/components/edit/EditRoom.tsx`**

Make it a `forwardRef<EditRoomHandle, EditRoomProps>` and replace the gesture and state parts:

```tsx
import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { clampPan, dragAt, EDGE_PT, ghostRects, LIFT_PT, targetKey, type Drag, type DragBase } from '../../lib/room/edit/drag';
import { reasonText } from '../../lib/room/edit/labels';

export interface EditRoomHandle {
  lift(item: ItemId, absX: number, absY: number): void;
  move(absX: number, absY: number): void;
  drop(): void;
  cancel(): void;
}

export const EditRoom = forwardRef<EditRoomHandle, EditRoomProps>(function EditRoom(props, ref) {
  const { state, dispatch, width, height, window, colour, reduceMotion, showGrid } = props;
  const g = isoGrid(state.tier);
  const [pan, setPan] = useState(() => initialPan(state, width, height));
  const panStart = useRef(pan);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const lastKey = useRef('');
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const draft = displayDraft(state);
  const input = { layout: draft.layout, tier: state.tier, weather: window.weather, night: window.night, colour };
  const drawn = useMemo(() => drawIsoStatic(input), [isoRoomKey(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  const toCell = (x: number, y: number): [number, number] => [(x - pan.x) / EDIT_CELL_PT, (y - pan.y) / EDIT_CELL_PT];
  const show = (d: Drag | null) => { dragRef.current = d; setDrag(d); };
  /** Follows the finger (in the view's points): the ghost sits LIFT_PT above it, a new snap ticks (spec §5.3). */
  const follow = (base: DragBase, x: number, y: number) => {
    const d = dragAt(state, base, toCell(x, y - LIFT_PT));
    const key = targetKey(d.target);
    if (key !== lastKey.current) { lastKey.current = key; void Haptics.selectionAsync(); }
    // Near an edge, the room scrolls under the piece (spec §5.6).
    const dx = x < EDGE_PT ? 6 : x > width - EDGE_PT ? -6 : 0;
    const dy = y < EDGE_PT ? 6 : y > height - EDGE_PT ? -6 : 0;
    if (dx || dy) setPan((p) => clampPan({ x: p.x + dx, y: p.y + dy }, { width, height }, g));
    show(d);
  };
  const land = () => {
    const d = dragRef.current;
    show(null);
    lastKey.current = '';
    // The reducer checks the place again: an invalid drop changes nothing, the piece stays (or stays in the drawer).
    if (d?.target) dispatch({ type: 'drop', id: d.id, item: d.item, target: d.target });
  };

  useImperativeHandle(ref, () => ({
    lift: (item, absX, absY) => {
      viewRef.current?.measureInWindow?.((x, y) => { origin.current = { x, y }; });
      follow({ item, id: null, facing: 'L', mirror: false }, absX - origin.current.x, absY - origin.current.y);
    },
    move: (absX, absY) => { if (dragRef.current) follow(dragRef.current, absX - origin.current.x, absY - origin.current.y); },
    drop: land,
    cancel: () => show(null),
  }));

  const hold = Gesture.Pan()
    .activateAfterLongPress(200)
    .runOnJS(true)
    .withTestId('edit-room-drag')
    .onStart((e) => {
      const [cx, cy] = toCell(e.x, e.y);
      const id = pieceAt(drawn.hits, Math.floor(cx), Math.floor(cy));
      const p = id ? state.draft.layout.pieces.find((q) => q.id === id) : undefined;
      if (!p) return;
      dispatch({ type: 'select', id: p.id });
      follow({ item: p.item, id: p.id, facing: p.facing, mirror: p.mirror }, e.x, e.y + LIFT_PT);
    })
    .onUpdate((e) => { if (dragRef.current) follow(dragRef.current, e.x, e.y); })
    .onEnd(() => { if (dragRef.current) land(); })
    .onFinalize(() => { if (dragRef.current) show(null); });
  const look = Gesture.Pan()
    .minDistance(8)
    .runOnJS(true)
    .withTestId('edit-room-pan')
    .onBegin(() => { panStart.current = pan; })
    .onUpdate((e) => setPan(clampPan({ x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY }, { width, height }, g)));
  const tap = Gesture.Tap()
    .maxDuration(250)
    .runOnJS(true)
    .withTestId('edit-room-tap')
    .onEnd((e, ok) => {
      if (!ok) return;
      const [cx, cy] = toCell(e.x, e.y);
      dispatch({ type: 'select', id: pieceAt(drawn.hits, Math.floor(cx), Math.floor(cy)) });
    });

  const ghost = useMemo(() => (drag ? ghostRects(state, drag, { night: window.night, colour }) : null), [drag, state, window.night, colour]);
  const ghostPicture = useDisposed(useMemo(() => record([ghost?.base ?? []], EDIT_CELL_PT), [ghost]));
  const redPicture = useDisposed(useMemo(() => record([ghost?.tint ?? []], EDIT_CELL_PT), [ghost]));
  // …the overlay picture exactly as in Task 11…

  return (
    <GestureDetector gesture={Gesture.Race(hold, look, tap)}>
      <View ref={viewRef} testID="edit-room" style={{ width, height, overflow: 'hidden' }} accessibilityLabel={ROOM_COPY.edit.roomLabel}>
        <RoomView
          testID="edit-room-view"
          layout={draft.layout}
          tier={state.tier}
          worn={draft.worn}
          weather={window.weather}
          night={window.night}
          colour={colour}
          pose="rest"
          mood="glance"
          screen="lines"
          bubble={null}
          crop={{ width, height }}
          cellPt={EDIT_CELL_PT}
          offset={pan}
          hide={drag?.id ?? null}
          reduceMotion={reduceMotion}
          accessible={false}
        />
        <Canvas testID="edit-overlay" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
          <Group transform={[{ translateX: pan.x }, { translateY: pan.y }]}>
            <Picture picture={overlay} />
            {drag ? (
              <Group opacity={0.7}>
                <Picture picture={ghostPicture} />
              </Group>
            ) : null}
            {drag?.refused ? <Picture picture={redPicture} /> : null}
          </Group>
        </Canvas>
        {drag ? <View testID="edit-ghost" pointerEvents="none" /> : null}
        {drag?.refused ? <View testID="edit-ghost-red" pointerEvents="none" /> : null}
        {drag?.refused ? (
          <View pointerEvents="none" className="absolute bottom-2 left-0 right-0 items-center">
            <Text testID="edit-drag-reason" accessibilityLiveRegion="polite" className="rounded-lg bg-background/90 px-2 py-1 text-caption text-destructive">
              {reasonText(drag.refused, drag.item, state.draft.layout)}
            </Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
});
```

(`EditRoomProps` is the prop type from Task 11. Use the app's `Text` from `../ui/text`, not React Native's. The
static picture is rebuilt once on pick-up — `hide` joins its key — and once on drop, never while dragging: the ghost is
its own `Picture`, ruling 8 and spec §3.7.)

In `mobile/src/screens/DecorateRoomScreen.tsx` keep a `const roomRef = useRef<EditRoomHandle>(null);` and pass
`ref={roomRef}` to `EditRoom` (Task 13's drawer drives it).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editDrag.test.ts __tests__/components/EditRoom.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: PASS. (`jest-setup.js` already mocks `expo-haptics`.)

- [ ] **Step 6: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src/lib/room/edit/drag.ts mobile/src/components/edit/EditRoom.tsx mobile/src/screens/DecorateRoomScreen.tsx mobile/__tests__
git commit -m "feat(mobile): drag pieces in the editor with a 70% ghost that snaps to tiles, the wall grid and free spots, ticks, shows the reason in red, and lets go safely; pan the room"
```

---

### Task 13: The editor III: the inventory drawer (tabs, counts, Place, Replace desk, styles, KIP, sets, room full)

Spec §5.4 (the bottom sheet, half height, draggable to full; "Inventory · {n} not placed"; tabs All, Floor, Wall, On
top, Funny, New while anything is unseen, Room, KIP, Sets; tiles at least 64 points with icon, name, "×3", NEW, "All
placed" dimmed at ×0; locked pieces not in the drawer; tap selects and its row shows Place; hold to drag it in;
the Room tab's style rows; the KIP tab as Spec B §6.2; Sets with "Store everything and set up {set}?"; "How new things
arrive" last), §5.3 (room full: Place disabled, "Room is full", the card with Store a piece; the drawer's Replace desk
on a desk tile), §5.5 (sets as layouts; a locked set's Preview). Rulings 15, 16, 20 and the ledger items: "How new
things arrive" stores lead and body (Spec B Task 14), `SetCard` swatch keys use the index (Spec B Task 14). Review Focus
3 (the drawer half) and 5.

**Files:**
- Create: `mobile/src/lib/room/edit/drawer.ts`, `mobile/src/components/edit/InventoryDrawer.tsx`,
  `mobile/src/components/edit/RoomFullCard.tsx`
- Modify: `mobile/src/components/decorate/DecorateTile.tsx`, `mobile/src/components/decorate/SetCard.tsx`,
  `mobile/src/screens/DecorateRoomScreen.tsx`, `mobile/src/lib/room/roomCopy.ts`
- Delete: `mobile/src/lib/room/tray.ts`, `mobile/__tests__/lib/decorateTray.test.ts`
- Test: `mobile/__tests__/lib/editDrawer.test.ts`, `mobile/__tests__/components/InventoryDrawer.test.tsx`; extend
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9 (`inventory`, `canPlace`, `EditorState`, `EditorAction`, `DrawerTab`), Task 12 (`EditRoomHandle`),
  Spec B (`itemIcon` via `ItemIcon`, `wornArt`, `unlockLine`, `unlockSpoken`, `progressLine`, `progressFromAchievements`,
  `SET_SWATCHES`, `SET_NAMES`, `Kip`).
- Produces (`edit/drawer.ts`):
  - `interface DrawerTile { key: string; item: ItemId | null; name: string; count: number; isNew: boolean; allPlaced: boolean; locked: boolean; tag: string | null; label: string; selected: boolean }`;
  - `drawerTabs(s): DrawerTab[]`, `pieceTiles(s, tab): DrawerTile[]`, `notPlaced(s): number`,
    `styleRows(s): Array<{ key: StyleKey; tiles: DrawerTile[] }>`, `wornTiles(s, slot, facts): DrawerTile[]`,
    `interface SetCardModel` and `setCards(s, facts): SetCardModel[]` (moved from `tray.ts`).
- Produces (UI): `InventoryDrawer({ state, dispatch, room, colour, counters? })` where `room: RefObject<EditRoomHandle | null>`,
  `RoomFullCard({ cap, onStore })`; `DecorateTile` takes a `DrawerTile` and an optional `onLongPressDrag` set
  (`{ lift(absX, absY); move(absX, absY); drop() }`); gesture test id `drawer-drag-${item}`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/lib/editDrawer.test.ts`:

```ts
import { drawerTabs, notPlaced, pieceTiles, setCards, styleRows, wornTiles } from '../../src/lib/room/edit/drawer';
import { initEditor, editorReducer } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const FACTS = { levels: {}, recapsRead: 1, buddyCheers: 0 };
const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'corner.beanbag': 1, 'shelf.luckycat': 1, 'wall.brick': 1 };
const start = (newIds: string[] = []) => initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts, version: 1, newIds });

it('the tabs: New only while something was unseen when the editor opened (ruling 15)', () => {
  expect(drawerTabs(start())).toEqual(['all', 'floor', 'wall', 'onTop', 'funny', 'room', 'kip', 'sets']);
  expect(drawerTabs(start(['corner.beanbag']))).toContain('new');
});

it('lists owned placeable pieces with their inventory count; ×0 stays, dimmed, "All placed"', () => {
  const tiles = pieceTiles(start(), 'all');
  const fern = tiles.find((t) => t.item === 'plant.fern')!;
  const desk = tiles.find((t) => t.item === 'desk.monitor')!;
  expect([fern.count, fern.allPlaced, fern.label]).toEqual([2, false, 'Fern, 2 in inventory']);
  expect([desk.count, desk.allPlaced, desk.label]).toEqual([0, true, 'Monitor, all placed']);
  expect(tiles.some((t) => t.item === 'plant.monstera')).toBe(false); // locked: not in the drawer
  expect(tiles.some((t) => t.item === 'wall.plain')).toBe(false); // styles live on the Room tab
});

it('filters by layer and by the funny tag, and marks the new ones', () => {
  const s = start(['corner.beanbag']);
  expect(pieceTiles(s, 'wall').map((t) => t.item)).toEqual(expect.arrayContaining(['art.calendar', 'shelf.plank']));
  expect(pieceTiles(s, 'wall').some((t) => t.item === 'plant.fern')).toBe(false);
  expect(pieceTiles(s, 'onTop').some((t) => t.item === 'item.mug')).toBe(true);
  expect(pieceTiles(s, 'funny').map((t) => t.item).sort()).toEqual(['corner.beanbag', 'shelf.luckycat']);
  expect(pieceTiles(s, 'new').map((t) => [t.item, t.isNew])).toEqual([['corner.beanbag', true]]);
});

it('counts what is not placed for the header', () => {
  const s = start();
  const before = notPlaced(s);
  expect(notPlaced(editorReducer(s, { type: 'place', item: 'plant.fern' }))).toBe(before - 1);
});

it('the Room tab: one row per style, the current one selected, owned ones only', () => {
  const rows = styleRows(start());
  expect(rows.map((r) => r.key)).toEqual(['wallpaper', 'floor', 'window']);
  const walls = rows[0]!.tiles;
  expect(walls.find((t) => t.item === 'wall.plain')!.selected).toBe(true);
  expect(walls.map((t) => t.item)).toEqual(expect.arrayContaining(['wall.plain', 'wall.dots', 'wall.brick']));
  expect(walls.some((t) => t.item === 'wall.panel')).toBe(false);
});

it('the KIP tab keeps Spec B\'s worn tiles: None, owned, and locked ones with their unlock line', () => {
  const head = wornTiles(start(), 'head', FACTS);
  expect(head[0]).toMatchObject({ item: null, name: 'None' });
  expect(head.find((t) => t.item === 'out.beanie')!.locked).toBe(false);
  const cap = head.find((t) => t.item === 'out.cap')!;
  expect([cap.locked, cap.tag]).toEqual([true, 'Step goal · I']);
});

it('set cards: Cottage, locked here, with its pieces and unlock line', () => {
  const [cottage] = setCards(start(), FACTS);
  expect([cottage!.id, cottage!.owned, cottage!.line]).toEqual(['cottage', false, '13 pieces · Read 4 weekly recaps']);
});
```

`mobile/__tests__/components/InventoryDrawer.test.tsx`:

```tsx
import React, { createRef } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { InventoryDrawer } from '../../src/components/edit/InventoryDrawer';
import type { EditRoomHandle } from '../../src/components/edit/EditRoom';
import { initEditor } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

jest.mock('../../src/lib/achievementsStore', () => ({ ...jest.requireActual('../../src/lib/achievementsStore'), useAchievements: () => ({ state: { status: 'idle' } }) }));

const counts = { ...STARTER_COUNTS, 'plant.fern': 3, 'corner.beanbag': 1 };
const state = (over = {}) => ({ ...initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts, version: 1, newIds: [] }), ...over });
const room = () => {
  const ref = createRef<EditRoomHandle>() as React.MutableRefObject<EditRoomHandle | null>;
  ref.current = { lift: jest.fn(), move: jest.fn(), drop: jest.fn(), cancel: jest.fn() };
  return ref;
};

it('says how many pieces are not placed, with the tabs as a tablist (spec §5.4)', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-title')).toHaveTextContent(/^Inventory · \d+ not placed$/);
  expect(s.getByTestId('drawer-title').props.accessibilityLabel).not.toContain('·');
  expect(s.getByTestId('drawer-tabs').props.accessibilityRole).toBe('tablist');
  expect(s.getByTestId('drawer-tab-all').props.accessibilityState.selected).toBe(true);
});

it('tapping a tile picks it; its row shows Place; a desk tile shows Replace desk', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ picked: 'plant.fern' })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(s.getByTestId('drawer-tile-plant.fern'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'pick', item: 'plant.fern' });
  fireEvent.press(s.getByTestId('drawer-place'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'place', item: 'plant.fern' });
  const desk = render(<InventoryDrawer state={state({ picked: 'desk.notebook' })} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(desk.getByTestId('drawer-place')).toHaveTextContent('Replace desk');
});

it('a ×0 tile stays, dimmed, and Place is disabled for it', () => {
  const s = render(<InventoryDrawer state={state({ picked: 'rug.slate' })} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-tile-rug.slate')).toHaveTextContent(/All placed/);
  expect(s.getByTestId('drawer-place').props.accessibilityState.disabled).toBe(true);
});

it('holding a tile drags it into the room through the room\'s handle (ruling 16)', () => {
  const r = room();
  render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={r} colour="coral" />);
  const g = getByGestureTestId('drawer-drag-corner.beanbag');
  act(() => fireGestureHandler(g, [{ state: State.BEGAN, absoluteX: 10, absoluteY: 600 }, { state: State.ACTIVE, absoluteX: 10, absoluteY: 600 }, { state: State.ACTIVE, absoluteX: 200, absoluteY: 200 }, { state: State.END, absoluteX: 200, absoluteY: 200 }]));
  expect(r.current!.lift).toHaveBeenCalledWith('corner.beanbag', 10, 600);
  expect(r.current!.move).toHaveBeenCalledWith(200, 200);
  expect(r.current!.drop).toHaveBeenCalled();
});

it('the Room tab applies a style; Sets asks before setting up a set', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ drawer: 'room' })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(s.getByTestId('drawer-tile-wall.dots'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'style', key: 'wallpaper', item: 'wall.dots' });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const owned = { ...counts, ...Object.fromEntries(['set.cottage.wallpaper', 'set.cottage.floor', 'set.cottage.window', 'set.cottage.art', 'set.cottage.shelf', 'set.cottage.desk', 'set.cottage.desk_item', 'set.cottage.lamp', 'set.cottage.corner', 'set.cottage.rug', 'set.cottage.pet'].map((id) => [id, 1])) };
  const sets = render(<InventoryDrawer state={state({ drawer: 'sets', counts: owned })} dispatch={dispatch} room={room()} colour="coral" />);
  fireEvent.press(sets.getByTestId('decorate-set-cottage-action'));
  expect(alert.mock.calls[0]![0]).toBe('Store everything and set up Cottage?');
  (alert.mock.calls[0]![2] as Array<{ onPress?: () => void }>)[1]!.onPress!();
  expect(dispatch).toHaveBeenCalledWith({ type: 'applySet', setId: 'cottage' });
});

it('the room-full card (spec §5.3): Store a piece, no growing before P2 (Review Focus 5)', () => {
  const dispatch = jest.fn();
  const s = render(<InventoryDrawer state={state({ outcome: { ok: false, refused: { reason: 'full' }, id: null } })} dispatch={dispatch} room={room()} colour="coral" />);
  expect(s.getByTestId('room-full')).toHaveTextContent("KIP's room is full. 40 pieces fit this room. Store something to make space, or grow the room");
  expect(s.queryByText('See room sizes')).toBeNull();
  fireEvent.press(s.getByTestId('room-full-store'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'clearOutcome' });
  expect(s.getByTestId('room-full-hint')).toHaveTextContent('Tap a piece in the room, then Store.');
});

it('the drawer opens half height and grows to full', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  const half = s.getByTestId('drawer').props.style.height;
  fireEvent.press(s.getByTestId('drawer-handle'));
  expect(s.getByTestId('drawer').props.style.height).toBeGreaterThan(half);
  expect(s.getByTestId('drawer-handle').props.accessibilityLabel).toBe('Show less');
});

it('"How new things arrive" ends the drawer, each lead bold and its body after it', () => {
  const s = render(<InventoryDrawer state={state()} dispatch={jest.fn()} room={room()} colour="coral" />);
  expect(s.getByTestId('drawer-arrive-0')).toHaveTextContent(/^Badge families\. Sleep goal/);
});
```

Append to `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`:

```tsx
describe('the drawer in the editor (spec §5.4)', () => {
  it('Place puts the picked piece on the nearest free spot and selects it; the count goes up', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'plant.fern': 2 }, version: 2 }));
    fireEvent.press(s.getByTestId('drawer-tile-plant.fern'));
    fireEvent.press(s.getByTestId('drawer-place'));
    expect(s.getByTestId('edit-count')).toHaveTextContent('8 / 40 in room');
    expect(s.getByTestId('edit-tool-line')).toHaveTextContent('Fern · on the floor');
  });

  it('opens on New with the toasted piece picked when asked (spec §1 Toasts)', async () => {
    const s = await openEditor({ drawer: 'new', item: 'corner.beanbag' }, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, fresh: [{ itemId: 'corner.beanbag', source: 'anyFamily:2' }], version: 2 }));
    expect(s.getByTestId('drawer-tab-new').props.accessibilityState.selected).toBe(true);
    expect(s.getByTestId('drawer-tile-corner.beanbag').props.accessibilityState.selected).toBe(true);
  });

  it('a beanbag dragged in onto the chair goes back to the inventory, and says why (Review Focus 3)', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ counts: { ...STARTER_COUNTS, 'corner.beanbag': 1 }, version: 2 }));
    const before = s.getByTestId('edit-room-view').props.layout;
    const { x, y } = seatExit(s); // the chair's exit tile, in the room view's points
    act(() => fireGestureHandler(getByGestureTestId('drawer-drag-corner.beanbag'), [{ state: State.BEGAN, absoluteX: 20, absoluteY: 700 }, { state: State.ACTIVE, absoluteX: 20, absoluteY: 700 }, { state: State.ACTIVE, absoluteX: x, absoluteY: y }]));
    expect(s.getByTestId('edit-drag-reason')).toHaveTextContent("Blocks KIP's chair");
    act(() => fireGestureHandler(getByGestureTestId('drawer-drag-corner.beanbag'), [{ state: State.END, absoluteX: x, absoluteY: y }]));
    expect(s.getByTestId('edit-room-view').props.layout).toBe(before);
    expect(s.getByTestId('edit-undo').props.accessibilityState.disabled).toBe(true);
  });

  it('a style tile changes the room in one undo step', async () => {
    const s = await openEditor(undefined, cosmeticsDTO({ version: 2 }));
    fireEvent.press(s.getByTestId('drawer-tab-room'));
    fireEvent.press(s.getByTestId('drawer-tile-wall.dots'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).styles.wallpaper).toBe('wall.dots');
    fireEvent.press(s.getByTestId('edit-undo'));
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).styles.wallpaper).toBe('wall.plain');
  });
});
```

with this helper beside `openEditor` (the jest stand-in for `measureInWindow` leaves the room's origin at 0, 0, so
window and view points agree):

```tsx
import { initialPan, EDIT_CELL_PT } from '../../src/components/edit/EditRoom';
import { LIFT_PT } from '../../src/lib/room/edit/drag';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { initEditor } from '../../src/lib/room/edit/editor';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

function seatExit(_s: ReturnType<typeof render>) {
  const pan = initialPan(initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 2, newIds: [] }), 750, 320);
  const [x, y] = projOf(isoGrid(1))(3.5, 2.5);
  return { x: pan.x + x * EDIT_CELL_PT, y: pan.y + y * EDIT_CELL_PT + LIFT_PT };
}
```

(`750` is React Native's Jest window width; import `EMPTY_WORN` and the gesture utilities.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editDrawer.test.ts __tests__/components/InventoryDrawer.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no drawer).

- [ ] **Step 3: Copy (`mobile/src/lib/room/roomCopy.ts`)**

Replace `ROOM_COPY.arrive` with lead / body pairs (Spec B Task 14 minor) and add the drawer's copy:

```ts
  arrive: {
    title: 'How new things arrive',
    items: [
      { lead: 'Badge families.', body: 'Sleep goal, Steady bedtime, Step goal, Check-in, Best recovery week, Every day logged and Steadiest month each unlock pieces at levels 1 to 5.' },
      { lead: 'Any family.', body: 'Trophies, the rainbow rug and KIP’s crown come from reaching a level in any family.' },
      { lead: 'Recaps and buddies.', body: 'Reading weekly recaps and cheering buddies add decor and whole sets.' },
      { lead: null, body: 'Nothing is sold. The starter room is yours from day one, and items are never taken away.' },
    ],
  },
  drawer: {
    title: (n: number) => `Inventory · ${n} not placed`,
    titleSpoken: (n: number) => `Inventory, ${n} not placed`,
    tabsLabel: 'Inventory',
    tabs: { all: 'All', floor: 'Floor', wall: 'Wall', onTop: 'On top', funny: 'Funny', new: 'New', room: 'Room', kip: 'KIP', sets: 'Sets' },
    rows: { wallpaper: 'Walls', floor: 'Floor', window: 'Window' },
    count: (n: number) => `×${n}`,
    allPlaced: 'All placed',
    newTag: 'NEW',
    none: 'None',
    place: 'Place',
    replaceDesk: 'Replace desk',
    more: 'Show more',
    less: 'Show less',
    tile: {
      piece: (name: string, n: number, isNew: boolean) => `${name}, ${n ? `${n} in inventory` : 'all placed'}${isNew ? ', new' : ''}`,
      style: (name: string, current: boolean) => (current ? `${name}, in your room` : `${name}. Use it`),
      worn: (name: string, wearing: boolean) => (wearing ? `${name}, wearing` : `${name}. Wear it`),
      locked: (name: string, unlock: string, progress: string) => (progress ? `${name}, locked. ${unlock}. ${progress}` : `${name}, locked. ${unlock}`),
    },
    full: {
      text: (cap: number) => `KIP's room is full. ${cap} pieces fit this room. Store something to make space, or grow the room`,
      store: 'Store a piece',
      hint: 'Tap a piece in the room, then Store.',
    },
    applyConfirm: (name: string) => `Store everything and set up ${name}?`,
    applyGo: 'Set it up',
    applyKeep: 'Not now',
    previewing: (name: string) => `Previewing ${name}`,
    stopPreview: 'Stop preview',
  },
```

(The first `arrive` body now says "levels 1 to 5" rather than "I to V": Spec B's Task 8 minor said Roman numerals
read badly.) In `mobile/__tests__/lib/roomCopy.test.ts` line 35 becomes
`expect(ROOM_COPY.arrive.items.at(-1)!.body).toBe('Nothing is sold. The starter room is yours from day one, and items are never taken away.');`.

- [ ] **Step 4: The drawer's model, `mobile/src/lib/room/edit/drawer.ts`**

```ts
// The inventory drawer's content (spec 2026-10-15 §5.4), pure: which owned pieces each tab lists and their counts,
// the Room tab's style rows, the KIP tab's worn tiles (Spec B §6.2, locked ones included as previews), the set cards.
// Locked placeable pieces are not here: they live in the shop and the unlock list (P2).
import { wornArt } from '../../kip/wornArt';
import { CATALOGUE, catalogueItem, catalogueItemsFor, isoOf, type WornSlot } from '../catalogue';
import { isoArtOf } from '../iso/art';
import { STYLE_KEYS, type StyleKey } from '../iso/geometry';
import type { ItemId } from '../loadout';
import { ROOM_COPY, SET_NAMES, itemName, progressLine, spokenName, unlockLine, unlockSpoken, type ProgressFacts } from '../roomCopy';
import { SET_SWATCHES } from '../art';
import { inventory, type DrawerTab, type EditorState } from './editor';

export interface DrawerTile {
  key: string;
  item: ItemId | null;
  name: string;
  count: number;
  isNew: boolean;
  allPlaced: boolean;
  locked: boolean;
  tag: string | null;
  label: string;
  selected: boolean;
}

const D = ROOM_COPY.drawer;
const owned = (s: EditorState, id: ItemId) => (s.counts[id] ?? 0) > 0;

export function drawerTabs(s: EditorState): DrawerTab[] {
  return ['all', 'floor', 'wall', 'onTop', 'funny', ...(s.newIds.length ? (['new'] as const) : []), 'room', 'kip', 'sets'];
}

const inTab = (id: ItemId, tab: DrawerTab, newIds: readonly ItemId[]) => {
  const iso = isoOf(id)!;
  switch (tab) {
    case 'floor': return iso.layers.includes('floor');
    case 'wall': return iso.layers.includes('wall');
    case 'onTop': return iso.layers.includes('onTop');
    case 'funny': return !!catalogueItem(id)?.tags?.includes('funny');
    case 'new': return newIds.includes(id);
    default: return true;
  }
};

/** Owned pieces this build can draw, in catalogue order, with what is left to place. */
export function pieceTiles(s: EditorState, tab: DrawerTab): DrawerTile[] {
  const left = inventory(s);
  return CATALOGUE.items
    .filter((i) => i.iso && isoArtOf(i.id) && owned(s, i.id) && inTab(i.id, tab, s.newIds))
    .map((i) => {
      const count = left[i.id] ?? 0;
      const isNew = s.newIds.includes(i.id);
      return {
        key: i.id, item: i.id, name: itemName(i.id), count, isNew, allPlaced: count === 0, locked: false, tag: null,
        label: D.tile.piece(spokenName(i.id), count, isNew), selected: s.picked === i.id,
      };
    });
}

export function notPlaced(s: EditorState): number {
  const left = inventory(s);
  return CATALOGUE.items.filter((i) => i.iso && isoArtOf(i.id)).reduce((n, i) => n + (left[i.id] ?? 0), 0);
}

export function styleRows(s: EditorState): Array<{ key: StyleKey; tiles: DrawerTile[] }> {
  return STYLE_KEYS.map((key) => ({
    key,
    tiles: catalogueItemsFor(key).filter((i) => owned(s, i.id)).map((i) => {
      const current = s.draft.layout.styles[key] === i.id;
      return {
        key: i.id, item: i.id, name: itemName(i.id), count: 0, isNew: s.newIds.includes(i.id), allPlaced: false, locked: false,
        tag: null, label: D.tile.style(spokenName(i.id), current), selected: current,
      };
    }),
  }));
}

/** Spec B's KIP tab: None, then the slot's pieces this build can draw; locked ones preview (Spec B ruling 18). */
export function wornTiles(s: EditorState, slot: WornSlot, facts: ProgressFacts): DrawerTile[] {
  const current = s.draft.worn[slot];
  const none: DrawerTile = { key: `${slot}-none`, item: null, name: D.none, count: 0, isNew: false, allPlaced: false, locked: false, tag: null, label: D.tile.worn(D.none, current === null), selected: current === null };
  const items = catalogueItemsFor(slot).filter((i) => wornArt(i.id) && (!i.retired || owned(s, i.id)));
  return [none, ...items.map((i) => {
    const mine = owned(s, i.id);
    return {
      key: i.id, item: i.id, name: itemName(i.id), count: 0, isNew: s.newIds.includes(i.id), allPlaced: false, locked: !mine,
      tag: mine ? null : unlockLine(i.unlock),
      label: mine ? D.tile.worn(spokenName(i.id), current === i.id) : D.tile.locked(spokenName(i.id), unlockSpoken(i.unlock), progressLine(i.unlock, facts)),
      selected: current === i.id,
    };
  })];
}

export interface SetCardModel {
  id: string;
  name: string;
  swatches: readonly string[];
  pieces: number;
  line: string;
  spoken: string;
  owned: boolean;
}

export function setCards(s: EditorState, _facts: ProgressFacts): SetCardModel[] {
  return CATALOGUE.sets.map((set) => {
    const ids = [...Object.values(set.room), ...Object.values(set.worn)] as ItemId[];
    const all = ids.every((id) => owned(s, id) || catalogueItem(id)?.unlock.kind === 'starter');
    return {
      id: set.id, name: SET_NAMES[set.id] ?? set.id, swatches: SET_SWATCHES[set.id] ?? [], pieces: ids.length,
      line: ROOM_COPY.set.pieces(ids.length, unlockLine(set.unlock)), spoken: ROOM_COPY.set.piecesSpoken(ids.length, unlockSpoken(set.unlock)), owned: all,
    };
  });
}
```

Delete `mobile/src/lib/room/tray.ts` and `__tests__/lib/decorateTray.test.ts` (its `setCards` cases are in
`editDrawer.test.ts` now). `SetCard.tsx` imports `SetCardModel` from `../../lib/room/edit/drawer` and keys its
swatches by index (`card.swatches.map((c, i) => <View key={i} … />)`, Spec B Task 14 minor).

- [ ] **Step 5: The tile, `mobile/src/components/decorate/DecorateTile.tsx`**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from '../ui/text';
import { ItemIcon } from '../room/ItemIcon';
import type { KipColour } from '../../lib/kip/kipArt';
import type { DrawerTile } from '../../lib/room/edit/drawer';
import { ROOM_COPY } from '../../lib/room/roomCopy';

export interface TileDrag { lift(absX: number, absY: number): void; move(absX: number, absY: number): void; drop(): void }

// A drawer tile (spec 2026-10-15 §5.4): the icon, the name, "×3" or "All placed" (dimmed), a NEW tag; a locked worn
// piece at 45% with its unlock line. At least 64 points. A raw Pressable (one buttons-guard entry): a picture you tap
// to pick. Held 200 ms, it drags the piece into the room (ruling 16).
export function DecorateTile({ tile, colour, onPress, drag, testID }: { tile: DrawerTile; colour: KipColour; onPress: () => void; drag?: TileDrag; testID: string }) {
  const body = (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={tile.label}
      accessibilityState={{ selected: tile.selected }}
      onPress={onPress}
      className="min-h-[64px] w-[31%] gap-1 rounded-lg border border-border bg-card p-2"
      style={{ opacity: tile.locked ? 0.45 : tile.allPlaced ? 0.5 : 1, borderWidth: tile.selected ? 2 : 1, borderColor: tile.selected ? '#F5F5F4' : undefined }}
    >
      <View className="items-center justify-center rounded-md bg-background py-1">
        {tile.item ? <ItemIcon id={tile.item} colour={colour} /> : <View style={{ width: 48, height: 48 }} />}
      </View>
      <Text className="text-fine" numberOfLines={2}>{tile.name}</Text>
      <View className="flex-row flex-wrap items-center gap-1">
        {tile.tag ? <Text className="text-fine text-muted-foreground" numberOfLines={2}>{tile.tag}</Text> : null}
        {tile.item && !tile.locked && tile.count > 0 ? <Text className="text-fine text-muted-foreground">{ROOM_COPY.drawer.count(tile.count)}</Text> : null}
        {tile.allPlaced ? <Text className="text-fine text-muted-foreground">{ROOM_COPY.drawer.allPlaced}</Text> : null}
        {tile.isNew ? <Text className="rounded-lg border border-primary px-1 font-pixel text-label text-primary">{ROOM_COPY.drawer.newTag}</Text> : null}
      </View>
    </Pressable>
  );
  if (!drag || !tile.item || tile.allPlaced || tile.locked) return body;
  const hold = Gesture.Pan()
    .activateAfterLongPress(200)
    .runOnJS(true)
    .withTestId(`drawer-drag-${tile.item}`)
    .onStart((e) => drag.lift(e.absoluteX, e.absoluteY))
    .onUpdate((e) => drag.move(e.absoluteX, e.absoluteY))
    .onEnd(() => drag.drop());
  return <GestureDetector gesture={hold}>{body}</GestureDetector>;
}
```

(The buttons guard's `DecorateTile:testID` entry stays as it is: one raw button. Update its reason to "a drawer tile:
a piece you tap to pick or hold to drag (spec 2026-10-15 §5.4)".)

- [ ] **Step 6: The drawer and the room-full card**

`mobile/src/components/edit/RoomFullCard.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { ROOM_COPY } from '../../lib/room/roomCopy';

// F4 "Can't place · room full" (spec 2026-10-15 §5.3). Before P2 the only way on is to store a piece; P2 adds
// "See room sizes".
export function RoomFullCard({ cap, onStore }: { cap: number; onStore: () => void }) {
  return (
    <Card testID="room-full" className="gap-2 p-3" accessibilityLiveRegion="polite">
      <Text className="text-body">{ROOM_COPY.drawer.full.text(cap)}</Text>
      <View className="flex-row">
        <Button testID="room-full-store" variant="outline" onPress={onStore}>{ROOM_COPY.drawer.full.store}</Button>
      </View>
    </Card>
  );
}
```

`mobile/src/components/edit/InventoryDrawer.tsx`:

```tsx
import React, { useState, type RefObject } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { Kip } from '../kip/Kip';
import { DecorateTile } from '../decorate/DecorateTile';
import { SetCard } from '../decorate/SetCard';
import { RoomFullCard } from './RoomFullCard';
import type { EditRoomHandle } from './EditRoom';
import type { KipColour } from '../../lib/kip/kipArt';
import { useAchievements } from '../../lib/achievementsStore';
import { WORN_SLOTS, isoOf } from '../../lib/room/catalogue';
import { canPlace, displayDraft, inventory, type DrawerTab, type EditorAction, type EditorState } from '../../lib/room/edit/editor';
import { drawerTabs, notPlaced, pieceTiles, setCards, styleRows, wornTiles, type DrawerTile } from '../../lib/room/edit/drawer';
import { capFor } from '../../lib/room/iso/geometry';
import { ROOM_COPY, SET_NAMES, SLOT_TITLES, itemName, progressFromAchievements } from '../../lib/room/roomCopy';

const D = ROOM_COPY.drawer;
const PIECE_TABS: ReadonlySet<DrawerTab> = new Set(['all', 'floor', 'wall', 'onTop', 'funny', 'new']);
const NO_COUNTERS = { recapsRead: 0, buddyCheers: 0 };

// The inventory drawer (spec 2026-10-15 §5.4): a bottom panel, half the window's height, growing to most of it.
// Header "Inventory · n not placed", the tabs, the tiles, the picked tile's Place (or Replace desk) row, the room-full
// card, the Room / KIP / Sets tabs, and "How new things arrive" last.
export function InventoryDrawer({ state, dispatch, room, colour, counters = NO_COUNTERS }: {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  room: RefObject<EditRoomHandle | null>;
  colour: KipColour;
  /** The server's counters, for the KIP tab's progress lines ("3 of 10"). */
  counters?: { recapsRead: number; buddyCheers: number };
}) {
  const { height } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const [storeHint, setStoreHint] = useState(false);
  const facts = progressFromAchievements(useAchievements(), counters);
  const n = notPlaced(state);
  const tabs = drawerTabs(state);
  const picked = state.picked;
  const left = picked ? inventory(state)[picked] ?? 0 : 0;
  const isDesk = !!(picked && isoOf(picked)?.kipDesk);
  const roomFull = state.outcome && !state.outcome.ok && state.outcome.refused.reason === 'full';
  const tile = (t: DrawerTile, onPress: () => void, draggable = false) => (
    <DecorateTile
      key={t.key}
      testID={`drawer-tile-${t.item ?? t.key}`}
      tile={t}
      colour={colour}
      onPress={onPress}
      drag={draggable && t.item ? {
        lift: (x, y) => room.current?.lift(t.item!, x, y),
        move: (x, y) => room.current?.move(x, y),
        drop: () => room.current?.drop(),
      } : undefined}
    />
  );
  const applySet = (id: string) =>
    Alert.alert(D.applyConfirm(SET_NAMES[id] ?? id), undefined, [
      { text: D.applyKeep, style: 'cancel' },
      { text: D.applyGo, onPress: () => dispatch({ type: 'applySet', setId: id }) },
    ]);
  return (
    <View testID="drawer" className="border-t border-border bg-background" style={{ height: Math.round(height * (full ? 0.75 : 0.42)) }}>
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text testID="drawer-title" accessibilityLabel={D.titleSpoken(n)} className="font-pixel text-label text-muted-foreground">{D.title(n)}</Text>
        <Button testID="drawer-handle" variant="ghost" size="sm" accessibilityLabel={full ? D.less : D.more} onPress={() => setFull((v) => !v)}>
          {full ? D.less : D.more}
        </Button>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <View testID="drawer-tabs" accessibilityRole="tablist" accessibilityLabel={D.tabsLabel} className="flex-row gap-2">
          {tabs.map((tab) => (
            <Button key={tab} testID={`drawer-tab-${tab}`} accessibilityRole="tab" accessibilityState={{ selected: state.drawer === tab }}
              size="sm" variant={state.drawer === tab ? 'default' : 'outline'} onPress={() => dispatch({ type: 'drawer', tab })}>
              {D.tabs[tab]}
            </Button>
          ))}
        </View>
      </ScrollView>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {roomFull ? (
          <View className="px-4 pb-3">
            <RoomFullCard cap={capFor(state.tier)} onStore={() => { setStoreHint(true); dispatch({ type: 'clearOutcome' }); }} />
          </View>
        ) : null}
        {storeHint ? <Text testID="room-full-hint" className="px-4 pb-2 text-caption text-muted-foreground">{D.full.hint}</Text> : null}
        {PIECE_TABS.has(state.drawer) ? (
          <>
            {picked ? (
              <View testID="drawer-picked" className="flex-row items-center gap-3 px-4 pb-3">
                <Text className="shrink grow text-body">{`${itemName(picked)} ${D.count(left)}`}</Text>
                <Button
                  testID="drawer-place"
                  disabled={isDesk ? left === 0 : !canPlace(state, picked)}
                  onPress={() => dispatch({ type: isDesk ? 'replaceDesk' : 'place', item: picked } as EditorAction)}
                >
                  {isDesk ? D.replaceDesk : D.place}
                </Button>
              </View>
            ) : null}
            <View className="flex-row flex-wrap gap-2 px-4">
              {pieceTiles(state, state.drawer).map((t) => tile(t, () => dispatch({ type: 'pick', item: t.item }), true))}
            </View>
          </>
        ) : null}
        {state.drawer === 'room' ? styleRows(state).map((row) => (
          <View key={row.key} testID={`drawer-row-${row.key}`} className="gap-2 px-4 pb-3">
            <SectionLabel>{D.rows[row.key]}</SectionLabel>
            <View className="flex-row flex-wrap gap-2">{row.tiles.map((t) => tile(t, () => dispatch({ type: 'style', key: row.key, item: t.item! })))}</View>
          </View>
        )) : null}
        {state.drawer === 'kip' ? (
          <>
            <View className="items-center py-3">
              <Kip testID="drawer-kip" colour={colour} pose="wave" mood="idle" worn={displayDraft(state).worn} scale={6} />
            </View>
            {WORN_SLOTS.map((slot) => (
              <View key={slot} testID={`drawer-group-${slot}`} className="gap-2 px-4 pb-3">
                <SectionLabel>{SLOT_TITLES[slot]}</SectionLabel>
                <View className="flex-row flex-wrap gap-2">
                  {wornTiles(state, slot, facts).map((t) => tile(t, () => dispatch(t.locked ? { type: 'previewWorn', slot, item: t.item! } : { type: 'wear', slot, item: t.item })))}
                </View>
              </View>
            ))}
          </>
        ) : null}
        {state.drawer === 'sets' ? (
          <View className="gap-3 px-4">
            {state.preview?.kind === 'set' ? (
              <View className="flex-row items-center gap-2">
                <Text className="shrink grow text-caption text-muted-foreground">{D.previewing(SET_NAMES[state.preview.setId] ?? state.preview.setId)}</Text>
                <Button testID="drawer-stop-preview" variant="outline" size="sm" onPress={() => dispatch({ type: 'previewSet', setId: null })}>{D.stopPreview}</Button>
              </View>
            ) : null}
            {setCards(state, facts).map((card) => (
              <SetCard key={card.id} card={card} onApply={() => applySet(card.id)} onPreview={() => dispatch({ type: 'previewSet', setId: card.id })} />
            ))}
          </View>
        ) : null}
        <View testID="drawer-arrive" className="gap-2 px-4 pt-4">
          <SectionLabel>{ROOM_COPY.arrive.title}</SectionLabel>
          {ROOM_COPY.arrive.items.map(({ lead, body }, i) => (
            <Text key={i} testID={`drawer-arrive-${i}`} className={lead ? 'text-caption' : 'text-fine text-muted-foreground'}>
              {lead ? <Text className="text-caption font-semibold">{`${lead} `}</Text> : null}
              <Text className={lead ? 'text-caption text-muted-foreground' : 'text-fine text-muted-foreground'}>{body}</Text>
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
```


- [ ] **Step 7: The screen**

In `mobile/src/screens/DecorateRoomScreen.tsx` render the drawer last (outside the `ScrollView`, so it stays at the
bottom) and give the scroll room under it:

```tsx
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* …edit-editing: EditRoom, notices, toolbar, pieces list… */}
      </ScrollView>
      <View pointerEvents={saving ? 'none' : 'auto'}>
        <InventoryDrawer state={state} dispatch={act} room={roomRef} colour={me.colour} counters={cosmetics.counters} />
      </View>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editDrawer.test.ts __tests__/components/InventoryDrawer.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/conventions`
Expected: PASS (the buttons guard keeps one `DecorateTile:testID` entry; typography stays green).

- [ ] **Step 9: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add -A mobile/src mobile/__tests__
git commit -m "feat(mobile): the inventory drawer: tabs, counts, Place and Replace desk, drag in from a tile, room-wide styles, KIP's outfit, sets as layouts, and the room-full card"
```

---

### Task 14: The editor IV: everything without a drag (Move, the arrows, Up / Down, Put on…, announcements)

Spec §5.7 (everything works without a drag: Place from the drawer, then Move with four arrow Buttons along the tile
axes, Up / Down on a wall, Put on… listing the free surfaces; each nudge announces the result; 44-point targets;
spoken labels without "·"), §5.3 (Move starts nudge mode). The pieces list (Task 11) and Place (Task 13) are the rest of
the path.

**Files:**
- Create: `mobile/src/components/edit/NudgePad.tsx`
- Modify: `mobile/src/lib/room/edit/editor.ts` (`toFloor`), `mobile/src/lib/room/edit/targets.ts` (`nearestFloor`,
  `putOnOptions`), `mobile/src/lib/room/edit/labels.ts` (`movedText`), `mobile/src/components/edit/EditToolbar.tsx`
  (Move), `mobile/src/screens/DecorateRoomScreen.tsx` (announcements), `mobile/src/lib/room/roomCopy.ts`
- Test: `mobile/__tests__/components/NudgePad.test.tsx`; extend `mobile/__tests__/lib/editor.test.ts` and
  `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 9 (`nudge`, `putOn`, `nearestFree`, `refusal`, `placedAt`, `selectedTools`), Task 11 (`reasonText`,
  `pieceNoun`, the toolbar).
- Produces:
  - `editor.ts`: action `{ type: 'toFloor' }`;
  - `targets.ts`: `nearestFloor(g, layout, item, tier, near, base): Target | null`,
    `putOnOptions(state): Array<{ key: string; parent: string | null; spot: number; noun: string }>` (`parent: null` is
    the floor);
  - `labels.ts`: `movedText(layout, p): string`, `nudgeAnnouncement(state): string | null`;
  - `NudgePad({ state, dispatch })` with buttons `edit-nudge-${dir}`, `edit-put-${key}`, `edit-nudge-done`;
    `EditToolbar` gains `edit-move`.

- [ ] **Step 1: Write the failing tests**

Append to `mobile/__tests__/lib/editor.test.ts`:

```ts
describe('Put on… and back to the floor (spec §5.7)', () => {
  it('lists the free surfaces once each, and the floor for a piece that can stand there', () => {
    const fern = run(start(), { type: 'select', id: 'plant' });
    expect(putOnOptions(fern).map((o) => o.noun)).toEqual(['desk', 'wall plank']);
    const mug = run(start(), { type: 'select', id: 'deskitem' });
    expect(putOnOptions(mug).map((o) => o.noun)).toEqual(['desk', 'wall plank']); // its own desk's other free spot too
    const onDesk = run(start(), { type: 'select', id: 'plant' }, { type: 'putOn', parent: 'desk', spot: 1 }, { type: 'select', id: 'plant' });
    expect(putOnOptions(onDesk).some((o) => o.parent === null)).toBe(true);
    const down = run(onDesk, { type: 'toFloor' });
    expect(piece(down, 'plant')!.layer).toBe('floor');
  });
});
```

(import `putOnOptions` from `../../src/lib/room/edit/targets`.)

`mobile/__tests__/components/NudgePad.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { NudgePad } from '../../src/components/edit/NudgePad';
import { editorReducer, initEditor, type EditorAction } from '../../src/lib/room/edit/editor';
import { starterLayout } from '../../src/lib/room/layout';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { STARTER_COUNTS } from '../../jest-mocks/cosmeticsFixture';

const base = initEditor({ layout: starterLayout(), worn: EMPTY_WORN, tier: 1, counts: STARTER_COUNTS, version: 1, newIds: [] });
const nudging = (id: string) => [{ type: 'select', id }, { type: 'nudging', on: true }].reduce((s, a) => editorReducer(s, a as EditorAction), base);

it('a floor piece gets the four tile-axis arrows and Put on…; every target is 44 points; labels have no "·"', () => {
  const dispatch = jest.fn();
  const s = render(<NudgePad state={nudging('plant')} dispatch={dispatch} />);
  for (const dir of ['backLeft', 'backRight', 'frontLeft', 'frontRight']) expect(s.getByTestId(`edit-nudge-${dir}`)).toBeTruthy();
  expect(s.queryByTestId('edit-nudge-up')).toBeNull();
  fireEvent.press(s.getByTestId('edit-nudge-frontRight'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'nudge', dir: 'frontRight' });
  expect(s.getByTestId('edit-nudge-frontRight').props.accessibilityLabel).toBe('Move front right');
  for (const b of s.getAllByRole('button')) expect(String(b.props.accessibilityLabel ?? '')).not.toMatch(/·/);
  fireEvent.press(s.getByTestId('edit-put-desk'));
  expect(dispatch).toHaveBeenCalledWith({ type: 'putOn', parent: 'desk', spot: 1 });
});

it('a wall piece moves along its wall and up or down; an on-top piece only gets Put on…', () => {
  const wall = render(<NudgePad state={nudging('plank')} dispatch={jest.fn()} />);
  expect(['backLeft', 'frontRight', 'up', 'down'].every((d) => wall.queryByTestId(`edit-nudge-${d}`))).toBe(true);
  expect(wall.queryByTestId('edit-nudge-frontLeft')).toBeNull();
  const top = render(<NudgePad state={nudging('deskitem')} dispatch={jest.fn()} />);
  expect(top.queryByTestId('edit-nudge-frontRight')).toBeNull();
  expect(top.getByTestId('edit-put-plank')).toBeTruthy();
});
```

Append to `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`:

```tsx
describe('without dragging (spec §5.7)', () => {
  it('place, move, nudge and save with presses only; each nudge says where it went or why not', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const platform = Platform.OS;
    Platform.OS = 'ios';
    const s = await openEditor();
    fireEvent.press(s.getByTestId('edit-piece-plant'));
    fireEvent.press(s.getByTestId('edit-move'));
    fireEvent.press(s.getByTestId('edit-nudge-frontLeft'));
    expect(announce).toHaveBeenLastCalledWith('Moved. Tile 1, 2');
    fireEvent.press(s.getByTestId('edit-nudge-backRight'));
    fireEvent.press(s.getByTestId('edit-nudge-backRight'));
    expect(announce).toHaveBeenLastCalledWith("Can't move there: doesn't fit here");
    expect(s.getByTestId('edit-nudge-status')).toHaveTextContent("Can't move there: doesn't fit here");
    fireEvent.press(s.getByTestId('edit-nudge-done'));
    expect(s.getByTestId('edit-flip')).toBeTruthy();
    (putCosmetics as jest.Mock).mockImplementation(async (body) => cosmeticsDTO({ layout: body.layout, version: 3 }));
    await act(async () => { fireEvent.press(s.getByTestId('edit-done')); });
    expect(mockNav.goBack).toHaveBeenCalled();
    Platform.OS = platform;
  });
});
```

(import `AccessibilityInfo` and `Platform` from `react-native`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editor.test.ts __tests__/components/NudgePad.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx`
Expected: FAIL (no `putOnOptions`, `toFloor`, `NudgePad` or Move).

- [ ] **Step 3: Copy (`mobile/src/lib/room/roomCopy.ts`)**

Add to `ROOM_COPY.edit`:

```ts
    nudge: {
      dirs: { backLeft: 'Back left', backRight: 'Back right', frontLeft: 'Front left', frontRight: 'Front right', up: 'Up', down: 'Down' },
      label: (dir: string) => `Move ${dir.toLowerCase()}`,
      putOn: 'Put on…',
      on: (noun: string) => `On the ${noun}`,
      onFloor: 'On the floor',
      done: 'Done moving',
      moved: (where: string) => `Moved. ${where}`,
      cant: (why: string) => `Can't move there: ${why.charAt(0).toLowerCase()}${why.slice(1)}`,
      tile: (x: number, y: number) => `Tile ${x + 1}, ${y + 1}`,
      wallStep: (y: number) => `On the wall, ${y + 1} up`,
    },
```

- [ ] **Step 4: Targets and the reducer**

In `mobile/src/lib/room/edit/targets.ts`:

```ts
/** The free floor tile nearest `near` where the piece fits ("On the floor", spec §5.7), or null. */
export function nearestFloor(g: IsoGrid, layout: RoomLayout, item: ItemId, tier: Tier, near: readonly [number, number], base: Base): Target | null {
  const tiles: Target[] = [];
  for (let x = 0; x < g.n; x++) for (let y = 0; y < g.m; y++) tiles.push({ layer: 'floor', x, y });
  const ranked = tiles
    .map((t) => { const [x, y] = targetPoint(g, layout, item, t, base.facing); return { t, d: Math.hypot(x - near[0], y - near[1]) }; })
    .sort((a, b) => a.d - b.d || (targetKey(a.t) < targetKey(b.t) ? -1 : 1));
  for (const { t } of ranked) if (!refusal(layout, placedAt(base, t), tier, false)) return t;
  return null;
}

/** Put on…: each surface with a free spot the selected piece may take, once per surface, then the floor (spec §5.7). */
export function putOnOptions(state: Pick<EditorState, 'draft' | 'selected' | 'tier'>): Array<{ key: string; parent: string | null; spot: number; noun: string }> {
  const layout = state.draft.layout;
  const p = layout.pieces.find((q) => q.id === state.selected);
  const iso = p ? isoOf(p.item) : undefined;
  if (!p || !iso) return [];
  const out: Array<{ key: string; parent: string | null; spot: number; noun: string }> = [];
  if (iso.layers.includes('onTop')) {
    for (const parent of layout.pieces) {
      const spots = parent.layer === 'onTop' || parent.id === p.id ? undefined : isoOf(parent.item)?.surface?.spots;
      const spot = spots?.findIndex((_, k) => !refusal(layout, placedAt(p, { layer: 'onTop', parent: parent.id, spot: k }), state.tier, false)) ?? -1;
      if (spot >= 0) out.push({ key: parent.id, parent: parent.id, spot, noun: pieceNoun(parent.item) });
    }
  }
  if (p.layer === 'onTop' && iso.layers.includes('floor')) out.push({ key: 'floor', parent: null, spot: 0, noun: 'floor' });
  return out;
}
```

(Import the `EditorState` type from `./editor` and `pieceNoun` from `./labels`; `isoOf` and the file's own `targetKey`
are already there.)

In `mobile/src/lib/room/edit/editor.ts` add `| { type: 'toFloor' }` to `EditorAction`, import `nearestFloor` from
`./targets`, and add the case:

```ts
    case 'toFloor': {
      if (!selected) return s;
      const near = targetPoint(g, layout, selected.item, selected.layer === 'onTop' ? { layer: 'onTop', parent: selected.parent!, spot: selected.spot! } : { layer: selected.layer, x: selected.x, y: selected.y }, selected.facing);
      const t = nearestFloor(g, layout, selected.item, s.tier, near, selected);
      return t ? move(s, selected.id, placedAt(selected, t)) : refuse(s, { reason: 'outside' }, selected.id);
    }
```

- [ ] **Step 5: Labels, the pad and the toolbar's Move**

In `mobile/src/lib/room/edit/labels.ts`:

```ts
/** Where a piece is after a move, as announced: "Tile 4, 4", "On the wall, 11 up", "On the desk". */
export function movedText(layout: RoomLayout, p: Placement): string {
  const N = ROOM_COPY.edit.nudge;
  if (p.layer === 'floor') return N.tile(p.x, p.y);
  if (p.layer === 'wallL' || p.layer === 'wallR') return N.wallStep(p.y);
  const parent = layout.pieces.find((q) => q.id === p.parent);
  return N.on(parent ? pieceNoun(parent.item) : 'floor');
}

/** What a screen reader hears after a nudge or a Put on… (spec §5.7), or null when nothing was tried. */
export function nudgeAnnouncement(state: Pick<EditorState, 'outcome' | 'draft'>): string | null {
  const o = state.outcome;
  if (!o) return null;
  const layout = state.draft.layout;
  if (o.ok) {
    const p = layout.pieces.find((q) => q.id === o.id);
    return p ? ROOM_COPY.edit.nudge.moved(movedText(layout, p)) : null;
  }
  const p = layout.pieces.find((q) => q.id === o.id);
  return ROOM_COPY.edit.nudge.cant(reasonText(o.refused, p?.item ?? '', layout));
}
```

`mobile/src/components/edit/NudgePad.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Text } from '../ui/text';
import { selectedTools, type EditorAction, type EditorState, type NudgeDir } from '../../lib/room/edit/editor';
import { nudgeAnnouncement } from '../../lib/room/edit/labels';
import { putOnOptions } from '../../lib/room/edit/targets';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const N = ROOM_COPY.edit.nudge;
const TOOL = 'h-[44px]';

/** Which arrows a piece gets: the floor's four tile axes, a wall's own axis plus Up and Down, none on a surface. */
export function arrowsFor(layer: string): NudgeDir[] {
  if (layer === 'floor') return ['backLeft', 'backRight', 'frontLeft', 'frontRight'];
  if (layer === 'wallR') return ['backLeft', 'frontRight', 'up', 'down'];
  if (layer === 'wallL') return ['backRight', 'frontLeft', 'up', 'down'];
  return [];
}

// Moving without a drag (spec 2026-10-15 §5.7): arrow Buttons along the tile axes, Up / Down on a wall, Put on… the
// free surfaces, and Done moving. The last result is a polite live region (the screen also announces it on iOS).
export function NudgePad({ state, dispatch }: { state: EditorState; dispatch: (a: EditorAction) => void }) {
  const tools = selectedTools(state);
  if (!tools || !state.nudging) return null;
  const status = nudgeAnnouncement(state);
  return (
    <View testID="edit-nudge" className="gap-2 px-4 py-2">
      <View className="flex-row flex-wrap gap-2">
        {arrowsFor(tools.piece.layer).map((dir) => (
          <Button key={dir} testID={`edit-nudge-${dir}`} variant="outline" className={TOOL} accessibilityLabel={N.label(N.dirs[dir])} onPress={() => dispatch({ type: 'nudge', dir })}>
            {N.dirs[dir]}
          </Button>
        ))}
      </View>
      {putOnOptions(state).length ? (
        <View className="gap-1">
          <SectionLabel>{N.putOn}</SectionLabel>
          <View className="flex-row flex-wrap gap-2">
            {putOnOptions(state).map((o) => (
              <Button key={o.key} testID={`edit-put-${o.key}`} variant="outline" className={TOOL}
                onPress={() => dispatch(o.parent === null ? { type: 'toFloor' } : { type: 'putOn', parent: o.parent, spot: o.spot })}>
                {o.parent === null ? N.onFloor : N.on(o.noun)}
              </Button>
            ))}
          </View>
        </View>
      ) : null}
      {status ? <Text testID="edit-nudge-status" accessibilityLiveRegion="polite" className="text-caption text-muted-foreground">{status}</Text> : null}
      <View className="flex-row">
        <Button testID="edit-nudge-done" className={TOOL} onPress={() => dispatch({ type: 'nudging', on: false })}>{N.done}</Button>
      </View>
    </View>
  );
}
```

In `EditToolbar.tsx`: when `state.nudging` render `<NudgePad state={state} dispatch={dispatch} />` in place of the tool
row, and add Move first in the tool row:
`<Button testID="edit-move" variant="outline" className={TOOL} onPress={() => dispatch({ type: 'nudging', on: true })}>{T.move}</Button>`.

In `mobile/src/screens/DecorateRoomScreen.tsx` announce each nudge's result on iOS (Android reads the live region):

```tsx
  const lastSaid = useRef<Outcome | null>(null);
  useEffect(() => {
    if (!state.nudging || !state.outcome || state.outcome === lastSaid.current) return;
    lastSaid.current = state.outcome;
    const text = nudgeAnnouncement(state);
    if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [state.outcome, state.nudging]); // eslint-disable-line react-hooks/exhaustive-deps
```

(The reducer makes a new `outcome` object for each nudge, so a repeated identical refusal is announced again.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/lib/editor.test.ts __tests__/components/NudgePad.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/conventions`
Expected: PASS.

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(mobile): edit the room without dragging: Move with tile-axis arrows, Up and Down on a wall, Put on a surface, and every result announced"
```

---

### Task 15: The first week, P1 part: the welcome card and the guided first placement

Spec §11.1 (new users start with the starter layout; everyone gets the welcome card once across devices: "WELCOME
HOME!", the text, the welcome lantern "Free · in your inventory · glows at night", Place the lantern / Later; the
guided first placement: the drawer on New, the coach mark "Your first piece · Takes 10 seconds", 3 steps Drag onto the
lime tile, Turn, Done; Skip always; without drag (screen reader, or after 10 seconds) step 1 offers Place; it never
blocks the rest of the app; `RoomFirstWeek.welcomedAt`), C7. P2's first-week list is out of scope; `firstPlacedAt`
is already set by Task 4. Rulings 13, 18, 19.

**Files:**
- Create: `mobile/src/components/coach/RoomWelcomeCard.tsx`, `mobile/src/components/edit/CoachMark.tsx`
- Modify: `mobile/src/lib/room/cosmeticsStore.ts` (`markWelcomed`), `mobile/src/components/coach/RoomCard.tsx`,
  `mobile/src/screens/CoachScreen.tsx`, `mobile/src/lib/room/edit/overlay.ts` (`coachRects`),
  `mobile/src/components/edit/EditRoom.tsx`, `mobile/src/screens/DecorateRoomScreen.tsx`, `mobile/src/lib/room/roomCopy.ts`
- Test: `mobile/__tests__/components/RoomWelcomeCard.test.tsx`; extend `RoomCard.test.tsx`,
  `cosmeticsStore.test.tsx`, `CoachScreen.test.tsx`, `DecorateRoomScreen.test.tsx`

**Interfaces:**
- Consumes: Task 4's `POST /me/room/welcomed`; Task 10's `postRoomWelcomed`, `Cosmetics.welcomed`; Task 9's coach state
  (`CoachState`, `COACH_ITEM`, `{ type: 'coach' }`), Task 11's overlay.
- Produces: `markWelcomed(): Promise<void>`; `RoomCard` props `onPlaceLantern?: () => void`;
  `RoomWelcomeCard({ onPlace, onLater })`; `CoachMark({ state, dispatch })`; `coachRects(g, tile): Rects`;
  `ROOM_COPY.welcome`, `ROOM_COPY.coach`.

- [ ] **Step 1: Write the failing tests**

`mobile/__tests__/components/RoomWelcomeCard.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RoomWelcomeCard } from '../../src/components/coach/RoomWelcomeCard';

it('welcomes you home with the free lantern, Place the lantern and Later (spec §11.1, C7)', () => {
  const onPlace = jest.fn();
  const onLater = jest.fn();
  const s = render(<RoomWelcomeCard onPlace={onPlace} onLater={onLater} />);
  expect(s.getByText("This is KIP's room. Make it yours: drag pieces in, flip them, stack them.")).toBeTruthy();
  expect(s.getByTestId('welcome-lantern')).toHaveTextContent('A welcome lanternFree · in your inventory · glows at night');
  expect(s.getByTestId('welcome-lantern').props.accessibilityLabel).toBe('A welcome lantern. Free, in your inventory, glows at night');
  fireEvent.press(s.getByTestId('welcome-place'));
  fireEvent.press(s.getByTestId('welcome-later'));
  expect([onPlace.mock.calls.length, onLater.mock.calls.length]).toEqual([1, 1]);
});
```

Append to `mobile/__tests__/components/RoomCard.test.tsx` (mock `postRoomWelcomed` in its `api/cosmetics` mock):

```tsx
it('shows the welcome once until it is answered, with KIP saying WELCOME HOME!; Later hides it for good', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const onPlaceLantern = jest.fn();
  const s = renderCard({ onPlaceLantern });
  expect(s.getByTestId('room-welcome')).toBeTruthy();
  expect(s.getByTestId('kip-room').props.room.split(':')[2]).toBe('WELCOME HOME!');
  await act(async () => { fireEvent.press(s.getByTestId('welcome-later')); });
  expect(postRoomWelcomed).toHaveBeenCalledTimes(1);
  expect(s.queryByTestId('room-welcome')).toBeNull();
});

it('Place the lantern answers the welcome and opens the guided placement', async () => {
  (fetchCosmetics as jest.Mock).mockResolvedValue(cosmeticsDTO({ welcomed: false }));
  await act(async () => { await loadCosmetics(); });
  const onPlaceLantern = jest.fn();
  const s = renderCard({ onPlaceLantern });
  await act(async () => { fireEvent.press(s.getByTestId('welcome-place')); });
  expect([onPlaceLantern.mock.calls.length, (postRoomWelcomed as jest.Mock).mock.calls.length]).toEqual([1, 1]);
});
```

Append to `mobile/__tests__/lib/cosmeticsStore.test.tsx` (mock `postRoomWelcomed` too):

```tsx
it('markWelcomed hides the welcome at once and tells the server; an older read cannot bring it back', async () => {
  get.mockResolvedValueOnce({ ...DTO, welcomed: false });
  await act(async () => { await loadCosmetics(); });
  const late = deferredGet();
  const pending = loadCosmetics();
  await act(async () => { await markWelcomed(); });
  expect(getCosmetics()!.welcomed).toBe(true);
  expect(postRoomWelcomed).toHaveBeenCalled();
  await act(async () => { late.resolve({ ...DTO, welcomed: false }); await pending; });
  expect(getCosmetics()!.welcomed).toBe(true);
});
```

(`deferredGet` is the file's existing helper; if its signature differs, make the GET hang with
`get.mockReturnValueOnce(new Promise(...))` as the sign-out test does.)

In `mobile/__tests__/screens/CoachScreen.test.tsx`, beside the two Decorate tests:

```tsx
it('the welcome card\'s Place the lantern opens the editor on the guided placement', async () => {
  // …render the KIP page as the Decorate tests do, with cosmeticsDTO({ welcomed: false }) from fetchCosmetics…
  await act(async () => { fireEvent.press(screen.getByTestId('welcome-place')); });
  expect(mockNavigate).toHaveBeenCalledWith('DecorateRoom', { drawer: 'new', item: 'lamp.welcome', coach: true });
});
```

Append to `mobile/__tests__/screens/DecorateRoomScreen.test.tsx`:

```tsx
describe('the guided first placement (spec §11.1)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('walks the three steps: place the lantern on the lime tile, Turn, then Done; Skip ends it', async () => {
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    expect(s.getByTestId('coach-mark')).toHaveTextContent(/Your first piece.*Takes 10 seconds/);
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 1 of 3');
    expect(s.queryByTestId('coach-place')).toBeNull();
    act(() => { jest.advanceTimersByTime(10_000); });
    fireEvent.press(s.getByTestId('coach-place')); // without a drag, after 10 seconds
    expect(JSON.parse(s.getByTestId('edit-room-view').props.layout).pieces.find((p: { item: string }) => p.item === 'lamp.welcome')).toMatchObject({ x: 5, y: 3 });
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 2 of 3');
    fireEvent.press(s.getByTestId('edit-turn'));
    expect(s.getByTestId('coach-step')).toHaveTextContent('Step 3 of 3');
    fireEvent.press(s.getByTestId('coach-skip'));
    expect(s.queryByTestId('coach-mark')).toBeNull();
  });

  it('offers Place at once to a screen reader', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const s = await openEditor({ drawer: 'new', item: 'lamp.welcome', coach: true });
    await act(async () => undefined);
    expect(s.getByTestId('coach-place')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node node_modules/.bin/jest --forceExit __tests__/components/RoomWelcomeCard.test.tsx __tests__/components/RoomCard.test.tsx __tests__/lib/cosmeticsStore.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/screens/CoachScreen.test.tsx`
Expected: FAIL (no welcome, no coach mark).

- [ ] **Step 3: Copy (`mobile/src/lib/room/roomCopy.ts`)**

```ts
  welcome: {
    bubble: 'WELCOME HOME!',
    text: "This is KIP's room. Make it yours: drag pieces in, flip them, stack them.",
    lanternName: 'A welcome lantern',
    lanternLine: 'Free · in your inventory · glows at night',
    lanternSpoken: 'A welcome lantern. Free, in your inventory, glows at night',
    place: 'Place the lantern',
    later: 'Later',
  },
  coach: {
    title: 'Your first piece',
    sub: 'Takes 10 seconds',
    step: (n: number) => `Step ${n} of 3`,
    steps: ['Drag the lantern onto the lime tile. It snaps to the grid.', 'Now tap Turn. It faces the other way.', 'Tap Done to keep it.'] as const,
    next: ['Next: turn it, then tap Done.', 'Next: tap Done.', ''] as const,
    labels: ['Drag', 'Turn', 'Done'] as const,
    skip: 'Skip',
    place: 'Place it on the lime tile',
  },
```

- [ ] **Step 4: The store, the card and the KIP page**

`mobile/src/lib/room/cosmeticsStore.ts`:

```ts
/** The welcome card was answered (spec §11.1): hidden at once here, recorded on the server for every device. */
export async function markWelcomed(): Promise<void> {
  epoch++; // a read that started before this never brings the card back
  if (cosmetics && !cosmetics.welcomed) publish({ ...cosmetics, welcomed: true });
  try {
    await postRoomWelcomed();
  } catch {
    // Still unanswered on the server: the next read shows the card again, which is harmless.
  }
}
```

`mobile/src/components/coach/RoomWelcomeCard.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { ItemIcon } from '../room/ItemIcon';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const W = ROOM_COPY.welcome;

// C7 "Day 1" (spec 2026-10-15 §11.1): shown once, across devices, under the room until it is answered. P2 adds the
// coins line. It never blocks the page: the chat below works as always.
export function RoomWelcomeCard({ onPlace, onLater }: { onPlace: () => void; onLater: () => void }) {
  return (
    <Card testID="room-welcome" className="gap-3 p-3">
      <Text className="text-body">{W.text}</Text>
      <View testID="welcome-lantern" accessible accessibilityLabel={W.lanternSpoken} className="flex-row items-center gap-3">
        <View className="items-center justify-center rounded-lg bg-background p-1">
          <ItemIcon id="lamp.welcome" colour="coral" />
        </View>
        <View className="shrink gap-0.5">
          <Text className="text-body font-semibold">{W.lanternName}</Text>
          <Text className="text-caption text-muted-foreground">{W.lanternLine}</Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button testID="welcome-place" className="flex-1" onPress={onPlace}>{W.place}</Button>
        <Button testID="welcome-later" variant="outline" className="flex-1" onPress={onLater}>{W.later}</Button>
      </View>
    </Card>
  );
}
```

`mobile/src/components/coach/RoomCard.tsx`: add `onPlaceLantern?: () => void` to the props, and

```tsx
  const cosmetics = useCosmetics();
  const welcome = !!cosmetics && !cosmetics.welcomed && stage.id !== 'loading';
  // …the RoomView's bubble becomes: bubble={welcome ? ROOM_COPY.welcome.bubble : stage.bubble}
  // …and after the frame, before the caption row:
      {welcome ? (
        <RoomWelcomeCard
          onPlace={() => { void markWelcomed(); onPlaceLantern?.(); }}
          onLater={() => { void markWelcomed(); }}
        />
      ) : null}
```

In `mobile/src/screens/CoachScreen.tsx`:

```tsx
  const placeLantern = useCallback(() => navigation.navigate('DecorateRoom', { drawer: 'new', item: COACH_ITEM, coach: true }), [navigation]);
  // …<RoomCard … onPlaceLantern={placeLantern} />
```

(import `COACH_ITEM` from `../lib/room/edit/targets`).

- [ ] **Step 5: The coach mark and the lime tile**

In `mobile/src/lib/room/edit/overlay.ts`:

```ts
const LIME = '#A3E635';
/** The guided placement's lime tile (C7): a filled diamond with a lime edge. */
export function coachRects(g: IsoGrid, tile: readonly [number, number]): Rects {
  const P = projOf(g);
  const r: Rects = [];
  const [x, y] = tile;
  flat(r, P, x, y, 1, 1, 'rgba(163,230,53,0.4)');
  line(r, P(x, y), P(x + 1, y), LIME);
  line(r, P(x, y + 1), P(x + 1, y + 1), LIME);
  line(r, P(x, y), P(x, y + 1), LIME);
  line(r, P(x + 1, y), P(x + 1, y + 1), LIME);
  return r;
}
```

(import `flat` from `../iso/prims`.) In `EditRoom.tsx` the overlay picture gains a third layer:
`state.coach?.step === 1 ? coachRects(g, state.coach.tile) : []` (add `state.coach?.step` to its memo deps).

`mobile/src/components/edit/CoachMark.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import type { EditorAction, EditorState } from '../../lib/room/edit/editor';
import { COACH_ITEM } from '../../lib/room/edit/targets';
import { ROOM_COPY } from '../../lib/room/roomCopy';

const C = ROOM_COPY.coach;
export const COACH_PLACE_AFTER_MS = 10_000;

// The guided first placement (spec 2026-10-15 §11.1, C7 "Your first piece"): three steps, Skip always there. Without
// a drag (a screen reader, or after 10 seconds) step 1 offers to place the lantern on the lime tile.
export function CoachMark({ state, dispatch }: { state: EditorState; dispatch: (a: EditorAction) => void }) {
  const [offerPlace, setOfferPlace] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => { if (live && on) setOfferPlace(true); });
    const t = setTimeout(() => setOfferPlace(true), COACH_PLACE_AFTER_MS);
    return () => { live = false; clearTimeout(t); };
  }, []);
  const coach = state.coach;
  if (!coach) return null;
  const k = coach.step - 1;
  return (
    <View testID="coach-mark" accessibilityRole="summary" className="mx-4 my-2 gap-1 rounded-lg bg-card p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-body font-semibold">{`${C.title} · ${C.sub}`}</Text>
        <Button testID="coach-skip" variant="ghost" size="sm" onPress={() => dispatch({ type: 'coach', step: null })}>{C.skip}</Button>
      </View>
      <Text testID="coach-step" className="font-pixel text-label text-muted-foreground">{C.step(coach.step)}</Text>
      <Text className="text-body">{C.steps[k]}</Text>
      {C.next[k] ? <Text className="text-caption text-muted-foreground">{C.next[k]}</Text> : null}
      {coach.step === 1 && offerPlace ? (
        <View className="flex-row pt-1">
          <Button testID="coach-place" onPress={() => dispatch({ type: 'drop', id: null, item: COACH_ITEM, target: { layer: 'floor', x: coach.tile[0], y: coach.tile[1] } })}>
            {C.place}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
```

(The spoken title reads "Your first piece · Takes 10 seconds": give the title `Text` an
`accessibilityLabel={`${C.title}. ${C.sub}`}` so no "·" is spoken.) In `DecorateRoomScreen.tsx` render
`<CoachMark state={state} dispatch={act} />` just above the drawer.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node node_modules/.bin/jest --forceExit __tests__/components/RoomWelcomeCard.test.tsx __tests__/components/RoomCard.test.tsx __tests__/lib/cosmeticsStore.test.tsx __tests__/screens/DecorateRoomScreen.test.tsx __tests__/screens/CoachScreen.test.tsx __tests__/conventions`
Expected: PASS (`kipCopy` green: the new strings write KIP in capitals).

- [ ] **Step 7: Full mobile suite, typecheck, commit**

Full mobile suite (green), mobile tsc (10).

```bash
git add mobile/src mobile/__tests__
git commit -m "feat(mobile): the welcome to KIP's room, once across devices, and the guided first placement with the lime tile, Turn and Done"
```

---

### Task 16: Whole-branch verification, the final review, the run-folder sync and the simulator check (controller)

- [ ] **Step 1: Suites, typechecks and guards**
  - Full backend suite with `backend-jest.sh` (no path), then backend `tsc --noEmit -p .`. Expected: green, 0.
  - `schema-drift.sh`. Expected: `no drift`.
  - Full mobile suite and the mobile typecheck. Expected: green, 10 (or the count recorded in the ledger).
  - `__tests__/conventions` alone: `buttons`, `typography`, `kipCopy`, `noCharacters`, `kipWorn` all pass; the buttons
    guard has no `HotspotLayer` entry and one `DecorateTile:testID` entry.
  - `node scripts/room-art-size.mjs` (under 300 KB) and `ROOM_PERF=1 node node_modules/.bin/jest --forceExit __tests__/perf`;
    record both in the ledger.
  - From `backend/`, run `scripts/export-cosmetics.ts` and confirm `git status` shows no change to
    `mobile/src/lib/room/catalogue.json` or `mobile/src/lib/room/iso/geometry.ts`.
  - `git diff 086f772 -- mobile/src/components/social/CampScene.tsx mobile/src/components/social/CampBanner.tsx` is
    empty (OVERRIDE-P13).
  - `grep -rnE "console\.(info|log|warn|error)" backend/src/room backend/src/cosmetics backend/scripts/convert-room-layouts.ts`:
    every line logs an event name and counts only (no user id, item id, layout or count map).
- [ ] **Step 2: The final review:** run the whole-branch review on opus with
  `review-package docs/superpowers/plans/2026-10-15-kip-freebuild-p1.md 00aa195 HEAD`, then one fix wave. The reviewer
  checks, row by row:
  - spec §2.1 against `catalogue.ts` (every placeable item's `iso`, `kipDesk` on every desk, `SHIPPED_RELEASES`,
    `RELEASE_LAUNCHED_AT` complete, the release-3 pieces);
  - §2.2–2.4 against `room/layout.ts`, `convert.ts` and `loadout.ts` (counts; the read-time backstop; the lazy
    conditional write with `Prisma.DbNull` and no version bump; the script; the conversion table cell by cell);
  - §12's P1 error list against `checkLayout` and `validateLayout` (every code, its status, the order of the checks, the
    version bound, the 32 KB cap, the lock);
  - §3 against `iso/room.ts` (draw order, children, KIP's insertion, light, emissive, frames);
  - §5 against the editor (each behaviour in §5.2–§5.7) and §11.1 against the welcome and the coach mark;
  - the privacy rules (no user id with item ids, layouts or counts in any log; nothing cosmetic in the coach; no room
    data in a buddy DTO) and the deletion list (`RoomFirstWeek` in `USER_OWNED_MODELS`);
  - the five Review Focus lines, and the ledger items folded in (ruling 24).
- [ ] **Step 3: Sync to the run folder** (`~/dev/biometrics-run`, outside iCloud):
  1. Back up the dev DB with `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/backup-db.sh` (`pg_dump -Fc`, only when
     `DATABASE_URL` is local; never print the URL). Confirm the dump's byte count is non-zero.
  2. `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/sync-run.sh`: rsyncs `backend/` (excluding `node_modules`,
     `.env`, `dist`), runs `npx prisma migrate deploy` (applies `20261016120000_freebuild`), then
     `scripts/convert-room-layouts.ts` (expected: one `room.converted` line with the count of Spec B rows converted;
     run it twice and the second says `converted: 0`), `npm install`, `npx prisma generate`, `npm run build`; then
     syncs `mobile/` (excluding `node_modules`, `ios`, `android` and every `.env*`, ruling 26) and runs `npm install`.
     No native module is added, so no prebuild or `xcodebuild`.
  3. Restart the API on :3000.
  4. Restart Metro on localhost: `bash .superpowers/sdd/2026-10-15-kip-freebuild-p1/metro-local.sh` (it checks that
     `~/dev/biometrics-run/mobile/.env.development.local` sets `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`, runs
     `npx expo start --dev-client --clear` from `~/dev/biometrics-run/mobile`, and reopens the dev client on the
     DeviceHub simulator).
- [ ] **Step 4: Simulator check, with screenshots** (`xcrun simctl io booted screenshot <file>` into
  `.superpowers/sdd/2026-10-15-kip-freebuild-p1/shots/`). With the demo account (its Spec B room converted by the
  script) and a fresh test account (the welcome):
  - **The KIP page:** the iso room in the 240-point card, cropped on the desk, KIP at the desk, the window's weather,
    the bubble over KIP's head; the collapsed thumbnail on the desk; a long-press opens the editor.
  - **The welcome (fresh account):** "WELCOME HOME!" over KIP, the card, Later hides it; sign in on a second simulator
    or after reinstall: it does not return. With another fresh account, Place the lantern: the coach mark, the lime
    tile, drag the lantern onto it, Turn, Done; Skip on a third run.
  - **The editor:** EDITING, "7 / 40 in room", the grid (toggle it), tap a piece (outline, toolbar line), Flip, Turn
    (and greyed for a fern), Another, Store the plank (the books go too; Undo), drag a fern (the ghost at 70%, the tick,
    red with "Blocks KIP's chair" over the chair's exit tile, letting go puts it back), drag a mug onto the desk's free
    spot, pan a loft-sized room if one is seeded, Done (the KIP page shows it).
  - **The drawer:** the tabs (New after unlocking a piece), "×n" and "All placed", Place, Replace desk (Notebook), the
    Room tab's three rows, the KIP tab (Beanie), Sets (Cottage, if owned: the confirm, the layout; or Preview).
  - **Room full:** with a seeded 40-piece room, Place is disabled, a drag-in reads "Room is full", the card's Store a
    piece.
  - **The refresh path:** save from the simulator, then `PUT` a different layout for the same account with curl
    (version from `GET /me/cosmetics`), then Done again on the simulator: "Something changed on another device" and the
    server's room.
  - **Without dragging:** with VoiceOver on, the pieces list, Move, the arrows' announcements ("Moved. Tile 2, 1",
    "Can't move there: …"), Put on… the desk, Done.
  - **Night and Reduce Motion:** the room at night (the veil, the lamp and monitor glows, the screen loop clipped behind
    KIP); with Reduce Motion on, the loops stop.
  - **By hand, the budget (spec §3.7):** dragging stays smooth (no hitch while the ghost moves), a drop redraws at once.
  - Light mode and the largest text size: the editor's header, toolbar, drawer tiles and coach mark stay readable.
- [ ] **Step 5: Report to the owner** with the screenshots, the perf and size numbers and the OWNER NOTES (ruling 1:
  both release dates; ruling 2: the footprint axes; ruling 3: billboards are `facings: 1`). Push the branch
  (`git push -u origin feature/kip-freebuild`; never main, never force). Open a PR only when the owner asks, with no
  attribution footer.

---

## Self-review (2026-10-15, against the spec and the real code on `feature/kip-freebuild` 00aa195)

**Spec coverage, P1 only:**

| Spec | Task |
| --- | --- |
| §0 standing rules (earn only, frozen Campfire, buttons, A4 type, privacy, civil dates) | Global Constraints; 4 (no-coach import guard), 10 and 15 (frozen check), 11–15 (buttons, type) |
| §1 changes: placements, iso, counts, edit mode, styles, categories; HotspotLayer / hotspots / HOTSPOT_CELLS deleted; DecorateTray becomes the drawer; DecorateTile and SetCard reused | 1–3, 5–8, 10, 13 |
| §1 kept: ids, unlock rows, worn, store guards, toasts' Decorate opens New, Spec A lighting | 1 (ids snapshot), 10 (store guards, decorateTarget), 8 (lighting) |
| §2.1 iso blocks, spots, on-top rule, `SHIPPED_RELEASES`, full `RELEASE_LAUNCHED_AT`, `shelf.plank`, `lamp.welcome`, `kipDesk` on every desk; `grants`, `price`, `shop`, `tags` seams | 1 (`price` / `shop` not added: P2 owns them; `grants` and `tags` added) |
| §2.2 counts, read-time backstop, the shared advisory lock (gift-send is P4) | 3, 4 |
| §2.3 the layout on `CosmeticLoadout`, `tier` on the row, no row = starter | 3 |
| §2.4 migration, `layoutFromSlots` from the sanitised room, lazy GET with `Prisma.DbNull`, the script, the conversion table, `update_app`, derived `room` | 2, 3, 4 |
| §3.1–3.7 grid, footprints, seat and exit tile, walls and windows, stacking, depth sort, Flip and Turn, KIP at the desk, rendering | 2 (rules), 5–8; walking (§3.6, §9.2) is P3 |
| §4 art pipeline: code art, two facings, styles as textures, icons, size budget, P1 contents | 6, 7, 10 (size script) |
| §5.1–5.7 entry points, layout, moving, drawer, sets as layouts, panning, without dragging | 10–14 |
| §9.1 the room card | 10, 15 |
| §11.1 starter layout, welcome, guided first placement, `RoomFirstWeek`, `firstPlacedAt` | 2, 3, 4, 15 |
| §12 P1 endpoints, errors, concurrency, deletion, telemetry, nothing cosmetic to the model | 3, 4 |
| §13 carried items for P1 (release 3's date, the PUT bound, the slot guards, OVERRIDE-P13, hotspot device checks moot) | 1, 4, 7, 10 |
| §15 rules, §16 P1 tests | Global Constraints; each task's Step 1 |
| §6–8, §9.2, §10, §11.2, P2–P4 rows of §12 | not built (out of P1) |

**Where the spec cannot be followed literally, and the ruling taken:**
1. **"Long side along j" for facing L** contradicts the conversion table (a 3 × 2 desk at (2, 0) beside a corner piece
   at (5, 0)): `w` runs along `i` facing L (ruling 2, OWNER NOTE).
2. **"Each in two facings unless symmetric"** for the 54 pieces: the boards' small pieces are front-on sprites; drawn as
   `isox.py` draws them (billboards), a turned copy would be the same sprite, so they are `facings: 1` with Flip only.
   Desks, rugs and the welcome lantern have true L / R drawings (ruling 3, OWNER NOTE).
3. **The Cottage fairy lights** were a whole-wall front-on piece; in iso they are a wall garland (ruling 7).
4. **§12's GET field list** omits the welcome flag §11.1 needs (`welcomed`, ruling 13).
5. **§3.7's per-piece `SkPicture` cache and mover lists** only pay off with P3's walking KIP and pet; P1 caches piece
   rects and records two pictures around KIP, which keeps the drag ghost separate and the drop a single rebuild
   (ruling 8). Loop frames behind KIP are clipped by its silhouette, a detail the spec's layer order implies but does
   not state.
6. **"P1's plan regenerates `data.json`"**: the TypeScript port reads the registry directly, so nothing is regenerated
   (ruling 25).
7. **`desk_required` "on the floor"** and **`wrong_layer`** both catch a desk on a wall; `wrong_layer` answers first
   (§12 order).
8. **Spec B's `room` column** stays NOT NULL until P2, so a first save writes the derived slot room too (Task 4).

**Placeholder scan:** no "TBD" / "TODO" / "similar to". Every module, reducer action, route, test and copy string is
written out; the only "as before" notes point at code a task keeps unchanged (RoomView's bubble and canvas, the store's
guards), with the exact lines to keep named.

**Type consistency:** these names are used identically across tasks:
- backend: `SHIPPED_RELEASES`, `isShipped`, `shippedItem`, `RELEASE_LAUNCHED_AT`, `IsoSpec`, `Placement`,
  `RoomLayout`, `Tier`, `STYLE_KEYS`, `TIERS`, `tierSize`, `capFor`, `footOf`, `wallAreaOf`, `windowsOn`, `seatTile`,
  `exitTile`, `checkPiece`, `validateLayout`, `parseLayout`, `layoutFromSlots`, `starterLayout`, `slotsFromLayout`,
  `countsOf`, `placedCounts`, `readLayout`, `toTier`, `geometryDeps`, `lockRoom`, `convertLoadout`,
  `convertRoomLayouts`, `checkLayout`, `saveCosmetics`, `markWelcomed`, `geometryCopy`, `MOBILE_GEOMETRY_PATH`;
- mobile: `isoOf`, `GEOMETRY_DEPS`, `isoGrid`, `projOf`, `LOCAL`, `unproject`, `box`, `flat`, `line`, `shear`,
  `depthOrder`, `drawShell`, `windowsFor`, `pieceLayers`, `isoArtOf`, `drawIsoStatic`, `drawIsoFrames`, `clipOut`,
  `isoRoomKey`, `pieceAt`, `kipAt`, `spotPoint`, `anchorOf`, `deskBoxes`, `isoCrop`, `starterLayout`, `readLayout`,
  `inventoryOf`, `childrenOf`, `deskOf`, `layoutKey`, `newPieceId`, `Target`, `Refused`, `snapTarget`, `refusal`,
  `placedAt`, `nearestFree`, `nearestFloor`, `putOnOptions`, `coachTile`, `COACH_ITEM`, `EditorState`, `EditorAction`,
  `initEditor`, `editorReducer`, `isChanged`, `displayDraft`, `inventory`, `canPlace`, `selectedTools`,
  `DecorateParams`, `dragAt`, `ghostRects`, `clampPan`, `LIFT_PT`, `EditRoomHandle`, `pieceTiles`, `styleRows`,
  `wornTiles`, `setCards`, `notPlaced`, `reasonText`, `pieceLabel`, `nudgeAnnouncement`, `markWelcomed`, `useMyRoom`.

**Review Focus:** each of the five lines has its pinning test in the owning task (1: Tasks 3 and 10; 2: Tasks 4 and
11; 3: Tasks 9, 12 and 13; 4: Tasks 9 and 11; 5: Tasks 9, 12 and 13). The drag's smoothness and the room at the
largest text size are also checked by hand in Task 16.
