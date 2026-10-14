# KIP Coach

Date: 2026-10-14 · Branch: `feature/kip-coach-spec` (from `main` f8d4afc) · Status: design approved by the owner; awaiting the owner's review of this spec

The first of two specs. KIP's room (`2026-10-14-kip-room-design.md`) builds on this one: it adds the cosmetics
catalogue, unlocks and decorate mode on top of the room engine defined here.

It needs `2026-10-13-kip-colour-design.md` (your colour, `Kip`, `PersonKip`, `useMyKipColour`) and
`2026-10-13-home-f-design.md` (the Recovery weather states).

The pixel coach cast goes. The AI coach is now **your own KIP**, in the colour you picked. The Coach tab becomes the
**KIP** tab, and its page becomes direction **W7 · Pocket room card**: KIP's room as a framed diorama at the top of
the page, the conversation below.

Boards in `docs/design/kip-coach/project/` (titles from `canvas.json`):

- `W7.dc.html` "W7 · Pocket room card · recommended": the approved page, expanded and collapsed;
- `K4.dc.html` "K4 · KIP's workplace": the starter room's furnishing;
- `States.dc.html` "KIP coach states": empty, thinking, answering, error, offline, consent and the mood row;
- `Elsewhere.dc.html` "What changes elsewhere": Ask KIP bars, Home's KIP's note, the Conversations sheet, What KIP
  remembers, the Settings KIP page, the removed list and the first-open path;
- `SetsV2.dc.html` "Theme sets v2": the art quality the room engine must reach (§5);
- `docs/design/app-icon/project/` "App icon · KIP": `Main.dc.html` (direction A), `Variants.dc.html` (platform
  variants and splash).

## 0. Owner decisions (2026-10-13 and 2026-10-14)

- "We are absolving coaches entirely to be replaced by KIP." The 15 pixel coaches, Meet your coach, Change coach,
  per-coach personalities and thinking attachments, and the names Axo / Coach in UI copy are all removed.
- The AI coach is the user's own KIP in their chosen colour. The KIP colour work already shipped
  (`specs/2026-10-13-kip-colour-design.md`, `backend/src/kip/*`, `mobile/src/lib/kip/*`, `components/kip/*`).
- "Ask KIP" replaces "Ask Axo" / "Ask Coach" everywhere.
- The Coach page is **W7 · Pocket room card**: KIP's room (the K4 starter room) as a framed diorama card at the top,
  collapsing to a 60-point header on scroll. KIP's pose shows idle, thinking (typing at the desk) and answering
  (turns to face you). The window shows today's Recovery weather, with the same states and bands as Home F and the
  Recovery page.
- The thread keeps every current capability: answer cards, follow-ups, memory proposals, stop, `/` shortcuts, the
  Conversations sheet, errors, consent and the memory screen.
