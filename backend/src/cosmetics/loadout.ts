// Reading and saving KIP's room (spec 2026-10-14 KIP's room §2, §5). Owned = the starter items + unlock rows. A
// stored slot naming an item the user does not own (or no longer in the shipped catalogue) reads back as the slot's
// starter piece; the app never decides ownership. Saves are optimistic: version must match, every save increments it.
// Free-build saves (spec 2026-10-15 §12) carry an iso layout, checked against the catalogue, the placement rules and
// the owned counts under the per-user room lock. Spec B's slot room was converted and dropped in P2 (§2.4).
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import {
  COSMETICS_CATALOGUE_VERSION, EMPTY_WORN, OPTIONAL_ROOM_SLOTS, ROOM_SLOTS, STARTER_IDS, STARTER_ROOM, WORN_SLOTS,
  shippedItem, type RoomSlot, type WornSlot,
} from './catalogue';
import { countersOf, loadUnlockFacts } from './facts';
import { grantCosmeticsSafely } from './unlock';
import { starterLayout } from '../room/convert';
import { STYLE_KEYS, capFor, parseLayout, validateLayout, type BadReason, type RoomLayout, type Tier } from '../room/geometry';
import { countsOf, geometryDeps, placedCounts, readLayout, toTier } from '../room/layout';
import { lockRoom } from '../room/lock';

type Room = Record<RoomSlot, string | null>;
type Worn = Record<WornSlot, string | null>;

export interface CosmeticsDTO {
  catalogueVersion: number;
  owned: string[];
  fresh: Array<{ itemId: string; source: string }>;
  layout: RoomLayout;
  tier: Tier;
  cap: number;
  /** owned(item) for every item with a count (spec §2.2). */
  counts: Record<string, number>;
  worn: Worn;
  version: number;
  counters: { recapsRead: number; buddyCheers: number };
  /** The welcome card has been answered on some device (spec §11.1, plan ruling 13). */
  welcomed: boolean;
}

export function ownedFrom(rows: ReadonlyArray<{ itemId: string }>): Set<string> {
  return new Set([...STARTER_IDS, ...rows.map((r) => r.itemId).filter((id) => shippedItem(id))]);
}

export function readRoom(json: unknown, owned: ReadonlySet<string>): Room {
  const stored = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const room = { ...STARTER_ROOM } as Room;
  for (const slot of ROOM_SLOTS) {
    const id = stored[slot];
    if (id === null && OPTIONAL_ROOM_SLOTS.has(slot)) room[slot] = null;
    else if (typeof id === 'string' && owned.has(id) && shippedItem(id)?.slot === slot) room[slot] = id;
  }
  return room;
}

function readWorn(json: unknown, owned: ReadonlySet<string>): Worn {
  const stored = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const worn = { ...EMPTY_WORN } as Worn;
  for (const slot of WORN_SLOTS) {
    const id = stored[slot];
    if (typeof id === 'string' && owned.has(id) && shippedItem(id)?.slot === slot) worn[slot] = id;
  }
  return worn;
}

export async function readCosmetics(userId: string, now: Date, opts: { grant?: boolean } = {}): Promise<CosmeticsDTO> {
  if (opts.grant ?? true) await grantCosmeticsSafely(userId, now);
  const [rows, loadout, facts, firstWeek] = await Promise.all([
    prisma.cosmeticUnlock.findMany({ where: { userId }, orderBy: [{ unlockedAt: 'asc' }, { itemId: 'asc' }], select: { itemId: true, source: true, seenAt: true } }),
    prisma.cosmeticLoadout.findUnique({ where: { userId } }),
    loadUnlockFacts(userId),
    prisma.roomFirstWeek.findUnique({ where: { userId }, select: { welcomedAt: true } }),
  ]);
  const owned = ownedFrom(rows);
  const counts = countsOf(rows);
  const layout = (loadout ? readLayout(loadout.layout, counts) : null) ?? starterLayout();
  const tier = toTier(loadout?.tier);
  return {
    catalogueVersion: COSMETICS_CATALOGUE_VERSION,
    owned: [...owned].sort(),
    fresh: rows.filter((r) => r.seenAt === null && owned.has(r.itemId)).map((r) => ({ itemId: r.itemId, source: r.source })),
    layout,
    tier,
    cap: capFor(tier),
    counts,
    worn: loadout ? readWorn(loadout.worn, owned) : { ...EMPTY_WORN },
    version: loadout?.version ?? 0,
    counters: countersOf(facts),
    welcomed: !!firstWeek?.welcomedAt,
  };
}

