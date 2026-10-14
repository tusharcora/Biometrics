# KIP's room

Date: 2026-10-14 · Branch: `feature/kip-coach-spec` (from `main` f8d4afc) · Status: design approved by the owner; awaiting the owner's review of this spec

The second of two specs. It needs `2026-10-14-kip-coach-design.md` (Spec A): the W7 page, the poses, and the
slot-driven room engine in `mobile/src/lib/room/` with its starter loadout.

KIP's room becomes yours to decorate, and KIP can wear things. Every piece is **earned** from your own badges and
counters; nothing is ever sold. This spec covers the catalogue, how pieces unlock and are stored, decorate mode,
theme sets, worn items everywhere KIP appears, and the v2 art pipeline.

Boards in `docs/design/kip-coach/project/` (titles from `canvas.json`):

- `K4b.dc.html` "K4b · Decorate mode" (interactive): hotspots, the tray, preview, Cancel / Done, "How new things
  arrive";
- `CatWalls`, `CatWindow`, `CatDesk`, `CatFloor`, `CatOutfit` "Catalogue · …": every base item, its slot, its flags
  (TINT, GLOW, ANIM) and its unlock line;
- `SetsV2.dc.html` and `SetJapanese`, `SetGym`, `SetGamer`, `SetCottage`, `SetStargazer`, `SetLibrary` "v2 · …": the
  six theme sets at the approved art quality, day and night;
- `Sets.dc.html` "Theme sets v1 (old)": superseded; for reference only.

The v2 generator scripts (`.superpowers/coach-canvas/scratch-w/lib2.js`, `sets2.js`) are the reference for how each
item is drawn on the 2-point grid.

## 0. Owner decisions (2026-10-13 and 2026-10-14)

