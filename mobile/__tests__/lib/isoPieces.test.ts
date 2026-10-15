import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import { CATALOGUE, isoOf, type CatalogueItem } from '../../src/lib/room/catalogue';
import { boundsOf } from '../../src/lib/room/grid';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { clearPieceCache, isoArtOf, PIECE_CACHE_SIZE, pieceCacheSize, pieceLayers, type IsoArtOpts } from '../../src/lib/room/iso/art';
import { footOf, type PlacementLayer } from '../../src/lib/room/iso/geometry';
import '../../src/lib/room/iso';

const LIME = { ...CTX_DAY, colour: 'lime' as const, ramp: kipRamp(KIP_COLOURS.lime) };
const PLACEABLE = CATALOGUE.items.filter((i) => i.iso);
const layersOf = (item: CatalogueItem): PlacementLayer[] =>
  item.iso!.layers.flatMap((l) => (l === 'wall' ? (['wallL', 'wallR'] as const) : ([l] as const)));
const opts = (item: CatalogueItem, over: Partial<IsoArtOpts> = {}): IsoArtOpts => ({ layer: layersOf(item)[0]!, facing: 'L', mirror: false, ...over });

beforeEach(() => clearPieceCache());

it('every shipped placeable piece has iso art, 56 in all: the 54 release-1 pieces (the Cottage ones among them) and the 2 new ones (spec §4)', () => {
  expect(PLACEABLE).toHaveLength(56); // 54 release-1 placeables + shelf.plank + lamp.welcome
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
