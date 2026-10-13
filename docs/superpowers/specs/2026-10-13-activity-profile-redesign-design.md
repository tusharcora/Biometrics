# Activity and Profile redesign

Date: 2026-10-13 · Branch: `feature/profile-activity` · Status: draft, waiting for the owner's check

The owner picked these boards (in `docs/design/home/project/`):

- **Activity:** A-2 "day almanac" (`Act2.dc.html`), plus A-1's month calendar and month stats (`Act1.dc.html`). "2026 so far" stays, and the month stats sit next to it.
- **Profile:** the S2 category hub (`S2.dc.html`), with the ID-2 passport card (`ID2.dc.html`) in place of S2's header. The passport also shows a check-in streak and the number of buddies.

The owner skipped the mockup step for these screens. Activity ships first and Profile second, as two commits or two PRs from this branch. All PRs are drafts.

## 1. Activity

The page is one scroll, in this order.

0. **Header strip** (A-2): KIP waving, in coral, from the `Kip` component in PR #61, beside the page title.
   - If #61 hasn't merged by then, this branch takes its two files.
1. **This week.** Seven rows, from today back to six days ago. Each row shows:
   - the day;
   - recovery, as a weather icon plus the number;
   - a sleep bar with hours;
   - a steps bar with the count.

   A day with no data shows a dash for that value. Tapping a row opens Sleep's night page on that night. The sources are what the page already loads: `fetchActivity`, `fetchSleep` and `fetchScores(…, 'RECOVERY')`.
2. **Month calendar** (A-1): the current `ActivityHeatmap`, restyled to the board. That means a weather icon in each day cell when that day has a recovery score, and the Less → More legend. The Month, Year and YTD switch stays.
   - **Steps** and **Sleep** are tabs (replacing today's pager).
   - **Recovery** is a new third tab, which colours each cell by recovery band. The band edges come from the existing recovery copy, and the banding itself is not changed.
3. **Month stats beside "2026 so far"**: two cards, side by side on a phone.
   - **Month stats** (A-1): the six stats for the visible month and metric (Total, Daily avg, Active days, Goal streak, Best day, Best date), from today's `rangeStats`.
   - **2026 so far** (A-2): Total, Daily avg and Goal days for the year, with its own Steps/Sleep toggle.
   - The year grid on the "2026 so far" board is dropped. The calendar's YTD view already shows it.
4. **Against your usual · 30d** (patterns): the current `UsualTiles`, restyled as A-2's rows. The Patterns and All trends links stay.

States:
- Each section loads, fails and retries on its own, using the `useSection` pattern from Sleep.
- While a section loads, it shows a skeleton.
- A failed section shows an inline error with a Retry `Button`.
- A first-time user with no data sees each section's empty line from the copy module.

## 2. Profile (Settings becomes the S2 hub)

The screen is reached the same way it is today, and its title becomes "Profile".

1. **Passport card** (ID-2):
   - **Band:** the band is coral, and KIP sits on the board's sky backdrop.
   - **Number line:** "NO. KIP-XXXX". The four characters come from a hash of the user id, so they are stable but don't reveal the id. This is decorative.
   - **Fields:**
     - NAME: the display name.
     - HANDLE: @handle, from `fetchIdentity`.
     - HOME: the time zone city, from the existing time zone state.
     - JOINED: the month and year.
   - **New on the card:** CHECK-IN STREAK and BUDDIES, as two numbers.
   - **Stamps:** up to four of the top earned badges, as stamps.
   - **Edit:** an Edit `Button` opens the existing handle and name editor.
   - **MRZ lines:** decorative, and hidden from screen readers.
2. **Badges row**: today's `BadgesCard`, in compact form.
3. **Eight category cards** in a two-column grid:
   - Health data
   - Time zone
   - Notifications
   - Buddies & sharing
   - Chats
   - Your coach
   - AI Coach
   - Sign-in

   Each card has a one-line status (for example "On · 3 kinds", or "Apple, Google"). Each opens a new stack screen that holds the section the page has today, unchanged. This moves the sections; it doesn't rewrite them.
4. **Account**: Sign out and Delete account, left as they are today.

There is no KIP colour picker yet. The colour is fixed at coral, and the picker will be a later change with its own field on `User`.

### Data

**Check-in streak.** This is the `current` value of the **`CHECK_IN`** badge family from `/me/achievements`. It counts on-time **habit** check-ins ("everything for this day is logged") from the badge start date, so the card agrees with the check-in badge. No new backend calculation is needed.

The other possible meaning is a streak of the Social tab's morning mood check-in. That one doesn't exist yet, and would need a new backend calculation.

**Buddies and joined date.** `GET /me/buddies/me` gains two fields. Both are tested first (TDD) in `backend/tests/buddies`.
- `buddyCount`: a count of the user's `BuddyPair` rows.
- `joinedOn`: the date of `User.createdAt` in the user's time zone, as YYYY-MM-DD.

Older backends don't send these fields, so the app treats a missing field as "—".

## 3. Rules that apply

- Every button is `components/ui/button.tsx` with `rounded-lg`; the category cards use `PressableScale` with an entry in the button conventions test.
- Text uses only the A4 type tokens, plus `PageTitle` and `SectionLabel`.
- All strings live in the copy modules: `lib/activityCopy.ts` (new) and `lib/profileCopy.ts` (new).
- Nothing logs health values, dates, names or handles.
- Dates are parsed with the existing local-date helpers, never `new Date('YYYY-MM-DD')`.

## 4. Tests

- **Activity:**
  - This week rows, including empty days and a tap opening the right night.
  - Calendar tab switching, including the Recovery tab.
  - Month stats following the visible month.
  - The "2026 so far" totals.
  - Each section's error and retry, kept separate from the other sections.
- **Profile:**
  - The passport fields, including fallbacks when the streak, buddies or joined date is missing.
  - Each category card opening its screen.
  - The existing Settings tests, still passing against the moved sections.
- **Backend:** `buddyCount`, and `joinedOn` across a time zone date boundary.
- **Before each commit:** run the touched suites, the mobile typecheck (still at the baseline of 12) and the backend `tsc`.

## 5. Questions for the owner

1. **Check-in streak:** is it the habit check-in badge streak (as above), or the Social morning mood check-in?
2. **Recovery tab:** should the calendar get the new Recovery tab, or keep Steps and Sleep only?
3. **"2026 so far":** is it fine to drop its year grid because the calendar's YTD view shows the same thing?