- Room cosmetics at **Theme sets v2** art quality are approved ("I like these designs, go ahead"): a 2-point room grid
  (1.5× K4's density), KIP at 4 points, lighting (window daylight by weather, a night veil and emissive glows),
  dithered gradients, soft shadows, depth, and subtle 3-frame loops that stop under Reduce Motion.
- **12 room slots:** wallpaper, floor, art, window, shelf, desk, desk_item, plant, lamp, corner, rug, pet.
  **4 worn slots:** head, face, neck, ears.
- A catalogue of **about 190 items** and **6 theme sets**: Japanese, Home gym, Gamer night, Cottage, Stargazer,
  Library. Items can cover more than one slot, can glow (emissive), can animate (3 frames), and a set's furniture
  style is `standard` or `low`.
- **Earn only.** Nothing is ever sold. The starter room is owned from day one. Items are never taken away.
- **Unlock sources:** the achievement families and their levels I–V (`SLEEP_GOAL`, `STEADY_BEDTIME`, `STEP_GOAL`,
  `CHECK_IN`, `BEST_RECOVERY_WEEK`, `EVERY_DAY_LOGGED`, `STEADIEST_MONTH`), a level in **any** family, and two
  counters: **recaps read** and **buddy cheers**.
- Buddies seeing your room: v1 is **your own room only**. A read-only view of a buddy's room from their profile is
  later. Buddies **do** see what your KIP wears (it is part of KIP, drawn by `PersonKip`).

## 1. The catalogue (in code, versioned)

### Where it lives

- **`backend/src/cosmetics/catalogue.ts`** is the source of truth for ids, slots and unlock rules, versioned like the
  achievements catalogue (`backend/src/achievements/catalogue.ts`): `COSMETICS_CATALOGUE_VERSION` (starting `1`)
  and a frozen list. Rules:
  - An item id is **permanent**. It is never renamed, reused or deleted.
  - An item can be **retired** (`retired: true`): it is no longer offered or unlocked, but anyone who owns it keeps it
    and can still place it.
  - Raising an unlock threshold never takes an item away from someone who already has it.
- **`mobile/src/lib/room/catalogue.json`** is a generated copy of the ids, slots, flags, set membership and unlock
  rules (no art), written by `backend/scripts/export-cosmetics.ts`. A backend test fails when the copy is stale, so
  the two never drift. Display names and unlock lines live in `mobile/src/lib/room/roomCopy.ts`.
- **The art** lives only in the app: `mobile/src/lib/room/items/{slot}.ts`, registered by id in `items.ts` (Spec A §5).
  A catalogue id with no registered art is not offered in the tray (a test makes that impossible in a release).

### Item shape

```ts
type CosmeticItem = {
  id: string;                    // 'wall.shoji', 'out.crown', 'set.japanese.desk'
  slot: RoomSlot | WornSlot;     // primary slot
  covers?: RoomSlot[];           // extra slots a multi-slot item occupies (e.g. a low table that also fills the rug spot)
  unlock: UnlockRule;
  sets?: SetId[];                // sets this item belongs to
  tint?: true;                   // takes KIP's colour ramp
  emissive?: true;               // drawn in the glow layer; not darkened by the night veil
  frames?: 3;                    // a 3-frame loop
  style?: 'standard' | 'low';    // furniture height; 'low' seats KIP on the floor
  retired?: true;
};

type UnlockRule =
  | { kind: 'starter' }
  | { kind: 'family'; family: AchievementFamily; level: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'anyFamily'; level: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'counter'; counter: 'recaps_read' | 'buddy_cheers'; atLeast: number }
  | { kind: 'set'; set: SetId };  // set-exclusive pieces come with their set
```

### What is in it

The base catalogue on the Cat boards is **134 items**; the six sets add their own set-exclusive pieces (about 56,
after reusing base items such as Tatami and Shoji paper), for **about 190** in all.

| Slot | Base items | Starter |
| --- | --- | --- |
| wallpaper | 12 | Plain slate, Dots |
| floor | 9 | Dark oak |
| art | 12 | Wall calendar |
| window (decor) | 8 | Plain frame |
| shelf | 10 | Books, Mini cactus |
| desk | 7 | Monitor, Notebook |
| desk_item | 12 | Mug, Sticky notes |
| plant | 9 | Fern, Cactus |
| lamp | 8 | Amber desk lamp |
| corner | 12 | (empty) |
| rug | 8 | Slate rug |
| pet | 5 | (empty) |
| worn: head / face / neck / ears | 9 / 5 / 5 / 3 | Beanie (head), Earbuds (ears) |

- **Unlock lines** use the Cat boards' wording: "Steady bedtime · III", "Any family · level IV", "Read 8 weekly
  recaps", "Cheer a buddy 10 times", "In every room from day one".
- **Counters used:** recaps read at 4, 8 and 12; buddy cheers at 5, 10 and 15.
- **Slots that may be empty:** art ("No art"), corner, pet, and every worn slot. Wallpaper, floor, window, shelf,
  desk, desk_item, plant, lamp and rug always hold an item (the starter one by default).
- **The window's sky** is never a cosmetic: it always shows today's Recovery weather (Spec A §6). Window items are
  frames, curtains and decor around the glass.

### Theme sets

| Set | Pieces | Unlock | Furniture | KIP colour on the board |
| --- | --- | --- | --- | --- |
| Cottage | 13 | Read 4 weekly recaps | standard | lime |
| Japanese | 14 | Steady bedtime · III | **low** (KIP kneels at a low cedar table) | coral |
| Home gym | 12 | Step goal · IV | standard | cobalt |
| Gamer night | 12 | Any family · level IV | standard | lilac |
| Stargazer | 12 | Steadiest month · V | standard | sky |
| Library | 13 | Read 12 weekly recaps | standard | mint |

- A set is a named loadout: one item for each of the 12 room slots, plus any worn pieces it includes.
- **Unlocking a set unlocks all its pieces.** A piece that is also a base item can be earned either way.
- A set never changes KIP's colour. The boards' colours are only a preview.

## 2. Storage

Two new tables (migration `20261015120000_cosmetics`):

```prisma
model CosmeticUnlock {
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemId     String   // a catalogue id; never a set id
  source     String   // 'family:STEADY_BEDTIME:3', 'anyFamily:4', 'counter:recaps_read:8', 'set:cottage', 'backfill'
  unlockedAt DateTime @default(now())
  seenAt     DateTime?
  @@id([userId, itemId])
}

model CosmeticLoadout {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  room      Json     // Record<RoomSlot, itemId | null>
  worn      Json     // Record<WornSlot, itemId | null>
  version   Int      @default(0)   // optimistic concurrency
  updatedAt DateTime @updatedAt
}
```

- **Owned = starter items ∪ unlock rows.** Starter items are never written as rows.
- **Never remove owned:** no code path deletes a `CosmeticUnlock` row except the account's own deletion (cascade).
  A test guards that no `deleteMany` on the table exists outside account deletion.
- **No loadout row** means the starter loadout. A stored loadout that names an item no longer owned (impossible today,
  defensive) or with no art reads that slot back as the starter item.
- **Counters** are read from existing data, not stored (§3.2).
- Nothing here is health data; it still follows the logging rules (no user IDs with values).

## 3. Unlocks

### 3.1 Evaluation

`backend/src/cosmetics/unlock.ts` exports `grantCosmetics(userId, now)`. It is pure in its rules and idempotent:

1. Read the user's achievements (family, level), the two counters, and the existing unlock rows.
2. For each catalogue item not owned and not retired, check its rule; for each set whose rule passes, take all its
   pieces.
3. Insert the new rows with `createManyAndReturn` + `skipDuplicates`, as `evaluateAchievements` does, so a concurrent
   call that loses the race announces nothing.
4. Return the inserted item ids.

It is called:

- **After achievements are awarded:** at the end of `evaluateAchievements` when it inserted fresh levels (the same
  place the celebration is built), so a new badge and its pieces arrive together.
- **After a recap is opened:** in `recap/routes.ts`, when the `openedAt` update actually changed a row.
- **After a cheer is sent:** in the sticker route (`POST /me/buddies/:buddyId/stickers`), after a successful insert.
- **On `GET /me/cosmetics`**, as a catch-up. On the first call for a user who already has badges (everyone at launch),
  the rows it inserts are marked `source: 'backfill'` and are shown as one summary toast, not one per item (§4).

A failure in `grantCosmetics` is logged (without values) and never fails the request that triggered it; the next
GET catches up.

### 3.2 The new counters

Nothing tracks them as counters today. Both can be derived from existing rows, so no counter column is added:

- **`recaps_read`:** the number of the user's `Recap` rows with `kind = WEEK` and `openedAt` not null. `openedAt` is
  set once by `GET` of a recap (`recap/routes.ts`) and never cleared.
- **`buddy_cheers`:** the number of `Sticker` rows the user sent (`fromUserId`), any kind, counting **at most one per
  buddy per local day**, so sending ten stickers in a row is one cheer.
- Because unlocks are rows, a counter that later drops (a buddy deletes their account and their stickers cascade)
  never takes anything away.

### 3.3 Progress lines

The tray's locked tiles show progress where it is cheap: "level II now" for a family rule (from the achievements
read the app already has), "5 of 8 read" for recaps, "3 of 10" for cheers. `GET /me/cosmetics` returns the two
counter values for this.

