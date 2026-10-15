import { CTX_DAY, CTX_NIGHT } from '../../jest-mocks/roomArtChecks';
import { KIP_COLOURS, kipRamp } from '../../src/lib/kip/kipArt';
import { catalogueItemsFor } from '../../src/lib/room/catalogue';
import { boundsOf, boxContains } from '../../src/lib/room/grid';
import { isoGrid } from '../../src/lib/room/iso/grid';
import { FLOOR_STYLES, WINDOW_STYLES, drawShell, wallTexture, windowsFor } from '../../src/lib/room/iso/styles';
import { itemArt } from '../../src/lib/room/items';
import { WINDOW_DECOR } from '../../src/lib/room/items/window';
import '../../src/lib/room/art';

const PLAIN = { wallpaper: 'wall.plain', floor: 'floor.oakDark', window: 'win.plain' } as const;
const LIME = { ...CTX_DAY, colour: 'lime' as const, ramp: kipRamp(KIP_COLOURS.lime) };
const shell = (over: Partial<Record<'wallpaper' | 'floor' | 'window', string>> = {}, ctx = CTX_DAY, tier: 1 | 2 | 3 = 1) =>
  drawShell(isoGrid(tier), tier, { ...PLAIN, ...over }, ctx);

it('every shipped style has an iso drawing: 9 wallpapers, 5 floors, 7 window styles (spec §4)', () => {
  const walls = catalogueItemsFor('wallpaper').filter((i) => i.release !== 3);
  const floors = catalogueItemsFor('floor');
  const windows = catalogueItemsFor('window');
  expect([walls.length, floors.length, windows.length]).toEqual([9, 5, 7]);
  for (const w of walls) expect({ id: w.id, art: !!itemArt(w.id) && wallTexture(w.id, CTX_DAY).length > 0 }).toEqual({ id: w.id, art: true });
  for (const f of floors) expect({ id: f.id, style: !!FLOOR_STYLES[f.id] }).toEqual({ id: f.id, style: true });
  for (const w of windows) expect({ id: w.id, style: !!WINDOW_STYLES[w.id] }).toEqual({ id: w.id, style: true });
});

it('each style changes the picture, stays inside the room and on whole cells, day and night, at every tier', () => {
  const plain = JSON.stringify(shell().base);
  for (const [key, ids] of [['wallpaper', catalogueItemsFor('wallpaper')], ['floor', catalogueItemsFor('floor')], ['window', catalogueItemsFor('window')]] as const) {
    for (const { id } of ids) {
      for (const tier of [1, 2, 3] as const) {
        for (const ctx of [CTX_DAY, CTX_NIGHT]) {
          const layers = shell({ [key]: id }, ctx, tier);
          const g = isoGrid(tier);
          const b = boundsOf(layers.base!)!;
          expect({ id, tier, inside: boxContains({ x: 0, y: 0, w: g.W, h: g.H }, b) }).toEqual({ id, tier, inside: true });
          expect(layers.base!.every(([x, y, w, h]) => [x, y, w, h].every(Number.isInteger))).toBe(true);
          expect(drawShell(g, tier, { ...PLAIN, [key]: id }, ctx)).toEqual(layers); // deterministic
        }
      }
      if (id !== PLAIN[key]) expect({ id, differs: JSON.stringify(shell({ [key]: id }).base) !== plain }).toEqual({ id, differs: true });
    }
  }
});

it('tinted styles follow KIP\'s colour; the others never do', () => {
  for (const [key, id, tinted] of [['floor', 'floor.carpet', true], ['wallpaper', 'wall.stripes', true], ['window', 'win.curtains', true], ['floor', 'floor.tiles', false], ['window', 'win.blinds', false]] as const) {
    const follows = JSON.stringify(shell({ [key]: id }, CTX_DAY)) !== JSON.stringify(shell({ [key]: id }, LIME));
    expect({ id, follows }).toEqual({ id, follows: tinted });
  }
});

it('the glass shows today\'s weather and the night (Spec A §6)', () => {
  const sky = (weather: typeof CTX_DAY.weather, night = false) => JSON.stringify(shell({}, { ...CTX_DAY, weather, night }).base);
  expect(new Set([sky('clear'), sky('stormy'), sky('cloudy'), sky('clear', true)]).size).toBe(4);
});

it('one window on the left wall; the loft adds the right wall\'s, at i = n − 2.6 (spec §3.2)', () => {
  expect(windowsFor(isoGrid(1), 1)).toEqual([{ wall: 'wallL', a0: 1.6, da: 2 }]);
  expect(windowsFor(isoGrid(3), 3)).toEqual([{ wall: 'wallL', a0: 1.6, da: 2 }, { wall: 'wallR', a0: 6.4, da: 2 }]);
});

it('a lit window style glows and loops around the glass; a still one does neither', () => {
  const fairy = shell({ window: 'win.fairy' }, CTX_NIGHT);
  expect([(fairy.emissive?.length ?? 0) > 0, fairy.frames?.length]).toEqual([true, 3]);
  expect(JSON.stringify(fairy.frames![0]) !== JSON.stringify(fairy.frames![1])).toBe(true);
  expect(shell({ window: 'win.chime' }).frames?.length).toBe(3);
  const plain = shell();
  expect([plain.emissive?.length ?? 0, plain.frames]).toEqual([0, undefined]);
});

it('the front-on window pieces still draw exactly the frame plus their decor (Spec B art unchanged)', () => {
  for (const id of Object.keys(WINDOW_DECOR)) {
    if (id === 'win.plain') continue;
    const decor = WINDOW_DECOR[id]!(CTX_DAY).base ?? [];
    const base = itemArt(id)!.draw(CTX_DAY).base!;
    expect({ id, tail: JSON.stringify(base.slice(base.length - decor.length)) }).toEqual({ id, tail: JSON.stringify(decor) });
  }
});
