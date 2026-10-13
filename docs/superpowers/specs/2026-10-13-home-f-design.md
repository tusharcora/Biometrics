# Home F: the scene

Date: 2026-10-13 · Branch: `feature/home-f` (stacked on `feature/profile-activity`) · Status: design approved by the owner; spec awaiting review

The second of two specs. It needs `2026-10-13-kip-colour-design.md` (your colour, buddies' colours and `PersonKip`).

The owner approved Home direction **F** on 2026-10-10 (handoff `2026-10-10-sleep-home-kip-handoff.md` §3). Boards in
`docs/design/home/project/`:

- `F.dc.html`: the layout;
- `FWeather.dc.html`: the scene engine and every weather state;
- `FMostly`, `FCloudy`, `FStormy`, `FShort` and `FNight`: the states as rendered.

## 1. The page, top to bottom

1. **The scene** (§2), full width and about 300 points tall. It starts at the top of the screen, behind the status
   bar, with the header drawn over the sky.
2. **"Today"**: a `SectionLabel`, with the hint "Tap the scene or a tile" on the right.
3. **Three compact tiles** in a row (§4): Recovery, Sleep and Tomorrow.
4. **"Ask Coach about today"**: a full-width outline `Button` with the coach icon. It goes where the coach tile goes
   today (`navigateToCoachEntry`). It replaces `CoachTile`.
5. **The rest of Home, unchanged and in its current order:** the habit log card, the Recaps shelf, the weekly coach
   digest, "Your metrics" and the insight card.

**Removed from Home:**

- `RecoveryHero` (the big ring) and `SleepTile`: the scene and the tiles cover them.
- `TomorrowCard`: the Tomorrow tile covers it.
- `CoachTile`: the Ask Coach button covers it.
- `BuddiesRow`: the scene's buddies and "ALL n →" cover it.

Each still opens the same place from its new home.

Home's other screens are unchanged: loading, not connected, reconnect and the fallback. Pull to refresh keeps
working as today.

## 2. The scene

### Drawing

- **A pure module, `lib/home/scene.ts`,** ported from `FWeather.dc.html`'s script. Given a state, it returns the
  rect lists for each layer on the board's 130 × 100 grid, with the ground line at row 82. The board's colours, art
  (`ART`), flower spots and the cottage and mailbox rects are copied as they are.
- **Layers, back to front:**
  1. the sky (four bands with a dither; stars at night);
  2. the sun or moon and the weather (clouds, haze, birds, the butterfly);
  3. the hills, ground and flowers;
  4. the cottage (the bed and the wall calendar inside) and the mailbox; the window is lit at night;
  5. the KIPs (yours and up to two buddies');
  6. the tags (§3);
  7. rain, over the KIPs, only when stormy.
- **`components/home/HomeScene.tsx`** draws layers 1–4 and 7 with `react-native-svg`, one `Path` per colour, as on
  the board.
  - The unit is the largest whole number of points per grid cell that fits the width: 3 on a 390-point phone.
    Edges stay crisp because `react-native-svg` has no `shapeRendering`.
  - On wider screens the scene is centred, and the sky's top band and the ground's bottom band fill the sides.
- **KIPs** are drawn with the `Kip` component. Yours is at scale 5 in the centre. Buddies are at scale 3 at the
  board's left and right spots. All stand on the ground line.
- **All of the scene art is hidden from screen readers.** The tags carry the meaning.
- **No animation** in this version.

### Which state

`sceneState()` in `scene.ts` is pure and takes `{ now, recovery, sleep }`. The first rule that matches wins:

| # | When | State | Your KIP |
| --- | --- | --- | --- |
| 1 | Local time 21:00–04:59 | **night** (F6): stars, the moon, the lit window, no flowers | rest, sleepy |
| 2 | Last night's main sleep was under 6 h | **short** (F5): haze, a small sun, a few flowers | coffee, sleepy |
| 3 | Today's Recovery weather (`weatherFor`, the Recovery page's bands) is `clear` | **clear** (F1): the big sun, a meadow, birds and a butterfly | cheer, proud |
| 4 | … `mostlyClear` | **mostly** (F2) | wave, idle |
| 5 | … `cloudy` | **cloudy** (F3): grey clouds, flowers in bud | rest, idle |
| 6 | … `stormy` | **stormy** (F4): storm clouds, rain, no flowers | rest, determined |
| 7 | Anything else: `building`, `none`, not loaded or failed | **mostly** sky, no birds | rest, curious |

- A short night is the main sleep of last night's date, from what Home already reads. Naps don't count.
- Night uses the device's local time, which is the same clock the greeting uses.

## 3. Tags

There are two kinds. Each is a raw `Pressable` with `accessibilityRole="button"`, so each needs a conventions entry.

### Hot tags

Hot tags are dark pills: a 4-point colour square, a pixel label (Silkscreen) and a value. They sit on the board's
object positions, scaled with the unit.

| Tag | On | Value | Opens | Spoken label |
| --- | --- | --- | --- | --- |
| **SLEEP** (lilac) | the bed | last night's sleep score | Sleep (`openSleep`) | "Bed: sleep 78, 7h 12m. Open Sleep" |
| **TMRW** (indigo) | the wall calendar | the forecast range, e.g. "68–76" | Forecast | "Calendar: tomorrow likely 68 to 76. Open Tomorrow" |
| **RECOVERY** (band colour) | the sky | today's score | Recovery (today) | "Sky: recovery 68, mostly clear, Good. Open Recovery" |
| **RECAPS** (coral) | the mailbox | the count of unwatched recaps on the shelf | Recaps | "Mailbox: recaps, 1 new. Open Recaps" |

- A missing value shows "—", and the spoken label says "no reading yet".
- RECAPS with nothing unwatched shows no number.

### Buddy tags

- **A name tag** sits under each buddy KIP. It shows the display name in upper case, cut to 8 characters, and opens
  that buddy's week. Its spoken label is "{name}, {mood line}. Open their week".
- **"ALL n →"** sits at the right of the ground and opens the Social tab. With incoming requests it reads
  "1 REQUEST →" or "{n} REQUESTS →". With no buddies and no requests it is hidden.

### Which buddies

- The scene shows **the two buddies who checked in most recently**.
- The buddy list (`GET /me/buddies`) gains `lastCheckInAt: string | null`, the time of their latest `CheckIn`. Home
  sorts newest first, and a buddy who never checked in comes last.
- Each buddy KIP is in the buddy's `kipColour`. Its pose follows their mood:

| Buddy's mood | Buddy's KIP |
| --- | --- |
| `good` | cheer, proud |
| `ok` | wave, idle |
| `low` | rest, determined |
| `none` | rest, idle |
| Any mood, during night | rest, sleepy |

- Fewer than two buddies leave the spots empty.

## 4. The header and the tiles

### Header (over the sky, as on the board)

- **Left:** the date line (pixel `SectionLabel` style, e.g. "Tue, Oct 13"), the greeting ("Good morning",
  "Good afternoon" or "Good evening", as today), and `SyncStatusLine` under the greeting.
- **Right:**
  - `ThemeToggle`;
  - **the Profile button.** It is your KIP (scale 2, in your colour) in the existing `StoryRing`, on a dark
    translucent square `Button` (44 × 44, `rounded-lg`). It keeps today's recap ring and `settings-button`
    behaviour.
- The header text stays light on every state's sky, in both themes.

### The three tiles

Each tile is a `Card` pressable. All strings go in a new `homeCopy.ts`.

- **Recovery:** the label; the Recovery weather icon (`WeatherIcon`) with today's score; the verdict word in the band
  colour (e.g. "Mostly clear"). It opens Recovery.
- **Sleep:** the label; the board's 11 × 11 moon icon (`ICON.moon`, ported into `scene.ts` with the scene art) with last night's sleep score; the duration (e.g. "7h 12m"), in amber after a
  short night. It opens Sleep.
- **Tomorrow:** the label; the forecast range (e.g. "68–76"); then "Bed by 23:00" from the bedtime goal, or, with
  no bedtime goal, "With 7.5h sleep" from the forecast's default sleep hours. It opens Forecast.
  - With not enough history it shows the existing unlock line, as `TomorrowCard` does now.
- A tile still loading shows a `Skeleton`. A tile whose read failed shows "—".

## 5. Data

- Home already reads Recovery scores and bands, sleep, the forecast, the buddies and the recaps. The new reads are:
  - the sleep goal (`fetchSleepGoal`), for the bedtime;
  - your KIP colour (`useMyKipColour`);
  - the buddy list's new `lastCheckInAt`.
- Each read fails on its own. The scene never blocks the page.
- **Backend:** `lastCheckInAt` on `BuddyRow` in `backend/src/buddies/list.ts`. Tests cover its value and `null` for
  a buddy who never checked in.

## 6. Light mode

The scene is a picture: it keeps its own colours in both themes. The page below follows the theme as now. The
header text over the sky is always light.

## 7. Rules that apply

- Buttons are `ui/button.tsx` with `rounded-lg`. Raw pressables with a button role (the tags and the tiles) get
  conventions entries.
- Only the A4 type tokens; the pixel labels use the existing pixel-font token.
- Strings live in copy modules.
- Never log health values, dates or names.
- Never `new Date('YYYY-MM-DD')`.
- `CampScene.tsx` and `CampBanner.tsx` are not touched here.
- TDD: run the touched tests and both typechecks before every commit.

## 8. Tests

- **`scene.ts`:**
  - `sceneState` covers every row of the table: the night window edges (20:59, 21:00, 04:59, 05:00), short-night
    precedence over every band, each band, and the fallback;
  - flower counts per state: 18 for clear, 9 for mostly, 5 for short and cloudy (buds), 0 for stormy and night;
  - rain only when stormy;
  - the lit window and stars only at night.
- **`HomeScene`:**
  - The tags:
    - each shows its value and its spoken label;
    - each opens its destination;
    - a missing value shows "—".
  - The buddies:
    - the two most recent are drawn in their colours;
    - a never-checked-in buddy comes last;
    - "ALL n →" and the request wording.
  - The scene art is hidden from screen readers.
  - Your KIP is in your colour.
- **The tiles:** values, the verdict colour, amber after a short night, the bedtime and sleep-hours lines, and the
  loading and failed states.
- **`DashboardScreen`:**
  - the order: scene, Today, tiles, Ask Coach, habit log, Recaps, digest, metrics;
  - the removed cards are gone;
  - the header shows the theme toggle, the sync line and the Profile KIP button.
- **Backend:** `lastCheckInAt` in the buddy list.