- Room art is at **Theme sets v2** quality: a 2-point room grid (1.5× K4's density), KIP at 4 points per KIP pixel,
  lighting, dithered gradients, soft shadows, depth and subtle 3-frame loops that stop under Reduce Motion.
- "Answer style (Short / Detailed)" is **dropped**. It was invented in the mockups.
- App icon: direction **A · Face close-up** (KIP's coral block, shade side, two eyes), with the dark and tinted iOS
  variants, Android adaptive and monochrome. Alternate icons per KIP colour are out of scope (later).
- Cosmetics, unlocks and decorate mode are Spec B. This spec builds the room engine slot-driven so Spec B plugs in.

Defaults accepted at spec review (2026-10-14):

- **Consent:** no version bump for the rename. Only the product name changes, not what is sent or to whom.
- **Badge level V** ("Coach") is renamed **"Legend"** in copy only; the stored level number does not change.
- **Offline** is detected from network errors (§3.4). No NetInfo dependency is added.

## 1. What goes

### The cast

| Removed | Where | Notes |
| --- | --- | --- |
| Meet your coach (first-open picker and "switch" mode) | `screens/MeetYourCoachScreen.tsx`, `MeetYourCoach` route | §8 |
| Change coach / Your coach row | `components/your-coach-row.tsx` and its card | Settings KIP page replaces it (§7.5) |
| Thinking style (per-coach attachments) | `screens/ThinkingStyleScreen.tsx`, `ThinkingStyle` route, `components/characters/attachments/*` | KIP's thinking pose replaces it |
| The character cast and its renderer | `components/characters/*` (registry, sprites, `Character`, `CharacterCanvas`, `CoachCard`, `thinking.ts`, palette, types, `useSpriteClock`) | only after the decoupling below; every use is swapped (§7.7) |
| Character state | `characters/*` (`CharacterProvider`, `CharacterContext`, `characterCache`, `characterMood`, `useCharacterMood`) | only after the decoupling below; `useScreenFocused` moves to `lib/useScreenFocused.ts` and stays |
| The sprite generator | `mobile/scripts/port-sprites.mjs` (it writes `components/characters/sprites/data.ts`) | nothing left to generate |
| Dev gallery | `screens/dev/CharacterGalleryScreen.tsx` | replaced by a KIP pose gallery (§4) |
| Per-coach thinking frames | `components/coach/thinking/*` styles drawn around a character (`Tag`, `Nameplate`, `Bouncy`, `Dialog`, `Strip`, and `ReplyFrame`) | the thinking row keeps five text styles (below) |
| Coach names and voices | backend `personas/v4.ts` stays registered but is no longer live (§2) | |

- Each deleted file goes with its tests and its entries in `__tests__/conventions/buttons.test.ts`. A stale entry
  fails that test.
- **Kept:** the thinking **text** setting (`ThinkingTextScreen`, `coachThinkingText`), renamed "While KIP thinks"
  (§7.5). It is how the chat shows KIP working, not a coach trait.

### Decoupling (before anything is deleted)

The kept thinking text and the coach status live inside the character modules today. They move out first, in this
order, each with its tests:

1. **Thinking-text ids.** `THINKING_TEXTS`, `ThinkingTextId`, `DEFAULT_THINKING_TEXT`, `isThinkingText` and
   `THINKING_TEXT_NAMES` move from `components/characters/thinking.ts` to a new **`lib/thinkingText.ts`**. Importers
   change: `api/coach.ts`, `ThinkingTextScreen.tsx`, `SettingsScreen.tsx` and `components/coach/thinking/*`.
   - **The client list shrinks to five:** `lines`, `placeholder`, `typewriter`, `steps`, `shimmer`. A stored
     `tag`, `nameplate`, `bouncy`, `dialog` or `strip` value resolves to **`steps`** in the app
     (`resolveThinkingText`), and the screen shows Steps as picked.
   - **The server keeps accepting all ten** (`backend/src/coach/thinking.ts` is unchanged) so old apps can still save
     theirs.
   - The attachment ids (`THINKING_ATTACHMENTS` and friends) are deleted from the app; the server keeps them for old
     apps.
2. **KIP's thinking lines.** The per-coach voice lines (`useCoachVoice` in `coach/thinking/shared.ts`, read by
   `useThinkingLine.ts`) become KIP's three lines in `lib/kipCopy.ts`: "KIP is typing it up", "KIP is working on
   it", "KIP is checking your numbers". `useThinkingLine` rotates them as it rotates the voice lines today.
3. **Colour and clock.** `chipTextColor` (from `characters/palette`) and `CHARACTERS` (from the registry) in
   `coach/thinking/shared.ts` are replaced by the KIP colour (`useMyKipColour`) and a readable text colour from
   `kipRamp`. `useSpriteClock` moves to **`lib/useFrameClock.ts`** (same behaviour: a shared tick, paused when
   unfocused or under Reduce Motion); `Typewriter.tsx` and `ThinkingRow.tsx` use it. `CharacterId` goes from
   `types.ts` and `Placeholder.tsx`.
4. **The coach status store.** `CharacterProvider` is also the shared coach-status store (`useCoachStatus.ts` reads
   `useCharacterOptional` and `useSetCoachStatus`; `App.tsx` mounts the provider). It becomes **`CoachStatusProvider`**
   (`lib/coachStatus/CoachStatusProvider.tsx`), holding `{ status, refreshStatus, thinkingText }` and nothing about a
   character. `App.tsx` mounts it in the same place. Every caller of `useCharacter`, `useCharacterOptional` or
   `useSetCoachStatus` moves:
   - `lib/useCoachStatus.ts` → the new provider;
   - `useCharacterMood` (`components/coach-digest-card.tsx:8,32` and `CoachScreen.tsx:137`) → the digest card's
     `KipHead` takes the day's mood from `useTodayScene`, and CoachScreen uses the §3.4 state table; both imports are
     deleted with `characters/*`;
   - `CoachScreen.tsx` → `thinkingText` from the new provider; the character id and name go;
   - `RecoveryScreen.tsx` and `SleepScreen.tsx` (they read `characterId` only for the Ask bar's character and label)
     → nothing; the Ask KIP bar draws your KIP (§7.2);
   - `BedtimeGoalScreen`, `BadgeDetailScreen`, `YearInPixelsScreen`, `RecapScreen`, `RecapBuilderScreen`,
     `RecapStoryScreen`, `SettingsScreen`, `ThinkingTextScreen`, `RecapShelf`, `StoryRing`, `BadgesCard`,
     `BadgeIcon`, `CelebrationModal`, `CoachMessageRow` → `useMyKipColour()` (§7.7);
   - `MeetYourCoachScreen`, `ThinkingStyleScreen`, `your-coach-row.tsx`, `CharacterGalleryScreen` → deleted.
5. **Device storage** (`characterCache.ts`, SecureStore): the `characterId` key is **deleted** on first launch (one
   `deleteItemAsync`, in a try/catch). The `thinking` key holds the cached thinking settings; it is **kept** and moves
   to the new provider, reading only the text half (a cached attachment is ignored and dropped on the next write).

### Answer style

Not built. No setting, no column, no prompt switch. KIP's reply length is the single live persona's `normal`
verbosity (3 to 4 sentences).

## 2. Backend

### Persona set v5: KIP

Persona sets are versioned: v1–v4 stay registered and unedited.

- **`backend/src/coach/personas/v5.ts`** holds one persona, `kip`, and `LIVE_PERSONA_VERSION` becomes `'v5'`.
  - `name: 'KIP'`.
  - `tone`: "Friendly, plain-spoken and a little playful: the user's own small coach who knows their data. Calm
    about a dip, glad about a win, never preachy or gushing."
  - `focus`: "Whatever the question is about: sleep, recovery, training or steady habits."
  - `verbosity: 'normal'`, `proactivity: 'threshold-triggered'` (so the weekly note keeps running, as with v4).
  - `disallowedTopics`: `REQUIRED_DISALLOWED_TOPICS` plus "supplement recommendations", as v4.
  - `tagline` and `greeting` are not needed; the type for v5 is `CoachPersona`, not `CharacterPersona`.
- **`resolvePersona(anything)` returns KIP.** `findPersona` maps every id from any registered set (v1's `direct`,
  `encouraging`, `clinical`; the v2 and v3 characters; the v4 coaches) and every `LEGACY_PERSONA_IDS` key to `kip`,
  so an old app's request never fails. (Today `PUT /me/coach/persona` rejects v1 ids with 400; after this change it
  accepts them and stores `kip`.)
- **The prompts:**
  - `answer/prompt.ts`: the opening line becomes "You are KIP, the user's own coach inside a wellness app, talking in
    character." The persona block, the escaping (`escapeField`), the number rule, the steps rule, the topic rules,
    the urgent-symptom rule, the card and memory formats are **unchanged**.
  - `answer/today.ts` (the day sentence) and `digest.ts` (the weekly note) already take the name and tone from the
    persona, so they speak as KIP with no other change. "companion coach" in `buildTodaySummaryPrompt` becomes
    "own coach".
  - `validate.ts` (the per-sentence number and topic check) is not touched.
  - A prompt change is a reviewable unit: run `npm run eval:coach` (in `backend/`) on `main` at f8d4afc (v4) and on
    the branch (v5; every user resolves to KIP there), and attach both results to the PR. A worse number-rule or
    topic-rule pass rate blocks the merge.
- **The no-numbers prefill rule stays.** Every question the app fills in (Ask KIP bars, Home, the recap story) names
  a day or a night, never a value from the screen (`mobile/src/lib/coachPrompts.ts`, `askAboutWeekPrompt`). KIP
  fetches the real values itself.
- **Persona-change guards go.** `today.ts`'s `personaChanged` check (`skipped_persona_changed`) can no longer fire;
  it is removed with its tests. The day summary is no longer rebuilt on a persona switch (`PUT /me/coach/persona`'s
  summary refresh) either.
- **Telemetry** labels every event `personaId: 'kip'`.

### Stored choices (migration `20261014120000_kip_coach`)

Data only; no column is dropped in this release, because older apps still read and write these fields.

| Column | What happens | Why |
| --- | --- | --- |
| `User.coachPersonaId` | `UPDATE "User" SET "coachPersonaId" = 'kip'` for every row | old apps then see a chosen persona and never open the picker |
| `User.coachThinkingAttachment` | left as is, no longer read by the new app | old apps still draw it; dropped in the cleanup release |
| `User.coachThinkingText` | **kept and used** | "While KIP thinks" |
| `CoachDigest.personaId`, `Recap.personaId` | left as is | they record who wrote a past note |
| `CoachConversation`, `CoachMessage`, `CoachMemory`, consents | untouched | the thread and memories carry over to KIP |

- **The cleanup release** (later, once the minimum supported app version is past this one) drops
  `coachPersonaId` and `coachThinkingAttachment`, `PUT /me/coach/persona`, and the `persona*` fields of the status.
- On the device, the cached character (`characterId` in SecureStore) is purged on first launch and the cached
  thinking settings are kept (§1, Decoupling step 5).

### Routes for older apps

- **`GET /me/coach/status`:** `personaId: 'kip'`, `personaChosen: true` always, `personas: [kip]`. The thinking
  attachment field still resolves for old apps. A new app ignores all three.
- **`PUT /me/coach/persona`:** any id from v1–v4 or `LEGACY_PERSONA_IDS` saves `'kip'` and returns
  `{ personaId: 'kip' }`. An unknown id is still a 400 `unknown_persona`.
- **`PUT /me/coach/thinking`:** unchanged (the text half is still used).
- **`Person.coachId`** and the Social home's `camp.faces` keep their shape for old apps. After the migration they
  read `'kip'`, which an old app's registry draws as its default character. The new app ignores both and uses
  `kipColour` / `faceColours`.

### Consent

- The consent texts in `coach/consent.ts` change wording only: "the coach" becomes "KIP" ("When you send KIP a
  message…", "The messages you type to KIP…"). What is sent, to whom, and the model are unchanged.
- **Versions are not bumped** (`COACH_CONSENT_VERSION` stays `'2'`, `COACH_HOSTED_CONSENT_VERSION` stays
  `'hosted-1'`), so nobody is asked to re-consent for a rename (owner, 2026-10-14).
- The hosted-engine flow (`HostedConsentScreen`, `ai-engine-row.tsx`) is kept and renamed (§7.5).

## 3. The KIP page (W7)

The tab's screen keeps its file, `screens/CoachScreen.tsx`, and its phase logic (`loading`, `unavailable`,
`needs-consent`, `ready`), `useCoachConversation`, the prefill handling and the history restore. The picker branch
(`openPicker`, `pickerOpened`, `providerSaysNotChosen`) is deleted.

### 3.1 Top to bottom, expanded

1. **Header row** (`px-5`):
   - Left: `PageTitle` "KIP" (A4 pixel page title), and under it a status line in `text-caption`, muted (§3.3).
   - Right: two outline `Button`s, `icon-lg`: **Conversations** (label "Conversations and what KIP remembers") and
     **New chat**. Spec B adds a third, **Decorate**, first in the row; this spec leaves room for it but does not
     draw it.
2. **The room card** (`Card`, `px-5` page inset, 14-point padding):
   1. **The diorama** (§3.2), framed.
   2. **A caption row:** "KIP'S DESK" (`SectionLabel`, light) over "Window shows today's Recovery" (`text-caption`,
      muted). On the right, the **RECOVERY hot tag**: Home F's tag (dark, `rounded-lg`, band-colour square, pixel
      key, tabular value). It opens Recovery on today. Spoken label: "Recovery 58, cloudy day. Open Recovery"; with no
      score, "Recovery, no reading yet. Open Recovery".
      - `HotTag` is private to `components/home/HomeScene.tsx` today. It is **extracted** to
        `components/home/HotTag.tsx` and exported, with positioning made optional (absolute with `left` / `top` on
        Home; in normal flow here). Its conventions entry in `buttons.test.ts` (`HomeScene.tsx`, `HotTag:testID`)
        moves to the new file, with its count covering both uses.
   3. **One full-width outline `Button`, "Shrink room"** (§3.5). Spec B adds "Decorate" beside it, two columns.