## 4. Telling you something unlocked

- **With a new badge:** `CelebrationModal` gains one line under the badge: "New for KIP's room: Shoji paper" (or "…
  and 2 more"), and a secondary outline `Button` "Decorate" that opens decorate mode on that item's tab and slot.
- **Otherwise** (a recap read, a cheer, the backfill): a toast on the next app foreground or KIP tab focus, "New for
  KIP's room: Light oak", with "Decorate". The backfill's toast reads "Your badges unlocked {n} things for KIP's room".
- **The source of "new"** is `seenAt`: unseen unlock rows are returned by `GET /me/cosmetics` as `fresh`, and
  `POST /me/cosmetics/seen { itemIds }` marks them. Opening decorate mode marks everything shown as seen. A small dot
  on the Decorate button shows while anything is unseen.
- **No push notification** for an unlock in v1. The badge push (if any) already covers the moment.

## 5. Endpoints

All require auth, return `Cache-Control: private, no-store`, and live in `backend/src/cosmetics/routes.ts`.

- **`GET /me/cosmetics`** →
  ```json
  { "catalogueVersion": 1,
    "owned": ["wall.plain", "wall.shoji", "..."],
    "fresh": ["wall.shoji"],
    "room": { "wallpaper": "wall.shoji", "floor": "floor.oakDark", "...": null },
    "worn": { "head": "out.beanie", "face": null, "neck": null, "ears": null },
    "version": 3,
    "counters": { "recapsRead": 5, "buddyCheers": 3 } }
  ```
  `owned` includes the starter items, so the app needs no rule logic to know what it can place.
- **`PUT /me/cosmetics`** with `{ room, worn, version }` →
  - **400 `unknown_item`** for an id not in the catalogue;
  - **400 `wrong_slot`** for an item placed in a slot it is not for;
  - **400 `required_slot`** for null in a slot that must hold an item;
  - **403 `not_owned`** with `{ itemIds }` for any id the user does not own (**the server never trusts the app's
    idea of ownership**);
  - **409 `stale`** when `version` is not the stored one (another device saved); the app re-reads and asks;
  - otherwise saves and returns the same body as GET.
  - **Multi-slot items:** placing an item that `covers` other slots clears those slots to their "covered" state; the
    server normalises this, and an item placed in a slot another item covers is a 400 `slot_covered`.
- **`POST /me/cosmetics/seen`** with `{ itemIds }` → 204. Unknown or unowned ids are ignored.
- **Apply set** is not a separate route: the app sends the set's loadout through `PUT` (§6.4), which validates every
  piece like any other save.

## 6. Decorate mode (K4b)

### 6.1 Entry

- The **Decorate** button on the KIP page header (outline `Button`, `icon-lg`, first in the row; label "Decorate KIP's
  room") and the **Decorate** button in the room card (beside "Shrink room", two columns), both as on W7.
- A new full-screen modal route, **`DecorateRoom`** (`{ tab?: 'room' | 'kip' | 'sets'; slot?: RoomSlot | WornSlot }`),
  in `RootNavigator`.

### 6.2 Layout, top to bottom

1. **Header:** "Cancel" (ghost `Button`), "DECORATE" (pixel title), "Done" (default `Button`; disabled until
   something changed; shows its loading state while saving).
2. **The room**, full width at 2 points per cell, with the same crop rules as Spec A. In the Room tab, each of the 12
   slots shows a **hotspot tag** ("+ ART", "+ WINDOW", …) at its board position. Each tag is a raw `Pressable`
   (`accessibilityRole="button"`, label "Decorate the art"), with one conventions entry for the kind. Tapping one
   selects that slot's category.
3. **The info line:** a label and a line, for example "Previewing · Shoji paper in the wallpaper spot", "In your room
   · Books is already placed", "Locked · Lucky cat · Best recovery week · II", "Theme sets · Apply a whole room in one
   tap, then swap any piece". On the right, **"Undo"** (ghost `Button`), which steps back one change in this session.
4. **The tray tabs:** Room, KIP, Sets: three `Button`s in a row, the picked one `default`, the others `outline`,
   with `accessibilityRole="tab"` and `accessibilityState={{ selected }}` inside a `tablist` view.
5. **The tray:**
   - **Room:** a horizontal row of category chips (one per room slot, outline / default `Button`s), then a grid of
     item tiles for that slot.
   - **KIP:** the worn items, grouped head, face, neck, ears; KIP is drawn large above the grid wearing the preview.
   - **Sets:** six cards, each with the set's four palette swatches, its name, "{n} pieces · {unlock line}", and a
     button: "Apply set" (default) when owned, "Preview" (outline) when locked.
6. **"How new things arrive"** at the end of the tray's scroll, with K4b's four lines verbatim: badge families, any
   family, recaps and buddies, and "Nothing is sold. The starter room is yours from day one, and items are never
   taken away."

### 6.3 Tiles

- Each tile is a raw `Pressable` (`accessibilityRole="button"`; one conventions entry), 16 × 16 icon art drawn at 3×,
  the name in `text-fine`, and a tag: **"Placed"** (green), **"Owned"** (muted) or the **unlock line** (muted).
- Locked tiles are at 45% opacity. Their spoken label is "{name}, locked. {unlock line}. {progress}".
- Owned tiles: "{name}, owned. Place it" / "{name}, placed".
- The selected tile has a 2-point light border.
- Items with flags show small TINT / GLOW / ANIM badges as on the Cat boards.

### 6.4 Behaviour

- **Tapping an owned item** places it in the draft loadout; the room redraws at once. Tapping it again does nothing
  (it is already placed). Empty-allowed slots have a "None" tile first.
- **Tapping a locked item** previews it in the room with a dashed "LOCKED" tag on its slot; the info line shows how to
  earn it. A locked preview is never saved: Done saves the draft with every locked preview reverted to what was
  there.
- **Apply set** (owned set): fills every room slot (and the set's worn pieces) with the set's items in one step. It
  is one Undo step. Any piece can then be swapped.
- **Preview** (locked set): shows the whole set in the room; the info line says "Locked · Japanese · Steady bedtime ·
  III". Nothing of it can be saved.
- **Done:** `PUT /me/cosmetics`. On success the KIP page's room and every KIP update. On `403 not_owned` or `409
  stale` the app re-reads, keeps the user in decorate mode and says "Something changed on another device. Your room
  was refreshed." Any other failure keeps the draft and shows "Couldn't save your room. Try again."
- **Cancel** with changes asks "Discard your changes?" (Discard / Keep editing); without changes it just closes.
- The modal pauses the KIP page's loops while open.

## 7. Worn items on KIP everywhere

- **Art:** `kipArt.ts`'s `KipVariant` gains `worn?: Partial<Record<WornSlot, ItemId>>`. Worn art is drawn over the
  body in the order **head, face, neck, ears**, so headphones sit over a hat band. The arms-only rule still holds:
  worn items never move or reshape the body; a pose's arms draw over a neck item.
- **`Kip` and `PersonKip`** take `worn`. Every place KIP appears passes it:
  - **you:** a `useMyKip()` store replaces `useMyKipColour()` (same lifecycle: loads once per sign-in, clears on
    sign-out), holding `{ colour, worn }`. The worn half comes from `GET /me/cosmetics`;
  - **buddies:** the shared `Person` record (`backend/src/buddies/people.ts`) adds `kipWorn` next to `kipColour`, and
    the Social home's camp adds `faceWorn` in the same order as `faceColours`. Only worn ids are shared, never the
    room or the owned list.
- **At small sizes** (a `PersonKip` under 32 points, the tab bar hub, the Ask KIP head), only head and ears items are
  drawn; face and neck items are skipped so the eyes stay readable.
- The app icon and the splash never wear anything.

## 8. The v2 art pipeline

- **Authored as code**, not images: each item is a draw function on the room grid using the v2 primitives ported from
  `lib2.js` (`R`, `E` ellipses, `poly`, `gradV` with ordered-dither seams, `shade` soft shadows, `px`), returning
  layered rects. Pixel art stays crisp at any whole-point scale, re-tints for `tint` items, and adds no image assets.
- **Layers per item:** `base` (lit by the room's daylight or darkened by the night veil), `emissive` (screens, lamps,
  neon, fairy lights; drawn after the veil, with a soft glow halo), and `frames` (three small rect lists for a loop:
  a flicker, a fish, a cat's tail, steam).
- **Tint:** a `tint` item draws with KIP's ramp (`b`, `h`, `s`, `d` from `kipRamp`).
- **Loops:** 3 frames at 400 ms; paused when the screen is unfocused or decorate mode covers it; off under Reduce
  Motion (frame 0 shows).
- **Icons:** each item also has a 16 × 16 tray icon (the Cat boards' `ic` lists), drawn with `react-native-svg`, one
  path per colour. Icons never build a room picture.
- **Rendering budget** (release build, iPhone 12 / Pixel 6 class):
  - the room's static picture (`SkPicture`, Spec A §5) builds in **under 8 ms** with any full loadout, so a tap in
    decorate mode redraws within one frame; measured by a dev perf test across all six sets at night;
  - the KIP page holds one picture; decorate mode holds one more for the draft, released on close;
  - a buddy's KIP with worn items stays an SVG `PersonKip` (a 16 × 16 grid is cheap);
  - the item art code adds at most **150 KB** to the JS bundle (minified); checked in CI by a size test.
- **Night:** the room's night veil and lit emissives follow the same `night` state as the window (Spec A §6).

## 9. Phasing

Art is the bulk of the work, so it ships in two batches.

- **B1, first release (about 90 items):**
  - the 17 starter items;
  - every item unlocked at **level I or II** of any family, by "Any family · level I–II", by **4 recaps read** or by
    **5 buddy cheers** (59 base items);
  - the **Cottage** set (13 pieces), the one set a new user can reach early (4 recaps);
  - decorate mode complete, worn items everywhere, unlock evaluation, toasts and the backfill.
  This gives every user something placeable from the first week, and something already earned on day one for anyone
  with badges.
- **B2:** levels III–V, 8 and 12 recaps, 10 and 15 cheers, and the other five sets (Japanese with the `low`
  furniture style, Home gym, Gamer night, Stargazer, Library).
- Items not yet drawn are not in the catalogue copy the app ships, so B2 items are never shown as "coming soon" tiles.
  The backend catalogue may include them (unlock rows can be granted early); the app shows only items with art.

## 10. Rules that apply

- Every button is `ui/button.tsx` with `rounded-lg`. Raw pressables with a button role (hotspot tags, tray tiles) get
  one conventions entry per kind.
- Only the A4 type tokens; pixel labels use `text-label` with the pixel font.
- Strings live in `roomCopy.ts`.
- Never log user IDs with item ids, loadouts or counter values.
- TDD: run the touched tests and both typechecks before every commit.

## 11. Tests

- **Backend:**
  - Catalogue: ids unique and permanent (a snapshot of every id ever shipped; removing one fails); each item's slot is
    valid; each set fills all 12 room slots exactly once (counting `covers`); every family rule names a real family
    and a level 1–5; the mobile copy is current.
  - `grantCosmetics`: each rule kind (family level, any family, each counter threshold, set → all pieces); idempotent;
    concurrent calls insert once; retired items are not granted; the backfill is marked.
  - Counters: `recaps_read` counts only opened WEEK recaps; `buddy_cheers` counts at most one per buddy per local day.
  - Hooks: a new badge level grants its pieces; opening a recap grants at 4; a cheer grants at 5; a failed grant does
    not fail the triggering request.
  - Never removed: no code path deletes unlock rows except account deletion.
  - `GET /me/cosmetics`: starter items owned for a new user; starter loadout with no row; `fresh` lists unseen rows.
  - `PUT /me/cosmetics`: saves owned items; `unknown_item`, `wrong_slot`, `required_slot`, `not_owned` (403),
    `stale` (409), `slot_covered`; multi-slot normalisation; requires auth.
  - `POST /me/cosmetics/seen` marks only owned ids.
  - `Person.kipWorn` and the camp's `faceWorn` line up with `faceColours`; no room or owned list leaks into either.
- **Mobile:**
  - `kipArt` worn drawing order; arms over neck items; small sizes skip face and neck; the body is unchanged.
  - Item art: every catalogue id the app ships has art and an icon; `emissive` items draw only in the glow layer;
    `frames` items have exactly three frames; `tint` items follow KIP's colour; `low` style seats KIP lower.
  - `drawRoom` for each of the six sets, day and night, is deterministic (snapshots of rect counts per layer).
  - Decorate mode:
    - hotspot tags select their slot; the three tabs and their selected states;
    - placing an owned item redraws and enables Done; a locked item previews and is reverted on save;
    - Apply set fills every slot and is one Undo step; locked set preview cannot be saved;
    - Undo; Cancel with and without changes;
    - Done saves; the 403 / 409 refresh path; the generic failure keeps the draft;
    - tile labels for placed, owned and locked with progress.
  - Toasts: celebration line with "Decorate"; the foreground toast; the backfill summary; seen marking; the dot on
    Decorate.
  - `useMyKip`: loads once per sign-in, clears on sign-out, updates on a save.
  - Buddy surfaces draw worn items from `kipWorn`.
  - Conventions guards: `buttons.test.ts` and `typography.test.ts` pass with the new entries.
  - Perf (dev only, not CI-gating): picture build time for every set, logged without user data.

## 12. Out of scope

- Selling anything, currencies, trades or gifts.
- Viewing a buddy's room (later; from their profile, read-only).
- Alternate app icons per KIP colour.
- User-made or uploaded items, colour pickers per item.
- Seasonal or limited-time items.
- Push notifications for unlocks.

## 13. Open questions (labelled defaults)

1. **What counts as a cheer.** Default: any sticker sent to a buddy, at most one per buddy per local day. Alternative:
   only the CHEER sticker kind.
2. **Badges earned before launch.** Default: backfilled on first open, with one summary toast. Alternative: only
   badges earned after launch unlock pieces (feels stingy to existing users).
3. **A buddy's room.** Default: later, read-only, from their profile; v1 shares only what KIP wears.
