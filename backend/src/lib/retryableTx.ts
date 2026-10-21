/** A transaction that lost a lock wait (P2028: Prisma's interactive-transaction timeout) or a deadlock (Postgres
 * 40P01; Prisma's P2034 for a write conflict or deadlock, or a raw statement's P2010 carrying it): nothing was written,
 * and the same request can be sent again. Room cheers and gift sends answer it as 503 try_later. */
export function isRetryableTx(err: unknown): boolean {
  const e = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown } | null;
  if (!e) return false;
  if (e.code === 'P2028' || e.code === 'P2034' || e.code === '40P01' || e.meta?.code === '40P01') return true;
  return typeof e.message === 'string' && /\b40P01\b|deadlock detected/.test(e.message);
}
