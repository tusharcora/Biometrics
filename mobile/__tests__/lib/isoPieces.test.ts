import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import { CATALOGUE, isoOf, type CatalogueItem } from '../../src/lib/room/catalogue';
import { boundsOf } from '../../src/lib/room/grid';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { clearPieceCache, isoArtOf, PIECE_CACHE_SIZE, pieceCacheSize, pieceLayers, type IsoArtOpts } from '../../src/lib/room/iso/art';
import { footOf, type PlacementLayer } from '../../src/lib/room/iso/geometry';
import { HH, HT, LOCAL, WALL_H } from '../../src/lib/room/iso/grid';
import { deskWood, DESK_H } from '../../src/lib/room/iso/pieces/desks';
import { GARLAND_OFF, LANTERN_BASE, PLANK_DEPTH, PLANK_TOP } from '../../src/lib/room/iso/pieces/extras';
import { moveRects, opaqueBounds } from '../../src/lib/room/iso/prims';
import type { RoomRect } from '../../src/lib/room/grid';
import '../../src/lib/room/iso';

const LIME = { ...CTX_DAY, colour: 'lime' as const, ramp: kipRamp(KIP_COLOURS.lime) };
const PLACEABLE = CATALOGUE.items.filter((i) => i.iso);
const layersOf = (item: CatalogueItem): PlacementLayer[] =>
  item.iso!.layers.flatMap((l) => (l === 'wall' ? (['wallL', 'wallR'] as const) : ([l] as const)));
const opts = (item: CatalogueItem, over: Partial<IsoArtOpts> = {}): IsoArtOpts => ({ layer: layersOf(item)[0]!, facing: 'L', mirror: false, ...over });

beforeEach(() => clearPieceCache());

it('every shipped placeable piece has iso art, 64 in all: 54 of release 1, 2 of release 3, 6 shop pieces and 2 of release 5 (spec §4)', () => {
  expect(PLACEABLE).toHaveLength(64);
  for (const item of PLACEABLE) expect({ id: item.id, art: !!isoArtOf(item.id) }).toEqual({ id: item.id, art: true });
});

it('draws each declared facing on every layer it allows, day and night: whole cells, flags kept, deterministic', () => {
  for (const item of PLACEABLE) {
    for (const layer of layersOf(item)) {
      for (const facing of item.iso!.facings === 2 ? (['L', 'R'] as const) : (['L'] as const)) {
        for (const ctx of [CTX_DAY, CTX_NIGHT]) {
          const tag = { id: item.id, layer, facing, night: ctx.night };
          const l = pieceLayers(item.id, ctx, { layer, facing, mirror: false })!;
          expect({ ...tag, base: l.base!.length > 0 }).toEqual({ ...tag, base: true });
          expect({ ...tag, whole: l.base!.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger)) }).toEqual({ ...tag, whole: true });
          expect({ ...tag, glow: (l.emissive?.length ?? 0) > 0 }).toEqual({ ...tag, glow: !!item.emissive });
          expect({ ...tag, frames: l.frames?.length ?? 0 }).toEqual({ ...tag, frames: item.frames ? 3 : 0 });
          clearPieceCache();
          expect(pieceLayers(item.id, ctx, { layer, facing, mirror: false })).toEqual(l);
        }
      }
    }
  }
});

it('Flip changes the picture, never the footprint (spec §3.5)', () => {
  // The footprint can't change: footOf takes no mirror. The picture must.
  for (const id of ['desk.monitor', 'set.cottage.desk', 'plant.cactus', 'item.mug', 'lamp.amber', 'lamp.welcome', 'rug.gymmat']) {
    const item = CATALOGUE.items.find((i) => i.id === id)!;
    const a = JSON.stringify(pieceLayers(id, CTX_DAY, opts(item)));
    const b = JSON.stringify(pieceLayers(id, CTX_DAY, opts(item, { mirror: true })));
    expect({ id, differs: a !== b }).toEqual({ id, differs: true });
  }
  expect(footOf({ x: 1, y: 2, facing: 'R' }, isoOf('desk.monitor')!)).toEqual({ x0: 1, y0: 2, x1: 3, y1: 5 });
});

