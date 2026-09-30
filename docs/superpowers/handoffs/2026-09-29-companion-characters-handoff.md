# Handoff: selectable companion characters

You are picking up a feature that has been designed and approved but not built. Read this whole
file before touching code. The design decisions are settled — your job is to (1) review the spec
for gaps, (2) write the implementation plan, and (3) implement it in phases.

## TL;DR

Replace the Biometrics app's AI "orb" with one of **eight selectable animated characters** —
Hoot (default), Pip, Mochi, Nimbus, Ember, Beep, Doze, Beat. Each has its own voice, coaching
focus and on-screen moods (idle / thinking / answering / resting). Characters replace the old
Direct / Encouraging / Clinical "Coach style" setting. Rendering is **Skia driven by Reanimated**.

- **Spec (source of truth):** `docs/superpowers/specs/2026-09-29-companion-characters-design.md`
- **Visual reference:** `docs/design/companions/Buddy<Name>.dc.html` — open in a browser; each shows
  the character large, its tab-bar mini version, and all four moods animating.
  Also on the design canvas (owner's account): https://claude.ai/artifact/DCn88XbzNo1zAtdPv73cUF,
  section "AI assistant — companions".
- **Branch:** `feature/companion-characters` (pushed). It is stacked on
  `worktree-redesign-tokens-home`, which is open as PR #39
  (https://github.com/tusharcora/Biometrics/pull/39). Open your work as a **separate draft PR
  targeting `worktree-redesign-tokens-home`**, not `main`.

## Status

| Step | State |
|---|---|
| Brainstorm + decisions | ✅ done, approved by the owner |
| Written spec | ✅ committed — **owner has not yet signed off on the written file** |
| Implementation plan | ⬜ not started (save to `docs/superpowers/plans/2026-09-29-companion-characters.md`) |
| Code | ⬜ nothing written |

## What to do

1. **Review the spec.** Check it against the code (paths below). Flag anything wrong or ambiguous
   — e.g. names in `schema.prisma`, how `CoachScreen` tracks `sending`, where Dashboard scores are
   fetched. Do not re-open settled decisions (table below) unless the code makes one impossible;
   if so, raise it with the owner rather than changing it silently.
2. **Write the implementation plan** following the spec's §8 phases, with bite-sized TDD steps,
   exact file paths and test commands. Get the owner's approval before coding.
3. **Implement phase by phase.** Each phase ends with its tests green and a commit. Build Hoot
   first (phase 2) and check smoothness on the simulator before doing the other seven.

## Settled decisions (do not re-litigate)

| Topic | Decision |
|---|---|
| Characters | Hoot, Pip, Mochi, Nimbus, Ember, Beep, Doze, Beat. **Not** Luna or Twinkle. |
| Default | Hoot (new users, signed-out screens, users who never chose a style) |
| Personality | Voice + coaching focus + visual mood reactions. Same data, facts and safety rules for all. |
| Coach style | Replaced by the character. Legacy ids map `encouraging→pip`, `direct→hoot`, `clinical→beep`. |
| Placement | Replaces the orb almost everywhere, incl. auth/signed-out screens (show Hoot). |
| Tab bar | Character **always animates idle** on every tab, full brightness (dimmed only if coach unavailable). The owner asked for this explicitly. |
| Picker | "Meet your coach" pager on first Coach-tab visit (skip = Hoot) + "Your coach" row in Profile. |
| Rendering | Skia + Reanimated (chosen for smoothness). Not react-native-svg, not Lottie/Rive. |
| Delivery | Separate draft PR stacked on #39, six phases (spec §8). |

## Codebase map (verified 2026-09-29)

`M` = `mobile/src`, `B` = `backend`.

**Orb (to be replaced)**
- `M/components/orb/Orb.tsx` (wrapper; props `state,size,paused,dimmed,label,testID,theme`),
  `M/components/orb/ThinkingOrb.tsx` (vendored Skia orb), `M/components/ui/still-orb.tsx`.
- Call sites: `M/navigation/FloatingTabBar.tsx:135` (hub; state from `M/lib/hubOrb.ts` +
  `M/lib/useCoachStatus.ts`), `M/screens/CoachScreen.tsx` (StillOrb ~328/367/382/450, Orb 417,
  thinking indicator `Orb state="working" size={20}` in `ThoughtLine` ~483 driven by `sending`),
  `M/components/home/coach-tile.tsx`, `DashboardScreen.tsx:~170`, `coach-digest-card.tsx`,
  `onboarding-hero.tsx`, and SignUp, ForgotPassword, ResetPassword, ConnectHealth, CoachConsent,
  CoachMemory, ScoreDetail screens. Grep `Orb\b|StillOrb` to find them all.
- Dev gallery: `M/screens/dev/OrbGalleryScreen.tsx`, flag `EXPO_PUBLIC_ORB_GALLERY` (`mobile/App.tsx:36`).

**Coach / personas (backend)**
- Personas: `B/src/coach/personas/v1.ts` (ids `direct`, `encouraging`, `clinical`; tone text,
  `REQUIRED_DISALLOWED_TOPICS`), `B/src/coach/personas/index.ts` (`PERSONA_SETS`,
  `LIVE_PERSONA_VERSION`, `findPersona`, `resolvePersona`). Rule in that file: **add a new version
  file, never edit an old one.**
- Prompt: `B/src/coach/prompt.ts` — `buildSystemPrompt(persona, ctx)` (~73), persona lines ~101–104,
  every field goes through `escapeField()` (~18); `buildDigestSystemPrompt` (~161).
- Routes: `B/src/coach/routes.ts` — status (~70), `PUT /me/coach/persona` (~117, currently behind
  `requireEnabled`; the spec removes that for this route only).
- Storage: `B/prisma/schema.prisma` `model User` → `coachPersonaId String?`. Migrations in
  `B/prisma/migrations/` (timestamped folders; latest `20260928120000_normalize_user_email`).
- Provider: local Ollama only (`B/src/coach/model/ollama.ts`); coach gated by `COACH_ENABLED`.

**Mobile coach + settings**
- API: `M/api/coach.ts` (`CoachStatusDTO`, `setCoachPersona`, `sendCoachMessage`).
- Current picker to replace: `M/components/coach-settings-section.tsx` (optimistic update pattern
  to reuse), rendered from `M/screens/SettingsScreen.tsx:~178`. Settings UI kit:
  `M/components/ui/settings-list.tsx` (`SettingsGroup`, `SettingsRow`).
- Device storage is expo-secure-store only (see `M/theme/preference.ts` for the pattern).
- Recovery band for the resting mood: `scoreBand()` in `M/lib/scoreInsights.ts:~45`; scores via
  `fetchScoresWithBands` in `M/api/scores.ts`.
- Navigation: `M/navigation/RootNavigator.tsx`, `TabsNavigator.tsx` (Coach is the hub tab),
  `AuthNavigator.tsx`.

**Libraries:** Expo ~57, RN 0.86 (New Architecture), `@shopify/react-native-skia` 2.6.2,
`react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, NativeWind 4. No Lottie/Rive.

## Porting the mockups to Skia

- Mockups draw in a **100×100 viewBox**; keep that coordinate space in each Skia canvas and scale
  with a `Group` transform, so path strings copy over unchanged.
- CSS keyframes → Reanimated: `withRepeat(withSequence(withTiming(..., {easing})))` on shared
  values, fed to Skia via `useDerivedValue` transforms/opacity. Never drive per-frame animation
  through React state (the old orb did; don't copy that).
- `transform-origin` pivots in the CSS (e.g. arms at the shoulder) become
  `origin={vec(x, y)}` on the Skia `Group`.
- **Ember** morphs three flame paths (outer/mid/core, separate rhythms). Path strings with matching
  commands are in `BuddyEmber.dc.html` (`<animate attributeName="d" values=...>`); use
  `usePathInterpolation` or interpolate the numbers in a worklet.
- **Hoot thinking** = 180° head swivel: front face slides/narrows, cross-fades to a side profile
  near 90°, then to the back-of-head near 180°, eased, hold, return; then the same leftward. The
  mockup computes these keyframes in CSS (`ho-sw-front/back/right/left`) — reproduce with one
  eased angle shared value and derived opacities/translations. Face is clipped to the head ellipse.
- **Doze** is now a sheep (the old nightcap bean is gone). **Pip** has Kirby-style stub arms drawn
  in front of the body.
- Mood changes cross-fade ~250 ms. Reduce Motion → hold the mood's still pose.
- In Jest, mock Skia the way `mobile/jest-mocks/ThinkingOrb.js` does today: render a View with
  `accessibilityLabel="character:<id>:<mood>:<size>:<paused>"`.

## Running things

- **Node:** use `~/.nvm/versions/node/v24.21.0/bin` (prepend to PATH).
- **Mobile tests:** `cd mobile && npm test` (jest-expo). At handoff: 102 suites / 971 tests passing
  on the redesign branch.
- **Backend tests:** `cd backend && npm test` — needs the test Postgres from
  `docker-compose.test.yml` (port 5434), `maxWorkers: 1`.
- **Coach evals (optional, needs local Ollama):** `cd backend && npm run eval:coach`.
- **iOS simulator build — important:** the repo lives in iCloud Documents, which breaks Xcode
  builds in place. Build from a copy outside iCloud: rsync `mobile/` (excluding `node_modules`,
  `ios`, `.expo`) to `~/dev/biometrics-redesign-build/mobile`, copy `.env`, then
  `npm ci` → `CI=1 npx expo prebuild -p ios --no-install` → `pod install` →
  `xcodebuild -workspace mobile.xcworkspace -scheme mobile -configuration Debug -sdk iphonesimulator
  -destination "id=<booted sim UDID>" -derivedDataPath build CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual
  DEVELOPMENT_TEAM= build` → `xcrun simctl install <UDID> build/Build/Products/Debug-iphonesimulator/mobile.app`.
  Then run Metro from the worktree: `npx expo start --dev-client --port 8081`.
  The simulator used so far is "DeviceHub".
- **Dev sign-in:** the redesign branch has a one-tap dev sign-in for the demo account on the sign-in
  screen (dev builds only).

## House rules

- **No AI attribution** anywhere: no `Co-Authored-By` trailers, no "Generated with Claude Code"
  footers in commits or PR bodies. This is the owner's standing preference.
- Tokens are mirrored across `mobile/global.css`, `mobile/src/theme.ts` and
  `mobile/tailwind.config.js`, checked by `mobile/__tests__/theme/tokens.test.ts` — add new
  colours in all three.
- Every screen supports light and dark mode; characters must read well on both.
- Don't push to `main`, don't force-push, don't merge PR #39.
- Match the surrounding code style; the redesign uses `Text` weight classes mapped to Geist /
  Instrument Serif fonts and `cn()` from `M/lib/utils`.

## Definition of done

- All eight characters render and animate all four moods on device at a steady 60 fps (check the
  perf monitor on the gallery and Coach screens).
- Orb and `thinking-orbs` fully removed; no dangling imports.
- Picker flow works: first-visit auto-open, skip → Hoot, switching from Profile, persisted server-side.
- Coach replies clearly differ in voice/focus per character (spot-check with the local model if
  available), with safety rules unchanged.
- Backend + mobile test suites green; new tests per spec §7.
- README updated; simulator screenshots of each character; draft PR open against
  `worktree-redesign-tokens-home` with a summary of phases.
