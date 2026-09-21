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
