import type { CampaignRecurrenceType } from "./campaigns.types";

export function computeNextOccurrence(
  from: Date,
  recurrenceType: CampaignRecurrenceType,
  recurrenceInterval: number,
): Date {
  const next = new Date(from.getTime());
  const interval = Math.max(1, recurrenceInterval);

  switch (recurrenceType) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + interval * 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + interval);
      break;
  }

  return next;
}