3. **The thread** (as today): `CoachToday` (the day's sentence and suggestions), the empty state, message rows,
   answer cards, follow-up chips, memory proposals, the thinking row, the error card, the chat notes.
4. **The prompt bar** (as today), placeholder "Ask KIP…", accessibility label "Message KIP", with Stop while
   streaming and the `/` shortcuts button.

### 3.2 The diorama

- Drawn by the room engine (§5) at **2 points per room cell**, from the user's room loadout (starter room in this
  spec), the window's weather (§6), and KIP's colour, pose and mood (§4).
- **The frame:** a 6-point wood border (`#5B4636`) with a 2-point outer line (`#3A2D23`), 4-point corners. It is part
  of the picture, not a button.
- **Size: crop, never shrink** (as Home F). The room grid is 170 × 110 cells (340 × 220 points).
  - The frame's inner width is the card's inner width; its inner height is 200 points.
  - The engine exports a **focus box**, `FOCUS_BOX = { x: 15, y: 10, w: 140, h: 100 }` cells (280 × 200 points):
    the window, the desk and KIP. The art must keep those three inside it. The crop keeps the focus box on screen and
    centres it; extra width shows more room, never a scaled room. The 10 rows above it (the ceiling) are the first
    cropped, which is why the frame is 200 points tall.
  - On a 375-point phone the inner width is 323 points, so about 8 cells are cropped from each side, all outside the
    focus box. The narrowest supported inner width is 280 points (a 320-point phone), which is exactly the box.
  - The engine also exports a **thumbnail box**, `THUMB_BOX = { x: 70, y: 40, w: 96, h: 60 }` cells: KIP and the
    monitor, for the collapsed header (§3.5). Both boxes are checked by tests against the drawn positions.
