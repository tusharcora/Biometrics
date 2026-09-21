// Pure helpers for mapping instants to the local civil date in an IANA zone.
// Intl is used rather than a date library: the runtime already ships the tz
// database, and this is the only place the backend needs it.

// Explicit offsets ("+05:00") are accepted by newer Intl implementations but
// are not IANA names and do not follow DST, so a user "in +05:00" would drift
// wrong twice a year. Reject them; the client sends a real zone name.
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return false;
  if (/^[+-]/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

// One formatter per zone: constructing Intl.DateTimeFormat is comparatively
// expensive and a backfill converts hundreds of instants for the same user.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    // Throws RangeError for an unknown zone. Deliberately not caught: silently
    // treating a bad zone as UTC would re-introduce the very misalignment this
    // helper exists to remove.
    f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, f);
  }
  return f;
}

/** YYYY-MM-DD of `instant` on the wall clock in `timeZone`. */
export function localCivilDate(instant: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (!year || !month || !day) {
    throw new Error(`Could not derive civil date for ${instant.toISOString()} in ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

/** UTC midnight of a YYYY-MM-DD civil date: the `recordedAt` convention shared by all four metrics. */
export function civilDateToUtcMidnight(civilDate: string): Date {
  return new Date(`${civilDate}T00:00:00Z`);
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>();

function clockFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = clockFormatters.get(timeZone);
  if (!f) {
    // hourCycle h23 so midnight is 00, never the "24" some locales emit with hour12: false.
    f = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    clockFormatters.set(timeZone, f);
  }
  return f;
}

/**
 * Minutes elapsed since 12:00 (noon) local wall-clock time, in [0, 1440).
 * Noon-anchored so a night's bedtimes (say 22:00 .. 02:00) form one contiguous
 * run (600 .. 840) instead of wrapping around midnight, which would make
 * 23:30 and 00:30 look 23 hours apart. Anchoring at noon is safe because
 * nobody's main sleep starts near noon.
 */
export function minutesSinceLocalNoon(instant: Date, timeZone: string): number {
  const parts = clockFormatterFor(timeZone).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Could not derive local clock time for ${instant.toISOString()} in ${timeZone}`);
  }
  return (hour * 60 + minute - 12 * 60 + 24 * 60) % (24 * 60);
}
