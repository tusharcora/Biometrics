// Tray icons (spec 2026-10-14 KIP's room §8 Icons): each room piece registers its board sprite (or a 16 × 16 surface
// patch); worn pieces are KIP's head wearing them. Icons are drawn with react-native-svg (ItemIcon) and never build a
// room picture.
import { kipRamp, KIP_COLOURS, wornIconRects, type KipColour } from '../kip/kipArt';
import { tintOf, wornArt } from '../kip/wornArt';
import type { RoomRect } from './grid';
import type { ItemId } from './loadout';

/** A board sprite rect: x, y, w, h, colour; '@b' '@h' '@s' '@d' are KIP's body, light, shade and deep. */
export type SpriteRect = readonly [number, number, number, number, string];

const ICONS = new Map<ItemId, readonly SpriteRect[]>();

export function registerIcons(map: Readonly<Record<ItemId, readonly SpriteRect[]>>): void {
  for (const [id, rects] of Object.entries(map)) ICONS.set(id, rects);
}

export function itemIcon(id: ItemId): readonly SpriteRect[] | undefined {
  return ICONS.get(id) ?? (wornArt(id) ? wornIconRects(id, 'coral').map((r) => [r.x, r.y, r.w, r.h, r.fill] as const) : undefined);
}

/** The icon's rects in this KIP colour (tinted cells resolved). */
export function iconRectsFor(id: ItemId, colour: KipColour): RoomRect[] {
  if (wornArt(id)) return wornIconRects(id, colour).map((r) => [r.x, r.y, r.w, r.h, r.fill]);
  const ramp = kipRamp(KIP_COLOURS[colour]);
  return (ICONS.get(id) ?? []).map(([x, y, w, h, c]) => [x, y, w, h, tintOf(c, ramp)]);
}