- **The speech bubble** (W7's `.say`): a small light box, `rounded-lg`, in the pixel font, `text-label`, above KIP's head. "HI!" on
  first open, "ON IT…" while thinking, "HERE'S MY TAKE" while answering, "OOPS" on error, "MAY I?" when consent is
  needed, "Z Z" when offline. None while idle.
- **Accessibility:** the diorama is one image. Its label: "KIP at the desk, {state}. Window: {weather}", for example
  "KIP at the desk, typing. Window: cloudy". The speech bubble is decorative (the thread's status row carries the
  meaning).

### 3.3 The status line

| When | Expanded status line | Collapsed status line |
| --- | --- | --- |
| idle with a score | "In the pocket room · {verdict} day", e.g. "fair day" | "In the pocket room" |
| idle, no score / building | "In the pocket room" | "In the pocket room" |
| thinking | "Typing it up…" | "Typing it up…" |
| answering | "Answering" | "Answering · Recovery {score}" |
| offline | "Offline" | same |

The verdict word comes from the Recovery page's band copy (`recoveryCopy.ts`) in lower case. Strings live in a new
`lib/kipCopy.ts`.

### 3.4 KIP's states, in the room and the thread

| State | Room: pose, mood, bubble | Thread |
| --- | --- | --- |
| **Idle** (no turn running) | the day's pose and mood (Home F's `sceneState` mapping: cheer/proud, wave/idle, rest/idle, rest/determined, coffee/sleepy, rest/sleepy at night, rest/curious fallback), at the desk facing you; no bubble | as now |
| **Empty / first open** | `wave`, `idle`, "HI!" | "Hi, I'm KIP. What would you like to know?" (`text-heading`), "Ask about your sleep, recovery or training, or anything health and fitness." and three suggestion rows, as `States` 1 |
| **Thinking** (waiting for the first sentence) | `type`, `glance`, seated, facing the monitor; the monitor shows the dots; "ON IT…" | the thinking row, its label "KIP is typing it up" in the KIP colour, with the steps (or the chosen thinking text) |
| **Answering** (sentences streaming) | KIP **turns** (§4) to face you: `point`, `glance`; the monitor shows the chart; "HERE'S MY TAKE" | the reply streams under a "KIP" label in the KIP colour |
| **Done** | back to Idle | the card, follow-ups and any memory proposal arrive |
| **Stopped** | back to Idle | as now |
| **Error** | `shrug`, `startled`, "OOPS" | `ErrorCard` with the heading "KIP lost the thread"; every existing error message stays (too slow, still finishing, too many messages with a wait, try asking another way) |
| **Offline** | `rest`, `sleepy`, "Z Z" | "KIP can't reach the internet. Ask again when you're back online." No button: there is no offline cache of past chats and no outbox; a question typed while offline stays in the prompt bar, unsent |
| **Unavailable** (coach off on the server) / status unverified | `rest`, `sleepy`, no bubble | "KIP isn't available right now." as today's unavailable copy, renamed |
| **Consent needed** | `wave`, `curious`, "MAY I?" | "KIP needs your OK first" (heading), "Before KIP can look at your scores, see exactly what is sent when you ask something." and two buttons: "Review what is shared" (default) and "Not now" (outline; it goes back to Home) |
| **Loading** | the room card's frame with a `Skeleton` inside; the header is drawn | the existing thread skeleton |

- The **KIP colour** is `useMyKipColour()` throughout: the room's KIP, the "KIP" labels and the thinking label.
  Labels use the colour only where it passes contrast on the card (all ten colours except ink and slate pass on the
  dark card; on those two, and on light mode, the label uses `foreground`).
- **Offline** is new: today a send just fails, and `useCoachStatus` turns any failed status read into `null`, which
  the page treats as unavailable. NetInfo is not installed, and this spec adds no dependency (owner, 2026-10-14):
  - **`isNetworkError(err)`** in `api/client.ts`: true only when `fetch` itself rejected before any response. It is
    false for an `ApiError` (any HTTP status), an abort (`AbortError`, including Stop) and
    `CoachStreamInterruptedError`.
  - **`useCoachStatus`** keeps a separate `offline: boolean`: a status read that fails with a network error sets it
    and keeps the last known status; any other failure is `null` (unavailable) as today. A send that fails with a
    network error also sets it.
  - The page shows the offline state while `offline` is true and no turn is running. It retries the status read on
    focus and on return to the foreground; the next successful request clears it.
- Consent "Not now" is new on this page. It is an outline `Button`.

### 3.5 Collapse on scroll, and "Shrink room"

- The room card scrolls with the thread. A **collapsed header** (60 points tall plus the safe area) is pinned at the
  top of the page and appears once the card's bottom edge has scrolled under it.
- **The collapsed header**, left to right (W7 "Collapsed · after scroll"):
  - a **thumbnail** of the room, 96 × 60 points inside a 3-point frame that sits outside it (102 × 66 overall): the same room picture drawn at 1 point per
    cell, cropped to `THUMB_BOX` (§3.2). It is a raw `Pressable` (`accessibilityRole="button"`, label "Expand KIP's room"),
    which needs a conventions entry. It scrolls to the top;
  - "KIP" in `text-page-title` (the pixel page title), and the collapsed status line (§3.3);
  - the Conversations and New chat `Button`s.
