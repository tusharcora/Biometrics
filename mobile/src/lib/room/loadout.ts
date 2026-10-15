// A set's slot record and what KIP wears (spec 2026-10-14 KIP Coach §5, KIP's room §7). The room itself is a
// free-build layout now (spec 2026-10-15 §2); worn items keep their four slots.
import { WORN_SLOTS, type RoomSlot, type WornSlot } from './catalogue';

export type ItemId = string;
export type RoomLoadout = Record<RoomSlot, ItemId | null>;
export type KipWorn = Record<WornSlot, ItemId | null>;

/** KIP wears nothing in Spec A. */
export const EMPTY_WORN: KipWorn = { head: null, face: null, neck: null, ears: null };

export function wornKey(worn: KipWorn): string {
  return WORN_SLOTS.map((s) => `${s}=${worn[s] ?? ''}`).join('|');
}
