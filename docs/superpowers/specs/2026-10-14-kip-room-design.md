# KIP's room

Date: 2026-10-14 · Branch: `feature/kip-coach-spec` (from `main` f8d4afc) · Status: design approved by the owner; awaiting the owner's review of this spec

The second of two specs. It needs `2026-10-14-kip-coach-design.md` (Spec A): the W7 page, the poses, and the
slot-driven room engine in `mobile/src/lib/room/` with its starter loadout.

**The engine boundary.** Spec A's `drawRoom` already takes worn items in its `kip` argument (and keys KIP's layer on
them), returns `kipSeat` from the desk item's `style`, and registers art for the 10 placed starter items. This spec
adds item art (including the other seven starter pieces), passes the server's loadout and worn items in, and draws
decorate mode's overlays (hotspot tags and the dashed "LOCKED" tag) in its own screen, over `RoomView`. It does not
change `drawRoom`'s contract.

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

The v2 generator scripts, committed beside the boards in `docs/design/kip-coach/project/` (`lib2.js` with its
helpers in `lib.js`, `sets2.js` for the six sets, `k4room.js` for the starter room), are the reference for how each
item is drawn on the 2-point grid.

## 0. Owner decisions (2026-10-13 and 2026-10-14)

- Room cosmetics at **Theme sets v2** art quality are approved ("I like these designs, go ahead"): a 2-point room grid
  (1.5× K4's density), KIP at 4 points, lighting (window daylight by weather, a night veil and emissive glows),
  dithered gradients, soft shadows, depth, and subtle 3-frame loops that stop under Reduce Motion.
- **12 room slots:** wallpaper, floor, art, window, shelf, desk, desk_item, plant, lamp, corner, rug, pet.
  **4 worn slots:** head, face, neck, ears.
- A catalogue of **about 190 items** and **6 theme sets**: Japanese, Home gym, Gamer night, Cottage, Stargazer,
  Library. Items can glow (emissive), can animate (3 frames), and a set's furniture style is `standard` or `low`.
  (Multi-slot items were in the brief, but no catalogue item or set piece uses one, so v1 leaves them out; §1.)
- **Earn only.** Nothing is ever sold. The starter room is owned from day one. Items are never taken away.
- **Unlock sources:** the achievement families and their levels I–V (`SLEEP_GOAL`, `STEADY_BEDTIME`, `STEP_GOAL`,
  `CHECK_IN`, `BEST_RECOVERY_WEEK`, `EVERY_DAY_LOGGED`, `STEADIEST_MONTH`), a level in **any** family, and two
  counters: **recaps read** and **buddy cheers**.
- Buddies seeing your room: v1 is **your own room only**. A read-only view of a buddy's room from their profile is
  later. Buddies **do** see what your KIP wears (it is part of KIP, drawn by `PersonKip`).

Defaults accepted at spec review (2026-10-14):

- **A cheer** is any sticker sent to a buddy, counted at most once per buddy per local day (§3.2).
- **Badges earned before launch** unlock their pieces on first open, announced by one summary toast (§3.1, §4).
- **A buddy's room** is later; v1 shares only what KIP wears.

## 1. The catalogue (in code, versioned)

### Where it lives

- **`backend/src/cosmetics/catalogue.ts`** is the source of truth for ids, slots and unlock rules, versioned like the
  achievements catalogue (`backend/src/achievements/catalogue.ts`): `COSMETICS_CATALOGUE_VERSION` (starting `1`)
  and a frozen list. Rules:
  - An item id is **permanent**. It is never renamed, reused or deleted.
  - An item can be **retired** (`retired: true`): it is no longer offered or unlocked, but anyone who owns it keeps it
    and can still place it.
  - Raising an unlock threshold never takes an item away from someone who already has it.
  - `COSMETICS_RELEASE` (starting `1`) says which art batch the app ships. The export to mobile and
    `grantCosmetics` include only items with `release <= COSMETICS_RELEASE`, so nobody owns an item the app cannot
    draw. Bumping it at B2 grants the newly eligible items, announced with one summary toast (§4).
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
  unlock: UnlockRule;
  release: 1 | 2;                // the art batch that ships it (§9)
  sets?: SetId[];                // sets this item belongs to
  tint?: boolean;                // takes KIP's colour ramp
  emissive?: boolean;            // drawn in the glow layer; not darkened by the night veil
  frames?: 3;                    // a 3-frame loop
  style?: 'standard' | 'low';    // desk furniture height; 'low' seats KIP on the floor (Spec A's kipSeat)
  retired?: boolean;
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
- **Multi-slot items:** none. Every base item and every set piece in `sets2.js` fills exactly one slot, so v1 has no
  `covers` field, no covered state and no normalisation. They can be added later as a new field without migrating
  data.
- **Slots that may be empty:** art ("No art"), corner, pet, and every worn slot. The **starter worn loadout is all
  empty**: Beanie and Earbuds are owned from day one but not worn. Wallpaper, floor, window, shelf,
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

- A set is a named loadout: exactly one item for each of the 12 room slots, plus any worn pieces it includes.
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
- **Never remove owned:** a test guards that no `cosmeticUnlock.deleteMany` or `cosmeticUnlock.delete` exists outside
  `backend/src/users/deletion.ts` and the test fixture purge.
- **Account deletion:** `CosmeticUnlock` and `CosmeticLoadout` are added to `USER_OWNED_MODELS` in
  `backend/src/users/deletion.ts` (before `User`) and to the owned-data fixture `tests/users/ownedData.ts`, so the
  deletion test proves both are emptied.
- **No loadout row** means the starter loadout. On the server, a stored slot naming an item the user no longer owns
  (impossible today; defensive) reads back as the starter item. **In the app only**, a slot whose item has no art in
  this build is drawn as the starter item; the stored loadout is not changed.
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
4. Return the inserted `{ itemId, source }` rows.

**The backfill is decided by time, not by which path runs first.** A constant `COSMETICS_LAUNCHED_AT` marks the
release. A grant whose rule was already met before it (the qualifying `Achievement.createdAt`, or enough
`Recap.openedAt` values, before the constant; a cheer count reached by stickers sent before it) is stored with
`source: 'backfill'`, whichever hook makes the grant. Everything else gets its rule's source.

It is called:

- **After achievements are awarded:** in `evaluateAchievements`, right after `createManyAndReturn` when
  `created.length > 0`, beside the existing `announce` call. It is injected through `EvaluateOptions` (a new
  `grantCosmetics?` option, defaulting to the real one) so achievement tests can stub it. The celebration itself is
  built by the app from uncelebrated achievement rows (`celebratedAt`); it finds that badge's pieces through `fresh`
  (§4).
- **After a recap is opened:** in `POST /me/recaps/:id/opened` (`recap/routes.ts`), when its
  `updateMany({ where: { id, openedAt: null } })` returns `count === 1`.
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
  buddy per local day**, so sending ten stickers in a row is one cheer. The day is
  `localCivilDateOrUtc(sentAt, User.timezone)` in the **sender's current** zone, as the sticker limit in
  `buddies/stickers.ts` does. Counting stops at 15, the highest threshold, so the query stays small.
- Because unlocks are rows, a counter that later drops (a buddy deletes their account and their stickers cascade)
  never takes anything away.

### 3.3 Progress lines

The tray's locked tiles show progress where it is cheap: "level II now" for a family rule (from the achievements
read the app already has), "5 of 8 read" for recaps, "3 of 10" for cheers. `GET /me/cosmetics` returns the two
counter values for this.

