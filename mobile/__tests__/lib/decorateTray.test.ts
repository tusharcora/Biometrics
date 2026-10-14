import { initDecorate, decorateReducer } from '../../src/lib/room/decorate';
import { hotspotHitSlop, hotspotPositions, hotspotTargets, HOTSPOT_CELLS, HOTSPOT_MIN_FONT_SCALE, TAG_H, TAG_PAD_X, TAG_W, TOUCH_MIN } from '../../src/lib/room/hotspots';
import { HOTSPOT_LABELS, ROOM_COPY, SLOT_TITLES } from '../../src/lib/room/roomCopy';
import { infoLine, offeredItems, setCards, tilesFor, type TrayContext } from '../../src/lib/room/tray';
import { EMPTY_WORN, STARTER_LOADOUT } from '../../src/lib/room/loadout';
import { ROOM_SLOTS } from '../../src/lib/room/slots';
import '../../src/lib/room/art';

const OWNED = new Set(['wall.plain', 'wall.dots', 'rug.slate', 'rug.red', 'art.calendar']);
const CTX: TrayContext = { owned: OWNED, facts: { levels: { SLEEP_GOAL: 1 }, recapsRead: 2, buddyCheers: 0 } };
const S = initDecorate({ room: STARTER_LOADOUT, worn: EMPTY_WORN });

it('offers only pieces with art, starters first, then owned, then locked', () => {
  const ids = offeredItems('rug', OWNED).map((i) => i.id);
  expect(ids.slice(0, 2)).toEqual(['rug.slate', 'rug.red']);
  expect(ids).toContain('set.cottage.rug');
});

it('labels tiles placed, owned and locked with the unlock line and progress, and badges flags', () => {
  const tiles = tilesFor(S, 'rug', CTX);
  const by = (id: string) => tiles.find((t) => t.itemId === id)!;
  expect([by('rug.slate').state, by('rug.slate').tag, by('rug.slate').label]).toEqual(['placed', 'Placed', 'Slate rug, placed']);
  expect([by('rug.red').state, by('rug.red').label]).toEqual(['owned', 'Red rug, owned. Place it']);
  expect([by('rug.gymmat').state, by('rug.gymmat').tag, by('rug.gymmat').label])
    .toEqual(['locked', 'Step goal · I', 'Gym mat, locked. Step goal, level 1. No level yet']);
  expect(tilesFor(S, 'wallpaper', CTX).find((t) => t.itemId === 'wall.stripes')!.flags).toEqual(['TINT']);
  expect(tiles.every((t) => !t.label.includes('·'))).toBe(true);
});

it('puts a None tile first in a slot that may be empty ("No art" for art)', () => {
  expect(tilesFor(S, 'pet', CTX)[0]).toMatchObject({ itemId: null, name: 'None', state: 'placed' });
  expect(tilesFor(S, 'art', CTX)[0]).toMatchObject({ itemId: null, name: 'No art', state: 'owned' });
  expect(tilesFor(S, 'floor', CTX)[0]!.itemId).not.toBeNull();
});

it('writes the info line as K4b does', () => {
  const placed = decorateReducer(S, { type: 'place', slot: 'wallpaper', itemId: 'wall.dots' });
  expect(infoLine(placed, CTX)).toMatchObject({ label: 'Previewing', text: 'Dots in the wallpaper spot' });
  const again = decorateReducer(S, { type: 'place', slot: 'rug', itemId: 'rug.slate' });
  expect(infoLine(again, CTX)).toMatchObject({ label: 'In your room', text: 'Slate rug is already placed' });
  const locked = decorateReducer(S, { type: 'preview', slot: 'rug', itemId: 'rug.gymmat' });
  expect(infoLine(locked, CTX)).toMatchObject({ label: 'Locked', text: 'Gym mat · Step goal · I', muted: true });
  expect(infoLine({ ...S, tab: 'sets' }, CTX)).toMatchObject({ label: 'Theme sets', text: 'Apply a whole room in one tap, then swap any piece' });
  expect(infoLine(decorateReducer({ ...S, tab: 'sets' }, { type: 'previewSet', setId: 'cottage' }), CTX))
    .toMatchObject({ label: 'Locked', text: 'Cottage · Read 4 weekly recaps' });
  expect(infoLine(again, CTX).spoken).not.toContain('·');
});

