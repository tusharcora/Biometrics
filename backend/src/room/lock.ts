// One advisory lock for every write to a user's room (spec 2026-10-15 §2.2, §12): room and worn saves now; P2's
// expansion and P4's gift-send take the same lock, so a save, a gift and a grow can never interleave. Transaction
// scoped: it is released when the transaction ends. A namespace of its own, so it never collides with the coach
// consent lock or the sleep repository's.
import type { Prisma } from '@prisma/client';

export const ROOM_LOCK_NAMESPACE = 0x526f6f6d; // 'Room'

export async function lockRoom(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ROOM_LOCK_NAMESPACE}::int4, hashtext(${userId}))`;
}