## 4. Telling you something unlocked

- **With a new badge:** `CelebrationModal` gains one line under the badge: "New for KIP's room: Shoji paper" (or "…
  and 2 more"). The pieces are the `fresh` rows whose `source` is `family:{FAMILY}:{level}` or `anyFamily:{level}`
  for the badge being shown, and a secondary outline `Button` "Decorate" that opens decorate mode on that item's tab and slot.
- **Otherwise** (a recap read, a cheer, the backfill): a toast on the next app foreground or KIP tab focus, "New for
  KIP's room: Light oak", with "Decorate". The backfill's toast reads "Your badges unlocked {n} things for KIP's room".
- **The foreground toast shows each item once.** The app keeps the ids it has toasted on the device (SecureStore key
  `kipToasted`, try/catch), so a toast never repeats before the items are marked seen.
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
    "fresh": [{ "itemId": "wall.shoji", "source": "family:STEADY_BEDTIME:3" }],
    "room": { "wallpaper": "wall.shoji", "floor": "floor.oakDark", "...": null },
    "worn": { "head": "out.beanie", "face": null, "neck": null, "ears": null },
    "version": 3,
    "counters": { "recapsRead": 5, "buddyCheers": 3 } }
  ```
  `owned` includes the starter items, so the app needs no rule logic to know what it can place.
- **`PUT /me/cosmetics`** with `{ room, worn, version }` →
  - **400 `invalid_body`** when `room` lacks or adds a key (all 12 room slots are required), `worn` lacks or adds a
    key (all 4 worn slots are required), an id is not a string or null, or `version` is not an integer;
  - **400 `unknown_item`** for an id not in the catalogue (or above `COSMETICS_RELEASE`);
  - **400 `wrong_slot`** for an item placed in a slot it is not for;
  - **400 `required_slot`** for null in a slot that must hold an item;
  - **403 `not_owned`** with `{ itemIds }` for any id the user does not own (**the server never trusts the app's
    idea of ownership**);
  - **409 `stale`** when `version` is not the stored one (another device saved); the app re-reads and asks;
  - otherwise saves and returns the same body as GET.
  - **Concurrency:** a save is `updateMany({ where: { userId, version }, data: { ..., version: { increment: 1 } } })`;
    a `count` of 0 is 409 `stale`. With no row yet (`version` 0), the save is a `create` with `version: 1`, and a
    unique-key clash (`P2002`, another first save won) is 409 `stale`.
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
  - **buddies:** the shared `Person` record (`backend/src/buddies/people.ts`) adds `kipWorn` next to `kipColour`.
    `PERSON_SELECT` joins `cosmeticLoadout: { select: { worn: true } }`, and `toPerson` drops any id not in the
    catalogue. The Social home's camp adds `faceWorn` in the same order as `faceColours`, and the stories read
    (`social/stories.ts`) adds `checkedInKipWorn` beside `checkedInKipColours`. The handle-lookup DTO
    (`buddies/handles.ts`) does **not** carry it. Only worn ids are shared, never the room or the owned list.
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
  - the item art code adds at most **150 KB** to the JS bundle (minified). There is no bundle-size tooling today,
    so a script, `mobile/scripts/room-art-size.mjs`, bundles `src/lib/room/items` with esbuild (minified) and
    prints the size; it is run by hand before each art batch, not in CI.
- **Night:** the room's night veil and lit emissives follow the same `night` state as the window (Spec A §6).

## 9. Phasing

Art is the bulk of the work, so it ships in two batches.

- **B1, first release (about 90 items), `COSMETICS_RELEASE = 1`:**
  - the 17 starter items (Spec A drew the 10 placed ones; B1 draws the other seven: Dots, Mini cactus, Notebook,
    Sticky notes, Cactus, Beanie and Earbuds);
  - every item unlocked at **level I or II** of any family, by "Any family · level I–II", by **4 recaps read** or by
    **5 buddy cheers** (59 base items);
  - the **Cottage** set (13 pieces), the one set a new user can reach early (4 recaps);
  - decorate mode complete, worn items everywhere, unlock evaluation, toasts and the backfill.
  This gives every user something placeable from the first week, and something already earned on day one for anyone
  with badges.
- **B2:** levels III–V, 8 and 12 recaps, 10 and 15 cheers, and the other five sets (Japanese with the `low`
  furniture style, Home gym, Gamer night, Stargazer, Library).
- B2 items carry `release: 2`. Until `COSMETICS_RELEASE` is bumped they are neither exported to the app nor granted,
  so nobody owns an item the app cannot draw, and none is shown as a "coming soon" tile. B2 bumps the constant and
  ships the art in the same release; the next grant gives every eligible user their B2 items with one summary toast.

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
    valid; each set has exactly one item per room slot (12); every family rule names a real family
    and a level 1–5; the mobile copy is current and holds only items with `release <= COSMETICS_RELEASE`; no item
    `grantCosmetics` can grant is missing from the shipped copy.
  - `grantCosmetics`: each rule kind (family level, any family, each counter threshold, set → all pieces); idempotent;
    concurrent calls insert once; retired items and items above `COSMETICS_RELEASE` are not granted; returns
    `{ itemId, source }`.
  - Backfill by time: a rule met before `COSMETICS_LAUNCHED_AT` is stored as `backfill` whichever path grants it,
    including the recap-opened hook running before the first `GET /me/cosmetics`; a rule met after it keeps its own
    source.
  - Counters: `recaps_read` counts only opened WEEK recaps; `buddy_cheers` counts at most one per buddy per local day.
  - Hooks: a new badge level grants its pieces (through the `EvaluateOptions` hook, stubbed in achievement tests);
    `POST /me/recaps/:id/opened` grants at 4 only when it set `openedAt` (a second open grants nothing); a cheer
    grants at 5; a failed grant does not fail the triggering request.
  - Cheers: one per buddy per local day in the sender's zone; counting stops at 15.
  - Never removed: no `cosmeticUnlock.deleteMany` / `delete` outside `users/deletion.ts` and the fixture purge (a
    source grep test); account deletion empties both new tables (`USER_OWNED_MODELS`, `ownedData.ts`).
  - `GET /me/cosmetics`: starter items owned for a new user; starter loadout with no row and all worn slots empty;
    `fresh` lists unseen rows with their source.
  - `PUT /me/cosmetics`: saves owned items; `invalid_body` (missing or extra slot keys, a non-string id, a
    non-integer version), `unknown_item`, `wrong_slot`, `required_slot`, `not_owned` (403), `stale` (409); two
    concurrent first saves give one 200 and one 409; a save with an old version is 409; requires auth.
  - `POST /me/cosmetics/seen` marks only owned ids.
  - `Person.kipWorn` (via `PERSON_SELECT`; unknown ids dropped), the camp's `faceWorn` and the stories'
    `checkedInKipWorn` line up with their colour lists; the handle lookup has no worn field; no room or owned list
    leaks into any of them.
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
  - Toasts: the celebration line picks only the pieces whose source matches the badge shown; the foreground toast
    shows each id once (the device list); the backfill and release-bump summaries; seen marking; the dot on
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

## 13. Open questions

None. The three defaults raised here (what counts as a cheer, the pre-launch backfill, a buddy's room) were accepted
on 2026-10-14 and are recorded in §0.
