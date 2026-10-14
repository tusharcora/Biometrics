// What a buddy sees of your KIP (spec 2026-10-14 KIP's room §7): the worn ids only, never the room or the owned list.
// An id the shipped catalogue does not know, or in the wrong slot, is dropped.
import { COSMETICS_RELEASE, EMPTY_WORN, WORN_SLOTS, cosmeticItem, type WornSlot } from './catalogue';

export type KipWornDTO = Record<WornSlot, string | null>;

export function kipWornOf(json: unknown): KipWornDTO {
  const out = { ...EMPTY_WORN } as KipWornDTO;
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out;
  for (const slot of WORN_SLOTS) {
    const id = (json as Record<string, unknown>)[slot];
    const item = typeof id === 'string' ? cosmeticItem(id) : undefined;
    if (item && item.slot === slot && item.release <= COSMETICS_RELEASE) out[slot] = id as string;
  }
  return out;
}
