// The room engine's one entry point (spec 2026-10-14 KIP Coach §5). Pure: no React, no Skia. The order is the v2
// engine's (lib2.js `room2`): walls and floor, items back to front, ambient occlusion, then daylight through the
// window (by weather) or the night veil, then emissive glows, then the loop frames. KIP is its own layer, so a
// pose change never redraws the room. RoomView draws base → kip → light → emissive → frames[i] (plan ruling 4).
import { kipGrid, kipRamp, KIP_COLOURS, KIP_GRID, mirrorGrid, type KipColour, type KipMood, type KipPose } from '../kip/kipArt';
import { FOCUS_BOX, THUMB_BOX, type Box, type RoomRect } from './grid';
import { itemArt, type ItemContext, type MonitorScreen, type SeatStyle } from './items';
import { loadoutKey, STARTER_LOADOUT, wornKey, type KipWorn, type RoomLoadout } from './loadout';
import { ao, R, type Rects } from './paint';
import { DRAW_ORDER, ROOM_SLOTS, SLOT_ANCHORS } from './slots';
import './starterItems';
import { daylight, nightVeil, type RoomWeather } from './weather';

/** Room cells per KIP pixel: KIP is 32 × 32 cells, 64 × 64 points in the diorama (§4). */
export const KIP_CELLS = 2;

export interface KipSeat {
  /** Top-left of KIP's 16 × 16 grid, in room cells. */
  x: number;
  y: number;
  /** Which side of KIP the desk is on; "facing the desk" mirrors KIP when it is on the left (§4). */
  deskSide: 'left' | 'right';
  style: SeatStyle;
}

/** Where KIP sits for each desk style. `low` (floor at a low table) is Spec B's; it may tune it. */
export const SEATS: Record<SeatStyle, KipSeat> = {
  standard: { x: 110, y: 52, deskSide: 'left', style: 'standard' },
  low: { x: 106, y: 49, deskSide: 'left', style: 'low' },
};

export interface RoomKip {
  colour: KipColour;
  pose: KipPose;
  mood: KipMood;
  /** All null in Spec A; Spec B draws worn items. */
  worn: KipWorn;
  /** The loop frame (0–2) for looping poses. */
  frame?: number;
  /** Default: 'desk' for `type`, 'you' otherwise (plan ruling 6). */
  facing?: 'desk' | 'you';
}

export interface RoomInput {
  loadout: RoomLoadout;
  weather: RoomWeather;
  night: boolean;
  kip: RoomKip;
  screen: MonitorScreen;
}

export interface RoomDrawing {
  base: RoomRect[];
  light: RoomRect[];
  emissive: RoomRect[];
  frames: [RoomRect[], RoomRect[], RoomRect[]];
  kip: RoomRect[];
  kipSeat: KipSeat;
  focus: Box;
  thumb: Box;
}

type StaticInput = Pick<RoomInput, 'loadout' | 'weather' | 'night'> & { colour: KipColour };

function context(input: StaticInput, screen: MonitorScreen): ItemContext {
  return { weather: input.weather, night: input.night, colour: input.colour, ramp: kipRamp(KIP_COLOURS[input.colour]), screen };
}

/** The seat from the desk item's style: standard when the desk slot is empty, unknown, or holds another slot's item. */
export function kipSeatFor(loadout: RoomLoadout): KipSeat {
  const art = itemArt(loadout.desk);
  return SEATS[art?.slot === 'desk' ? art.style ?? 'standard' : 'standard'];
}

/**
 * What the room draws for a stored loadout (spec 2026-10-14 KIP's room §2): an id this build has no art for, or art
 * for another slot, is drawn as the slot's starter piece. The stored loadout itself is never changed (ruling 25).
 */
export function drawableLoadout(loadout: RoomLoadout): RoomLoadout {
  const out = { ...loadout };
  for (const slot of ROOM_SLOTS) {
    const id = loadout[slot];
    if (id === null) continue;
    if (itemArt(id)?.slot !== slot) out[slot] = STARTER_LOADOUT[slot];
  }
  return out;
}