- **Motion:** the collapsed header fades in over the last 24 points of the card's travel (Reanimated, driven by the
  scroll offset; no timers). Under **Reduce Motion** it switches at the threshold with no fade.
- **"Shrink room"** collapses the card for good: the page then starts with the collapsed header and no card. The
  thumbnail expands it again. The choice is remembered on the device (SecureStore key `kipRoomShrunk`, the repo's
  device-storage pattern, as `characterCache.ts` does; wrapped in try/catch; default expanded). It is not sent to the server.
- The prompt bar and the keyboard behaviour are unchanged. When the keyboard opens, the card does not resize; the
  thread scrolls as today.

### 3.6 Reduce Motion

`AccessibilityInfo.isReduceMotionEnabled` (with its change listener) turns off: the typing loop, the turn, the 3-frame
room loops (§5), the collapse fade, and the thinking row's animated text styles (they already honour it). The room
then shows the pose's first frame.

## 4. KIP poses (engine additions)

`mobile/src/lib/kip/kipArt.ts` gains poses. **The arms-only rule holds:** a pose adds arm cells (and an optional
held item) into empty cells only; the body block, legs and eyes never change. Eyes come from the mood.

| Pose | Arms | Used for |
| --- | --- | --- |
| `type` | both arms forward and low, over the keyboard; 3 frames alternate which arm is down | thinking, at the desk |
| `think` | one arm up to the chin | the thinking state where there is no desk (Home's KIP's note shimmer, the Ask KIP bar while it opens) |
| `point` | one arm out to the side at shoulder height | answering |
| `shrug` | both arms out and up | error |

- **Turn** is a transition, not a grid: from `type` (flipped to face the monitor, mood `glance`) to `point` (facing
  you), as a 2-frame swap over 160 ms. Under Reduce Motion it cuts.
- **Facing:** the engine already draws KIP front-on. "Facing the monitor" is the same sprite mirrored, with the
  `glance` mood looking toward the desk. No back or side view is drawn.
- `KIP_POSES` and the pose gallery test list every pose; each new pose gets a snapshot of its grid in all three of
  coral, cobalt and lime (the `States` mood row).
- A dev screen, `screens/dev/KipGalleryScreen.tsx`, replaces the character gallery: every pose × mood × colour.
- KIP in the room is drawn at **4 points per KIP pixel** (2 room cells per KIP pixel), so KIP is 64 × 64 points in
  the diorama.

## 5. The room engine (starter room only)

### Modules

- **`mobile/src/lib/room/`**, pure, no React:
  - `grid.ts`: `ROOM_W = 170`, `ROOM_H = 110`, `CELL_PT = 2`, the floor line, the vanishing point of the one-point
    perspective, and the **focus box**.
  - `slots.ts`: the **12 room slots** (`wallpaper`, `floor`, `art`, `window`, `shelf`, `desk`, `desk_item`, `plant`,
    `lamp`, `corner`, `rug`, `pet`) and the **4 worn slots** (`head`, `face`, `neck`, `ears`), each room slot with its
    anchor rect on the grid. Spec B uses the same ids for its catalogue and hotspots.
  - `items.ts`: an `ItemArt` type, `{ id, slot, draw(ctx): Layers, emissive?: boolean, frames?: 3, tint?: boolean,
    style?: 'standard' | 'low' }`, and a registry of art by item id. Every item fills exactly one slot (no
    multi-slot items). This spec registers only the **10 placed starter items** (below); Spec B authors the other
    seven starter pieces (Dots, Mini cactus, Notebook, Sticky notes, Cactus, Beanie, Earbuds).
  - `loadout.ts`: `RoomLoadout = Record<RoomSlot, ItemId | null>`, `KipWorn = Record<WornSlot, ItemId | null>`,
    and `STARTER_LOADOUT`.
  - `draw.ts`: `drawRoom({ loadout, weather, night, kip, screen })`, where `kip` is `{ colour, pose, mood, worn }`
    (`worn` is all null in this spec; Spec B fills it), returns `{ base, light, emissive, frames: [f0, f1, f2],
    kipSeat, focus, thumb }`, each layer a list of `[x, y, w, h, colour]` rects on the grid. **`kipSeat`** is where
    KIP is drawn, derived from the desk item's `style`: `standard` seats KIP on a chair at the desk; `low` seats KIP
    on the floor at a low table (Spec B's Japanese set). The order is the v2 engine's
    (`docs/design/kip-coach/project/lib2.js`, `room2`, which uses the helpers in `lib.js`; the starter room's layout
    is `k4room.js`, and the six sets are drawn in `sets2.js`): walls and floor in perspective, items back to front,
    ambient occlusion, then daylight through the window (by weather) or the night veil, then emissive glows, then the
    loop frames. KIP is a separate layer so a pose change never redraws the room.
  - `weather.ts`: the window sky per state (§6), ported from `lib2.js`'s window sky (smooth sun, puffy clouds, rain,
    moon) and dithered gradients.
- **`components/room/RoomView.tsx`** draws it with **`@shopify/react-native-skia`** (already a dependency):
  - the static layers (`base`, `light`, `emissive`) are recorded once into an `SkPicture` per (loadout, weather,
    night, colour) and memoised; KIP's layer is keyed by (colour, pose, mood, worn, frame);
  - KIP and the current loop frame are drawn over it each change;
  - one `Path` per colour per layer (as Home F's SVG scene), on whole points, with antialiasing off so edges stay
    crisp;
  - it takes `loadout` (the `RoomLoadout`; Spec A passes the starter loadout), `weather`, `night`, `colour`, `worn`
    (Spec A passes all-null), `crop` (inner width × height), `cellPt` (2, or 1 for the thumbnail), `pose`, `mood`,
    `bubble`, `reduceMotion`.
- **Why slot-driven now:** the starter room is just a loadout of starter items. Spec B adds items to `items.ts`, a
  loadout and worn items from the server, and decorate mode's overlays (hotspot tags and the dashed "LOCKED" tag,
  drawn by its own screen over `RoomView`). The seat, the worn items and the memo keys are already in this spec's
  API, so Spec B does not change `draw.ts`'s contract.

