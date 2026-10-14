// Reading and saving KIP's room (spec 2026-10-14 KIP's room §2, §5). Owned = the starter items + unlock rows. A
// stored slot naming an item the user does not own (or no longer in the shipped catalogue) reads back as the slot's
// starter piece; the app never decides ownership. Saves are optimistic: version must match, every save increments it.
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import {
  COSMETICS_CATALOGUE_VERSION, COSMETICS_RELEASE, EMPTY_WORN, OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_IDS, STARTER_ROOM, WORN_SLOTS,
  cosmeticItem, type CosmeticSlot, type RoomSlot, type WornSlot,
} from './catalogue';
import { countersOf, loadUnlockFacts } from './facts';
import { grantCosmeticsSafely } from './unlock';

type Room = Record<RoomSlot, string | null>;
type Worn = Record<WornSlot, string | null>;

export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  room: Room;
  worn: Worn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
}

export interface SaveFailure {
  status: 400 | 403 | 409;
  body: { error: 'invalid_body' | 'unknown_item' | 'wrong_slot' | 'required_slot' | 'not_owned' | 'stale'; itemIds?: string[] };
}

const shipped = (id: string) => {
  const item = cosmeticItem(id);
  return item && item.release <= COSMETICS_RELEASE ? item : undefined;
};

function ownedFrom(rows: ReadonlyArray<{ itemId: string }>): Set<string> {
  return new Set([...STARTER_IDS, ...rows.map((r) => r.itemId).filter((id) => shipped(id))]);
}

function readRoom(json: unknown, owned: ReadonlySet<string>): Room {
  const stored = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const room = { ...STARTER_ROOM } as Room;
  for (const slot of ROOM_SLOTS) {
    const id = stored[slot];
    if (id === null && OPTIONAL_ROOM_SLOTS.has(slot)) room[slot] = null;
    else if (typeof id === 'string' && owned.has(id) && shipped(id)?.slot === slot) room[slot] = id;
  }
  return room;
}

function readWorn(json: unknown, owned: ReadonlySet<string>): Worn {
  const stored = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const worn = { ...EMPTY_WORN } as Worn;
  for (const slot of WORN_SLOTS) {
    const id = stored[slot];
    if (typeof id === 'string' && owned.has(id) && shipped(id)?.slot === slot) worn[slot] = id;
  }
  return worn;
}

export async function readCosmetics(userId: string, now: Date, opts: { grant?: boolean } = {}): Promise<CosmeticsDTO> {
  if (opts.grant ?? true) await grantCosmeticsSafely(userId, now);
  const [rows, loadout, facts] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: [{ unlockedAt: 'asc' }, { itemId: 'asc' }], select: { itemId: true, source: true, seenAt: true } }),
    prisma.cosmeticLoadout.findUnique({ where: { userId } }),
    loadUnlockFacts(userId),
  ]);
  const owned = ownedFrom(rows);
  return {
    catalogueVersion: COSMETICS_CATALOGUE_VERSION,
    owned: [...owned].sort(),
    fresh: rows.filter((r) => r.seenAt === null && owned.has(r.itemId)).map((r) => ({ itemId: r.itemId, source: r.source })),
    room: loadout ? readRoom(loadout.room, owned) : { ...STARTER_ROOM },
    worn: loadout ? readWorn(loadout.worn, owned) : { ...EMPTY_WORN },
    version: loadout?.version ?? 0,
    counters: countersOf(facts),
  };
}

const INVALID: SaveFailure = { status: 400, body: { error: 'invalid_body' } };

function exactSlots(value: unknown, slots: readonly string[]): value is Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === slots.length && slots.every((s) => {
    const v = (value as Record<string, unknown>)[s];
    return Object.prototype.hasOwnProperty.call(value, s) && (v === null || typeof v === 'string');
  });
}

export function validateBody(body: unknown): { room: Room; worn: Worn; version: number } | SaveFailure {
  const b = (body && typeof body === 'object' ? body : {}) as { room?: unknown; worn?: unknown; version?: unknown };
  if (!exactSlots(b.room, ROOM_SLOTS) || !exactSlots(b.worn, WORN_SLOTS)) return INVALID;
  if (typeof b.version !== 'number' || !Number.isInteger(b.version) || b.version < 0) return INVALID;
  return { room: b.room as Room, worn: b.worn as Worn, version: b.version };
}

export function checkPieces(room: Room, worn: Worn, owned: ReadonlySet<string>): SaveFailure | null {
  const placed: Array<[CosmeticSlot, string]> = [
    ...ROOM_SLOTS.flatMap((s) => (room[s] === null ? [] : [[s, room[s]!] as [CosmeticSlot, string]])),
    ...WORN_SLOTS.flatMap((s) => (worn[s] === null ? [] : [[s, worn[s]!] as [CosmeticSlot, string]])),
  ];
  if (placed.some(([, id]) => !shipped(id))) return { status: 400, body: { error: 'unknown_item' } };
  if (placed.some(([slot, id]) => shipped(id)!.slot !== slot)) return { status: 400, body: { error: 'wrong_slot' } };
  if (ROOM_SLOTS.some((s) => room[s] === null && !OPTIONAL_ROOM_SLOTS.has(s))) return { status: 400, body: { error: 'required_slot' } };
  const notOwned = [...new Set(placed.map(([, id]) => id).filter((id) => !owned.has(id)))].sort();
  if (notOwned.length) return { status: 403, body: { error: 'not_owned', itemIds: notOwned } };
  return null;
}

const STALE: SaveFailure = { status: 409, body: { error: 'stale' } };

export async function saveCosmetics(userId: string, body: unknown, now: Date): Promise<{ ok: true; dto: CosmeticsDTO } | { ok: false; failure: SaveFailure }> {
  const parsed = validateBody(body);
  if ('status' in parsed) return { ok: false, failure: parsed };
  const rows = await prisma.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } });
  const bad = checkPieces(parsed.room, parsed.worn, ownedFrom(rows));
  if (bad) return { ok: false, failure: bad };
  const data = { room: parsed.room, worn: parsed.worn };
  if (parsed.version === 0) {
    try {
      await prisma.cosmeticLoadout.create({ data: { userId, ...data, version: 1 } });
    } catch (err) {
      // Another first save won the race (or a row already exists): the app re-reads.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, failure: STALE };
      throw err;
    }
  } else {
    const { count } = await prisma.cosmeticLoadout.updateMany({ where: { userId, version: parsed.version }, data: { ...data, version: { increment: 1 } } });
    if (count === 0) return { ok: false, failure: STALE };
  }
  return { ok: true, dto: await readCosmetics(userId, now, { grant: false }) };
}

/** Marks unseen rows seen. Ids the user has no row for (unknown, unowned, starters) are ignored. */
export async function markSeen(userId: string, body: unknown, now: Date): Promise<boolean> {
  const itemIds = (body as { itemIds?: unknown } | null)?.itemIds;
  if (!Array.isArray(itemIds) || itemIds.length > 500 || !itemIds.every((i) => typeof i === 'string')) return false;
  if (itemIds.length) await prisma.cosmeticUnlock.updateMany({ where: { userId, itemId: { in: itemIds as string[] }, seenAt: null }, data: { seenAt: now } });
  return true;
}
