import { drawKipLayer, drawRoom, drawRoomFrames, drawRoomStatic, kipLayerKey, kipSeatFor, roomPictureKey, SEATS, type RoomInput } from '../../src/lib/room/draw';
import { boundsOf, boxContains, FOCUS_BOX, ROOM_H, ROOM_W, THUMB_BOX, type RoomRect } from '../../src/lib/room/grid';
import { drawableLoadout } from '../../src/lib/room/draw';
import { itemArt, registerItems, type ItemContext } from '../../src/lib/room/items';
import { EMPTY_WORN, STARTER_LOADOUT, type RoomLoadout } from '../../src/lib/room/loadout';
import { ROOM_SLOTS, SLOT_ANCHORS, WORN_SLOTS } from '../../src/lib/room/slots';
import { MONITOR_GLASS, STARTER_ITEMS } from '../../src/lib/room/starterItems';
import { NIGHT_VEIL, RAIN, roomWeatherOf, SUN, type RoomWeather } from '../../src/lib/room/weather';
import { KIP_COLOURS, KIP_MOODS, KIP_POSES, kipRamp } from '../../src/lib/kip/kipArt';

const KIP = { colour: 'coral' as const, pose: 'rest' as const, mood: 'idle' as const, worn: EMPTY_WORN };
const INPUT: RoomInput = { loadout: STARTER_LOADOUT, weather: 'cloudy', night: false, kip: KIP, screen: 'lines' };
const CTX: ItemContext = { weather: 'cloudy', night: false, colour: 'coral', ramp: kipRamp(KIP_COLOURS.coral), screen: 'lines' };
const WEATHERS: RoomWeather[] = ['clear', 'mostly', 'cloudy', 'stormy', 'short', 'fallback'];
const has = (rects: readonly RoomRect[], colour: string) => rects.some((q) => q[4] === colour);
const staticOf = (loadout: RoomLoadout, weather: RoomWeather = 'cloudy', night = false) =>
  drawRoomStatic({ loadout, weather, night, colour: 'coral' });

describe('the grid and the slots', () => {
  it('is 170 × 110 cells, with the focus and thumbnail boxes the spec fixes', () => {
    expect([ROOM_W, ROOM_H]).toEqual([170, 110]);
    expect(FOCUS_BOX).toEqual({ x: 15, y: 10, w: 140, h: 100 });
    expect(THUMB_BOX).toEqual({ x: 70, y: 40, w: 96, h: 60 });
    const grid = { x: 0, y: 0, w: ROOM_W, h: ROOM_H };
    expect(boxContains(grid, FOCUS_BOX) && boxContains(grid, THUMB_BOX)).toBe(true);
  });

  it('has the 12 room slots and the 4 worn slots, every anchor inside the grid', () => {
    expect(ROOM_SLOTS).toEqual(['wallpaper', 'floor', 'art', 'window', 'shelf', 'desk', 'desk_item', 'plant', 'lamp', 'corner', 'rug', 'pet']);
    expect(WORN_SLOTS).toEqual(['head', 'face', 'neck', 'ears']);
    for (const slot of ROOM_SLOTS) expect(boxContains({ x: 0, y: 0, w: ROOM_W, h: ROOM_H }, SLOT_ANCHORS[slot])).toBe(true);
  });

  it('registers the ten placed starter items, each drawn inside its slot anchor', () => {
    expect(STARTER_ITEMS.map((i) => i.id).sort()).toEqual(
      ['art.calendar', 'desk.monitor', 'floor.oakDark', 'item.mug', 'lamp.amber', 'plant.fern', 'rug.slate', 'shelf.books', 'wall.plain', 'win.plain'],
    );
    for (const item of STARTER_ITEMS) {
      expect(STARTER_LOADOUT[item.slot]).toBe(item.id);
      expect({ id: item.id, inside: boxContains(SLOT_ANCHORS[item.slot], boundsOf(item.draw(CTX).base ?? [])!) }).toEqual({ id: item.id, inside: true });
    }
    expect([STARTER_LOADOUT.corner, STARTER_LOADOUT.pet]).toEqual([null, null]);
  });
});