/** Everything that never changes with KIP's pose or the loop: memoised by roomPictureKey. */
export function drawRoomStatic(input: StaticInput): Pick<RoomDrawing, 'base' | 'light' | 'emissive' | 'kipSeat'> {
  const ctx = context(input, 'lines');
  const base: Rects = [];
  const emissive: Rects = [];
  for (const slot of DRAW_ORDER) {
    const art = itemArt(input.loadout[slot]);
    if (!art || art.slot !== slot) continue;
    const layers = art.draw(ctx);
    if (layers.base) base.push(...layers.base);
    if (art.emissive && layers.emissive) emissive.push(...layers.emissive);
  }
  const light: Rects = [];
  ao(light);
  if (input.night) nightVeil(light);
  else if (itemArt(input.loadout.window)) {
    const w = SLOT_ANCHORS.window;
    daylight(light, input.weather, w.x + 4, w.x + w.w - 4, w.y + w.h - 3);
  }
  return { base, light, emissive, kipSeat: kipSeatFor(input.loadout) };
}

/** The three loop frames (the monitor's screen, steam, the lamp's flicker). */
export function drawRoomFrames(input: StaticInput & { screen: MonitorScreen }): [Rects, Rects, Rects] {
  const ctx = context(input, input.screen);
  const out: [Rects, Rects, Rects] = [[], [], []];
  for (const slot of DRAW_ORDER) {
    const art = itemArt(input.loadout[slot]);
    if (!art || art.slot !== slot || !art.frames) continue;
    const frames = art.draw(ctx).frames;
    if (frames) frames.forEach((f, i) => out[i as 0 | 1 | 2].push(...f));
  }
  return out;
}

/** KIP at its seat, 2 cells per KIP pixel, mirrored when it faces a desk on its left. */
export function drawKipLayer(kip: RoomKip, seat: KipSeat): Rects {
  const facing = kip.facing ?? (kip.pose === 'type' ? 'desk' : 'you');
  let grid = kipGrid({ colour: kip.colour, pose: kip.pose, mood: kip.mood, frame: kip.frame ?? 0 });
  if (facing === 'desk' && seat.deskSide === 'left') grid = mirrorGrid(grid);
  const r: Rects = [];
  for (let y = 0; y < KIP_GRID; y++) {
    let x = 0;
    const row = grid[y]!;
    while (x < KIP_GRID) {
      const c = row[x];
      if (!c) { x++; continue; }
      let w = 1;
      while (x + w < KIP_GRID && row[x + w] === c) w++;
      R(r, seat.x + x * KIP_CELLS, seat.y + y * KIP_CELLS, w * KIP_CELLS, KIP_CELLS, c);
      x += w;
    }
  }
  return r;
}

export function drawRoom(input: RoomInput): RoomDrawing {
  const staticInput = { loadout: input.loadout, weather: input.weather, night: input.night, colour: input.kip.colour };
  const s = drawRoomStatic(staticInput);
  return {
    ...s,
    frames: drawRoomFrames({ ...staticInput, screen: input.screen }),
    kip: drawKipLayer(input.kip, s.kipSeat),
    focus: FOCUS_BOX,
    thumb: THUMB_BOX,
  };
}

/** The static picture's memo key (§5): (loadout, weather, night, colour). */
export function roomPictureKey(input: StaticInput): string {
  return `${loadoutKey(input.loadout)}#${input.weather}#${input.night ? 'n' : 'd'}#${input.colour}`;
}

/** KIP's layer key (§5): (colour, pose, mood, worn, frame), plus facing. */
export function kipLayerKey(kip: RoomKip): string {
  return `${kip.colour}#${kip.pose}#${kip.mood}#${wornKey(kip.worn)}#${kip.frame ?? 0}#${kip.facing ?? ''}`;
}
