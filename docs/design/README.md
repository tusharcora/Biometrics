# Design

Design mockups and the standards that came out of them. Open the HTML files in a browser.

| Folder | What it holds |
|---|---|
| `coach-redesign/` | Coach page layout and answer-style explorations |
| `companions/` | The buddy companion characters |
| `pixel-coaches/` | The pixel coach cast, moods and thinking styles |

## Buttons

Every button in the app is the shadcn/ui Base Button port in `mobile/src/components/ui/button.tsx`. The standard (variants by role, sizes, icon-only labels, loading, ButtonGroup, the 44-pt touch target, Campfire panel buttons, and what is not a button) is in [`mobile/src/components/ui/README.md`](../../mobile/src/components/ui/README.md). `mobile/__tests__/conventions/buttons.test.ts` enforces it.