describe('drawRoom', () => {
  it('is deterministic for the starter loadout', () => {
    expect(drawRoom(INPUT)).toEqual(drawRoom(INPUT));
  });

  it('an empty slot draws nothing: removing an item removes exactly its rects', () => {
    const full = staticOf(STARTER_LOADOUT).base.length;
    for (const item of STARTER_ITEMS) {
      const without = staticOf({ ...STARTER_LOADOUT, [item.slot]: null }).base.length;
      expect(full - without).toBe(item.draw(CTX).base!.length);
    }
  });

  it('skips an unknown item id instead of throwing', () => {
    expect(() => staticOf({ ...STARTER_LOADOUT, plant: 'no_such_item' })).not.toThrow();
    expect(staticOf({ ...STARTER_LOADOUT, plant: 'no_such_item' })).toEqual(staticOf({ ...STARTER_LOADOUT, plant: null }));
  });

  it('keeps the window, the desk and KIP inside the focus box', () => {
    const d = drawRoom(INPUT);
    expect(boxContains(FOCUS_BOX, boundsOf(d.kip)!)).toBe(true);
    expect(boxContains(FOCUS_BOX, boundsOf(itemArt('desk.monitor')!.draw(CTX).base!)!)).toBe(true);
    expect(boxContains(FOCUS_BOX, boundsOf(itemArt('win.plain')!.draw(CTX).base!)!)).toBe(true);
    expect([d.focus, d.thumb]).toEqual([FOCUS_BOX, THUMB_BOX]);
  });

  it('keeps KIP (every pose, mood and frame) and the monitor glass inside the thumbnail box', () => {
    for (const pose of KIP_POSES) for (const mood of KIP_MOODS) for (const frame of [0, 1, 2]) {
      const b = boundsOf(drawKipLayer({ ...KIP, pose, mood, frame }, SEATS.standard))!;
      expect({ pose, mood, inside: boxContains(THUMB_BOX, b) }).toEqual({ pose, mood, inside: true });
    }
    expect(boxContains(THUMB_BOX, MONITOR_GLASS)).toBe(true);
  });

  it.each(WEATHERS)('%s: night veil only at night, rain only when stormy, sun only in clear, mostly and short', (weather) => {
    const day = staticOf(STARTER_LOADOUT, weather, false);
    const night = staticOf(STARTER_LOADOUT, weather, true);
    expect(has(day.light, NIGHT_VEIL)).toBe(false);
    expect(has(night.light, NIGHT_VEIL)).toBe(true);
    expect(has(day.base, RAIN)).toBe(weather === 'stormy');
    expect(has(night.base, RAIN)).toBe(false);
    expect(has(day.base, SUN)).toBe(['clear', 'mostly', 'short'].includes(weather));
    expect(has(night.base, SUN)).toBe(false);
  });

  it('has an emissive layer only from emissive items (the lamp and the monitor)', () => {
    expect(staticOf(STARTER_LOADOUT).emissive.length).toBeGreaterThan(0);
    expect(staticOf({ ...STARTER_LOADOUT, lamp: null, desk: null }).emissive).toEqual([]);
    for (const item of STARTER_ITEMS.filter((i) => !i.emissive)) expect(item.draw(CTX).emissive ?? []).toEqual([]);
  });

  it('takes the seat from the desk item\'s style', () => {
    expect(kipSeatFor(STARTER_LOADOUT)).toEqual(SEATS.standard);
    expect(kipSeatFor({ ...STARTER_LOADOUT, desk: null })).toEqual(SEATS.standard);
    expect(drawRoom(INPUT).kipSeat).toEqual(SEATS.standard);
  });

  it('mirrors KIP while it types at the desk on its left, and not when it faces you', () => {
    const typing = drawKipLayer({ ...KIP, pose: 'type', mood: 'glance' }, SEATS.standard);
    const facingYou = drawKipLayer({ ...KIP, pose: 'type', mood: 'glance', facing: 'you' }, SEATS.standard);
    expect(typing).not.toEqual(facingYou);
    expect(boundsOf(typing)).toEqual(boundsOf(facingYou));
  });

  it('draws KIP\'s worn pieces in the room\'s KIP layer, and a worn change changes the layer key', () => {
    const dressed = { ...KIP, worn: { ...EMPTY_WORN, head: 'out.beanie' } };
    expect(drawKipLayer(dressed, SEATS.standard)).not.toEqual(drawKipLayer(KIP, SEATS.standard));
    expect(kipLayerKey(dressed)).not.toBe(kipLayerKey(KIP));
  });

  it('tints the mug in KIP\'s colour', () => {
    for (const colour of ['coral', 'cobalt', 'lime'] as const) {
      const ramp = kipRamp(KIP_COLOURS[colour]);
      expect(has(itemArt('item.mug')!.draw({ ...CTX, colour, ramp }).base!, ramp.body)).toBe(true);
    }
    expect(itemArt('item.mug')!.tint).toBe(true);
  });

  it('puts the monitor\'s screen in the loop frames, never in the static layers', () => {
    const frames = (screen: 'lines' | 'dots' | 'chart') => drawRoomFrames({ loadout: STARTER_LOADOUT, weather: 'cloudy', night: false, colour: 'coral', screen });
    expect(frames('dots')).not.toEqual(frames('chart'));
    expect(frames('dots')).not.toEqual(frames('lines'));
    expect(drawRoom({ ...INPUT, screen: 'dots' }).base).toEqual(drawRoom({ ...INPUT, screen: 'chart' }).base);
    const [f0, f1] = frames('dots');
    expect(f0).not.toEqual(f1);
  });
});

