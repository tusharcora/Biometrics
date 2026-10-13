# KIP colour

Date: 2026-10-13 · Branch: `feature/home-f` (stacked on `feature/profile-activity`) · Status: design approved by the owner; spec awaiting review

The first of two specs. Home F (`2026-10-13-home-f-design.md`) builds on this one.

Each user picks the colour of their KIP. Buddies see that colour, and every person in the app is drawn as a KIP in
their colour. The AI coach keeps its own character.

Boards: "Profile · colour picker" (`docs/design/home/project/Picker.dc.html`) and the KIP colour page in "S2 pages ·
KIP colour, Sign-in & devices, Delete account" (`SC4.dc.html`).

## 1. The colours

The 10 colours of the KIP v1 scope (owner, 2026-10-10), already in `mobile/src/lib/kip/kipArt.ts` as `KIP_COLOURS`:
coral #FB7185 (the default), cobalt #3B82F6, ink #2A2F3A, lemon #FDE047, lilac #C4B5FD, lime #A3E635, mint #6EE7B7,
sky #7DD3FC, slate #64748B and snow #F1F5F9.

The colour is stored and sent by **name** (`'coral'`, `'cobalt'`, …), never by hex.

## 2. Backend

- **Schema:** `User.kipColour String @default("coral")`, with a migration. Existing users read as coral.
- **Validation:** one shared list of the 10 names in the backend. A stored value outside the list reads back as `'coral'`.
- **Save:** `PUT /me/kip-colour` with `{ colour }`.
  - It returns `{ kipColour }`.
  - A name outside the list is a 400 `{ error: 'invalid_colour' }`.
  - It requires auth, like every `/me` route.
- **Your own colour:** `GET /me/buddies/me` (the identity read the passport already uses) adds `kipColour`.
- **Everyone else's colour:** the shared `Person` record (`backend/src/buddies/people.ts`) adds `kipColour` next to
  `coachId`. Every buddy surface already receives `Person`: the buddy list, requests, buddy week, stories, the camp
  and chats. So one change reaches all of them.
- **Never logged:** the colour is not health data, but it follows the logging rules anyway. No user IDs with values in logs.

## 3. Mobile

### Data

- `api/kip.ts`: `saveKipColour(colour)`.
- `Person` and `BuddyIdentity` gain `kipColour?: KipColour`. An older server leaves the field out, and the app reads
  a missing or unknown name as coral (`kipColourOf(value)`).
- `lib/kip/useMyKipColour.ts`: a small store holding your colour.
  - It loads from the identity read and updates on save.
  - It is available anywhere your KIP is drawn.
  - Until the read lands, it gives coral.

### The picker (Profile)

- The Profile hub's settings grid gains a **KIP colour** card. Its status line is the colour's name, for example "Coral".
- The card opens `ProfileSection` with a new `kipColour` section, laid out like the Picker board:
  - **Preview:** your KIP waving, large (scale 6), on the board's small scene. Under it, the colour's name and hex,
    for example "Coral · #FB7185".
  - **The colour label,** with the line "Buddies see this colour".
  - **10 swatches,** in two rows of five. Each is a `Button` with `rounded-lg` and a colour square, and its label is
    the colour's name. The picked one is the `default` variant and the rest are `outline`. Each swatch has
    `accessibilityRole="radio"` and `accessibilityState={{ checked }}`.
  - **"Reset to coral"**, a ghost `Button` that only changes the selection.
  - **"Save colour"**, a full-width `Button`.
    - It is disabled while the picked colour equals the saved one.
    - While it saves, it shows the button's loading state.
    - On success, the store updates and the page stays open.
    - On failure, an inline error appears with "Try again", and the saved colour is unchanged.
- Nothing changes anywhere until Save succeeds.
- All strings go in `profileCopy.ts`.

### Your KIP in your colour

These use `useMyKipColour()` in place of the hard-coded coral:

- the Profile passport photo (`Passport.tsx`);
- the Activity header (`ActivityHeader.tsx`);
- Home: the scene and the Profile button (Home F spec).

### People as KIPs

- **`PersonKip`** (`components/kip/PersonKip.tsx`) is the one way to draw a person.
  - Props: `{ colour?: KipColour; state?: 'idle' | 'low' | 'asleep'; size: number; testID? }`.
  - It maps state to the engine: `idle` is rest + idle, `low` is rest + determined, and `asleep` is rest + sleepy.
  - `size` is in points. The scale is the largest whole number of points per cell that fits, centred in a
    `size` × `size` box, so the pixels stay crisp.
  - It is decorative and hidden from screen readers; the row around it carries the name.
- **It replaces `<Character characterId={…coachId…}>` wherever the character stands for a person** (a buddy, or you):

| Where | File |
| --- | --- |
| Home buddies (until Home F removes the card) | `components/home/BuddiesRow.tsx` |
| Buddy list rows | `components/buddies/BuddyListRow.tsx` |
| Chat avatars | `components/chats/ChatAvatar.tsx` |
| Chat requests | `components/chats/RequestsList.tsx` |
| Stories row | `components/social/StoriesRow.tsx` |
| Story frames | `components/social/SocialStoryFrame.tsx` |
| Camp note cards | `components/social/CampNoteCard.tsx` |
| Camp scene | `components/social/CampScene.tsx` |
| Camp banner | `components/social/CampBanner.tsx` |
| Campfire screen | `screens/CampfireScreen.tsx` |
| Buddy week | `screens/BuddyWeekScreen.tsx` |
| Pair up | `screens/PairUpScreen.tsx` |

  - The state keeps the meaning the sprite has today. A person asleep at the camp, or a goodnight story frame, is
    `asleep`. A buddy whose mood is `low` is `low`. Everyone else is `idle`.
  - Each swap keeps the size the character had.
  - Where the drawn person is you (your story, you at the camp, your camp note), the colour is `useMyKipColour()`.
    Otherwise it is the person's `kipColour`.
- **The freeze on `CampScene.tsx` and `CampBanner.tsx` is lifted for this change only** (owner, 2026-10-13). The
  sprite element and its import change; nothing else in those files does.
- **The AI coach keeps its character** everywhere it stands for the coach. That includes the Coach tab, the coach
  tile, the digest card, thinking rows, Your coach, Meet your coach, recaps, onboarding, the tab bar and celebrations.

## 4. Rules that apply

- Every button is `ui/button.tsx` with `rounded-lg`. Any raw pressable with a button or radio role needs a
  conventions entry.
- Only the A4 type tokens; no inline font sizes.
- Strings live in copy modules.
- TDD: run the touched tests and both typechecks before every commit.

## 5. Tests

- **Backend:**
  - `PUT /me/kip-colour` saves a valid name, rejects an unknown one with 400, and requires auth.
  - `GET /me/buddies/me` returns `kipColour`, and coral for a new user.
  - The `Person` record carries `kipColour` in the buddy list and in requests.
  - A stored value outside the list reads as coral.
- **Mobile:**
  - `kipColourOf` falls back to coral for a missing or unknown name.
  - `PersonKip`: the body colour follows `colour`, the state picks the pose, and it is hidden from screen readers.
  - The picker page:
    - swatches select;
    - Save is disabled until the selection changes;
    - Save calls the API and updates the store;
    - a failed save shows the error and keeps the old colour;
    - Reset selects coral.
  - The hub shows the KIP colour card with the colour's name.
  - The passport and the Activity header draw your colour.
  - For each swapped surface, its existing tests are updated, and they assert that a `PersonKip` with the person's
    colour is drawn where the coach character was.
