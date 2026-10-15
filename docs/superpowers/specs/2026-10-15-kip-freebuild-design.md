# KIP's free-build room

Date: 2026-10-15 · Branch: `feature/kip-freebuild` (from `feature/kip-room` 086f772) · Status: spec reviewed (pass with fixes, applied); the owner accepted every open-question default on 2026-10-15

The third room spec. It needs `2026-10-14-kip-coach-design.md` (Spec A: the W7 page, the poses, the room engine in
`mobile/src/lib/room/`, `RoomView`) and `2026-10-14-kip-room-design.md` (Spec B: the catalogue, unlock rows, the
loadout, worn items, decorate mode, toasts), both **built** on `feature/kip-room` (draft PRs #65 and #66, unmerged).

KIP's room stops being 12 fixed slots and becomes a small **isometric room you build freely**: place, stack, flip
and turn pieces anywhere, keep copies in an inventory, earn **KIP coins** from healthy days, grow the room, add pieces
that do something, and show the room to buddies. Nothing is ever sold for real money.

Boards in `docs/design/freebuild/project/` (titles from `canvas.json`):

- `Main.dc.html` "Overview": what we borrow from the room sim, what we skip, today vs free-build;
- `F1` "Isometric free-build", `F4` "Inventory & toolbar", `F5` "Room expansion", `F6` "Earned currency",
  `F7` "Items that do something", `F8` "Show off";
- `C1` "The daily loop", `C2` "Grow your room", `C3` "Weekly theme challenge", `C4` "Visit & gift", `C5` "A living
  room", `C6` "KIP lives there", `C7` "First week", `C8` "Economy map" (a systems map, not a screen).
- `F2` "Front-on free-build" and `F3` "Hybrid" were **not chosen**; they are reference only. F4 was drawn over F2's
  front-on room; its drawer, toolbar, counts and caps apply here over the isometric room.

The generators in `docs/design/freebuild/gen/` are the reference for how the room is drawn: `iso.py` (the 2:1 tile
projection `P(i, j, z)`, `box`, `flat`, the shell, the window, daylight and veil), `isox.py` (the C-row additions:
weather skies, the second window, growing plants, the playing cat, the trophy shelf, glowing pieces, KIP on a tile,
the depth-sorted `standard` room) and `cbase.py` / `c1.py`–`c8.py` (the screens). They read `gen/data.json`, Spec B's
art export, which is not committed; P1's plan regenerates it with a script before porting.

Where an F board and a C board disagree, the **C board wins** (the C row is the combined design the owner approved
last). The disagreements are listed where they matter (§6, §7, §11).

## 0. Owner decisions (2026-10-14 and 2026-10-15)

- The owner researched a popular pixel "YouTuber room sim" and wants KIP's room customisation "to be like that".
- **Liked:** F1 (isometric free-build), F4 (inventory and toolbar), F5 (room expansion), F6 (earned currency, never
  real money), F7 (items that do something), F8 (show off). On the combined ideas: "I like every single one of these
  ideas, implement them all": C1 daily loop, C2 grow your room, C3 weekly theme challenge, C4 visit and gift, C5 a
  living room, C6 KIP lives there, C7 first week, C8 economy map.
- **Not chosen:** F2 front-on, F3 hybrid. The view is **isometric 2.5D**.
- **Standing rules that bind this spec:**
  - **Earn only.** Nothing is ever sold for real money. No ads. No shipping timers: a piece is yours the moment you
    get it.
  - `CampScene.tsx` and `CampBanner.tsx` stay **frozen** (OVERRIDE-P13 in Spec B's ledger).
  - Every button is the shadcn port in `ui/button.tsx`, `rounded-lg`. No pills anywhere.
  - Only the A4 type tokens.
  - **Privacy:** never log health values, names or ids together with item ids, layouts, coin amounts or counters.
    Nothing cosmetic reaches the model. Effects never give health advice.
  - Civil dates come from the existing helpers (`localCivilDateOrUtc`, `todayFor`, the habit-day boundary), never
    hand-rolled.

Defaults accepted at spec review (2026-10-15):

- **Coin amounts and prices** are C8's as written (sleep 20, steps 15, check-in 5, recap 10, cheer 2, entry 30, cap
  60; pieces 25–200, 8 × 8 at 600, loft at 1,500), changed only through the catalogue after four weeks of real
  weekly earnings (§6.2, §6.4).
- **Challenge judging:** the most cheers in your own circle, ties all win, no ranking under 3 entries, results on the
  first read after Monday 08:00 UTC (§10.4).
- **Radio sound:** `expo-audio` is added in P3 with one bundled 20-second loop (under 300 KB), off until turned on
  (§8.2).
- **First-week total** follows C7's rows (two bonuses, +10 and +25, outside the cap), not C8's "+80" (§11.2).
- **Release timing:** Spec B (PRs #65, #66) merges but reaches users only together with P1, so the slot editor never
  ships (§2.4).

Controller rulings at spec review (2026-10-15):

- **Room visits are opt-in:** a new switch in the existing buddy sharing set, **off by default** (§10.1). A visit shows
  the room's size only, never a tier name, badge or anything health-derived; piece sheets on a visit show the
  catalogue's generic rule, never "they earned …".
- **Gifts and deleted accounts:** a gift sent before the gifter deletes their account is still delivered (the piece
  comes from the catalogue, not the gifter's data). Unopened gifts **to** a deleted user are dropped (§10.3).

## 1. What changes from Spec B, and what stays

### Changes

| Spec B (built) | Free-build |
| --- | --- |
| 12 room slots, one item each | A list of **placements**: any owned piece, anywhere it fits |
| Front-on 170 × 110 one-point room | **Isometric** room on a 2:1 tile grid, 7 × 7 to 9 × 9 tiles |
| Owning is yes or no | Owning is a **count**; duplicates allowed |
| Hotspot tags and a per-slot tray | Edit mode: grid, drag with a ghost, snap, a toolbar, an **inventory drawer** |
| Everything from unlock rules | Unlock rules **plus** KIP coins earned from healthy days (§6) |
| One room size | Three sizes, earned (§7) |
| Loops are decoration | Some pieces have **effects** (§8) |
| Your room only | Buddies can visit, cheer and gift; weekly theme challenges; a share card (§10) |

- The three "room-wide" slots become **styles**: `wallpaper` (both back walls), `floor` (the floor diamond) and
  `window` (the frame and decor around the fixed window glass). A style always holds one item.
- The other nine slots become **categories** for the drawer and the shop. `slot` stays on every catalogue item (Spec
  B's rules, tests and copy use it); placement rules come from the new `iso` fields (§2.1).
- `HotspotLayer.tsx`, `hotspots.ts` and `HOTSPOT_CELLS` are deleted in P1. `DecorateTray.tsx` becomes the inventory
  drawer. `DecorateTile.tsx` and `SetCard.tsx` are kept and reused.

### Kept as they are

- **Catalogue ids** are permanent. No id is renamed, reused or deleted. New pieces get new ids in the same
  `{prefix}.{boardKey}` form (Spec B ruling P1).
- **Unlock rows** (`CosmeticUnlock`), every unlock rule, `grantCosmetics` and its hooks, the backfill by time, the two
  counters, `fresh` and `seenAt`.
- **Worn items**: `CosmeticLoadout.worn`, `kipWorn` for buddies, worn art and its drawing order, the small-size rule,
  the frozen Campfire exemption, `useMyKip()`.
- **Store guards** in `cosmeticsStore`: the epoch bump at the start of every mutation, the session counter for save
  answers, the "ignore a lower version" rule, the shared in-flight load, and the editor saving against **the
  version its draft was built on** (Spec B final review fix #1).
- **Toasts**: `RoomToastHost`, the celebration line "New for KIP's room: …", the backfill summary, `kipToasted`, the
  Decorate dot. Their "Decorate" button now opens the editor with the drawer on **New**.
- Spec A's lighting model: daylight by weather, the night veil, emissive glows after the veil, 3-frame loops at
  400 ms, Reduce Motion, `veiled()` for non-emissive loop colours (NIGHT-FRAMES ruling).

## 2. Data model

### 2.1 Catalogue additions (`backend/src/cosmetics/catalogue.ts`)

Every placeable item gains an `iso` block. Style items (`wallpaper`, `floor`, `window`) and worn items do not.

```ts
type IsoLayer = 'floor' | 'wall' | 'onTop';

type IsoSpec = {
  layers: IsoLayer[];            // where it may go; e.g. a cactus: ['floor', 'onTop']
  foot?: [w: number, d: number]; // floor footprint in whole tiles, facing L; turning swaps it
  flat?: true;                   // rugs: drawn under everything, never block other pieces, never overlap a rug
  wall?: [along: number, high: number]; // wall size in half tiles along the wall × 4-cell steps up
  surface?: { z: number; spots: Array<[i: number, j: number]> }; // things can stand on it (desk, bookcase, plank)
  facings: 1 | 2;                // 2 = drawn facing L and R (§4); 1 = symmetric, Turn is off
  effect?: EffectKind;           // §8; P3
  kipDesk?: true;                // the desk KIP sits at (§3.6)
  seat?: [i: number, j: number]; // KIP's tile relative to the desk, for kipDesk pieces
};

type CosmeticItem = /* Spec B fields */ & {
  iso?: IsoSpec;
  grants?: number;               // copies an unlock gives; default 1; frozen once shipped (snapshot test)
  price?: number;                // coins; absent = not in the shop (§6.4); P2
  shop?: 'always' | { week: string }; // a weekly piece is only offered in that ISO week; P2
  tags?: string[];               // 'warm', 'plant', 'glow'… for challenge briefs (§10.4); P4
};
```

- **Spots** are a short, art-defined list of positions on a surface (in tile fractions from the piece's origin, as
  `isox.py` places the mug at 4.05 on a desk at 1.9). Each spot holds one on-top piece. The desk has 3, the bookcase
  4, a wall plank 2. Spots make stacking deterministic and easy to validate.
- **On-top pieces** have a 1 × 1 footprint or smaller. Nothing stands on an on-top piece (one level of stacking).
- **Releases.** `release <= COSMETICS_RELEASE` becomes `SHIPPED_RELEASES.has(item.release)` (a frozen set, starting
  `{1}`), because new releases no longer arrive in order: Spec B's B2 (release 2) can now ship after free-build
  pieces. New pieces use releases 3 (P1), 4 (P2 shop pieces), 5 (P3 effect pieces) and 6 (P4 challenge pieces).
  `RELEASE_LAUNCHED_AT` becomes a full `Record` with a date per shipped release (fixes Spec B's deferred "typed
  Partial" minor). The export and `grantCosmetics` filter on the set.
- **New structural pieces in P1** (all `starter`, release 3):
  - `shelf.plank`: a wall plank with 2 spots, so the old shelf slot's items have somewhere to stand (§2.4);
  - `lamp.welcome`: C7's welcome lantern, glows at night; owned by everyone from P1, so it is a starter item;
  - **every item with slot `desk`** gains `kipDesk`, a 3 × 2 footprint (desk and chair), 3 spots and a `seat`:
    release 1 now (`desk.monitor`, `desk.notebook`, `desk.laptop`, and Cottage's `set.cottage.desk`), release 2
    (`desk.dual`, `desk.crt`, `desk.typewriter` and the B2 set desks, the Japanese `low` table included) when B2
    ships. A catalogue test fails if any `desk` item lacks them. A desk piece draws the desk, the chair and its
    screen, as the slot item does today.

### 2.2 Ownership becomes counts

```
owned(item) = (starter ? 1 : 0)
            + (unlock row ? item.grants ?? 1 : 0)
            + sum(ItemGrant.qty for item)        // P2: purchases, gifts, prizes
placed(item) = number of placements of item in the layout
in inventory = owned − placed                    // the drawer's "×n"
```

- Spec B's rows already give every unlocked item a count of `grants` (default 1). No existing data changes.
- **`ItemGrant`** (new in P2) is the only other way a count moves:

```prisma
model ItemGrant {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemId    String
  qty       Int      // +1 bought, +1 gift opened, +1 prize, −1 gift sent, +1 gift returned
  sourceKey String   // 'buy:{requestId}', 'gift_out:{giftId}', 'gift_in:{giftId}', 'gift_back:{giftId}', 'prize:{weekId}'
  createdAt DateTime @default(now())
  @@unique([userId, sourceKey])
  @@index([userId, itemId])
}
```

- A count never drops below 1 for an item you have ever owned except by your own gift, and a gift can only send a
  spare (§10.3), so "items are never taken away" still holds.
- **The race between a save and a gift:** `PUT /me/cosmetics` and gift-send both take the same per-user
  `pg_advisory_xact_lock`, and gift-send re-checks the spare against the **stored** layout inside it, so a save can
  never place a copy that a gift has just sent. As a read-time backstop, if a stored layout ever places more copies
  of an item than are owned, the excess placements are dropped at read in a fixed order (highest instance id first)
  and their children return to the inventory; the stored row is not rewritten until the next save.
- **Never removed:** Spec B's source-grep guard extends to `itemGrant.delete*`, `coinEvent.delete*` and raw SQL
  `DELETE` on the new tables, outside `users/deletion.ts` and the fixture purge.

### 2.3 The layout

Stored on the existing `CosmeticLoadout` row (one row per user, one `version`), so worn items and the room keep one
save and one concurrency check.

```prisma
model CosmeticLoadout {
  // Spec B: userId, room (slot record, read-only from P1; dropped in P2), worn, version, updatedAt
  layout    Json?    // RoomLayout; null = not converted yet (§2.4)
  tier      Int      @default(1)  // 1 starter 7×7, 2 bigger 8×8, 3 loft 9×9; written only by the expand route (§7)
}
```

```ts
type Placement = {
  id: string;              // instance id, made by the app: /^[a-z0-9]{1,12}$/, unique in the layout
  item: ItemId;
  layer: 'floor' | 'wallL' | 'wallR' | 'onTop';
  x: number; y: number;    // floor: tile i, j of the back corner; wall: half-tile along, 4-cell step up; onTop: 0, 0
  facing: 'L' | 'R';       // which drawn facing (§3.5); always 'L' for facings: 1
  mirror: boolean;         // Flip
  parent?: string;         // onTop only: the instance it stands on
  spot?: number;           // onTop only: the parent's spot index
};

type RoomLayout = {
  v: 1;
  styles: { wallpaper: ItemId; floor: ItemId; window: ItemId };
  pieces: Placement[];     // order is not meaningful; the engine sorts (§3.4)
};
```

- **No row** still means the starter room: the starter layout (§11.1) and empty worn slots.
- `tier` is on the row, not in `layout`, so a room save can never change its own size.

### 2.4 Migration from slots

Migration `20261016120000_freebuild` adds `layout` and `tier`. Conversion is a pure function,
`backend/src/room/convert.ts` `layoutFromSlots(room)`. Its input is Spec B's **sanitised** room, `readRoom(loadout.room,
owned)` (`cosmetics/loadout.ts`), never the raw JSON, so an unowned, unshipped or wrong-slot id has already become the
starter piece. It is used two ways:

- **lazily** by `GET /me/cosmetics` when `layout` is null: it writes the result with
  `updateMany({ where: { userId, layout: null, version } })`, without bumping `version`. A count of 0 means the
  script or another GET got there first: the GET re-reads and returns that row. It never errors;
- by a one-off idempotent script, `backend/scripts/convert-room-layouts.ts`, with the same conditional write.

Either order is safe. **P2 drops `room`:** P2's migration first runs the conversion for every row whose `layout` is
still null, and refuses to drop the column if any remain.

- **Every existing room converts to an equivalent iso room.** Each slot maps to a fixed position taken from
  `isox.py`'s `standard` room:

| Slot | Becomes |
| --- | --- |
| wallpaper, floor, window | the three styles |
| desk | the desk piece (its `kipDesk` item) at tile (2, 0), facing L |
| desk_item | on the desk, spot 2 |
| lamp | on the desk, spot 0 |
| shelf | a `shelf.plank` on `wallR` at half-tile 6, step 10 (half-tiles 6–9, 40 cells up, above the desk, as `standard`'s plank at i 3.0, z 38), the shelf item on spot 0 |
| art | `wallR` at half-tile 2 (where `standard` hangs the poster); every release-1 art piece is at most 4 half-tiles wide, so it ends at or before the plank's half-tile 6 (the conversion test checks each one) |
| plant | floor tile (0, 0) |
| corner | floor tile (5, 0) (the largest corner footprint fits there) |
| rug | flat, tiles (1, 2) to (4, 5) |
| pet | floor tile (4, 5) |
| empty slot | nothing placed |

- A test converts every release-1 item in every slot and asserts a valid layout (§16).
- **Worn is untouched.** `room` is kept read-only for one release (GET still returns a slot `room` derived from the
  layout, for any dev build on Spec B) and dropped in P2's migration.
- A slot-shaped `PUT /me/cosmetics` (a `room` key, no `layout`) gets **400 `update_app`**. Spec B has not shipped to
  users (draft PR #66), so only dev builds can send one. **Accepted default (§0):** Spec B and P1 reach users in the same
  app release, so no user ever sees the slot editor.

## 3. The isometric engine

`mobile/src/lib/room/iso/`, pure, no React, ported from `iso.py` and `isox.py`. The slot engine's `draw.ts` is
replaced in P1. `slots.ts` has many importers (`WORN_SLOTS` and `WornSlot` are used by `api/buddies.ts`, worn art and
the decorate code), so its slot ids and types move to `lib/room/catalogue.ts` and the importers are updated; only
`SLOT_ANCHORS` and `DRAW_ORDER` are deleted. `paint.ts` (`R`, `E`, `poly`, `gradV`, `shade`), `weather.ts` and the
item art helpers in `items/shared.ts` are kept.

### 3.1 The grid

- **Tiles are 24 × 12 cells** (`HT = 12`, `HH = 6`), the 2:1 projection `P(i, j, z) = (ox + (i − j)·12,
  oy + (i + j)·6 − z)`. `i` runs down-right along the right wall, `j` down-left along the left wall, `z` is height in
  cells.
- **Walls** are 64 cells tall on the two back sides (`j = 0` is the right wall, `i = 0` the left wall). Wall pieces
  sit on a wall grid of half tiles along and 4-cell steps up.
- **The room's size in cells** is `W = (n + m)·12 + 4` and `H = 68 + (n + m)·6 + 8`: 172 × 160 for 7 × 7,
  196 × 172 for 8 × 8 and 220 × 184 for 9 × 9. These are the iso equivalents of F5's front-on 170 → 230 → 290
  widths: each tier still adds floor and wall, but in iso a tier adds one tile row on each side, not three columns
  (C2 wins over F5).
- **Drawn at 2 points per cell**, as Spec A: a 7 × 7 room is 344 × 320 points, so the KIP page crops it (§9.1) and
  the editor pans it (§5.6).

### 3.2 Footprints and the wall

- A floor piece covers `foot` tiles from its back corner `(x, y)`; turned, `w` and `d` swap. It must lie inside
  `0 ≤ i < n`, `0 ≤ j < m`.
- **Blocking:** floor footprints never overlap, except `flat` pieces (rugs), which may sit under anything but never
  overlap another rug. KIP's desk is a normal floor piece. Its `seat` (the chair tile) is **inside** its 3 × 2
  footprint, on the front row; the tile in front of the seat, the desk's **exit tile**, is reserved too (no other piece
  may cover it, `bad_place: seat`), so KIP can always walk out (§9.2).
- **Wall pieces** cover `wall[0]` half tiles along and `wall[1]` steps up, from `(x, y)` on `wallL` or `wallR`. They
  stay inside the wall, never overlap each other, and never cover a window opening.
- **Windows** are part of the shell, not pieces: one on the left wall (tiles 1.6–3.6 along `j`, with a sill), as
  `isox.py`'s `shell`, and a second on the **right** wall in the loft at `i = n − 2.6` (`isox.py` `window2`), about
  half-tiles 12.8–16.8 on a 9 × 9 room (C2). That span is wall an 8 × 8 room can use, so growing to the loft stores
  any wall piece it would cover (§7). The glass always shows today's Recovery weather (Spec A §6). The `window` style draws its frame and
  decor around every window.

### 3.3 Stacking

- An on-top piece names a `parent` placement whose item has a `surface`, and a free `spot` on it. It is drawn at the
  spot's position at the surface's `z`.
- The parent may be a floor piece (desk, bookcase) or a wall piece (plank). A surface's spots are its only places;
  dropping near a surface snaps to the nearest free spot.
- Moving the parent carries its children. Storing the parent stores its children too (they go back to the inventory;
  the toolbar says "Store desk and 2 pieces on it").
- One level only: an on-top piece has no surface.

### 3.4 Depth sorting

- Order: the shell (walls, floor, styles), wall pieces (left wall back to front, then right), flat pieces, then floor
  pieces and their children, then the light layer, emissive, and the loop frames.
- **Floor pieces are sorted topologically**, not by a single key: A is behind B when A's far edge is at or behind B's
  near edge on either axis (`A.i1 ≤ B.i0` or `A.j1 ≤ B.j0`). Footprints never overlap, so the order always exists. Ties
  break on instance id, so the picture is deterministic. With at most 90 pieces the O(n²) sort is well under a
  millisecond.
- A piece's children are drawn right after it, in spot order (back spots first).
- **Movers** (KIP and the pet, §8, §9) are not in the static picture. They are inserted into the sorted list at the
  tile they stand on, so a bookcase in front of KIP hides KIP's legs (§3.7 says how this stays cheap).

### 3.5 Flip and Turn

- Each piece with `facings: 2` is **drawn twice**, facing **L** (front toward the lower left, long side along `j`) and
  **R** (front toward the lower right, long side along `i`). Both drawings take the room's light from the window side
  (left faces lighter, right faces darker, as `iso.py`'s `box`), so a turned piece is never a mirrored picture with the
  shading the wrong way round.
- **Turn** switches L ↔ R and swaps the footprint, keeping the back corner. If the turned piece would not fit, it
  shakes and stays.
- **Flip** mirrors the piece's own detail inside its facing (the lamp head on the other side, the cat bed's opening),
  as a `mirror` argument to its draw function. The footprint is unchanged. Every piece can flip (F4).
- Symmetric pieces (`facings: 1`: most plants, round lamps) have Flip only; Turn is greyed.
- Wall pieces have a drawing per wall (sheared along `i` or `j`). Dragging one round the corner switches wall; Flip
  mirrors it.

### 3.6 KIP in the room

- KIP is drawn at Spec A's size (2 cells per KIP pixel), front-on, standing on a tile centre (`isox.py` `kipx`), with a
  soft shadow. "Facing" is Spec A's mirror plus the `glance` mood. No back or side view is drawn.
- **At the desk** KIP stands at the desk's `seat` tile (the chair), facing the screen while thinking, facing you while
  answering, as Spec A §3.4. The seat moves with the desk. Spec A's `kipSeat` and the `low` style become the desk
  piece's `seat` (Spec B's Japanese low table seats KIP on a floor cushion tile).
- **Walking** (P3, §9.2) uses the same sprite with a 1-cell bob on alternate frames. Legs never change (the arms-only
  rule holds); KIP glides tile to tile.

### 3.7 Rendering and performance

- **Per-piece pictures.** Each piece is recorded once into an `SkPicture` keyed by (item, facing, mirror, night,
  colour, effect state) and cached (LRU of 200). The static room is one picture built from the shell and the sorted
  pieces. With no movers on screen, a frame draws that one picture, KIP, light, emissive and the current loop frame.
- **With movers**, the frame draws the cached piece pictures in sorted order with the movers inserted at their depth.
  This is a list of picture draws, not a rebuild.
- **Budget** (release build, iPhone 12 / Pixel 6 class), for a full 9 × 9 room of 90 pieces at night. These are
  **on-device targets checked by hand** in each plan's simulator and device pass; the Jest perf test is a measurement,
  not a gate (Spec B ruling P32):
  - building every piece picture cold: **under 8 ms**; rebuilding the static picture after a drop: under 8 ms;
  - composing one frame with two movers: **under 2 ms**;
  - dragging runs at 60 fps: the held piece is a separate ghost layer; the static picture is rebuilt once when you
    pick a piece up (without it) and once when you drop it, never during the drag.
- **Crisp pixels:** whole points only, antialiasing off, one `Path` per colour per picture (Spec A). Iso diagonals are
  2:1 stair steps (`iso.py` `line`), never smoothed lines.
- **Lighting carried over:** daylight through each window by weather; the night veil over everything; emissive pieces
  and glows drawn after the veil; loop frames above the veil, with `veiled()` for their non-emissive colours. KIP is
  drawn under the light layer (Spec A ruling P4).
- **Loops:** 3 frames at 400 ms, paused when the screen is unfocused or the editor covers it, off under Reduce Motion
  (frame 0 shows), as Spec A.

## 4. The art pipeline

- **Still code, not images.** Each piece is a draw function on the iso grid returning layered rects (`base`,
  `emissive`, `frames`), using `iso.py`'s `box`, `flat`, `face` and `line` ported beside the v2 primitives. No image
  assets are added. `tint` pieces still take KIP's ramp.
- **Two facings per piece** (§3.5): `draw(ctx, { facing, mirror })`. Symmetric pieces declare `facings: 1` and draw
  once.
- **Styles** are textures: each wallpaper is drawn on both walls (sheared), each floor on the diamond, each window
  style around the glass. One drawing each.
- **Icons** for the drawer and shop stay Spec B's 16 × 16 SVG icons (`icons.ts`). New pieces add icons in the same
  format. Icons never build a room picture.
- **Size budget:** room art code at most **300 KB** minified (Spec B's 150 KB budget doubled for two facings; the
  front-on art measured 35.9 KB). `mobile/scripts/room-art-size.mjs` is run by hand before each art batch.
- **What ships in P1** (release 1, redrawn, and release 3):
  - the **54 placeable release-1 pieces** (art 10, shelf 6, desk 4, desk item 8, plant 7, lamp 5, corner 5, rug 7,
    pet 2), each in two facings unless symmetric;
  - the **21 release-1 styles** (9 wallpapers, 5 floors, 7 window styles);
  - `shelf.plank` and `lamp.welcome`;
  - the Cottage set, re-composed as an iso layout (§5.5).
- **Later batches:** P2 the shop's own new pieces from F6/C1 (`item.radio`, `corner.gnome`, `corner.cone`,
  `corner.pumpkin`, `item.candle`, `art.neonheart`), P3 the effect pieces and states (`pet.tabby`, `shelf.awards`,
  §8), P4 the challenge pieces and trophies. Pieces the boards price that already exist with an unlock rule (floor
  lamp, cat bed, monstera, snake plant, and B2's lava lamp, duck and cat) are **not** re-made as shop pieces: they
  appear in the shop locked with their rule, and as extra copies once earned (§6.5). Spec B's B2 (release 2) is drawn isometric when it ships; it is never drawn front-on.
- Worn items are unchanged: KIP's sprite is front-on everywhere.

## 5. Editing (F1 + F4)

### 5.1 Entry

- The **Decorate** button on the KIP page header and in the room card (Spec B), **long-press on the room** (C6),
  the toast's "Decorate", and the celebration line's "Decorate" all open the `DecorateRoom` route, now the free-build
  editor (`{ drawer?: 'new' | DrawerTab; item?: ItemId }`).
- It stays a full-screen modal. **Decision (default):** C6's "drawer over the chat" is drawn as this modal (room on
  top, drawer below, the chat hidden), not an inline mode on the KIP page: one editor, one undo stack, and no fight
  with the keyboard or the page scroll.

### 5.2 Layout, top to bottom

1. **Header:** "Cancel" (ghost `Button`), "EDITING" (pixel title), the coin wallet chip (P2), "Done" (default
   `Button`; disabled until something changed; loading while saving). Under it the **room count**, "31 / 40 in room".
2. **The room**, full width at 2 points per cell, pannable (§5.6), with the **grid overlay**: the floor diamond's tile
   lines and the walls' half-tile dots (`isogrid` on the boards). A small outline icon `Button` toggles the grid
   (label "Show grid" / "Hide grid").
3. **The toolbar** when a piece is selected (F4 "Selected piece"): the piece's name and where it is ("Desk lamp · on
   the desk", "×2 in inventory"), then **Move**, **Flip**, **Turn**, **Another**, **Store**. All outline `Button`s,
   44 points tall at least. With nothing selected the row shows **Undo** and **Redo**.
4. **The inventory drawer** (§5.4).

### 5.3 Moving pieces

- **Drag:** press and hold a placed piece (200 ms) or a drawer tile, then drag. The piece lifts into a **ghost** (the
  piece at 70% opacity, drawn over the room) that follows your finger, offset upward so the finger never hides it.
- **Snap:** the ghost snaps to the tile under the finger (floor), the half-tile under it (wall: posters snap to the
  wall grid), or the nearest free spot of the surface under it ("A mug snaps onto the desk"). Each new snap gives a
  light haptic tick (`expo-haptics`, already a dependency).
- **Invalid:** the ghost turns **red** with a short reason under the room: "Overlaps the chair", "Doesn't fit here",
  "Only on the floor", "Room is full", "Effects 3 of 3" (P3). Letting go on an invalid spot puts the piece back
  where it came from; from the drawer, it goes back to the inventory ("Let go here and the beanbag goes back to the
  inventory").
- **Tap to select** a placed piece (a 2-point light outline); tap empty floor to deselect.
- **Toolbar:**
  - **Move** starts nudge mode (§5.7). Or just drag.
  - **Flip** mirrors (§3.5). **Turn** switches facing; greyed for symmetric pieces and when the turned piece would not
    fit.
  - **Another** places one more copy from the inventory on the nearest free valid tile or spot; greyed at ×0.
  - **Store** sends it (and anything on it) back to the inventory. Nothing is ever deleted.
  - For the **desk** (`kipDesk`), Store and Another are greyed: the room always has exactly one desk. Swapping desks
    is the drawer's **Replace desk** on a desk tile: the new desk takes the old one's back corner and facing if it
    fits (otherwise "Doesn't fit here"); children keep their spot index where it exists, the rest go to the
    inventory; one undo step.
- **Undo / Redo** go back and forward **20 steps** in this session (F4). Every drag, toolbar action, style change and
  set apply is one step.
- **Room full:** at the tier's cap the drawer's Place is disabled and a dragged-in piece shows "Room is full". A card
  (F4 "Can't place · room full") says "KIP's room is full. {cap} pieces fit this room. Store something to make space,
  or grow the room" with **Store a piece** and **See room sizes** (P2; before P2 only Store).
- **Done** saves with `PUT /me/cosmetics` against the draft's base version; 403 / 409 re-read and keep the user in
  the editor exactly as Spec B §6.4 and Task 14's rulings (honest refresh notice, editing inert while saving, every
  failure announced). **Cancel** with changes asks "Discard your changes?".

### 5.4 The inventory drawer

- A bottom sheet, half height, draggable to full. Header: "Inventory · {n} not placed".
- **Tabs** (a `tablist` of `Button`s, picked `default`, others `outline`): **All**, **Floor**, **Wall**, **On top**,
  **Funny**, **Effects** (P3), **New** (only while anything is unseen), a **theme tab** during a challenge (P4,
  "Autumn"), then **Room** (the three styles) and **KIP** (worn items, Spec B's KIP tab) and **Sets**.
- **Tiles** (Spec B's `DecorateTile`, at least 64 points): the icon, the name in `text-fine`, the count "×3", a NEW
  tag for unseen pieces. A tile at ×0 (everything placed) stays, dimmed, with "All placed". Locked pieces are not in
  the drawer; they live in the shop and the unlock list.
- **Tap a tile** to select it; its row shows **Place** (default `Button`), which puts it on the nearest free valid
  tile to the room's centre and selects it. Hold to drag it in.
- **Room tab:** Walls, Floor and Window rows of style tiles; tapping one applies it room-wide (one undo step).
- **KIP tab:** worn items as Spec B §6.2 (KIP drawn large above the grid).
- **Sets tab:** Spec B's set cards. **Apply set** asks "Store everything and set up {set}?" and then stores every
  piece and places the set's own iso layout (each set ships one), using owned copies only; one undo step.
- "How new things arrive" stays at the end of the drawer, with a P2 line for coins.

### 5.5 Sets as layouts

A set is now a named **layout** (styles plus placements) instead of a 12-slot loadout. P1 ships Cottage's; the other
five come with B2. The Sets tab's locked "Preview" draws the set's layout and cannot be saved (Spec B ruling P18).

### 5.6 Panning

When the room is larger than the view, one finger on empty floor pans; a dragged piece near an edge auto-scrolls.
The view opens centred on KIP's desk. No pinch zoom in v1 (zoom breaks whole-point crispness).

### 5.7 Without dragging (accessibility)

- **Everything works without a drag.** Place from the drawer (tap, Place), then **Move**, which shows four arrow
  `Button`s along the tile axes ("Back left", "Back right", "Front left", "Front right"), plus **Up** / **Down** on a
  wall, and **Put on…**, a list of the free surfaces and spots ("On the desk", "On the wall plank").
- **Screen readers:** the room is one image in view mode. In the editor, a "Pieces in the room" list under the room
  has one button per placement, "Fern, on the floor, tile 3, 4", which selects it. Each nudge announces the result
  ("Moved. Tile 4, 4" or "Can't move there: overlaps the chair").
- All targets are at least **44 points**. Spoken labels never contain "·" (Spec A ruling G6).

## 6. Economy (F6, C1, C2, C8)

### 6.1 Rules

- **KIP coins** are one balance per user. They are earned **only** from things the app already measures or records.
  They can't be bought, sold, traded, gifted or won from ads. **There is no real-money path anywhere**: no in-app
  purchase library, no price in a currency, no "get more coins" button (a test guards the dependencies and the copy).
- **No loss:** coins never expire and are never taken away. A missed day earns less; it costs nothing. A night whose
  sleep is later revised below the goal keeps its coins.
- **Nobody sees anyone else's balance.** Rooms are shown off; wallets are not.

### 6.2 Sources and amounts (C8, accepted defaults, §0)

| Source | Pays | When | Source record (idempotency key) | Cap day |
| --- | --- | --- | --- | --- |
| Sleep goal hit | 20 | once a night | `sleep_goal:{wakeDate}`: the night's SLEEP rollup meets the goal in effect that night, by the same marker the SLEEP_GOAL badge uses (`achievements/families.ts`) | the wake date |
| Step goal hit | 15 | once a day | `steps:{localDate}`: a new `StepGoalEvent` row (`recordStepGoal` returned true) | that date |
| Check-in | 5 | once a day | `checkin:{habitDay}`: an **on-time** `HabitCheckIn`, the check-in the CHECK_IN badge counts | the habit day |
| Weekly recap read | 10 | once a week | `recap:{recapId}`: `POST /me/recaps/:id/opened` set `openedAt` on a **WEEK** recap (also fixes Spec B's deferred "MONTH opens" minor) | the open's local date |
| A cheer given or received | 2 | 5 paid a day, given and received together | `cheer:{roomCheerId}:{given|got}`; an entry cheer `ccheer:{weekId}:{fromId}:{toId}:{given|got}` (§10.2, §10.4) | the cheer's local date in each person's zone |
| Theme challenge entry | 30 | once a week | `challenge:{weekId}` (§10.4) | outside the cap |
| First-week list bonuses | 10 + 25 | once ever | `firstweek:{task}` (§11.2) | outside the cap |

- **Daily cap: 60** per civil day, over the capped sources. Health goals pay up to 40 a day, cheers up to 10, the
  recap 10. Today the regular sources add up to exactly 60, so the cap is a guard for future sources; it is still
  enforced: an earn that would cross it is trimmed to what is left, and an earn with nothing left is **written with
  `amount: 0`**, so its key is used up and the event still counts for plant growth (§8.3) and first-week ticks
  (§11.2). A cheer past the 5 paid a day is written the same way.
- **Which day:** an event's `capDay` is its source's own civil date in the table above (a check-in's habit day is a
  civil date). The history's "Earned today" bar sums today's `capDay`, today being `todayFor(userId, now)`'s civil
  date, not the 04:00 habit boundary.
- **Only measured data pays.** Sleep and steps come from the health sync, never from typed input. The check-in is the
  one self-reported source, and it is the smallest.
- **No backpay.** A source whose civil date (the wake date, the step day, the habit day, the open or cheer date) is
  before the user's local civil date of `COINS_LAUNCHED_AT` (set when P2 ships) writes nothing, not even a 0 row;
  the first-week list is the welcome. Plant growth therefore starts counting at P2.
- **No health values in the ledger.** An event stores its kind, key, amount and civil date, never minutes or steps,
  so neither the history nor any log can show one.

### 6.3 The ledger (server-authoritative)

```prisma
model CoinEvent {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind      String    // 'sleep_goal' | 'steps' | 'checkin' | 'recap' | 'cheer_given' | 'cheer_got' | 'challenge' | 'firstweek' | 'buy' | 'expand'
  sourceKey String
  amount    Int       // + earned, − spent
  capDay    DateTime? @db.Date   // the civil day it counts against the cap; null for uncapped and spends
  createdAt DateTime  @default(now())
  seenAt    DateTime?
  @@unique([userId, sourceKey])
  @@index([userId, createdAt])
}

model CoinWallet {
  userId  String @id
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  balance Int    @default(0)   // a CHECK constraint keeps it >= 0
}
```

- **One function writes coins:** `backend/src/coins/ledger.ts` `applyCoinEvents(userId, events)`. In one transaction
  under a per-user advisory lock (`pg_advisory_xact_lock`), it first **drops events whose `sourceKey` already
  exists**, then reads each cap day's capped total and trims what is left in a fixed order (by kind, then key), inserts
  with `createManyAndReturn` + `skipDuplicates`, and adds the inserted amounts to `CoinWallet.balance`. Filtering
  before trimming means a replayed event can never use up cap room that a new one needs.
- **Two-person events** (a cheer pays both sides) take **both users' locks in sorted user-id order** in one
  transaction, so two people cheering each other at once can't deadlock. A replayed or
  concurrent earn inserts once and pays once. **One payment per health event.**
- **Earning** is `earnCoins(userId, now)`, built like `grantCosmetics`: it reads the source records of the last 8
  civil days (and the week's recap), builds the events, and calls the ledger. It runs from the hooks (the sync
  worker after SLEEP rollups, `recordStepGoal` when it returns true, the habit check-in route, the recap-opened route,
  the cheer route) and on `GET /me/coins` as a catch-up. A failure is logged without values and never fails the
  request that triggered it.
- **Spending** (`buy`, `expand`) runs in the same locked transaction: check the balance, insert the negative event
  keyed by the app's `requestId`, write the grant or tier. A retried request with the same `requestId` returns the
  original result.
- Coin history reads the events (newest first, cursor pages of 30).

### 6.4 Sinks and prices (C8)

| Sink | Price |
| --- | --- |
| Pieces | 25–200 (about 1 to 4 good days) |
| Pieces with effects (radio, lamps, pets, lantern) | 120–200 |
| The week's theme piece | 80, that week only |
| Bigger room · 8 × 8 | 600, **and** the check-in badge level II (§7) |
| Loft · 9 × 9 | 1,500, **and** the sleep goal badge level III (§7) |
| Challenge entry | free |

- Prices live in the catalogue (`price`), so they are versioned and tested. Tuning is a catalogue change; no remote
  config is added.
- A good week earns about 340, a quiet week about 120 (C8), so the 8 × 8 room's coin side is about two good weeks.

### 6.5 How unlocks and coins live together

**Decision (default):**

- **Unlock rules still grant free.** Every Spec B rule keeps giving its pieces (`grants` copies), so "this lamp = 5
  good nights" still holds.
- **Coins buy:** the shop's own pieces (new pieces with a `price` and no unlock rule), the week's theme piece, and
  **extra copies** of pieces you already own (each purchase adds 1). A rule-locked piece is never sold before you earn
  it.
- Starter pieces can be bought as extra copies.

### 6.6 The coin shop (C1, F6)

- A full-screen route, `CoinShop`, from the drawer's header ("Coin shop"), the KIP page wallet and the coin history.
- **Header:** "Coin shop", "New pieces every Monday", the wallet chip. **Tabs:** All, Effects, Floor, Wall, On top.
- **This week:** the weekly set card ("Cosy autumn set · 5 pieces · this week only"). The week is the user's local
  ISO week (Monday start), from a server calendar of weekly pieces (`backend/src/coins/shopWeeks.ts`).
- **Tiles:** icon, name, price with the coin glyph, "×1 owned" if owned. Pieces with effects show "does something in
  the room".
- **Piece sheet:** name, where it goes ("Shelf, desk or floor · 1 tile"), its effect line, "You have 360 · 210 after",
  "Goes to your inventory", **Not now** (outline) and **Get for 150** (default). With too few coins the button is
  disabled and reads "Needs 40 more". Purchases are never optimistic: the button shows its loading state until the
  server answers, then the piece is in the inventory with a NEW tag.
- Footer: "Coins come from healthy days only. They can't be bought."

### 6.7 Wallet and coin history

- **Wallet chip:** a small coin glyph and the balance (tabular), in the KIP page header (C6), the editor header and
  the shop. A raw `Pressable` with a button role, label "{n} KIP coins. Open coin history" (one conventions entry).
- **Coin history** (F6 sheet): "Earned today · 40 of 60" with a bar, "A daily cap keeps it about habits, not
  grinding.", then rows: label, when, amount ("Hit your sleep goal · Today, 07:12 · +20"). Then "How to earn" with the
  amounts.
- **Coins land** (C1): unseen earn events show once on the next KIP page focus as a "+20!" bubble over the room and a
  short line under it ("Sleep goal hit", no values), then are marked seen. Under Reduce Motion the bubble does not
  float. Screen readers hear "Plus 20 coins. Sleep goal hit".

## 7. Room expansion (F5, C2)

| Tier | Floor | Pieces | Effects (P3) | Gate |
| --- | --- | --- | --- | --- |
| Starter | 7 × 7 | 40 | 3 | yours from day one |
| Bigger | 8 × 8 | 60 | 5 | 600 coins **and** a 14-day check-in streak |
| Loft | 9 × 9 | 90 | 8 | 1,500 coins **and** the sleep goal badge level III; adds the second window |

- **Both gates, always** (C2): coins alone never buy space, and a streak alone doesn't either.
- **The streak gate is a badge level**, so it never re-locks: the 14-day check-in streak is the CHECK_IN family's
  level II (threshold 14), earned once and never revoked. This is C2's "grace days" answer: a broken streak after the
  badge costs nothing. Progress reads "9 of 14" from the family's current run, as the badges screen does.
- **What expands:** one tile row at the front of each side (`n` and `m` grow by one), so every piece keeps its tile
  relative to the back corner and nothing moves; both walls get one tile longer; the cap and the effect slots rise;
  the loft adds the **right-wall** window.
- **Growing can cover wall space:** the loft's window sits on right-wall half-tiles an 8 × 8 room may use (§3.2). The
  expand transaction stores every wall piece it would cover (and anything on it) to the inventory, so a valid room
  never becomes `bad_place: window`, and the unlock card says so: "The new window needed the wall: 2 pieces went to
  your inventory".
- **Expand and the row:** `POST /me/room/expand` upserts the `CosmeticLoadout` row (with the starter or converted
  layout if there was none) and **always increments `version`** (a first row is created at version 1), because it may
  move pieces. It returns the full cosmetics body; an open editor rebases its draft onto the new version, dropping
  the stored wall pieces from the draft too.
- **Growing is your choice:** when both gates are met, the Room sizes screen's **Grow to 8 × 8** (default `Button`)
  spends the coins (`POST /me/room/expand`). It shows "Needs 240 more coins and 5 more days in a row" until then.
- **The unlock moment** (C2): the room redraws at the new size with "NEW FLOOR" / "NEW WALL" tags on the new tiles,
  "MORE ROOM!" over KIP (cheer pose), and a card "Your room grew · 600 coins and 14 days of check-ins in a row." with
  "+1 row each side · +20 pieces · +2 effect slots" and **Place things** / **Later**.
- A tier never goes down.
- **Ideas for later sizes** (Balcony, Second floor) are out of scope.

## 8. Effects (F7, C5)

### 8.1 The effect system

- An effect is a **small, closed list of behaviours**, each a pure function of the room's state, the time and, for
  health-linked ones, a band from §8.3. `EffectKind = 'light' | 'sound' | 'wander' | 'clock' | 'tap' | 'awards'`.
- **Cosmetic only.** Effects never change health data, scores, goals or what KIP says. They are never sent to the
  model, never in a coach context, and never shown to buddies in their health-linked state (§10.1).
- **Effect slots:** a room runs at most the tier's effect count (3 / 5 / 8). Placing one more effect piece is blocked
  with "Effects 3 of 3: store one to run another". Plant growth and the plant mood are room-wide rules, not effect
  pieces, so they use no slot.
- **Rooms saved before P3** may already hold more effect pieces than their slots (a clock and two floor lamps in a
  starter room). They never fail: the extra ones run **inert** (the first ones by instance id run), and the server
  rejects a save with `effects_full` only when it **raises** the number of effect pieces above the slots.
- **Piece card** (F7): tapping an effect piece in view mode (the KIP page's room, or the editor with nothing
  selected) opens a sheet: name, where it goes, how it was earned or its price, its effect line, and any switch (sound), with
  Move and Store.

### 8.2 The first set (P3)

| Piece (id) | Effect |
| --- | --- |
| Floor lamp (`corner.floorlamp`, existing, Steady bedtime · II) | `light`: a warm pool of light on the floor after dark, drawn after the veil, so the room isn't lost at night |
| Old radio (`item.radio`, new in P2, 150 coins) | `sound`: a quiet lo-fi loop while the room is open; notes float up. **Sound is off until you turn it on** in its card; the switch is remembered on the device |
| Cat (`pet.tabby`, new, 180 coins; B2's `pet.cat` gets the same effect when it ships) | `wander`: walks the front row, then naps in a cat bed (if placed) after 22:00 local; energy follows steps (§8.3) |
| Plants (every `plant` item; not effect pieces) | **mood:** with a plant in the room KIP gets one extra smile frame in its idle loop; **growth** (§8.3) |
| Lava lamp (`lamp.lava`, B2) | `light` plus slow purple blobs in its loop; ships with B2, not in P3 |
| Clock (`art.clock`, existing) | `clock`: shows your real local time (hour and minute hands, updated each minute) |
| Duck (`item.duck`, B2; ships with B2) | `tap`: squeaks (a two-frame squash, plus sound if the radio switch has sound on) when tapped. That's it |
| Trophy shelf (`shelf.awards`, new wall piece, starter, P3; the existing `shelf.trophyB` stays plain decor) | `awards`: one award piece per badge level you earn (§8.3) |

### 8.3 Health-linked visuals (C5)

The room mirrors your data. It never tells you what to do, and nothing breaks: plants pause, they never wilt.

| What | Signal | States |
| --- | --- | --- |
| Window | today's Recovery weather (Spec A §6, unchanged) | sun, mostly, cloudy, rain, night, fallback |
| Plants | **sleep-goal nights**: the count of `sleep_goal` coin events, including the 0-coin ones written at the cap (§6.2), which only ever grows; nights before coins launched don't count | stage 1–5, one stage per 7 nights; a new plant shows the room's current stage |
| Cat | today's steps as a band of `STEPS_GOAL`: under 30% naps, 30–99% wanders, at the goal plays | nap, wander, play; always naps after 22:00 |
| Trophy shelf | your Achievement rows | up to 8 awards, highest levels first |

- **Computed on the server, sent only to you:** `GET /me/cosmetics` returns `living: { plantStage, petEnergy,
  awards }` (bands and small counts, no raw values). The window keeps using `useTodayScene`. None of this is in any
  buddy DTO, the share card or a log.
- **Words the room uses** (C5, C8), all in `roomCopy.ts`:
  - Yes: "The fern grew: 7 nights at your goal." "Rainy today. Recovery is lower than usual." "The cat's napping."
  - Never: "Sleep more to grow your fern." "Walk 2,000 more steps to wake the cat." Nothing in the imperative, no
    "should", "try", "more", "need".
  - A copy guard test scans every effect and room string for those words. Health advice only ever comes from KIP's
    coach answers, with their usual care rules.
- A low day stays cosy: the rain is soft, the cat curls up, the lamp still glows.

## 9. KIP lives there (C6)

### 9.1 The room on the KIP page

**Decision (default):** the iso room **replaces the diorama inside the existing room card**; the card is not a
full-page backdrop behind the thread.

- The card keeps its frame, caption row ("KIP'S ROOM" over "Window shows today's Recovery"), the RECOVERY hot tag,
  **Shrink room**, **Decorate**, the collapse on scroll and the collapsed header (Spec A §3.5, FINAL-ROW 72 pt).
- **Crop:** the frame's inner height (`ROOM_FRAME_HEIGHT` in `RoomCard.tsx`) grows from 200 to **240 points**. The
  crop is a 140 × 120-cell box centred on KIP's desk (where the desk is, since the desk can move), clamped to the
  room; extra width shows more room. The collapsed thumbnail is 96 × 60 cells at 1 point, and also follows the desk.
- The speech bubbles, the states table and the accessibility label stay Spec A's; the label becomes "KIP in its room,
  {state}. Window: {weather}".
- Long-press on the room opens the editor (§5.1).
- The thread stays below the card, unchanged. Reasons: answers must stay readable, and the room scrolling away keeps
  motion out of the reading area.

### 9.2 Walking between answers

- **Only while idle** (no turn running, the prompt bar not focused, the screen focused, Reduce Motion off), KIP
  walks from its seat out through the desk's exit tile to a target's **use tile**, does a short use pose, and walks
  back. Targets are effect pieces **and plants** (plants are not effect pieces, §8.1, but KIP tends them): the radio
  (KIP sways, notes), plants (new pose `water`, an arm out with a held can; the arms-only rule holds), the cat
  (`wave`). One trip every 20 to 40 seconds, never two in a row to the same piece.
- **Use tiles:** for a floor piece, the free tile in front of its facing side; for a wall piece, the floor tile
  against that wall under its centre; for an on-top piece, its parent's use tile. Only targets whose use tile is
  **inside the current crop** (§9.1) are picked, so KIP never walks out of view.
- **Pathing:** breadth-first search on the floor grid (at most 81 tiles), avoiding footprints, flat pieces allowed.
  No path, no trip. One tile per two loop frames (800 ms).
- **Stop at once:** focusing the prompt bar, sending, a status change or blurring the screen puts KIP back on the
  seat in the same frame (no walk back), so the thinking and answering poses always start at the desk.
- The pet uses the same pathing on the front row.

## 10. Social (F8, C3, C4)

### 10.1 Visiting a buddy's room

- **Who:** buddies only, both directions active, neither has blocked the other, and only when the owner has turned on
  **"Buddies can visit my room"**. It is a sixth key, `room`, in `SHARE_KEYS` (`buddies/sharing.ts`), **off by
  default**, following that file's model: enabling it needs consent for the current version, it is always read
  through `effectiveSharing`, and it reads off after any future version bump until re-consent. **Decision:** the
  switch is added **without** bumping `BUDDY_SHARING_CONSENT_VERSION`; the consent sheet gains one line about rooms (a
  wording change, as Spec A's Task 14 did). A bump would turn the five health switches off for everyone, and the
  room is not health data.
- **Where from:** a buddy's profile and their KIP in Chats (F8: "tap a buddy's KIP on Home or in Chats"). The
  Campfire stays frozen and gets no entry point.
- **The view** (`BuddyRoom` route, read-only, C4): "{first name}'s room", "8 × 8 · 44 pieces" (the size only), their KIP in their
  colour and worn items saying "HI THERE!", "Just looking: you can't move anything". Pan works; nothing can be
  selected or moved.
- **What a buddy can see:** the layout (styles and placements), the room's **size** (tiles), KIP's colour and worn
  items, and the week's cheer count. **Never:** a tier name, a badge or how the size was earned, your balance, inventory, counts, coin history, unlocks, challenge standing outside the
  challenge screen, or any health-linked state. A visit draws every health-linked effect **neutral**: the window's
  fallback sky, plants at full growth, the cat wandering, the trophy shelf empty. Day or night follows the visitor's
  clock.
- **"Pieces you don't have":** a row of the pieces in their room you don't own; tapping one shows its price or the
  catalogue's generic rule ("Steady bedtime · II"), never "they earned …".

### 10.2 Cheers on rooms

- **Cheer {name}'s room** (default `Button`): one cheer per room per day (the visitor's local day). The owner sees
  who cheered (their buddies' names in their own room's cheer sheet); a visitor sees only the week's count.
- **Pays both** (C4): +2 to the giver and +2 to the owner, each counted in that person's **5 paid cheers a day**
  (given and received together). After 5, cheers still count and show, but pay nothing. Gifts never pay.
- `RoomCheer { id, fromId, toId, localDate, createdAt }`, unique on (`fromId`, `toId`, `localDate`); both relations
  `onDelete: Cascade`, like `Sticker` and `BuddyPair`.
- Room cheers are separate from Spec B's `buddy_cheers` counter (stickers), which is unchanged.

### 10.3 Gifts (C4)

- **Only spares:** you can gift a piece you own at least twice, with at least one copy not placed. You always keep
  one of everything. Coins can never be gifted.
- **Send a spare:** pick from "From your spares" (×count), pick a note from a fixed list ("For your desk", "Cosy!",
  "Thought of you"; notes are picked, not typed, so there is nothing to moderate), **Send gift**. The sender's count
  drops by one at once (`ItemGrant −1, gift_out`).
- **What they see:** a gift box on their floor (a virtual piece on a free front tile, not a placement). Tapping it
  opens it and the piece goes to their inventory with NEW (`ItemGrant +1, gift_in`).
- **Limits:** 3 gifts sent a day; buddies only; blocks apply both ways; a muted sender's gift arrives without a notice.
  An unopened gift is returned to the sender (`gift_back`) if either person blocks the other or the pair ends.
- **Deleted accounts** (controller ruling, §0): a gift whose **sender** deletes their account is still delivered and
  can still be opened (`fromId` becomes null; the box says "A gift"). Unopened gifts **to** a deleted user are dropped.
- **Sending** runs under the sender's advisory lock (the one `PUT /me/cosmetics` takes, §2.2) and re-checks the spare
  against the stored layout inside it.
- `Gift { id, fromId String?, toId, itemId, note, createdAt, openedAt?, returnedAt? }`: the `from` relation is
  `onDelete: SetNull`, the `to` relation `onDelete: Cascade`.

### 10.4 Weekly theme challenges (C3, F8)

- **The calendar is server-side:** `backend/src/challenges/themes.ts`, a list of weeks, each `{ weekId, title,
  brief, rule: { tag, atLeast }, themePiece, trophy }`, e.g. "Cosy autumn · Use 3 or more warm pieces". Pieces carry
  `tags` for the briefs. The first four themes ship in P4 (Cosy autumn, Green thumb, Night owl, Tidy desk).
- **The week** runs from Monday 00:00 to **Sunday 20:00 in each entrant's own zone** (civil dates per the helpers).
  `weekId` is the entrant's local ISO week (`2026-W43`), so each entrant's entry closes at their own Sunday 20:00.
- **The brief** (C3): "Room challenge · Buddies only · 3 days left", the theme, the brief, "5 buddies in", "Ends Sunday
  20:00", rewards: **Enter: +30 coins, once**, the **limited theme piece** (in the shop this week only, 80 coins), the
  **trophy** for the most-cheered room (glows at night). **Start my entry** (default `Button`).
- **The entry is your room.** "Your entry is a snapshot of your room on Sunday. Build as usual until then." Every room
  save while your entry is open copies the layout into `ChallengeEntry.snapshot`; the last save before the close is
  the entry. The **+30 pays once**, on the first moment the entry meets the brief while it is open: at entry, or on
  a later save that brings it up to the brief (`challenge:{weekId}`).
- **Build it:** the drawer gains the theme tab and a checklist "Warm pieces · 2 of 3".
- **Cheering entries:** buddies cheer entries they like, one per entry per buddy per week, never your own. A cheer
  counts only if it lands before **the entrant's own** Sunday 20:00. Entry cheers follow the room-cheer coin rules
  (§10.2), keyed `ccheer:{weekId}:{fromId}:{toId}:{given|got}`.
- **Results** (accepted default, §0): computed on the first read after Monday 08:00 UTC, when every zone's Sunday
  20:00 has passed. **You win if and only if** your entry is the most-cheered (ties included) in **your own circle**:
  you plus the buddies who entered, with the circle frozen at your close, and only if that circle has **at least 3
  entries**. Under 3 there is no ranking and everyone just keeps the entry reward (C3's risk). A winner gets the
  trophy piece once (`ItemGrant +1, prize:{weekId}`, unique), drawn with a glow at night.
- Results screen: "{name}'s room won · The acorn glows on her floor at night", the circle's cheer counts, "You
  entered · The lantern stays in your room".
- Entries are seen only by buddies. There is no public ranking.
- `ChallengeEntry { userId, weekId, snapshot Json, paidAt?, createdAt, updatedAt }` (id `[userId, weekId]`),
  `ChallengeCheer { weekId, fromId, toId, createdAt }` (id `[weekId, fromId, toId]`, both relations
  `onDelete: Cascade`).

### 10.5 The share card (F8)

- **Share your room** from the editor's menu: "Makes an image; nothing is posted".
- The card: the room (health-linked effects neutral, as a visit), "KIP's room", "8 × 8 · 31 pieces · Cosy autumn
  week" (the size, not a level). Switches: **Show my first name** (default off), **KIP waves** (default on). **Save image** and **Share…**.
- Rendered off-screen at 1080 px wide and saved or shared through `lib/recapCapture.ts` (`captureToPng`,
  `saveImage`, `expo-sharing`). Nothing leaves the phone until the user taps Save or Share.
- "The card shows the room only: no health numbers, no streaks."

## 11. First week (C7)

### 11.1 Day 1 (P1)

- **New users** start with the **starter layout**: C7's "6 pieces" are 7 placements, because the books stand on a
  wall plank: the desk (`desk.monitor`, with KIP's chair), the amber desk lamp and the mug on it, the fern, the slate
  rug, `shelf.plank` with `shelf.books` on it; walls Plain slate, floor Dark oak, the plain window. Unlike Spec B's
  `STARTER_ROOM`, the wall calendar (`art.calendar`) is **not** placed; it waits in the inventory with the other
  starter pieces. (Converted rooms keep their calendar, §2.4.)
- **Everyone**, new or converted, gets on the first KIP page open after P1: a welcome card over the room, "WELCOME
  HOME!", "This is KIP's room. Make it yours: drag pieces in, flip them, stack them." (P2 adds "Healthy days earn
  coins, and coins turn into things for the room."), with the welcome lantern ("Free · in your inventory · glows at
  night") and **Place the lantern** / **Later**.
- **Guided first placement:** the editor opens with the drawer on New and a coach mark, "Your first piece · Takes 10
  seconds", 3 steps: **Drag** the lantern onto the highlighted tile (a lime tile), **Turn** it, tap **Done**. A
  **Skip** ghost `Button` is always there. Without drag (screen reader, or after 10 seconds) step 1 offers Place.
- It never blocks the rest of the app; it shows once, across devices, from a new row:

```prisma
model RoomFirstWeek {
  userId        String    @id
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  welcomedAt    DateTime?
  firstPlacedAt DateTime?          // set by PUT /me/cosmetics (below)
  startedOn     DateTime? @db.Date // the list's day 1 (P2): the user's civil date when P2 first reached them, or sign-up
}
```

- It is in `USER_OWNED_MODELS`. It is **not** stored on `CosmeticLoadout`: creating a loadout row just for a flag
  would make the user's first save (the version-0 `create` path) fail with a false 409 `P2002`.
- **"Placed a piece"** is server-checkable: a `PUT /me/cosmetics` whose layout holds an instance id that the stored
  layout (or the starter layout) did not have sets `firstPlacedAt` once.

### 11.2 The first-week list (P2)

- A 7-day card on the KIP page, from the day P2 reaches you (or sign-up), "First week · Day 4 of 7 · 4 of 7 done":

| Task | Reward |
| --- | --- |
| First check-in | +5 (the normal check-in earn) |
| Place your first piece | **+10 bonus**, when `firstPlacedAt` is set |
| Hit your sleep goal | +20 (the normal earn) |
| Get a fern in the coin shop | −40 (a purchase; the task is the habit of spending) |
| Cheer a buddy's room | +2 (the normal earn) |
| Read your first weekly recap | +10 (the normal earn) |
| 7 check-ins in a row | **+25 bonus** |

- Only the two bonus rows pay extra, once ever, outside the cap. The others tick when their normal earn's event row
  exists (a 0-coin row at the cap still ticks). **Accepted default (§0):** C8 labels the list "+80"; the rows on C7
  add up to 72 shown, 35 of it bonus. The spec follows C7's rows.
- Under the list: "Next: 8 × 8 · 600 coins and a 14-day check-in streak. The dashed row is yours then.", and the room
  shows the next tier's front rows as a dashed outline (the locked-row overlay).
- After day 7 the card is gone; unfinished bonuses lapse quietly.

## 12. Endpoints

All require auth, return `Cache-Control: private, no-store`, cap bodies at 32 KB and validate with the house style
(`400 invalid_body` for shape errors).

### P1

- **`GET /me/cosmetics`** adds `layout`, `tier`, `cap`, `counts: { [itemId]: number }` (owned, only items with a
  count) and, from P3, `living`. It keeps `owned`, `fresh`, `worn`, `version`, `counters`, and (until P2) a derived
  `room`.
- **`PUT /me/cosmetics`** with `{ layout, worn, version }` →
  - 400 `invalid_body` (shape; unknown keys; ids not matching the pattern; duplicate instance ids; `version` not an
    integer in 0 to 2³¹ − 1, fixing Spec B's deferred overflow minor);
  - 400 `update_app` for a slot-shaped body;
  - 400 `unknown_item` (not in the catalogue or not shipped);
  - 400 `wrong_layer` (a layer the item doesn't allow; a style in the wrong style key);
  - 400 `bad_place` with `{ pieceIds, reason }` where reason is `outside`, `overlap`, `wall`, `window`, `spot`,
    `parent`, `nested`, `seat`;
  - 400 `desk_required` (exactly one `kipDesk` piece, on the floor);
  - 400 `room_full` (pieces over the tier's cap); from P3, 400 `effects_full`;
  - 403 `not_owned` with `{ itemIds }` when `placed(item) > owned(item)` or a style or worn id isn't owned;
  - 409 `stale` (version), exactly Spec B's `updateMany` / `create` + `P2002` pattern;
  - otherwise saves and returns the GET body.
- The placement rules live once, in `backend/src/room/geometry.ts`, pure. The export script copies it to
  `mobile/src/lib/room/iso/geometry.ts` beside `catalogue.json`, and a backend test fails when the copy is stale, so
  the app's red tint and the server's 400 never disagree.
- **`POST /me/cosmetics/seen`** unchanged. **`POST /me/room/welcomed`** → 204 (upserts `RoomFirstWeek.welcomedAt`).

### P2

- **`GET /me/coins?cursor=`** → `{ balance, today: { earned, cap }, events: [{ kind, amount, at, seen }], next }`;
  runs `earnCoins` first.
- **`POST /me/coins/seen`** `{ through }` → 204.
- **`GET /me/shop`** → this week's pieces with prices and the weekly set.
- **`POST /me/shop/purchases`** `{ requestId (uuid), itemId }` → 200 `{ balance, counts }`; 400 `not_for_sale`,
  **409 `not_enough_coins`** with `{ needed }`; a repeated `requestId` returns the first answer.
- **`POST /me/room/expand`** `{ requestId, toTier }` → 200 `{ tier, cap, balance }`; 409 `gate` with
  `{ coinsNeeded, badgeNeeded }`; 409 `stale_tier` if `toTier` isn't `tier + 1`.
- **`GET /me/firstweek`** → the list, its ticks and day.

### P4

- **`GET /me/buddies/:buddyId/room`** → `{ layout, size: { n, m }, kipColour, kipWorn, cheersThisWeek, cheeredToday }`;
  404 when not buddies, blocked either way, or visits are off (the same 404 for each, so it says nothing about why).
- **`POST /me/buddies/:buddyId/room/cheer`** → 200 `{ paid: boolean }`; 409 `already_cheered`.
- **`GET /me/room/cheers`** → this week's cheers on my room, with names.
- **`POST /me/buddies/:buddyId/gifts`** `{ requestId, itemId, note }` → 201; 403 `not_spare`; 429 `gift_limit`.
- **`GET /me/gifts`** (unopened, to me); **`POST /me/gifts/:id/open`** → 200 `{ counts }`.
- **`GET /me/challenge`** → the week's theme, my entry state, my circle's entries (buddies only) and results;
  **`POST /me/challenge/entry`** → 200; **`POST /me/challenge/entries/:userId/cheer`** → 200 `{ paid }`.

### Concurrency, deletion, telemetry

- **Concurrency:** room and worn saves keep the one-row version check. Coins, purchases, expansion and gifts use
  the per-user advisory lock plus unique `sourceKey` / `requestId`, so retries are safe and the balance can't go
  negative. The app's `coinsStore` copies `cosmeticsStore`'s epoch, session and "ignore older" guards.
- **Account deletion:** `deleteOwnedRows` runs `deleteMany({ where: { userId } })` over `USER_OWNED_MODELS`, so only
  tables keyed by `userId` go there: `CoinEvent`, `CoinWallet`, `ItemGrant`, `ChallengeEntry` and `RoomFirstWeek`
  are added (before `User`) and to `tests/users/ownedData.ts`. `RoomCheer`, `Gift` and `ChallengeCheer` are keyed by
  `fromId` / `toId` and go with the `User` row through their relations (`onDelete: Cascade`, as `Sticker` and
  `BuddyPair`), except `Gift.from`, which is `SetNull`. So no step before `deleteOwnedRows` is needed: the cascade
  drops unopened gifts **to** the user, and gifts **from** the user stay deliverable to their recipients (controller
  ruling, §0). The deletion test proves every new table is emptied of the user's rows, and that a gift from a deleted
  user can still be opened.
- **Telemetry** is log lines only, with **no user ids and no values**: `room.saved { pieces, tier }`,
  `coins.earned { kind, count }`, `coins.spent { kind }`, `room.expanded { tier }`, `gift.sent`, `challenge.entered`.
  Never an item id or amount next to a user id.
- **Nothing cosmetic reaches the model:** a source-scan test fails if anything under `backend/src/coach/` imports
  from `cosmetics/`, `coins/`, `room/` or `challenges/`.

## 13. Carried from the ledgers

Still open from Spec A and Spec B, and where they land:

- `RELEASE_LAUNCHED_AT[1]` is the owner's date at merge (Spec B ruling P9); P1 adds release 3's.
- The cheer scan's 90-row bound can undercount (Spec B Task 3 minor; a B2 gate): page until 15 cheers or rows run out
  before B2 ships.
- The recap hook firing on MONTH opens: fixed by the WEEK guard in §6.2 (P2).
- `PUT` version upper bound: fixed in §12 (P1).
- `layerOf` / `kipSeatFor` slot guards (Spec A Task 6, Spec B Task 7 minors): moot once slots go; the iso art lookup
  checks the item's `iso` block instead.
- OVERRIDE-P13: the Campfire scene and banner stay frozen and draw KIPs bare; no visit entry point there.
- FINAL-REQ: request recipients see a sender's worn ids; visits are buddies-only, so no room data reaches a request.
- Device checks still owed to the owner (hotspot tags, worn hats at small sizes): hotspots are deleted in P1; the
  worn checks stand.

## 14. Phasing: four plans, each shippable

| Plan | Ships | Needs |
| --- | --- | --- |
| **P1 · Iso room and editing** | the iso engine (§3), P1 art (§4), the editor with drag, ghost, snap, toolbar, undo, the drawer with counts, styles, sets as layouts, accessibility (§5), the layout model, conversion and PUT (§2, §12), the room card swap and long-press into the editor (§9.1, §5.1), the welcome and guided first placement (§11.1) | Spec A + B built |
| **P2 · Coins, shop, expansion** | the ledger, sources and cap (§6), `ItemGrant` and duplicates by purchase, the coin shop and its first pieces (release 4), wallet, history, coins landing, room sizes and the unlock moment (§7), the first-week list (§11.2), dropping `room` | P1 |
| **P3 · A living room** | effects and effect slots (§8.1–8.2), effect pieces (release 5), health-linked states and `living` (§8.3), piece cards, KIP walking and the `water` pose (§9.2) | P1, P2 (plant stage reads the ledger; effect slots follow the tiers) |
| **P4 · Social** | visits and the sharing switch (§10.1), room cheers that pay (§10.2), gifts (§10.3), weekly challenges and trophies (release 6) (§10.4), the share card (§10.5) | P1, P2 (coins, `ItemGrant`), P3 (neutral states for visits and the card) |

Each plan ends with the owner's simulator check and a draft PR (the standing workflow).

## 15. Rules that apply

- Every button is `ui/button.tsx` with `rounded-lg`; raw pressables with a button role (drawer tiles, the wallet
  chip, room pieces in the list) get one conventions entry per kind. No pills: chips, tags and tabs are `rounded-lg`.
- Only A4 type tokens; pixel labels use `text-label` with the pixel font.
- Strings live in `roomCopy.ts` (room, editor, effects), a new `coinCopy.ts` (wallet, shop, history) and
  `buddyCopy.ts` (visits, gifts, challenges).
- `CampScene.tsx` and `CampBanner.tsx` are not touched.
- Civil dates only from the helpers. Never log user ids with item ids, layouts, coin amounts or health values.
- TDD: run the touched tests and both typechecks before every commit.

## 16. Tests

- **Backend:**
  - Catalogue: every shipped placeable item has an `iso` block; footprints positive; spots inside the footprint;
    `facings: 2` pieces register both facings in the app export; `SHIPPED_RELEASES` filters export and grants;
    `RELEASE_LAUNCHED_AT` has a date for every shipped release; the id snapshot still never loses an id.
  - Geometry: inside bounds per tier; overlap; flat pieces under anything but not on another rug; wall bounds and the
    window; spots (valid index, free, parent has a surface, no nesting); KIP's seat reserved; exactly one desk; cap;
    effect slots (P3). The mobile copy of `geometry.ts` is current.
  - Conversion: every release-1 item in every slot converts to a valid layout; empty slots place nothing; worn
    unchanged; lazy GET conversion and the script give the same layout; both are idempotent.
  - `PUT /me/cosmetics`: each error code; counts (`placed > owned` is 403); a slot body is `update_app`; concurrent
    first saves give one 200 and one 409; the base-version rule.
  - Counts: starter + unlock `grants` + `ItemGrant` sums; never below the placed count after a gift.
  - Ledger (P2): one payment per source key under concurrent calls; the 60 cap trims and stops; uncapped kinds
    ignore it; the cap day for each source in a non-UTC zone; no backpay before `COINS_LAUNCHED_AT`; a WEEK recap pays
    and a MONTH recap doesn't; a revised night keeps its coins; spends can't go negative; a repeated `requestId`
    returns the first answer; history pages.
  - Expansion: both gates required; badge level II passes even after the run breaks; `stale_tier`; tier never drops.
  - `living` (P3): plant stage from the count of `sleep_goal` events; pet energy bands; awards count; absent from
    every buddy DTO.
  - Visits, cheers, gifts, challenges (P4): buddies only, blocks both ways, the visits switch (off by default, needs current
    consent), the uniform 404, size only and no tier; one cheer per room per day, 5 paid a day across given and
    received, 0-coin rows past the limit, both locks in id order; gifts only spares, 3 a day, returned on block or
    unpair, still delivered after the sender deletes, dropped when the recipient deletes, a gift racing a save (shared
    lock); challenge week close in two zones, snapshot on save, entry reward once (at entry or a later save), cheers
    after the entrant's close ignored, results by your own circle frozen at close, ties, under 3 entries no ranking,
    the prize granted once.
  - First week and expand: `RoomFirstWeek` never creates a loadout row; `firstPlacedAt` set by a new instance id;
    expand creates a row at version 1 or bumps it, and stores wall pieces the loft window covers.
  - Deletion empties every new table; the never-removed grep covers them; no coach import of cosmetic modules; no
    real-money dependency or copy.
- **Mobile:**
  - Iso engine: `P(i, j, z)` matches `iso.py`; topological sort fixtures (including an L-shaped arrangement that a
    single depth key gets wrong); children after parents; movers occluded by a piece in front; deterministic rect
    counts per layer for the starter, converted and Cottage rooms, day and night, at each tier.
  - Art: every shipped piece has art for each declared facing; `mirror` changes the rects but not the footprint;
    emissive only in the glow layer; three frames where declared; tint follows KIP's colour.
  - Editor: drag, ghost, snap to tile, wall and spot; red reasons; drop invalid returns to origin or inventory; Flip,
    Turn (greyed when it can't fit), Another (greyed at ×0), Store (with children); undo and redo 20 steps; room full
    card; style apply; Apply set as one step; Done with 403 / 409 / failure paths (Spec B's rulings); Cancel.
  - Accessibility: place without dragging; nudge arrows and Put on…; the pieces list; announcements; 44-point
    targets; spoken labels without "·".
  - Coins (P2): wallet chip label; history; coins land once; shop purchase waits for the server; disabled
    "Needs n more"; `coinsStore` guards (a stale GET can't overwrite a purchase).
  - Effects (P3): each effect's states; effect slots block with the message; sound off by default; KIP walks only
    while idle and snaps back on focus or send; Reduce Motion stops walking and loops; the copy guard for advice
    words.
  - Social (P4): the visit draws neutral states; nothing selectable; share card hides the name by default and draws
    neutral states.
  - Conventions guards (`buttons.test.ts`, `typography.test.ts`) pass with the new entries; the frozen-file check.
  - Perf (dev only, not CI-gating): cold build, rebuild on drop and frame compose for a full 9 × 9 room at night.

## 17. Out of scope

- Real money in any form, coin packs, ads, trading coins, a marketplace.
- Shipping or build timers.
- Pinch zoom, free rotation of the whole room, a back or side view of KIP.
- Second floors, balconies and other sizes beyond the loft.
- Typed text anywhere in a room, a gift note or a challenge entry.
- Public rankings, rooms visible to non-buddies, push notifications for cheers, gifts or coins.
- User-made items, colour pickers per piece.
- Showing buddies' outfits or rooms on the frozen Campfire.

## 18. Open questions

None. The five defaults raised here (coin amounts, challenge judging, radio sound, the first-week total, release
timing) were accepted on 2026-10-15 and are recorded in §0, with the two controller rulings (opt-in visits, gifts and
deleted accounts).