describe('memo keys', () => {
  it('the picture key changes with loadout, weather, night and colour, and nothing else', () => {
    const base = { loadout: STARTER_LOADOUT, weather: 'cloudy' as const, night: false, colour: 'coral' as const };
    const key = roomPictureKey(base);
    expect(roomPictureKey({ ...base })).toBe(key);
    for (const changed of [{ loadout: { ...STARTER_LOADOUT, plant: null } }, { weather: 'clear' as const }, { night: true }, { colour: 'mint' as const }]) {
      expect(roomPictureKey({ ...base, ...changed })).not.toBe(key);
    }
  });

  it('the KIP key changes with colour, pose, mood, worn and frame', () => {
    const key = kipLayerKey(KIP);
    for (const changed of [{ colour: 'mint' as const }, { pose: 'type' as const }, { mood: 'glance' as const }, { worn: { ...EMPTY_WORN, head: 'beanie' } }, { frame: 1 }]) {
      expect(kipLayerKey({ ...KIP, ...changed })).not.toBe(key);
    }
  });
});

describe('the window from Home\'s scene', () => {
  it('maps every scene key, with night as its own flag', () => {
    expect(roomWeatherOf('night')).toEqual({ weather: 'fallback', night: true });
    for (const key of ['clear', 'mostly', 'cloudy', 'stormy', 'short', 'fallback'] as const) expect(roomWeatherOf(key)).toEqual({ weather: key, night: false });
  });
});

it('perf: logs how long the starter room takes to build (spec §5 budget: 8 ms on device, release build)', () => {
  const start = performance.now();
  for (let i = 0; i < 10; i++) drawRoom(INPUT);
  const ms = (performance.now() - start) / 10;
  // Logs the duration only; the device budget is checked in Task 16 on the simulator.
  console.info(`drawRoom: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(50);
});

describe('catalogue ids and the engine guards (Spec B Task 1)', () => {
  it('names the ten placed starter pieces with catalogue ids', () => {
    expect(STARTER_LOADOUT).toEqual({
      wallpaper: 'wall.plain', floor: 'floor.oakDark', art: 'art.calendar', window: 'win.plain', shelf: 'shelf.books',
      desk: 'desk.monitor', desk_item: 'item.mug', plant: 'plant.fern', lamp: 'lamp.amber', corner: null,
      rug: 'rug.slate', pet: null,
    });
  });

  it('seats KIP by the desk item only: a styled item from another slot in the desk slot is ignored', () => {
    registerItems([
      { id: 'test.lowLamp', slot: 'lamp', style: 'low', draw: () => ({ base: [] }) },
      { id: 'test.lowDesk', slot: 'desk', style: 'low', draw: () => ({ base: [] }) },
    ]);
    expect(kipSeatFor({ ...STARTER_LOADOUT, desk: 'test.lowLamp' })).toEqual(SEATS.standard);
    expect(kipSeatFor({ ...STARTER_LOADOUT, desk: 'test.lowDesk' })).toEqual(SEATS.low);
    expect(kipSeatFor({ ...STARTER_LOADOUT, desk: null })).toEqual(SEATS.standard);
  });

  it('draws an id this build has no art for as the slot\'s starter piece, and keeps empty optional slots empty', () => {
    const stored = { ...STARTER_LOADOUT, wallpaper: 'wall.fromTheFuture', rug: 'plant.fern', corner: null };
    expect(drawableLoadout(stored)).toEqual({ ...STARTER_LOADOUT, wallpaper: 'wall.plain', rug: 'rug.slate' });
    expect(drawableLoadout(STARTER_LOADOUT)).toEqual(STARTER_LOADOUT);
  });
});
