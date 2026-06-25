import { apiJson } from "../../lib/server-api";

export type PushType = "campaign" | "automation" | "manual";

export interface FailedDeliveryRow {
  id: string;
  siteId: string;
  siteName: string;
  pushType: PushType;
  pushName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  reason: string;
  subscriberId: string | null;
  createdAt: string;
}

export interface FailedDeliveryPage {
  items: FailedDeliveryRow[];
  total: number;
}

export interface FailedDeliveryFilters {
  siteId?: string | undefined;
  pushType?: PushType | undefined;
  reason?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

const emptyPage: FailedDeliveryPage = { items: [], total: 0 };

export function getPushTypeLabel(pushType: PushType): string {
  if (pushType === "campaign") return "Campaign";
  if (pushType === "automation") return "Automation";
  return "Manual";
}

function buildQuery(filters: FailedDeliveryFilters): string {
  const search = new URLSearchParams();
  if (filters.siteId) search.set("siteId", filters.siteId);
  if (filters.pushType) search.set("pushType", filters.pushType);
  if (filters.reason) search.set("reason", filters.reason);
  search.set("limit", String(filters.limit ?? 25));
  search.set("offset", String(filters.offset ?? 0));
  return search.toString();
}

export async function getFailedDeliveriesPage(filters: FailedDeliveryFilters = {}): Promise<FailedDeliveryPage> {
  const response = await apiJson<{ success?: boolean; data?: FailedDeliveryPage }>(
    `/analytics/failed-deliveries?${buildQuery(filters)}`,
  );
  return response?.data ?? emptyPage;
}

export async function getFailureReasons(): Promise<Array<{ reason: string; count: number }>> {
  const response = await apiJson<{ success?: boolean; data?: Array<{ reason: string; count: number }> }>(
    "/analytics/failed-deliveries/reasons",
  );
  return response?.data ?? [];
}