### The starter furnishing (K4's, at v2 quality)

| Slot | Starter item |
| --- | --- |
| wallpaper | Plain slate |
| floor | Dark oak |
| art | Wall calendar |
| window | Plain frame |
| shelf | Books |
| desk | Monitor (emissive screen: dots while thinking, chart while answering, lines idle) |
| desk_item | Mug (tints to KIP's colour) |
| plant | Fern |
| lamp | Amber desk lamp (emissive) |
| corner | empty |
| rug | Slate rug |
| pet | empty |

KIP wears nothing in this spec. Worn slots are drawn by Spec B.

### Loops

The monitor's dots or cursor, the lamp's glow flicker and the steam on the mug are 3-frame loops at 400 ms per frame,
paused when the tab is not focused (`useScreenFocused`) and off under Reduce Motion.

### Performance budget

- Building the picture: under 8 ms on an iPhone 12 / Pixel 6 class device in a release build; measured in a dev perf
  test that logs only the duration.
- A pose change or loop frame never rebuilds the picture.
- No per-cell React elements. Memory: one picture per screen, released on unmount.

## 6. The window's weather

- **One shared hook, `lib/home/useTodayScene.ts`**, extracted from `DashboardScreen`: it makes the reads Home F already
  makes (`fetchScoresWithBands(7)`, `fetchSleep(today, today)`) and returns `sceneState(...)` plus today's Recovery
  score and verdict. Home and the KIP page both use it, so the window always agrees with Home and the Recovery tile.
- **Window states**, from `sceneState`: `night` (moon, stars, night veil and lit lamp), `short` (haze, a small sun),
  `clear`, `mostly`, `cloudy`, `stormy` (rain on the glass), and the fallback (mostly-clear sky, no sun disc).
- **The idle pose and mood** follow the same state (§3.4), so KIP on Home and KIP in the room match.
- It recomputes on focus, on return to the foreground and at the 05:00 / 20:00 boundaries, as Home does.
- A failed read gives the fallback window and KIP `rest` / `curious`. It never blocks the page.

## 7. Knock-on surfaces

### 7.1 The tab

- The tab's route name stays `Coach` (deep links, `navigateToCoachEntry` and tests keep working); its **label**
  becomes **"KIP"** (was "AI Coach").
- The tab bar's hub icon (`FloatingTabBar`'s `hub-character`) becomes `Kip` in your colour at scale 2, `rest` /
  `idle`, dimmed under the same rule as today.

### 7.2 Ask KIP bars (Recovery and Sleep)

- `AskCoachBar` becomes **`AskKipBar`** (`components/coach/AskKipBar.tsx`), still the one documented custom CTA in
  `components/ui/README.md` (README updated).
- Its icon is **KIP's head**: a new **`components/kip/KipHead.tsx`** draws only rows 0–9 of the 16-wide KIP grid,
  at scale 4 (64 × 40 points), in your colour, in the page's mood: `sleepy` on Sleep, the day's mood on Recovery.
  `KipHead` (scale 2, 32 × 20) is also the icon on Home, the Conversations sheet, the memory screen and beside replies.
- Labels: "Ask KIP about today" / "Ask KIP about this day" (`recoveryCopy.ts`), "Ask KIP about last night" / "Ask KIP
  about this night" (`sleepCopy.ts`). The `coach` name parameter is removed from those copy functions.
- The filled-in questions stay number-free (§2).
- Test ID `ask-coach-button` becomes `ask-kip-button`.

### 7.3 Home

- Home F's **"Ask Coach about today"** button becomes **"Ask KIP about today"** (and "Ask KIP · see what's shared
  first" when consent is needed). Its icon is KIP's head in the day's mood.
- The weekly digest card (`coach-digest-card.tsx`) becomes **"KIP's note"**: the title "KIP's note · {Mon, Oct 6}",
  the text, and "Read it all →". KIP's head replaces the coach character.
- The recap story's "Ask {coach} about your week" becomes "Ask KIP about your week"; the recap card's "{coach}'s note
  for the week" becomes "KIP's note for the week". The recap renderers (`RecapCardView`, `WeeklyStoryView`,
  `YearPixelsView`, `RecapBuilderScreen`, `RecapScreen`, `RecapStoryScreen`, `YearInPixelsScreen`, `lib/recapTheme.ts`)
  draw `Kip` in your colour instead of the coach character, and the recap theme's per-coach accent becomes the KIP
  colour.

### 7.4 Conversations sheet and memory

- `ConversationsSheet`: "Coach memory" becomes **"What KIP remembers"**, subtitle "See, edit or delete · {n} things",
  with KIP's head as its icon. Everything else is unchanged.
- `CoachMemoryScreen`: the screen title becomes "What KIP remembers"; the intro "Things you told me that help me
  answer. Only you can see them, and you can delete any of them." Its behaviour is unchanged.

### 7.5 Settings: the KIP page

`coach-settings-section.tsx` and `your-coach-row.tsx` merge into one Settings group, **"KIP"** (was "Your coach" and
"AI Coach"), as on the Elsewhere board, minus Answer style:

1. **Your KIP** row: your KIP in your colour, "{Colour} · coaches you on the KIP tab", and "Change colour", which
   opens the existing KIP colour page.
2. **"While KIP thinks"** row: "How the chat shows KIP is working", its current value ("Steps"), opening
   `ThinkingTextScreen` (title "While KIP thinks").
