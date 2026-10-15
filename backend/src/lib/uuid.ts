/** A UUID in its canonical 8-4-4-4-12 hex form, any case: the one copy every id check uses (plan ruling PF-F14). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);