export type SaveError =
  | 'invalid_body' | 'update_app' | 'unknown_item' | 'wrong_layer' | 'bad_place' | 'desk_required' | 'room_full' | 'not_owned' | 'stale';
export interface SaveFailure {
  status: 400 | 403 | 409;
  body: { error: SaveError; itemIds?: string[]; pieceIds?: string[]; reason?: BadReason };
}
/** Postgres INTEGER (Spec B Task 5 minor: 1e12 overflowed into a 500). */
export const MAX_VERSION = 2 ** 31 - 1;
export const MAX_BODY_BYTES = 32 * 1024;

const INVALID: SaveFailure = { status: 400, body: { error: 'invalid_body' } };
const STALE: SaveFailure = { status: 409, body: { error: 'stale' } };

function exactSlots(value: unknown, slots: readonly string[]): value is Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === slots.length && slots.every((s) => {
    const v = (value as Record<string, unknown>)[s];
    return Object.prototype.hasOwnProperty.call(value, s) && (v === null || typeof v === 'string');
  });
}

export function validateBody(body: unknown): { layout: RoomLayout; worn: Worn; version: number } | SaveFailure {
  const b = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  // A Spec B dev build (spec §2.4): its slot body can't be saved any more.
  if ('room' in b && !('layout' in b)) return { status: 400, body: { error: 'update_app' } };
  if (Object.keys(b).sort().join(',') !== 'layout,version,worn') return INVALID;
  const layout = parseLayout(b.layout);
  if (!layout || !exactSlots(b.worn, WORN_SLOTS)) return INVALID;
  if (typeof b.version !== 'number' || !Number.isInteger(b.version) || b.version < 0 || b.version > MAX_VERSION) return INVALID;
  return { layout, worn: b.worn as Worn, version: b.version };
}

/** Every catalogue, geometry and ownership rule, in the order of spec §12. */
export function checkLayout(layout: RoomLayout, worn: Worn, tier: Tier, counts: Readonly<Record<string, number>>): SaveFailure | null {
  const wornIds = WORN_SLOTS.flatMap((s) => (worn[s] === null ? [] : [worn[s]!]));
  const styleIds = STYLE_KEYS.map((k) => layout.styles[k]);
  if ([...layout.pieces.map((p) => p.item), ...styleIds, ...wornIds].some((id) => !shippedItem(id))) {
    return { status: 400, body: { error: 'unknown_item' } };
  }
  const wrongStyle = STYLE_KEYS.some((k) => shippedItem(layout.styles[k])!.slot !== k);
  const wrongWorn = WORN_SLOTS.some((s) => worn[s] !== null && shippedItem(worn[s]!)!.slot !== s);
  if (wrongStyle || wrongWorn) return { status: 400, body: { error: 'wrong_layer' } };
  const geo = validateLayout(layout, tier, geometryDeps);
  if (geo?.error === 'bad_place') return { status: 400, body: { error: 'bad_place', reason: geo.reason, pieceIds: geo.pieceIds } };
  if (geo) return { status: 400, body: { error: geo.error } };
  const notOwned = new Set<string>();
  for (const [item, n] of Object.entries(placedCounts(layout))) if (n > (counts[item] ?? 0)) notOwned.add(item);
  for (const id of [...styleIds, ...wornIds]) if (!((counts[id] ?? 0) > 0)) notOwned.add(id);
  return notOwned.size ? { status: 403, body: { error: 'not_owned', itemIds: [...notOwned].sort() } } : null;
}