it('lists the Cottage card with its count, rule and ownership', () => {
  expect(setCards(CTX)).toEqual([expect.objectContaining({ id: 'cottage', name: 'Cottage', pieces: 13, line: '13 pieces · Read 4 weekly recaps', owned: false })]);
});

it('keeps every hotspot tag inside the visible crop at any phone width, none on top of another', () => {
  for (const width of [320, 343, 375, 390, 430]) {
    const at = hotspotPositions({ width, height: 220 }, 2);
    for (const slot of ROOM_SLOTS) {
      const p = at[slot];
      expect(p.left >= 0 && p.top >= 0 && p.left + TAG_W <= width && p.top + TAG_H <= 220).toBe(true);
    }
    expect(new Set(ROOM_SLOTS.map((s) => `${at[s].left},${at[s].top}`)).size).toBe(12);
  }
  expect(Object.keys(HOTSPOT_CELLS).sort()).toEqual([...ROOM_SLOTS].sort());
});

// Silkscreen-Regular.ttf's advance widths (hmtx / unitsPerEm 1000), for the characters the tag labels may use.
const SILKSCREEN_ADVANCE: Record<string, number> = {
  A: 0.75, B: 0.75, C: 0.75, D: 0.75, E: 0.625, F: 0.625, G: 0.75, H: 0.75, I: 0.375, J: 0.75, K: 0.75, L: 0.625, M: 0.875,
  N: 0.875, O: 0.75, P: 0.75, Q: 0.75, R: 0.75, S: 0.75, T: 0.625, U: 0.75, V: 0.875, W: 0.875, X: 0.875, Y: 0.875, Z: 0.625,
  ' ': 0.5, '+': 0.875,
};
// text-label is 11 px with 1 px letter spacing (tailwind.config.js); the label may shrink to 0.8× and no further.
const LABEL_PX = 11;
const TRACKING_PX = 1;

it('keeps every visible tag label readable inside its tag, and speaks the full slot name', () => {
  const inner = TAG_W - 2 * TAG_PAD_X;
  for (const slot of ROOM_SLOTS) {
    const label = ROOM_COPY.hotspot(slot);
    expect(label).toBe(HOTSPOT_LABELS[slot]);
    // Worst case: the tracking does not shrink with the glyphs.
    const width = [...label].reduce((w, c) => w + SILKSCREEN_ADVANCE[c]! * LABEL_PX * HOTSPOT_MIN_FONT_SCALE + TRACKING_PX, 0);
    expect(width <= inner ? null : `${label} is ${width.toFixed(1)} pt in ${inner}`).toBeNull();
    expect(ROOM_COPY.hotspotLabel(slot)).toBe(`Decorate the ${SLOT_TITLES[slot].toLowerCase()}`);
  }
  expect(HOTSPOT_MIN_FONT_SCALE).toBe(0.8);
});

it('gives every hotspot tag a touch target at least 44 pt tall inside the room, none overlapping another', () => {
  for (const width of [320, 343, 375, 390, 430]) {
    const crop = { width, height: 220 };
    const at = hotspotPositions(crop, 2);
    const targets = hotspotTargets(crop, 2);
    for (const slot of ROOM_SLOTS) {
      const t = targets[slot];
      const slop = hotspotHitSlop(at[slot].top, crop.height);
      expect([t.height, t.width]).toEqual([TOUCH_MIN, TAG_W]);
      expect(TAG_H + slop.top + slop.bottom).toBe(TOUCH_MIN);
      expect([t.top, t.left]).toEqual([at[slot].top - slop.top, at[slot].left]);
      expect(t.top >= 0 && t.top + t.height <= 220).toBe(true);
    }
    for (const a of ROOM_SLOTS) {
      for (const b of ROOM_SLOTS) {
        if (a >= b) continue;
        const [p, q] = [targets[a], targets[b]];
        const overlap = p.left < q.left + q.width && q.left < p.left + p.width && p.top < q.top + q.height && q.top < p.top + p.height;
        expect(overlap ? `${width}: ${a} overlaps ${b}` : null).toBeNull();
      }
    }
  }
  expect(TOUCH_MIN).toBeGreaterThanOrEqual(44);
});
