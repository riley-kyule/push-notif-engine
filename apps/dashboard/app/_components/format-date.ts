const DISPLAY_TIME_ZONE = "Etc/GMT-3"; // UTC+3, the operating timezone for all EPE-managed sites.

function getParts(value: string | number | Date): Record<string, string> {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

/** dd/mm/yyyy-hh:mm:ss, displayed in UTC+3 regardless of server/browser locale. */
export function formatDisplayDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = getParts(date);
  return `${parts.day}/${parts.month}/${parts.year}-${parts.hour}:${parts.minute}:${parts.second}`;
}

/** dd/mm/yyyy only, displayed in UTC+3. */
export function formatDisplayDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = getParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}
