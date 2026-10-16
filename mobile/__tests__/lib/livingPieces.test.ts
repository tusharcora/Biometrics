import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { CATALOGUE, catalogueItem } from '../../src/lib/room/catalogue';
import { itemIcon } from '../../src/lib/room/icons';
import { itemArt } from '../../src/lib/room/items';
import { clearPieceCache, isoArtOf, pieceLayers } from '../../src/lib/room/iso/art';
import { opaqueBounds } from '../../src/lib/room/iso/prims';
import { itemName } from '../../src/lib/room/roomCopy';
import '../../src/lib/room/iso';

beforeEach(() => clearPieceCache());

it('ships the ginger cat and the trophy shelf in release 5, named, with an icon and iso art (spec §4, P3 ruling 2)', () => {
  expect(CATALOGUE.items.filter((i) => i.release === 5).map((i) => i.id).sort()).toEqual(['pet.tabby', 'shelf.awards']);
  for (const id of ['pet.tabby', 'shelf.awards']) {
    expect({ id, icon: (itemIcon(id)?.length ?? 0) > 0, iso: !!isoArtOf(id) }).toEqual({ id, icon: true, iso: true });
  }
  expect([itemName('pet.tabby'), itemName('shelf.awards')]).toEqual(['Ginger cat', 'Trophy shelf']);
  expect([catalogueItem('pet.tabby')!.iso!.effect, catalogueItem('shelf.awards')!.iso!.effect]).toEqual(['wander', 'awards']);
});

it('the cat sits on its tile with a tail that flicks over three frames, day and night', () => {
  expect(itemArt('pet.tabby')!.frames).toBe(3);
  for (const ctx of [CTX_DAY, CTX_NIGHT]) {
    const l = pieceLayers('pet.tabby', ctx, { layer: 'floor', facing: 'L', mirror: false })!;
    expect((l.base?.length ?? 0) > 0).toBe(true);
    expect(l.frames).toHaveLength(3);
    expect(JSON.stringify(l.frames![0])).not.toBe(JSON.stringify(l.frames![1]));
  }
});

it('the trophy shelf is a plank along 4 tiles of either wall, plain until it holds awards', () => {
  for (const layer of ['wallL', 'wallR'] as const) {
    const l = pieceLayers('shelf.awards', CTX_DAY, { layer, facing: 'L', mirror: false })!;
    expect(opaqueBounds(l.base ?? [])!.w).toBeGreaterThanOrEqual(4 * 12); // 4 tiles along one axis, 12 cells each (PF3-TESTS)
    expect(l.frames).toBeUndefined();
  }
});

it('the cat plays with a paw and its tail, and naps curled up with drifting z\'s (spec §8.3, ruling 10)', () => {
  const at = (effect?: string) => pieceLayers('pet.tabby', CTX_NIGHT, { layer: 'floor', facing: 'L', mirror: false, ...(effect ? { effect } : {}) })!;
  const sit = at();
  const play = at('play');
  const nap = at('nap');
  expect(JSON.stringify(play.frames)).not.toBe(JSON.stringify(sit.frames));
  expect(opaqueBounds(nap.base!)!.h).toBeLessThan(opaqueBounds(sit.base!)!.h);
  expect(JSON.stringify(nap.frames![0])).not.toBe(JSON.stringify(nap.frames![2]));
  expect(JSON.stringify(at('wander').base)).toBe(JSON.stringify(sit.base)); // still, a wandering cat sits
});
