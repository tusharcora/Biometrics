import { KIP_COLOURS, KIP_GRID, KIP_MOODS, KIP_POSES, kipGrid, kipRamp, wornIconRects } from '../../src/lib/kip/kipArt';
import { SMALL_KIP_PT, WORN_ART, kipWornOf, registerWornArt, tintOf, wornArt, wornForSize, wornLayer } from '../../src/lib/kip/wornArt';
import { CATALOGUE } from '../../src/lib/room/catalogue';

const ramp = kipRamp(KIP_COLOURS.coral);
const filled = (g: (string | null)[][]) => g.flatMap((row, y) => row.flatMap((c, x) => (c ? [`${x},${y}`] : [])));

it('has art for every worn item the app ships, in its own slot, inside the 16 × 16 grid', () => {
  const shipped = CATALOGUE.items.filter((i) => ['head', 'face', 'neck', 'ears'].includes(i.slot));
  expect(WORN_ART.map((w) => w.id).sort()).toEqual(shipped.map((i) => i.id).sort());
  for (const art of WORN_ART) {
    expect(art.slot).toBe(shipped.find((i) => i.id === art.id)!.slot);
    for (const [x, y] of filled(wornLayer(art.id, ramp)).map((k) => k.split(',').map(Number))) {
      expect(x! >= 0 && y! >= 0 && x! < KIP_GRID && y! < KIP_GRID).toBe(true);
    }
  }
});

it('a tinted piece takes KIP\'s ramp (the bucket hat\'s crown is the light, its brim the shade)', () => {
  const lime = kipRamp(KIP_COLOURS.lime);
  const cells = wornLayer('out.bucket', lime).flat();
  expect(cells).toContain(lime.light);
  expect(cells).toContain(lime.shade);
});

it('tintOf maps @b @h @s @d onto the ramp and leaves other colours alone', () => {
  expect([tintOf('@b', ramp), tintOf('@h', ramp), tintOf('@s', ramp), tintOf('@d', ramp)]).toEqual([ramp.body, ramp.light, ramp.shade, ramp.deep]);
  expect(tintOf('#123456', ramp)).toBe('#123456');
});

it('never reshapes the body: in every pose and mood, a cell that changes shows a worn piece, and nothing is erased', () => {
  const worn = { head: 'out.beanie', face: 'out.round', neck: 'out.scarf', ears: 'out.phones' };
  const colours = new Set(Object.values(worn).flatMap((id) => wornLayer(id, ramp).flat().filter(Boolean)));
  for (const pose of KIP_POSES) for (const mood of KIP_MOODS) {
    const bare = kipGrid({ pose, mood });
    const dressed = kipGrid({ pose, mood, worn });
    bare.forEach((row, y) => row.forEach((c, x) => {
      const d = dressed[y]![x];
      if (d !== c) expect({ pose, mood, x, y, worn: d !== null && colours.has(d) }).toEqual({ pose, mood, x, y, worn: true });
    }));
  }
});

it('draws head, face, neck, then the pose\'s arms over a neck item, then ears over everything', () => {
  registerWornArt([
    { id: 'test.wideNeck', slot: 'neck', at: [0, 11], rows: ['nnnnnnnnnnnnnnnn'], pal: { n: '#123456' } },
    { id: 'test.bigEars', slot: 'ears', at: [0, 2], rows: ['eeeeeeeeeeeeeeee'], pal: { e: '#ABCDEF' } },
    { id: 'test.tallHat', slot: 'head', at: [0, 2], rows: ['hhhhhhhhhhhhhhhh'], pal: { h: '#654321' } },
  ]);
  const g = kipGrid({ pose: 'type', mood: 'idle', worn: { neck: 'test.wideNeck', ears: 'test.bigEars', head: 'test.tallHat' } });
  expect(g[11]![3]).toBe(ramp.body); // the typing arm (3, 11) is over the neck piece
  expect(g[11]![0]).toBe('#123456'); // the neck piece where no arm is
  expect(g[2]![5]).toBe('#ABCDEF'); // ears over the hat
});

it('moves worn pieces with the body: a hopping KIP\'s beanie is a row higher', () => {
  const rest = filled(kipGrid({ pose: 'rest', worn: { head: 'out.beanie' } }).map((r) => r.map((c) => (c === '#EF4444' ? c : null))));
  const cheer = filled(kipGrid({ pose: 'cheer', worn: { head: 'out.beanie' } }).map((r) => r.map((c) => (c === '#EF4444' ? c : null))));
  const top = (cells: string[]) => Math.min(...cells.map((k) => Number(k.split(',')[1])));
  expect(top(cheer)).toBe(top(rest) - 1);
});

it('drops unknown ids and pieces in the wrong slot', () => {
  expect(kipWornOf({ head: 'out.cap', face: 'out.fromTheFuture', neck: 'out.cap', ears: 3 })).toEqual({ head: 'out.cap', face: null, neck: null, ears: null });
  expect(kipWornOf(undefined)).toEqual({ head: null, face: null, neck: null, ears: null });
  expect(wornArt('out.fromTheFuture')).toBeUndefined();
  expect(() => kipGrid({ worn: { head: 'out.fromTheFuture' } })).not.toThrow();
});

it('under 32 points draws only head and ears, so the eyes stay readable', () => {
  const worn = { head: 'out.cap', face: 'out.round', neck: 'out.scarf', ears: 'out.earbuds' };
  expect(wornForSize(worn, SMALL_KIP_PT - 1)).toEqual({ head: 'out.cap', ears: 'out.earbuds' });
  expect(wornForSize(worn, SMALL_KIP_PT)).toEqual(worn);
  expect(wornForSize(undefined, 64)).toEqual({});
});

it('a worn piece\'s tray icon is KIP\'s rows 0–14 wearing only that piece', () => {
  const rects = wornIconRects('out.round', 'coral');
  expect(rects.every((r) => r.y < 15)).toBe(true);
  expect(rects.some((r) => r.fill === '#FCD34D')).toBe(true);
});
