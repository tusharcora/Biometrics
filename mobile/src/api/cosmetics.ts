import { apiFetch } from './client';
import { send } from './buddies';
import type { KipWorn, RoomLoadout } from '../lib/room/loadout';

// KIP's room (spec 2026-10-14 KIP's room §5). The server decides ownership; the app only shows it.
export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  room: Record<string, string | null>;
  worn: Record<string, string | null>;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
}

export const fetchCosmetics = () => apiFetch<CosmeticsDTO>('/me/cosmetics');
export const putCosmetics = (body: { room: RoomLoadout; worn: KipWorn; version: number }) =>
  apiFetch<CosmeticsDTO>('/me/cosmetics', send('PUT', body));
export const postCosmeticsSeen = (itemIds: string[]) => apiFetch<void>('/me/cosmetics/seen', send('POST', { itemIds }));
