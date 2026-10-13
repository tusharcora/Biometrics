# Handoff for the Cursor agent (2026-10-13 → until Claude is back, around Wednesday)

You are taking over the Biometrics app from a Claude Code session for a few days. Read this whole file first. It is
self-contained, so you do not need the Claude-only tools (design canvases, memory, subagents).

**Your job is narrow:** finish small, well-specified engineering tasks, and prepare (not finish) the KIP work. Leave
every design and product decision to the owner, and leave bigger builds for Claude.

---

## 1. The repo and environment

| | |
|---|---|
| Repo | `github.com/tusharcora/Biometrics` (**public**; `gh` is authenticated) |
| Main checkout | `/Users/tushar/Documents/PROJECTS/Biometrics` (in iCloud Documents, so do not build iOS from here) |
| Working copy used so far | `/Users/tushar/Documents/PROJECTS/Biometrics/.claude/worktrees/social-tab` (a git worktree) |
| Stack | `backend/`: Express 5, Prisma 6 (Postgres), BullMQ/Redis, TypeScript. `mobile/`: Expo 57, React Native, NativeWind |
| Node | Use `/Users/tushar/.nvm/versions/node/v24.21.0/bin` (the shell's default Node 20.15 is too old) |
| Run folder | `~/dev/biometrics-run` holds the iOS build, the dev backend on :3000 (nohup, `backend.log`) and Metro on :8081 (`metro.log`). The simulator is "iPhone 18 Pro", bundle `com.tusharcora.biometrics` |

### Commands

Set the Node path first:
```bash
export PATH=/Users/tushar/.nvm/versions/node/v24.21.0/bin:$PATH
```

**Mobile:** run these from `mobile/`.
```bash
node node_modules/.bin/jest --forceExit <paths>      # tests
node node_modules/.bin/tsc --noEmit --types jest,node --pretty false | grep -c "error TS"   # must print 12
```
- The 12 baseline errors are known and live in `__tests__/api/client.test.tsx`, `ActivityHeatmap.test.tsx`,
  `FactorBar.test.tsx`, `ScoreRing.test.tsx`, `MetricDetailScreen.test.tsx` and `App.tsx`.
- **Never add a typecheck error.**

**Backend:** run from `backend/`.
```bash
node node_modules/.bin/tsc --noEmit                  # must be clean
```

**Backend tests** must use the TEST database and Redis db 1, never the dev DB:
```bash
URL=$(grep -E '^TEST_DATABASE_URL=' ~/dev/biometrics-run/backend/.env | head -1 | cut -d= -f2- | tr -d '"')
TEST_DATABASE_URL="$URL" DATABASE_URL="$URL" REDIS_URL=redis://localhost:6379/1 NODE_OPTIONS=--experimental-vm-modules \
  node node_modules/.bin/jest --forceExit <paths>
```
- Never run two backend test runs at once.
- Never print the DB URL.

**Flakes:** under full-suite load a suite can fail (Campfire, Coach and Dashboard have done so). Rerun the failure
alone before treating it as real.

**Syncing to the simulator,** so the owner can try a branch:
1. `git archive <branch> mobile backend | tar -x -C <tmpdir>`.
2. rsync each folder into `~/dev/biometrics-run`:
   - backend: `--exclude node_modules --exclude dist --exclude .env --exclude service-account-key.json`;
   - mobile: `--exclude node_modules --exclude ios --exclude .expo --exclude '.env*'`.
   - Never delete `.env*` files there.
3. Rebuild the backend: `node node_modules/.bin/prisma generate`, then `node node_modules/.bin/tsc`, from the run
   folder's `backend/`.
4. Restart the backend: `nohup node --env-file=.env dist/server.js > ../backend.log 2>&1 &`. It must run from that
   folder.
5. Restart Metro with `--clear`: `nohup node node_modules/.bin/expo start --dev-client --clear > ../metro.log 2>&1 &`,
   from the run folder's `mobile/`.
6. Relaunch the app:
   `xcrun simctl terminate booted com.tusharcora.biometrics; xcrun simctl launch booted com.tusharcora.biometrics`.

---

## 2. The owner's hard rules (do not break these)

1. **No attribution.** No `Co-Authored-By` trailers, and no mention of Claude, Cursor or AI in commits or PRs.
2. **Git:**
   - never push to `main` and never force-push;
   - never merge a PR unless the owner literally says "merge";
   - open PRs as **drafts**;
   - never use bare `git stash`.
3. **Buttons:** every button is `mobile/src/components/ui/button.tsx` (the shadcn port).
   - **No pill shapes anywhere**; use `rounded-lg`.
   - Raw `Pressable`s with a button or link role need an entry in `mobile/__tests__/conventions/buttons.test.ts`.
4. **Type:** only the A4 tokens (`text-score`, `text-number`, `text-display`, `text-heading`, `text-headline`,
   `text-body`, `text-caption`, `text-fine`).
   - `PageTitle` and `SectionLabel` (Silkscreen pixel font) are for titles and labels.
   - No inline font sizes. `mobile/__tests__/conventions/typography.test.ts` enforces this.
5. **Copy:** user-visible strings live in the page's copy module (`lib/recoveryCopy.ts`, `lib/sleepCopy.ts`), never
   inline.
6. **Privacy:** never log health values, users' dates, names, emails or tokens.
7. **Civil dates:** never parse a `YYYY-MM-DD` date with `new Date('YYYY-MM-DD')` (it is the wrong day west of UTC). Use
   the component helpers. 1 Oct 2026 is a Thursday.
8. **Frozen files:** `mobile/src/components/social/CampScene.tsx` and `CampBanner.tsx`.
9. **Mockup first:** any new UI is mocked up and approved by the owner before it is built. **You cannot make the design
   canvases, so do not start UI work that has no approved mockup.**
10. **TDD:** write a failing test first, then the code. Run the touched tests plus the typecheck(s) before every commit.

---

## 3. State of the work

| Work | State | Branch / location |
|---|---|---|
| Recovery page | Merged (PR #59) | `main` |
| **One Sleep page** | Built, reviewed and tested; **PR not opened (held)** | `feature/sleep-page` (head `ae8b0b3`) |
| **Docs: designs in git + README "Where we are"** | Draft **PR #60** | `docs/design-status` |
| **KIP mascot** | Design final; **not built** | `docs/design/character/` (on `docs/design-status`) |
| **Home redesign** | **Direction F approved;** not specced or built | `docs/design/home/` (on `docs/design-status`) |
| Settings / Activity / Profile ID card | Mockups done; **owner's picks pending** | `docs/design/home/` |

**Detail and history:**
- `docs/superpowers/handoff/2026-10-10-sleep-home-kip-handoff.md` (on `feature/sleep-page`);
- the README's "Where we are" section (on `docs/design-status`);
- the specs and plans in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

---

## 4. What you may do (in this order)

### Task A: the two parked Sleep follow-ups (branch `feature/sleep-page`)
Both are small. Write a test first, then the fix, then run the mobile tests and typecheck, and commit.

1. **Cross-month taps blank the page.**
   - In `mobile/src/lib/useSleepPage.ts`: on an old week, a picker, chart-bar or month-cell tap that crosses into the
     previous month changes the fetch window. The window then shows a skeleton because `lastWindow` is only reused when
     `lastWindow.param === param` (about line 91).
   - **Fix:** also reuse `lastWindow`'s data while the new window loads, when `lastWindow.range` covers the new anchor's
     visible span (A−13 to A).
   - **Test:** an old-week cross-month tap keeps `window` `ready`: no picker skeleton, and the chart card stays mounted.
2. **Hero skeleton flash on a goal error.**
   - While the sleep-goal fetch is in error, a refocus, sync or retry flips it back to loading, so the hero flashes its
     skeleton.
   - **Fix:** once the goal is in error, refresh it quietly (keep the error and default goal until a refresh succeeds).
   - **Test:** goal in error, then refocus, then the hero never renders its loading skeleton.
3. Commit with a plain message and push `feature/sleep-page`. **Do not open the Sleep PR.** It waits for the Home
   redesign to decide where the Recaps shelf goes.

### Task B (optional prep, only if Task A is done): port the KIP drawing engine
- **Source:** `docs/design/character/scratch/kip-engine.js` (on `docs/design-status`), with the final design on the
  board `docs/design/character/project/Final.dc.html`.
- **Branch:** create `feature/kip-engine` from `origin/main`.
- **Build a pure, tested module and nothing that touches screens:**
  - `mobile/src/lib/kip/kipArt.ts`: the 16×16 base body, the GROUNDED lighting ramp from one body colour (light = mix
    with white 25%; shade = ×0.78; deep = ×0.60; ground shadow = black 35%; eyes dark, or light when luminance < 0.2),
    the pose-only arms (rest, wave, cheer, holding a bottle, holding coffee, stretch) and the moods (idle, curious,
    sleepy, proud, startled, glance, determined). Output is rect lists `{x, y, w, h, fill}`, like
    `mobile/src/lib/weatherArt.ts`.
  - `mobile/src/components/kip/Kip.tsx`: draws the rect list with `react-native-svg` `Rect`s at an integer scale,
    the way `mobile/src/components/recovery/WeatherIcon.tsx` does (no `shapeRendering` prop; hidden from screen
    readers).
  - **Colours** (the v1 list): coral #FB7185 (the default), cobalt #3B82F6, ink #2A2F3A, lemon #FDE047, lilac #C4B5FD,
    lime #A3E635, mint #6EE7B7, sky #7DD3FC, slate #64748B, snow #F1F5F9. Export them as `KIP_COLOURS` with
    `DEFAULT_KIP_COLOUR = 'coral'`.
  - **Tests:** the rect count per pose and mood is stable, rects fit the grid, the ramp maths per colour is correct,
    and dark bodies get light eyes.
- **Leave out the rest of the KIP system:** no skins, no account storage, no picker, no Home changes. Those need a
  spec.
- Push the branch and open a **draft** PR titled "KIP drawing engine (prep, not wired in)".

### Task C: keep things healthy
- If `main` moves, rebase nothing. Just report it.
- If the owner asks for something on this list, do it. If it is not on this list (new UI, a spec, a merge), confirm
  with them first and note that Claude is better placed for design work.

## 5. What you must NOT do
- Do not start the Home F redesign, the KIP account storage or colour picker, or the Settings, Activity or ID-card
  redesigns. They need specs, written by Claude with the owner.
- Do not merge PR #60 or any other PR without the owner's explicit "merge".
- Do not change the score banding: Sleep bands on the rounded score and Recovery on the one-decimal score. That is an
  open owner decision.
- Do not touch the git-ignored `.superpowers/` folders in the worktree. They are Claude's working ledgers.

## 6. When you finish, leave a note
Add a short section at the bottom of this file:
- what you did, with branches and commit SHAs;
- test results;
- anything you were unsure about.

Claude reads it on return.

---

## 7. Note from the interim agent (2026-10-13)

### What I did
| Task | Branch | Commit | State |
|---|---|---|---|
| A: the two Sleep follow-ups | `feature/sleep-page` | `757b954` | Pushed. **Sleep PR not opened**, as asked |
| B: KIP drawing engine | `feature/kip-engine` (from `origin/main` `6d3160d`) | `4ec75cd` | Pushed. **Draft PR #61**, "KIP drawing engine (prep, not wired in)" |

**A1, cross-month taps.** In `useSleepPage`, while the new window loads, the hook now keeps showing the last window's
nights when the new anchor falls inside that window's range. It does this even when the date param changed. Before,
the last window was reused only for the same param. The handoff suggested matching on the anchor's whole visible span
(A−13..A). That never matches the case that blanks the page: for a previous-month anchor, A−13 is one day before the
September window starts. So I matched on the anchor itself. The picker shows A−6..A, and the 2-week chart shows
A−13..A, so for one load the chart can miss its oldest night until the new window lands. It never shows a skeleton. A
failed load still shows the window's error with its retry. Tests: `useSleepPage.test.tsx` (3 Sep → 31 Aug stays
`ready`, then takes the new nights) and `SleepScreen.test.tsx` (a chart-bar tap from 10 Sep to 28 Aug keeps the picker
and the chart card mounted).

**A2, hero skeleton flash on a goal error.** In `useSection` (`components/sleep/Section.tsx`, used only by
`useSleepPage`), a reload from the error state now leaves the error up and refreshes quietly. Only a success replaces
it. Before, the reload set the section to loading, and the hero waited on the goal and showed its skeleton. This also
covers the regularity and window sections: a retry tap on any of them keeps its error card until the answer lands.
Test: `SleepScreen.test.tsx` (goal in error, refocus, the goal refetch is pending, the hero never shows
`sleep-hero-loading`, then the goal lands).

**B, KIP engine.** `mobile/src/lib/kip/kipArt.ts` exports `KIP_COLOURS`, `DEFAULT_KIP_COLOUR`, `KIP_POSES`,
`KIP_MOODS`, `kipRamp`, `kipGrid` and `kipArt`. `mobile/src/components/kip/Kip.tsx` takes `colour`, `pose`, `mood`
and an integer `scale` (default 4 pt per cell). It is hidden from screen readers and has no `shapeRendering`. I
ported the `build()` from `Final.dc.html`, which is newer than `scratch/kip-engine.js`: it moves held items with the
hop. I ran it on the plain body (no skin). The only cosmetics are the two held items that the bottle and coffee poses
need.

### Test results
- Mobile, `feature/sleep-page`: the full suite passes, 258 suites and 3028 tests (3025 before, plus 3 new). The
  typecheck is at the 12-error baseline.
- Mobile, `feature/kip-engine`: the new KIP tests, the convention guards and `WeatherIcon` pass (72 tests). The
  typecheck is at 12.
- I ran a one-off check without committing it: the port matches the board engine cell for cell for all 420 colour ×
  pose × mood combinations.
- I did not run the backend tests, because nothing in the backend changed. I did not sync to the simulator.

### Things to check
- **`main` moved.** PR #60 (`docs/design-status`) was merged, so `origin/main` is now `6d3160d`. I rebased nothing.
  This note is on `docs/design-status` after the merge, so it is not on `main` yet.
- **Left out of the KIP port:** the `breathe` and `blink` idle-loop frames, skins, outfits and ground colours. They
  can come later from `Final.dc.html`.
- **Local setup:** I added two worktrees, `.claude/worktrees/sleep-page` and `.claude/worktrees/kip-engine`. Their
  `mobile/node_modules` is a symlink to `social-tab/mobile/node_modules`, which has the same lockfile, and
  `mobile/node_modules` is in `.git/info/exclude`. Moving the Cursor workspace once briefly checked out the wrong
  branch in those worktrees. I put both back, and nothing was lost.

### Owner's picks (2026-10-13): Settings, Activity and the ID card
The owner picked from the Home canvas (`docs/design/home/project/`). Each pick combines two boards, so each needs a
merged mockup that the owner approves before a spec. Nothing has been mocked up or built yet.

- **Profile / Settings: S2 (category hub) with the ID-2 passport card in place of S2's header.** Add two fields to the
  passport: the **streak** (as ID-1 shows it, e.g. "12 DAY STREAK") and the **number of buddies** (e.g. "4 BUDDIES").
  The rest of ID-2 stays: KIP photo (tap to change colour), name, handle, home, joined date, badge stamps and the
  decorative code lines. The rest of S2 stays as well: the category rows, and sign out and delete account.
  - Decided: the **check-in streak**.
- **Activity: A-2 (day almanac), plus A-1's month calendar and stats.** Keep A-2's "This week" day rows (recovery, sleep
  and steps, where the moon opens Sleep), its "2026 so far" block and the "Against your usual" patterns. Add A-1's
  pixel month calendar (Month, Year and YTD views, Steps, Sleep and Recovery tabs, the Less–More scale) and its
  month stats line ("October so far · 93,413 steps · 10 active days · 4 at goal · streak 2").
  - Decided: A-1's month stats **sit beside** "2026 so far"; they do not replace it.
  - Open: the order of the sections. Settle this in the mockup.

This settles step 1 of the README's "Next steps". The order is now: KIP spec, Home F spec, then these three, each with
mockup → spec → plan → build.