it('a turned piece is its own drawing, not the L one mirrored (spec §3.5)', () => {
  // Flat pieces (rugs) are left out: a flat patch has no lit side, so its R drawing is exactly L's screen mirror.
  const turned = PLACEABLE.filter((i) => i.iso!.facings === 2 && !i.iso!.flat);
  expect(turned.map((i) => i.id).sort()).toEqual(['desk.laptop', 'desk.monitor', 'desk.notebook', 'lamp.welcome', 'set.cottage.desk']);
  for (const item of turned) {
    const L = pieceLayers(item.id, CTX_DAY, opts(item))!;
    const R = pieceLayers(item.id, CTX_DAY, opts(item, { facing: 'R' }))!;
    const mirroredL = L.base!.map(([x, y, w, h, c]) => `${-x - w},${y},${w},${h},${c}`).sort().join('|');
    const r = R.base!.map(([x, y, w, h, c]) => `${x},${y},${w},${h},${c}`).sort().join('|');
    expect({ id: item.id, own: JSON.stringify(L) !== JSON.stringify(R) && r !== mirroredL }).toEqual({ id: item.id, own: true });
  }
});

it('tinted pieces follow KIP\'s colour; the others never do', () => {
  for (const item of PLACEABLE) {
    const o = opts(item);
    const follows = JSON.stringify(pieceLayers(item.id, CTX_DAY, o)) !== JSON.stringify(pieceLayers(item.id, LIME, o));
    // A desk's screen takes KIP's colour only in its dots (Spec A), not in the idle lines drawn here.
    expect({ id: item.id, follows }).toEqual({ id: item.id, follows: !!item.tint });
  }
});

it('each art piece fits the wall size the catalogue gives it (ruling 4)', () => {
  for (const item of CATALOGUE.items.filter((i) => i.slot === 'art')) {
    const b = boundsOf(itemArt(item.id)!.draw(CTX_DAY).base!)!;
    const [along, high] = item.iso!.wall!;
    expect({ id: item.id, fits: b.w <= along * 6 && b.h <= high * 4 }).toEqual({ id: item.id, fits: true });
  }
});

it('only items with an iso block get piece art: styles, worn items and unknown ids never do (ledger: slot guards)', () => {
  for (const id of ['wall.plain', 'floor.oakDark', 'win.plain', 'out.beanie', 'no.such']) expect({ id, art: isoArtOf(id) }).toEqual({ id, art: undefined });
  expect(isoOf('no.such')).toBeUndefined();
});

it('keeps at most 200 piece pictures, and a repeat is a cache hit (ruling 8)', () => {
  for (const item of PLACEABLE) for (const mirror of [false, true]) for (const ctx of [CTX_DAY, CTX_NIGHT]) pieceLayers(item.id, ctx, opts(item, { mirror }));
  expect(pieceCacheSize()).toBe(PIECE_CACHE_SIZE);
  const item = PLACEABLE[0]!;
  expect(pieceLayers(item.id, CTX_DAY, opts(item))).toBe(pieceLayers(item.id, CTX_DAY, opts(item)));
});

it('the new pieces have drawer icons, and the Cottage garland\'s icon shows lit bulbs (Spec B Task 11)', () => {
  for (const id of ['shelf.plank', 'lamp.welcome']) expect((itemIcon(id)?.length ?? 0) > 0).toBe(true);
  expect(itemIcon('set.cottage.lamp')!.some(([, , , , c]) => c === '#FDE68A')).toBe(true);
});

