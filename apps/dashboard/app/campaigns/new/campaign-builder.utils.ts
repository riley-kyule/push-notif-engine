export function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function parseDateTime(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// How far ahead of UTC `timeZone` is at the given instant, in milliseconds
// (e.g. +3h for Africa/Nairobi). Computed via Intl rather than string
// parsing so it doesn't depend on the host's own local timezone.
function getZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

// `value` comes from a <input type="datetime-local"> -- a wall-clock time with
// no timezone info. We need to interpret it as local time *in the site's own
// timezone* (so a campaign manager scheduling "15:00" for a Ghana site sends
// at 15:00 in Ghana, not 15:00 in the browser's timezone), then convert that
// to the correct UTC instant.
export function localTimeInZoneToUtcIso(value: string, timeZone: string): string | null {
  if (!value) {
    return null;
  }

  const guessUtc = new Date(`${value}:00.000Z`);
  if (Number.isNaN(guessUtc.getTime())) {
    return null;
  }

  const offsetMs = getZoneOffsetMs(guessUtc, timeZone);
  return new Date(guessUtc.getTime() - offsetMs).toISOString();
}
