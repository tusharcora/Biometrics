// Keyset cursors for the buddy list and Activity: (timestamp, id), newest first.

import { BuddyError, UUID_RE } from './errors';

export interface Cursor { at: Date; id: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.at.toISOString(), c.id])).toString('base64url');
}

/** Absent (undefined, null, '') → null. Anything that is not a cursor this server made → invalid_cursor. */
export function parseCursor(raw: unknown): Cursor | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw new BuddyError('invalid_cursor');
  try {
    const [iso, id] = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as [unknown, unknown];
    const at = new Date(String(iso));
    if (typeof iso !== 'string' || Number.isNaN(at.getTime()) || typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('bad');
    return { at, id };
  } catch {
    throw new BuddyError('invalid_cursor');
  }
}

/** Rows strictly after the cursor in (field desc, id desc) order. */
export function keysetBefore(field: 'lastActivityAt' | 'createdAt', c: Cursor) {
  return { OR: [{ [field]: { lt: c.at } }, { [field]: c.at, id: { lt: c.id } }] };
}