3. **Memory and privacy:**
   - "What KIP remembers" with the count, opening `CoachMemory`;
   - "What is sent when you ask something", opening `CoachConsent` in review mode;
   - the **AI engine** row (`ai-engine-row.tsx`) and its hosted flow (`HostedConsentScreen`, title "KIP's AI
     engine"), copy renamed "the coach" → "KIP".
4. **"Turn off KIP coaching"** (destructive outline `Button`), footer "KIP stays on Home; nothing is shared for
   coaching." It calls the existing `revokeCoachConsent`.

When KIP coaching is off, the group shows "Set up KIP coaching" (was "Set up AI Coach") and the off footer "KIP
coaching is off. Nothing is shared, and the rest of the app works as normal."

### 7.6 Other copy

Every user-facing "Coach", "AI Coach", "the coach" or coach name becomes "KIP" or "KIP coaching". That includes:

- the navigator titles in `RootNavigator.tsx`: `CoachConsent` "AI Coach" → **"KIP coaching"**, `CoachMemory` "Coach
  Memory" → **"What KIP remembers"**, `ThinkingText` "Thinking text" → **"While KIP thinks"**, `HostedConsent` "AI
  engine" → **"KIP's AI engine"**;
- `homeCopy.ts`'s `askCoach` (§7.3), `recoveryCopy.ts`, `sleepCopy.ts`, `recapShelf.ts` and the badge copy (level V
  "Coach" → "Legend", copy only).

A test scans **string literals only** (via the TypeScript scanner, so comments are skipped) in `src/screens`,
`src/components`, `src/lib` and `src/navigation` for `\bCoach\b` and for the 15 retired coach names, with an
allow-list for route names and type names.

### 7.7 Where the coach character is swapped for KIP

Every remaining `<Character>` stands for the coach and becomes `Kip` in **your** colour (`useMyKipColour`), at a
whole-number scale close to the old size:

| Where | Pose, mood |
| --- | --- |
| `onboarding-hero.tsx`, `SignUpScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `ConnectHealthScreen` | `wave`, `idle` (coral before sign-in) |
| `BedtimeGoalScreen` | `rest`, `sleepy` |
| `CelebrationModal`, `BadgeDetailScreen`, `BadgesCard`, `BadgeIcon` | `cheer`, `proud` |
| `StoryRing`, `RecapShelf` | `rest`, `idle` |
| `DashboardScreen` fallback state (`dashboard-fallback-character`) | `rest`, `curious` |
| `RecapScreen`, `RecapStoryScreen`, `RecapBuilderScreen`, `YearInPixelsScreen` | `cheer`, `proud` on the cover; `rest`, `idle` elsewhere |
| `SettingsScreen` (the KIP group's row, §7.5) | `wave`, `idle` |
| `CoachMessageRow` (the avatar beside a reply) | KIP's head, `idle` |
| `HostedConsentScreen`, `CoachConsentScreen`, `CoachMemoryScreen` | `wave`, `curious` |
| `ThinkingTextScreen` preview | `type`, `glance` |

The data paths behind those pictures change too:

- **Recaps:** `recapTheme.ts`'s `recapCoachId` and `recapTint(coachId)` become `recapTint(kipColour)`, built from the
  KIP colour ramp. A past recap's stored `personaId` is **ignored** for drawing (it stays in the data as a record).
  `lib/recapShare.ts` drops `isCharacterId` and draws your KIP on shared cards.
- **Badges:** `lib/badgeArt.ts`'s level V ring (`coachTier(accent)`, `tierColors(level, coachAccent)`) takes the KIP
  colour's ramp instead of a coach accent: `ring` = body, `fill` = `d` mixed toward black, `glyph` = `h`.
  `BadgeIcon` and `BadgeDetailScreen` pass `useMyKipColour()`.

## 8. Navigation and first open

- **Removed routes:** `MeetYourCoach` and `ThinkingStyle`, from `RootNavigator`'s param list and stack.
  `MeetYourCoach` is removed from `MODAL_ROUTES` in `navigationRef.ts`.
- **First open, now** (Elsewhere board): KIP tab → consent (if not given) → chat with KIP. KIP's colour is already
  picked (coral by default, changeable in Profile), so there is nothing to choose first.
- **Onboarding** never routes to a picker. Sign-up → connect health → Home, as today minus any picker hop.

## 9. App icon: A · Face close-up

The art is the KIP engine's block on a 24-cell grid (one cell ≈ 43 px of the 1024 master), from
`docs/design/app-icon/project/Main.dc.html` (A) and `Variants.dc.html`. Exported once by a script,
**`mobile/scripts/build-icons.mjs`**, run with `npx sucrase-node scripts/build-icons.mjs` (sucrase is already in
`node_modules`, so it can import the TypeScript `lib/kip/kipArt.ts` grid directly; a `build:icons` npm script wraps
it). It writes the PNGs with **`pngjs`**, a new devDependency. The icon test is a normal Jest test that imports the
same pure grid-to-pixels function and checks sizes and file presence. The icon can never drift from KIP.

| File | Size | Content |
| --- | --- | --- |
| `assets/icon.png` | 1024 × 1024 | A: coral block full bleed, shade side on the right, two eyes; key content inside the central 80% |
| `assets/icon-dark.png` | 1024 × 1024 | J: the block with eyes on near-black `#0A0B0E` (iOS 18 dark) |
| `assets/icon-tinted.png` | 1024 × 1024 | J in greyscale on transparent; iOS applies the tint |
| `assets/android-icon-background.png` | 432 × 432 (108 dp at 4×) | the body and the shade side |
| `assets/android-icon-foreground.png` | 432 × 432, transparent | the eyes, inside the 66 dp safe circle |
| `assets/android-icon-monochrome.png` | 432 × 432 | the J block with the eyes cut out |
| `assets/splash-icon.png` | 1024 × 1024, transparent | the engine's KIP sprite at 8×, centred |
| `assets/favicon.png` | 48 × 48 | A at 48 |

- `app.json`: `ios.icon` takes `{ light, dark, tinted }` (Expo SDK 57 form); `android.adaptiveIcon` keeps its three
  layers (new files).
