import { CATALOGUE, catalogueSet } from '../../src/lib/room/catalogue';
import { boxContains } from '../../src/lib/room/grid';
import { EMPTY_WORN } from '../../src/lib/room/loadout';
import { starterLayout } from '../../src/lib/room/layout';
import { isoCrop, deskBoxes } from '../../src/lib/room/iso/crop';
import type { Placement, RoomLayout } from '../../src/lib/room/iso/geometry';
import { isoGrid, projOf } from '../../src/lib/room/iso/grid';
import { roomEffects } from '../../src/lib/room/effects';
import { clipOut, drawIsoFramesEach, drawIsoStatic, drawKipLayer, isoRoomKey, pieceAt, type IsoStaticInput } from '../../src/lib/room/iso/room';
import { NIGHT_VEIL } from '../../src/lib/room/weather';

const KIP = { colour: 'coral' as const, pose: 'rest' as const, mood: 'idle' as const, worn: EMPTY_WORN };
const input = (layout: RoomLayout = starterLayout(), over: Partial<IsoStaticInput> = {}): IsoStaticInput =>
  ({ layout, tier: 1, weather: 'clear', night: false, colour: 'coral', ...over });
const with_ = (...extra: Placement[]): RoomLayout => ({ ...starterLayout(), pieces: [...starterLayout().pieces, ...extra] });
const at = (id: string, item: string, x: number, y: number): Placement => ({ id, item, layer: 'floor', x, y, facing: 'L', mirror: false });
/** Spec B's full slot room converted (every slot filled), as the server would send it. */
const CONVERTED: RoomLayout = {
  ...starterLayout(),
  pieces: [...starterLayout().pieces, { id: 'art', item: 'art.mountain', layer: 'wallR', x: 2, y: 9, facing: 'L', mirror: false }, at('corner', 'corner.floorlamp', 5, 0), at('pet', 'pet.bed', 4, 5)],
};

describe('drawIsoStatic (spec §3.4, §3.6)', () => {
  it('seats KIP on the desk\'s seat tile, facing the desk on its right', () => {
    const s = drawIsoStatic(input());
    // The seat tile (3, 1): centre P(3.5, 1.5) = (86 + 24, 68 + 30); KIP's 32-cell grid stands on it.
    expect(s.kipSeat).toEqual({ x: 110 - 16, y: 98 - 30, deskSide: 'right', style: 'standard' });
  });

  it('draws children right after their parent, and the desk before KIP', () => {
    const s = drawIsoStatic(input());
    const ids = s.behind.map((b) => b.p.id);
    expect(ids.indexOf('lamp')).toBe(ids.indexOf('desk') + 1);
    expect(ids.indexOf('deskitem')).toBe(ids.indexOf('desk') + 2);
    expect(ids).toEqual(expect.arrayContaining(['plank', 'shelf', 'rug', 'plant', 'desk']));
  });

  it('puts a piece in front of KIP in the front picture, so it hides KIP\'s legs (spec §3.4 movers)', () => {
    const s = drawIsoStatic(input(with_(at('bag', 'corner.beanbag', 3, 3))));
    expect(s.ahead.map((a) => a.p.id)).toEqual(['bag']);
    expect(s.front.length).toBeGreaterThan(0);
  });

  it('a lifted piece and its children are left out; KIP stays at the desk\'s seat', () => {
    const s = drawIsoStatic(input(starterLayout(), { hide: 'desk' }));
    expect(s.behind.map((b) => b.p.id)).not.toEqual(expect.arrayContaining(['desk', 'lamp', 'deskitem']));
    expect(s.kipSeat).toEqual(drawIsoStatic(input()).kipSeat);
  });

  it('skips an item this build cannot draw (a newer server) without throwing', () => {
    expect(() => drawIsoStatic(input(with_(at('x', 'plant.fromTheFuture', 6, 6))))).not.toThrow();
  });

  it('day: daylight through each window; night: the veil over the whole room (Spec A lighting)', () => {
    const g = isoGrid(1);
    expect(drawIsoStatic(input(starterLayout(), { night: true })).light).toEqual([[0, 0, g.W, g.H, NIGHT_VEIL]]);
    const day1 = drawIsoStatic(input()).light.length;
    const day3 = drawIsoStatic(input(starterLayout(), { tier: 3 })).light.length;
    expect(day1).toBeGreaterThan(0);
    expect(day3).toBeGreaterThan(day1);
  });

  it('keeps its rect counts per layer: starter, converted and Cottage rooms, day and night, at each tier', () => {
    const counts: Record<string, number[]> = {};
    for (const [name, layout] of [['starter', starterLayout()], ['converted', CONVERTED], ['cottage', catalogueSet('cottage')!.layout]] as const) {
      for (const tier of [1, 2, 3] as const) for (const night of [false, true]) {
        const s = drawIsoStatic(input(layout, { tier, night }));
        counts[`${name}/${tier}/${night ? 'night' : 'day'}`] = [s.back.length, s.front.length, s.light.length, s.emissive.length];
        expect(drawIsoStatic(input(layout, { tier, night }))).toEqual(s);
      }
    }
    expect(counts).toMatchSnapshot();
  });

  it('finds the topmost piece under a point (taps in the editor)', () => {
    const s = drawIsoStatic(input());
    const fern = s.hits.find((h) => h.id === 'plant')!;
    const [x, y] = fern.rects.filter((q) => !q[4].startsWith('rgba')).sort((a, b) => a[1] - b[1])[0]!; // its top leaf
    expect(pieceAt(s.hits, x, y)).toBe('plant');
    expect(pieceAt(s.hits, 0, 0)).toBeNull();
  });

  it('keys the static picture by the layout\'s content and the light, not by object identity', () => {
    expect(isoRoomKey(input())).toBe(isoRoomKey(input(starterLayout())));
    expect(isoRoomKey(input(starterLayout(), { night: true }))).not.toBe(isoRoomKey(input()));
  });
});

