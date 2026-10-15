import { apiFetch } from './client';
import { send } from './buddies';
import type { CosmeticsDTO } from './cosmetics';

// KIP coins (spec 2026-10-15 §12 P2). The server decides every amount, price and gate; the app only shows them.
export type CoinKind =
  | 'sleep_goal' | 'steps' | 'checkin' | 'recap' | 'cheer_given' | 'cheer_got' | 'challenge' | 'firstweek' | 'buy' | 'expand';
export interface CoinEventDTO { kind: CoinKind; amount: number; at: string; seen: boolean }
export interface CoinsDTO { balance: number; today: { earned: number; cap: number }; events: CoinEventDTO[]; next: string | null }
export interface ShopDTO { week: string; set: { id: string; itemIds: string[] }; items: Array<{ itemId: string; price: number }> }
/** A replayed request id answers the current balance, not the first answer's (ruling PF-F9). */
export interface PurchaseDTO { balance: number; counts: Record<string, number> }
/** The full GET /me/cosmetics body, the balance after, and the pieces the new window sent to the inventory. */
export type ExpandDTO = CosmeticsDTO & { balance: number; stored: number };
export type FirstWeekTaskKey = 'checkin' | 'place' | 'sleep' | 'fern' | 'cheer' | 'recap' | 'streak7';
export type FirstWeekDTO =
  | { open: false }
  | { open: true; day: number; done: number; tasks: Array<{ key: FirstWeekTaskKey; done: boolean; reward: number }>; next: { tier: 2; coins: number; streak: number } };

export const fetchCoins = (cursor?: string) => apiFetch<CoinsDTO>(cursor ? `/me/coins?cursor=${encodeURIComponent(cursor)}` : '/me/coins');
export const postCoinsSeen = (through: string) => apiFetch<void>('/me/coins/seen', send('POST', { through }));
export const fetchShop = () => apiFetch<ShopDTO>('/me/shop');
export const postPurchase = (requestId: string, itemId: string) => apiFetch<PurchaseDTO>('/me/shop/purchases', send('POST', { requestId, itemId }));
export const postExpand = (requestId: string, toTier: 2 | 3) => apiFetch<ExpandDTO>('/me/room/expand', send('POST', { requestId, toTier }));
export const fetchFirstWeek = () => apiFetch<FirstWeekDTO>('/me/firstweek');