type Pt = readonly [number, number];
/** The convex hull of some points (monotone chain), counter-clockwise on screen. */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    return h.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}
/** How far a point lies outside a convex polygon (0 inside). */
function outside(poly: Pt[], [x, y]: Pt): number {
  let inside = true;
  let best = Infinity;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]!, b = poly[(k + 1) % poly.length]!;
    const ex = b[0] - a[0], ey = b[1] - a[1];
    if (ex * (y - a[1]) - ey * (x - a[0]) < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey)));
    best = Math.min(best, Math.hypot(x - a[0] - t * ex, y - a[1] - t * ey));
  }
  return inside ? 0 : best;
}
/** The screen outline of a box i0..i1 × j0..j1 × z0..z1 in piece space. */
const prism = ([i0, i1]: Pt, [j0, j1]: Pt, [z0, z1]: Pt): Pt[] =>
  hull([i0, i1].flatMap((i) => [j0, j1].flatMap((j) => [z0, z1].map((z) => LOCAL(i, j, z)))));
/** The worst overhang (cells) of any rect past a region: a rect is inside a convex region when its corner cells are. */
const overhang = (region: Pt[], rects: readonly RoomRect[]) =>
  Math.max(0, ...rects.flatMap(([x, y, w, h]) => ([[x + 0.5, y + 0.5], [x + w - 0.5, y + 0.5], [x + 0.5, y + h - 0.5], [x + w - 0.5, y + h - 0.5]] as Pt[]).map((c) => outside(region, c))));
/** Wall pieces that stand out of the wall plane, in tiles: the plank is a box, the garland's wire hangs off it. */
const WALL_DEPTH: Readonly<Record<string, number>> = { 'shelf.plank': PLANK_DEPTH, 'shelf.awards': PLANK_DEPTH, 'set.cottage.lamp': GARLAND_OFF };

it('every piece stays inside its footprint or wall span, each layer, facing and Flip, day and night (T7-TESTS)', () => {
  // Measured: the piece's own rects and loop frames. Glows (emissive) are light thrown into the room, not the piece.
  // Margins, in cells:
  // - floor: the footprint's prism up to WALL_H (nothing on the floor is taller than the walls; the Cottage stove is
  //   the tallest at 59), plus 2 for the contact shadow skirt: isoShadow's ellipse is 1.1 × the footprint's
  //   half-diagonal (rx = (di + dj)·12·0.55), so it overhangs a corner by up to 2.4 cells, measured 1.5 at the desk;
  // - flat (rugs): the footprint at z 0, plus 1 for the 2:1 stair rounding of its edges;
  // - wall: its span (half tiles along × 4-cell steps up) out to WALL_DEPTH, plus 1 for the stair rounding;
  // - onTop: no footprint of its own; it stays within a tile (HT) either side of its spot, so it never reaches past
  //   the next spot (spots are a tile apart on the desk and the plank), from WALL_H above it down to a 2-cell shadow.
  for (const item of PLACEABLE) {
    const iso = item.iso!;
    for (const layer of layersOf(item)) {
      for (const facing of iso.facings === 2 ? (['L', 'R'] as const) : (['L'] as const)) {
        for (const mirror of [false, true]) {
          for (const ctx of [CTX_DAY, CTX_NIGHT]) {
            const l = pieceLayers(item.id, ctx, { layer, facing, mirror })!;
            const rects = [...l.base!, ...(l.frames ?? []).flat()];
            const tag = { id: item.id, layer, facing, mirror, night: ctx.night };
            if (layer === 'onTop') {
              const fits = rects.every(([x, y, w, h]) => x >= -HT && x + w <= HT && y >= -WALL_H && y + h <= 2);
              expect({ ...tag, fits }).toEqual({ ...tag, fits: true });
              continue;
            }
            let region: Pt[];
            let margin: number;
            if (layer === 'floor') {
              const [w, d] = facing === 'R' ? [iso.foot![1], iso.foot![0]] : iso.foot!;
              region = prism([0, w], [0, d], [0, iso.flat ? 0 : WALL_H]);
              margin = iso.flat ? 1 : 2;
            } else {
              const along = iso.wall![0] / 2;
              const out = WALL_DEPTH[item.id] ?? 0;
              const up = iso.wall![1] * 4;
              region = layer === 'wallR' ? prism([0, along], [0, out], [0, up]) : prism([0, out], [0, along], [0, up]);
              margin = 1;
            }
            const over = overhang(region, rects);
            expect({ ...tag, inside: over <= margin }).toEqual({ ...tag, inside: true });
          }
        }
      }
    }
  }
});