/** Inserts the user's first-week row if it is missing (ON CONFLICT DO NOTHING: never a P2002 inside a transaction). */
async function ensureFirstWeek(db: Prisma.TransactionClient | typeof prisma, userId: string): Promise<void> {
  await db.roomFirstWeek.createMany({ data: [{ userId }], skipDuplicates: true });
}

export async function saveCosmetics(userId: string, body: unknown, now: Date, rawBytes?: number): Promise<{ ok: true; dto: CosmeticsDTO } | { ok: false; failure: SaveFailure }> {
  if (rawBytes !== undefined && rawBytes > MAX_BODY_BYTES) return { ok: false, failure: INVALID };
  const parsed = validateBody(body);
  if ('status' in parsed) return { ok: false, failure: parsed };
  let tier: Tier = 1;
  let failure: SaveFailure | null;
  try {
    failure = await prisma.$transaction(async (tx) => {
      // One writer at a time per room (spec §2.2); the version check below still answers another device's save.
      await lockRoom(tx, userId);
      const [rows, row] = await Promise.all([
        tx.cosmeticUnlock.findMany({ where: { userId }, select: { itemId: true } }),
        tx.cosmeticLoadout.findUnique({ where: { userId }, select: { layout: true, version: true, tier: true } }),
      ]);
      tier = toTier(row?.tier);
      const bad = checkLayout(parsed.layout, parsed.worn, tier, countsOf(rows));
      if (bad) return bad;
      const data = {
        layout: parsed.layout as unknown as Prisma.InputJsonValue,
        worn: parsed.worn as unknown as Prisma.InputJsonValue,
      };
      if (parsed.version === 0) {
        if (row) return STALE;
        await tx.cosmeticLoadout.create({ data: { userId, ...data, version: 1 } });
      } else {
        const { count } = await tx.cosmeticLoadout.updateMany({ where: { userId, version: parsed.version }, data: { ...data, version: { increment: 1 } } });
        if (count === 0) return STALE;
      }
      // "Placed a piece" (spec §11.1): an instance id the stored layout (or, with no row, the starter one) did not have.
      const before = new Set((row ? parseLayout(row.layout) ?? starterLayout() : starterLayout()).pieces.map((p) => p.id));
      if (parsed.layout.pieces.some((p) => !before.has(p.id))) {
        await ensureFirstWeek(tx, userId);
        await tx.roomFirstWeek.updateMany({ where: { userId, firstPlacedAt: null }, data: { firstPlacedAt: now } });
      }
      return null;
    });
  } catch (err) {
    // A first save racing another create (the lock makes this a backstop only): the app re-reads.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: false, failure: STALE };
    throw err;
  }
  if (failure) return { ok: false, failure };
  console.info(JSON.stringify({ event: 'room.saved', pieces: parsed.layout.pieces.length, tier }));
  return { ok: true, dto: await readCosmetics(userId, now, { grant: false }) };
}

/** The welcome card was answered (spec §11.1): the first time is kept. */
export async function markWelcomed(userId: string, now: Date): Promise<void> {
  await ensureFirstWeek(prisma, userId);
  await prisma.roomFirstWeek.updateMany({ where: { userId, welcomedAt: null }, data: { welcomedAt: now } });
}

/** Marks unseen rows seen. Ids the user has no row for (unknown, unowned, starters) are ignored. */
export async function markSeen(userId: string, body: unknown, now: Date): Promise<boolean> {
  const itemIds = (body as { itemIds?: unknown } | null)?.itemIds;
  if (!Array.isArray(itemIds) || itemIds.length > 500 || !itemIds.every((i) => typeof i === 'string')) return false;
  if (itemIds.length) await prisma.cosmeticUnlock.updateMany({ where: { userId, itemId: { in: itemIds as string[] }, seenAt: null }, data: { seenAt: now } });
  return true;
}
