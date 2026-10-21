// A visit to a buddy's room, the pure parts (spec 2026-10-15 §10.1; P4 rulings 24, 27): the body as the app draws it
// (a broken layout reads as the starter room), the room's tier from its size (the size is all the server sends),
// the pieces you don't have with how to get them (a price or the catalogue's generic rule, never "they earned"), the
// neutral light by the visitor's clock, and panning inside the room.
import type { RoomVisitDTO } from '../../api/rooms';
import { isNightTime } from '../home/scene';
import { kipColourOf } from '../kip/kipColour';
import type { KipColour } from '../kip/kipArt';
import { kipWornOf } from '../kip/wornArt';
import { CATALOGUE, catalogueItem } from './catalogue';
import { clampAxis } from './iso/crop';
import type { RoomLayout, Tier } from './iso/geometry';
import { readLayout } from './layout';
import type { ItemId, KipWorn } from './loadout';
import { ROOM_COPY, itemName, unlockLine, unlockSpoken } from './roomCopy';

export interface RoomVisit {
  name: string;
  layout: RoomLayout;
  tier: Tier;
  size: { n: number; m: number };
  colour: KipColour;
  worn: KipWorn;
  cheersThisWeek: number;
  cheeredToday: boolean;
}

export const tierOfSize = (s: { n: number; m: number }): Tier => (s.n === 9 ? 3 : s.n === 8 ? 2 : 1);

export function readVisit(dto: RoomVisitDTO): RoomVisit {
  const size = { n: Number(dto.size?.n) || 7, m: Number(dto.size?.m) || 7 };
  return {
    name: typeof dto.name === 'string' ? dto.name : '', layout: readLayout(dto.layout), tier: tierOfSize(size), size,
    colour: kipColourOf(dto.kipColour), worn: kipWornOf(dto.kipWorn),
    cheersThisWeek: Math.max(0, Math.trunc(Number(dto.cheersThisWeek)) || 0), cheeredToday: dto.cheeredToday === true,
  };
}

export const MAX_MISSING = 12;

/** Placed items you own none of, each once, in catalogue order, at most 12 (ruling 27). */
export function missingPieces(layout: RoomLayout, mine: Readonly<Record<ItemId, number>>): ItemId[] {
  const placed = new Set(layout.pieces.map((p) => p.item));
  return CATALOGUE.items.filter((i) => placed.has(i.id) && !((mine[i.id] ?? 0) > 0)).map((i) => i.id).slice(0, MAX_MISSING);
}

/** How to get a piece: the shop's price, or the catalogue's generic rule; a trophy is a challenge trophy. */
export function pieceInfo(id: ItemId): { name: string; line: string; spoken: string } {
  const item = catalogueItem(id);
  const name = itemName(id);
  if (!item) return { name, line: '', spoken: '' };
  if (item.unlock.kind === 'shop' && item.price !== undefined) {
    const line = ROOM_COPY.visit.price(item.price);
    return { name, line, spoken: line };
  }
  if (item.unlock.kind === 'prize') return { name, line: ROOM_COPY.visit.trophy, spoken: ROOM_COPY.visit.trophy };
  return { name, line: unlockLine(item.unlock), spoken: unlockSpoken(item.unlock) };
}

/** The neutral light (ruling 24): the fallback sky, day or night by the visitor's own clock. */
export function visitLight(now: Date): { weather: 'fallback'; night: boolean } {
  return { weather: 'fallback', night: isNightTime(now) };
}

/** A pan by (dx, dy) points from `offset`, clamped so the room's edges never show. */
export function panTo(
  offset: { x: number; y: number },
  dx: number,
  dy: number,
  view: { width: number; height: number },
  room: { width: number; height: number },
): { x: number; y: number } {
  return { x: clampAxis(offset.x + dx, view.width, room.width), y: clampAxis(offset.y + dy, view.height, room.height) };
}