it('a piece on a desk or plank spot stands on that spot\'s projection, on the surface\'s top (T7-TESTS)', () => {
  // The engine anchors an onTop piece at the rounded projection of its spot (Task 8's spotPoint: Flip mirrors a floor
  // parent's spots across its width, facing R swaps the axes; a wall parent's spot runs along its wall). Each piece
  // stands with its opaque bottom centre on its anchor, and the parent's top colour lies under that point. The welcome
  // lantern is a real box: its base's centre is on the anchor, so its front corner hangs 2·LANTERN_BASE·HH lower.
  const drop = (id: string) => (id === 'lamp.welcome' ? Math.floor(2 * LANTERN_BASE * HH) : 0);
  const ON_TOP = PLACEABLE.filter((i) => i.iso!.layers.includes('onTop'));
  const parents: Array<{ id: string; layer: PlacementLayer; facing: 'L' | 'R'; mirror: boolean; top: string; pt: (s: readonly [number, number], z: number) => [number, number] }> = [];
  for (const desk of PLACEABLE.filter((i) => i.iso!.kipDesk)) {
    const [w] = desk.iso!.foot!;
    for (const facing of ['L', 'R'] as const) for (const mirror of [false, true]) {
      parents.push({
        id: desk.id, layer: 'floor', facing, mirror, top: deskWood(desk.id).top,
        pt: ([si, sj], z) => { const a = mirror ? w - si : si; return facing === 'R' ? LOCAL(sj, a, z) : LOCAL(a, sj, z); },
      });
    }
  }
  for (const layer of ['wallL', 'wallR'] as const) for (const mirror of [false, true]) {
    parents.push({ id: 'shelf.plank', layer, facing: 'L', mirror, top: PLANK_TOP, pt: ([si, sj], z) => (layer === 'wallR' ? LOCAL(si, sj, z) : LOCAL(sj, si, z)) });
  }
  expect(parents.filter((p) => p.id === 'shelf.plank')).toHaveLength(4);
  expect(isoOf('desk.monitor')!.surface).toEqual({ z: DESK_H, spots: [[0.45, 0.55], [1.5, 0.6], [2.55, 0.55]] });
  for (const parent of parents) {
    const surface = isoOf(parent.id)!.surface!;
    const art = pieceLayers(parent.id, CTX_DAY, { layer: parent.layer, facing: parent.facing, mirror: parent.mirror })!.base!;
    surface.spots.forEach((spot, k) => {
      const [sx, sy] = parent.pt(spot, surface.z).map(Math.round) as [number, number];
      const tag = { parent: parent.id, layer: parent.layer, facing: parent.facing, mirror: parent.mirror, spot: k };
      // The surface's top is drawn under the spot.
      const onTop = art.some(([x, y, w, h, c]) => c === parent.top && x <= sx && sx < x + w && y <= sy && sy < y + h);
      expect({ ...tag, onTop }).toEqual({ ...tag, onTop: true });
      for (const item of ON_TOP) {
        for (const mirror of [false, true]) {
          const placed = moveRects(pieceLayers(item.id, CTX_DAY, { layer: 'onTop', facing: 'L', mirror })!.base!, sx, sy);
          const b = opaqueBounds(placed)!;
          // An odd-width sprite's centre is half a cell off any cell line: within half a cell, then.
          const at = { ...tag, item: item.id, mirror, centred: Math.abs(b.x + b.w / 2 - sx) <= 0.5, bottom: b.y + b.h };
          expect(at).toEqual({ ...at, centred: true, bottom: sy + drop(item.id) });
        }
      }
    });
  }
});
