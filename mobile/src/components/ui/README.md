# Buttons

`button.tsx` is the app's one button. It is shadcn/ui's Base Button ([docs](https://ui.shadcn.com/docs/components/base/button), the base-vega style) ported to React Native and NativeWind: the same variants, sizes and classes, with hover replaced by the pressed state.

Every button uses it. Do not hand-roll a button from `Pressable`, `PressableScale`, `TouchableOpacity` or `Text`. `__tests__/conventions/buttons.test.ts` fails if a file under `src` gives one of those the `button` role. A scene colour, like the indigo of Say goodnight, goes on the standard Button through `className`, `style` or `textClassName`. It never justifies a bespoke component.

```tsx
import { Button } from '../components/ui/button';

<Button onPress={save}>Save</Button>
<Button variant="outline" onPress={cancel}>Cancel</Button>
```

## Variants: pick by role, not by look

| Role | Variant | Looks like |
|---|---|---|
| The main action on a screen, card or sheet | `default` | Neutral fill: near-black on light, white on dark |
| A secondary action beside the main one | `outline` | Hairline border on the card colour |
| A lone utility action (Retry, Try again, See more) | `secondary` | Soft grey fill |
| A utility action in dense UI, toolbars, headers | `ghost` | No fill until pressed |
| Delete, remove, unpair, block | `destructive` | Red text on a red tint |
| Inline navigation text (See all, Open Settings, Why this score) | `link` | Underlined text, no height or side padding |

Teal is not a button colour. It stays for accents. Set `accessibilityRole="link"` on a `link` that navigates; the default role is `button`.

## Sizes

| Size | Height | Use |
|---|---|---|
| `xs` | 24 | Chips and tiny inline actions |
| `sm` | 32 | Card actions, links next to titles |
| `default` | 36 | Most buttons |
| `lg` | 40 | Full-width CTAs: `size="lg" className="w-full"` |
| `icon-xs` / `icon-sm` / `icon` / `icon-lg` | 24 / 32 / 36 / 40, square | Icon-only buttons |

All sizes are `rounded-lg` (8 px). Use `rounded-full` through `className` only where a pill is meant: chips, a pill floating over a scene, the Chats FAB.

Do not fight the size. Drop `py-*`, `h-*`, `min-h-[44px]`, `px-0` and a second `opacity-*`. Keep layout classes such as `flex-1`, `w-full`, `self-*` and margins.

**Icon-only buttons need an `accessibilityLabel`.** The types require it for every `icon*` size. Use `ghost` in toolbars and headers, `outline` when the button stands alone.

```tsx
<Button size="icon-sm" variant="ghost" accessibilityLabel="Next month" onPress={next}>
  <Ionicons name="chevron-forward" size={buttonIconSize('icon-sm')} color={colors.foreground} />
</Button>
```

## Icons, loading and labels

- **`iconStart` / `iconEnd`**: an icon before or after the label. This is shadcn's `data-icon="inline-start|end"`, so the icon side gets the tighter padding. Size icons with `buttonIconSize(size)`: 12 px on the xs sizes, 16 px elsewhere.
- **`loading`**: shows a spinner in the icon-start slot, disables the button and marks it busy. The spinner takes the label colour, including a colour from `textClassName`; pass `spinnerColor` when a `style` override sets the colour.
- **`disabled`**: dims to 50% and sets `accessibilityState.disabled`. Do not add your own opacity. Where a busy control must stay readable, such as the sync status line, override it with `className="opacity-100"`.
- **Labels**: a string child becomes a `Text` with the variant's label classes. `textClassName` adds to it and `labelTestID` tags it. Any other child renders as-is.
- Everything else (`testID`, `onPress`, `style`, `hitSlop`, other `Pressable` props) passes through. `className` is merged last, so it wins.

## Touch target

Every button stays at its exact shadcn size and gets an invisible `hitSlop` that grows the tappable area to at least 44 × 44 pt (`hitSlopFor`). It uses the measured layout once there is one. A `hitSlop` prop overrides it. So never pad a button to make it tappable.

## ButtonGroup

A row of joined buttons: inner corners go square and borders overlap by 1 px, so `outline` buttons share one hairline. Pass `separator` to draw a 1-px line between filled variants, which have no border to share.

```tsx
<ButtonGroup>
  <Button variant="outline" size="sm">Day</Button>
  <Button variant="outline" size="sm">Week</Button>
</ButtonGroup>

<ButtonGroup separator>
  <Button variant="secondary" size="sm">Copy</Button>
  <Button variant="secondary" size="icon-sm" accessibilityLabel="More">…</Button>
</ButtonGroup>
```

For a choice between options, use `segmented-control`, not a ButtonGroup.

## Buttons in the Campfire panel

`CampPanel` forces the dark tokens, but `dark:` classes follow the app's scheme, so in a light app an `outline` or `destructive` Button would take its light look on the dark panel. On the panel:

- `secondary`, `default` and `ghost` need nothing. They use tokens only.
- For `outline`, add `PANEL_OUTLINE` to `className`. For `destructive`, add `PANEL_DESTRUCTIVE`. Both come from `components/social/CampPanel`.

```tsx
<Button variant="outline" size="xs" className={`rounded-full ${PANEL_OUTLINE}`}>{chip}</Button>
```

Over the scene itself (outside the panel), a floating pill keeps its dark-glass `style` on a `secondary` Button, like the back pill.

## What is not a Button

These stay as `Pressable` / `PressableScale` and are listed in the guard test's allowlist, each with a reason:

- List and settings rows (`settings-list`, BuddyListRow, the command menu)
- Cards and tiles that navigate (home tiles, recap cards, metric cards, the camp banner)
- Tabs (the tab bar, page tabs) and the segmented control
- Toggle and selection chips (habit type, check-in days)
- Story rings and avatars, Campfire coach seats
- Backdrops, tap zones and handles (the sheet backdrop, story prev/next zones)

One documented custom exception: ScoreDetailScreen's Ask Coach, a GlassSurface CTA with the coach character.

If you add another, it must not be a button in the design sense. Add it to the allowlist with a one-line reason.
