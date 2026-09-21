# Orb (vendored)

`ThinkingOrb.tsx`, `theme.ts` and `types.ts` are copied unmodified from
`thinking-orbs-native` (the React Native port inside the `thinking-orbs`
repository, https://github.com/Jakubantalik/thinking-orbs) at commit
`de85557ca220332586d070d8788c0e1d6e877a0d`, MIT licensed
(see `LICENSE.thinking-orbs`). The port is not published to npm, and its
own README says it had not been runtime-verified on a device when copied.
Geometry comes from the npm package `thinking-orbs/engine`.

Use `Orb.tsx` (the app wrapper), not `ThinkingOrb` directly.

## Local changes

None yet.

## Device verification

Checked on 2026-09-21 on an iOS 27.0 simulator (iPhone 18 Pro, Xcode 27.0,
Expo SDK 57, RN 0.86.3, `@shopify/react-native-skia` 2.6.2), with the gallery
(`EXPO_PUBLIC_ORB_GALLERY=1`). The environment could only drive the simulator
from the command line (`xcrun simctl`, no tap injection), so some items were
checked indirectly; each says how.

1. Builds and launches on the current SDK: **pass.** `expo run:ios` could not
   target the simulator (it treated the iOS 27 simulator as a physical device
   and failed with "No code signing certificates"), so the app was built with
   `xcodebuild -destination id=<simulator> CODE_SIGNING_ALLOWED=NO`, installed
   with `simctl install`, and served by `expo start`. Skia compiled and the
   app launched with no crash.
2. All 18 orbs render, none blank: **pass** (dark and light screenshots, all
   9 states at 64 and 20).
3. Each animates, and the nine states look distinct: **pass** for animation
   (screenshots a few seconds apart differ for every orb) and for the states
   being visually distinct. Smoothness (frame rate) was not measured; it was
   not judged from stills.
4. Theme flips the ink: **pass, indirectly.** The Theme button could not be
   tapped, so the initial theme was temporarily set to light: dark dots on a
   light background, light dots on a dark background. The toggle handler itself
   is covered by the jest test.
5. Pause freezes, Resume continues: **partly verified.** With the gallery
   starting paused, two screenshots four seconds apart were byte-identical and
   the button read "Resume", so paused orbs are frozen. The tap on Pause/Resume
   was not driven, so playing-to-paused and resume were not verified.
6. Reduce Motion shows a static frame: **pass, indirectly.** Enabled with
   `simctl spawn booted defaults write com.apple.Accessibility
   ReduceMotionEnabled -bool true` (not through Settings). The app logged
   Reanimated's "Reduced motion setting is enabled" warning, so it saw the
   setting, and screenshots three seconds apart were byte-identical. With the
   setting off, they differed.
7. Backgrounding and returning: **pass.** Opened Settings over the app and
   brought the app back: same process id, no crash, orbs animating again.

Not verified: real-device behaviour, Android, frame rate or battery cost.
