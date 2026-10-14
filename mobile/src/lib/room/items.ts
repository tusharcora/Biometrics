// Room item art (spec 2026-10-14 KIP Coach §5): one registry of art by item id. Every item fills exactly one slot.
// Spec A registers the ten placed starter items (starterItems.ts); Spec B registers the rest of its catalogue
// with registerItems(), and never changes this contract.
import type { KipColour, KipRamp } from '../kip/kipArt';
import type { RoomRect } from './grid';
import type { ItemId } from './loadout';
import type { RoomSlot } from './slots';
import type { RoomWeather } from './weather';

/** What the monitor shows: lines idle, dots while thinking, the chart while answering. */
export type MonitorScreen = 'lines' | 'dots' | 'chart';

export interface ItemContext {
  weather: RoomWeather;
  night: boolean;
  colour: KipColour;
  /** KIP's colour ramp, for tinted items (`tint: true`). */
  ramp: KipRamp;
  /** Only the loop frames may read it: the static picture is memoised without it. */
  screen: MonitorScreen;
}

export interface ItemLayers {
  base?: RoomRect[];
  /** Glows drawn over the light layer (lamps, screens). Only items with `emissive: true` return any. */
  emissive?: RoomRect[];
  /** Three loop frames, 400 ms each. Only items with `frames: 3` return them. */
  frames?: [RoomRect[], RoomRect[], RoomRect[]];
}

export type SeatStyle = 'standard' | 'low';

export interface ItemArt {
  id: ItemId;
  slot: RoomSlot;
  draw(ctx: ItemContext): ItemLayers;
  emissive?: boolean;
  frames?: 3;
  /** Takes KIP's colour (the mug). */
  tint?: boolean;
  /** Desk items only: where KIP sits (draw.ts `kipSeat`). */
  style?: SeatStyle;
}

const REGISTRY = new Map<ItemId, ItemArt>();

export function registerItems(items: readonly ItemArt[]): void {
  for (const item of items) REGISTRY.set(item.id, item);
}

/** The art for an id, or undefined: an unknown id is skipped by the engine, never thrown. */
export function itemArt(id: ItemId | null | undefined): ItemArt | undefined {
  return id ? REGISTRY.get(id) : undefined;
}
