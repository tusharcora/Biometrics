import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueItem } from '../../src/lib/room/catalogue';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { spriteRows } from '../../src/lib/room/items/shared';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import type { PlacementLayer } from '../../src/lib/room/iso/geometry';
import '../../src/lib/room/iso';

const SHOP = ['item.radio', 'corner.gnome', 'corner.cone', 'corner.pumpkin', 'item.candle', 'art.neonheart'];

it('ships the six coin-shop pieces in release 4, each priced, with front-on art, an icon and iso art (spec §4)', () => {
  expect(CATALOGUE.items.filter((i) => i.release === 4).map((i) => i.id).sort()).toEqual([...SHOP].sort());
  for (const id of SHOP) {
    expect({ id, art: !!itemArt(id), icon: (itemIcon(id)?.length ?? 0) > 0, iso: !!isoArtOf(id), price: typeof catalogueItem(id)!.price })
      .toEqual({ id, art: true, icon: true, iso: true, price: 'number' });
  }
});

it('stands each piece on every layer it allows, day and night, and hangs the sign on both walls', () => {
  clearPieceCache();
  for (const id of SHOP) {
    const layers: PlacementLayer[] = catalogueItem(id)!.iso!.layers.flatMap((l) => (l === 'wall' ? (['wallL', 'wallR'] as const) : [l]));
    for (const layer of layers) for (const ctx of [CTX_DAY, CTX_NIGHT]) {
      const l = pieceLayers(id, ctx, { layer, facing: 'L', mirror: false });
      expect({ id, layer, base: (l?.base?.length ?? 0) > 0 }).toEqual({ id, layer, base: true });
    }
  }
});

it('only the candle\'s flame and the sign\'s tube glow, and only in the glow layer', () => {
  for (const id of SHOP) {
    const l = itemArt(id)!.draw(CTX_NIGHT);
    expect({ id, glow: (l.emissive?.length ?? 0) > 0 }).toEqual({ id, glow: id === 'item.candle' || id === 'art.neonheart' });
  }
});

it('reads a sprite from rows of palette letters, one rect per run (gen/front.py `sprite`)', () => {
  expect(spriteRows(['.aa.b', 'c....'], { a: '#111111', b: '#222222', c: '#333333' }))
    .toEqual([[1, 0, 2, 1, '#111111'], [4, 0, 1, 1, '#222222'], [0, 1, 1, 1, '#333333']]);
});
