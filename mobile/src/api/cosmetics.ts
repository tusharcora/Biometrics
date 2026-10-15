import { apiFetch } from './client';
import { send } from './buddies';
import type { KipWorn } from '../lib/room/loadout';
import type { RoomLayout } from '../lib/room/iso/geometry';

// KIP's room (spec 2026-10-15 §12). The server decides ownership and validates every layout; the app only shows it.
export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  layout: unknown;
  tier: number;
  cap: number;
  counts: Record<string, number>;
  worn: Record<string, string | null>;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  welcomed: boolean;
}

export const fetchCosmetics = () => apiFetch<CosmeticsDTO>('/me/cosmetics');
export const putCosmetics = (body: { layout: RoomLayout; worn: KipWorn; version: number }) =>
  apiFetch<CosmeticsDTO>('/me/cosmetics', send('PUT', body));
export const postCosmeticsSeen = (itemIds: string[]) => apiFetch<void>('/me/cosmetics/seen', send('POST', { itemIds }));
export const postRoomWelcomed = () => apiFetch<void>('/me/room/welcomed', send('POST', {}));