describe('loop frames (spec §3.7, ruling 8)', () => {
  it('a screen loop behind KIP never paints over KIP', () => {
    const s = drawIsoStatic(input(starterLayout(), { night: true }));
    const kip = drawKipLayer(KIP, s.kipSeat);
    const cells = new Set<string>();
    for (const [x, y, w, h] of kip) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.add(`${x + i},${y + j}`);
    const frames = drawIsoFramesEach(s, { night: true, colour: 'coral', screen: 'dots' }, [kip, kip, kip]);
    expect(frames.every((f) => f.length > 0)).toBe(true);
    for (const f of frames) for (const [x, y, w, h] of f) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) expect(cells.has(`${x + i},${y + j}`)).toBe(false);
  });

  it('clipOut removes exactly the covered cells', () => {
    expect(clipOut([[0, 0, 4, 1, '#a']], [[1, 0, 2, 1, '#k']])).toEqual([[0, 0, 1, 1, '#a'], [3, 0, 1, 1, '#a']]);
  });
});

describe('crops on the desk (spec §9.1)', () => {
  it('the 140 × 120 focus box and the 96 × 60 thumbnail follow the desk', () => {
    const g = isoGrid(1);
    const a = deskBoxes(g, starterLayout());
    const moved = deskBoxes(g, { ...starterLayout(), pieces: starterLayout().pieces.map((p) => (p.id === 'desk' ? { ...p, x: 0, y: 4 } : p)) });
    expect([a.focus.w, a.focus.h, a.thumb.w, a.thumb.h]).toEqual([140, 120, 96, 60]);
    expect(moved.focus.x).toBeLessThan(a.focus.x);
    expect(boxContains({ x: 0, y: 0, w: g.W, h: g.H }, { ...a.thumb, x: Math.max(0, a.thumb.x) })).toBe(true);
  });

  it('crops, never shrinks: the room is clamped so its edges never show; a wider view shows more room', () => {
    const g = isoGrid(1);
    const box = deskBoxes(g, starterLayout()).focus;
    const o = isoCrop({ width: 330, height: 240, cellPt: 2, box, room: g });
    expect(o.x).toBeLessThanOrEqual(0);
    expect(o.x).toBeGreaterThanOrEqual(330 - g.W * 2);
    expect(isoCrop({ width: 400, height: 400, cellPt: 2, box, room: g })).toEqual({ x: 28, y: 40 });
  });
});

it('draws a napping cat on its bed, right after the bed, and tapping the bed there finds the cat (spec §8.2)', () => {
  const pieces = [...starterLayout().pieces,
    { id: 'p1', item: 'pet.tabby', layer: 'floor' as const, x: 6, y: 6, facing: 'L' as const, mirror: false },
    { id: 'p2', item: 'pet.bed', layer: 'floor' as const, x: 5, y: 5, facing: 'L' as const, mirror: false }];
  const layout = { ...starterLayout(), pieces };
  const effects = roomEffects(layout, 1, { plantStage: 5, petEnergy: 'play', awards: [] }, { hhmm: '23:00', hour: 23 });
  const s = drawIsoStatic({ layout, tier: 1, weather: 'clear', night: true, colour: 'coral', effects });
  const placed = [...s.behind, ...s.ahead];
  const bed = placed.findIndex((pp) => pp.p.id === 'p2');
  expect(placed[bed + 1]!.p.id).toBe('p1');
  expect(placed[bed + 1]!.at).toEqual(placed[bed]!.at);
  expect(placed[bed + 1]!.o.effect).toBe('nap');
  const [x, y] = projOf(isoGrid(1))(5.5, 5.5, 4).map(Math.round);
  expect(pieceAt(s.hits, x, y - 2)).toBe('p1');
});