- **Splash:** there is no splash config today (no `splash` key, no `expo-splash-screen` plugin; `splash-icon.png` is
  unused). This spec adds `expo-splash-screen` (installed with `npx expo install`) and its plugin entry in `app.json`:
  `{ "image": "./assets/splash-icon.png", "imageWidth": 128, "resizeMode": "contain", "backgroundColor": "#0A0B0E" }`,
  so launch hands straight into the dark app.
- The icon change ships in a store build (it is not an OTA asset). Alternate icons per KIP colour are out of scope.

## 10. Rules that apply

- Every button is `ui/button.tsx` with `rounded-lg`. Raw pressables with a button role (the collapsed thumbnail, the
  hot tag reuse, the suggestion rows already listed) need conventions entries; entries for deleted files are removed.
- Only the A4 type tokens; the pixel bubble and labels use `text-label` with the pixel font. No inline font sizes.
- Strings live in copy modules (`kipCopy.ts`, and the existing ones renamed).
- Never log health values, dates, names or message text. Room loadouts and KIP colour are not logged with user IDs.
- Never `new Date('YYYY-MM-DD')`.
- TDD: run the touched tests and both typechecks before every commit.

## 11. Privacy

- Nothing new is sent to the model. The KIP colour, the room and the pose never enter a prompt.
- The persona change is style only; the fact sheet, the number rule, the topic rules, the memory allowlist and the
  consent gates are unchanged.
- The "Shrink room" choice stays on the device.

## 12. Tests

- **Backend:**
  - v5 is live; `resolvePersona` of null, `'kip'`, every v4 id, every v3 id and an unknown id returns KIP; v1–v4 files
    are unchanged (snapshot of their exports).
  - The answer, day-summary and digest prompts open as KIP and still contain the number rule, the steps rule, the
    topic list (with the required topics) and the escaping of persona fields.
  - The migration sets every `coachPersonaId` to `'kip'` and leaves `coachThinkingText`, digests and recaps alone.
  - `GET /me/coach/status` returns `personaChosen: true` and `personas: [kip]`; `PUT /me/coach/persona` with a v4 id
    returns `kip`, with junk returns 400.
  - `skipped_persona_changed` is gone; the day summary still writes.
  - Consent versions unchanged; consent texts say KIP.
  - The eval harness run on v5 (attached to the PR, not a unit test).
- **Mobile:**
  - `kipArt`: each new pose adds only arm cells in empty cells (the arms-only rule, asserted against `rest`); the
    `type` pose's three frames; snapshots in coral, cobalt and lime.
  - `lib/room`: `drawRoom` with `STARTER_LOADOUT` is deterministic; every slot's anchor sits inside the grid; an empty
    slot draws nothing; the focus box contains KIP, the desk and the window; weather states (night veil only at
    night, rain only when stormy, sun only in `clear` / `mostly` / `short`); emissive layer only for emissive items;
    an unknown item id is skipped, not thrown.
  - `RoomView`: the crop at 323, 335 and 375 points keeps the focus box; the thumbnail draws at 1 point per cell;
    the picture is not rebuilt on a pose change; loops are off under Reduce Motion and when unfocused; one
    accessibility label with the state and weather.
  - `CoachScreen`:
    - every state in §3.4 draws its pose, mood, bubble and thread copy;
    - thinking → answering → done moves the pose type → point → idle;
    - collapse: the header appears past the threshold, with no fade under Reduce Motion; the thumbnail scrolls to
      the top;
    - "Shrink room" persists and survives a remount; a storage failure leaves the card expanded;
    - the hot tag opens Recovery and has its label;
    - the prefill still lands in the input; the consent round-trip still carries it;
    - no picker opens, ever;
    - offline: a network error (not an HTTP error, not Stop) shows the offline copy with no button and keeps the
      typed question; an HTTP failure of the status read still shows unavailable;
  - `isNetworkError`: true for a rejected fetch; false for `ApiError`, `AbortError` and
    `CoachStreamInterruptedError`.
  - `useCoachStatus`: `offline` set by a network error and cleared by the next success; the last status kept.
  - Decoupling: `lib/thinkingText.ts` resolves the five kept ids and maps `tag`, `nameplate`, `bouncy`, `dialog`
    and `strip` to `steps`; `useThinkingLine` rotates KIP's three lines; `useFrameClock` pauses when unfocused and
    under Reduce Motion; `CoachStatusProvider` shares one status across callers; the SecureStore `characterId` key
    is deleted on first launch and `thinking` is kept; no file imports `components/characters` or `characters/`
    (a grep test).
  - `useTodayScene`: Home and the KIP page get the same state for the same reads.
  - `AskKipBar` on Recovery and Sleep: labels, KIP head in the right mood, the number-free question.
  - Home: "Ask KIP about today", the consent wording, KIP's note card.
  - Conversations sheet and memory screen titles; the Settings KIP group rows and their destinations; off state.
  - Navigation: `MeetYourCoach` and `ThinkingStyle` are not in the stack, and `MODAL_ROUTES` is `RecapStory` only.
  - The copy guard (§7.6): no "Coach" in user strings outside the allow-list; none of the 15 retired names anywhere
    in `src`.
  - **Conventions guards:** `buttons.test.ts` passes with the new raw pressable entries and no stale ones;
    `typography.test.ts` passes (no inline font sizes in the new files).
  - Icon: `build-icons.mjs` output sizes and the presence of each file `app.json` names, including the splash
    plugin's image.
  - Recaps draw your KIP colour whatever the stored `personaId`; level V badges use the KIP ramp.

## 13. Out of scope

- Room cosmetics, unlocks, decorate mode and worn items (Spec B).
- Alternate app icons per KIP colour.
- A buddy's room (Spec B decides: later).
- Dropping the legacy columns and routes (the cleanup release).
- Any change to what the coach can read, its tools or its engines.
- Answer style.

## 14. Open questions

None. The three defaults raised here (consent version, level V's name, offline detection) were accepted on
2026-10-14 and are recorded in §0.
